/**
 * mapCore.mjs
 * 地圖實例建立、投影管理
 */
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isNumber from 'lodash-es/isNumber.js'
import isarr from 'wsemi/src/isarr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import * as maplibregl from 'maplibre-gl' //maplibre-gl 6.x 起為 ESM-only 且移除 default export, 須以 namespace 方式匯入
import workerSource, { maplibreVersion } from './maplibreWorkerInline.mjs'


//maplibre-gl 6.x 起其 worker 為外部獨立檔案, 打包器無法代為處理:
//  umd(rollup)產物會以自身 script 之 URL 推導出 ./maplibre-gl-worker.mjs, 須該檔實際部署於產物旁;
//  webpack 則因 maplibre 內部以變數為基準無法靜態解析, 推導結果為空字串, new Worker('') 直接失敗。
//失敗時 maplibre 僅印一行 console error, 畫面只剩底色(圖磚無法解析), 極易被誤判為網路問題。
//故改以「內嵌 worker 原始碼 + 執行期建 Blob」供 setWorkerUrl, 使使用端無須部署任何 worker 檔案,
//亦無須自行設定, 於 umd script / webpack / vite / 下游 bundler 皆一致可用。
//(maplibre v6 僅提供 setWorkerUrl(string), 未提供可傳入 Worker 類別或工廠之入口, 故只能走此路)
//內嵌原始碼由 toolg/gDistRollupMaplibreGlWorker.mjs 產製; Blob 建立 worker 之做法沿用 w-package-tools 之 rollupWorkerCore
let urlWorker = null
function ensureWorkerUrl() {

    //僅需設定一次, 多個地圖實例共用同一 blob
    if (urlWorker) {
        return
    }

    //check, 內嵌 worker 與主程式須為同版, 不同版代表 maplibre-gl 升版後未重跑 toolg/gDistRollupMaplibreGlWorker.mjs
    let ver = maplibregl.getVersion()
    if (ver !== maplibreVersion) {
        console.warn(`[mapCore] 內嵌 worker 版本[${maplibreVersion}]與 maplibre-gl[${ver}]不一致, 請重跑 node toolg/gDistRollupMaplibreGlWorker.mjs`)
    }

    //Blob 以 UTF-8 編碼字串, 故內嵌原始碼之非 ASCII 字元無須另行處理
    let blob = new Blob([workerSource], { type: 'text/javascript' })
    let URLc = window.URL || window.webkitURL
    urlWorker = URLc.createObjectURL(blob)
    maplibregl.setWorkerUrl(urlWorker)

}


/**
 * 建立 MapLibre 地圖實例
 * @param {HTMLElement} container - 地圖容器 DOM 元素
 * @param {Object} opt - Vue component 的 opt prop
 * @returns {maplibregl.Map}
 */
export function createMap(container, opt) {

    //須早於首次建立地圖(worker 於地圖初始化時即被取用)
    ensureWorkerUrl()

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
