// unit: basemapManager 之 source 規格欄位(minzoom/maxzoom/url)與執行期差異判斷
//
// 以假 map 記錄 addSource/addLayer 之參數(不需瀏覽器)。每條 assertion 註明對應之規格句,
// 規格句出自 src/components/WMaplibreglVue.vue 之 @vue-prop(以下代稱):
//   J-max  baseMaps[i].maxzoom: 「可給數字或數字字串, 小數無條件捨去, 負數、非有限數或非數值視為未給,
//          不給則沿用maplibre預設」「超過時改以該級圖磚放大顯示」「type為'style'時不適用(由style JSON自帶)」
//   J-min  baseMaps[i].minzoom: 「給法同maxzoom但小數無條件進位」「與maxzoom同時給且大於maxzoom時忽略minzoom」
//   J-url  baseMaps[i].url: 「url非有效字串之條目會被略過(console.warn)且不影響其他條目」
//   J-tm   terrainMap.terrainSource.maxzoom: 「給法同baseMaps[i].maxzoom」; terrainSource 無 minzoom 欄位;
//          hillshadeSource: 「須同時給有效之terrainSource才生效, url與terrainSource.url相同時共用地形來源」
//   J-def  CLAUDE_rulebook.md R9: 預設底圖 OpenTopoMap 帶 maxzoom 17(服務只提供至 17 級); OpenStreetMap 帶 maxzoom 19(z>=20 回 400)、Mapbox 帶 maxzoom 22(TileJSON 宣告)
//   J-opa  baseMaps[i].opacity: 「透明度數字(0~1), 可給數字或數字字串, 超出範圍夾限, 非數值視為未給, raster與wms預設1、vector預設0.8(面板滑桿與實繪一致),
//          type為'style'時不支援(各層自帶opacity)」(CLAUDE_rulebook.md R14)
//   J-diff isBaseMapsPaintOnlyDiff/isBaseMapsStructuralDiff 之函式說明(僅 paint → P1; 僅順序/可見性/paint → 增量; 其餘 → 完整重建)
import assert from 'assert'
import { applyBaseMaps, applyTerrain, preloadBaseMapStyles, isBaseMapsStructuralDiff, isBaseMapsPaintOnlyDiff, getBaseMapOpacity, updateBaseMapPaint } from '../src/js/basemapManager.mjs'
import defBaseMaps from '../src/js/defBaseMaps.mjs'


//genMap, 記錄 addSource/addLayer 之假 map(applyBaseMaps/applyTerrain 僅用到下列方法)
function genMap() {
    let sources = {}
    let layers = []
    return {
        sources,
        layers,
        getStyle: () => ({ sources, layers }),
        getSource: (id) => sources[id],
        getLayer: (id) => layers.find((l) => l.id === id),
        addSource: (id, spec) => {
            sources[id] = spec
        },
        addLayer: (spec) => {
            layers.push(spec)
        },
        removeSource: (id) => {
            delete sources[id]
        },
        removeLayer: (id) => {
            let i = layers.findIndex((l) => l.id === id)
            if (i >= 0) layers.splice(i, 1)
        },
        setTerrain: () => {},
        paints: [],
        setPaintProperty(id, prop, val) {
            this.paints.push({ id, prop, val })
        },
    }
}

let URL_R = 'https://x/{z}/{y}/{x}.png'
let raster = (ext) => ({ name: 'a', url: URL_R, colorShade: '', visible: true, ...ext })
let wms = (ext) => ({ name: 'w', type: 'wms', url: 'https://x/wms', layers: '0', colorShade: '', visible: true, ...ext })
let vector = (ext) => ({ name: 'v', type: 'vector', url: 'https://x/tj.json', layer: 'b', layerType: 'line', colorShade: '', visible: true, ...ext })

//單一條目套用後取其 source spec
function specOf(bm) {
    let map = genMap()
    applyBaseMaps(map, [bm])
    let specs = Object.values(map.sources)
    assert.strictEqual(specs.length, 1, `應建立 1 個 source, 實際 ${specs.length}`)
    return specs[0]
}

//暫時攔截 console.warn, 回傳期間之警告字串
function captureWarn(fn) {
    let msgs = []
    let warn0 = console.warn
    console.warn = (...args) => {
        msgs.push(args.map(String).join(' '))
    }
    try {
        fn()
    }
    finally {
        console.warn = warn0
    }
    return msgs
}

