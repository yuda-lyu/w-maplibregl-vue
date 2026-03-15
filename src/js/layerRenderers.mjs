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
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import size from 'lodash-es/size.js'
import oc from 'wsemi/src/color.mjs'
import calcContours from 'w-gis/src/calcContours.mjs'
import fixCloseMultiPolygon from 'w-gis/src/fixCloseMultiPolygon.mjs'
import flattenMultiPolygon from 'w-gis/src/flattenMultiPolygon.mjs'
import invCoordMultiPolygonOrMultiPolyline from 'w-gis/src/invCoordMultiPolygonOrMultiPolyline.mjs'
import splitAndProcGeoJSON from 'w-gis/src/splitAndProcGeoJSON.mjs'
import dig from 'wsemi/src/dig.mjs'
import reverse from 'lodash-es/reverse.js'


// ===== 工具函式 =====

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

/**
 * 渲染點圖層（circle + symbol，含叢集化）
 * @param {Object} map
 * @param {Array} pointSets - 已正規化的 pointSets
 * @param {Object} clusterOpts - computeClusterOpts() 的回傳值
 * @param {Object} tracked - { sourceIds, layerIds, markers }
 * @param {Object} callbacks - {
 *   registerIcon(key, src, w, h): Promise,
 *   onPointClick(ptData, psData, p, coords): void,
 *   onPointEnter(ptData, psData, p, coords): void,
 *   onPointLeave(): void,
 *   getPointData(kps, kpt): ptData,
 *   getPointSetData(kps): psData,
 * }
 * @param {Object} iconDefault - { src, size, key }
 * @param {Object} featureIdCounter - { value: Number }（共用計數器，函式內遞增）
 */
