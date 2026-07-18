<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">hoverInteractions</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppBSCHoverInteractions.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppBSCHoverInteractions.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem; color:#777;">
                各型別互動圖徵集中一頁（點/icon點/點群聚/折線/多邊形/GeoJSON/等值線），滑入顯示 cursor pointer 與 tooltip，點擊點開啟 popup；等值線開啟 changeStyleWhenHover。
            </div>

            <div style="padding-bottom:10px;">
                <button id="btnMutate" style="cursor:pointer; padding:4px 10px;" @click="mutateRuntime">runtime 變更: 折線換紅色 + 隱藏多邊形</button>
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
                    <template v-slot:point-tooltip="props">
                        <div style="padding:10px; width:180px;">
                            <div style="font-size:0.85rem; color:#f26;">[Point tooltip]</div>
                            <div style="font-size:0.75rem; color:#777;">{{ props.point.title }}</div>
                        </div>
                    </template>
                    <template v-slot:polyline-tooltip="props">
                        <div style="padding:10px; width:180px;">
                            <div style="font-size:0.85rem; color:#26a;">[Polyline tooltip]</div>
                            <div style="font-size:0.75rem; color:#777;">{{ props.polylineSet.title }}</div>
                        </div>
                    </template>
                    <template v-slot:polygon-tooltip="props">
                        <div style="padding:10px; width:180px;">
                            <div style="font-size:0.85rem; color:#4347de;">[Polygon tooltip]</div>
                            <div style="font-size:0.75rem; color:#777;">{{ props.polygonSet.title }}</div>
                        </div>
                    </template>
                    <template v-slot:geojson-tooltip="props">
                        <div style="padding:10px; width:180px;">
                            <div style="font-size:0.85rem; color:#2a7;">[Geojson tooltip]</div>
                            <div style="font-size:0.75rem; color:#777;">{{ props.geojsonSet.title }}</div>
                        </div>
                    </template>
                    <template v-slot:contour-tooltip>
                        <div style="padding:10px; width:180px;">
                            <div style="font-size:0.85rem; color:#a52;">[Contour tooltip]</div>
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
            'opt': {
                center: [24.0, 121.0],
                zoom: 10,
                projection: 'mercator', //固定投影, 使畫面座標可由 web mercator 公式直接推算(e2e 換算滑鼠座標用)
                panelItems: { show: false }, //關閉圖層顯隱面板: 其 DOM 覆蓋畫布左側會攔截滑鼠事件, 遮住 hover 目標圖徵
                clusterPoints: true,
                pointSets: [
                    {
                        title: 'pointSet A',
                        msg: 'points for hover',
                        size: 18,
                        points: [
                            { title: 'point-circle', msg: 'circle point', latLng: [24.08, 120.88] },
                            { title: 'point-icon', msg: 'icon point', latLng: [24.08, 121.12], type: 'icon' },
                        ],
                        visible: true,
                    },
                    {
                        title: 'pointSet cluster',
                        msg: 'co-located points to form a cluster',
                        points: [
                            { title: 'cluster-1', msg: 'msg', latLng: [24.08, 121.00] },
                            { title: 'cluster-2', msg: 'msg', latLng: [24.08, 121.00] },
                            { title: 'cluster-3', msg: 'msg', latLng: [24.08, 121.00] },
                            { title: 'cluster-4', msg: 'msg', latLng: [24.08, 121.00] },
                            { title: 'cluster-5', msg: 'msg', latLng: [24.08, 121.00] },
                        ],
                        visible: true,
                    },
                ],
                polylineSets: [
                    {
                        title: 'polyline A',
                        msg: 'line for hover',
                        latLngs: [[23.92, 120.85], [23.92, 120.91]],
                        lineWidth: 16,
                        visible: true,
                    },
                ],
                polygonSets: [
                    {
                        title: 'polygon A',
                        msg: 'polygon for hover',
                        latLngs: [[[23.90, 120.98], [23.90, 121.02], [23.94, 121.02], [23.94, 120.98]]],
                        fillColor: 'rgba(80,120,255,0.5)',
                        visible: true,
                    },
                ],
                geojsonSets: [
                    {
                        title: 'geojson A',
                        msg: 'geojson polygon for hover',
                        geojson: {
                            type: 'FeatureCollection',
                            features: [
                                {
                                    type: 'Feature',
                                    properties: {},
                                    geometry: {
                                        type: 'Polygon',
                                        coordinates: [[[121.10, 23.90], [121.14, 23.90], [121.14, 23.94], [121.10, 23.94], [121.10, 23.90]]],
                                    },
                                },
                            ],
                        },
                        visible: true,
                    },
                ],
                contourSets: [
                    {
                        title: 'contour A',
                        msg: 'contour for hover',
                        points: [
                            [23.96, 121.14, 0], [23.96, 121.18, 0], [23.96, 121.22, 0],
                            [24.00, 121.14, 0], [24.00, 121.18, 50], [24.00, 121.22, 0],
                            [24.04, 121.14, 0], [24.04, 121.18, 0], [24.04, 121.22, 0],
                        ],
                        changeStyleWhenHover: true,
                        visible: true,
                    },
                ],
            },
        }
    },
    methods: {
        //runtime 變更展示: 折線改紅色(setData 路徑同步更新 paint), 直接改 opt 的 visible 隱藏多邊形
        //(欄位初始不存在, Vue 2 須用 $set 新增才能觸發 deep watcher)
        mutateRuntime: function() {
            this.$set(this.opt.polylineSets[0], 'lineColor', 'rgba(230,30,30,1)')
            this.$set(this.opt.polygonSets[0], 'visible', false)
        },
    },
}
</script>

<style>
</style>