let has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)


describe('unit-basemapManager', function() {

    it('U1 raster 帶 maxzoom 時寫入 source 之 maxzoom', function() {
        let s = specOf(raster({ maxzoom: 18 }))
        assert.strictEqual(s.type, 'raster')
        assert.strictEqual(s.maxzoom, 18) //J-max: 超過時改以該級圖磚放大顯示(maplibre source.maxzoom)
    })

    it('U2 wms 帶 maxzoom 時寫入 source 之 maxzoom', function() {
        let s = specOf(wms({ maxzoom: 17 }))
        assert.strictEqual(s.maxzoom, 17) //J-max: 適用 type 為 raster、wms、vector
    })

    it('U3 不給或給非數值之 maxzoom 時 source 不含 maxzoom 且鍵集合與未支援前相同', function() {
        for (let mz of [undefined, null, '', '  ', 'abc', true, [18]]) {
            let s = specOf(raster({ maxzoom: mz }))
            assert.strictEqual(has(s, 'maxzoom'), false, `maxzoom=${JSON.stringify(mz)}`) //J-max: 非數值視為未給
            assert.deepStrictEqual(Object.keys(s).sort(), ['tileSize', 'tiles', 'type']) //J-max: 不給則沿用maplibre預設(opt-in, source 不變)
        }
    })

    it('U4 數字字串之 maxzoom 轉為數字', function() {
        assert.strictEqual(specOf(raster({ maxzoom: '18' })).maxzoom, 18) //J-max: 可給數字或數字字串
    })

    it('U5 maxzoom 變更判為結構性變更, 不得判為僅 paint', function() {
        let prev = [raster({ opacity: 1 })]
        let next = [{ ...prev[0], maxzoom: 18 }]
        assert.strictEqual(isBaseMapsStructuralDiff(prev, next), true) //J-diff: 其餘欄位 → 完整重建
        assert.strictEqual(isBaseMapsPaintOnlyDiff(prev, next), false) //J-diff: 非僅 paint
    })

    it('U6 小數: maxzoom 無條件捨去、minzoom 無條件進位; 0 為有效值', function() {
        assert.strictEqual(specOf(raster({ maxzoom: 18.7 })).maxzoom, 18) //J-max: 小數無條件捨去
        assert.strictEqual(specOf(raster({ maxzoom: 0 })).maxzoom, 0) //J-max: 數字(0 非負)為有效值
        assert.strictEqual(specOf(raster({ minzoom: 2.5 })).minzoom, 3) //J-min: 小數無條件進位
    })

    it('U7 負數、非有限數視為未給; 指數字串依數值', function() {
        for (let v of [-1, -0.5, Infinity, -Infinity, NaN, 'Infinity']) {
            let s = specOf(raster({ maxzoom: v, minzoom: v }))
            assert.strictEqual(has(s, 'maxzoom'), false, `maxzoom=${v}`) //J-max: 負數、非有限數視為未給
            assert.strictEqual(has(s, 'minzoom'), false, `minzoom=${v}`) //J-min: 給法同maxzoom
        }
        assert.strictEqual(specOf(raster({ maxzoom: '1e1' })).maxzoom, 10) //J-max: 數字字串依其數值
    })

    it('U8 raster、wms 帶 minzoom 時寫入 source 之 minzoom', function() {
        assert.strictEqual(specOf(raster({ minzoom: 7 })).minzoom, 7) //J-min: 適用 raster
        assert.strictEqual(specOf(wms({ minzoom: 5 })).minzoom, 5) //J-min: 適用 wms
    })

    it('U9 minzoom 大於 maxzoom 時忽略 minzoom、保留 maxzoom 並警告', function() {
        let s
        let msgs = captureWarn(() => {
            s = specOf(raster({ minzoom: 19, maxzoom: 18 }))
        })
        assert.strictEqual(has(s, 'minzoom'), false) //J-min: 與maxzoom同時給且大於maxzoom時忽略minzoom
        assert.strictEqual(s.maxzoom, 18) //J-min: (僅忽略 minzoom, maxzoom 照套)
        assert.ok(msgs.some((m) => m.includes('minzoom')), `應有 minzoom 之警告, 實際 ${JSON.stringify(msgs)}`) //J-min: 忽略時告知
    })

    it('U10 vector 帶 minzoom/maxzoom 時寫入 source; 未給時鍵集合與未支援前相同', function() {
        let s = specOf(vector({ maxzoom: 14, minzoom: 2 }))
        assert.strictEqual(s.maxzoom, 14) //J-max: 適用 vector
        assert.strictEqual(s.minzoom, 2) //J-min: 適用 vector
        assert.deepStrictEqual(Object.keys(specOf(vector({}))).sort(), ['type', 'url']) //J-max: 不給則沿用(vector 依其TileJSON)
    })

    it('U11 style 型別不套用 baseMaps[i] 之 minzoom/maxzoom', async function() {
        let styleUrl = 'https://x/u11-style.json'
        let st = { version: 8, sources: { s1: { type: 'raster', tiles: ['https://x/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 12 } }, layers: [{ id: 'l1', type: 'raster', source: 's1' }] }
        let fetch0 = globalThis.fetch
        globalThis.fetch = async () => ({ ok: true, json: async () => st })
        try {
            await preloadBaseMapStyles([{ name: 'st', type: 'style', url: styleUrl }])
        }
        finally {
            globalThis.fetch = fetch0
        }
        let map = genMap()
        applyBaseMaps(map, [{ name: 'st', type: 'style', url: styleUrl, colorShade: 'light', visible: true, maxzoom: 3, minzoom: 1 }])
        let specs = Object.values(map.sources)
        assert.strictEqual(specs.length, 1)
        assert.deepStrictEqual(specs[0], st.sources.s1) //J-max/J-min: type為'style'時不適用(由style JSON自帶)
    })

    it('U12 地形/陰影: maxzoom 同一正規化, 不開放 minzoom; 預設設定之 source 不變', function() {
        let map = genMap()
        applyTerrain(map, { terrainSource: { url: 'https://t/{z}/{x}/{y}.png', maxzoom: '13.9', minzoom: 3 }, hillshadeSource: { url: 'https://h/{z}/{x}/{y}.png', maxzoom: 12, minzoom: 2 } }, [])
        assert.strictEqual(map.sources['terrain-src'].maxzoom, 13) //J-tm: 給法同baseMaps[i].maxzoom(數字字串、捨去)
        assert.strictEqual(has(map.sources['terrain-src'], 'minzoom'), false) //J-tm: terrainSource 無 minzoom 欄位
        assert.strictEqual(map.sources['terrain-hillshade-src'].maxzoom, 12) //J-tm: hillshadeSource 欄位同terrainSource
        assert.strictEqual(has(map.sources['terrain-hillshade-src'], 'minzoom'), false) //J-tm: 同上

        let map2 = genMap()
        applyTerrain(map2, { terrainSource: { url: 'https://t/{z}/{x}/{y}.png', maxzoom: Infinity } }, [])
        assert.strictEqual(has(map2.sources['terrain-src'], 'maxzoom'), false) //J-tm→J-max: 非有限數視為未給

        let map3 = genMap()
        applyTerrain(map3, { terrainSource: { url: '//s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', layerType: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13 } }, [])
        //J-tm: 預設設定(defTerrainMap)之 source 與未支援前逐鍵相同(opt-in)
        assert.deepStrictEqual(map3.sources['terrain-src'], { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'terrarium', maxzoom: 13 })
    })

    it('U13 陰影: 與地形同 url 時共用地形來源; 地形來源無效時不建陰影', function() {
        let map = genMap()
        applyTerrain(map, { terrainSource: { url: 'https://t/{z}/{x}/{y}.png' }, hillshadeSource: { url: 'https://t/{z}/{x}/{y}.png', maxzoom: 5 } }, [])
        assert.strictEqual(map.sources['terrain-hillshade-src'], undefined) //J-tm: url與terrainSource.url相同時共用地形來源
        assert.strictEqual(map.getLayer('terrain-hillshade').source, 'terrain-src') //J-tm: 同上

        let map2 = genMap()
        applyTerrain(map2, { hillshadeSource: { url: 'https://h/{z}/{x}/{y}.png' } }, [])
        assert.strictEqual(map2.getLayer('terrain-hillshade'), undefined) //J-tm: 須同時給有效之terrainSource才生效
        assert.deepStrictEqual(Object.keys(map2.sources), []) //J-tm: 同上
    })

    it('U14 執行期差異: minzoom 變更走完整重建; maxzoom 不變時 paint 與重排仍走快路徑', function() {
        let prev = [raster({ opacity: 1 })]
        assert.strictEqual(isBaseMapsStructuralDiff(prev, [{ ...prev[0], minzoom: 5 }]), true) //J-diff: 其餘欄位 → 完整重建
        let a = raster({ opacity: 1, maxzoom: 18 })
        assert.strictEqual(isBaseMapsPaintOnlyDiff([a], [{ ...a, opacity: 0.5 }]), true) //J-diff: 僅 paint → P1
        let b = { name: 'b', url: 'https://y/{z}/{x}/{y}.png', colorShade: '', visible: true, opacity: 1 }
        assert.strictEqual(isBaseMapsStructuralDiff([a, b], [b, a]), false) //J-diff: 僅順序 → 增量
    })

    it('U15 預設底圖 OpenTopoMap 帶 maxzoom 17 且套用至 source', function() {
        let otm = defBaseMaps.find((bm) => bm.name === 'OpenTopoMap')
        assert.ok(otm, 'defBaseMaps 應含 OpenTopoMap')
        assert.strictEqual(otm.maxzoom, 17) //J-def: OpenTopoMap 帶 maxzoom 17
        assert.strictEqual(specOf({ ...otm }).maxzoom, 17) //J-def→J-max: 套用至 source
    })

    it('U16 url 無效之條目略過並警告, 不拋例外且不影響其他條目', function() {
        let map = genMap()
        let msgs = captureWarn(() => {
            applyBaseMaps(map, [
                { name: 'no url', colorShade: '', visible: true },
                { name: 'empty url', type: 'vector', url: '', layer: 'b', colorShade: '', visible: true },
                { name: 'wms null', type: 'wms', url: null, colorShade: 'light', visible: true },
                raster({ name: 'ok' }),
            ])
        })
        let specs = Object.values(map.sources)
        assert.strictEqual(specs.length, 1) //J-url: 不影響其他條目(有效條目照常建立), 無效條目不建 source
        assert.deepStrictEqual(specs[0].tiles, [URL_R]) //J-url: 同上
        assert.strictEqual(msgs.filter((m) => m.includes('url')).length, 3, JSON.stringify(msgs)) //J-url: 各無效條目皆 console.warn
    })

    it('U27 預設底圖 OpenStreetMap 帶 maxzoom 19、Mapbox 帶 maxzoom 22, 且套用至 source', function() {
        let osm = defBaseMaps.find((bm) => bm.name === 'OpenStreetMap')
        assert.ok(osm, 'defBaseMaps 應含 OpenStreetMap')
        assert.strictEqual(osm.maxzoom, 19) //J-def: OSM 帶 maxzoom 19(z>=20 回 400 且無 CORS 標頭, 圖台上限放寬至 22 後不補即空白)
        assert.strictEqual(specOf({ ...osm }).maxzoom, 19) //J-def→J-max: 套用至 source
        let mb = defBaseMaps.find((bm) => bm.name === 'Mapbox')
        assert.ok(mb, 'defBaseMaps 應含 Mapbox')
        assert.strictEqual(mb.maxzoom, 22) //J-def: Mapbox 帶 maxzoom 22(TileJSON 宣告)
        assert.strictEqual(specOf({ ...mb }).maxzoom, 22) //J-def→J-max: 套用至 source
    })

    it('U28 getBaseMapOpacity: 預設(raster/wms 1、vector 0.8)、數字字串、夾限、無效值視為未給、style 不支援', function() {
        //J-opa: raster與wms預設1、vector預設0.8
        assert.strictEqual(getBaseMapOpacity({}), 1)
        assert.strictEqual(getBaseMapOpacity({ type: 'raster' }), 1)
        assert.strictEqual(getBaseMapOpacity({ type: 'wms' }), 1)
        assert.strictEqual(getBaseMapOpacity({ type: 'vector' }), 0.8)
        //J-opa: 明給之數字(含 0 為有效值、不可視為未給)
        assert.strictEqual(getBaseMapOpacity({ opacity: 0 }), 0)
        assert.strictEqual(getBaseMapOpacity({ type: 'vector', opacity: 0 }), 0)
        assert.strictEqual(getBaseMapOpacity({ opacity: 0.3 }), 0.3)
        assert.strictEqual(getBaseMapOpacity({ type: 'vector', opacity: 1 }), 1)
        //J-opa: 可給數字字串
        assert.strictEqual(getBaseMapOpacity({ opacity: '0.5' }), 0.5)
        assert.strictEqual(getBaseMapOpacity({ type: 'vector', opacity: ' 0.25 ' }), 0.25)
        //J-opa: 超出範圍夾限
        assert.strictEqual(getBaseMapOpacity({ opacity: 1.5 }), 1)
        assert.strictEqual(getBaseMapOpacity({ opacity: -0.2 }), 0)
        assert.strictEqual(getBaseMapOpacity({ type: 'vector', opacity: '7' }), 1)
        //J-opa: 非數值/非有限視為未給(用型別預設)
        for (let bad of [NaN, Infinity, -Infinity, 'abc', '', ' ', null, undefined, true, false, [], [0.5], {}]) {
            assert.strictEqual(getBaseMapOpacity({ opacity: bad }), 1, `raster 輸入 ${String(bad)}`)
            assert.strictEqual(getBaseMapOpacity({ type: 'vector', opacity: bad }), 0.8, `vector 輸入 ${String(bad)}`)
        }
        //J-opa: type為'style'時不支援(回 null)
        assert.strictEqual(getBaseMapOpacity({ type: 'style' }), null)
        assert.strictEqual(getBaseMapOpacity({ type: 'style', opacity: 0.5 }), null)
        //bm 缺: 不拋錯(回 raster 預設)
        assert.strictEqual(getBaseMapOpacity(null), 1)
    })

    it('U29 疊加層 opacity: 建立與 paint 更新之 4 個渲染站點取得之值 = getBaseMapOpacity', function() {
        //J-opa: 面板滑桿與實繪一致 → 渲染端(vector 建立/更新、raster 建立/更新)與面板同走 getBaseMapOpacity
        let ins = [undefined, 0, 0.5, '0.5', 1.5, -0.2, NaN, 'abc']
        let kinds = [
            { label: 'raster', bm: (o) => raster({ opacity: o }), prop: 'raster-opacity' },
            { label: 'wms', bm: (o) => wms({ opacity: o }), prop: 'raster-opacity' },
            { label: 'vector fill', bm: (o) => vector({ layerType: 'fill', opacity: o }), prop: 'fill-opacity' },
            { label: 'vector line', bm: (o) => vector({ layerType: 'line', opacity: o }), prop: 'line-opacity' },
            { label: 'vector fill-extrusion', bm: (o) => vector({ layerType: 'fill-extrusion', opacity: o }), prop: 'fill-extrusion-opacity' },
        ]
        for (let k of kinds) {
            for (let o of ins) {
                let bm = k.bm(o)
                let want = getBaseMapOpacity(bm)
                let map = genMap()
                applyBaseMaps(map, [bm])
                assert.strictEqual(map.layers.length, 1, `${k.label} opacity=${String(o)} 應建立圖層`)
                assert.strictEqual(map.layers[0].paint[k.prop], want, `${k.label} 建立 opacity=${String(o)}`) //建立站點
                updateBaseMapPaint(map, [bm], 0)
                let ps = map.paints.filter((p) => p.prop === k.prop)
                assert.strictEqual(ps.length, 1, `${k.label} 更新 opacity=${String(o)} 應設 ${k.prop}`)
                assert.strictEqual(ps[0].val, want, `${k.label} 更新 opacity=${String(o)}`) //更新站點
            }
        }
        //明確期望值(不僅與 getBaseMapOpacity 自洽): 無效值不得使圖層消失或帶無效 paint
        let m1 = genMap(); applyBaseMaps(m1, [raster({ opacity: '0.5' })])
        assert.strictEqual(m1.layers[0].paint['raster-opacity'], 0.5)
        let m2 = genMap(); applyBaseMaps(m2, [vector({ layerType: 'fill', opacity: undefined })])
        assert.strictEqual(m2.layers[0].paint['fill-opacity'], 0.8)
        let m3 = genMap(); applyBaseMaps(m3, [raster({ opacity: 1.5 })])
        assert.strictEqual(m3.layers[0].paint['raster-opacity'], 1)
    })

})
