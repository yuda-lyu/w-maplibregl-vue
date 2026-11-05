# w-maplibregl-vue
A vue2 wrapper for maplibre-gl.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![language](https://img.shields.io/badge/vue-2.x-brightgreen.svg)](https://github.com/vuejs/vue) 
[![npm version](http://img.shields.io/npm/v/w-maplibregl-vue.svg?style=flat)](https://npmjs.org/package/w-maplibregl-vue) 
[![license](https://img.shields.io/npm/l/w-maplibregl-vue.svg?style=flat)](https://npmjs.org/package/w-maplibregl-vue) 
[![npm download](https://img.shields.io/npm/dt/w-maplibregl-vue.svg)](https://npmjs.org/package/w-maplibregl-vue) 
[![npm download](https://img.shields.io/npm/dm/w-maplibregl-vue.svg)](https://npmjs.org/package/w-maplibregl-vue) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-maplibregl-vue.svg)](https://www.jsdelivr.com/package/npm/w-maplibregl-vue)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-maplibregl-vue/module-WMaplibreglVue.html).

## Example
To view some examples for more understanding, visit examples:

> **all examples:** [web](https://yuda-lyu.github.io/w-maplibregl-vue/examples/app.html) [[source code](https://github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/app.html)]

## 圖台移動狀態(根節點 `state` 屬性)

元件根節點提供唯讀屬性 `state`,供使用端與 e2e 偵測圖台是否仍在移動(平移、縮放、飛行、投影切換),比照 [w-component-vue](https://github.com/yuda-lyu/w-component-vue) WDrawer 的 `state` 語彙(進行式為過程、終態為落定)。只新增屬性,不改變既有外觀、行為與動畫時間。

| 值 | 意義 |
| --- | --- |
| `moving` | 移動中。初次載入完成前亦為此值;自 maplibre 的 `movestart` 起至 `idle` 止,涵蓋 `panTo`/`centerTo`、`easeTo`、`flyTo`、`jumpTo`、`zoomTo`、縮放按鈕、滾輪縮放、拖曳、羅盤、容器尺寸改變(resize)與投影切換(含自動投影於層級 8 的切換)。相機停止後仍等圖磚載入與繪製完成才轉 `idle`,故 `map.isMoving()` 為 false 時值仍可為 `moving`。 |
| `idle` | 靜止。maplibre 的 `idle` 事件(相機不在移動,且目前請求之圖磚皆已載入、繪製完成):此時 `map.isMoving()` 為 false、`map.loaded()` 為 true,中心、層級、投影不再改變。 |

轉換時點:

| 時點 | 轉換 |
| --- | --- |
| 元件掛載 | 初值 `moving` |
| 載入完成後的首次 `idle` | `moving` → `idle`(與 `loading` 屬性移除同一次重繪) |
| `movestart`(呼叫 `panTo`、`easeTo`、`flyTo`、滾輪、拖曳、縮放鈕、resize 等) | → `moving`,呼叫後下一個微任務即反映於 DOM |
| 靜止時收到滾輪事件 | → `moving`(搶在 `movestart` 之前:maplibre 滾輪縮放自首個 wheel 事件到 `movestart` 約 40~80ms) |
| 投影切換(`opt.projection` 變更、自動投影跨層級 8、使用端 `getMapObject().setProjection`;maplibre `projectiontransition`,可無相機移動) | → `moving` |
| maplibre `idle` 事件 | → `idle`(滾輪已到而 `movestart` 未至時之 `idle` 不採計) |
| 逾時後備 | 相機停止(`moveend`)3000ms 後仍未收到 `idle`(圖磚逾時未載完、繪製被暫停等)→ `idle`;靜止時滾輪事件後 600ms 內地圖未開始移動(如層級已達上下限)→ `idle`;逾時當下地圖仍在移動(長動畫、持續手勢)則續等 |

e2e 偵測用法(Playwright;建議替元件根節點加上自己的 class 以限定範圍,避免與其他帶 `state` 屬性的元件混淆):

```js
// 操作後等圖台靜止再讀數值或截圖: 觸發操作(點擊、page.mouse.wheel、呼叫 panTo)當下,state 已轉為 moving,
// 故接著等 idle 不會讀到操作前的舊值
await page.locator('#btnPanTo').click()
await page.locator('.my-map[state="idle"]').waitFor()
// 此時 map.isMoving() 為 false 且 map.loaded() 為 true

// 使用端程式亦可直接讀取
let isIdle = wmaplibreglvue.$el.getAttribute('state') === 'idle'
```

注意:`state` 只反映相機移動與投影切換,不反映資料圖層(點、線、面)的增刪改;載入階段另有 `loading` 屬性(載入中為 `true`,完成後移除)。

容器尺寸改變(resize)由 maplibre 內建的尺寸追蹤(`trackResize`)單一來源處理,一次尺寸改變只發一組 `movestart`/`resize`/`moveend`(元件不另行偵測尺寸)。`state` 為 Vue 響應式屬性、於微任務更新:`moving` → `idle` 若於同一 JS 任務內完成(例如 resize 後同步重繪即達 `idle`),Vue 會合併更新,屬性不曾顯示 `moving`;此時地圖已靜止,維持 `idle` 即為真。使用端請等待 `idle`,不要等待 `moving` 出現。瀏覽器縮放等使 `devicePixelRatio` 改變、而容器 CSS 尺寸不變(固定像素容器)時,元件於視窗 `resize` 事件補一次 maplibre `resize()`,重算畫布解析度。另容器尺寸改變(例如父層改變元件之寬高)是由 `ResizeObserver` 於下一影格回呼才開始處理,改變容器之當下屬性仍為 `idle`;要等尺寸套用完成,請等畫布尺寸(`map.getCanvas().clientHeight` 等)或 maplibre 之 `resize` 事件,再等 `idle`。

## 連續調整疊加層透明度(`previewOverlayOpacity`)

使用端自帶圖層列表與透明度滑桿時,拖曳滑桿期間要地圖即時跟著變,放開時才提交完整狀態。元件的 `setOverlayOpacity(idx, val)` 會回寫 `opt`、同步內部 `baseMaps` 並重繪面板,適合放開時提交,不適合逐幀呼叫(`opt` 愈大、圖層愈多,每次呼叫愈慢);拖曳中請改呼叫公開方法 `previewOverlayOpacity(name, val)`:只改地圖上該疊加層的繪製屬性,不回寫 `opt`、不改元件內部的 `baseMaps`、不重繪面板,可逐幀呼叫。

```js
// 拖曳中(input 事件): 以名稱定位, 即時預覽
slider.addEventListener('input', (e) => {
    wmaplibreglvue.previewOverlayOpacity('我的疊加層', e.target.value) // 回傳 true 表示已套用
})
// 放開時(change 事件): 提交 —— setOverlayOpacity 以索引定位(panelBaseMaps.baseMaps 的陣列索引)
slider.addEventListener('change', (e) => {
    wmaplibreglvue.setOverlayOpacity(idx, e.target.value)
    // 或直接更新 opt.panelBaseMaps.baseMaps[idx].opacity
})
```

| 項目 | 說明 |
| --- | --- |
| `name` | 疊加層名稱(`baseMaps[i].name`),須為非空字串,嚴格比對(不去空白、區分大小寫) |
| `val` | 透明度,須為 0~1 的有效數字(數字或數字字串,如 `0.3`、`'0.3'`);`NaN`、`Infinity`、`'abc'`、`''`、`null`、布林、`'0x10'` 等非有效數字,或超出 0~1(如 `1.5`、`-0.2`)一律回傳 `false`、不改繪製(不夾限) |
| 回傳 | `true`:已套用到地圖;`false`:未套用(不拋錯)。可由回傳值得知是否生效,逐幀呼叫不會洗版 console |
| 回傳 `false` 的情形 | 地圖尚未載入、查無名稱、名稱對到多個條目(同名疊加層,或疊加層與底圖同名,不擇一)、名稱對到底圖(`colorShade` 非空字串者)、`type` 為 `'style'`、圖層尚未加入(如 `url` 無效而被略過)、`val` 無效或超出 0~1 |
| 適用型別 | 疊加層(`colorShade` 空字串)的 raster、wms、vector(fill、line、fill-extrusion) |

預覽是暫態:

- 預覽只改地圖繪製,`opt` 與元件內部的 `baseMaps` 都不變,面板滑桿與百分比仍顯示已提交的值,直到呼叫 `setOverlayOpacity`(或更新 `opt`)提交。
- 若預覽後未提交,而底圖因 `opt` 變更被增量更新或重新套用(可見性、順序、`opacity`、`colorFillExtrusion` 或其他欄位變更),該圖層會回到已提交的值。
- 預覽不論該疊加層是否可見都會設定繪製屬性;之後切換為可見時,顯示的是最後一次預覽的值,因此預覽應以提交收尾。

## Installation

### Using npm(ES6 module):
```alias
npm i w-maplibregl-vue
```

### In a browser(UMD module):

Add script for vue.
```alias
<script src="https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.min.js"></script>
```

Add script for w-maplibregl-vue.
```alias
<script src="https://yuda-lyu.github.io/w-maplibregl-vue/dist/w-maplibregl-vue.umd.js"></script>
```

### 以 file:// 直接開啟 html 與 sandbox iframe

umd 搭配本機檔案(vue 與 `w-maplibregl-vue.umd.js` 以相對路徑載入)產生之離線 html,可直接在檔案總管雙擊開啟(`file://`),亦可放在 `sandbox="allow-scripts"` 的 iframe(不透明來源)內:地圖用的 worker 由本套件內嵌,不須另行部署檔案或設定。Chromium 在這兩種環境無法以 module worker 載入 Blob(症狀:只見底圖、點位與面板都不顯示,console 僅有一行 `Worker failed to load`),故本套件偵測到 `file:` 頁面或 Blob 來源為不透明(`null`)時,自動改以 data: URL 供 classic 版 worker;http(s)、webpack、vite 等其他環境維持原本的 Blob,行為不變。

已知限制:

- 頁面若自帶 CSP(`Content-Security-Policy`):`file://` 須允許 `worker-src blob:`,且 `connect-src` 須允許 `data:`(或不設 `connect-src`)。Chromium 實測:只放行 `worker-src data:`、或 `connect-src 'self'` 而不含 `data:` 時,點位與面板不顯示,console 有 CSP 違規訊息;`script-src`/`default-src` 已放行 `data:`、`blob:` 者(無 `worker-src` 時回退)可用。sandbox iframe 搭配 CSP 者未測。一般離線 html 無 CSP;http(s) 頁面的 CSP 需求不變(`worker-src blob:`)。
- 僅以 Chromium 實測;Firefox、Safari 在 `file://` 的行為未測。
- 底圖、圖磚與地形等資源仍須由頁面能取得的來源供應(離線頁請用 data URI 或內嵌資料),本套件不改變其載入方式。
