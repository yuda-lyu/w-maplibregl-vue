// unit: basemapManager.previewOverlayOpacity(連續調整疊加層透明度之輕量預覽, 規則帳本 R18)
//
// 以假 map 記錄對地圖之呼叫(不需瀏覽器)。每條 assertion 註明對應之規格句,
// 規格句出自 src/components/WMaplibreglVue.vue 之公開方法 previewOverlayOpacity 之 JSDoc(以下代稱):
//   J-prev1 「以名稱(baseMaps[i].name)定位疊加層, 只改地圖上該圖層之繪製屬性(raster-opacity/fill-opacity/line-opacity/fill-extrusion-opacity),
//            不回寫 opt、不改元件內部 baseMaps、不重繪面板, 可逐幀呼叫」
//   J-prev2 「val 須為 0~1 之有效數字(數字或數字字串); 非有效數字或超出 0~1 回傳 false 且不改繪製」
//   J-prev3 「回傳 true 表已套用; 地圖未載入、查無名稱、名稱對到多個條目、對到底圖(colorShade 非空)或 type 為 'style'、圖層尚未加入時回傳 false; 不拋錯」
//   J-prev4 「拖曳結束時呼叫 setOverlayOpacity 提交; 預覽未提交而底圖被重套或增量更新時, 圖層回到已提交值」
import assert from 'assert'
import { applyBaseMaps, setOverlayOpacity, updateBaseMapPaint, getBaseMapOpacity, previewOverlayOpacity } from '../src/js/basemapManager.mjs'


//genMap, 記錄所有呼叫之假 map(含 addSource/addLayer, 供 applyBaseMaps 建立圖層)
function genMap() {
    let sources = {}
    let layers = []
    let calls = [] //方法名稱序列
    let paints = []
    let map = {
        sources,
        layers,
        calls,
        paints,
        getStyle: () => {
            calls.push('getStyle')
            return { sources, layers }
        },
        getSource: (id) => sources[id],
        getLayer: (id) => {
            calls.push('getLayer')
            return layers.find((l) => l.id === id)
        },
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
        setPaintProperty: (id, prop, val) => {
            calls.push('setPaintProperty')
            paints.push({ id, prop, val })
        },
    }
    return map
}

let ras = (name, ext) => ({ name, url: `https://x/${name}/{z}/{y}/{x}.png`, colorShade: '', visible: true, ...ext })
let wmsOv = (name, ext) => ({ name, type: 'wms', url: `https://x/${name}/wms`, layers: name, colorShade: '', visible: true, ...ext })
let vec = (name, ext) => ({ name, type: 'vector', url: `https://x/${name}/tj.json`, layer: 'b', layerType: 'fill', colorShade: '', visible: true, ...ext })
let baseR = (name, ext) => ({ name, url: `https://x/${name}/{z}/{y}/{x}.png`, colorShade: 'light', visible: true, ...ext })

//以 applyBaseMaps 建立圖層後回傳 { map, bms }
function setup(bms) {
    let map = genMap()
    applyBaseMaps(map, bms)
    map.calls.length = 0
    map.paints.length = 0
    return { map, bms }
}

//取 token 對應之圖層 id(圖層 id 含 url 淨化後之內容, token 為 name)
let layerIdOf = (map, token) => {
    let ls = map.layers.filter((l) => String(l.id).indexOf(token) >= 0)
    assert.strictEqual(ls.length, 1, `應恰有 1 個含 ${token} 之圖層, 實際 ${ls.length}`)
    return ls[0].id
}

//深凍結: 任何寫入(嚴格模式 ESM)即拋錯, 證明函式不改動 baseMaps
function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
        Object.freeze(o)
        Object.keys(o).forEach((k) => deepFreeze(o[k]))
    }
    return o
}


