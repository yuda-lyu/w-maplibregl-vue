/**
 * mapCore.mjs
 * 地圖實例建立、投影管理
 */
import * as maplibregl from 'maplibre-gl' //maplibre-gl 6.x 起為 ESM-only 且移除 default export, 須以 namespace 方式匯入
import { computeBasicOpt } from './configProcessor.mjs'
import workerSource, { maplibreVersion, classicLength } from './maplibreWorkerInline.mjs'


//maplibre-gl 6.x 起其 worker 為外部獨立檔案, 打包器無法代為處理:
//  umd(rollup)產物會以自身 script 之 URL 推導出 ./maplibre-gl-worker.mjs, 須該檔實際部署於產物旁;
//  webpack 則因 maplibre 內部以變數為基準無法靜態解析, 推導結果為空字串, new Worker('') 直接失敗。
//失敗時 maplibre 僅印一行 console error, 畫面只剩底色(圖磚無法解析), 極易被誤判為網路問題。
//故改以「內嵌 worker 原始碼 + 執行期建 Blob」供 setWorkerUrl, 使使用端無須部署任何 worker 檔案,
//亦無須自行設定, 於 umd script / webpack / vite / 下游 bundler 皆一致可用。
//(maplibre v6 僅提供 setWorkerUrl(string), 未提供可傳入 Worker 類別或工廠之入口, 故只能走此路)
//內嵌原始碼由 toolg/gDistRollupMaplibreGlWorker.mjs 產製; Blob 建立 worker 之做法沿用 w-package-tools 之 rollupWorkerCore
//
//file:// 頁面(於檔案總管直接開啟 html)與不透明來源(sandbox iframe 等)不可用 module Blob, 改以 data: URL 供 classic 版:
//  maplibre 之 workerFactory 只在 URL 以 '.cjs' 結尾時走 classic, 其餘一律 module; module 時若 URL 之來源與 location.origin 不同(isCrossOrigin)
//  則再包一層「import 該 URL」之 Blob 以 module worker 載入, 否則直接以 module worker 載入該 URL。
//  Chrome 於 file:// 下 location.origin 為 'file://' 而 Blob URL 之來源為 'null', 被判為跨來源而以 module worker 載入 Blob;
//  sandbox iframe 為不透明來源, Blob URL 之來源亦為 'null'(srcdoc 時 location.origin 同為 'null' 而不判跨來源; src 時 location.origin 仍為該 URL 之來源而判跨來源), 皆以 module worker 載入 Blob。
//  上述 Chromium 皆無法載入(實測 153), 且建構子不丟錯、失敗於非同步 error 事件, maplibre 只印 'Worker failed to load',
//  點位等需 worker 之圖層與面板皆不顯示(使用端以 umd 產頁並雙擊開啟時只見底圖, 無任何提示)。
//  classic worker + Blob/data: URL 與 module worker + data: URL 於上述環境皆可(實測), 本處取 classic + data: URL:
//  URL 以 '//.cjs' 註解結尾使 maplibre 走 classic(判為跨來源時先 fetch 再建 classic Blob worker; 否則直接 new Worker(data: URL));
//  classic 版為內嵌原始碼去掉末尾 export 之前段, 其長度 classicLength 由 toolg/gDistRollupMaplibreGlWorker.mjs 以 vm.Script 驗證後寫入(切分規則只在該處)。
//判斷條件(needClassicWorker)取「protocol 為 'file:'」或「Blob URL 之來源為不透明('null')」, 不取下列兩者(皆有實測反例):
//  ①maplibre 判斷跨來源之準則(Blob URL 之來源與 location.origin 不同): sandbox iframe(srcdoc)兩者皆 'null' 而漏掉, 但 module Blob 於該處仍失敗;
//  ②location.origin 為 'null': sandbox iframe(src)之 location.origin 仍為該 URL 之來源(window.origin 才為 'null'), 亦漏掉。
//  Blob URL 之來源為不透明正是 Chromium 無法以 module worker 載入之成因; 'file:' 則涵蓋 Blob 來源表示不同之瀏覽器(Firefox/Safari 未測, 取最保守之 classic)。
//  其餘環境維持 module Blob, 行為不變(CSP 只放行 blob: 之頁面不受影響)。
//依賴 maplibre 內部實作細節(isClassicWorkerUrl 僅認 '.cjs' 結尾、跨來源時 fetch 後建 classic Blob), 非其公開 API:
//  maplibre-gl 升版若改了判斷, 由 test/unit-workerClassic.test.mjs(檢查其原始碼之判斷式)與 test/e2e-fileprotocol.test.mjs(真瀏覽器於 file:// 與 sandbox iframe 載入)揭露。
//限制: 上述環境之頁面若自帶 CSP 而未放行 connect-src data:(判為跨來源時 maplibre 會 fetch 該 data: URL)或 worker-src data:/blob:, 仍會失敗
//  (該等環境原本即失敗, 非本處引入; 一般離線 html 無 CSP); 僅以 Chromium 實測, Firefox/Safari 於 file:// 之行為未測。
let urlWorker = null


