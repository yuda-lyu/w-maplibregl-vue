/**
 * layerRenderers.mjs
 * 六種圖層（點/線/面/GeoJSON/等值線/影像）的增量渲染邏輯
 *
 * 每個 render* 函式接受：
 *   map        - MapLibre 地圖實例
 *   dataSets   - 已正規化的資料陣列
 *   tracked    - { sourceIds: [], layerIds: [], markers: [] }（函式內部會修改此物件的屬性）
 *   callbacks  - 事件回調物件（由 Vue 元件提供，內含 $nextTick / $refs 等閉包）
 *
 * tracked 物件在函式執行後其屬性可能被重新賦值，呼叫端需同步回 Vue data。
 */
import each from 'lodash-es/each.js'
import get from 'lodash-es/get.js'
import lmap from 'lodash-es/map.js'
import isNumber from 'lodash-es/isNumber.js'
import isEqual from 'lodash-es/isEqual.js'
import size from 'lodash-es/size.js'
import reverse from 'lodash-es/reverse.js'
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import oc from 'wsemi/src/color.mjs'
import dig from 'wsemi/src/dig.mjs'
import calcContours from 'w-gis/src/calcContours.mjs'
import fixCloseMultiPolygon from 'w-gis/src/fixCloseMultiPolygon.mjs'
import flattenMultiPolygon from 'w-gis/src/flattenMultiPolygon.mjs'
import invCoordMultiPolygonOrMultiPolyline from 'w-gis/src/invCoordMultiPolygonOrMultiPolyline.mjs'
import splitAndProcGeoJSON from 'w-gis/src/splitAndProcGeoJSON.mjs'
import { offDelegatedListenersByLayer } from './layerVisibility.mjs'


// ===== 工具函式 =====

/**
 * 集中式圖層 hover 管理器
 *
 * maplibre 對「帶 layerId 的委派事件」之內部實作, 是每個 listener 於每次 mousemove 各自執行一次
 * queryRenderedFeatures 命中測試(單次約 5ms 基礎開銷); 互動圖層一多(如 22 層 × enter/leave = 44 個
 * 委派 listener)單次滑鼠移動即阻塞主執行緒 200ms+。本管理器全 map 僅掛一個 mousemove listener,
 * 每次滑鼠移動最多執行一次 queryRenderedFeatures(帶全部已註冊圖層), 依命中差集對各圖層分發
 * enter/leave, 語意與原委派事件相同(enter 事件帶 features, 由上而下排序)。並加兩道防護:
 *   - 拖曳中(originalEvent.buttons > 0)與地圖動畫中(map.isMoving())不做命中測試——拖曳體驗優先, hover 狀態暫凍結
 *   - 命中測試節流(leading+trailing, 間隔 100ms)——高頻 mousemove 合併為一次查詢
 *
 * 注意: 每個 layerId 僅支援一組 handler(重複註冊為覆蓋語意, 與原生 map.on 可疊加多 listener 不同)
 */
const KEY_HOVER_MANAGER = '__wmlgvHoverManager'
export function onLayerHover(map, layerId, onEnter, onLeave) {
    let mgr = map[KEY_HOVER_MANAGER]
    if (!mgr) {
        mgr = { regs: {}, hovered: {} }
        map[KEY_HOVER_MANAGER] = mgr
        //對「先前 hover 中、本次未命中」之圖層分發 leave; hit 為 null 代表滑鼠離開地圖, 全部 leave
        let dispatchLeaves = (hit) => {
            each(Object.keys(mgr.hovered), (lid) => {
                if (hit && hit[lid]) return
                delete mgr.hovered[lid]
                let r = mgr.regs[lid]
                if (r && isfun(r.onLeave)) r.onLeave()
            })
        }
        //單次命中測試: 一次 queryRenderedFeatures 帶全部已註冊圖層, 依命中差集分發 enter/leave
        let runHitTest = () => {
            if (!map || !map.style) return //map 已被銷毀(節流 trailing timer 殘留之競態)
            let e = mgr.lastEv
            if (!e) return
            let lids = Object.keys(mgr.regs).filter((lid) => map.getLayer(lid))
            let fs = []
            if (lids.length > 0) {
                try {
                    fs = map.queryRenderedFeatures(e.point, { layers: lids }) || []
                }
                catch (err) {
                    fs = []
                }
            }
            let hit = {}
            each(fs, (f) => {
                let lid = f && f.layer && f.layer.id
                if (!lid) return
                if (!hit[lid]) hit[lid] = []
                hit[lid].push(f) //queryRenderedFeatures 由上而下排序, hit[lid][0] 即該層最上層 feature
            })
            dispatchLeaves(hit)
            each(Object.keys(hit), (lid) => {
                if (mgr.hovered[lid]) return
                mgr.hovered[lid] = true
                let r = mgr.regs[lid]
                if (r && isfun(r.onEnter)) r.onEnter({ point: e.point, lngLat: e.lngLat, originalEvent: e.originalEvent, features: hit[lid] })
            })
        }
        //節流(leading+trailing): 命中測試最多每 HIT_TEST_INTERVAL 執行一次, 高頻 mousemove 合併為一次查詢
        const HIT_TEST_INTERVAL = 100
        map.on('mousemove', (e) => {
            //拖曳中(按鍵按住)或地圖動畫中不做 hover 命中測試, 拖曳體驗優先(hover 狀態暫凍結)
            if (e.originalEvent && e.originalEvent.buttons > 0) return
            if (isfun(map.isMoving) && map.isMoving()) return
            mgr.lastEv = { point: e.point, lngLat: e.lngLat, originalEvent: e.originalEvent }
            let now = performance.now()
            let since = now - (mgr.lastRun || 0)
            if (since >= HIT_TEST_INTERVAL) {
                mgr.lastRun = now
                runHitTest()
            }
            else if (!mgr.pending) {
                mgr.pending = true
                setTimeout(() => {
                    mgr.pending = false
                    mgr.lastRun = performance.now()
                    runHitTest()
                }, HIT_TEST_INTERVAL - since)
            }
        })
        map.on('mouseout', () => {
            mgr.lastEv = null //使節流中之待執行命中測試失效, 避免滑鼠已離開地圖仍誤發 enter
            dispatchLeaves(null)
        })
    }
    mgr.regs[layerId] = { onEnter, onLeave }
}


