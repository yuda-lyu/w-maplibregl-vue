<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">panelLegends.show</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppLGDShow.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppLGDShow.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div>
                <button style="margin:0px 3px 3px 0px;" @click="opt.panelLegends.show=true">show(default)</button>
                <button style="margin:0px 3px 3px 0px;" @click="opt.panelLegends.show=false">hide</button>
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
                center: [24.084, 121.068],
                zoom: 7,
                panelLegends: {
                    show: true,
                },
                contourSets: [
                    {
                        title: 'contourSet A',
                        msg: 'msg from contourSet A',
                        points: [
                            [24.325, 120.786, 0], [23.944, 120.968, 10], [24.884, 121.234, 20], [24.579, 121.345, 80], [24.664, 121.761, 40], [23.803, 121.397, 30],
                            [23.727, 120.772, 0], [23.539, 120.975, 0], [23.612, 121.434, 0],
                            [23.193, 120.355, 22], [23.456, 120.890, 42], [23.280, 120.551, 25], [23.162, 121.247, 5],
                        ],
                        visible: true,
                    },
                    {
                        title: 'contourSet B',
                        msg: 'msg from contourSet B',
                        points: [
                            [22.607, 120.416, 0], [22.967, 120.663, 15], [22.592, 120.922, 20], [22.717, 120.644, 45],
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
