// unit: 底圖/地形「執行期差異」之就地路徑判斷(僅 name 變更、僅地形倍率變更不整組重建)
//
// 不需瀏覽器。每條 assertion 註明對應之規格句,規格句出自 src/components/WMaplibreglVue.vue 之 @vue-prop 與 basemapManager.mjs 之函式說明(以下代稱):
//   J-name  baseMaps[i].name: JSDoc 原文「輸入第i個底圖的名稱字串，供面板清單顯示」;
//           推得(據 basemapManager.mjs 之 baseMapKey 由 type/url/layer/layerType/colorShade/layers 衍生圖層 id、不含 name): 僅 name 變更時不需重建底圖
//           (不移除/新增 source、不重抓圖磚), 面板名稱照常更新
//   J-diff  isBaseMapsStructuralDiff 函式說明(現行原文): 「false → 僅順序/可見性/paint/名稱差異, 可走增量(updateBaseMapsIncremental), 不重建、不重抓圖磚; true → 有結構性變更, 需完整重套 applyBaseMaps」;
//           isBaseMapsPaintOnlyDiff 函式說明: 「true → 可只就地 setPaintProperty(updateBaseMapPaint), 無需重建底圖; false → 非僅 paint 變更, 由呼叫端再以 isBaseMapsStructuralDiff 判斷」
//   J-exag  terrainMap.exaggeration: 「輸入地形高度誇張倍率數字，預設1.5」
//           → 僅倍率變更時以同來源就地 setTerrain 更新(不移除/重建 DEM 來源, 不重抓 DEM); 其餘地形欄位變更仍整組重套
import assert from 'assert'
import * as basemapManager from '../src/js/basemapManager.mjs'
import { computePanelBaseMaps } from '../src/js/configProcessor.mjs'
import cloneDeep from 'lodash-es/cloneDeep.js'

let { isBaseMapsStructuralDiff, isBaseMapsPaintOnlyDiff } = basemapManager

let URL_R = 'https://x/{z}/{y}/{x}.png'
let raster = (ext) => ({ name: 'a', url: URL_R, colorShade: '', visible: true, opacity: 1, ...ext })
let base = () => ({ name: 'base', url: 'https://x/base/{z}/{x}/{y}.png', colorShade: 'light', visible: true, opacity: 1 })


