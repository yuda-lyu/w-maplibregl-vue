<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">polygonSetsClick</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPGNPolygonSetsClick.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPGNPolygonSetsClick.html" target="_blank" class="item-link">code</a>
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
        return {
            'opt': {
                center: [25, 121.58],
                zoom: 9,
                polygonSetsClick: function(v) {
                    console.log('polygonSetsClick', v)
                },
                polygonSets: [
                    {
                        title: 'polygonSet A',
                        msg: 'msg from polygonSet A',
                        latLngs: [
                            [ //add p1
                                [24.96, 121.41], [25.11, 121.47], [25.06, 121.69], [24.99, 121.61], [24.95, 121.53]
                            ],
                            [ //c1 XOR p1
                                [24.98, 121.45], [25.07, 121.49], [25.06, 121.54], [25.00, 121.50]
                            ],
                            [ //add p1-1 in c1
                                [25.017, 121.48], [25.032, 121.49], [25.036, 121.50], [25.02, 121.502]
                            ],
                            [ //c2 XOR p1
                                [24.99, 121.54], [25.056, 121.56], [25.05, 121.61], [25.00, 121.59]
                            ],
                            [ //add p2
                                [24.92, 121.60], [25.045, 121.75], [24.99, 121.79], [24.93, 121.74],
                            ],
                            [ //c3 XOR p1, p2
                                [24.961, 121.523], [24.979, 121.551], [24.950, 121.674], [24.887, 121.606],
                            ],
                        ],
                        visible: true,
                    },
                    {
                        title: 'polygonSet B',
                        msg: 'msg from polygonSet B',
                        latLngs: [
                            [ //add p3
                                [24.971, 121.372], [24.976, 121.434], [24.937, 121.473], [24.918, 121.418]
                            ],
                            [ //add p4
                                [24.90, 121.14], [24.97, 121.09], [25.05, 121.177], [24.95, 121.32]
                            ],
                        ],
                        visible: false,
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
