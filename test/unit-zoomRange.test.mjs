// unit: 圖台縮放範圍(opt.minZoom/maxZoom)與 opt.zoom/center 正規化、執行期範圍套用
//
// 以假 map 驗證 applyZoomRange(不需瀏覽器); 每條 assertion 註明對應之規格句(src/components/WMaplibreglVue.vue 之 @vue-prop, 以下代稱)與
// CLAUDE_rulebook.md 規則:
//   J-zoom  opt.zoom: 「可給數字或數字字串, 非數值視為未給(預設6)」「元件不另夾值, 超出範圍者由地圖拉入範圍並以地圖實際層級寫回」(R11、R13)
//   J-min   opt.minZoom: 「預設0, 夾在0~24, 可給數字或數字字串, 非數值或非有限數視為未給, 大於maxZoom時忽略minZoom並console.warn」(R11)
//   J-max   opt.maxZoom: 「預設22, 夾在0~24, 給法同minZoom」(R11)
//   J-ctr   opt.center: 「兩值皆須為有限數且緯度在±90內, 否則視為未給(預設[23.5, 121.1])」(R13)
//   J-apply 執行期變更範圍: maplibre 之 setMinZoom 於新 min 大於現行 max 時拋錯、setMaxZoom 於新 max 小於現行 min 時拋錯
//           (maplibre-gl-dev.mjs setMinZoom/setMaxZoom), 套用時不得拋錯且結果須為新範圍(R11)
import assert from 'assert'
import { computeZoomRange, computeBasicOpt } from '../src/js/configProcessor.mjs'
import { applyZoomRange } from '../src/js/mapCore.mjs'

//仿 maplibre 6.14.0 之 Map#setMinZoom/setMaxZoom 驗證(拋錯條件同其原始碼 setMinZoom/setMaxZoom)
function fakeMap(min, max) {
    let st = { min, max }
    return {
        st,
        getMinZoom: () => st.min,
        getMaxZoom: () => st.max,
        setMinZoom(v) {
            if (!(v >= -2 && v <= st.max)) throw new Error('minZoom must be between -2 and the current maxZoom, inclusive')
            st.min = v; return this
        },
        setMaxZoom(v) {
            if (!(v >= st.min)) throw new Error('maxZoom must be greater than the current minZoom')
            st.max = v; return this
        },
    }
}

//暫時攔截 console.warn
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

const DEF_CENTER = [23.5, 121.1]

