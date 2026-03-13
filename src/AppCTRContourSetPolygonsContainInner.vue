<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">contourSet.polygonsContainInner</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppCTRContourSetPolygonsContainInner.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppCTRContourSetPolygonsContainInner.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative;">
                    <WMaplibreglVue
                        style="width:800px; height:500px;"
                        :opt="opt"
                    ></WMaplibreglVue>
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
        let polygonsContainInner = [ //此結構代表1個polygon
            [
                [24.28, 120.842], [24.494, 121.203], [24.314, 121.190], [24.232, 121.109], [24.249, 120.910],
            ],
            [
                [24.217, 120.851], [24.172, 121.242], [24.059, 121.333], [24.001, 121.055],
            ],
        ]
        // let polygonsContainInner = [ //此結構代表1個multiPolygon
        //     [
        //         [
        //             [24.28, 120.842], [24.494, 121.203], [24.314, 121.190], [24.232, 121.109], [24.249, 120.910],
        //         ],
        //     ],
        //     [
        //         [
        //             [24.217, 120.851], [24.172, 121.242], [24.059, 121.333], [24.001, 121.055],
        //         ],
        //     ],
        // ]
        return {
            'opt': {
                center: [24.4, 121.239],
                zoom: 8,
                contourSets: [
                    {
                        title: 'contourSet A',
                        msg: 'msg from contourSet A',
                        points: [
                            [24.325, 120.786, 4], [23.944, 120.968, 15], [24.884, 121.234, 20], [24.579, 121.345, 62], [24.664, 121.761, 35], [23.803, 121.397, 30],
                        ],
                        polygonsContainInner,
                        visible: true,
                        order: 1,
                    },
                ],
                polygonSets: [
                    {
                        title: 'inner-clip polygon',
                        latLngs: polygonsContainInner,
                        visible: false,
                        order: 2,
                    },
                ],
            },
            'action': [
            ],
        }
    },
    mounted: function() {
        let vo = this
        vo.showOptJson()
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
