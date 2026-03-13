<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">geojsonSetsClick</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppGJNGeojsonSetsClick.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppGJNGeojsonSetsClick.html" target="_blank" class="item-link">code</a>
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
                geojsonSetsClick: function(v) {
                    console.log('geojsonSetsClick', v)
                },
                geojsonSets: [
                    {
                        title: 'geojsonSet A',
                        msg: 'msg from geojsonSet A',
                        geojson: {
                            'type': 'FeatureCollection',
                            'features': [
                                {
                                    'type': 'Feature',
                                    'properties': {
                                        'style': {
                                            'color': 'rgba(255, 255, 255, 1)',
                                            'weight': 1,
                                            'fillColor': 'rgba(255, 50, 100, 1)',
                                            'fillOpacity': 0.2,
                                            'stroke': 'rgba(255, 255, 255, 1)',
                                            'stroke-width': 1,
                                            'stroke-opacity': 1,
                                            'fill': 'rgba(255, 255, 255, 1)',
                                            'fill-opacity': 0.2
                                        }
                                    },
                                    'geometry': {
                                        'type': 'MultiPolygon',
                                        'coordinates': [
                                            [
                                                [ //add p1
                                                    [121.41, 24.96],
                                                    [121.47, 25.11],
                                                    [121.69, 25.06],
                                                    [121.61, 24.99],
                                                    [121.53, 24.95]
                                                ],
                                                [ //c1 XOR p1
                                                    [121.45, 24.98],
                                                    [121.49, 25.07],
                                                    [121.54, 25.06],
                                                    [121.5, 25]
                                                ],
                                                [ //add p1-1 in c1
                                                    [121.48, 25.017],
                                                    [121.49, 25.032],
                                                    [121.5, 25.036],
                                                    [121.502, 25.02]
                                                ],
                                                [ //c2 XOR p1
                                                    [121.54, 24.99],
                                                    [121.56, 25.056],
                                                    [121.61, 25.05],
                                                    [121.59, 25]
                                                ],
                                                [ //add p2
                                                    [121.6, 24.92],
                                                    [121.75, 25.045],
                                                    [121.79, 24.99],
                                                    [121.74, 24.93]
                                                ],
                                                [ //c3 XOR p1, p2
                                                    [121.523, 24.961],
                                                    [121.551, 24.979],
                                                    [121.674, 24.95],
                                                    [121.606, 24.887]
                                                ],
                                            ]
                                        ]
                                    }
                                }
                            ]
                        },
                        keyStyle: 'properties.style',
                        visible: true,
                    },
                    {
                        title: 'geojsonSet B',
                        msg: 'msg from geojsonSet B',
                        geojson: {
                            'type': 'FeatureCollection',
                            'features': [
                                {
                                    'type': 'Feature',
                                    'properties': {
                                        'style': {
                                            'color': 'rgba(255, 255, 255, 1)',
                                            'weight': 1,
                                            'fillColor': 'rgba(50, 100, 255, 1)',
                                            'fillOpacity': 0.2,
                                            'stroke': 'rgba(255, 255, 255, 1)',
                                            'stroke-width': 1,
                                            'stroke-opacity': 1,
                                            'fill': 'rgba(255, 255, 255, 1)',
                                            'fill-opacity': 0.2
                                        }
                                    },
                                    'geometry': {
                                        'type': 'MultiPolygon',
                                        'coordinates': [
                                            [
                                                [[121.372, 24.971], [121.434, 24.976], [121.473, 24.937], [121.418, 24.918]], [[121.14, 24.90], [121.09, 24.97], [121.177, 25.05], [121.32, 24.95]]
                                            ]
                                        ]
                                    }
                                }
                            ]
                        },
                        keyStyle: 'properties.style',
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
