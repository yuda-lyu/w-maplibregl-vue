<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">pointSet.iconSrc,iconSize,iconAnchor,popupAnchor,tooltipAnchor</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPNTPointSetIconSrcSizeAnchor.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPNTPointSetIconSrcSizeAnchor.html" target="_blank" class="item-link">code</a>
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
                pointSets: [
                    {
                        title: 'pointSet A',
                        msg: 'msg from pointSet A',
                        points: [
                            {
                                title: 'point A-1',
                                msg: 'msg from data A-1',
                                // latLng: [24.20, 121.27],
                                latLng: [24.6508143, 121.4716748],
                                // type: 'icon', //預設使用pointSet的type='icon'
                                // zIndexOffset: 100, //位於上方
                                // click: function click(msg) {
                                //     console.log('click', msg)
                                // },
                            },
                            {
                                title: 'point A-2',
                                msg: 'msg from data A-2',
                                latLng: [23.90, 120.97],
                                // type: 'icon', //預設使用pointSet的type='icon'
                                // zIndexOffset: 0, //位於下方
                                // click: function click(msg) {
                                //     console.log('click', msg)
                                // },
                            },
                        ],
                        //red
                        type: 'icon',
                        iconSrc: 'data:image/png;base64,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',
                        iconSize: [38, 95],
                        iconAnchor: [22, 94],
                        popupAnchor: [0, -86], //葉子上緣
                        tooltipAnchor: [0, -70], //葉子中心
                        visible: true,
                    },
                    {
                        title: 'pointSet B',
                        msg: 'msg from pointSet B',
                        points: [
                            {
                                title: 'point B-1',
                                msg: 'msg from data B-1',
                                latLng: [23.30, 120.57],
                                // type: 'circle', //預設使用pointSet的type='circle'
                            },
                            {
                                title: 'point B-2',
                                msg: 'msg from data B-2',
                                latLng: [23.00, 120.87],
                                // type: 'circle', //預設使用pointSet的type='circle'
                            },
                        ],
                        type: 'circle',
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
