// e2e: 底圖疊加層 maxzoom(圖磚服務層級上限)之畫面行為
//
// 規格句(src/components/WMaplibreglVue.vue 之 @vue-prop baseMaps[i].maxzoom, 以下代稱 J-max):
//   「即服務實際提供圖磚之最深圖磚層級(非地圖顯示層級: 256px圖磚於地圖層級z時約請求z+1級),
//    超過時改以該級圖磚放大顯示, 避免請求不存在之層級致圖層空白並報錯」「不給則沿用maplibre預設」
// 執行期變更(CLAUDE_rulebook.md R8, 以下代稱 J-diff): source 欄位變更走完整重建而即時生效。
//
// 真實 user path(6 步):
//   1. 開首頁(App.vue 範例選單)
//   2. 點主選單 panelBaseMaps > 子選單 baseMap.maxzoom(真實點擊)
//   3. 看到地圖(18 級, 無地形)與底圖面板之兩個未勾選疊加層(紅 maxzoom:18、藍 未給maxzoom)
//   4. 勾選面板之疊加層 checkbox; E2E-B 另點頁面按鈕 #btnSetMaxzoom(執行期補上 maxzoom)
//   5. 觀察地圖中央取樣區之顏色(疊加層顯示與否)與頁面 #overRed/#overBlue(19 級以上圖磚請求次數)
//   6. (補強)讀 window.__getMapStyle() 之 source.maxzoom
//
// 按鈕全清單比對(範例頁): [主選單 panelBaseMaps, 子選單 baseMap.maxzoom, #btnSetMaxzoom,
//   面板紅/藍 checkbox, 面板透明度滑桿×2, 縮放 +/- 按鈕, 地圖 canvas]。
//   covered: 主選單、子選單、紅 checkbox(E2E-A)、藍 checkbox 與 #btnSetMaxzoom(E2E-B)。
//   uncovered(非本 spec 標的): 透明度滑桿(屬 paint, 由 AppPBM* 生態)、縮放按鈕與 canvas 拖曳(既有 hover/displayorder 已涵蓋地圖互動)。
//
// 圖磚: 範例頁以 maplibregl.addProtocol('e2ezlim') 供應 1x1 純色 PNG, 只提供 0~18 級(19 級以上回失敗), 永不連外。
// 斷言以使用者可觀察為主(取樣區顏色比例、頁面計數文字), style 快照僅作補強。
// 標準圖政策: 依 CLAUDE_rulebook.md〈e2e 映射〉無跨 run 標準圖(當次區域取樣)。無 i18n, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-A 服務上限層級顯示: 勾選「紅 maxzoom:18」→ 地圖 18 級時取樣區顯示紅色(以 18 級圖磚放大);
//               #overRed 維持 0(未請求不存在之 19 級), 無 e2ezlim 錯誤訊息; source.maxzoom===18(補強)
//   - E2E-B 執行期補上 maxzoom: 勾選「藍 未給maxzoom」→ #overBlue 大於 0 且取樣區非藍(前置: 請求不存在之層級而空白);
//               點 #btnSetMaxzoom → 取樣區轉為藍色, 其後 #overBlue 不再增加; source.maxzoom===18(補強)
import assert from 'assert'
import { PNG } from 'pngjs'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'

const RED = [220, 40, 40]
const BLUE = [40, 70, 230]

//取樣區中與目標色相近(各通道差 ≤ 40)之像素比例
function colorRatio(buf, rgb) {
    let png = PNG.sync.read(buf)
    let n = png.width * png.height
    let hit = 0
    for (let i = 0; i < n; i++) {
        let d = Math.max(Math.abs(png.data[i * 4] - rgb[0]), Math.abs(png.data[i * 4 + 1] - rgb[1]), Math.abs(png.data[i * 4 + 2] - rgb[2]))
        if (d <= 40) hit++
    }
    return hit / n
}

