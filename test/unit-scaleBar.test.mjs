// unit: 比例尺之距離與色條寬(src/js/scaleBar.mjs; 規則帳本 R15)
//
// 規則(以下 J-xxx 代稱; 每條斷言註解標明對應):
//   J-true  文字為色條實寬對應之實際地面距離: 距離 / 每像素公尺 = 色條寬(512px 世界: mpp = 78271.51696 × cos(緯度) / 2^zoom)
//   J-nice  距離為色條上限寬(80px)內最大之整齊距離(1、2、3、5 × 10^n 公尺)
//   J-max   色條寬不超過 80px, 且大於 40px(相鄰整齊距離之比不超過 2)
//   J-lat   緯度 0 為有效值; 非有限數字或超出 ±90 才回退預設緯度 23.5
//   J-text  1000 m 以上以 km(必為 1 以上整數), 其餘以 m(必小於 1000); 小於 1 m 以固定小數位表示, 不出現科學記號
//   J-edge  極端輸入(緯度 ±90、層級極大極小、非數字)仍得有限之文字與 (40, 80] px 之色條寬
//
// 無 UI 之純函式; 畫面行為(色條實寬、box-sizing、與地圖實際距離之比值)見 e2e-zoomrange E2E-Z16/Z16b/Z16c、e2e-runtime E2E-005。
import assert from 'assert'
import { computeScaleBar, niceDistance } from '../src/js/scaleBar.mjs'

//獨立於被測碼之每像素公尺(J-true 之依據)
let mppOf = (lat, zoom) => 78271.51696 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
let LATS = [0, 23.82, 24.7, 25, 60, -33]
let zoomsAll = () => {
    let a = []
    for (let z = 0; z <= 24; z += 0.25) a.push(z)
    return a
}
//距離之首位有效數字(字串, 免浮點): 0.3 → '3', 5000 → '5'
let headOf = (meters) => meters.toExponential().split('e')[0]

