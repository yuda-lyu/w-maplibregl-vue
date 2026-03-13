<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">pointSet.largeSet</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPNTPointSetLargeSet.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPNTPointSetLargeSet.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative;">
                    <WMaplibreglVue
                        style="width:800px; height:500px;"
                        :opt="opt"
                    >
                        <template v-slot:point-popup="props">
                            <div style="width:300px;">

                                <div style="padding:15px;">
                                    <div style="_white-space:nowrap; padding-bottom:5px;">
                                        <div style="font-size:0.90rem; color:#f26;">[PointSet: {{ props.pointSet.title }}]</div>
                                        <div style="font-size:0.70rem; color:#777;">{{ props.pointSet.msg }}</div>
                                    </div>
                                    <div style="_white-space:nowrap;">
                                        <div style="font-size:0.80rem;color:#aa2df4;">[Point: {{ props.point.title }}]</div>
                                        <div style="font-size:0.70rem;color:#777;">{{ props.point.msg }}</div>
                                    </div>
                                </div>

                                <div style="padding:15px; border-top:1px solid #ddd;">

                                    <div style="color:#454bbc; font-size:0.9rem; white-space:nowrap;">
                                        {{ props.point.title }}
                                    </div>

                                    <div style="padding-top:2px;">

                                        <div style="display:inline-block; padding-right:7px;">
                                            <span style="color:#777; font-size:0.75rem;">目前:</span>
                                            <span style="color:#ef8f30; font-size:0.85rem;">{{ props.point.available_rent_bikes }}</span>
                                        </div>

                                        <div style="display:inline-block; padding-right:7px;">
                                            <span style="color:#777; font-size:0.75rem;">總共:</span>
                                            <span style="color:#ef8f30; font-size:0.85rem;">{{ props.point.Quantity }}</span>
                                        </div>

                                    </div>

                                    <div style="padding-top:0px;">
                                        <span style="color:#777; font-size:0.75rem;">地址: </span>
                                        <span style="color:#777; font-size:0.75rem;">{{ props.point.msg }}</span>
                                    </div>

                                </div>

                            </div>
                        </template>
                    </WMaplibreglVue>
                </div>

                <div style="width:600px; min-width:600px; padding:0px 20px;">

                    <div style="border:1px solid #ddd;">
                        <div style="padding-left:5px; overflow-y:auto; height:500px;">
                            <div id="optjson" style="font-size:10pt;"></div>
                        </div>
                    </div>

                </div>

            </div>

        </div>

    </div>
</template>

<script>
import WMaplibreglVue from './components/WMaplibreglVue.vue'
import jv from 'w-jsonview-tree'

export default {
    components: {
        WMaplibreglVue,
    },
    data: function() {
        return {
            'opt': {
                center: [25.087, 121.54],
                zoom: 10,
                clusterPoints: true,
                clusterPointsRadius: 50, // px
                clusterPointsMaxZoom: 14, // 此 zoom 以上不叢集
                clusterPointsLevelNum: 3, // 叢集化：分幾種區間
                clusterPointsLevelValues: [10, 100], // 叢集化：區間分隔數值（長度 = levelNum - 1）
                clusterPointsLevelRadius: [10, 15, 20], // 叢集化：各 level 叢集圓圈大小
                clusterPointsLevelFillColors: ['rgba(140, 40, 25, 0.75)', 'rgba(255, 125, 50, 0.75)', 'rgba(255, 50, 100, 0.75)'], // 叢集化：各 level fill 顏色
                clusterPointsLevelLineColors: ['#fff', '#fff', '#fff'], // 叢集化：各 level line 顏色
                clusterPointsLevelLineWidths: [2, 2, 2], // 叢集化：各 level line 寬度
                clusterPointsLevelTextSizes: [12, 12, 12], // 叢集化：叢集圓圈內文字大小
                clusterPointsLevelTextColors: ['#fff', '#fff', '#fff'], // 叢集化：叢集圓圈內文字顏色
                pointSets: [],
            },
            'action': [
            ],
        }
    },
    mounted: function() {
        let vo = this

        vo.showOptJson()

        let _ = window._

        fetch('https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json')
            .then(function (response) {
                return response.json()
            })
            .then(function (res) {
                console.log(res)

                let points = _.map(res, (v) => {
                    let p = {
                        title: v.sna,
                        msg: v.ar,
                        latLng: [v.latitude, v.longitude],
                        available_rent_bikes: v.available_rent_bikes, //可租借
                        available_return_bikes: v.available_return_bikes, //可歸還位置
                        Quantity: v.Quantity, //總共
                    }
                    return p
                })

                let pointSet = {
                    title: 'YouBike2.0',
                    msg: 'YouBike2.0臺北市公共自行車即時資訊',
                    points,
                    //orange
                    type: 'icon',
                    iconSrc: 'data:image/png;base64,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',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15], //icon上緣
                    tooltipAnchor: [0, 0], //icon中心
                    visible: true,
                }

                vo.opt.pointSets = [pointSet]

            })
            .catch(function(err) {
                console.log(err)
            })

    },
    watch: {
        opt: {
            handler: function() {
                let vo = this
                vo.showOptJson()
            },
            deep: true,
        },
    },
    methods: {
        showOptJson: function() {
            let vo = this
            jv(vo.opt, document.querySelector('#optjson'), { expanded: true })
        },
    },
}
</script>

<style>
</style>
