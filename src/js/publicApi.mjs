/**
 * publicApi.mjs
 * 對外公開的地圖操作方法（panTo、getMapObject 等）
 * 注意：popupPoint / popupFeatureById 因需要 Vue $refs 與 $nextTick，
 *       仍保留於 Vue 元件中，此處僅提取純邏輯計算。
 */
import get from 'lodash-es/get.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import isNumber from 'lodash-es/isNumber.js'
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'


/**
 * 取得 map 物件（包裝 panTo 使其相容 Leaflet 的 [lat,lng] 格式）
 * @param {Object} map
 * @returns {Object|null}
 */
export function getMapObject(map) {
    if (!map) return null
    if (!map._wlfWrapped) {
        let origPanTo = map.panTo.bind(map)
        map.panTo = (latLng, opts) => {
            if (isarr(latLng) && size(latLng) >= 2) origPanTo([latLng[1], latLng[0]], opts)
            else origPanTo(latLng, opts)
        }
        map._wlfWrapped = true
    }
    return map
}


/**
 * 計算 panTo 偏移後的新中心座標
 * @param {Object} map - MapLibre 地圖實例
 * @param {Array} latLng - [lat, lng]
 * @param {Object} opt - { ratioHorizontal, ratioVertical, funLatLng }
 * @returns {Array|null} 新的 [lat, lng]，或 null 表示不需移動
 */
export function calcPanToCenter(map, latLng, opt) {
    if (!isearr(latLng) || !map) return null
    let ratioHorizontal = get(opt, 'ratioHorizontal'); if (isnum(ratioHorizontal)) ratioHorizontal = cdbl(ratioHorizontal)
    let ratioVertical = get(opt, 'ratioVertical'); if (isnum(ratioVertical)) ratioVertical = cdbl(ratioVertical)
    let funLatLng = get(opt, 'funLatLng')

    let bds = map.getBounds()
    let ne = bds.getNorthEast(); let sw = bds.getSouthWest()
    let lngRange = ne.lng - sw.lng; let latRange = ne.lat - sw.lat
    let lngMin = latLng[1] - lngRange / 2; let lngMax = latLng[1] + lngRange / 2
    let latMin = latLng[0] - latRange / 2; let latMax = latLng[0] + latRange / 2

    let lngNew = null; let latNew = null
    if (isNumber(ratioHorizontal)) { let lngMaxNew = lngMax - lngRange * ratioHorizontal; lngNew = (lngMin + lngMaxNew) / 2 }
    if (isNumber(ratioVertical)) { let latMinNew = latMin + latRange * ratioVertical; latNew = (latMinNew + latMax) / 2 }

    let latLngNew = cloneDeep(latLng)
    if (isNumber(ratioVertical)) latLngNew[0] = latNew
    if (isNumber(ratioHorizontal)) latLngNew[1] = lngNew

    if (isfun(funLatLng)) {
        latLngNew = funLatLng(latLng, { bds, lngRange, latRange, lngMin, lngMax, latMin, latMax, ratioHorizontal, ratioVertical, latLngNew })
    }
    return latLngNew
}


/**
 * 計算折線的中間點座標
 * @param {Array} latLngs
 * @returns {Array|null} [lat, lng]
 */
export function calcPolylineCenter(latLngs) {
    if (!isearr(latLngs)) return null
    let seg = isarr(latLngs[0]) && isNumber(latLngs[0][0]) ? latLngs : latLngs[0]
    if (!isearr(seg)) return null
    let mid = seg[Math.floor(seg.length / 2)]
    return [mid[0], mid[1]]
}


/**
 * 計算多邊形第一環重心座標
 * @param {Array} latLngs
 * @returns {Array|null} [lat, lng]
 */
export function calcPolygonCenter(latLngs) {
    if (!isearr(latLngs)) return null
    let ring = isarr(latLngs[0]) && isNumber(latLngs[0][0]) ? latLngs : latLngs[0]
    if (!isearr(ring)) return null
    let sumLat = 0; let sumLng = 0
    each(ring, (ll) => { sumLat += ll[0]; sumLng += ll[1] })
    return [sumLat / ring.length, sumLng / ring.length]
}


/**
 * 從 pointSets 中依 id 查找 point 資料
 * @param {Array} pointSets
 * @param {String} targetId
 * @returns {{ foundPt, foundPs, foundPsIndex }}
 */
export function findPointById(pointSets, targetId) {
    let foundPt = null; let foundPs = null; let foundPsIndex = -1
    each(pointSets, (ps, kps) => {
        each(ps.points, (pt) => {
            if (pt.id === targetId) { foundPt = pt; foundPs = ps; foundPsIndex = kps; return false }
        })
        if (foundPt) return false
    })
    return { foundPt, foundPs, foundPsIndex }
}


/**
 * 解析 feature id 並取得對應資料（折線/多邊形）
 * @param {String} id - 例如 'polylineSet-0' 或 'polygonSet-0'
 * @param {Array} polylineSets
 * @param {Array} polygonSets
 * @returns {{ center, featureData, ownerPath, type } | null}
 */
export function resolveFeatureById(id, polylineSets, polygonSets) {
    if (!isestr(id)) return null
    if (id.startsWith('polylineSet-')) {
        let idx = parseInt(id.replace('polylineSet-', ''), 10)
        let pls = get(polylineSets, idx, null); if (!pls) return null
        let center = calcPolylineCenter(get(pls, 'latLngs', []))
        if (!center) return null
        return { center, featureData: pls, ownerPath: `polylineSets.${idx}`, type: 'polyline' }
    }
    if (id.startsWith('polygonSet-')) {
        let idx = parseInt(id.replace('polygonSet-', ''), 10)
        let pg = get(polygonSets, idx, null); if (!pg) return null
        let center = calcPolygonCenter(get(pg, 'latLngs', []))
        if (!center) return null
        return { center, featureData: pg, ownerPath: `polygonSets.${idx}`, type: 'polygon' }
    }
    return null
}