/**
 * 反註冊圖層之 hover handler(圖層移除時呼叫, 使註冊與圖層同壽命)。
 * 若移除當下該圖層為 hover 中, 先發 leave 還原 cursor/tooltip 再移除。
 */
export function offLayerHover(map, layerId) {
    let mgr = map[KEY_HOVER_MANAGER]
    if (!mgr) return
    if (mgr.hovered[layerId]) {
        delete mgr.hovered[layerId]
        let r = mgr.regs[layerId]
        if (r && isfun(r.onLeave)) r.onLeave()
    }
    delete mgr.regs[layerId]
}


/**
 * 各型別「最新一輪 render 的正規化資料」存放處(掛於 map 實例上)。
 * 事件 handler 於事件觸發時來此查最新資料, 而非使用建層當時閉包捕捉的物件——
 * 否則 runtime 變更資料/樣式後(source 已存在僅 setData), 回呼會帶到舊值。
 *
 * store 完整形狀(新增欄位請同步維護此清單):
 *   polylineSets / polygonSets / geojsonSets / contourSets - 各型別最新正規化陣列
 *   contourBands   - { [kcs]: 色帶陣列 } 等值線各組最新色帶(含顏色增補)
 *   pointRenderSeq - { [srcId]: Number } 點圖層每 source 的 render 序號(兼「已知組」名冊, 供過期清理)
 *   pointSetsPrev  - { [kid]: 正規化組 } 點圖層上一輪已套用資料(供逐組差異跳過)
 */
const KEY_SETS_STORE = '__wmlgvSetsStore'
function getSetsStore(map) {
    if (!map[KEY_SETS_STORE]) map[KEY_SETS_STORE] = {}
    return map[KEY_SETS_STORE]
}


/**
 * 點是否在環（ring）內部（Ray Casting 演算法）
 * @param {Array} pt - [lng, lat]
 * @param {Array} ring - [[lng, lat], ...]
 */
export function pointInRing(pt, ring) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        let xi = ring[i][0]; let yi = ring[i][1]
        let xj = ring[j][0]; let yj = ring[j][1]
        if (((yi > pt[1]) !== (yj > pt[1])) &&
            (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) {
            inside = !inside
        }
    }
    return inside
}


/**
 * 將多個環座標（XOR 套疊結構）轉為 MapLibre GL 相容的 GeoJSON MultiPolygon
 */
export function buildPolygonGeometry(lls) {
    let pgs = fixCloseMultiPolygon(lls, { supposeType: 'ringStrings' })
    pgs = flattenMultiPolygon(pgs)
    pgs = invCoordMultiPolygonOrMultiPolyline(pgs)
    return { type: 'MultiPolygon', coordinates: pgs }
}


/**
 * 計算等值線色彩（基於 gradient 內插）
 */
export function getContourColor(k, n, gradient, funGetColor, polygonSet) {
    let fun = oc.interp(gradient || {
        0: 'rgb(255, 255, 255)',
        0.2: 'rgb(254, 178, 76)',
        0.4: 'rgb(252, 78, 42)',
        0.6: 'rgb(220, 58, 38)',
        0.8: 'rgb(200, 40, 23)',
        1: 'rgb(180, 30, 60)',
    })
    let _c = n > 0 ? fun(k / n) : fun(1)
    let c = ''
    if (isfun(funGetColor)) c = funGetColor({ defaultColor: _c, k, n, polygonSet })
    if (!isestr(c)) c = _c
    return c
}


/**
 * 等值線圖例生成
 * @param {{ polygonSets: Array }} data
 * @param {Object} contourSet - 含 legendNumDig, legendTextFormater, legendTextExtra
 * @returns {Array} legend（已 reverse，由大到小）
 */
export function buildContourLegend(data, contourSet) {
    let legends = lmap(data.polygonSets, 'range')
    function getText(k, range) {
        let low = range.low; let up = range.up; let delimiter = '-'
        if (isNumber(contourSet.legendNumDig)) {
            low = dig(range.low, contourSet.legendNumDig)
            up = dig(range.up, contourSet.legendNumDig)
        }
        if (isfun(contourSet.legendTextFormater)) {
            let r = contourSet.legendTextFormater({ low, up, legends, index: k })
            low = get(r, 'low'); up = get(r, 'up'); delimiter = get(r, 'delimiter', delimiter)
        }
        return { low, up, delimiter }
    }
    let legend = lmap(data.polygonSets, (v, k) => {
        let textExt = ''
        if (isfun(contourSet.legendTextExtra)) textExt = contourSet.legendTextExtra({ k, n: size(data.polygonSets), polygonSet: v })
        return { ...getText(k, v.range), textExt, color: v.color, arrow: false, index: k }
    })
    return reverse(legend)
}


// ===== 渲染函式 =====

//單一 pointSet 之 4 個 layer id(以 kid 識別)
function pointSetLayerIds(kid) {
    return [`point-${kid}-circle`, `point-${kid}-symbol`, `point-${kid}-cluster-circle`, `point-${kid}-cluster-count`]
}


