<template>
    <div class="bkp">

        <div style="padding-bottom:10px; font-size:0.85rem; color:#777;">
            baseMaps[i].opacity 驗證頁(e2e 用): 疊加層(colorShade 空字串)的預設透明度與值域由 <b>getBaseMapOpacity</b> 單一決定，面板滑桿、百分比與實繪(paint)一致：raster與wms預設1、vector預設0.8，可給數字或數字字串，超出0~1夾限，非數值視為未給；type為'style'時不支援，面板不顯示滑桿。本頁各疊加層未勾選時圖層即已建立(visibility none)，圖磚與 TileJSON 皆免網路。
        </div>

        <div style="position:relative;">
            <WMaplibreglVue
                ref="wm"
                style="width:800px; height:500px;"
                :opt="opt"
            ></WMaplibreglVue>
        </div>

    </div>
</template>

<script>
import * as maplibregl from 'maplibre-gl' //maplibre-gl 6.x 為 ESM-only 且無 default export, 須以 namespace 匯入
import WMaplibreglVue from './components/WMaplibreglVue.vue'

//1x1 純色 PNG(與 AppPBMMaxzoom 同源)
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4o6HxHwAFPAIs0Zo91QAAAABJRU5ErkJggg==' //[220,40,40]
const PROTOCOL = 'e2eop'

//vector 底圖之 TileJSON 走 data: URI(本體可成功載入不阻塞 map load); bounds 指向視野外極小區域 → 視圖內零圖磚請求
const VEC_TILEJSON = 'data:application/json,' + encodeURIComponent(JSON.stringify({ tilejson: '2.2.0', tiles: ['http://127.0.0.1:8123/nope/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, bounds: [-10, -10, -9.99, -9.99] }))
//style 型別底圖之 style JSON(僅一個 background 圖層), 走 data: URL(fetch 支援)
const STYLE_URL = 'data:application/json,' + encodeURIComponent(JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bgop', type: 'background', paint: { 'background-color': '#ffffff' } }] }))

function b64ToArrayBuffer(b64) {
    let s = atob(b64)
    let u8 = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
    return u8.buffer
}

//各疊加層以 layers 欄位帶識別字(raster/vector/style 不使用 layers, 僅 wms 用; 但它參與圖層 id 衍生, 使 e2e 可由 id 尾碼找到各層)
let raster = (token, ext) => ({ name: token, layers: token, url: `${PROTOCOL}://${token}/{z}/{x}/{y}`, colorShade: '', visible: false, ...ext })
let vector = (token, layerType, ext) => ({ name: token, layers: token, type: 'vector', url: VEC_TILEJSON, layer: 'building', layerType, colorShade: '', visible: false, ...ext })

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            'opt': {
                center: [0, 121.0],
                zoom: 10,
                projection: 'mercator',
                panelLabels: { show: false },
                panelBaseMaps: {
                    show: true,
                    position: 'topleft',
                    terrainMap: {}, //不套用地形
                    baseMaps: [
                        raster('ovRasterDef', {}), //未給 opacity: raster 預設 1
                        { name: 'ovWms', layers: 'ovWms', type: 'wms', url: `${PROTOCOL}://ovWms/wms?`, colorShade: '', visible: false }, //未給 opacity: wms 預設 1(圖層 id 尾碼取 LAYERS 參數)
                        vector('ovVecFill', 'fill', {}), //未給 opacity: vector 預設 0.8
                        vector('ovVecLine', 'line', {}),
                        vector('ovVecExt', 'fill-extrusion', {}),
                        vector('ovVecFill05', 'fill', { opacity: 0.5 }), //明給 0.5
                        raster('ovRasterStr', { opacity: '0.5' }), //數字字串 → 0.5
                        raster('ovRasterOver', { opacity: 1.5 }), //超界 → 夾 1
                        raster('ovRasterNeg', { opacity: -0.2 }), //超界 → 夾 0
                        raster('ovRasterNaN', { opacity: NaN }), //非數值 → 未給(raster 預設 1)
                        { name: 'ovStyle', layers: 'ovStyle', type: 'style', url: STYLE_URL, colorShade: '', visible: false }, //style 型別: 不支援整組透明度, 面板不顯示滑桿
                    ],
                },
            },
        }
    },
    created: function() {
        //須早於地圖建立(子元件 mounted 時建圖): 圖磚請求一律由頁內協定回應, 永不連外
        maplibregl.addProtocol(PROTOCOL, async () => {
            return { data: b64ToArrayBuffer(PNG_B64) }
        })
    },
    mounted: function() {
        let vo = this
        //e2e 觀察用(僅讀, 不改功能): 地圖 style 快照與公開 API getMapObject()
        window.__getMapStyle = () => {
            let m = vo.$refs.wm.getMapObject()
            return m ? m.getStyle() : null
        }
        window.__getMap = () => vo.$refs.wm.getMapObject()
    },
    beforeDestroy: function() {
        maplibregl.removeProtocol(PROTOCOL)
        delete window.__getMapStyle
        delete window.__getMap
    },
}
</script>

<style>
</style>