export function renderPointSets(map, pointSets, clusterOpts, tracked, callbacks, iconDefault, featureIdCounter) {
    if (!map) return

    each(pointSets, (ps, kps) => {
        let srcId = `point-${kps}-src`
        let circleId = `point-${kps}-circle`
        let symbolId = `point-${kps}-symbol`
        let clusterCircleId = `point-${kps}-cluster-circle`
        let clusterCountId = `point-${kps}-cluster-count`

        if (!ps.visible) {
            each([circleId, symbolId, clusterCircleId, clusterCountId], (lid) => {
                if (map.getLayer(lid)) map.removeLayer(lid)
            })
            if (map.getSource(srcId)) map.removeSource(srcId)
            tracked.layerIds = tracked.layerIds.filter(x => x !== circleId && x !== symbolId && x !== clusterCircleId && x !== clusterCountId)
            tracked.sourceIds = tracked.sourceIds.filter(x => x !== srcId)
            return
        }

        let psType = get(ps, 'type', 'circle')
        let psIconSrc = get(ps, 'iconSrc', '')
        let psIconSize = get(ps, 'iconSize', [25, 41])
        let psIconAnchor = get(ps, 'iconAnchor', null)
        let psIconKey = `point-icon-ps-${kps}`

        let features = []
        if (kps === 0) featureIdCounter.value = 0
        let iconLoadTasks = []
        let psIconRegistered = false
        let iconOffsets = {}

        each(ps.points, (pt, kpt) => {
            let ll = get(pt, 'latLng', null); if (!isarr(ll) || size(ll) < 2) return
            let ptype = get(pt, 'type', null) || psType
            let props = { _kps: kps, _kpt: kpt, _ptype: ptype, _id: pt.id || '' }

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
                    if (!isarr(get(pt, 'popupAnchor', null)) && !isarr(get(ps, 'popupAnchor', null))) pt._defPopupAnchor = [0, -ptIconSize[1] / 1.0]
                    if (!isarr(get(pt, 'tooltipAnchor', null)) && !isarr(get(ps, 'tooltipAnchor', null))) pt._defTooltipAnchor = [0, -ptIconSize[1] / 1.0]
                }

                let ptIw = ptIconSize[0]; let ptIh = ptIconSize[1]
                let iconKey
                if (eff && isestr(get(pt, 'iconSrc', null))) {
                    iconKey = `point-icon-pt-${kps}-${kpt}`
                    if (!map.hasImage(iconKey)) iconLoadTasks.push(callbacks.registerIcon(iconKey, ptIconSrc, ptIw, ptIh))
                }
                else if (eff && isestr(psIconSrc)) {
                    if (!psIconRegistered) {
                        let w = isarr(psIconSize) ? psIconSize[0] : 25; let h = isarr(psIconSize) ? psIconSize[1] : 41
                        if (!map.hasImage(psIconKey)) iconLoadTasks.push(callbacks.registerIcon(psIconKey, psIconSrc, w, h))
                        psIconRegistered = true
                    }
                    iconKey = psIconKey
                }
                else {
                    let defKey = iconDefault.key
                    if (!map.hasImage(defKey)) iconLoadTasks.push(callbacks.registerIcon(defKey, ptIconSrc, ptIw, ptIh))
                    iconKey = defKey
                }
                props._iconKey = iconKey

                let centerX = ptIw / 2; let centerY = ptIh / 2
                iconOffsets[kpt] = [centerX - ptIconAnchor[0], centerY - ptIconAnchor[1]]
            }
            let featureId = featureIdCounter.value++
            features.push({ type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [ll[1], ll[0]] }, properties: props })
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
                each(offKeys, (k) => { matchArgs.push(parseInt(k, 10)); matchArgs.push(['literal', iconOffsets[k]]) })
                matchArgs.push(['literal', firstOff])
                iconOffsetExpr = matchArgs
            }
        }

        let doRender = () => {
            if (!map) return
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
                    id: circleId, type: 'circle', source: srcId,
                    filter: ['==', ['get', '_ptype'], 'circle'],
                    paint: {
                        'circle-radius': ['get', '_radius'],
                        'circle-color': ['get', '_fillColor'],
                        'circle-stroke-color': ['get', '_lineColor'],
                        'circle-stroke-width': ['get', '_lineWidth'],
                    }
                })
                map.addLayer({
                    id: symbolId, type: 'symbol', source: srcId,
                    filter: ['==', ['get', '_ptype'], 'icon'],
                    layout: {
                        'icon-image': ['get', '_iconKey'], 'icon-size': 1,
                        'icon-anchor': 'center', 'icon-offset': iconOffsetExpr,
                        'icon-allow-overlap': true, 'icon-ignore-placement': true,
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
                        id: clusterCircleId, type: 'circle', source: srcId,
                        filter: ['has', 'point_count'],
                        paint: {
                            'circle-color': buildStepExpr(clusterOpts.levelFillColors),
                            'circle-radius': buildStepExpr(clusterOpts.levelRadius),
                            'circle-stroke-width': buildStepExpr(clusterOpts.levelLineWidths),
                            'circle-stroke-color': buildStepExpr(clusterOpts.levelLineColors),
                        }
                    })
                    map.addLayer({
                        id: clusterCountId, type: 'symbol', source: srcId,
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
                            result.then((zoom) => { map.easeTo({ center: fs[0].geometry.coordinates, zoom }) }).catch(() => {})
                        }
                    })
                    map.on('mouseenter', clusterCircleId, () => { map.getCanvas().style.cursor = 'pointer' })
                    map.on('mouseleave', clusterCircleId, () => { map.getCanvas().style.cursor = '' })
                }

                let handlePointEvent = (e, action) => {
                    if (!e.features || !e.features.length) return
                    let f = e.features[0]; let p = f.properties
                    let ptData = callbacks.getPointData(p._kps, p._kpt)
                    let psData = callbacks.getPointSetData(p._kps)
                    if (!ptData || !psData) return
                    let coords = f.geometry.coordinates
                    action(e, ptData, psData, p, coords)
                }

                map.on('click', circleId, (e) => handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointClick(ptData, psData, p, coords)))
                map.on('click', symbolId, (e) => handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointClick(ptData, psData, p, coords)))
                map.on('mouseenter', circleId, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointEnter(ptData, psData, p, coords))
                })
                map.on('mouseenter', symbolId, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    handlePointEvent(e, (ev, ptData, psData, p, coords) => callbacks.onPointEnter(ptData, psData, p, coords))
                })
                map.on('mouseleave', circleId, () => { map.getCanvas().style.cursor = ''; callbacks.onPointLeave() })
                map.on('mouseleave', symbolId, () => { map.getCanvas().style.cursor = ''; callbacks.onPointLeave() })
            }
        }

        if (iconLoadTasks.length > 0) Promise.all(iconLoadTasks).then(doRender).catch(() => doRender())
        else doRender()
    })
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
 * @param {Object} featureIdCounter - { value: Number }
 */
