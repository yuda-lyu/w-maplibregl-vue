/**
 * layerVisibility.mjs
 * 圖層可見性管理：tracked 清理、items 列表生成、可見數量計算
 */
import each from 'lodash-es/each.js'
import filter from 'lodash-es/filter.js'
import sortBy from 'lodash-es/sortBy.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import isNumber from 'lodash-es/isNumber.js'


/**
 * 清除以指定前綴開頭的 layer 與 source
 * @param {Object} map - MapLibre 地圖實例
 * @param {String} prefix - 前綴字串
 * @param {Array} trackedLayerIds - 目前追蹤的 layer ID 陣列
 * @param {Array} trackedSourceIds - 目前追蹤的 source ID 陣列
 * @returns {{ layerIds: Array, sourceIds: Array }} 更新後的追蹤陣列
 */
export function clearTrackedByPrefix(map, prefix, trackedLayerIds, trackedSourceIds) {
    if (!map) return { layerIds: trackedLayerIds, sourceIds: trackedSourceIds }
    let rl = []; let rs = []
    each(trackedLayerIds, (id) => {
        id.startsWith(prefix) ? (map.getLayer(id) && map.removeLayer(id)) : rl.push(id)
    })
    each(trackedSourceIds, (id) => {
        id.startsWith(prefix) ? (map.getSource(id) && map.removeSource(id)) : rs.push(id)
    })
    return { layerIds: rl, sourceIds: rs }
}


/**
 * 清除以指定前綴開頭的 DOM markers
 * @param {String} prefix - 前綴字串（對應 marker._prefix）
 * @param {Array} trackedMarkers - 目前追蹤的 marker 陣列
 * @returns {Array} 更新後的 marker 陣列
 */
export function clearTrackedMarkersByPrefix(prefix, trackedMarkers) {
    let remain = []
    each(trackedMarkers, (m) => {
        m._prefix === prefix ? m.remove() : remain.push(m)
    })
    return remain
}


/**
 * 建立統一的圖層列表（供圖層顯隱面板使用）
 * @param {Array} imageSets
 * @param {Array} pointSets
 * @param {Array} polylineSets
 * @param {Array} polygonSets
 * @param {Array} geojsonSets
 * @param {Array} contourSets
 * @returns {Array} items - [{ name, msg, order, visible, updatePath }]
 */
export function buildItemsList(imageSets, pointSets, polylineSets, polygonSets, geojsonSets, contourSets) {
    let items = []
    let add = (n, m, o, v, p) => {
        items.push({ name: n, msg: m, order: o, visible: v, updatePath: p })
    }
    each(imageSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `imageSets.${k}.visible`) })
    each(pointSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `pointSets.${k}.visible`) })
    each(polylineSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `polylineSets.${k}.visible`) })
    each(polygonSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `polygonSets.${k}.visible`) })
    each(geojsonSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `geojsonSets.${k}.visible`) })
    each(contourSets, (v, k) => { add(v.title, v.msg, v.order, v.visible, `contourSets.${k}.visible`) })
    let ord = sortBy(filter(items, (v) => isNumber(v.order)), 'order')
    let rest = filter(items, (v) => !isNumber(v.order))
    return cloneDeep([...ord, ...rest])
}


/**
 * 計算可見圖層數量（純函式）
 * @param {Array} arr - 含 visible 屬性的陣列
 * @returns {Number}
 */
export function countVisible(arr) {
    let i = 0
    each(arr, (v) => { if (v.visible) i++ })
    return i
}