describe('e2e-basemapzoom', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    let errs = null
    let clip = null
    beforeEach(async function() {
        browser = await launchChromium({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } })
        page = await ctx.newPage()
        errs = []
        page.on('console', (m) => {
            if (m.type() === 'error') errs.push(m.text())
        })
        page.on('pageerror', (e) => errs.push(String(e.message)))
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
        clip = null
    })

    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsMainMenu-basic', { hasText: 'panelBaseMaps' }).first().click()
        await page.locator('.clsSubMenu-basic', { hasText: 'baseMap.maxzoom' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'))
        await waitUntilExist(page, '頁面計數 #overRed', () => !!document.querySelector('#overRed'))
        await page.waitForTimeout(1500) //地圖 load + idle 就位(無外部請求)
        let cbb = await page.locator('.maplibregl-canvas').boundingBox()
        //取樣區: 畫布中央 40x40(遠離四角面板)
        clip = { x: Math.round(cbb.x + cbb.width / 2 - 20), y: Math.round(cbb.y + cbb.height / 2 - 20), width: 40, height: 40 }
    }
    //輪詢至取樣區目標色比例滿足條件(圖層顯示須經圖磚載入+render, 固定等待易搶拍); 逾時回最後比例交由呼叫端斷言
    let waitRatio = async (rgb, pred, { rounds = 20, interval = 300 } = {}) => {
        let r = 0
        for (let i = 0; i < rounds; i++) {
            await page.waitForTimeout(interval)
            r = colorRatio(await page.screenshot({ clip }), rgb)
            if (pred(r)) return r
        }
        return r
    }
    let readCount = async (sel) => Number(await page.locator(sel).innerText())
    let sourceMaxzoom = async (colorKey) => {
        return await page.evaluate((ck) => {
            let st = window.__getMapStyle ? window.__getMapStyle() : null
            if (!st) return null
            let k = Object.keys(st.sources).find((id) => id.indexOf('basemap-src-') === 0 && id.indexOf(ck) >= 0)
            return k ? (st.sources[k].maxzoom === undefined ? 'absent' : st.sources[k].maxzoom) : null
        }, colorKey)
    }

    it('E2E-A 服務上限層級顯示: 帶 maxzoom 18 之疊加層於 18 級以 18 級圖磚放大顯示, 不請求不存在之層級', async function() {
        await gotoExample()
        assert.ok(colorRatio(await page.screenshot({ clip }), RED) < 0.05, '勾選前取樣區不應為紅色')

        await page.locator('label', { hasText: '紅 maxzoom:18' }).locator('input[type=checkbox]').click()
        //J-max: 超過時改以該級圖磚放大顯示 → 地圖 18 級(請求層級 19)時取樣區顯示紅色疊加層
        let r = await waitRatio(RED, (v) => v > 0.9)
        assert.ok(r > 0.9, `勾選帶 maxzoom 18 之紅色疊加層後取樣區應顯示紅色, 實際紅色比例 ${r.toFixed(3)}`)

        await page.waitForTimeout(1000) //觀察窗: 確認其後亦無不存在層級之請求
        //J-max: 避免請求不存在之層級 → 19 級以上請求次數維持 0
        assert.strictEqual(await readCount('#overRed'), 0, '帶 maxzoom 18 之疊加層不應請求 19 級以上之圖磚')
        //J-max: (避免)…並報錯 → 無 e2ezlim 圖磚錯誤訊息
        let tileErrs = errs.filter((t) => t.includes('e2ezlim'))
        assert.strictEqual(tileErrs.length, 0, `不應有圖磚錯誤訊息, 實際: ${tileErrs.slice(0, 2).join(' | ')}`)
        //補強(J-max 帶入 source): source.maxzoom 為 18
        assert.strictEqual(await sourceMaxzoom('red'), 18)
    })

    it('E2E-B 執行期補上 maxzoom: 未給 maxzoom 之疊加層空白, 補上 maxzoom 18 後即顯示且不再請求不存在之層級', async function() {
        await gotoExample()

        await page.locator('label', { hasText: '藍 未給maxzoom' }).locator('input[type=checkbox]').click()
        //前置(J-max「不給則沿用maplibre預設」→ 請求不存在之層級致圖層空白並報錯): 19 級請求發生且取樣區非藍
        await waitUntilExist(page, '#overBlue > 0(已請求不存在之 19 級)', () => Number(document.querySelector('#overBlue').innerText) > 0)
        await page.waitForTimeout(1000) //待該輪請求全數失敗、render 就位
        let rBefore = colorRatio(await page.screenshot({ clip }), BLUE)
        assert.ok(rBefore < 0.05, `未給 maxzoom 時取樣區應為空白(非藍), 實際藍色比例 ${rBefore.toFixed(3)}`)
        assert.strictEqual(await sourceMaxzoom('blue'), 'absent') //補強: 未給則 source 不含 maxzoom

        let nBefore = await readCount('#overBlue')
        await page.locator('#btnSetMaxzoom').click()
        //J-max + J-diff: 執行期補上 maxzoom 18 → 完整重建後以 18 級圖磚放大顯示, 取樣區轉為藍色
        let r = await waitRatio(BLUE, (v) => v > 0.9)
        assert.ok(r > 0.9, `補上 maxzoom 18 後取樣區應顯示藍色, 實際藍色比例 ${r.toFixed(3)}`)

        await page.waitForTimeout(1000) //觀察窗
        //J-max: 避免請求不存在之層級 → 補上後 19 級請求次數不再增加
        assert.strictEqual(await readCount('#overBlue'), nBefore, '補上 maxzoom 後不應再請求 19 級以上之圖磚')
        //補強(J-diff 重建後帶入 source): source.maxzoom 為 18
        assert.strictEqual(await sourceMaxzoom('blue'), 18)
    })
})
