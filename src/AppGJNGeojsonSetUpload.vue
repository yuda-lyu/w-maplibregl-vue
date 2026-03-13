<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">geojsonSet-upload</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppGJNGeojsonSetUpload.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppGJNGeojsonSetUpload.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div>
                <button style="margin:0px 3px 3px 0px;" @click="uploadGeojson">upload geojson</button>
            </div>

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
                                                ]
                                            ]
                                        ]
                                    }
                                }
                            ]
                        },
                        keyStyle: 'properties.style',
                        visible: true,
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
        uploadGeojson: function() {
            let vo = this

            let _ = window._
            let w = window.wsemi

            w.domShowInputAndGetFilesU8Arrs({ kind: 'geojson' })
                .then(function(d) {

                    //get first file
                    let file = d[0]
                    // console.log('file', file)

                    //u8a
                    let u8a = file.u8a
                    // console.log('get u8a', Object.prototype.toString.call(u8a), u8a.length)

                    //j
                    let j = w.u8arr2str(u8a)
                    // console.log('j', j)

                    //geojson
                    let geojson = JSON.parse(j)
                    // console.log('geojson', geojson)

                    //geojsonSet
                    let geojsonSet = _.cloneDeep(vo.opt.geojsonSets[0])
                    geojsonSet.title = _.get(geojson, 'name', '')
                    geojsonSet.msg = _.get(file, 'name', '')
                    geojsonSet.geojson = geojson
                    console.log('geojsonSet', geojsonSet)

                    //save
                    vo.opt.geojsonSets = [geojsonSet]

                })
                .catch(function(err) {
                    console.log(err)
                })

        },
    },
}
</script>

<style>
</style>
