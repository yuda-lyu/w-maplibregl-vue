<template>
    <div class="bkp">

        <div style="padding-bottom:10px; font-size:0.85rem; color:#777;">
            baseMaps[i].maxzoom 驗證頁(e2e 用): 兩個疊加層之圖磚皆以頁內自訂協定 e2ezlim:// 供應(免網路), 只提供 0~18 級、19 級以上回失敗, 模擬層級有上限之圖磚服務。地圖位於 18 級時 256px 圖磚會請求 19 級: 帶 maxzoom:18 之紅色疊加層改以 18 級圖磚放大顯示; 未給 maxzoom 之藍色疊加層請求不存在之層級而空白並報錯, 可按下方按鈕於執行期補上 maxzoom。
        </div>

        <div style="padding-bottom:10px;">
            <button id="btnSetMaxzoom" style="cursor:pointer; padding:4px 10px;" @click="setMaxzoom">runtime 變更: 為藍色疊加層設 maxzoom 18</button>
            <span style="margin-left:8px; font-size:0.85rem; color:#a3c;">19 級以上圖磚請求次數 紅: <span id="overRed">{{ over.red }}</span>, 藍: <span id="overBlue">{{ over.blue }}</span></span>
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

//1x1 純色 PNG(與 AppBSCRuntimeSync 同源之 data-URI 內容, 程式化產生並經解碼回驗)
const PNG_B64 = {
    red: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4o6HxHwAFPAIs0Zo91QAAAABJRU5ErkJggg==', //[220,40,40]
    blue: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPQcHv2HwAEQgJU1FeLxgAAAABJRU5ErkJggg==', //[40,70,230]
}
const MAX_TILE_ZOOM = 18 //模擬服務之最大圖磚層級
const PROTOCOL = 'e2ezlim'

function b64ToArrayBuffer(b64) {
    let s = atob(b64)
    let u8 = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
    return u8.buffer
}

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            'over': { red: 0, blue: 0 }, //19 級以上(服務沒有之層級)之請求次數, 顯示於頁面供觀察
            'opt': {
                center: [25.06, 121.5153],
                zoom: 18, //元件允許之最大顯示層級; 256px 圖磚於此請求 19 級
                projection: 'mercator',
                panelBaseMaps: {
                    show: true,
                    position: 'topleft',
                    terrainMap: {}, //不套用地形(離線決定性; 無地形時未給 maxzoom 之空白才可見於畫面)
                    baseMaps: [
                        { name: '紅 maxzoom:18', url: `${PROTOCOL}://red/{z}/{x}/{y}`, colorShade: '', visible: false, opacity: 1, maxzoom: MAX_TILE_ZOOM },
                        { name: '藍 未給maxzoom', url: `${PROTOCOL}://blue/{z}/{x}/{y}`, colorShade: '', visible: false, opacity: 1 },
                    ],
                },
            },
        }
    },
    created: function() {
        let vo = this
        //須早於地圖建立(子元件 mounted 時建圖): 圖磚請求一律由頁內協定回應, 永不連外
        maplibregl.addProtocol(PROTOCOL, async (params) => {
            let m = String(params.url).match(/^e2ezlim:\/\/(red|blue)\/(\d+)\/\d+\/\d+$/)
            if (!m) throw new Error(`${PROTOCOL}: 無法解析之網址 ${params.url}`)
            let color = m[1]
            let z = Number(m[2])
            if (z > MAX_TILE_ZOOM) {
                vo.over[color]++
                throw new Error(`${PROTOCOL}: ${color} 圖磚服務只提供至 ${MAX_TILE_ZOOM} 級, 不存在 ${z} 級`)
            }
            return { data: b64ToArrayBuffer(PNG_B64[color]) }
        })
    },
    mounted: function() {
        let vo = this
        //e2e 補強斷言用: 曝露地圖 style 快照(僅供測試讀取 source 設定, 不影響功能)
        window.__getMapStyle = () => {
            let m = vo.$refs.wm.getMapObject()
            return m ? m.getStyle() : null
        }
    },
    beforeDestroy: function() {
        maplibregl.removeProtocol(PROTOCOL)
    },
    methods: {
        //執行期為藍色疊加層補上 maxzoom(新增鍵須 $set 才觸發 deep watcher): 應走結構性重建而即時生效
        setMaxzoom: function() {
            this.$set(this.opt.panelBaseMaps.baseMaps[1], 'maxzoom', MAX_TILE_ZOOM)
        },
    },
}
</script>

<style>
</style>
