<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">popupResize</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPopupResize.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPopupResize.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem;">
                <label style="cursor:pointer; user-select:none;">
                    <input type="checkbox" v-model="opt.popupResize.resizable" />
                    popupResize.resizable（點地圖中央的點開啟 popup；開啟後滑鼠移到 popup 邊/角會顯示把手，可拖曳四邊/四角調整大小，放手保留、翻轉不重置）
                </label>
            </div>

            <div style="position:relative;">
                <WMaplibreglVue
                    style="width:800px; height:520px;"
                    :opt="opt"
                >
                    <template v-slot:point-popup="props">
                        <div style="width:100%; height:100%; box-sizing:border-box; padding:12px; overflow:auto;">
                            <div style="font-size:0.9rem; color:#f26;">[可調整大小 popup]</div>
                            <div style="font-size:0.8rem; color:#777;">{{ props.point.title }}</div>
                            <div style="font-size:0.75rem; color:#999; padding-top:6px;">把手平時隱藏，滑鼠移到 popup 邊/角才顯示。</div>
                        </div>
                    </template>
                </WMaplibreglVue>
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
            //opt 為穩定 data 物件; 勾選框直接 v-model 到 opt.popupResize.resizable(就地改, 不重建 opt → 不重設視角)
            opt: {
                center: [24.6508, 121.4717],
                zoom: 12,
                popupResize: { resizable: true, width: 320, height: 220 },
                pointSets: [{
                    title: 'Lakes',
                    msg: 'tears of the mountains',
                    size: 16,
                    points: [
                        { title: 'Ming Chi(明池)', msg: 'Yingshi Village, Datong Township, Yilan County, Taiwan', latLng: [24.6508143, 121.4716748] },
                    ],
                    visible: true,
                }],
            },
        }
    },
}
</script>

<style>
</style>
