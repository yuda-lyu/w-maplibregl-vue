import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src/components/'
let fdTar = './dist'


//注意: 本產物包含 src/js/maplibreWorkerInline.mjs(內嵌之 maplibre worker 原始碼),
//其須先由 toolg/gDistRollupMaplibreGlWorker.mjs 產製, 見 script.txt 之執行順序
rollupFiles({
    fns: 'WMaplibreglVue.vue',
    fdSrc,
    fdTar,
    format: 'umd',
    nameDistType: 'kebabCase',
    globals: {
    },
    external: [
    ],
})
