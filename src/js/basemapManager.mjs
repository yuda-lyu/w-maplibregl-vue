/**
 * basemapManager.mjs
 * 底圖與 3D 地形的新增、切換、透明度控制
 */
import each from 'lodash-es/each.js'
import get from 'lodash-es/get.js'
import omit from 'lodash-es/omit.js'
import isEqual from 'lodash-es/isEqual.js'
import isobj from 'wsemi/src/isobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'


// fill-extrusion 建物色: 帶 colorFillExtrusion 則統一上色, 否則回退資料 colour 屬性(向後相容)
function fxColorExpr(bm) {
    return bm.colorFillExtrusion || ['coalesce', ['get', 'colour'], '#aaaaaa']
}


// 底圖/疊加層的穩定身分 key: 由內容(type/url/layer/layerType/colorShade/layers)衍生, 不綁陣列索引,
// 使重排時同一份內容的圖層 ID 不變 → 可用 moveLayer 增量重排, 免整批重抓圖磚.
function baseMapKey(bm) {
    let raw = [bm.type, bm.url, bm.layer, bm.layerType, bm.colorShade, bm.layers].map((v) => v == null ? '' : String(v)).join('|')
    return raw.replace(/[^a-zA-Z0-9]/g, '_')
}


// 全陣列的 key 串列(與陣列同序); 內容完全相同者(罕見)以出現序加尾碼去重
function baseMapKeys(baseMaps) {
    let seen = {}
    let arr = isarr(baseMaps) ? baseMaps : []
    return arr.map((bm) => {
        let k = baseMapKey(bm)
        seen[k] = (seen[k] || 0) + 1
        return seen[k] > 1 ? `${k}__${seen[k]}` : k
    })
}


/**
 * 將底圖配置套用到 map（建立 raster/vector/wms source 與 layer）
 * @param {Object} map - MapLibre 地圖實例
 * @param {Array} baseMaps - 底圖配置陣列
 */
export function applyBaseMaps(map, baseMaps) {
    if (!map) return
    let keys = baseMapKeys(baseMaps)
    let addBaseMapLayer = (bm, k) => {
        let srcId = `basemap-src-${keys[k]}`; let layerId = `basemap-layer-${keys[k]}`
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(srcId)) map.removeSource(srcId)
        if (bm.type === 'vector') {
            let u = bm.url; if (u.startsWith('//')) u = 'https:' + u
            map.addSource(srcId, { type: 'vector', url: u })
            let layerType = bm.layerType || 'fill'
            let sourceLayer = bm.layer || ''
            let op = bm.opacity != null ? bm.opacity : 0.8
            let paint = {}
            if (layerType === 'fill-extrusion') {
                paint = {
                    'fill-extrusion-color': fxColorExpr(bm),
                    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'render_height'], ['get', 'height'], 0]],
                    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]],
                    'fill-extrusion-opacity': op,
                    'fill-extrusion-opacity-transition': { duration: 0, delay: 0 },
                }
            }
            else if (layerType === 'fill') {
                paint = { 'fill-color': '#aaaaaa', 'fill-opacity': op, 'fill-opacity-transition': { duration: 0, delay: 0 } }
            }
            map.addLayer({ 'id': layerId, 'type': layerType, 'source': srcId, 'source-layer': sourceLayer, paint, 'layout': { visibility: bm.visible ? 'visible' : 'none' } })
            return
        }
        let tiles = []
        if (bm.type === 'wms') {
            let u = bm.url
            if (!u.includes('?')) u += '?'
            else if (!u.endsWith('?') && !u.endsWith('&')) u += '&' //url 已帶 query 參數時須以 & 續接, 避免直接黏接壞掉
            u += `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${bm.layers || ''}&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`
            tiles = [u]
        }
        else {
            let u = bm.url
            tiles = u.includes('{s}') ? ['a', 'b', 'c'].map((s) => u.replace('{s}', s)) : [u]
            tiles = tiles.map((t) => t.startsWith('//') ? 'https:' + t : t)
        }
        let op = bm.opacity != null ? bm.opacity : 1
        map.addSource(srcId, { type: 'raster', tiles, tileSize: 256 })
        map.addLayer({ id: layerId, type: 'raster', source: srcId, paint: { 'raster-opacity': op, 'raster-opacity-transition': { duration: 0, delay: 0 } }, layout: { visibility: bm.visible ? 'visible' : 'none' } })
    }
    // 第一輪：底圖（colorShade 非空），確保先渲染在下方
    each(baseMaps, (bm, k) => {
        if (isestr(bm.colorShade)) addBaseMapLayer(bm, k)
    })
    // 第二輪：疊加圖層（colorShade 空字串），後渲染在底圖上方
    each(baseMaps, (bm, k) => {
        if (!isestr(bm.colorShade)) addBaseMapLayer(bm, k)
    })
}


