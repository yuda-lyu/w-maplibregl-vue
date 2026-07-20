<template>
    <div class="bkp">

        <div style="padding-bottom:10px; font-size:0.85rem; color:#777;">
            runtime 同步行為驗證頁(e2e 用): 底圖全用 data-URI 色塊圖磚(免網路, 畫面決定性), 供驗證帶 key 影像重排堆疊、面板顯隱寫回 opt 響應性、底圖結構性更換之舊圖層清除、colorShade 省略之面板分類、赤道緯度比例尺、vector line 底圖初始透明度。
        </div>

        <div style="padding-bottom:10px;">
            <button id="btnSwapImages" style="cursor:pointer; padding:4px 10px;" @click="swapImages">runtime 變更: 交換兩張帶 key 影像的陣列順序</button>
            <button id="btnResetBasemaps" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="resetBasemaps">runtime 變更: 整組更換底圖清單(僅剩透明 blank)</button>
            <button id="btnClearImageUrl" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="clearImageUrl">runtime 變更: 清空第二張影像 url</button>
            <span style="margin-left:8px; font-size:0.85rem; color:#a3c;">polygon R visible on opt: <span id="pgVisLog">{{ String(opt.polygonSets[0].visible) }}</span></span>
        </div>
        <div style="padding-bottom:10px;">
            <button id="btnShiftPoints" style="cursor:pointer; padding:4px 10px;" @click="shiftPoints">runtime 變更: 頭部插入一組 pointSet(索引位移)</button>
            <button id="btnIconSlow" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="setIconSlow">runtime 變更: 換 icon 為 slow 圖</button>
            <button id="btnIconFast" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="setIconFast">runtime 變更: 換 icon 為 fast 圖</button>
            <button id="btnTerrainTune" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="tuneTerrain">runtime 變更: 調整地形參數(重套 terrain)</button>
            <button id="btnReorderBasemaps" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="reorderBasemaps">runtime 變更: 反轉底圖順序(增量路徑)</button>
            <button id="btnVFlipImages" style="cursor:pointer; padding:4px 10px; margin-left:8px;" @click="setVFlipImages">runtime 變更: 換為上綠下藍雙色影像(左合規慣例/右像素慣例)</button>
        </div>

        <div style="position:relative;">
            <WMaplibreglVue
                ref="wm"
                style="width:800px; height:500px;"
                :opt="opt"
            >
                <template v-slot:point-popup="props">
                    <div style="width:200px; height:170px; padding:0; box-sizing:border-box; overflow:hidden;">
                        <div style="font-size:0.9rem; color:#f26;">[Point popup]</div>
                        <div style="font-size:0.8rem; color:#777;">{{ props.point.title }}</div>
                    </div>
                </template>
            </WMaplibreglVue>
        </div>

    </div>
</template>

<script>
import WMaplibreglVue from './components/WMaplibreglVue.vue'

