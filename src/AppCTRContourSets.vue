<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">contourSets</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppCTRContourSets.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppCTRContourSets.html" target="_blank" class="item-link">code</a>
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
        let pscA = [
            [24.325, 120.786, 2], [23.944, 120.968, 10], [24.884, 121.234, 20], [24.579, 121.345, 78], [24.664, 121.761, 40], [23.803, 121.397, 30],
            [23.727, 120.772, 5], [23.539, 120.975, 3], [23.612, 121.434, 8],
            [23.193, 120.355, 22], [23.456, 120.890, 42], [23.280, 120.551, 25], [23.162, 121.247, 5],
        ]
        // pscA = pscA.map((v) => {
        //     return [v[0], v[1], -v[2]] //相反z值
        // })
        let psA = pscA.map((v, k) => {
            let r = {
                title: `A-${k + 1}`,
                msg: `lat:${v[0]}, lng:${v[1]}, value:${v[2]}`,
                latLng: [v[0], v[1]],
            }
            return r
        })
        return {
            'opt': {
                center: [24.084, 121.068],
                zoom: 7,
                contourSets: [
                    {
                        title: 'contourSet A',
                        msg: 'msg from contourSet A',
                        points: pscA,
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
                pointSets: [
                    {
                        title: 'pointSet A',
                        msg: 'msg from pointSet A',
                        points: psA,
                        visible: false,
                        // popup: function(v) { bbb
                        //     console.log('pointSet A popup', v)
                        //     let c = `
                        //         <div style="padding:15px;">
                        //         <div style="color:#222; font-size:0.9rem; white-space:nowrap;"><span style="color:#f26;">[${v.pointSet.title}]</span> ${v.point.title}</div>
                        //         <div style="color:#666;">${v.point.msg}</div>
                        //         </div>
                        //     `
                        //     return c
                        // },
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
