// e2e: 底圖疊加層 opacity 之面板顯示與實繪一致(預設值與值域單一擁有者, CLAUDE_rulebook.md R14)
//
// 規格句(src/components/WMaplibreglVue.vue 之 @vue-prop baseMaps[i].opacity, 以下代稱 J-opa):
//   「透明度數字(0~1), 可給數字或數字字串, 超出範圍夾限, 非數值視為未給, raster與wms預設1、vector預設0.8(面板滑桿與實繪一致),
//    type為'style'時不支援(各層自帶opacity, 面板亦不顯示滑桿)」
//
// 真實 user path(6 步):
//   1. 開首頁(App.vue 範例選單)
//   2. 點主選單 panelBaseMaps > 子選單 baseMap.opacity(真實點擊)
//   3. 看到地圖與底圖面板之 11 個疊加層(未勾選; 圖層已建立 visibility none)
//   4. (E2E-O4)勾選疊加層 checkbox, Tab 鍵移至其透明度滑桿, 以方向鍵調整(真實鍵盤)
//   5. 觀察面板滑桿 value、百分比文字
//   6. (補強)讀 window.__getMapStyle() 之圖層 paint 設定值, 證明三者一致
//
// 按鈕全清單比對(範例頁): [主選單、子選單、11 個疊加層 checkbox、10 個透明度滑桿〔style 型不渲染〕、縮放 +/- 按鈕、地圖 canvas]。
//   covered: 主選單、子選單、vector fill 之 checkbox 與滑桿(E2E-O4)。uncovered(非本 spec 標的): 其餘 checkbox(顯隱屬 AppPBM* 生態)、縮放按鈕與 canvas。
//
// 標準圖政策: 依 CLAUDE_rulebook.md〈e2e 映射〉無跨 run 標準圖(語意斷言)。無 i18n, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-O1 未給 opacity: raster、wms 面板 1/100%、實繪 1; vector fill/line/fill-extrusion 面板 0.8/80%、實繪 0.8; 明給 0.5 → 0.5/50%/0.5
//   - E2E-O2 無效值: 數字字串 '0.5' → 0.5(圖層仍建立); 1.5 → 夾 1; -0.2 → 夾 0; NaN → 視為未給(raster 預設 1); 面板與實繪一致
//   - E2E-O3 type 為 style 之疊加層: 面板不渲染滑桿與百分比
//   - E2E-O4 使用者以鍵盤調整滑桿(0.8 → 0.7): 面板數字與實繪同步
import assert from 'assert'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'