describe('unit-previewOpacity', function() {

    it('U62 各型別疊加層: 只對該圖層設對應之 paint 屬性並回傳 true, 不改 baseMaps(深凍結亦可呼叫)', function() {
        //J-prev1: raster/wms → raster-opacity; vector 依 layerType → fill-opacity/line-opacity/fill-extrusion-opacity(未給 layerType 為 fill)
        let kinds = [
            { label: 'raster', bm: () => ras('kr'), prop: 'raster-opacity' },
            { label: 'wms', bm: () => wmsOv('kw'), prop: 'raster-opacity' },
            { label: 'vector fill', bm: () => vec('kvf', { layerType: 'fill' }), prop: 'fill-opacity' },
            { label: 'vector 未給 layerType', bm: () => vec('kvn', { layerType: undefined }), prop: 'fill-opacity' },
            { label: 'vector line', bm: () => vec('kvl', { layerType: 'line' }), prop: 'line-opacity' },
            { label: 'vector fill-extrusion', bm: () => vec('kve', { layerType: 'fill-extrusion' }), prop: 'fill-extrusion-opacity' },
        ]
        for (let k of kinds) {
            let name = k.bm().name
            //前後夾其他條目: 只應動到目標圖層
            let bms = deepFreeze([baseR('base1'), ras('other1'), k.bm(), vec('other2')])
            let { map } = setup(bms)
            let id = layerIdOf(map, name)
            let r = previewOverlayOpacity(map, bms, name, 0.3)
            assert.strictEqual(r, true, `${k.label} 應回 true`)
            assert.deepStrictEqual(map.paints, [{ id, prop: k.prop, val: 0.3 }], `${k.label} 只應設 ${k.prop}=0.3 於目標圖層`)
        }
    })

    it('U63 輕量: 一次預覽只呼叫 getLayer 與 setPaintProperty 各一次(不取 style、不改版面)', function() {
        //J-prev1: 可逐幀呼叫(不得有 getStyle 之全 style 序列化、setLayoutProperty、moveLayer 等)
        let bms = [baseR('base1'), ras('ovA'), vec('ovB')]
        let { map } = setup(bms)
        previewOverlayOpacity(map, bms, 'ovB', 0.5)
        assert.deepStrictEqual(map.calls, ['getLayer', 'setPaintProperty'])
    })

    it('U64 值: 0 與 1 為有效邊界; 數字字串(含前後空白)轉數值後使用', function() {
        //J-prev2: 0~1 之有效數字(數字或數字字串)
        let bms = [ras('ovA')]
        let { map } = setup(bms)
        let cases = [[0, 0], [1, 1], [0.5, 0.5], ['0.5', 0.5], [' 0.25 ', 0.25], ['.5', 0.5], ['1', 1], ['0', 0], ['5e-1', 0.5], ['+0.5', 0.5]]
        for (let [input, want] of cases) {
            map.paints.length = 0
            assert.strictEqual(previewOverlayOpacity(map, bms, 'ovA', input), true, `輸入 ${JSON.stringify(input)}`)
            assert.strictEqual(map.paints.length, 1)
            assert.strictEqual(map.paints[0].val, want, `輸入 ${JSON.stringify(input)} 應以數值 ${want} 設定`) //檢測之值即使用之值: 不得把字串直接交給 maplibre
            assert.strictEqual(typeof map.paints[0].val, 'number')
        }
    })

    it('U65 值: 非有效數字或超出 0~1 一律回 false 且不改繪製', function() {
        //J-prev2
        let bms = [ras('ovA')]
        let { map } = setup(bms)
        /* eslint-disable no-new-wrappers */
        let bad = [
            NaN, Infinity, -Infinity, 'abc', '', ' ', '-', 'NP', null, undefined, true, false, [], [0.5], {}, () => 0.5,
            '0x10', '0b1', '1e400', 'Infinity', 'NaN', '1,0', '0.5abc', new Number(0.5), Symbol('x'), 10n, //非有效數字(含標記字串、包裝物件、BigInt)
            1.0000001, -0.0000001, 1.5, -0.2, '2', '-1', 100, //超出 0~1
        ]
        for (let b of bad) {
            let r
            assert.doesNotThrow(() => {
                r = previewOverlayOpacity(map, bms, 'ovA', b)
            }, `輸入 ${String(typeof b === 'symbol' ? 'Symbol' : (typeof b === 'bigint' ? b + 'n' : b))} 不得拋錯`)
            assert.strictEqual(r, false, `輸入 ${typeof b === 'symbol' ? 'Symbol' : String(b)} 應回 false`)
        }
        assert.strictEqual(map.paints.length, 0, '無效值不得有任何 setPaintProperty')
        //不給 val
        assert.strictEqual(previewOverlayOpacity(map, bms, 'ovA'), false)
        assert.strictEqual(map.paints.length, 0)
    })

    it('U66 名稱: 查無、非字串、空字串、大小寫或空白不符皆回 false', function() {
        //J-prev3: 查無名稱回 false(嚴格比對, 不 trim、不分大小寫轉換)
        //夾入「未給 name」與「name 為空字串」之條目: 名稱 undefined、'' 不得誤命中它們
        let unnamed = { url: 'https://x/unnamed/{z}/{y}/{x}.png', colorShade: '', visible: true }
        let emptyName = ras('', { url: 'https://x/emptyname/{z}/{y}/{x}.png' })
        let bms = [ras('ovA'), ras('ovB'), unnamed, emptyName]
        let { map } = setup(bms)
        for (let n of ['noSuch', 'OVA', 'ovA ', ' ovA', '', undefined, null, 0, 1, true, {}, [], ['ovA'], NaN]) {
            let r
            assert.doesNotThrow(() => {
                r = previewOverlayOpacity(map, bms, n, 0.5)
            })
            assert.strictEqual(r, false, `名稱 ${JSON.stringify(n)} 應回 false`)
        }
        assert.strictEqual(map.paints.length, 0)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'ovB', 0.5), true) //對照: 正確名稱可用
    })

    it('U67 同名: 名稱對到多個條目(疊加層之間、疊加層與底圖之間)一律回 false 且各圖層皆不動', function() {
        //J-prev3: 對到多個條目不擇一(收嚴)
        let bms1 = [ras('dup', { url: 'https://x/1/{z}/{y}/{x}.png' }), ras('dup', { url: 'https://x/2/{z}/{y}/{x}.png' }), ras('ovC')]
        let { map: m1 } = setup(bms1)
        assert.strictEqual(previewOverlayOpacity(m1, bms1, 'dup', 0.5), false)
        assert.strictEqual(m1.paints.length, 0)
        assert.strictEqual(previewOverlayOpacity(m1, bms1, 'ovC', 0.5), true) //未同名者不受影響
        //疊加層與底圖同名
        let bms2 = [baseR('same'), ras('same', { url: 'https://x/o/{z}/{y}/{x}.png' })]
        let { map: m2 } = setup(bms2)
        assert.strictEqual(previewOverlayOpacity(m2, bms2, 'same', 0.5), false)
        assert.strictEqual(m2.paints.length, 0)
        //內容完全相同之兩條目(baseMapKey 以出現序去重)亦為同名
        let bms3 = [ras('twin'), ras('twin')]
        let { map: m3 } = setup(bms3)
        assert.strictEqual(previewOverlayOpacity(m3, bms3, 'twin', 0.5), false)
        assert.strictEqual(m3.paints.length, 0)
    })

    it('U68 底圖與 style 型別: 名稱對到底圖(colorShade 非空)或 type 為 style 回 false; colorShade 未給視為疊加層', function() {
        //J-prev3: 只支援疊加層; style 型別各層自帶 opacity, 不支援整組透明度(同 setOverlayOpacity)
        let bms = [baseR('baseA'), baseR('baseDark', { colorShade: 'dark' }), ras('ovA'), { name: 'ovStyle', type: 'style', url: 'https://x/style.json', colorShade: '', visible: true }, ras('noShade', { colorShade: undefined })]
        //getLayer 恆回真值之地圖: 使「圖層是否存在」不能代替型別判斷(style 型別之圖層 id 本帶序號尾碼, 真地圖上本就查不到單一 id)
        let paints = []
        let mapAny = { getLayer: () => ({}), setPaintProperty: (id, prop, val) => paints.push({ id, prop, val }) }
        assert.strictEqual(previewOverlayOpacity(mapAny, bms, 'baseA', 0.5), false)
        assert.strictEqual(previewOverlayOpacity(mapAny, bms, 'baseDark', 0.5), false)
        assert.strictEqual(previewOverlayOpacity(mapAny, bms, 'ovStyle', 0.5), false)
        assert.strictEqual(paints.length, 0)
        assert.strictEqual(previewOverlayOpacity(mapAny, bms, 'ovA', 0.5), true)
        //colorShade 未給: applyBaseMaps 以 !isestr 歸為疊加層(第二輪建立), 預覽與其一致
        assert.strictEqual(previewOverlayOpacity(mapAny, bms, 'noShade', 0.4), true)
        assert.strictEqual(paints.length, 2)
        //真實建圖後之假地圖: 同樣結果(style 型別在假地圖上未載入 style JSON 而不建圖層)
        let { map } = setup(bms)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'baseA', 0.5), false)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'ovStyle', 0.5), false)
        assert.strictEqual(map.paints.length, 0)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'ovA', 0.5), true)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'noShade', 0.4), true)
        assert.strictEqual(map.paints.length, 2)
    })

    it('U69 地圖與圖層狀態: 無 map、baseMaps 非陣列、圖層尚未加入、url 無效條目、地圖方法拋錯皆回 false 且不拋錯', function() {
        //J-prev3: 地圖未載入、圖層尚未加入
        let bms = [ras('ovA')]
        let { map } = setup(bms)
        for (let m of [null, undefined, 0, '']) {
            assert.strictEqual(previewOverlayOpacity(m, bms, 'ovA', 0.5), false, `map=${String(m)}`)
        }
        for (let b of [null, undefined, {}, 'ovA', 0, [null], [undefined], ['ovA'], []]) {
            let r
            assert.doesNotThrow(() => {
                r = previewOverlayOpacity(map, b, 'ovA', 0.5)
            })
            assert.strictEqual(r, false, `baseMaps=${JSON.stringify(b)}`)
        }
        //類陣列/物件(非陣列)即使含同名條目、且地圖對任何 id 都回有圖層, 亦回 false
        let paintsAny = []
        let mapAny = { getLayer: () => ({}), setPaintProperty: (id, prop, val) => paintsAny.push({ id, prop, val }) }
        assert.strictEqual(previewOverlayOpacity(mapAny, { a: ras('ovA') }, 'ovA', 0.5), false)
        assert.strictEqual(previewOverlayOpacity(mapAny, { 0: ras('ovA'), length: 1 }, 'ovA', 0.5), false)
        assert.strictEqual(paintsAny.length, 0)
        //陣列內夾 null/undefined 元素: 為無效狀態(applyBaseMaps 本身即無法處理), 回 false 不拋錯
        for (let b of [[null, ...bms], [undefined, ...bms]]) {
            let r
            assert.doesNotThrow(() => {
                r = previewOverlayOpacity(map, b, 'ovA', 0.5)
            })
            assert.strictEqual(r, false)
        }
        assert.strictEqual(map.paints.length, 0)
        //圖層尚未加入(未呼叫 applyBaseMaps)
        let bmsNew = [ras('ovA')]
        let mapEmpty = genMap()
        assert.strictEqual(previewOverlayOpacity(mapEmpty, bmsNew, 'ovA', 0.5), false)
        assert.strictEqual(mapEmpty.paints.length, 0)
        //url 無效之條目 applyBaseMaps 略過(不建圖層) → 預覽回 false
        let bmsBadUrl = [ras('ovBad', { url: 123 })]
        let { map: mapBad } = setup(bmsBadUrl)
        assert.strictEqual(previewOverlayOpacity(mapBad, bmsBadUrl, 'ovBad', 0.5), false)
        assert.strictEqual(mapBad.paints.length, 0)
        //地圖方法拋錯(如樣式尚未載入): 回 false 不外拋
        let throwLoading = () => {
            throw new Error('Style is not done loading')
        }
        let mapThrowGet = { getLayer: throwLoading, setPaintProperty: () => {} }
        assert.strictEqual(previewOverlayOpacity(mapThrowGet, bms, 'ovA', 0.5), false)
        let mapThrowSet = { getLayer: () => ({}), setPaintProperty: throwLoading }
        assert.strictEqual(previewOverlayOpacity(mapThrowSet, bms, 'ovA', 0.5), false)
    })

    it('U70 重複呼叫: 逐幀 200 次皆回 true, 只改繪製、不改 baseMaps, 終值為最後一次', function() {
        //J-prev1: 可逐幀呼叫; 不回寫、不改元件內部 baseMaps
        let bms = [baseR('baseA'), ras('ovA', { opacity: 0.9 }), vec('ovB', { layerType: 'line' })]
        let { map } = setup(bms)
        let snap = JSON.stringify(bms)
        let last = null
        for (let i = 0; i < 200; i++) {
            last = (i % 100) / 100
            assert.strictEqual(previewOverlayOpacity(map, bms, 'ovB', last), true)
        }
        assert.strictEqual(map.paints.length, 200)
        assert.strictEqual(map.paints[199].val, last)
        assert.strictEqual(JSON.stringify(bms), snap, 'baseMaps 內容不得被改動(含 opacity)')
        //相同值連呼: 每次仍回 true(是否短路由 maplibre 決定)
        assert.strictEqual(previewOverlayOpacity(map, bms, 'ovB', last), true)
    })

    it('U71 預覽後提交: 以 setOverlayOpacity 提交後 baseMaps 與繪製皆為提交值', function() {
        //J-prev4: 拖曳中預覽, 放開時 setOverlayOpacity 提交
        let bms = [ras('ovA', { opacity: 0.9 })]
        let { map } = setup(bms)
        for (let v of [0.8, 0.5, 0.3]) assert.strictEqual(previewOverlayOpacity(map, bms, 'ovA', v), true)
        assert.strictEqual(bms[0].opacity, 0.9, '提交前內部值仍為已提交值')
        setOverlayOpacity(map, bms, 0, 0.3)
        assert.strictEqual(bms[0].opacity, 0.3)
        let ps = map.paints.filter((p) => p.prop === 'raster-opacity')
        assert.strictEqual(ps[ps.length - 1].val, 0.3)
        assert.strictEqual(getBaseMapOpacity(bms[0]), 0.3)
    })

    it('U72 預覽後不提交: 就地更新(paint-only/增量)與完整重套皆使圖層回到已提交值', function() {
        //J-prev4: 未提交而底圖被重套或增量更新時, 圖層回到已提交值
        let bms = [ras('ovR', { opacity: 0.9 }), vec('ovV', {}), wmsOv('ovW', { opacity: '0.4' })] //vector 未給 → 0.8
        let { map } = setup(bms)
        previewOverlayOpacity(map, bms, 'ovR', 0.1)
        previewOverlayOpacity(map, bms, 'ovV', 0.2)
        previewOverlayOpacity(map, bms, 'ovW', 0.3)
        //路徑 1: updateBaseMapPaint(P1/P2 之底層, 就地 setPaintProperty)
        map.paints.length = 0
        bms.forEach((bm, k) => updateBaseMapPaint(map, bms, k))
        let byProp = (id) => map.paints.filter((p) => p.id === id).pop().val
        assert.strictEqual(byProp(layerIdOf(map, 'ovR')), 0.9)
        assert.strictEqual(byProp(layerIdOf(map, 'ovV')), 0.8)
        assert.strictEqual(byProp(layerIdOf(map, 'ovW')), 0.4)
        //路徑 2: applyBaseMaps(P3 完整重建)→ 新圖層之初始 paint 即已提交值
        previewOverlayOpacity(map, bms, 'ovR', 0.1)
        applyBaseMaps(map, bms)
        assert.strictEqual(map.layers.find((l) => l.id === layerIdOf(map, 'ovR')).paint['raster-opacity'], 0.9)
        assert.strictEqual(map.layers.find((l) => l.id === layerIdOf(map, 'ovV')).paint['fill-opacity'], 0.8)
        assert.strictEqual(map.layers.find((l) => l.id === layerIdOf(map, 'ovW')).paint['raster-opacity'], 0.4)
    })

})