//移除單一 pointSet(以 kid 識別)之全部 layer/source 與事件註冊, 並同步 tracked 與 store
function removePointSetByKid(map, kid, tracked, store) {
    let srcId = `point-${kid}-src`
    let lids = pointSetLayerIds(kid)
    offDelegatedListenersByLayer(map, (l) => lids.indexOf(l) >= 0) //清委派 click listeners(與圖層同壽命)
    each(lids, (lid) => {
        offLayerHover(map, lid)
        if (map.getLayer(lid)) map.removeLayer(lid)
    })
    if (map.getSource(srcId)) map.removeSource(srcId)
    tracked.layerIds = tracked.layerIds.filter((x) => lids.indexOf(x) < 0)
    tracked.sourceIds = tracked.sourceIds.filter((x) => x !== srcId)
    if (store.pointSetsPrev) delete store.pointSetsPrev[kid]
    if (store.pointRenderSeq) delete store.pointRenderSeq[srcId] //pending doRender 查無序號即作廢
}


/**
 * 渲染點圖層（circle + symbol，含叢集化；kid 識別 + 逐組差異跳過）
 * @param {Object} map
 * @param {Array} pointSets - 已正規化的 pointSets（各組含 kid）
 * @param {Object} clusterOpts - computeClusterOpts() 的回傳值
 * @param {Object} tracked - { sourceIds, layerIds, markers }
 * @param {Object} callbacks - {
 *   registerIcon(key, src, w, h): Promise,
 *   onPointClick(ptData, psData, p, coords): void,
 *   onPointEnter(ptData, psData, p, coords): void,
 *   onPointLeave(): void,
 *   getPointData(kid, kpt): ptData,
 *   getPointSetData(kid): psData,
 *   getDisplayOrderByType(): Boolean,
 * }
 * @param {Object} iconDefault - { src, size, key }
 */
