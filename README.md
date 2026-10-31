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
<script src="https://cdn.jsdelivr.net/npm/w-maplibregl-vue@1.0.59/dist/w-maplibregl-vue.umd.js"></script>
```
