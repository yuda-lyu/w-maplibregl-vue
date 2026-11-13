// e2e: 底圖疊加層 opacity 之面板顯示與實繪一致(預設值與值域單一擁有者, sgud/rule/rulebook.md R14)
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
// 標準圖政策: 依 sgud/rule/rulebook.md〈e2e 映射〉無跨 run 標準圖(語意斷言)。無 i18n, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-O1 未給 opacity: raster、wms 面板 1/100%、實繪 1; vector fill/line/fill-extrusion 面板 0.8/80%、實繪 0.8; 明給 0.5 → 0.5/50%/0.5
//   - E2E-O2 無效值: 數字字串 '0.5' → 0.5(圖層仍建立); 1.5 → 夾 1; -0.2 → 夾 0; NaN → 視為未給(raster 預設 1); 面板與實繪一致
//   - E2E-O3 type 為 style 之疊加層: 面板不渲染滑桿與百分比
//   - E2E-O4 使用者以鍵盤調整滑桿(0.8 → 0.7): 面板數字與實繪同步
//   - E2E-O5 公開方法 previewOverlayOpacity(name, val)(規則帳本 R18, 以下代稱 J-prev): 只改實繪, 不回寫 opt、不改內部 baseMaps、不走 syncBaseMapsToOpt/changeOpt/$forceUpdate、每次只呼叫一次 setPaintProperty; 無效輸入回 false 且不動繪製
//   - E2E-O6 預覽後提交: 拖曳中連續預覽、放開時 setOverlayOpacity 提交 → opt、內部值、面板、實繪皆為提交值(提交值可異於最後一次預覽值)
//   - E2E-O7 預覽後不提交再重套圖層: 經 opt 變更觸發 paint-only、增量、完整重建三條路徑, 圖層與面板皆回到已提交值(預覽為暫態)
//   - E2E-O8 地圖尚未載入回 false; 載入後底圖(radio)、同名條目回 false, 一般疊加層可逐幀預覽(第二個元件實例)
//   J-prev(src/components/WMaplibreglVue.vue previewOverlayOpacity 之 JSDoc): 「以名稱定位疊加層, 只改地圖上該圖層之繪製屬性, 不回寫opt、不重繪面板, 可逐幀呼叫; 拖曳結束時以setOverlayOpacity提交;
//     val須為0~1之有效數字(數字或數字字串); 回傳true表已套用, 地圖未載入、查無名稱、名稱重複、底圖或style型別、圖層尚未加入、值無效或超出0~1時回傳false」
import assert from 'assert'
import launchE2eBrowser from './tools/e2eLaunch.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'
import { routeCdnLocal } from './tools/e2eCdnLocal.mjs'

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
        browser = await launchE2eBrowser({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } })
        await routeCdnLocal(ctx) //首頁之外部 script 以本機同版副本回應, 進場不依賴外部 CDN(test/tools/e2eCdnLocal.mjs)
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

    //在頁面內以元件實例執行 fn(wm, arg)(fn 不得引用外部變數; 可為 async)
    let evalWm = (fn, arg) => page.evaluate(({ src, a }) => {
        let el = document.querySelector('.maplibregl-canvas')
        while (el && !(el.__vue__ && el.__vue__.getMapObject)) {
            el = el.parentElement
        }
        // eslint-disable-next-line no-eval
        return (0, eval)('(' + src + ')')(el.__vue__, a)
    }, { src: fn.toString(), a: arg })

    //J-prev: 連續調整(拖曳滑桿)期間之預覽, 使用端可逐幀呼叫: 只改該疊加層之繪製屬性, 不回寫 opt、不觸發同步與面板重繪
    it('E2E-O5 previewOverlayOpacity: 只改實繪, 不回寫 opt/內部值、不走同步與重繪; 查無名稱、無效值、超出 0~1、style 型別回 false', async function() {
        await gotoExample()
        let r = await evalWm(async (wm) => {
            let map = wm.getMapObject()
            let cnt = { sync: 0, force: 0, changeOpt: 0, applyBaseMaps: 0, setPaint: 0 }
            let sync = wm.syncBaseMapsToOpt
            let force = wm.$forceUpdate
            let changeOpt = wm.changeOpt
            let apply = wm.applyBaseMaps
            let setPaint = map.setPaintProperty
            wm.syncBaseMapsToOpt = function() {
                cnt.sync++
                return sync.apply(this, arguments)
            }
            wm.$forceUpdate = function() {
                cnt.force++
                return force.apply(this, arguments)
            }
            wm.changeOpt = function() {
                cnt.changeOpt++
                return changeOpt.apply(this, arguments)
            }
            wm.applyBaseMaps = function() {
                cnt.applyBaseMaps++
                return apply.apply(this, arguments)
            }
            map.setPaintProperty = function() {
                cnt.setPaint++
                return setPaint.apply(this, arguments)
            }
            let optJson = () => JSON.stringify(wm.opt)
            let intJson = () => JSON.stringify(wm.panelBaseMaps.baseMaps)
            let opt0 = optJson()
            let int0 = intJson()
            let out = {}
            out.okFill = wm.previewOverlayOpacity('ovVecFill', 0.3)
            out.okRaster = wm.previewOverlayOpacity('ovRasterDef', 0.4)
            out.okStr = wm.previewOverlayOpacity('ovRasterStr', '0.6')
            out.okLine = wm.previewOverlayOpacity('ovVecLine', 0.2)
            out.okExt = wm.previewOverlayOpacity('ovVecExt', 0.7)
            out.okWms = wm.previewOverlayOpacity('ovWms', 0.15)
            out.nSetPaintOk = cnt.setPaint
            out.unknown = wm.previewOverlayOpacity('noSuchLayer', 0.5)
            out.nan = wm.previewOverlayOpacity('ovVecFill', 'abc')
            out.high = wm.previewOverlayOpacity('ovRasterDef', 1.5)
            out.low = wm.previewOverlayOpacity('ovRasterDef', -0.2)
            out.nul = wm.previewOverlayOpacity('ovRasterDef', null)
            out.style = wm.previewOverlayOpacity('ovStyle', 0.5)
            out.nSetPaintAll = cnt.setPaint
            //同一值重複與逐幀連呼
            let rep = []
            for (let i = 0; i < 50; i++) {
                rep.push(wm.previewOverlayOpacity('ovVecFill', 0.3))
            }
            out.repAllTrue = rep.every((x) => x === true)
            for (let i = 0; i <= 100; i++) {
                wm.previewOverlayOpacity('ovVecFill', i / 100)
            }
            wm.previewOverlayOpacity('ovVecFill', 0.3)
            //等 Vue 的 watcher/重繪排程沖完, 再取計數(證明沒有被延後觸發)
            await wm.$nextTick()
            await new Promise((resolve) => setTimeout(resolve, 300))
            out.cnt = cnt
            out.optSame = optJson() === opt0
            out.intSame = intJson() === int0
            wm.syncBaseMapsToOpt = sync
            wm.$forceUpdate = force
            wm.changeOpt = changeOpt
            wm.applyBaseMaps = apply
            map.setPaintProperty = setPaint
            return out
        })
        //J-prev: 回傳 true 表已套用
        for (let k of ['okFill', 'okRaster', 'okStr', 'okLine', 'okExt', 'okWms']) {
            assert.strictEqual(r[k], true, `${k} 應回 true`)
        }
        //J-prev: 查無名稱/值無效/超出 0~1/style 型別回 false, 且不動繪製(setPaintProperty 次數不增)
        for (let k of ['unknown', 'nan', 'high', 'low', 'nul', 'style']) {
            assert.strictEqual(r[k], false, `${k} 應回 false`)
        }
        assert.strictEqual(r.nSetPaintOk, 6, '六次成功預覽各呼叫一次 setPaintProperty')
        assert.strictEqual(r.nSetPaintAll, 6, '回 false 者不得呼叫 setPaintProperty')
        assert.strictEqual(r.repAllTrue, true, '重複呼叫皆回 true')
        //J-prev: 不回寫 opt、不改內部 baseMaps、不走同步/changeOpt/重繪/重套
        assert.strictEqual(r.optSame, true, '不回寫 opt')
        assert.strictEqual(r.intSame, true, '不改元件內部 baseMaps')
        assert.strictEqual(r.cnt.sync, 0, '不走 syncBaseMapsToOpt')
        assert.strictEqual(r.cnt.force, 0, '不重繪面板($forceUpdate)')
        assert.strictEqual(r.cnt.changeOpt, 0, '不觸發 opt watcher(changeOpt)')
        assert.strictEqual(r.cnt.applyBaseMaps, 0, '不重套底圖')
        //J-prev: 實繪跟著變(由 style 快照讀回)
        let want = [
            ['ovVecFill', 'fill-opacity', 0.3],
            ['ovRasterDef', 'raster-opacity', 0.4],
            ['ovRasterStr', 'raster-opacity', 0.6],
            ['ovVecLine', 'line-opacity', 0.2],
            ['ovVecExt', 'fill-extrusion-opacity', 0.7],
            ['ovWms', 'raster-opacity', 0.15],
        ]
        for (let [name, prop, v] of want) {
            let p = await paintOf(name, prop)
            assert.ok(p.found, `${name} 圖層應存在`)
            assert.ok(Math.abs(p.val - v) < 1e-6, `${name} 實繪 ${prop} 應為 ${v}, 實際 ${p.val}`)
        }
        //J-prev: 不重繪面板 → 面板滑桿與百分比仍為已提交值(vector 未給 → 0.8, raster → 1)
        assert.strictEqual(await sliderValue('ovVecFill'), 0.8)
        assert.strictEqual(await percentText('ovVecFill'), '80%')
        assert.strictEqual(await sliderValue('ovRasterDef'), 1)
        assert.strictEqual(await percentText('ovRasterDef'), '100%')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-O6 預覽後提交: 拖曳中連續預覽、放開時 setOverlayOpacity 提交 → opt、內部值、面板、實繪皆為提交值', async function() {
        await gotoExample()
        //拖曳中: 連續預覽(最後一次 0.3), 此時提交前狀態皆維持已提交值
        let mid = await evalWm((wm) => {
            let out = { oks: [] }
            for (let v of [0.9, 0.7, 0.5, 0.4, 0.3]) {
                out.oks.push(wm.previewOverlayOpacity('ovVecFill', v))
            }
            let idx = wm.panelBaseMaps.baseMaps.findIndex((b) => b.name === 'ovVecFill')
            out.idx = idx
            out.optOpacity = wm.opt.panelBaseMaps.baseMaps[idx].opacity
            out.intOpacity = wm.panelBaseMaps.baseMaps[idx].opacity
            return out
        })
        assert.deepStrictEqual(mid.oks, [true, true, true, true, true])
        assert.strictEqual(mid.optOpacity, undefined, '提交前 opt 不變(範例頁未給 opacity)')
        assert.strictEqual(mid.intOpacity, undefined, '提交前內部值不變')
        let p1 = await paintOf('ovVecFill', 'fill-opacity')
        assert.ok(Math.abs(p1.val - 0.3) < 1e-6, `預覽中實繪應為 0.3, 實際 ${p1.val}`)
        assert.strictEqual(await sliderValue('ovVecFill'), 0.8, '提交前面板仍為已提交值')
        assert.strictEqual(await percentText('ovVecFill'), '80%')
        //放開: 以 setOverlayOpacity 提交(提交值 0.35 異於最後一次預覽值 0.3 → 以提交為準)
        let commit = await evalWm(async (wm, idx) => {
            let nSync = 0
            let sync = wm.syncBaseMapsToOpt
            wm.syncBaseMapsToOpt = function() {
                nSync++
                return sync.apply(this, arguments)
            }
            wm.setOverlayOpacity(idx, 0.35)
            await wm.$nextTick()
            wm.syncBaseMapsToOpt = sync
            return { nSync, optOpacity: wm.opt.panelBaseMaps.baseMaps[idx].opacity, intOpacity: wm.panelBaseMaps.baseMaps[idx].opacity }
        }, mid.idx)
        assert.strictEqual(commit.nSync, 1, '提交走一次 syncBaseMapsToOpt')
        assert.strictEqual(commit.optOpacity, 0.35, '提交後 opt 為提交值')
        assert.strictEqual(commit.intOpacity, 0.35, '提交後內部值為提交值')
        await waitUntilExist(page, '面板百分比更新', () => Array.from(document.querySelectorAll('span')).some((s) => s.innerText.trim() === '35%'))
        assert.ok(Math.abs(await sliderValue('ovVecFill') - 0.35) < 1e-6, '提交後面板滑桿為提交值')
        assert.strictEqual(await percentText('ovVecFill'), '35%')
        let p2 = await paintOf('ovVecFill', 'fill-opacity')
        assert.ok(Math.abs(p2.val - 0.35) < 1e-6, `提交後實繪應為 0.35, 實際 ${p2.val}`)
        //提交後再預覽、再提交同值: 仍正確(不殘留舊狀態)
        await evalWm((wm, idx) => {
            wm.previewOverlayOpacity('ovVecFill', 0.1)
            wm.setOverlayOpacity(idx, 0.35)
        }, mid.idx)
        let p3 = await paintOf('ovVecFill', 'fill-opacity')
        assert.ok(Math.abs(p3.val - 0.35) < 1e-6, `同值再提交後實繪應回 0.35, 實際 ${p3.val}`)
        //提交亦可經更新 opt(使用端自管狀態): 預覽 0.1 後把 opt 該條目 opacity 設為 0.45 → 走 paint-only, 實繪與面板皆為 0.45
        await evalWm((wm) => {
            wm.previewOverlayOpacity('ovVecFill', 0.1)
            wm.opt.panelBaseMaps.baseMaps.find((b) => b.name === 'ovVecFill').opacity = 0.45
        })
        await waitUntilExist(page, '經 opt 提交後面板百分比更新', () => Array.from(document.querySelectorAll('span')).some((s) => s.innerText.trim() === '45%'))
        let p4 = await paintOf('ovVecFill', 'fill-opacity')
        assert.ok(Math.abs(p4.val - 0.45) < 1e-6, `經 opt 提交後實繪應為 0.45, 實際 ${p4.val}`)
        assert.ok(Math.abs(await sliderValue('ovVecFill') - 0.45) < 1e-6)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-O7 預覽後不提交再重套圖層: paint-only、增量、完整重建三條路徑, 圖層與面板皆回到已提交值', async function() {
        await gotoExample()
        let preview = () => evalWm((wm) => {
            wm.previewOverlayOpacity('ovVecFill', 0.2)
            wm.previewOverlayOpacity('ovRasterDef', 0.4)
            return true
        })
        let expectPreview = async (label) => {
            let a = await paintOf('ovVecFill', 'fill-opacity')
            let b = await paintOf('ovRasterDef', 'raster-opacity')
            assert.ok(Math.abs(a.val - 0.2) < 1e-6 && Math.abs(b.val - 0.4) < 1e-6, `${label}: 預覽值應已生效, 實際 ${a.val}/${b.val}`)
        }
        let expectCommitted = async (label) => {
            //J-prev: 預覽未提交而底圖被重套或增量更新時, 圖層回到已提交值(vector 未給 → 0.8, raster 未給 → 1)
            await waitUntilExist(page, `${label}: 圖層回到已提交值`, () => {
                let st = window.__getMapStyle()
                let f = st.layers.find((x) => String(x.id).endsWith('_ovVecFill'))
                let r = st.layers.find((x) => String(x.id).endsWith('_ovRasterDef'))
                return !!f && !!r && f.paint['fill-opacity'] === 0.8 && r.paint['raster-opacity'] === 1
            })
            assert.strictEqual(await sliderValue('ovVecFill'), 0.8, `${label}: 面板滑桿`)
            assert.strictEqual(await percentText('ovVecFill'), '80%', `${label}: 面板百分比`)
            assert.strictEqual(await sliderValue('ovRasterDef'), 1, `${label}: 面板滑桿(raster)`)
        }
        //路徑 1: paint-only(僅 opacity 變更, 走 updateBaseMapPaint, 不重建)
        await preview()
        await expectPreview('P1')
        let n1 = await evalWm(async (wm) => {
            let nApply = 0
            let apply = wm.applyBaseMaps
            wm.applyBaseMaps = function() {
                nApply++
                return apply.apply(this, arguments)
            }
            wm.opt.panelBaseMaps.baseMaps.find((b) => b.name === 'ovVecFill05').opacity = 0.6
            await wm.$nextTick()
            await new Promise((resolve) => setTimeout(resolve, 200))
            wm.applyBaseMaps = apply
            return nApply
        })
        assert.strictEqual(n1, 0, 'P1 應走 paint-only 不重建')
        await expectCommitted('P1')
        let q1 = await paintOf('ovVecFill05', 'fill-opacity')
        assert.ok(Math.abs(q1.val - 0.6) < 1e-6, `P1: 被變更之條目應套用新值 0.6, 實際 ${q1.val}`)
        //路徑 2: 增量(可見性變更, 走 updateBaseMapsIncremental, 不重建)
        await preview()
        await expectPreview('P2')
        let n2 = await evalWm(async (wm) => {
            let nApply = 0
            let apply = wm.applyBaseMaps
            wm.applyBaseMaps = function() {
                nApply++
                return apply.apply(this, arguments)
            }
            wm.opt.panelBaseMaps.baseMaps.find((b) => b.name === 'ovRasterOver').visible = true
            await wm.$nextTick()
            await new Promise((resolve) => setTimeout(resolve, 200))
            wm.applyBaseMaps = apply
            return nApply
        })
        assert.strictEqual(n2, 0, 'P2 應走增量不重建')
        await expectCommitted('P2')
        //路徑 3: 完整重建(結構欄位 minzoom 變更, 走 applyBaseMaps)
        await preview()
        await expectPreview('P3')
        let n3 = await evalWm(async (wm) => {
            let nApply = 0
            let apply = wm.applyBaseMaps
            wm.applyBaseMaps = function() {
                nApply++
                return apply.apply(this, arguments)
            }
            wm.$set(wm.opt.panelBaseMaps.baseMaps.find((b) => b.name === 'ovRasterDef'), 'minzoom', 3)
            await wm.$nextTick()
            await new Promise((resolve) => setTimeout(resolve, 300))
            wm.applyBaseMaps = apply
            return nApply
        })
        assert.ok(n3 >= 1, 'P3 應走完整重建')
        await expectCommitted('P3')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-O8 第二個元件實例: 地圖尚未載入回 false; 載入後底圖與同名條目回 false, 一般疊加層可逐幀預覽', async function() {
        await gotoExample()
        let pre = await evalWm((wm) => {
            let opt2 = {
                center: [0, 121.0],
                zoom: 10,
                projection: 'mercator',
                panelLabels: { show: false },
                panelBaseMaps: {
                    show: false,
                    terrainMap: {},
                    baseMaps: [
                        { name: 'baseA', url: 'e2eop://baseA/{z}/{x}/{y}', colorShade: 'light', visible: true },
                        { name: 'dup', url: 'e2eop://dup1/{z}/{x}/{y}', colorShade: '', visible: true },
                        { name: 'dup', url: 'e2eop://dup2/{z}/{x}/{y}', colorShade: '', visible: true },
                        { name: 'okOv', url: 'e2eop://okOv/{z}/{x}/{y}', colorShade: '', visible: true },
                    ],
                },
            }
            let host = document.createElement('div')
            host.id = 'wm76Host'
            host.style.cssText = 'position:fixed; left:0; top:0; width:300px; height:200px; z-index:-1;'
            document.body.appendChild(host)
            let Ctor = wm.constructor
            let wm2 = new Ctor({ propsData: { opt: opt2 } })
            wm2.$mount(host)
            window.__wm76b = wm2
            //同步緊接於掛載之後: 地圖物件已建立, 但尚未 load、圖層尚未加入
            return { hasMap: !!wm2.map, loaded: wm2.mapLoaded, r: wm2.previewOverlayOpacity('okOv', 0.5) }
        })
        assert.strictEqual(pre.hasMap, true, '前置: 已建立地圖物件')
        assert.strictEqual(pre.loaded, false, '前置: 尚未載入')
        assert.strictEqual(pre.r, false, '地圖尚未載入應回 false')
        await waitUntilExist(page, '第二個實例載入完成', () => !!window.__wm76b && window.__wm76b.mapLoaded === true)
        let post = await evalWm(async (wm) => {
            let wm2 = window.__wm76b
            let out = {
                base: wm2.previewOverlayOpacity('baseA', 0.5),
                dup: wm2.previewOverlayOpacity('dup', 0.5),
                unknown: wm2.previewOverlayOpacity('nope', 0.5),
            }
            let rep = []
            for (let i = 0; i <= 100; i++) {
                rep.push(wm2.previewOverlayOpacity('okOv', i / 100))
            }
            out.repAllTrue = rep.every((x) => x === true)
            let st = wm2.getMapObject().getStyle()
            let layerOf = (tk) => st.layers.find((l) => String(l.id).indexOf('basemap-layer-') === 0 && String(l.id).indexOf(tk) >= 0)
            out.okOvVal = layerOf('okOv').paint['raster-opacity']
            out.baseVal = layerOf('baseA').paint['raster-opacity']
            out.dup1Val = layerOf('dup1').paint['raster-opacity']
            out.dup2Val = layerOf('dup2').paint['raster-opacity']
            wm2.$destroy()
            let host = document.getElementById('wm76Host')
            if (host && host.parentNode) host.parentNode.removeChild(host)
            else if (wm2.$el && wm2.$el.parentNode) wm2.$el.parentNode.removeChild(wm2.$el)
            delete window.__wm76b
            return out
        })
        assert.strictEqual(post.base, false, '底圖(radio)應回 false')
        assert.strictEqual(post.dup, false, '同名條目應回 false')
        assert.strictEqual(post.unknown, false, '查無名稱應回 false')
        assert.strictEqual(post.repAllTrue, true, '一般疊加層逐幀預覽皆回 true')
        assert.strictEqual(post.okOvVal, 1, '終值為最後一次預覽值 1')
        assert.strictEqual(post.baseVal, 1, '底圖繪製不動(預設 1)')
        assert.strictEqual(post.dup1Val, 1, '同名條目之一繪製不動')
        assert.strictEqual(post.dup2Val, 1, '同名條目之二繪製不動')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })
})