/**
 * 套用 3D 地形（清除舊地形後重新設定）
 * @param {Object} map - MapLibre 地圖實例
 * @param {Object} terrainMap - 地形配置物件
 * @param {Array} trackedLayerIds - 追蹤的 layer ID（用於 hillshade 插入位置）
 */
export function applyTerrain(map, terrainMap, trackedLayerIds) {
    if (!map) return
    try {
        map.setTerrain(null)
    }
    catch (e) {}
    if (map.getLayer('terrain-hillshade')) map.removeLayer('terrain-hillshade')
    if (map.getSource('terrain-hillshade-src')) map.removeSource('terrain-hillshade-src')
    if (map.getSource('terrain-src')) map.removeSource('terrain-src')

    let tm = terrainMap
    if (!isobj(tm)) return
    let tsrc = get(tm, 'terrainSource', null)
    if (!isobj(tsrc) || !isestr(tsrc.url)) return

    let tu = tsrc.url; if (tu.startsWith('//')) tu = 'https:' + tu
    let terrainSrcSpec = {
        type: 'raster-dem',
        tiles: [tu],
        tileSize: tsrc.tileSize || 256,
        encoding: tsrc.encoding || 'terrarium',
    }
    if (isnum(tsrc.maxzoom)) terrainSrcSpec.maxzoom = parseInt(tsrc.maxzoom)
    try {
        map.addSource('terrain-src', terrainSrcSpec)
    }
    catch (e) {
        console.error('[basemapManager] applyTerrain addSource error:', e); return
    }
    try {
        map.setTerrain({ source: 'terrain-src', exaggeration: isnum(tm.exaggeration) ? cdbl(tm.exaggeration) : 1.5 })
    }
    catch (e) {
        console.error('[basemapManager] applyTerrain setTerrain error:', e)
    }

    let hsrc = get(tm, 'hillshadeSource', null)
    if (isobj(hsrc) && isestr(hsrc.url)) {
        let hu = hsrc.url; if (hu.startsWith('//')) hu = 'https:' + hu
        let hillshadeSourceId = 'terrain-src'
        if (hu !== tu) {
            let hillshadeSrcSpec = {
                type: 'raster-dem',
                tiles: [hu],
                tileSize: hsrc.tileSize || 256,
                encoding: hsrc.encoding || 'terrarium',
            }
            if (isnum(hsrc.maxzoom)) hillshadeSrcSpec.maxzoom = parseInt(hsrc.maxzoom)
            map.addSource('terrain-hillshade-src', hillshadeSrcSpec)
            hillshadeSourceId = 'terrain-hillshade-src'
        }
        let insertBefore = null
        for (let lid of (trackedLayerIds || [])) {
            if (map.getLayer(lid)) {
                insertBefore = lid; break
            }
        }
        let hillshadeSpec = {
            id: 'terrain-hillshade',
            type: 'hillshade',
            source: hillshadeSourceId,
            paint: {
                'hillshade-shadow-color': '#473B24',
                'hillshade-exaggeration': isnum(tm.hillshadeExaggeration) ? cdbl(tm.hillshadeExaggeration) : 0.5,
            },
        }
        if (insertBefore && map.getLayer(insertBefore)) map.addLayer(hillshadeSpec, insertBefore)
        else map.addLayer(hillshadeSpec)
    }
}