export function renderPointSets(map, pointSets, clusterOpts, tracked, callbacks, iconDefault) {
    if (!map) return
    let store = getSetsStore(map)
    if (!store.pointRenderSeq) store.pointRenderSeq = {}
    if (!store.pointSetsPrev) store.pointSetsPrev = {}

    //kid 式過期清理: 曾渲染(或渲染中)而本輪已不在的組, 連同 layer/source/事件註冊一併移除
    //(pointRenderSeq 的 key 為 point-<kid>-src, 即「已知組」名冊)
    let kidsNow = {}
    each(pointSets, (ps, kps) => {
        kidsNow[get(ps, 'kid', null) || String(kps)] = true
    })
    each(Object.keys(store.pointRenderSeq), (sid) => {
        let kid = sid.slice('point-'.length, -('-src'.length))
        if (!kidsNow[kid]) removePointSetByKid(map, kid, tracked, store)
    })

    let setRenderPromises = []
    each(pointSets, (ps, kps) => {
        let kid = get(ps, 'kid', null) || String(kps) //穩定識別碼: 未給 key 時退回索引(與現行行為一致)
        let srcId = `point-${kid}-src`
        let circleId = `point-${kid}-circle`
        let symbolId = `point-${kid}-symbol`
        let clusterCircleId = `point-${kid}-cluster-circle`
        let clusterCountId = `point-${kid}-cluster-count`

        //每 source 一個 render 序號: icon 非同步載入期間若資料再變更(或該組轉為隱藏/移除),
        //舊輪 doRender 於載入完成後執行會以舊資料覆寫新資料, 故以序號作廢舊輪
        store.pointRenderSeq[srcId] = (store.pointRenderSeq[srcId] || 0) + 1
        let renderSeq = store.pointRenderSeq[srcId]

        if (!ps.visible) {
            removePointSetByKid(map, kid, tracked, store)
            return
        }

        //逐組差異跳過(核心): 內容未變且 source 存在之組零觸碰(不 setData, 不動 icon), 僅參與最後的堆疊回歸
        if (store.pointSetsPrev[kid] && map.getSource(srcId) && isEqual(store.pointSetsPrev[kid], ps)) return

        let psType = get(ps, 'type', 'circle')
        let psIconSrc = get(ps, 'iconSrc', '')
        let psIconSize = get(ps, 'iconSize', [25, 41])
        let psIconAnchor = get(ps, 'iconAnchor', null)
        let psIconKey = `point-icon-ps-${kid}`

        let features = []
        let iconLoadTasks = []
        let psIconRegistered = false
        let iconOffsets = {}

        each(ps.points, (pt, kpt) => {
            let ll = get(pt, 'latLng', null); if (!isarr(ll) || size(ll) < 2) return
            let ptype = get(pt, 'type', null) || psType
            //_kid 為主要識別(事件時查最新資料); _kps 僅作 kidToIndex 查無時的 fallback, 位移後即過期, 勿當主要索引使用
            let props = { _kid: kid, _kps: kps, _kpt: kpt, _ptype: ptype, _id: pt.id || '' }

            if (ptype === 'circle') {
                props._radius = pt.radius || get(ps, 'size', 10)
                props._fillColor = pt.fillColor || get(ps, 'fillColor', 'rgba(0,150,255,0.65)')
                props._lineColor = pt.lineColor || get(ps, 'lineColor', 'rgba(255,255,255,1)')
                props._lineWidth = pt.lineWidth || get(ps, 'lineWidth', 1)
            }
            else if (ptype === 'icon') {
                let ptIconSrc = get(pt, 'iconSrc', null) || psIconSrc
                let ptIconSize = get(pt, 'iconSize', null) || psIconSize
                let ptIconAnchor = get(pt, 'iconAnchor', null) || psIconAnchor

                let eff = isestr(ptIconSrc) && isarr(ptIconSize) && size(ptIconSize) === 2 && isarr(ptIconAnchor) && size(ptIconAnchor) === 2
                if (!eff) {
                    ptIconSrc = iconDefault.src; ptIconSize = iconDefault.size
                    ptIconAnchor = [ptIconSize[0] / 2, ptIconSize[1]]
                    //預設 icon 的 popup/tooltip 錨點記在 feature props(存數值 Y 偏移: properties 內陣列會被 maplibre 序列化成字串)。
                    //不可回寫 pt 物件——渲染期 mutate 輸入資料會使逐輪 isEqual 恆不相等, 破壞逐組差異跳過
                    if (!isarr(get(pt, 'popupAnchor', null)) && !isarr(get(ps, 'popupAnchor', null))) props._defPopupAnchorY = -ptIconSize[1]
                    if (!isarr(get(pt, 'tooltipAnchor', null)) && !isarr(get(ps, 'tooltipAnchor', null))) props._defTooltipAnchorY = -ptIconSize[1]
                }

                let ptIw = ptIconSize[0]; let ptIh = ptIconSize[1]
                let iconKey
                //icon 載入一律交 registerIcon(由其以內容指紋去重/更新), 不在此以 hasImage 判斷——
                //否則索引/內容變動時同 key 沿用舊圖造成 icon 錯置
                if (eff && isestr(get(pt, 'iconSrc', null))) {
                    iconKey = `point-icon-pt-${kid}-${kpt}`
                    iconLoadTasks.push(callbacks.registerIcon(iconKey, ptIconSrc, ptIw, ptIh))
                }
                else if (eff && isestr(psIconSrc)) {
                    if (!psIconRegistered) {
                        let w = isarr(psIconSize) ? psIconSize[0] : 25; let h = isarr(psIconSize) ? psIconSize[1] : 41
                        iconLoadTasks.push(callbacks.registerIcon(psIconKey, psIconSrc, w, h))
                        psIconRegistered = true
                    }
                    iconKey = psIconKey
                }
                else {
                    let defKey = iconDefault.key
                    iconLoadTasks.push(callbacks.registerIcon(defKey, ptIconSrc, ptIw, ptIh))
                    iconKey = defKey
                }
                props._iconKey = iconKey

                let centerX = ptIw / 2; let centerY = ptIh / 2
                iconOffsets[kpt] = [centerX - ptIconAnchor[0], centerY - ptIconAnchor[1]]
            }
            //feature id 交由 source 的 generateId 產生(generateId 開啟時顯式 id 會被忽略)
            features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [ll[1], ll[0]] }, properties: props })
        })

        let geojsonData = { type: 'FeatureCollection', features }

        // 建構 icon-offset expression
        let iconOffsetExpr
        let offKeys = Object.keys(iconOffsets)
        if (offKeys.length === 0) {
            iconOffsetExpr = ['literal', [0, 0]]
        }
        else {
            let firstOff = iconOffsets[offKeys[0]]
            let allSame = offKeys.every((k) => iconOffsets[k][0] === firstOff[0] && iconOffsets[k][1] === firstOff[1])
            if (allSame) {
                iconOffsetExpr = ['literal', firstOff]
            }
            else {
                let matchArgs = ['match', ['get', '_kpt']]
                each(offKeys, (k) => {
                    matchArgs.push(parseInt(k, 10)); matchArgs.push(['literal', iconOffsets[k]])
                })
                matchArgs.push(['literal', firstOff])
                iconOffsetExpr = matchArgs
            }
        }

        let doRender = () => {
            if (!map) return
            if (store.pointRenderSeq[srcId] !== renderSeq) return //已有較新一輪 render(或該組已移除), 放棄本輪避免舊資料覆寫
            //實際套用才記錄(供下一輪逐組差異跳過)。存「參考」而非快照, 其正確性依賴兩條契約:
            //1) vo.pointSets 僅在結構 diff 變更時整批換新物件(舊物件即成快照); 2) visible 走獨立路徑不進 isEqual。
            //若未來有人就地 mutate 正規化資料, 跳過判斷會誤判——請維持整批替換的更新模式
            store.pointSetsPrev[kid] = ps
            if (map.getSource(srcId)) {
                map.getSource(srcId).setData(geojsonData)
                if (map.getLayer(symbolId)) {
                    map.setLayoutProperty(symbolId, 'icon-image', ['get', '_iconKey'])
                    map.setLayoutProperty(symbolId, 'icon-offset', iconOffsetExpr)
                }
            }
            else {
                let srcOpts = { type: 'geojson', data: geojsonData, generateId: true }
                if (clusterOpts.enabled) {
                    srcOpts.cluster = true
                    srcOpts.clusterRadius = clusterOpts.radius
                    srcOpts.clusterMaxZoom = clusterOpts.maxZoom
                }
                map.addSource(srcId, srcOpts)
                map.addLayer({
                    id: circleId,
                    type: 'circle',
                    source: srcId,
                    filter: ['==', ['get', '_ptype'], 'circle'],
                    paint: {
                        'circle-radius': ['get', '_radius'],
                        'circle-color': ['get', '_fillColor'],
                        'circle-stroke-color': ['get', '_lineColor'],
                        'circle-stroke-width': ['get', '_lineWidth'],
                    }
                })
                map.addLayer({
                    id: symbolId,
                    type: 'symbol',
                    source: srcId,
                    filter: ['==', ['get', '_ptype'], 'icon'],
                    layout: {
                        'icon-image': ['get', '_iconKey'],
                        'icon-size': 1,
                        'icon-anchor': 'center',
                        'icon-offset': iconOffsetExpr,
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                    }
                })
                tracked.sourceIds.push(srcId)
                tracked.layerIds.push(circleId, symbolId)

                if (clusterOpts.enabled) {
                    let buildStepExpr = (vals) => {
                        if (clusterOpts.levelNum <= 1) return vals[0]
                        let expr = ['step', ['get', 'point_count'], vals[0]]
                        for (let li = 0; li < clusterOpts.levelValues.length; li++) {
                            expr.push(clusterOpts.levelValues[li], vals[li + 1])
                        }
                        return expr
                    }
                    map.addLayer({
                        id: clusterCircleId,
                        type: 'circle',
                        source: srcId,
                        filter: ['has', 'point_count'],
                        paint: {
                            'circle-color': buildStepExpr(clusterOpts.levelFillColors),
                            'circle-radius': buildStepExpr(clusterOpts.levelRadius),
                            'circle-stroke-width': buildStepExpr(clusterOpts.levelLineWidths),
                            'circle-stroke-color': buildStepExpr(clusterOpts.levelLineColors),
                        }
                    })
                    map.addLayer({
                        id: clusterCountId,
                        type: 'symbol',
                        source: srcId,
                        filter: ['has', 'point_count'],
                        layout: {
                            'text-field': '{point_count_abbreviated}',
                            'text-size': buildStepExpr(clusterOpts.levelTextSizes),
                        },
                        paint: { 'text-color': buildStepExpr(clusterOpts.levelTextColors) }
                    })
                    tracked.layerIds.push(clusterCircleId, clusterCountId)

                    map.on('click', clusterCircleId, (e) => {
                        let fs = map.queryRenderedFeatures(e.point, { layers: [clusterCircleId] })
                        if (!fs.length) return
                        let clusterId = fs[0].properties.cluster_id
                        let src = map.getSource(srcId); if (!src) return
                        let result = src.getClusterExpansionZoom(clusterId)
                        if (result && typeof result.then === 'function') {
                            result.then((zoom) => {
                                map.easeTo({ center: fs[0].geometry.coordinates, zoom })
                            }).catch(() => {})
                        }
                    })
                    onLayerHover(map, clusterCircleId, () => {
                        map.getCanvas().style.cursor = 'pointer'
                    }, () => {
                        map.getCanvas().style.cursor = ''
                    })
                }

                let handlePointEvent = (e, action) => {
                    if (!e.features || !e.features.length) return
                    let f = e.features[0]; let p = f.properties
                    let ptData = callbacks.getPointData(p._kid, p._kpt) //以 kid 查最新資料(索引位移後 _kps 會過期)
                    let psData = callbacks.getPointSetData(p._kid)
                    if (!ptData || !psData) return
                    let coords = f.geometry.coordinates
                    action(e, ptData, psData, p, coords)
                }

                map.on('click', circleId, (e) => handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointClick(ptData, psData, p, coords)))
                map.on('click', symbolId, (e) => handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointClick(ptData, psData, p, coords)))
                onLayerHover(map, circleId, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointEnter(ptData, psData, p, coords))
                }, () => {
                    map.getCanvas().style.cursor = ''; callbacks.onPointLeave()
                })
                onLayerHover(map, symbolId, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointEnter(ptData, psData, p, coords))
                }, () => {
                    map.getCanvas().style.cursor = ''; callbacks.onPointLeave()
                })
            }
        }

        if (iconLoadTasks.length > 0) {
            setRenderPromises.push(Promise.all(iconLoadTasks).then(doRender).catch(() => doRender()))
        }
        else {
            doRender()
        }
    })

    //堆疊順序回歸: 逐組差異跳過下, 重建組的圖層會落在最上層, 與「陣列後者在上」語意不符;
    //全部渲染完成後依資料順序逐組 moveLayer(僅調整繪製順序, 無資料重建, 不閃爍)。
    //僅 displayOrderByType 開啟時執行(關閉時維持「插入順序即堆疊」之既有語意, 不主動重排)
    let needReorder = isfun(callbacks.getDisplayOrderByType) ? callbacks.getDisplayOrderByType() : true
    if (needReorder) {
        Promise.all(setRenderPromises).then(() => {
            if (!map || !map.style) return
            each(pointSets, (ps, kps) => {
                let kid = get(ps, 'kid', null) || String(kps)
                each(pointSetLayerIds(kid), (lid) => {
                    if (map.getLayer(lid)) map.moveLayer(lid)
                })
            })
        }).catch(() => {})
    }
}


