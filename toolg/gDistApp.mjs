import rollupVueToHtml from 'w-package-tools/src/rollupVueToHtml.mjs'


let opt = {
    title: `w-maplibregl-vue`,
    head: `

    <!-- rollupVueToHtml已自動添加@babel/polyfill與vue -->

    <!-- maplibre-gl已包入 -->
    <script _src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.20.0/dist/maplibre-gl.min.js"></script>
    <link rel="stylesheet" _href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.20.0/dist/maplibre-gl.min.css">

    <!-- lodash -->
    <script src="https://cdn.jsdelivr.net/npm/lodash@latest/lodash.min.js"></script>

    <!-- wsemi -->
    <script src="https://cdn.jsdelivr.net/npm/wsemi@latest/dist/wsemi.umd.min.js"></script>

    <!-- w-gis -->
    <script _src="https://cdn.jsdelivr.net/npm/w-gis@latest/dist/w-gis.umd.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/w-gis@latest/dist/interp2.wk.umd.js"></script>

    <!-- data -->
    <script src="https://cdn.jsdelivr.net/npm/w-demores@latest/res/data/dataRain.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/w-demores@latest/res/data/dataRainClip.js"></script>

    `,
    newVue: ``,
    globals: {
    },
    external: [
    ],
}
rollupVueToHtml('./src/App.vue', './docs/examples/app.html', opt)