/**
 * 切換底圖（radio 單選）
 * @param {Object} map
 * @param {Array} baseMaps - panelBaseMaps.baseMaps（直接修改 visible 屬性）
 * @param {Number} idx - 選中的底圖索引
 */
export function switchBaseMap(map, baseMaps, idx) {
    let keys = baseMapKeys(baseMaps)
    each(baseMaps, (bm, k) => {
        if (!isestr(bm.colorShade)) return
        bm.visible = (k === idx)
        let id = `basemap-layer-${keys[k]}`
        if (map && map.getLayer(id)) map.setLayoutProperty(id, 'visibility', bm.visible ? 'visible' : 'none')
    })
}


/**
 * 切換疊加圖層可見性（checkbox）
 * @param {Object} map
 * @param {Array} baseMaps
 * @param {Number} idx
 */
export function toggleOverlayVisible(map, baseMaps, idx) {
    let bm = get(baseMaps, idx, null); if (!bm) return
    bm.visible = !bm.visible
    let id = `basemap-layer-${baseMapKeys(baseMaps)[idx]}`
    if (map && map.getLayer(id)) map.setLayoutProperty(id, 'visibility', bm.visible ? 'visible' : 'none')
}


/**
 * 調整疊加圖層透明度
 * @param {Object} map
 * @param {Array} baseMaps
 * @param {Number} idx
 * @param {Number|String} val
 */
export function setOverlayOpacity(map, baseMaps, idx, val) {
    let bm = get(baseMaps, idx, null); if (!bm) return
    bm.opacity = parseFloat(val)
    let id = `basemap-layer-${baseMapKeys(baseMaps)[idx]}`
    if (!map || !map.getLayer(id)) return
    if (bm.type === 'vector') {
        let lt = bm.layerType || 'fill'
        if (lt === 'fill-extrusion') map.setPaintProperty(id, 'fill-extrusion-opacity', bm.opacity)
        else if (lt === 'line') map.setPaintProperty(id, 'line-opacity', bm.opacity)
        else map.setPaintProperty(id, 'fill-opacity', bm.opacity)
    }
    else {
        map.setPaintProperty(id, 'raster-opacity', bm.opacity)
    }
}


/**
 * 就地更新單一底圖 entry 的 paint(顏色/透明度), 不重建 layer/source —
 * 避免重抓圖磚與其他未變更圖層閃爍。供「僅 paint 變更」的快路徑使用。
 * @param {Object} map
 * @param {Array} baseMaps - 底圖配置陣列
 * @param {Number} idx - 索引
 */
export function updateBaseMapPaint(map, baseMaps, idx) {
    if (!map) return
    let bm = get(baseMaps, idx, null); if (!bm) return
    let layerId = `basemap-layer-${baseMapKeys(baseMaps)[idx]}`
    if (!map.getLayer(layerId)) return
    if (bm.type === 'vector') {
        let lt = bm.layerType || 'fill'
        let op = bm.opacity != null ? bm.opacity : 0.8
        if (lt === 'fill-extrusion') {
            map.setPaintProperty(layerId, 'fill-extrusion-color', fxColorExpr(bm))
            map.setPaintProperty(layerId, 'fill-extrusion-opacity', op)
        }
        else if (lt === 'line') {
            map.setPaintProperty(layerId, 'line-opacity', op)
        }
        else {
            map.setPaintProperty(layerId, 'fill-opacity', op)
        }
    }
    else {
        let op = bm.opacity != null ? bm.opacity : 1
        map.setPaintProperty(layerId, 'raster-opacity', op)
    }
}


/**
 * 判斷新舊 baseMaps 是否「僅 paint 欄位(colorFillExtrusion/opacity)變更」。
 * true → 可只就地 setPaintProperty(updateBaseMapPaint), 無需重建底圖;
 * false → 有結構性變更(數量/url/type/layer/layerType/visible 等), 需完整重套 applyBaseMaps。
 * @param {Array} prev - 上次套用的 baseMaps
 * @param {Array} next - 本次 baseMaps
 * @returns {Boolean}
 */
