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

## `opt` 位姿契約(`opt.zoom`、`opt.center` 會被寫回)

`opt` 不只是輸入:元件會把地圖**目前**的層級與中心寫回傳入的 `opt` 物件。使用者拖曳、滾輪縮放等操作讓地圖停下時(元件於 maplibre 的 `zoomend`、`moveend` 等事件寫回),`opt.zoom` 被寫成實際層級,`opt.center` 被寫成 `[緯度, 經度]`。反過來,對 `opt.zoom`、`opt.center` 賦值,地圖就移到該位姿,且之後每次 `opt` 有變更,元件都以 `opt` 上的位姿值為準。下文標「實測」者,皆在本套件 1.0.71 以 Chromium 實測;其餘為程式碼行為的說明。

使用端須知:

- 要讓父層的 watcher 或畫面收到位姿寫回、並讓賦值能驅動地圖,`opt` 須**預先宣告** `zoom`、`center` 鍵(Vue 2 的響應式只涵蓋宣告時已存在的鍵;未宣告時位姿仍會寫進 `opt`,但不是響應式,見 T7)。
- 這個物件由元件寫入:**不可凍結**(T4),也不可由多個元件實例共用(T5)。
- 位姿主要由 `opt.zoom`、`opt.center` 決定;改面板文字、資料集等欄位不會移動地圖(實測:平移後改 `opt.panelLabels.title` 並整組換掉 `opt.pointSets`,位姿不變)。另外,`opt.minZoom`、`opt.maxZoom` 把現行層級拉入新範圍、`opt.projection` 切換時,層級或中心也可能被調整並寫回(見 `opt.zoom`、`opt.minZoom` 的 JSDoc 說明)。

| # | 情境 | 實際行為(實測) | 正確作法 |
| --- | --- | --- | --- |
| T1 | 使用者平移後,父層以**新物件**取代 `opt`,新 `opt` 帶有 `center`、`zoom` | 地圖跳到新 `opt` 的位姿(實測:自平移後的 24.5°N、122°E、z9 跳回 23.5°N、121.1°E、z7) | 要保留使用者視角:就地修改既有 `opt` 的欄位而不換物件(實測位姿不變);必須換整個物件時,新物件帶入目前的 `opt.center`、`opt.zoom`(實測位姿不變);要回到初始視角,就是這個行為 |
| T2 | 同 T1,但新 `opt` 不帶 `center`、`zoom` | 跳到預設位姿(實測:`center` 為 `[23.5, 121.1]`、`zoom` 為 6);未給的鍵用預設(見 `opt.center`、`opt.zoom` 的 JSDoc 說明) | 同 T1:帶入目前的 `opt.center`、`opt.zoom` |
| T3 | 父層 deep watch 整個 `opt` | 每次平移或縮放結束都觸發一次(實測:5 次 `jumpTo` 觸發 5 次;真滑鼠一次拖曳、一次滾輪各觸發 1 次) | 只 watch 需要的欄位(實測 watch `opt.panelLabels`,5 次平移觸發 0 次);要追蹤視角就 watch `opt.zoom`、`opt.center` |
| T4 | `opt` 被 `Object.freeze` | 位姿寫回時拋出錯誤(實測 Chromium 訊息:`Cannot assign to read only property 'center'`);`opt.center` 與元件內部記錄的中心停在舊值,地圖卻已移動 | 不要凍結 `opt`;大資料只凍結資料集內的陣列(見下節) |
| T5 | 兩個元件實例共用同一個 `opt` | 平移其中一個,另一個跟著移動(寫回改了共用的 `opt`,另一個再依 `opt` 推地圖) | 每個實例各用自己的 `opt` |
| T6 | 把 `opt.center`、`opt.zoom` 當讀值,並賦值重設視角 | **可依賴的行為**:賦值後地圖移到該位姿,`opt` 同步為新值(實測:平移後同時賦回初始 `center`、`zoom`,地圖回到初始位姿);同一次賦值 `center` 與 `zoom` 兩者皆生效(`e2e-zoomrange` 的 E2E-Z8 保護就地賦值,E2E-Z8b 保護整個換新 `opt`);只賦 `center` 以平移動畫移動,只賦 `zoom` 不經動畫(實測賦值後 30 ms:前者仍在移動、後者已靜止) | 這是支援的用法,不需改 |
| T7 | `opt` 沒有預先宣告 `zoom`、`center` 鍵 | 位姿仍會寫進 `opt`,但不是響應式:父層 watcher 不觸發(實測 0 次),其後賦值 `opt.zoom = 12` 無效(地圖仍在 z9) | 在 `opt` 預先宣告 `zoom`、`center`(實測:宣告後平移會觸發 watcher,賦值 `opt.zoom = 12` 地圖到 z12) |
| T8 | 只改 `opt.center` 到高緯度 | 地球投影(`opt.projection` 為 `'globe'`,或未給且層級 ≤ 8 的自動投影)下,地圖依緯度調整層級,並把調整後的層級寫回 `opt.zoom`(實測:`zoom` 6、中心改 60°N,未給與 `'globe'` 皆由 6 變約 5.12);`'mercator'` 下不變(實測 6 仍為 6) | 以 `opt.zoom` 取得實際層級,不要假設它不變;要固定層級就用 `projection: 'mercator'` |

### 大資料:凍結 `points` 省走訪成本

Vue 2 會走訪 `opt` 的全部內容以建立響應式,點越多,每次 `opt` 有變更(含每次平移的位姿寫回)走訪越久。資料集的 `points` 陣列與各點不需要響應式時,以 `Object.freeze` 凍結陣列與各點,Vue 就會略過:

```js
let points = rows.map((r) => Object.freeze({ latLng: [r.lat, r.lng], title: r.name, msg: r.desc }))
opt.pointSets[0].points = Object.freeze(points) // 資料更新時整組換新
```

實測(Chromium、20,000 點、單一底圖):無關 `opt` 變更後的 Vue 更新,中位數由約 20 ms 降到約 1 ms,掛載由約 570 ms 降到約 440 ms(單次量測,數值依機器而異);畫面同樣繪出 20,000 筆。另以 300 點實測:凍結後平移寫回與面板顯隱照常。限制:

- 資料須整組換新:把 `points` 換成新的凍結陣列可正常重繪(實測 300 筆換成 301 筆);就地 `push` 凍結陣列會拋 `TypeError`。
- **不可凍結資料集物件本身**(如 `Object.freeze(opt.pointSets[0])`):面板的顯隱勾選框會失效——勾選框的狀態會變,但圖層不隱藏、`visible` 也不寫入 `opt`(實測)。
- 以上以 `pointSets` 實測;其他資料集(線、面等)未實測。

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
