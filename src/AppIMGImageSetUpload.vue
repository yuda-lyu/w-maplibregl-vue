<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">imageSet-upload</div>
            <a href="//yuda-lyu.github.io/w-maplibregl-vue/examples/ex-AppIMGImageSetUpload.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-maplibregl-vue/blob/master/docs/examples/ex-AppIMGImageSetUpload.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div>
                <button style="margin:0px 3px 3px 0px;" @click="uploadImgjson">upload imgjson</button>
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
                center: [25.04, 121.51],
                zoom: 10,
                imageSets: [
                    {
                        title: 'imageSet A',
                        msg: 'msg from imageSet A',
                        image: {
                            url: `data:image/png;base64,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`,
                            lngMin: 121.39,
                            lngMax: 121.65,
                            latMin: 24.94,
                            latMax: 25.14,
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
        uploadImgjson: function() {
            let vo = this

            let _ = window._
            let w = window.wsemi

            w.domShowInputAndGetFilesU8Arrs({ kind: 'json' })
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

                    //imgjson
                    let imgjson = JSON.parse(j)
                    // console.log('imgjson', imgjson)

                    //imageSet
                    let imageSet = _.cloneDeep(vo.opt.imageSets[0])
                    imageSet.title = _.get(imgjson, 'name', '')
                    imageSet.msg = _.get(file, 'name', '')
                    imageSet.image = imgjson
                    console.log('imageSet', imageSet)

                    //save
                    vo.opt.imageSets = [imageSet]

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
