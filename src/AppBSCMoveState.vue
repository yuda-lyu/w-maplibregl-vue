<template>
    <div class="bkp">

        <div>

            <div style="padding-bottom:10px; font-size:0.85rem; color:#777;">
                圖台移動狀態驗證頁(e2e 用): 元件根節點提供唯讀屬性 <b>state</b>，<b>moving</b> 為移動中(初次載入至首次 idle、自 maplibre movestart 起至 idle 止，含 panTo/easeTo/flyTo/滾輪縮放/投影切換)，<b>idle</b> 為靜止(相機停止且圖磚載入與繪製完成)；使用端與 e2e 等候根節點 [state="idle"] 即可，免輪詢數值或固定等待。底圖為頁內自訂協定e2ems://供應之單色圖磚(免網路)。
            </div>

            <div style="padding-bottom:6px;">
                <span style="color:#a3c; font-size:0.85rem;">
                    根節點 state: <b id="rootState">{{ rootState }}</b>,
                    zoom: <span id="mapZoom">{{ fmt(mapZoom, 4) }}</span>,
                    center: <span id="mapCenter">{{ mapCenter }}</span>,
                    projection: <span id="optProj">{{ String(opt.projection) }}</span>
                </span>
            </div>

            <div style="padding-bottom:6px;">
                <button id="btnPanTo" style="cursor:pointer; padding:4px 10px;" @click="doPanTo">元件方法 panTo([25.66,122.1])</button>
                <button id="btnCenterTo" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doCenterTo">元件方法 centerTo([23.2,120.5])</button>
                <button id="btnEaseTo" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doEaseTo">API easeTo(zoom+1.5)</button>
                <button id="btnFlyTo" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doFlyTo">API flyTo(center+zoom)</button>
                <button id="btnZoomTo" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doZoomTo">API zoomTo(12)</button>
                <button id="btnJumpTo" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doJumpTo">API jumpTo(zoom 10)</button>
                <button id="btnLongEase" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doLongEase">API easeTo(5秒長動畫)</button>
                <button id="btnApiMercator" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="doApiMercator">API setProjection(mercator)</button>
            </div>
            <div style="padding-bottom:6px;">
                <button id="btnZoom7" style="cursor:pointer; padding:4px 10px;" @click="opt.zoom = 7">opt.zoom=7</button>
                <button id="btnZoom22" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="opt.zoom = 22">opt.zoom=22(上限)</button>
                <button id="btnOptCenter" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="opt.center = [23.5, 120.9]">opt.center=[23.5,120.9]</button>
                <button id="btnMercator" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="opt.projection = 'mercator'">opt.projection=mercator</button>
                <button id="btnGlobe" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="opt.projection = 'globe'">opt.projection=globe</button>
                <button id="btnAuto" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="opt.projection = ''">opt.projection=''(自動)</button>
                <button id="btnTall" style="cursor:pointer; padding:4px 10px; margin-left:6px;" @click="boxHeight = 400">容器高400px(resize)</button>
            </div>

            <div style="position:relative;">
                <WMaplibreglVue
                    v-if="show"
                    ref="wm"
                    :style="{ width: '800px', height: boxHeight + 'px' }"
                    :opt="opt"
                ></WMaplibreglVue>
            </div>

        </div>

    </div>
</template>

<script>
import * as maplibregl from 'maplibre-gl' //maplibre-gl 6.x 為 ESM-only 且無 default export, 須以 namespace 匯入
import WMaplibreglVue from './components/WMaplibreglVue.vue'

//1x1 純色 PNG(與 AppBSCZoomRange 同源), 各層級同圖
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4o6HxHwAFPAIs0Zo91QAAAABJRU5ErkJggg=='
const PROTOCOL = 'e2ems'

function b64ToArrayBuffer(b64) {
    let s = atob(b64)
    let u8 = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
    return u8.buffer
}