export function renderPolylineSets(map, polylineSets, tracked, callbacks, featureIdCounter) {
    if (!map) return
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
            geomType = 'MultiLineString'; coords = lmap(lls, (seg) => lmap(seg, (ll) => [ll[1], ll[0]]))
        }
        let featureId = featureIdCounter.value++
        let geojsonData = { type: 'Feature', id: featureId, geometry: { type: geomType, coordinates: coords } }
        if (map.getSource(sid)) {
            map.getSource(sid).setData(geojsonData)
        }
        else {
            map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
            map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': pls.lineColor, 'line-width': pls.lineWidth } })
            tracked.sourceIds.push(sid); tracked.layerIds.push(lid)
            map.on('click', lid, (e) => {
                if (isfun(pls.funSetsClick)) pls.funSetsClick({ ev: e, polylineSet: pls, kpolylineSet: k, polylineSets })
                callbacks.onPopupClick(e.lngLat, pls, 'polyline', k)
            })
            map.on('mouseenter', lid, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                callbacks.onTooltipEnter(e.lngLat, pls, 'polyline', k)
            })
            map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave() })
        }
    })
}


/**
 * 渲染多邊形圖層（增量更新）
 */
export function renderPolygonSets(map, polygonSets, tracked, callbacks, featureIdCounter) {
    if (!map) return
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
        let featureId = featureIdCounter.value++
        let geojsonData = { type: 'Feature', id: featureId, geometry }
        if (map.getSource(sid)) {
            map.getSource(sid).setData(geojsonData)
        }
        else {
            map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
            map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': pg.fillColor, 'fill-opacity': 1 } })
            map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': pg.lineColor, 'line-width': pg.lineWidth } })
            tracked.sourceIds.push(sid); tracked.layerIds.push(fid, lid)
            map.on('click', fid, (e) => {
                if (isfun(pg.funSetsClick)) pg.funSetsClick({ ev: e, polygonSet: pg, kpolygonSet: k, polygonSets })
                callbacks.onPopupClick(e.lngLat, pg, 'polygon', k)
            })
            map.on('mouseenter', fid, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                callbacks.onTooltipEnter(e.lngLat, pg, 'polygon', k)
            })
            map.on('mouseleave', fid, () => { map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave() })
        }
    })
}


/**
 * 渲染 GeoJSON 圖層（增量更新，自動拆分為 points/lines/polygons）
 */
