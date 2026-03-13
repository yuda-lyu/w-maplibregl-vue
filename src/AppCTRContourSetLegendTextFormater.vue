<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">contourSet.legendTextFormater</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppCTRContourSetLegendTextFormater.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppCTRContourSetLegendTextFormater.html" target="_blank" class="item-link">code</a>
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
                center: [24.4, 121.239],
                zoom: 8,
                contourSets: [
                    {
                        title: 'contourSet A',
                        msg: 'msg from contourSet A',
                        points: [
                            [24.325, 120.786, 4], [23.944, 120.968, 15], [24.884, 121.234, 20], [24.579, 121.345, 62], [24.664, 121.761, 35], [23.803, 121.397, 30],
                        ],
                        legendTextFormater: function(msg) {
                            console.log('contourSet A: legendTextFormater', msg)
                            let low = msg.low
                            let up = msg.up
                            let v = (low + up) / 2
                            if (v <= 25) {
                                low = `<div style="color:#439c30;">${low}</div>`
                                up = `<div style="color:#439c30;">${up}</div>`
                            }
                            else if (v <= 50) {
                                low = `<div style="color:#91830b;">${low}</div>`
                                up = `<div style="color:#91830b;">${up}</div>`
                            }
                            else {
                                low = `<div style="color:#f26;">${low}</div>`
                                up = `<div style="color:#f26;">${up}</div>`
                            }
                            let delimiter = `<div style="color:#888;">⊶</div>`
                            return {
                                low,
                                up,
                                delimiter,
                            }
                        },
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
    },
}
</script>

<style>
</style>