describe('unit-diffpath', function() {

    describe('A1 僅 name 變更(F5)', function() {

        it('UD1 僅 name 變更: 非結構性變更(不整組重建), 亦非僅 paint(走增量路徑); 底圖(radio)、疊加層、wms、vector、style 各型別條目皆然', function() {
            let prev = [base(), raster()]
            let next = cloneDeep(prev); next[1].name = 'renamed'
            assert.strictEqual(isBaseMapsStructuralDiff(prev, next), false) //J-name、J-diff: 圖層 id 不含 name, 改名不需重建
            assert.strictEqual(isBaseMapsPaintOnlyDiff(prev, next), false) //J-diff: name 非 paint 欄位, 由增量路徑處理
            //各型別條目(底圖 radio〔colorShade 非空〕、wms、vector、style)改名: 圖層 id 皆由 baseMapKey 衍生、不含 name
            let kinds = [
                base(),
                { name: 'w', type: 'wms', url: 'https://x/wms', layers: '0', colorShade: '', visible: true },
                { name: 'v', type: 'vector', url: 'https://x/tj.json', layer: 'b', layerType: 'line', colorShade: '', visible: true },
                { name: 's', type: 'style', url: 'https://x/style.json', colorShade: '', visible: true },
            ]
            kinds.forEach((_, i) => {
                let p = cloneDeep(kinds); let n = cloneDeep(kinds); n[i].name = n[i].name + '-renamed'
                assert.strictEqual(isBaseMapsStructuralDiff(p, n), false, `改名 ${kinds[i].type || 'raster'}(${kinds[i].colorShade === '' ? '疊加層' : '底圖'})`) //J-name、J-diff
            })
        })

        it('UD2 name 變更合併可見性或透明度: 仍不整組重建', function() {
            let prev = [base(), raster()]
            let next1 = cloneDeep(prev); next1[1].name = 'renamed'; next1[1].visible = false
            assert.strictEqual(isBaseMapsStructuralDiff(prev, next1), false) //J-diff: 名稱＋可見性 → 增量
            let next2 = cloneDeep(prev); next2[1].name = 'renamed'; next2[1].opacity = 0.4
            assert.strictEqual(isBaseMapsStructuralDiff(prev, next2), false) //J-diff: 名稱＋paint → 增量
        })

        it('UD3 負向: name 以外之結構欄位變更仍判為結構性變更(不被 name 之放行吞掉), 含與 name 同時變更', function() {
            let keys = [
                ['type', 'wms'],
                ['url', 'https://x/other/{z}/{x}/{y}.png'],
                ['layer', 'building'],
                ['layerType', 'line'],
                ['colorShade', 'dark'],
                ['layers', '0,1'],
                ['maxzoom', 18],
                ['minzoom', 3],
                ['extraField', 512], //規格未列之其餘欄位亦屬結構性(同 key 但其餘欄位有變 → 重建; 僅 name/順序/可見性/paint 放行)
            ]
            for (let [k, v] of keys) {
                let prev = [base(), raster()]
                let next = cloneDeep(prev); next[1][k] = v
                assert.strictEqual(isBaseMapsStructuralDiff(prev, next), true, `只改 ${k}`) //J-diff: 其餘欄位 → 完整重建
                let next2 = cloneDeep(next); next2[1].name = 'renamed'
                assert.strictEqual(isBaseMapsStructuralDiff(prev, next2), true, `name＋${k}`) //J-diff: 與 name 同改仍重建
            }
        })

        it('UD4 負向: 新增/刪除條目、底圖(colorShade 非空)與疊加層互換仍判為結構性變更', function() {
            let prev = [base(), raster()]
            let added = cloneDeep(prev); added.push(raster({ name: 'c', url: 'https://x/c/{z}/{x}/{y}.png' }))
            assert.strictEqual(isBaseMapsStructuralDiff(prev, added), true) //J-diff: 新增 → 重建
            assert.strictEqual(isBaseMapsStructuralDiff(added, prev), true) //J-diff: 刪除 → 重建
            let renamedAndAdded = cloneDeep(added); renamedAndAdded[1].name = 'renamed'
            assert.strictEqual(isBaseMapsStructuralDiff(prev, renamedAndAdded), true) //J-diff: 改名同時筆數不同 → 重建
        })

        it('UD5 完全相同: 不是任何變更(兩判斷皆 false); 條目順序互換並改名(key 集合相同)仍走增量', function() {
            let prev = [base(), raster()]
            assert.strictEqual(isBaseMapsStructuralDiff(prev, cloneDeep(prev)), false) //J-diff: 無差異
            assert.strictEqual(isBaseMapsPaintOnlyDiff(prev, cloneDeep(prev)), false) //J-diff: 無 paint 變更
            let a = raster({ name: 'A', url: 'https://x/a/{z}/{x}/{y}.png' })
            let b = raster({ name: 'B', url: 'https://x/b/{z}/{x}/{y}.png' })
            let a2 = { ...a, name: 'A2' }
            assert.strictEqual(isBaseMapsStructuralDiff([a, b], [b, a2]), false) //J-diff: 順序互換並改名 → 仍為增量(key 集合相同)
        })
    })

    describe('A2 僅地形倍率變更(F10)', function() {

        let defTm = { terrainSource: { url: 'https://d/{z}/{x}/{y}.png', encoding: 'terrarium', tileSize: 256, maxzoom: 5 }, exaggeration: 1.5, hillshadeExaggeration: 0.5 }
        //以 computePanelBaseMaps 取得 prev(上次 terrainMap 快照)與其後之判斷
        let judge = (prevTm, nextTm) => {
            let opt = { panelBaseMaps: { terrainMap: nextTm, baseMaps: [base()] } }
            return computePanelBaseMaps(opt, [], prevTm, null, [base()], defTm)
        }

        it('UD6 僅 exaggeration 變更: terrainChanged 為 true 且標記為僅倍率', function() {
            let r = judge(cloneDeep(defTm), { ...cloneDeep(defTm), exaggeration: 3 })
            assert.strictEqual(r.terrainChanged, true) //J-exag: 倍率變更須更新地形
            assert.strictEqual(r.terrainExaggerationOnly, true) //J-exag: 僅倍率 → 就地更新
        })

        it('UD7 exaggeration 由未給改給(或反之): 視為僅倍率變更; 無變更時不標記', function() {
            let noExag = cloneDeep(defTm); delete noExag.exaggeration
            let r1 = judge(noExag, { ...cloneDeep(defTm), exaggeration: 2 })
            assert.strictEqual(r1.terrainExaggerationOnly, true) //J-exag: 未給→給 屬僅倍率
            let r2 = judge(cloneDeep(defTm), noExag)
            assert.strictEqual(r2.terrainExaggerationOnly, true) //J-exag: 給→未給 屬僅倍率
            let r3 = judge(cloneDeep(defTm), cloneDeep(defTm))
            assert.strictEqual(r3.terrainChanged, false) //J-exag: 無變更不重套
            assert.ok(!r3.terrainExaggerationOnly) //J-exag: 無變更不標記
        })

        it('UD8 負向: 倍率以外之地形欄位變更(含與倍率同改)不標記為僅倍率, 仍走整組重套', function() {
            let variants = {
                'terrainSource.url': (t) => {
                    t.terrainSource.url = 'https://d2/{z}/{x}/{y}.png'
                },
                'terrainSource.encoding': (t) => {
                    t.terrainSource.encoding = 'mapbox'
                },
                'terrainSource.tileSize': (t) => {
                    t.terrainSource.tileSize = 512
                },
                'terrainSource.maxzoom': (t) => {
                    t.terrainSource.maxzoom = 9
                },
                'hillshadeExaggeration': (t) => {
                    t.hillshadeExaggeration = 0.9
                },
                'hillshadeSource': (t) => {
                    t.hillshadeSource = { url: 'https://h/{z}/{x}/{y}.png' }
                },
            }
            for (let [label, mut] of Object.entries(variants)) {
                let next = cloneDeep(defTm); mut(next)
                let r = judge(cloneDeep(defTm), next)
                assert.strictEqual(r.terrainChanged, true, label) //J-exag: 其餘地形欄位變更仍須更新
                assert.ok(!r.terrainExaggerationOnly, `只改 ${label}`) //J-exag: 非僅倍率 → 整組重套
                let next2 = cloneDeep(next); next2.exaggeration = 3
                let r2 = judge(cloneDeep(defTm), next2)
                assert.strictEqual(r2.terrainChanged, true, `${label}＋倍率`)
                assert.ok(!r2.terrainExaggerationOnly, `${label}＋倍率`) //J-exag: 與倍率同改 → 整組重套
            }
        })

        it('UD9 首次(無上次快照)不標記為僅倍率(負向); 由自訂地形改回預設(未給 terrainMap)而僅差倍率時標記為僅倍率', function() {
            let r1 = judge(null, cloneDeep(defTm))
            assert.strictEqual(r1.terrainChanged, true) //J-exag: 首次須套用
            assert.ok(!r1.terrainExaggerationOnly) //J-exag: 首次無從就地更新
            let r2 = computePanelBaseMaps({ panelBaseMaps: { baseMaps: [base()] } }, [], { ...cloneDeep(defTm), exaggeration: 3 }, null, [base()], defTm)
            assert.strictEqual(r2.terrainChanged, true) //J-exag: 由自訂改回預設(未給 terrainMap)
            assert.strictEqual(r2.terrainExaggerationOnly, true) //J-exag: 預設地形與自訂地形僅差倍率 → 仍屬僅倍率(來源相同)
        })
    })

    describe('A2 updateTerrainExaggeration(就地更新)', function() {

        //假 map: 記錄呼叫; getSource/getTerrain 供守門判斷
        let genTerrainMap = ({ hasSrc = true, terrain = { source: 'terrain-src', exaggeration: 1.5 }, throwOnSet = false } = {}) => {
            let calls = []
            return {
                calls,
                getSource: (id) => (hasSrc && id === 'terrain-src' ? {} : undefined),
                getLayer: () => undefined,
                getTerrain: () => terrain,
                setTerrain: (spec) => {
                    calls.push(['setTerrain', spec])
                    if (throwOnSet) throw new Error('boom')
                },
                addSource: (...a) => calls.push(['addSource', ...a]),
                removeSource: (...a) => calls.push(['removeSource', ...a]),
                addLayer: (...a) => calls.push(['addLayer', ...a]),
                removeLayer: (...a) => calls.push(['removeLayer', ...a]),
            }
        }
        let fn = () => {
            assert.strictEqual(typeof basemapManager.updateTerrainExaggeration, 'function', 'basemapManager 應匯出 updateTerrainExaggeration') //J-exag
            return basemapManager.updateTerrainExaggeration
        }

        it('UD10 同來源就地 setTerrain 一次, 不移除/新增來源或圖層, 回 true', function() {
            let m = genTerrainMap()
            let ok = fn()(m, { terrainSource: { url: 'https://d/{z}/{x}/{y}.png' }, exaggeration: 3 })
            assert.strictEqual(ok, true) //J-exag: 就地完成
            assert.deepStrictEqual(m.calls, [['setTerrain', { source: 'terrain-src', exaggeration: 3 }]]) //J-exag: 同來源、只改倍率; 無 setTerrain(null)、removeSource、addSource
        })

        it('UD11 倍率值之解讀與整組重套一致: 數字字串轉數字, 非數值用預設 1.5', function() {
            let m1 = genTerrainMap(); fn()(m1, { exaggeration: '2.5' })
            assert.deepStrictEqual(m1.calls[0][1], { source: 'terrain-src', exaggeration: 2.5 }) //J-exag: 可給數字字串
            let m2 = genTerrainMap(); fn()(m2, { exaggeration: 'abc' })
            assert.deepStrictEqual(m2.calls[0][1], { source: 'terrain-src', exaggeration: 1.5 }) //J-exag: 非數值視為未給 → 預設 1.5
            let m3 = genTerrainMap(); fn()(m3, {})
            assert.deepStrictEqual(m3.calls[0][1], { source: 'terrain-src', exaggeration: 1.5 }) //J-exag: 未給 → 預設 1.5
        })

        it('UD12 負向: 目前無地形來源/未啟用地形/來源不符/setTerrain 拋錯/參數無效 → 回 false 且不留半套(由呼叫端改走整組重套)', function() {
            let m1 = genTerrainMap({ hasSrc: false })
            assert.strictEqual(fn()(m1, { exaggeration: 3 }), false) //J-exag: 無 terrain-src → 不可就地
            assert.deepStrictEqual(m1.calls, [])
            let m2 = genTerrainMap({ terrain: null })
            assert.strictEqual(fn()(m2, { exaggeration: 3 }), false) //J-exag: 地形未啟用 → 不可就地
            assert.deepStrictEqual(m2.calls, [])
            let m3 = genTerrainMap({ terrain: { source: 'other', exaggeration: 1 } })
            assert.strictEqual(fn()(m3, { exaggeration: 3 }), false) //J-exag: 地形來源非 terrain-src → 不可就地
            assert.deepStrictEqual(m3.calls, [])
            let m4 = genTerrainMap({ throwOnSet: true })
            assert.strictEqual(fn()(m4, { exaggeration: 3 }), false) //J-exag: 就地失敗 → 回 false 交由呼叫端整組重套
            assert.strictEqual(fn()(null, { exaggeration: 3 }), false) //J-exag: map 缺
            assert.strictEqual(fn()(genTerrainMap(), null), false) //J-exag: terrainMap 非物件
        })
    })
})
