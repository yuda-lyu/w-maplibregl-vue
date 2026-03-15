/**
 * basemapManager.mjs
 * 底圖與 3D 地形的新增、切換、透明度控制
 */
import each from 'lodash-es/each.js'
import get from 'lodash-es/get.js'
import isobj from 'wsemi/src/isobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'


/**
 * 將底圖配置套用到 map（建立 raster/vector/wms source 與 layer）
 * @param {Object} map - MapLibre 地圖實例
 * @param {Array} baseMaps - 底圖配置陣列
 */
export function applyBaseMaps(map, baseMaps) {
    if (!map) return
    let addBaseMapLayer = (bm, k) => {
        let srcId = `basemap-src-${k}`; let layerId = `basemap-layer-${k}`
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
                    'fill-extrusion-color': ['coalesce', ['get', 'colour'], '#aaaaaa'],
                    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'render_height'], ['get', 'height'], 0]],
                    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]],
                    'fill-extrusion-opacity': op,
                }
            }
            else if (layerType === 'fill') {
                paint = { 'fill-color': '#aaaaaa', 'fill-opacity': op }
            }
            map.addLayer({ 'id': layerId, 'type': layerType, 'source': srcId, 'source-layer': sourceLayer, paint, 'layout': { visibility: bm.visible ? 'visible' : 'none' } })
            return
        }
        let tiles = []
        if (bm.type === 'wms') {
            let u = bm.url; if (!u.includes('?')) u += '?'
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
        map.addLayer({ id: layerId, type: 'raster', source: srcId, paint: { 'raster-opacity': op }, layout: { visibility: bm.visible ? 'visible' : 'none' } })
    }
    // 第一輪：底圖（colorShade 非空），確保先渲染在下方
    each(baseMaps, (bm, k) => { if (isestr(bm.colorShade)) addBaseMapLayer(bm, k) })
    // 第二輪：疊加圖層（colorShade 空字串），後渲染在底圖上方
    each(baseMaps, (bm, k) => { if (!isestr(bm.colorShade)) addBaseMapLayer(bm, k) })
}


/**
 * 套用 3D 地形（清除舊地形後重新設定）
 * @param {Object} map - MapLibre 地圖實例
 * @param {Object} terrainMap - 地形配置物件
 * @param {Array} trackedLayerIds - 追蹤的 layer ID（用於 hillshade 插入位置）
 */
export function applyTerrain(map, terrainMap, trackedLayerIds) {
    if (!map) return
    try { map.setTerrain(null) } catch (e) {}
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
                type: 'raster-dem', tiles: [hu],
                tileSize: hsrc.tileSize || 256,
                encoding: hsrc.encoding || 'terrarium',
            }
            if (isnum(hsrc.maxzoom)) hillshadeSrcSpec.maxzoom = parseInt(hsrc.maxzoom)
            map.addSource('terrain-hillshade-src', hillshadeSrcSpec)
            hillshadeSourceId = 'terrain-hillshade-src'
        }
        let insertBefore = null
        for (let lid of (trackedLayerIds || [])) {
            if (map.getLayer(lid)) { insertBefore = lid; break }
        }
        let hillshadeSpec = {
            id: 'terrain-hillshade', type: 'hillshade', source: hillshadeSourceId,
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
    each(baseMaps, (bm, k) => {
        if (!isestr(bm.colorShade)) return
        bm.visible = (k === idx)
        let id = `basemap-layer-${k}`
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
    let id = `basemap-layer-${idx}`
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
    let id = `basemap-layer-${idx}`
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