describe('e2e-opacity', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    let errs = null
    beforeEach(async function() {
        browser = await launchChromium({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } })
        page = await ctx.newPage()
        errs = []
        page.on('pageerror', (e) => errs.push(String(e.message)))
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
    })

    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsMainMenu-basic', { hasText: 'panelBaseMaps' }).first().click()
        await page.locator('.clsSubMenu-basic', { hasText: 'baseMap.opacity' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas') && !!window.__getMapStyle)
        //圖層就緒: style 型疊加層為非同步載入(最後建立, 其後整組重建)→ 見其展開圖層(尾碼 -0-bgop)與首個 raster 疊加層即就緒
        //(不以「全部圖層數」判斷: 無效 opacity 者於修前不會被建立, 以數量等待會卡在前置而掩蓋真正的斷言失敗)
        await waitUntilExist(page, '疊加層圖層已建立', () => {
            let st = window.__getMapStyle()
            return !!st && st.layers.some((l) => String(l.id).endsWith('-0-bgop')) && st.layers.some((l) => String(l.id).endsWith('_ovRasterDef'))
        })
    }
    //該疊加層在面板內之列(label 之後的 div: 滑桿 + 百分比)
    let rowLabel = (name) => page.locator('label').filter({ has: page.getByText(name, { exact: true }) })
    let rowOpa = (name) => rowLabel(name).locator('xpath=following-sibling::div[1]')
    let sliderValue = async (name) => Number(await rowOpa(name).locator('input[type=range]').inputValue())
    let percentText = async (name) => (await rowOpa(name).locator('span').innerText()).trim()
    //實繪 paint 值(由 style 快照, 依圖層 id 尾碼找該疊加層)
    let paintOf = async (token, prop) => await page.evaluate(({ tk, pr }) => {
        let st = window.__getMapStyle()
        let l = st.layers.find((x) => String(x.id).indexOf('basemap-layer-') === 0 && String(x.id).endsWith('_' + tk))
        return l ? { found: true, val: l.paint ? l.paint[pr] : undefined } : { found: false }
    }, { tk: token, pr: prop })

    it('E2E-O1 未給 opacity: raster、wms 面板 1/100%、實繪 1; vector 面板 0.8/80%、實繪 0.8; 明給 0.5 一致', async function() {
        await gotoExample()
        let cases = [
            ['ovRasterDef', 'raster-opacity', 1, '100%'],
            ['ovWms', 'raster-opacity', 1, '100%'],
            ['ovVecFill', 'fill-opacity', 0.8, '80%'],
            ['ovVecLine', 'line-opacity', 0.8, '80%'],
            ['ovVecExt', 'fill-extrusion-opacity', 0.8, '80%'],
            ['ovVecFill05', 'fill-opacity', 0.5, '50%'],
        ]
        for (let [name, prop, want, text] of cases) {
            //J-opa: 面板滑桿與實繪一致(raster預設1、vector預設0.8); 修前 vector 面板恆顯示 1/100% 而實繪 0.8
            let p = await paintOf(name, prop)
            assert.ok(p.found, `${name} 圖層應已建立`)
            assert.strictEqual(p.val, want, `${name} 實繪 ${prop} 應為 ${want}, 實際 ${p.val}`)
            assert.strictEqual(await sliderValue(name), want, `${name} 面板滑桿 value 應為 ${want}`)
            assert.strictEqual(await percentText(name), text, `${name} 面板百分比應為 ${text}`)
        }
    })

    it('E2E-O2 無效值: 數字字串依數值、超界夾限、NaN 視為未給; 圖層仍建立且面板與實繪一致', async function() {
        await gotoExample()
        let cases = [
            ['ovRasterStr', 0.5, '50%'], //'0.5' → 0.5
            ['ovRasterOver', 1, '100%'], //1.5 → 夾 1
            ['ovRasterNeg', 0, '0%'], //-0.2 → 夾 0
            ['ovRasterNaN', 1, '100%'], //NaN → 未給(raster 預設 1)
        ]
        for (let [name, want, text] of cases) {
            //J-opa: 修前此四層於 maplibre 驗證 paint 失敗(number expected / 超界)而整個圖層不被建立, 面板卻顯示 50%/150%/-20%/NaN%
            let p = await paintOf(name, 'raster-opacity')
            assert.ok(p.found, `${name} 圖層應已建立(無效值不得使圖層消失)`)
            assert.strictEqual(p.val, want, `${name} 實繪 raster-opacity 應為 ${want}, 實際 ${p.val}`)
            assert.strictEqual(await sliderValue(name), want, `${name} 面板滑桿 value 應為 ${want}`)
            assert.strictEqual(await percentText(name), text, `${name} 面板百分比應為 ${text}`)
        }
    })

    it('E2E-O3 type 為 style 之疊加層: 面板不渲染滑桿與百分比', async function() {
        await gotoExample()
        //前置: 該列存在(checkbox label)
        await rowLabel('ovStyle').waitFor({ state: 'attached', timeout: 15000 })
        //J-opa: type為'style'時不支援(各層自帶opacity), 面板不顯示滑桿; 修前顯示無作用之惰性滑桿(互動指示符號兌現不了就移除)
        assert.strictEqual(await rowOpa('ovStyle').count(), 0, 'style 型疊加層不應有滑桿列')
        //對照: 同頁其他型別疊加層有滑桿
        assert.strictEqual(await rowOpa('ovRasterDef').locator('input[type=range]').count(), 1)
    })

    it('E2E-O4 使用者以鍵盤調整 vector fill 滑桿(0.8 → 0.7): 面板數字與實繪同步', async function() {
        await gotoExample()
        await rowLabel('ovVecFill').locator('input[type=checkbox]').click() //勾選(滑桿原為 disabled)
        await page.keyboard.press('Tab') //焦點自 checkbox 移至其滑桿
        let focused = await page.evaluate(() => document.activeElement && document.activeElement.type)
        assert.strictEqual(focused, 'range', `Tab 後焦點應在滑桿, 實際 ${focused}`)
        for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft') //step 0.01 ×10
        await waitUntilExist(page, '百分比更新', () => /70%/.test(Array.from(document.querySelectorAll('span')).map((s) => s.innerText).join('|')))
        assert.ok(Math.abs(await sliderValue('ovVecFill') - 0.7) < 1e-6, `滑桿 value 應為 0.7, 實際 ${await sliderValue('ovVecFill')}`)
        assert.strictEqual(await percentText('ovVecFill'), '70%')
        let p = await paintOf('ovVecFill', 'fill-opacity')
        assert.ok(Math.abs(p.val - 0.7) < 1e-6, `實繪 fill-opacity 應為 0.7, 實際 ${p.val}`)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })
})