//1x1 純色 PNG(程式化產生並經解碼回驗之 data-URI): 圖磚與影像疊圖皆免網路, e2e 畫面決定性
const TILE_RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4o6HxHwAFPAIs0Zo91QAAAABJRU5ErkJggg==' //[220,40,40]
const TILE_TRANSPARENT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=' //[0,0,0,0]
const IMG_GREEN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPQ2GfzHwAEVgIiUE5/VAAAAABJRU5ErkJggg==' //[40,190,60]
const IMG_BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPQcHv2HwAEQgJU1FeLxgAAAABJRU5ErkJggg==' //[40,70,230]
//1x2 雙色 PNG(程式化產生並經解碼回驗): 頂列綠[40,190,60] 底列藍[40,70,230]。
//上下不對稱才驗得出影像有無 Y 軸翻轉(純色圖翻轉後看不出差別)
const IMG_GREEN_TOP_BLUE_BOTTOM = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAIAAAAW4yFwAAAAEElEQVR4nGPQ2GfDoOH2DAAIqgJ3NmETdAAAAABJRU5ErkJggg=='
//vector 底圖之 TileJSON 走 data: URI(本體可成功載入不阻塞 map load);
//bounds 指向視野外極小區域 → 視圖內零圖磚請求(避免圖磚請求失敗之逐層 fallback 使 source 長期 loading, 阻塞 map idle)
const VEC_TILEJSON = 'data:application/json,' + encodeURIComponent(JSON.stringify({ tilejson: '2.2.0', tiles: ['http://127.0.0.1:8123/nope/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, bounds: [-10, -10, -9.99, -9.99] }))

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            'opt': {
                center: [0, 121.0], //赤道中心: 供驗證比例尺以緯度 0(有效值)計算
                zoom: 10,
                projection: 'mercator', //固定投影, 使畫面座標可由 web mercator 公式直接推算(e2e 換算滑鼠座標用)
                panelLabels: { show: false }, //減少角落面板佔位, 避免遮擋像素取樣區
                panelItems: { show: true, position: 'topright' }, //顯示圖層顯隱面板: 驗證 checkbox 顯隱寫回 opt
                panelBaseMaps: {
                    show: true,
                    position: 'topleft',
                    //本地平坦 DEM(高程 0, 同 url 亦作 hillshade 來源): 啟用 terrain+hillshade 圖層供疊序驗證,
                    //平坦地形無位移不影響座標換算, 且離線決定性(未給 terrainMap 時會套預設之遠端 DEM)
                    terrainMap: {
                        terrainSource: { url: '/e2e-dem.png', encoding: 'terrarium', tileSize: 256, maxzoom: 0 },
                        hillshadeSource: { url: '/e2e-dem.png', encoding: 'terrarium', tileSize: 256, maxzoom: 0 },
                    },
                    baseMaps: [
                        //底圖(radio): 紅色圖磚, 供驗證結構性更換後舊圖層須被清除
                        { name: 'base red', url: TILE_RED, colorShade: 'light', visible: true, opacity: 1 },
                        //刻意省略 colorShade: 依文件預設 '' 應歸類為疊加層(checkbox), 供驗證面板分類一致性
                        { name: 'noshade overlay', url: IMG_GREEN, visible: false },
                        //vector line 底圖: TileJSON 可載入但圖磚必然失敗(無視覺), 供驗證 style 內 layer 之 paint 設定值
                        { name: 'vec line', type: 'vector', url: VEC_TILEJSON, layer: 'ly', layerType: 'line', opacity: 0.3, colorShade: '', visible: true },
                    ],
                },
                imageSets: [
                    //兩張帶 key 的部分重疊影像: 陣列後者在上; 交換順序後重疊區應換另一張在上
                    { title: 'img green', key: 'imgG', image: { url: IMG_GREEN, lngMin: 121.02, lngMax: 121.08, latMin: -0.02, latMax: 0.02 }, visible: true },
                    { title: 'img blue', key: 'imgB', image: { url: IMG_BLUE, lngMin: 121.05, lngMax: 121.11, latMin: -0.02, latMax: 0.02 }, visible: true },
                ],
                polygonSets: [
                    //刻意不給 visible 欄位: 供驗證面板顯隱寫回 opt 時新增欄位之響應性($set 路徑)
                    { title: 'polygon R', msg: 'panel toggle target', latLngs: [[[-0.10, 121.04], [-0.10, 121.10], [-0.06, 121.10], [-0.06, 121.04]]], fillColor: 'rgba(240,200,40,1)' },
                ],
                pointSets: [
                    {
                        title: 'point A',
                        msg: 'keyed point set',
                        key: 'ptA', //穩定識別 key: 供驗證重排後 popup owner 仍能對上組身分
                        size: 10,
                        points: [
                            //p1: circle 點(供點擊開 popup → 重排 → 面板隱藏之 owner 驗證)
                            { title: 'point-owner', msg: 'popup owner target', latLng: [0.02, 120.90] },
                            //p2: 預設 icon 點, 靠近畫布上緣(預設 popupAnchor 為 -iconHeight, 供翻轉判斷含 anchorOffset 驗證)
                            { title: 'point-topedge', msg: 'flip target', latLng: [0.0412, 120.95], type: 'icon' },
                            //p3: 自訂 icon 點(iconSrc 可 runtime 更換, 供「舊載入晚到不得覆寫新圖」競態驗證)
                            { title: 'point-iconswap', msg: 'icon race target', latLng: [-0.05, 120.88], type: 'icon', iconSrc: '/e2e-icon-init.png', iconSize: [24, 24], iconAnchor: [12, 12] },
                        ],
                        visible: true,
                    },
                ],
            },
        }
    },
    mounted: function() {
        let vo = this
        //e2e 補強斷言用: 曝露地圖 style 快照(僅供測試讀取圖層順序/paint, 不影響功能)
        window.__getMapStyle = () => {
            let m = vo.$refs.wm.getMapObject()
            return m ? m.getStyle() : null
        }
    },
    methods: {
        //交換兩張帶 key 影像的陣列順序(reverse 為 Vue 2 攔截之變異方法, 觸發 deep watcher)
        swapImages: function() {
            this.opt.imageSets.reverse()
        },
        //整組更換底圖清單(結構性變更): 僅剩一張透明 blank, 原紅底圖層應被清除使畫面回到背景色
        resetBasemaps: function() {
            this.opt.panelBaseMaps.baseMaps = [
                { name: 'blank', url: TILE_TRANSPARENT, colorShade: 'light', visible: true, opacity: 1 },
            ]
        },
        //清空第二張影像(img blue)的 url: 資料已無效, 地圖上不應殘留舊影像
        clearImageUrl: function() {
            this.opt.imageSets[1].image.url = ''
        },
        //於陣列頭部插入一組無 key 的 pointSet(索引位移): 供驗證重排後既開 popup 之 owner 對應
        shiftPoints: function() {
            this.opt.pointSets.unshift({
                title: 'point head',
                msg: 'inserted at head',
                points: [
                    { title: 'point-head', msg: 'head point', latLng: [0.08, 120.80] },
                ],
                visible: true,
            })
        },
        //runtime 更換 p3 的 iconSrc: slow 圖由測試端攔截延遲回應, fast 圖即時回應,
        //供驗證「較舊載入完成較晚時, 不得覆寫最新設定的圖示」
        setIconSlow: function() {
            this.$set(this.opt.pointSets[this.opt.pointSets.length - 1].points[2], 'iconSrc', '/e2e-icon-slow.png')
        },
        setIconFast: function() {
            this.$set(this.opt.pointSets[this.opt.pointSets.length - 1].points[2], 'iconSrc', '/e2e-icon-fast.png')
        },
        //調整地形參數(terrainChanged 路徑): 供驗證 runtime 重套 terrain 後 hillshade 之疊序
        tuneTerrain: function() {
            this.$set(this.opt.panelBaseMaps.terrainMap, 'exaggeration', 2)
        },
        //反轉底圖清單順序(同 key 集合之非結構性變更, 走增量路徑): 供驗證 hillshade 與疊加層之疊序
        reorderBasemaps: function() {
            this.opt.panelBaseMaps.baseMaps.reverse()
        },
        //換為上綠下藍雙色影像, 兩張分別以兩種四至慣例宣告(左右並排不重疊):
        //  imgOK  合規慣例 latMin(-0.02, 南) < latMax(0.02, 北)
        //  imgPix 像素慣例 latMin(0.02, 北) > latMax(-0.02, 南) — 呼叫端以像素列填, latMin 存頂列緯度
        //兩張都應綠在北、藍在南(四至依實際數值定南北, 不依欄位命名方向)
        setVFlipImages: function() {
            this.opt.imageSets = [
                { title: 'img ok', key: 'imgOK', image: { url: IMG_GREEN_TOP_BLUE_BOTTOM, lngMin: 121.02, lngMax: 121.06, latMin: -0.02, latMax: 0.02 }, visible: true },
                { title: 'img pixel', key: 'imgPix', image: { url: IMG_GREEN_TOP_BLUE_BOTTOM, lngMin: 121.07, lngMax: 121.11, latMin: 0.02, latMax: -0.02 }, visible: true },
            ]
        },
    },
}
</script>

<style>
</style>