/**
 * 渲染折線圖層（增量更新）
 * @param {Object} map
 * @param {Array} polylineSets
 * @param {Object} tracked - { sourceIds, layerIds }
 * @param {Object} callbacks - {
 *   onPopupClick(lngLat, featureData, type, idx): void,
 *   onTooltipEnter(lngLat, featureData, type, idx): void,
 *   onTooltipLeave(): void,
 * }
 */
export function renderPolylineSets(map, polylineSets, tracked, callbacks) {
    if (!map) return
    let store = getSetsStore(map)
    store.polylineSets = polylineSets //供事件 handler 於事件時取最新資料
    each(polylineSets, (pls, k) => {
        let sid = `polyline-src-${k}`; let lid = `polyline-layer-${k}`
        if (!pls.visible) {
            if (map.getLayer(lid)) map.removeLayer(lid)
            if (map.getSource(sid)) map.removeSource(sid)
            tracked.layerIds = tracked.layerIds.filter(x => x !== lid)
            tracked.sourceIds = tracked.sourceIds.filter(x => x !== sid)
            return
        }
        let lls = get(pls, 'latLngs', []); if (!isearr(lls)) return
        let geomType, coords
        if (isarr(lls[0]) && isNumber(lls[0][0])) {
            geomType = 'LineString'; coords = lmap(lls, (ll) => [ll[1], ll[0]])
        }
        else {
            //lls[0][0][0]為數字才是線陣列層, 否則多包一層(depth-4)須鑽 lls[0]
            let ml = (isarr(lls[0]) && isarr(lls[0][0]) && isNumber(lls[0][0][0])) ? lls : lls[0]
            geomType = 'MultiLineString'; coords = lmap(ml, (seg) => lmap(seg, (ll) => [ll[1], ll[0]]))
        }
        let geojsonData = { type: 'Feature', geometry: { type: geomType, coordinates: coords } }
        if (map.getSource(sid)) {
            map.getSource(sid).setData(geojsonData)
            if (map.getLayer(lid)) { //setData 路徑同步更新 paint, 使 runtime 樣式變更生效
                map.setPaintProperty(lid, 'line-color', pls.lineColor)
                map.setPaintProperty(lid, 'line-width', pls.lineWidth)
            }
        }
        else {
            map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
            map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': pls.lineColor, 'line-width': pls.lineWidth } })
            tracked.sourceIds.push(sid); tracked.layerIds.push(lid)
            map.on('click', lid, (e) => {
                if (callbacks.shouldDeferClick && callbacks.shouldDeferClick(e.point, 'polyline')) return //讓位給更高優先型別(如點)
                let plsNow = get(store, `polylineSets.${k}`, null) || pls //事件時取最新 render 資料, 避免閉包滯留舊值
                if (isfun(plsNow.funSetsClick)) plsNow.funSetsClick({ ev: e, polylineSet: plsNow, kpolylineSet: k, polylineSets: store.polylineSets })
                callbacks.onPopupClick(e.lngLat, plsNow, 'polyline', k)
            })
            onLayerHover(map, lid, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                let plsNow = get(store, `polylineSets.${k}`, null) || pls
                callbacks.onTooltipEnter(e.lngLat, plsNow, 'polyline', k)
            }, () => {
                map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave()
            })
        }
    })
}