describe('unit-zoomRange', function() {

    it('U17 J-min/J-max 未給時範圍為 0~22', function() {
        assert.deepStrictEqual(computeZoomRange({}), { minZoom: 0, maxZoom: 22, ignoredMin: false })
        assert.deepStrictEqual(computeZoomRange(null), { minZoom: 0, maxZoom: 22, ignoredMin: false })
        assert.deepStrictEqual(computeZoomRange(undefined), { minZoom: 0, maxZoom: 22, ignoredMin: false })
    })

    it('U18 J-min/J-max 數字字串依數值; 非數值/非有限視為未給用預設', function() {
        assert.deepStrictEqual(computeZoomRange({ minZoom: '3', maxZoom: ' 15 ' }), { minZoom: 3, maxZoom: 15, ignoredMin: false })
        for (let bad of ['abc', '', ' ', NaN, Infinity, -Infinity, null, true, [], {}]) {
            let r = computeZoomRange({ minZoom: bad, maxZoom: bad })
            assert.deepStrictEqual(r, { minZoom: 0, maxZoom: 22, ignoredMin: false }, `輸入 ${String(bad)}`)
        }
    })

    it('U19 J-min/J-max 夾在 0~24; 小數保留', function() {
        assert.strictEqual(computeZoomRange({ minZoom: -5 }).minZoom, 0)
        assert.strictEqual(computeZoomRange({ maxZoom: 30 }).maxZoom, 24)
        assert.strictEqual(computeZoomRange({ maxZoom: -1 }).maxZoom, 0)
        assert.deepStrictEqual(computeZoomRange({ minZoom: 4.5, maxZoom: 14.25 }), { minZoom: 4.5, maxZoom: 14.25, ignoredMin: false })
    })

    it('U20 J-min minZoom 大於 maxZoom 時忽略 minZoom(保留 maxZoom), 並標記 ignoredMin', function() {
        assert.deepStrictEqual(computeZoomRange({ minZoom: 14, maxZoom: 10 }), { minZoom: 0, maxZoom: 10, ignoredMin: true })
        //只給 minZoom 且大於預設 maxZoom(24 夾後仍大於 22)
        assert.deepStrictEqual(computeZoomRange({ minZoom: 23 }), { minZoom: 0, maxZoom: 22, ignoredMin: true })
        //相等為合法(定值層級)
        assert.deepStrictEqual(computeZoomRange({ minZoom: 10, maxZoom: 10 }), { minZoom: 10, maxZoom: 10, ignoredMin: false })
        //maxZoom 為 0 為有效值(不可被視為未給)
        assert.deepStrictEqual(computeZoomRange({ maxZoom: 0 }), { minZoom: 0, maxZoom: 0, ignoredMin: false })
    })

    it('U21 J-zoom computeBasicOpt 不夾 opt.zoom: 0、超過 22、負值原樣交給地圖', function() {
        assert.strictEqual(computeBasicOpt({ zoom: 20 }).zoom, 20)
        assert.strictEqual(computeBasicOpt({ zoom: 0 }).zoom, 0)
        assert.strictEqual(computeBasicOpt({ zoom: 25 }).zoom, 25)
        assert.strictEqual(computeBasicOpt({ zoom: -3 }).zoom, -3)
        assert.strictEqual(computeBasicOpt({ zoom: 10.123456789 }).zoom, 10.123456789)
        //±Infinity 亦原樣交地圖(由地圖夾至範圍端點, 元件以實際層級回寫)
        assert.strictEqual(computeBasicOpt({ zoom: Infinity }).zoom, Infinity)
        assert.strictEqual(computeBasicOpt({ zoom: -Infinity }).zoom, -Infinity)
    })

    it('U22 J-zoom 數字字串轉為數字; 非數值/未給為預設 6', function() {
        assert.strictEqual(computeBasicOpt({ zoom: '19' }).zoom, 19)
        for (let bad of [undefined, null, 'abc', NaN, true, {}]) {
            assert.strictEqual(computeBasicOpt({ zoom: bad }).zoom, 6, `輸入 ${String(bad)}`)
        }
        assert.strictEqual(computeBasicOpt({}).zoom, 6)
    })

    it('U23 computeBasicOpt 回傳之範圍與 computeZoomRange 一致(單一擁有者)', function() {
        let b = computeBasicOpt({ minZoom: 5, maxZoom: 12 })
        assert.strictEqual(b.minZoom, 5); assert.strictEqual(b.maxZoom, 12); assert.strictEqual(b.ignoredMin, false)
        let b2 = computeBasicOpt({ minZoom: 9, maxZoom: 3 })
        assert.strictEqual(b2.minZoom, 0); assert.strictEqual(b2.maxZoom, 3); assert.strictEqual(b2.ignoredMin, true)
        let b3 = computeBasicOpt({})
        assert.strictEqual(b3.minZoom, 0); assert.strictEqual(b3.maxZoom, 22); assert.strictEqual(b3.ignoredMin, false) //J-min/J-max 預設 0/22
    })

    it('U24 J-apply 範圍轉換不拋錯且結果為新範圍(含新舊範圍不相交之兩個方向)', function() {
        let cases = [
            [[0, 22], [3, 6]], //縮小
            [[3, 6], [18, 20]], //不相交往上: 須先 setMaxZoom
            [[18, 20], [1, 4]], //不相交往下: 須先 setMinZoom
            [[1, 4], [0, 22]], //放寬
            [[5, 5], [10, 10]], //定值互換
            [[0, 22], [0, 22]], //不變
        ]
        for (let [from, to] of cases) {
            let m = fakeMap(from[0], from[1])
            applyZoomRange(m, { minZoom: to[0], maxZoom: to[1] })
            assert.deepStrictEqual([m.st.min, m.st.max], to, `${from} → ${to}`)
        }
    })

    it('U25 J-apply 之鑑別力: 若不依序而先設 minZoom, 仿真 map 於不相交往上之轉換會拋錯', function() {
        let m = fakeMap(3, 6)
        assert.throws(() => {
            m.setMinZoom(18)
            m.setMaxZoom(20)
        }, /minZoom must be between/)
        let m2 = fakeMap(18, 20)
        assert.throws(() => {
            m2.setMaxZoom(4)
            m2.setMinZoom(1)
        }, /maxZoom must be greater/)
    })

    it('U26 J-apply map 缺或 setter 拋非預期錯時不外洩例外', function() {
        applyZoomRange(null, { minZoom: 1, maxZoom: 2 })
        let m = fakeMap(0, 22)
        m.setMaxZoom = () => {
            throw new Error('boom')
        }
        let msgs = captureWarn(() => {
            applyZoomRange(m, { minZoom: 1, maxZoom: 5 })
        })
        assert.ok(msgs.length >= 1, '拋錯時應 console.warn')
    })

    it('U30 J-ctr center 兩值皆須為有限數且緯度在±90內, 否則視為未給用預設', function() {
        for (let bad of [[91, 121], [-90.0001, 0], [NaN, NaN], [25, NaN], [Infinity, 121], [25, Infinity], ['25', '121'], [25], [25, 121, 5], 'abc', null, undefined, {}, 25]) {
            assert.deepStrictEqual(computeBasicOpt({ center: bad }).center, DEF_CENTER, `輸入 ${JSON.stringify(bad)}`)
        }
        //合法(含邊界值、經度不限)原樣保留
        for (let ok of [[0, 0], [-90, 180], [90, -180], [25.06, 121.5153], [0, 540]]) {
            assert.deepStrictEqual(computeBasicOpt({ center: ok }).center, ok, `輸入 ${JSON.stringify(ok)}`)
        }
        //回傳為複本(不與 opt.center 同一參考, 免後續就地修改污染父層)
        let c = [25, 121]
        assert.notStrictEqual(computeBasicOpt({ center: c }).center, c)
    })

    it('U31 J-apply 窮舉: 所有「現行範圍 × 新範圍」轉換皆不拋錯且結果為新範圍(含 min==max 定值)', function() {
        let vals = [0, 0.5, 1, 3, 5, 10, 14.25, 18, 22, 24]
        let ranges = []
        for (let a of vals) for (let b of vals) if (a <= b) ranges.push([a, b])
        let n = 0
        for (let from of ranges) {
            for (let to of ranges) {
                let m = fakeMap(from[0], from[1])
                applyZoomRange(m, { minZoom: to[0], maxZoom: to[1] })
                assert.deepStrictEqual([m.st.min, m.st.max], to, `${from} → ${to}`)
                n++
            }
        }
        assert.strictEqual(n, ranges.length * ranges.length)
    })

    it('U32 R13 全函式: computeBasicOpt/computeZoomRange 對異常輸入皆不拋錯且輸出合法', function() {
        let bads = [undefined, null, NaN, Infinity, -Infinity, 0, -1, 99, 1e308, '', ' ', 'abc', '12', true, false, [], [1, 2], {}, { a: 1 }, () => 1, Symbol.iterator]
        let optIns = [undefined, null, 0, 'str', [], () => 1]
        for (let o of optIns) {
            let b = computeBasicOpt(o)
            assert.strictEqual(typeof b.zoom, 'number')
        }
        for (let bz of bads) {
            for (let bc of bads) {
                let opt = { zoom: bz, minZoom: bz, maxZoom: bc, center: [bz, bc] }
                let b = null
                assert.doesNotThrow(() => {
                    b = computeBasicOpt(opt)
                }, `輸入 ${String(bz)}/${String(bc)}`)
                //輸出合法: zoom 為數字(含 ±Infinity, 交地圖夾); 範圍 0<=min<=max<=24; center 為有限數且緯度 ±90 內
                assert.strictEqual(typeof b.zoom, 'number')
                assert.ok(!Number.isNaN(b.zoom))
                assert.ok(b.minZoom >= 0 && b.maxZoom <= 24 && b.minZoom <= b.maxZoom, `範圍 ${b.minZoom}~${b.maxZoom}`)
                assert.ok(Number.isFinite(b.center[0]) && Number.isFinite(b.center[1]) && Math.abs(b.center[0]) <= 90, `center ${b.center}`)
                let r = null
                assert.doesNotThrow(() => {
                    r = computeZoomRange(opt)
                })
                assert.deepStrictEqual({ minZoom: b.minZoom, maxZoom: b.maxZoom, ignoredMin: b.ignoredMin }, r) //單一擁有者(U23)
            }
        }
    })

})
