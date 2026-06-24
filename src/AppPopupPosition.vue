<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">popupPosition</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPopupPosition.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPopupPosition.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem;">
                popupPosition：
                <button v-for="p in positions" :key="p" @click="setPos(p)" :style="btnStyle(p)">{{ p }}</button>
                <span style="color:#777; padding-left:8px;">選方向後自動於中央點開啟 popup；靠近地圖邊緣時會自動翻轉到相反方向</span>
            </div>

            <div style="position:relative;">
                <WMaplibreglVue
                    ref="map"
                    style="width:800px; height:520px;"
                    :opt="opt"
                >
                    <template v-slot:point-popup="props">
                        <div style="padding:12px; width:220px;">
                            <div style="font-size:0.9rem; color:#f26;">[popupPosition = {{ opt.popupPosition }}]</div>
                            <div style="font-size:0.8rem; color:#777;">{{ props.point.title }}</div>
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
            positions: ['top', 'bottom', 'left', 'right'],
            ptLatLng: [24.6508143, 121.4716748],
            //opt 為穩定 data 物件; 換方向只就地改 opt.popupPosition, 不重建 opt
            opt: {
                center: [24.6508, 121.4717],
                zoom: 12,
                popupPosition: 'top',
                pointSets: [{
                    title: 'Lakes',
                    size: 16,
                    points: [
                        { id: 'A', title: 'Ming Chi(明池)', msg: 'Yilan, Taiwan', latLng: [24.6508143, 121.4716748] },
                    ],
                    visible: true,
                }],
            },
        }
    },
    mounted: function() {
        let vo = this
        //初始開一次 popup
        vo.$nextTick(() => {
            setTimeout(() => vo.openPopup(), 600)
        })
    },
    methods: {
        openPopup: function() {
            let vo = this
            if (vo.$refs.map) {
                vo.$refs.map.popupPoint({ point: { id: 'A', latLng: vo.ptLatLng } })
            }
        },
        setPos: function(p) {
            let vo = this
            vo.opt.popupPosition = p //就地改, 觸發 changeOpt 更新 vo.popupPosition
            vo.$nextTick(() => {
                setTimeout(() => vo.openPopup(), 60) //待 changeOpt 套用後重開 popup, 觀察新方向
            })
        },
        btnStyle: function(p) {
            let active = this.opt.popupPosition === p
            return {
                margin: '0 3px',
                padding: '3px 12px',
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
