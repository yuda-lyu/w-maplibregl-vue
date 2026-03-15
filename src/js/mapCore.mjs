/**
 * mapCore.mjs
 * 地圖實例建立、投影管理
 */
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isNumber from 'lodash-es/isNumber.js'
import isarr from 'wsemi/src/isarr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import maplibregl from 'maplibre-gl'


/**
 * 建立 MapLibre 地圖實例
 * @param {HTMLElement} container - 地圖容器 DOM 元素
 * @param {Object} opt - Vue component 的 opt prop
 * @returns {maplibregl.Map}
 */
export function createMap(container, opt) {
    let center = get(opt, 'center', null)
    let ck = isarr(center) && size(center) === 2 && isNumber(center[0]) && isNumber(center[1])
    if (!ck) center = [23.5, 121.1]

    let zoom = get(opt, 'zoom', null)
    if (!isnum(zoom)) zoom = 6
    zoom = Math.min(Math.max(zoom, 1), 18)

    return new maplibregl.Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f0f0f0' } }],
        },
        center: [center[1], center[0]],
        zoom,
        attributionControl: false,
        antialias: true,
    })
}


/**
 * 切換 globe/mercator 投影
 * @param {Object} map - MapLibre 地圖實例
 * @param {String} projection - '' | 'globe' | 'mercator'（'' = auto 模式）
 */
export function applyProjection(map, projection) {
    if (!map) return
    let target
    if (projection === '') {
        target = map.getZoom() <= 8 ? 'globe' : 'mercator'
    }
    else {
        target = projection
    }
    try {
        map.setProjection({ type: target })
    }
    catch (e) {
        console.warn('[mapCore] setProjection error:', e)
    }
}
