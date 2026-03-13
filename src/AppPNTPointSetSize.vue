<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">pointSet.size</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppPNTPointSetSize.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppPNTPointSetSize.html" target="_blank" class="item-link">code</a>
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
                        title: 'Lakes',
                        msg: 'tears of the mountains',
                        size: 6,
                        points: [
                            {
                                title: 'Ming Chi(明池)',
                                msg: 'Yingshi Village, Datong Township, Yilan County, Taiwan(台灣宜蘭縣大同鄉英士村)',
                                latLng: [24.6508143, 121.4716748],
                            },
                            {
                                title: 'Jiaming Lake(嘉明湖)',
                                msg: 'Haiduan Township, Taitung County, Taiwan(台灣台東縣海端鄉)',
                                latLng: [23.2933843, 121.0341861],
                            },
                        ],
                        visible: true,
                    },
                    {
                        title: 'pointSet B',
                        msg: 'msg from pointSet B',
                        points: [
                            {
                                title: 'point B-1',
                                msg: 'msg from data B-1',
                                latLng: [22.80, 120.37],
                            },
                            {
                                title: 'point B-2',
                                msg: 'msg from data B-2',
                                latLng: [22.40, 120.67],
                            },
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