export function isBaseMapsPaintOnlyDiff(prev, next) {
    if (!isarr(prev) || !isarr(next) || prev.length !== next.length) return false
    let stripPaint = (e) => omit(e, ['colorFillExtrusion', 'opacity'])
    let anyChanged = false
    for (let i = 0; i < next.length; i++) {
        if (!isEqual(stripPaint(prev[i]), stripPaint(next[i]))) return false //有非 paint 變更
        if (!isEqual(prev[i], next[i])) anyChanged = true
    }
    return anyChanged
}


// 不需重建即可就地處理的欄位: paint(colorFillExtrusion/opacity) 與顯隱(visible)
const BASEMAP_PAINT_STATE = ['colorFillExtrusion', 'opacity', 'visible']


/**
 * 判斷新舊 baseMaps 是否有「結構性變更」(新增/刪除/url/type/layer/layerType/colorShade 等)。
 * false → 僅順序/可見性/paint 差異, 可走增量(updateBaseMapsIncremental), 不重建、不重抓圖磚;
 * true → 有結構性變更, 需完整重套 applyBaseMaps。
 * @param {Array} prev - 上次套用的 baseMaps
 * @param {Array} next - 本次 baseMaps
 * @returns {Boolean}
 */
export function isBaseMapsStructuralDiff(prev, next) {
    if (!isarr(prev) || !isarr(next) || prev.length !== next.length) return true
    let kp = baseMapKeys(prev); let kn = baseMapKeys(next)
    if (!isEqual(kp.slice().sort(), kn.slice().sort())) return true //key 集合不同 = 新增/刪除/url/type 變更 → 需重建
    let mp = new Map()
    each(prev, (e, i) => mp.set(kp[i], e))
    for (let i = 0; i < next.length; i++) {
        let p = mp.get(kn[i]); if (!p) return true
        if (!isEqual(omit(p, BASEMAP_PAINT_STATE), omit(next[i], BASEMAP_PAINT_STATE))) return true //同 key 但其餘結構欄位有變 → 需重建
    }
    return false //只剩順序/可見性/paint 差異 → 可走增量
}


/**
 * 「僅順序/可見性/paint 變更」時的增量套用: 就地更新 paint 與 visibility,
 * 並用 moveLayer 將疊加層依新陣列序重排至「資料圖層之下、底圖之上」。
 * 完全不 remove/add source(不重抓圖磚), 不擾動資料圖層 z-order(無閃爍)。
 * @param {Object} map
 * @param {Array} baseMaps - 本次 baseMaps(新順序)
 */
export function updateBaseMapsIncremental(map, baseMaps) {
    if (!map || !isarr(baseMaps)) return
    let keys = baseMapKeys(baseMaps)
    // 1) paint 與 visibility 全部就地更新
    each(baseMaps, (bm, k) => {
        let id = `basemap-layer-${keys[k]}`
        if (!map.getLayer(id)) return
        updateBaseMapPaint(map, baseMaps, k)
        map.setLayoutProperty(id, 'visibility', bm.visible ? 'visible' : 'none')
    })
    // 2) 疊加層(colorShade 空字串)依陣列序 moveLayer 至首個資料圖層之下; 底圖恆在最底, 不動
    let dataPrefixes = ['image-', 'contour-', 'polygon-', 'geojson-', 'polyline-', 'point-']
    let beforeId
    let style = map.getStyle()
    if (style && isarr(style.layers)) {
        let hit = style.layers.find((l) => l && isestr(l.id) && dataPrefixes.some((p) => l.id.indexOf(p) === 0))
        if (hit) beforeId = hit.id
    }
    each(baseMaps, (bm, k) => {
        if (isestr(bm.colorShade)) return //僅疊加層需重排, 底圖不動
        let id = `basemap-layer-${keys[k]}`
        if (map.getLayer(id)) map.moveLayer(id, beforeId)
    })
}
