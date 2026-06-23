<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">baseMap.colorFillExtrusion</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPBMColorFillExtrusion.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPBMColorFillExtrusion.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem;">
                建物統一色 <b>colorFillExtrusion</b>：
                <button v-for="c in colors" :key="String(c.val)" @click="setColor(c.val)" :style="btnStyle(c.val)">{{ c.label }}</button>
                <span style="color:#777; padding-left:8px;">目前：{{ color || '資料原色(coalesce colour)' }}　·　按住右鍵拖曳可傾斜看 3D 立體建物（換色不會重設視角）</span>
            </div>

            <div style="position:relative;">
                <WMaplibreglVue
                    style="width:900px; height:560px;"
                    :opt="opt"
                ></WMaplibreglVue>
            </div>

        </div>

    </div>
</template>

<script>
import WMaplibreglVue from './components/WMaplibreglVue.vue'

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            color: '#ff7d32',
            colors: [
                { label: '資料原色', val: null },
                { label: '灰', val: '#aaaaaa' },
                { label: '橘', val: '#ff7d32' },
                { label: '藍', val: '#4347de' },
                { label: '綠', val: '#2db84a' },
            ],
            //opt 為穩定 data 物件(非 computed): 換色只就地改建物 entry 的 colorFillExtrusion,
            //不重建 opt → 不覆寫 center/zoom(元件會於 moveend/zoomend 將使用者實際視角寫回 opt.center/zoom)
            opt: {
                center: [25.0336, 121.5645], //台北信義區(台北101周邊, 建物密集)
                zoom: 16,
                panelBaseMaps: {
                    baseMaps: [
                        { name: 'OSM', url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', colorShade: 'light', opacity: 1, visible: true },
                        {
                            name: '3D建物(OpenFreeMap)',
                            type: 'vector',
                            url: '//tiles.openfreemap.org/planet',
                            layer: 'building',
                            layerType: 'fill-extrusion',
                            colorShade: '', //空字串=疊加層(overlay)
                            opacity: 0.9,
                            visible: true,
                            colorFillExtrusion: '#ff7d32', //不傳則回退資料 colour 屬性
                        },
                    ],
                },
            },
        }
    },
    methods: {
        setColor: function(c) {
            let vo = this
            vo.color = c
            let b = vo.opt.panelBaseMaps.baseMaps[1] //建物 entry
            if (c) vo.$set(b, 'colorFillExtrusion', c)
            else vo.$delete(b, 'colorFillExtrusion') //資料原色: 移除欄位回退 coalesce colour
        },
        btnStyle: function(c) {
            let active = this.color === c
            return {
                margin: '0 3px',
                padding: '3px 10px',
                cursor: 'pointer',
                borderRadius: '4px',
                border: active ? '2px solid #f26' : '1px solid #ccc',
                background: active ? '#fff0f4' : '#fff',
            }
        },
    },
}
</script>

<style>
</style>