/**
 * 渲染多邊形圖層（增量更新）
 */
export function renderPolygonSets(map, polygonSets, tracked, callbacks) {
    if (!map) return
    let store = getSetsStore(map)
    store.polygonSets = polygonSets //供事件 handler 於事件時取最新資料
    each(polygonSets, (pg, k) => {
        let sid = `polygon-src-${k}`; let fid = `polygon-fill-${k}`; let lid = `polygon-line-${k}`
        if (!pg.visible) {
            if (map.getLayer(fid)) map.removeLayer(fid)
            if (map.getLayer(lid)) map.removeLayer(lid)
            if (map.getSource(sid)) map.removeSource(sid)
            tracked.layerIds = tracked.layerIds.filter(x => x !== fid && x !== lid)
            tracked.sourceIds = tracked.sourceIds.filter(x => x !== sid)
            return
        }
        let lls = get(pg, 'latLngs', []); if (!isearr(lls)) return
        let geometry = buildPolygonGeometry(lls); if (!geometry) return
        let geojsonData = { type: 'Feature', geometry }
        if (map.getSource(sid)) {
            map.getSource(sid).setData(geojsonData)
            if (map.getLayer(fid)) map.setPaintProperty(fid, 'fill-color', pg.fillColor) //setData 路徑同步更新 paint, 使 runtime 樣式變更生效
            if (map.getLayer(lid)) {
                map.setPaintProperty(lid, 'line-color', pg.lineColor)
                map.setPaintProperty(lid, 'line-width', pg.lineWidth)
            }
        }
        else {
            map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
            map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': pg.fillColor, 'fill-opacity': 1 } })
            map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': pg.lineColor, 'line-width': pg.lineWidth } })
            tracked.sourceIds.push(sid); tracked.layerIds.push(fid, lid)
            map.on('click', fid, (e) => {
                if (callbacks.shouldDeferClick && callbacks.shouldDeferClick(e.point, 'polygon')) return //讓位給更高優先型別(點/線/geojson)
                let pgNow = get(store, `polygonSets.${k}`, null) || pg //事件時取最新 render 資料, 避免閉包滯留舊值
                if (isfun(pgNow.funSetsClick)) pgNow.funSetsClick({ ev: e, polygonSet: pgNow, kpolygonSet: k, polygonSets: store.polygonSets })
                callbacks.onPopupClick(e.lngLat, pgNow, 'polygon', k)
            })
            onLayerHover(map, fid, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                let pgNow = get(store, `polygonSets.${k}`, null) || pg
                callbacks.onTooltipEnter(e.lngLat, pgNow, 'polygon', k)
            }, () => {
                map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave()
            })
        }
    })
}


/**
 * 渲染 GeoJSON 圖層（增量更新，自動拆分為 points/lines/polygons）
 */