//opt 為穩定 data 物件: 須預先宣告 zoom/center/projection(Vue 2 響應式; 元件會把地圖實際值寫回 zoom/center)
function genOpt() {
    return {
        center: [25.06, 121.5153],
        zoom: 7,
        projection: '', //''=自動(層級<=8 用 globe, 以上 mercator)
        panelLabels: { show: false },
        panelBaseMaps: {
            show: false,
            terrainMap: {},
            baseMaps: [
                { name: 'e2ems', url: `${PROTOCOL}://t/{z}/{x}/{y}`, colorShade: 'light', visible: true, opacity: 1 },
            ],
        },
    }
}

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            show: true,
            boxHeight: 500,
            opt: genOpt(),
            rootState: '', //根節點 state 屬性之即時值(以 MutationObserver 讀取, 示範使用端偵測方式)
            mapZoom: 0,
            mapCenter: '',
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
        //e2e 觀察用(僅讀, 不改功能): 公開 API getMapObject()、元件根節點
        window.__getMap = () => (vo.$refs.wm ? vo.$refs.wm.getMapObject() : null)
        window.__getRoot = () => (vo.$refs.wm ? vo.$refs.wm.$el : null)
        //根節點 state 屬性變化記錄: [{ t: performance.now(), state, loading, loaded, moving }], 含掛載當下之初始值(loading 為 loading 屬性值、無此屬性為 null;
        //loaded/moving 為記錄當下 map.loaded()/map.isMoving()); 同時顯示於頁面(#rootState)
        window.__stateLog = []
        let root = vo.$refs.wm.$el
        let rec = () => {
            let s = root.getAttribute('state')
            vo.rootState = String(s)
            let m = window.__getMap()
            let loaded = null
            let moving = null
            if (m) {
                let c = m.getCenter()
                vo.mapZoom = m.getZoom(); vo.mapCenter = c.lat.toFixed(4) + ',' + c.lng.toFixed(4)
                loaded = m.loaded(); moving = m.isMoving()
            }
            window.__stateLog.push({ t: performance.now(), state: s, loading: root.getAttribute('loading'), loaded, moving })
        }
        vo.obs = new MutationObserver(rec)
        vo.obs.observe(root, { attributes: true, attributeFilter: ['state'] })
        rec()
    },
    beforeDestroy: function() {
        maplibregl.removeProtocol(PROTOCOL)
        if (this.obs) this.obs.disconnect()
        delete window.__getMap
        delete window.__getRoot
        delete window.__stateLog
    },
    methods: {
        fmt: function(v, n) {
            let x = Number(v)
            return Number.isFinite(x) ? String(Math.round(x * Math.pow(10, n)) / Math.pow(10, n)) : String(v)
        },
        //元件公開方法(依 [lat,lng] 平移, 約 500ms 動畫)
        doPanTo: function() {
            this.$refs.wm.panTo([25.66, 122.1])
        },
        doCenterTo: function() {
            this.$refs.wm.centerTo([23.2, 120.5])
        },
        //公開 API getMapObject() 取得 map 後操作
        doEaseTo: function() {
            let m = this.$refs.wm.getMapObject()
            m.easeTo({ zoom: m.getZoom() + 1.5 })
        },
        doFlyTo: function() {
            this.$refs.wm.getMapObject().flyTo({ center: [121, 23.5], zoom: 9 })
        },
        doZoomTo: function() {
            this.$refs.wm.getMapObject().zoomTo(12)
        },
        doJumpTo: function() {
            this.$refs.wm.getMapObject().jumpTo({ zoom: 10 })
        },
        //長於逾時後備(3000ms)之動畫: 驗證逾時當下仍在移動則續等, state 全程為 moving
        doLongEase: function() {
            this.$refs.wm.getMapObject().easeTo({ center: [121.0, 23.5], zoom: 9, duration: 5000 })
        },
        //使用端直接經 maplibre 公開 API 切換投影(不經 opt.projection)
        doApiMercator: function() {
            this.$refs.wm.getMapObject().setProjection({ type: 'mercator' })
        },
    },
}
</script>

<style>
</style>
