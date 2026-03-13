<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">contourSet.interp2</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppCTRContourSetInterp2.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppCTRContourSetInterp2.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative;">
                    <div>{{msg}}</div>
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
                center: [24.084, 121.068],
                zoom: 7,
                contourSets: [],
                pointSets: [],
            },
            'msg': '',
            'action': [
            ],
        }
    },
    mounted: function() {
        let vo = this
        // vo.showOptJson()
        vo.genContours()
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
        genContours: function() {
            let vo = this

            async function core() {

                //w-gis/interp2
                let interp2 = window['interp2']

                //ptsStation
                let ptsStation = window.dataRain
                console.log('ptsStation', ptsStation)

                //ptsClip
                let ptsClip = window.dataRainClip
                console.log('ptsClip', ptsClip)

                //ptsContour
                let ptsContour = []
                for (let i = 0; i < ptsStation.length; i++) {
                    let v = ptsStation[i]
                    //ptsContour.push([v.latLng[0], v.latLng[1], v.rain])
                    ptsContour.push({
                        x: v.latLng[0],
                        y: v.latLng[1],
                        z: v.rain,
                    })
                }
                console.log('ptsContour(ori)', JSON.parse(JSON.stringify(ptsContour)))

                //pis
                let pis = []
                //使用leaflet數據, leaflet是緯精度
                let xmin = 21.83
                let xmax = 25.30
                let ymin = 119.95
                let ymax = 122.04
                for (let x = xmin; x <= xmax; x += 0.025) {
                    for (let y = ymin; y <= ymax; y += 0.025) {
                        pis.push({ x, y })
                    }
                }
                console.log('pis(matrix)', JSON.parse(JSON.stringify(pis)))

                //剔除位於擴大台灣外框外之點, 但會造成後續計算contour時出錯, 故先取消
                // let pisTemp = []
                // for (let i = 0; i < pis.length; i++) {
                //     let p = [pis[i].x, pis[i].y] //isPointInPolygon須使用[x,y]座標陣列
                //     let b = wg.isPointInPolygon(p, ptsClip)
                //     if (b) {
                //         pisTemp.push(pis[i])
                //     }
                // }
                // pis = pisTemp
                // console.log('pis(in ptsClip)', JSON.parse(JSON.stringify(pis)))

                //interp2
                let interp2Opt = {
                    method: 'naturalNeighbor', //naturalNeighbor, kriging
                    scale: 1000000,
                }
                pis = await interp2(ptsContour, pis, interp2Opt)
                console.log('pis(interp2)', JSON.parse(JSON.stringify(pis)))

                //產生高密度計算contour用點陣列ptsContour
                ptsContour = pis.map((v) => {
                    return [v.x, v.y, v.z]
                })
                console.log('ptsContour(use)', ptsContour)

                //contourSets
                let contourSets = [
                    {
                        title: 'Rain contour',
                        msg: 'data from CWB',
                        points: ptsContour,
                        polygonClipOuter: ptsClip,
                        //放大後瀏覽時移動滑鼠於0-10會比較閃
                        // changeStyleWhenHover: false, //關閉hover的高亮效果
                        gradient: {
                            0: 'rgba(255, 255, 255, 0)', //將0-10區間改為全透明
                            0.2: 'rgb(254, 178, 76)',
                            0.4: 'rgb(252, 78, 42)',
                            0.6: 'rgb(220, 58, 38)',
                            0.8: 'rgb(200, 40, 23)',
                            1: 'rgb(180, 30, 60)',
                        },
                        visible: true,
                        order: 0,
                    },
                ]

                //pointSets
                let pointSets = [
                    {
                        title: 'Rain point',
                        msg: 'data from CWB',
                        points: ptsStation,
                        visible: false,
                        order: 1,
                    },
                ]

                return {
                    contourSets,
                    pointSets,
                }
            }

            //msg
            vo.msg = 'interp2: calculating contours...'

            //core
            core()
                .then((res) => {
                    vo.opt.contourSets = res.contourSets
                    vo.opt.pointSets = res.pointSets
                })
                .catch((err) => {
                    console.log(err)
                })
                .finally(() => {
                    vo.msg = ''
                })

        },
    },
}
</script>

<style>
</style>
