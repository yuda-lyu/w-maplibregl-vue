<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">function-panTo</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppFunPanTo.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppFunPanTo.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div>
                <button style="margin:0px 3px 3px 0px;" @click="panTo()">panTo()</button>
                <button style="margin:0px 3px 3px 0px;" @click="panToSX()">panTo(shift x)</button>
                <button style="margin:0px 3px 3px 0px;" @click="panToSXY()">panTo(shift x,shift y)</button>
                <button style="margin:0px 3px 3px 0px;" @click="panToSXYFun()">panTo(shift x,shift y,funLatLng)</button>
            </div>

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative;">

                    <div style="position:relative; width:800px; height:500px;">

                        <WMaplibreglVue
                            ref="wlf"
                            style="width:800px; height:500px;"
                            :opt="opt"
                        ></WMaplibreglVue>

                        <div style="position:absolute; left:5px; top:5px; z-index:1000; width:190px; height:490px; background:rgba(255,255,255,0.3);">
                            <div style="padding:10px; color:#fff;">
                                Menu area
                            </div>
                        </div>

                    </div>

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
                panelBaseMaps: {
                    show: false,
                },
                panelZoom: {
                    position: 'bottomright',
                },
                panelItems: {
                    position: 'bottomright',
                },
                pointSets: [
                    {
                        title: 'Lakes',
                        msg: 'tears of the mountains',
                        points: [
                            {
                                title: 'Ming Chi(明池)',
                                msg: 'Yingshi Village, Datong Township, Yilan County, Taiwan(台灣宜蘭縣大同鄉英士村)',
                                latLng: [24.6508143, 121.4716748],
                            },
                        ],
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
        panTo: function() {
            let vo = this

            //latLng
            let latLng = [24.6508143, 121.4716748]

            //panTo
            vo.$refs.wlf.panTo(latLng)

        },
        panToSX: function() {
            let vo = this

            //latLng
            let latLng = [24.6508143, 121.4716748]

            //opt
            let opt = {
                ratioHorizontal: 200 / 800,
                ratioVertical: 0,
            }

            //panTo
            vo.$refs.wlf.panTo(latLng, opt)

        },
        panToSXY: function() {
            let vo = this

            //latLng
            let latLng = [24.6508143, 121.4716748]

            //opt
            let opt = {
                ratioHorizontal: 200 / 800,
                ratioVertical: 0.5,
            }

            //panTo
            vo.$refs.wlf.panTo(latLng, opt)

        },
        panToSXYFun: function() {
            let vo = this

            //latLng
            let latLng = [24.6508143, 121.4716748]

            //opt
            let opt = {
                ratioHorizontal: 200 / 800,
                ratioVertical: 0.5,
                funLatLng: function(latLng, params) {
                    console.log('funLatLng', latLng, params)
                    return params.latLngNew
                },
            }

            //panTo
            vo.$refs.wlf.panTo(latLng, opt)

        },
    },
}
</script>

<style>
</style>