export function renderGeojsonSets(map, geojsonSets, tracked, callbacks) {
    if (!map) return
    let store = getSetsStore(map)
    store.geojsonSets = geojsonSets //供事件 handler 於事件時取最新資料
    each(geojsonSets, (gj, k) => {
        let ptsSid = `geojson-pts-src-${k}`; let ptsLid = `geojson-pts-circle-${k}`
        let lnsSid = `geojson-lns-src-${k}`; let lnsLid = `geojson-lns-line-${k}`
        let pgsSid = `geojson-pgs-src-${k}`; let pgsFid = `geojson-pgs-fill-${k}`; let pgsLid = `geojson-pgs-line-${k}`
        let allSids = [ptsSid, lnsSid, pgsSid]
        let allLids = [ptsLid, lnsLid, pgsFid, pgsLid]

        if (!gj.visible || !isobj(get(gj, 'geojson', null))) {
            each(allLids, (lid) => {
                if (map.getLayer(lid)) map.removeLayer(lid)
            })
            each(allSids, (sid) => {
                if (map.getSource(sid)) map.removeSource(sid)
            })
            tracked.layerIds = tracked.layerIds.filter((x) => allLids.indexOf(x) < 0)
            tracked.sourceIds = tracked.sourceIds.filter((x) => allSids.indexOf(x) < 0)
            return
        }

        let splitted = splitAndProcGeoJSON(gj.geojson)
        let bindEvents = (layerId) => {
            map.on('click', layerId, (e) => {
                if (callbacks.shouldDeferClick && callbacks.shouldDeferClick(e.point, 'geojson')) return //讓位給更高優先型別(點/線)
                let gjNow = get(store, `geojsonSets.${k}`, null) || gj //事件時取最新 render 資料, 避免閉包滯留舊值
                if (isfun(gjNow.funSetsClick)) gjNow.funSetsClick({ ev: e, lat: e.lngLat.lat, lng: e.lngLat.lng, geojsonSet: gjNow, kgeojsonSet: k, geojsonSets: store.geojsonSets })
                callbacks.onPopupClick(e.lngLat, gjNow, 'geojson', k)
            })
            onLayerHover(map, layerId, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                let gjNow = get(store, `geojsonSets.${k}`, null) || gj
                callbacks.onTooltipEnter(e.lngLat, gjNow, 'geojson', k)
            }, () => {
                map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave()
            })
        }

        if (map.getSource(ptsSid)) {
            map.getSource(ptsSid).setData(splitted.points)
            if (map.getLayer(ptsLid)) { //setData 路徑同步更新 paint, 使 runtime 樣式變更生效(下同)
                map.setPaintProperty(ptsLid, 'circle-color', gj.fillColor)
                map.setPaintProperty(ptsLid, 'circle-stroke-color', gj.lineColor)
            }
        }
        else {
            map.addSource(ptsSid, { type: 'geojson', data: splitted.points, generateId: true })
            map.addLayer({ id: ptsLid, type: 'circle', source: ptsSid, paint: { 'circle-color': gj.fillColor, 'circle-radius': 5, 'circle-stroke-color': gj.lineColor, 'circle-stroke-width': 1 } })
            tracked.sourceIds.push(ptsSid); tracked.layerIds.push(ptsLid)
            bindEvents(ptsLid)
        }
        if (map.getSource(lnsSid)) {
            map.getSource(lnsSid).setData(splitted.lines)
            if (map.getLayer(lnsLid)) {
                map.setPaintProperty(lnsLid, 'line-color', gj.lineColor)
                map.setPaintProperty(lnsLid, 'line-width', gj.lineWidth)
            }
        }
        else {
            map.addSource(lnsSid, { type: 'geojson', data: splitted.lines, generateId: true })
            map.addLayer({ id: lnsLid, type: 'line', source: lnsSid, paint: { 'line-color': gj.lineColor, 'line-width': gj.lineWidth } })
            tracked.sourceIds.push(lnsSid); tracked.layerIds.push(lnsLid)
            bindEvents(lnsLid)
        }
        if (map.getSource(pgsSid)) {
            map.getSource(pgsSid).setData(splitted.polygons)
            if (map.getLayer(pgsFid)) map.setPaintProperty(pgsFid, 'fill-color', gj.fillColor)
            if (map.getLayer(pgsLid)) {
                map.setPaintProperty(pgsLid, 'line-color', gj.lineColor)
                map.setPaintProperty(pgsLid, 'line-width', gj.lineWidth)
            }
        }
        else {
            map.addSource(pgsSid, { type: 'geojson', data: splitted.polygons, generateId: true })
            map.addLayer({ id: pgsFid, type: 'fill', source: pgsSid, paint: { 'fill-color': gj.fillColor, 'fill-opacity': 1 } })
            map.addLayer({ id: pgsLid, type: 'line', source: pgsSid, paint: { 'line-color': gj.lineColor, 'line-width': gj.lineWidth } })
            tracked.sourceIds.push(pgsSid); tracked.layerIds.push(pgsFid, pgsLid)
            bindEvents(pgsFid)
        }
    })
}


/**
 * 渲染影像圖層（增量更新）
 */
export function renderImageSets(map, imageSets, tracked) {
    if (!map) return
    each(imageSets, (im, k) => {
        let sid = `image-src-${k}`; let lid = `image-layer-${k}`
        if (!im.visible) {
            if (map.getLayer(lid)) map.removeLayer(lid)
            if (map.getSource(sid)) map.removeSource(sid)
            tracked.layerIds = tracked.layerIds.filter(x => x !== lid)
            tracked.sourceIds = tracked.sourceIds.filter(x => x !== sid)
            return
        }
        let img = get(im, 'image', {}); if (!isobj(img)) return
        let url = get(img, 'url', ''); if (!isestr(url)) return
        let lnMin = cdbl(get(img, 'lngMin', 0)); let lnMax = cdbl(get(img, 'lngMax', 0))
        let ltMin = cdbl(get(img, 'latMin', 0)); let ltMax = cdbl(get(img, 'latMax', 0))
        let coordinates = [[lnMin, ltMax], [lnMax, ltMax], [lnMax, ltMin], [lnMin, ltMin]]
        if (map.getSource(sid)) {
            map.getSource(sid).updateImage({ url, coordinates })
        }
        else {
            map.addSource(sid, { type: 'image', url, coordinates })
            map.addLayer({ id: lid, type: 'raster', source: sid })
            tracked.sourceIds.push(sid); tracked.layerIds.push(lid)
        }
    })
}


/**
 * 渲染等值線圖層（增量更新，含圖例生成）
 * @param {Object} map
 * @param {Array} contourSets - 已正規化的 contourSets（函式會直接更新各 cs.legend）
 * @param {Object} tracked - { sourceIds, layerIds }
 * @param {Object} subCounts - { [kcs]: Number }（追蹤每個 contourSet 子層數量）
 * @param {Object} callbacks - {
 *   onContourClick(e, ps, kps, cs, kcs, contourSets): void,
 *   onContourEnter(e, cs, kcs): void,
 *   onContourLeave(): void,
 * }
 */
