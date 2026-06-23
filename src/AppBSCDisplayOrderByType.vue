<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">displayOrderByType</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppBSCDisplayOrderByType.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppBSCDisplayOrderByType.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem;">
                <label style="cursor:pointer; user-select:none;">
                    <input id="chkOrder" type="checkbox" v-model="orderByType" />
                    displayOrderByType (開啟時點/線/面依面積堆疊、點在最上，點擊命中最上層型別；關閉則依插入順序、點擊回到原行為)
                </label>
            </div>

            <div style="position:relative;">
                <WMaplibreglVue
                    style="width:800px; height:500px;"
                    :opt="opt"
                >
                    <template v-slot:point-popup="props">
                        <div style="padding:12px; width:200px;">
                            <div style="font-size:0.9rem; color:#f26;">[Point popup]</div>
                            <div style="font-size:0.8rem; color:#777;">{{ props.point.title }}</div>
                        </div>
                    </template>
                    <template v-slot:polygon-popup="props">
                        <div style="padding:12px; width:200px;">
                            <div style="font-size:0.9rem; color:#4347de;">[Polygon popup]</div>
                            <div style="font-size:0.8rem; color:#777;">{{ props.polygonSet.title }}</div>
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
            orderByType: true,
            baseOpt: {
                center: [24.0, 121.0],
                zoom: 11,
                polygonSets: [
                    {
                        title: '覆蓋面 polygon',
                        msg: '面覆蓋住點所在區域',
                        latLngs: [[[23.85, 120.85], [23.85, 121.15], [24.15, 121.15], [24.15, 120.85]]],
                        fillColor: 'rgba(255,80,80,0.4)',
                        visible: true,
                    },
                ],
                pointSets: [
                    {
                        title: '上層點 pointSet',
                        msg: 'tears of the mountains',
                        size: 18,
                        points: [
                            { title: '位於面中央的點', msg: 'msg', latLng: [24.0, 121.0] },
                        ],
                        visible: true,
                    },
                ],
            },
        }
    },
    computed: {
        opt: function() {
            return { ...this.baseOpt, displayOrderByType: this.orderByType }
        },
    },
}
</script>

<style>
</style>