export function renderGeojsonSets(map, geojsonSets, tracked, callbacks) {
    if (!map) return
    each(geojsonSets, (gj, k) => {
        let ptsSid = `geojson-pts-src-${k}`; let ptsLid = `geojson-pts-circle-${k}`
        let lnsSid = `geojson-lns-src-${k}`; let lnsLid = `geojson-lns-line-${k}`
        let pgsSid = `geojson-pgs-src-${k}`; let pgsFid = `geojson-pgs-fill-${k}`; let pgsLid = `geojson-pgs-line-${k}`
        let allSids = [ptsSid, lnsSid, pgsSid]
        let allLids = [ptsLid, lnsLid, pgsFid, pgsLid]

        if (!gj.visible || !isobj(get(gj, 'geojson', null))) {
            each(allLids, (lid) => { if (map.getLayer(lid)) map.removeLayer(lid) })
            each(allSids, (sid) => { if (map.getSource(sid)) map.removeSource(sid) })
            tracked.layerIds = tracked.layerIds.filter((x) => allLids.indexOf(x) < 0)
            tracked.sourceIds = tracked.sourceIds.filter((x) => allSids.indexOf(x) < 0)
            return
        }

        let splitted = splitAndProcGeoJSON(gj.geojson)
        let bindEvents = (layerId) => {
            map.on('click', layerId, (e) => {
                if (isfun(gj.funSetsClick)) gj.funSetsClick({ ev: e, lat: e.lngLat.lat, lng: e.lngLat.lng, geojsonSet: gj, kgeojsonSet: k, geojsonSets })
                callbacks.onPopupClick(e.lngLat, gj, 'geojson', k)
            })
            map.on('mouseenter', layerId, (e) => {
                map.getCanvas().style.cursor = 'pointer'
                callbacks.onTooltipEnter(e.lngLat, gj, 'geojson', k)
            })
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; callbacks.onTooltipLeave() })
        }

        if (map.getSource(ptsSid)) { map.getSource(ptsSid).setData(splitted.points) }
        else {
            map.addSource(ptsSid, { type: 'geojson', data: splitted.points, generateId: true })
            map.addLayer({ id: ptsLid, type: 'circle', source: ptsSid, paint: { 'circle-color': gj.fillColor, 'circle-radius': 5, 'circle-stroke-color': gj.lineColor, 'circle-stroke-width': 1 } })
            tracked.sourceIds.push(ptsSid); tracked.layerIds.push(ptsLid)
            bindEvents(ptsLid)
        }
        if (map.getSource(lnsSid)) { map.getSource(lnsSid).setData(splitted.lines) }
        else {
            map.addSource(lnsSid, { type: 'geojson', data: splitted.lines, generateId: true })
            map.addLayer({ id: lnsLid, type: 'line', source: lnsSid, paint: { 'line-color': gj.lineColor, 'line-width': gj.lineWidth } })
            tracked.sourceIds.push(lnsSid); tracked.layerIds.push(lnsLid)
            bindEvents(lnsLid)
        }
        if (map.getSource(pgsSid)) { map.getSource(pgsSid).setData(splitted.polygons) }
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
 * @param {Object} featureIdCounter - { value: Number }
 */
export function renderContourSets(map, contourSets, tracked, subCounts, callbacks, featureIdCounter) {
    if (!map) return

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

        // 更新圖例
        cs.legend = buildContourLegend({ polygonSets }, cs)

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

            let featureId = featureIdCounter.value++
            let geojsonData = { type: 'Feature', id: featureId, geometry: { type: 'MultiPolygon', coordinates } }

            if (map.getSource(sid)) {
                map.getSource(sid).setData(geojsonData)
            }
            else {
                map.addSource(sid, { type: 'geojson', data: geojsonData, generateId: true })
                map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': ps.fillColor, 'fill-opacity': cs.fillOpacity } })
                map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': ps.lineColor, 'line-width': cs.lineWidth } })
                tracked.sourceIds.push(sid); tracked.layerIds.push(fid, lid)

                map.on('click', fid, (e) => { callbacks.onContourClick(e, ps, kps, cs, kcs, contourSets) })
                map.on('mouseenter', fid, (e) => {
                    map.getCanvas().style.cursor = 'pointer'
                    if (cs.changeStyleWhenHover) {
                        let lineColorH = isestr(cs.lineColorHover) ? cs.lineColorHover : ps.color
                        map.setPaintProperty(fid, 'fill-opacity', cs.fillOpacityHover)
                        map.setPaintProperty(lid, 'line-color', lineColorH)
                        map.setPaintProperty(lid, 'line-width', cs.lineWidthHover)
                    }
                    callbacks.onContourEnter(e, cs, kcs)
                })
                map.on('mouseleave', fid, () => {
                    map.getCanvas().style.cursor = ''
                    if (cs.changeStyleWhenHover) {
                        map.setPaintProperty(fid, 'fill-opacity', cs.fillOpacity)
                        map.setPaintProperty(lid, 'line-color', ps.lineColor)
                        map.setPaintProperty(lid, 'line-width', cs.lineWidth)
                    }
                    callbacks.onContourLeave()
                })
            }
        })

        subCounts[kcs] = newCount
    })
}