describe('unit-scaleBar', function() {

    it('U56 6 個緯度 × 縮放 0~24 每 0.25 級: 文字恆與色條相符(J-true)、距離為整齊值(J-nice)、色條寬 (40, 80] px(J-max)', function() {
        let n = 0
        for (let lat of LATS) {
            for (let zoom of zoomsAll()) {
                let r = computeScaleBar(lat, zoom)
                let mpp = mppOf(lat, zoom)
                let tag = `lat ${lat}, zoom ${zoom}`
                //J-true: 色條寬 = 距離 / 每像素公尺
                assert.ok(Math.abs(r.meters / mpp - r.width) < 1e-6 * Math.max(1, r.width), `${tag} 色條寬與距離相符(寬 ${r.width}, 距離 ${r.meters}, mpp ${mpp})`)
                //J-max: 不超過上限, 且大於上限之 1/2
                assert.ok(r.width <= 80 + 1e-9, `${tag} 不超過 80 px(實得 ${r.width})`)
                assert.ok(r.width > 40 - 1e-9, `${tag} 大於 40 px(實得 ${r.width})`)
                //J-nice: 首位有效數字為 1、2、3、5 且僅一位有效數字
                assert.ok(['1', '2', '3', '5'].includes(headOf(r.meters)), `${tag} 整齊距離(實得 ${r.meters})`)
                //J-nice: 為上限內最大者, 即再大一級整齊距離必超過 80 px
                let nextOf = { 1: 2, 2: 3, 3: 5, 5: 10 }[headOf(r.meters)] * r.meters / Number(headOf(r.meters))
                assert.ok(nextOf / mpp > 80 - 1e-9, `${tag} 應為 80 px 內最大之整齊距離(次一級 ${nextOf} m 為 ${nextOf / mpp} px)`)
                n++
            }
        }
        assert.strictEqual(n, 6 * 97, '涵蓋 6 個緯度 × 97 個層級')
    })

    it('U57 文字與單位(J-text): 各整齊值之 km / m / 小於 1 m 表示, 且全網格不出現「0.5 km」「1000 m」「科學記號」', function() {
        //以手算期望值(80px 距離 → 整齊距離): 5 → 5、3 → 3、2 → 2、1 → 1 各至少一例
        assert.strictEqual(computeScaleBar(0, 10).text, '5 km') //80px 為 6114.9 m
        assert.strictEqual(computeScaleBar(0, 12).text, '1 km') //1528.7 m, 修前顯示 2 km
        assert.strictEqual(computeScaleBar(24.7, 12).text, '1 km') //1387 m, 修前顯示 1 km 而色條實為 1422 m
        assert.strictEqual(computeScaleBar(23.82, 7).text, '30 km') //44.8 km
        assert.strictEqual(computeScaleBar(24.7, 8).text, '20 km') //22.2 km
        assert.strictEqual(computeScaleBar(25, 16).text, '50 m') //86.6 m
        assert.strictEqual(computeScaleBar(60, 3).text, '300 km') //391 km
        assert.strictEqual(computeScaleBar(60, 22).text, '0.5 m') //0.7465 m
        assert.strictEqual(computeScaleBar(0, 0).text, '5000 km') //6262 km
        //恰為整齊值之邊界: 500 m 以 m、1000 m 以 km
        assert.strictEqual(niceDistance(500).meters, 500)
        assert.strictEqual(niceDistance(999.9).meters, 500)
        assert.strictEqual(niceDistance(1000).meters, 1000)

        for (let lat of [...LATS, 89.9, 0.001]) {
            for (let zoom of zoomsAll()) {
                let { text, meters } = computeScaleBar(lat, zoom)
                let tag = `lat ${lat}, zoom ${zoom} → 「${text}」`
                let m = text.match(/^(\d+(?:\.\d+)?) (km|m)$/)
                assert.ok(m, `${tag} 格式`)
                let v = Number(m[1])
                if (m[2] === 'km') {
                    assert.ok(Number.isInteger(v) && v >= 1, `${tag} km 須為 1 以上整數`)
                    assert.strictEqual(v * 1000, meters, `${tag} km 值與距離一致`)
                }
                else {
                    assert.ok(v < 1000, `${tag} m 須小於 1000`)
                    assert.strictEqual(v, meters, `${tag} m 值與距離一致`)
                    if (v < 1) assert.ok(/^0\.\d*[1-9]$/.test(m[1]), `${tag} 小於 1 m 以固定小數位表示, 且不以 0 結尾`)
                    else assert.ok(Number.isInteger(v), `${tag} 1 m 以上為整數`)
                }
                assert.ok(!/e/i.test(text), `${tag} 不得有科學記號`)
            }
        }
    })

    it('U58 緯度(J-lat): 緯度 0 為有效值, 非數字/非有限/超出 ±90 回退 23.5, ±90 內含邊界有效, 南北對稱', function() {
        //緯度 0 之色條寬 5000 / 76.44 = 65.41 px; 回退 23.5 度為 71.3 px, 兩者可鑑別
        let w0 = computeScaleBar(0, 10).width
        assert.ok(Math.abs(w0 - 65.41) < 0.01, `緯度 0 之色條寬(實得 ${w0})`)
        let wDef = computeScaleBar(23.5, 10).width
        assert.ok(Math.abs(wDef - 5000 / mppOf(23.5, 10)) < 1e-6, `緯度 23.5 之色條寬(實得 ${wDef})`)
        assert.ok(Math.abs(w0 - wDef) > 5, '緯度 0 與回退 23.5 之色條寬應可區分')
        for (let bad of [undefined, null, 'x', '24.7', NaN, Infinity, -Infinity, 90.0001, -91, 1e9, {}, []]) {
            let r = computeScaleBar(bad, 10)
            assert.strictEqual(r.width, wDef, `緯度 ${String(bad)} 應回退 23.5`)
            assert.strictEqual(r.text, '5 km')
        }
        assert.strictEqual(computeScaleBar(25, 14).width, computeScaleBar(-25, 14).width, '南北對稱')
        assert.ok(Number.isFinite(computeScaleBar(90, 10).width) && Number.isFinite(computeScaleBar(-90, 10).width), '±90 為有效緯度')
    })

    it('U59 恰為 10 的次方(Math.log10 浮點誤差): 上限恰為 10^k 時得 1 × 10^k, 略小於時得 5 × 10^(k-1), 2、3、5 × 10^k 邊界亦然', function() {
        for (let k = -12; k <= 9; k++) {
            let p = Number('1e' + k)
            let at = niceDistance(p)
            assert.strictEqual(at.meters, p, `上限恰為 1e${k} 應得 1e${k}(實得 ${at.meters})`)
            assert.strictEqual(at.exp, k)
            //略小於 10^k(減 1e-12 相對量): 首位 9.99.. → 5 × 10^(k-1)
            let below = niceDistance(p * (1 - 1e-12))
            assert.strictEqual(below.meters, Number('5e' + (k - 1)), `上限略小於 1e${k} 應得 5e${k - 1}(實得 ${below.meters})`)
            //略大於 10^k: 仍為 1 × 10^k
            assert.strictEqual(niceDistance(p * (1 + 1e-12)).meters, p, `上限略大於 1e${k} 應得 1e${k}`)
            //2、3、5 × 10^k 恰為邊界
            for (let h of [2, 3, 5]) {
                let v = Number(h + 'e' + k)
                assert.strictEqual(niceDistance(v).meters, v, `上限恰為 ${v} 應得 ${v}`)
                assert.ok(niceDistance(v * (1 - 1e-12)).meters < v, `上限略小於 ${v} 應降一級`)
            }
        }
        //小於 1 的 10 的次方(不依賴引擎之 Math.log10 是否精確)
        assert.strictEqual(niceDistance(0.001).meters, 0.001)
        assert.strictEqual(niceDistance(1e-7).meters, 1e-7)
    })

    it('U60 極端輸入(J-edge): 緯度 ±90、層級極大極小、非數字仍得有限之文字與 (40, 80] px 色條寬', function() {
        let cases = [
            [90, 24], [-90, 24], [89.9999, 40], [90, -10], [0, -10], [0, 40], [0, 1e6], [0, -1e6],
            [0, NaN], [0, Infinity], [0, -Infinity], [0, undefined], [0, null], [0, '7'], [NaN, NaN], [undefined, undefined],
        ]
        for (let [lat, zoom] of cases) {
            let r = computeScaleBar(lat, zoom)
            let tag = `lat ${lat}, zoom ${zoom} → 「${r.text}」`
            assert.ok(Number.isFinite(r.meters) && r.meters > 0, `${tag} 距離為有限正數`)
            assert.ok(Number.isFinite(r.width) && r.width > 40 - 1e-9 && r.width <= 80 + 1e-9, `${tag} 色條寬(實得 ${r.width})`)
            assert.ok(/^\d+(\.\d+)? (km|m)$/.test(r.text), `${tag} 格式`)
            assert.ok(!/e|NaN|Infinity/i.test(r.text), `${tag} 無科學記號/NaN/Infinity`)
        }
        //非有限層級回退預設層級 7(同元件 data 預設)
        assert.deepStrictEqual(computeScaleBar(25, NaN), computeScaleBar(25, 7))
        assert.deepStrictEqual(computeScaleBar(25, undefined), computeScaleBar(25, 7))
    })

    it('U61 Math.log10 偏小(其他引擎可能): 以 Math.log(x) / Math.LN10 暫代(Math.log(1000) / Math.LN10 = 2.9999999999999996), 恰為 10 的次方仍得 1 × 10^k', function() {
        //V8 之 Math.log10 於 10 的次方皆精確(U59 於本機走不到修正分支), 故以會偏小的實作暫代以鑑別「比較修正」是否存在
        let orig = Math.log10
        Math.log10 = (x) => Math.log(x) / Math.LN10
        try {
            assert.ok(Math.floor(Math.log10(1000)) === 2, '前提: 暫代之 log10(1000) 偏小(floor 得 2)')
            let bad = 0
            for (let k = -12; k <= 9; k++) {
                let p = Number('1e' + k)
                if (Math.floor(Math.log10(p)) !== k) bad++
                assert.strictEqual(niceDistance(p).meters, p, `上限恰為 1e${k} 應得 1e${k}`)
                assert.strictEqual(niceDistance(p).exp, k, `上限恰為 1e${k} 之指數應為 ${k}`)
            }
            assert.ok(bad > 0, '前提: 暫代之 log10 於至少一個 10 的次方偏小')
        }
        finally {
            Math.log10 = orig
        }
    })

})