export function renderContourSets(map, contourSets, tracked, subCounts, callbacks) {
    if (!map) return
    let store = getSetsStore(map)
    store.contourSets = contourSets //供事件 handler 於事件時取最新資料
    if (!store.contourBands) store.contourBands = {}

    each(contourSets, (cs, kcs) => {
        let prevCount = subCounts[kcs] || 0

        if (!cs.visible) {
            for (let i = 0; i < prevCount; i++) {
                let sid = `contour-${kcs}-src-${i}`
                let fid = `contour-${kcs}-fill-${i}`
                let lid = `contour-${kcs}-line-${i}`
                if (map.getLayer(fid)) map.removeLayer(fid)
                if (map.getLayer(lid)) map.removeLayer(lid)
                if (map.getSource(sid)) map.removeSource(sid)
                tracked.layerIds = tracked.layerIds.filter(x => x !== fid && x !== lid)
                tracked.sourceIds = tracked.sourceIds.filter(x => x !== sid)
            }
            subCounts[kcs] = 0
            return
        }

        let points = get(cs, 'points', [])
        if (!isearr(points)) return

        let calcOpt = {
            containInner: get(cs, 'polygonsContainInner', null),
            clipInner: get(cs, 'polygonsClipInner', null),
            clipOuter: get(cs, 'polygonClipOuter', null),
            thresholds: get(cs, 'thresholds', null),
        }
        let polygonSets = calcContours(points, calcOpt)
        if (!isarr(polygonSets) || polygonSets.err) return

        let n = polygonSets.length - 1
        polygonSets = lmap(polygonSets, (ps, k) => {
            let color = getContourColor(k, n, cs.gradient, cs.getColor, ps)
            let lineColor = isestr(cs.lineColor) ? cs.lineColor : color
            return { ...ps, color, lineColor, fillColor: color }
        })

        // 更新圖例(渲染期寫回正規化資料: legend 需進 reactive 供圖例面板讀取, 屬刻意設計。
        // 注意: 若未來將 kid 逐組差異跳過推廣到等值線, 此 mutate 會使 isEqual 恆不相等, 屆時 legend 須改走獨立 store)
        cs.legend = buildContourLegend({ polygonSets }, cs)

        store.contourBands[kcs] = polygonSets //最新色帶資料, 供 handler 於事件時查詢

        let newCount = polygonSets.length

        // 移除多餘舊子層
        for (let i = newCount; i < prevCount; i++) {
            let sid = `contour-${kcs}-src-${i}`
            let fid = `contour-${kcs}-fill-${i}`
            let lid = `contour-${kcs}-line-${i}`
            if (map.getLayer(fid)) map.removeLayer(fid)
            if (map.getLayer(lid)) map.removeLayer(lid)
            if (map.getSource(sid)) map.removeSource(sid)
            tracked.layerIds = tracked.layerIds.filter(x => x !== fid && x !== lid)
            tracked.sourceIds = tracked.sourceIds.filter(x => x !== sid)
        }

        each(polygonSets, (ps, kps) => {
            let latLngs = get(ps, 'latLngs', []); if (!isearr(latLngs)) return
            let sid = `contour-${kcs}-src-${kps}`
            let fid = `contour-${kcs}-fill-${kps}`
            let lid = `contour-${kcs}-line-${kps}`

            let coordinates = lmap(latLngs, (polygon) => {
                return lmap(polygon, (ring) => {
                    if (isarr(ring) && isarr(ring[0])) return lmap(ring, (pt) => [pt[1], pt[0]])
                    return [ring[1], ring[0]]
                })
            })

            let geojsonData = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates } }

            if (map.getSource(sid)) {
                map.getSource(sid).setData(geojsonData)
                if (map.getLayer(fid)) { //setData 路徑同步更新 paint, 使 runtime 樣式/色帶變更生效
                    map.setPaintProperty(fid, 'fill-color', ps.fillColor)
                    map.setPaintProperty(fid, 'fill-opacity', cs.fillOpacity)
                }
                if (map.getLayer(lid)) {
                    map.setPaintProperty(lid, 'line-color', ps.lineColor)
                    map.setPaintProperty(lid, 'line-width', cs.lineWidth)
                }
            }
            else {
                map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
                map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': ps.fillColor, 'fill-opacity': cs.fillOpacity } })
                map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': ps.lineColor, 'line-width': cs.lineWidth } })
                tracked.sourceIds.push(sid); tracked.layerIds.push(fid, lid)

                //事件時取最新 render 資料(set 與色帶), 避免閉包滯留舊值
                let getNow = () => {
                    let csNow = get(store, `contourSets.${kcs}`, null) || cs
                    let psNow = get(store, `contourBands.${kcs}.${kps}`, null) || ps
                    return { csNow, psNow }
                }
                map.on('click', fid, (e) => {
                    if (callbacks.shouldDeferClick && callbacks.shouldDeferClick(e.point, 'contour')) return //讓位給更高優先型別
                    let { csNow, psNow } = getNow()
                    callbacks.onContourClick(e, psNow, kps, csNow, kcs, store.contourSets)
                })
                onLayerHover(map, fid, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    let { csNow, psNow } = getNow()
                    if (csNow.changeStyleWhenHover && map.getLayer(fid) && map.getLayer(lid)) {
                        let lineColorH = isestr(csNow.lineColorHover) ? csNow.lineColorHover : psNow.color
                        map.setPaintProperty(fid, 'fill-opacity', csNow.fillOpacityHover)
                        map.setPaintProperty(lid, 'line-color', lineColorH)
                        map.setPaintProperty(lid, 'line-width', csNow.lineWidthHover)
                    }
                    callbacks.onContourEnter(e, csNow, kcs)
                }, () => {
                    map.getCanvas().style.cursor = ''
                    let { csNow, psNow } = getNow()
                    if (csNow.changeStyleWhenHover && map.getLayer(fid) && map.getLayer(lid)) {
                        map.setPaintProperty(fid, 'fill-opacity', csNow.fillOpacity)
                        map.setPaintProperty(lid, 'line-color', psNow.lineColor)
                        map.setPaintProperty(lid, 'line-width', csNow.lineWidth)
                    }
                    callbacks.onContourLeave()
                })
            }
        })

        subCounts[kcs] = newCount
    })
}