/**
 * 此頁面是否須以 classic 版 worker 載入(Chromium 無法以 module worker 載入 Blob 之環境: file:// 與不透明來源)
 * @param {String} urlBlob - 以內嵌原始碼建立之 Blob URL(其來源為 'null' 即不透明來源)
 * @param {Object} [loc=globalThis.location] - location 或具 protocol 屬性之物件
 * @returns {Boolean}
 */
export function needClassicWorker(urlBlob, loc = globalThis.location) {
    if (loc && loc.protocol === 'file:') {
        return true
    }
    try {
        return new URL(urlBlob).origin === 'null'
    }
    catch (err) {
        return false
    }
}


/**
 * 以 classic 版 worker 原始碼組成 data: URL, 供 maplibre 的 setWorkerUrl 使用
 * 以 encodeURIComponent 編碼(含非 ASCII 字元), 編碼後無 '?' 與 '#', maplibre 判斷 '.cjs' 結尾時不被截斷
 * @param {String} source - 內嵌 worker 原始碼(ESM)
 * @param {Number} length - classic 前段之長度(classicLength)
 * @returns {String}
 */
export function buildClassicWorkerUrl(source, length) {
    return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(source.slice(0, length) + '\n//.cjs')
}


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
    let urlBlob = URLc.createObjectURL(blob)
    if (needClassicWorker(urlBlob)) {

        //file:// 與不透明來源不可用 module Blob, 見上方說明
        URLc.revokeObjectURL(urlBlob)
        urlWorker = buildClassicWorkerUrl(workerSource, classicLength)

    }
    else {
        urlWorker = urlBlob
    }
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

    //center/zoom/縮放範圍之正規化只在 computeBasicOpt(R11、R13); 範圍由地圖把關, zoom 超出範圍者由 maplibre 建構時之 jumpTo 夾入
    let basic = computeBasicOpt(opt)
    if (basic.ignoredMin) console.warn(`[mapCore] opt.minZoom 大於 opt.maxZoom(有效 maxZoom=${basic.maxZoom}), 忽略 minZoom`)

    return new maplibregl.Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f0f0f0' } }],
        },
        center: [basic.center[1], basic.center[0]],
        zoom: basic.zoom,
        minZoom: basic.minZoom,
        maxZoom: basic.maxZoom,
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


/**
 * 執行期變更圖台縮放範圍: maplibre 之 setMinZoom 拋錯當新 min 大於現行 max、setMaxZoom 拋錯當新 max 小於現行 min,
 * 故先設不會與現行另一端衝突者; 範圍外之現行層級由 maplibre 自行拉入範圍(同步觸發 zoomend/moveend)
 * @param {Object} map - MapLibre 地圖實例
 * @param {{ minZoom: Number, maxZoom: Number }} next - computeZoomRange 之結果
 */
export function applyZoomRange(map, next) {
    if (!map) return
    try {
        if (next.maxZoom >= map.getMinZoom()) {
            map.setMaxZoom(next.maxZoom); map.setMinZoom(next.minZoom)
        }
        else {
            map.setMinZoom(next.minZoom); map.setMaxZoom(next.maxZoom)
        }
    }
    catch (e) {
        console.warn('[mapCore] applyZoomRange error:', e)
    }
}
