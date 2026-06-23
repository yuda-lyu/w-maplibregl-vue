// e2e: displayOrderByType（圖徵展示順序 / 點擊優先權）
//
// 真實 user path（6 步）:
//   1. 開首頁(App.vue 範例選單)
//   2. 點 basic > displayOrderByType 子選單(真實點擊選單項)
//   3. 看到地圖: 一個面(polygon)覆蓋住一個點(point), 點位於地圖正中央
//   4. (E2E-002 額外) 真實點擊 checkbox 取消勾選 displayOrderByType
//   5. 真實點擊地圖正中央(點所在處, 與面重疊)
//   6. 觀察開啟哪個 popup: ON→point popup, OFF→polygon popup
//
// 按鈕全清單比對: 範例頁可點元素 = [子選單項, #chkOrder checkbox, 地圖 canvas] — 三者本測試皆有真實點擊。
// act 全走 user-facing(滑鼠點擊選單/checkbox/canvas); assert 走 user-facing(popup 顯示文字)。
// 無 i18n 文字差異(範例固定中英標籤), 故單一變體。每個 it() 各自 new browser。
import assert from 'assert'
import { chromium } from 'playwright'
import { baseUrl, startServer, waitUntilExist } from './e2e-setup.mjs'

describe('e2e-displayorder', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    beforeEach(async function() {
        browser = await chromium.launch({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } })
        page = await ctx.newPage()
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
    })

    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsSubMenu-basic', { hasText: 'displayOrderByType' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'))
        await page.waitForTimeout(2000) // 等點圖層(circle 同步加入)render + idle 型別重排就位
    }
    let clickMapCenter = async () => {
        let c = await page.locator('.maplibregl-canvas').boundingBox() // 點位於 opt.center, 即 canvas 正中央
        await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2)
        await page.waitForTimeout(600)
    }
    let popupText = async () => {
        let el = await page.$('.maplibregl-popup-content')
        return el ? (await el.innerText()) : ''
    }

    it('E2E-001 displayOrderByType=ON: 點面重疊處點擊 → 命中點, 開 point popup', async function() {
        await gotoExample()
        await clickMapCenter()
        let t = await popupText()
        // spec: 開啟時點在最上層、點擊命中小面積圖徵(點)而非被面攔截
        assert.ok(t.includes('[Point popup]'), `應開 point popup, 實際 popup 文字=${JSON.stringify(t)}`)
        assert.ok(!t.includes('[Polygon popup]'), `不應開 polygon popup, 實際 popup 文字=${JSON.stringify(t)}`)
    })

    it('E2E-002 displayOrderByType=OFF: 取消勾選後同處點擊 → 回到面勝, 開 polygon popup', async function() {
        await gotoExample()
        await page.locator('#chkOrder').click() // 真實點擊取消勾選 → opt.displayOrderByType=false
        await page.waitForTimeout(400)
        await clickMapCenter()
        let t = await popupText()
        // 對照組: 關閉時不做點擊優先權, 回到 maplibre 各 listener 皆觸發、最後者(面)勝
        assert.ok(t.includes('[Polygon popup]'), `關閉後應開 polygon popup, 實際 popup 文字=${JSON.stringify(t)}`)
    })

})
