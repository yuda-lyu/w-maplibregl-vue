// e2e: runtime 同步行為(影像重排堆疊 / 面板顯隱寫回 opt / 底圖結構更換清除 / 面板分類 / 比例尺 / vector 初始 paint)
//
// 目的: 以紅燈重現測試凍結本輪審計確認之缺陷的「修復後預期行為」(spec), 修復後轉綠作為保護網。
//
// 真實 user path(6 步):
//   1. 開首頁(App.vue 範例選單)
//   2. 點 basic > runtimeSync 子選單(真實點擊選單項)
//   3. 看到地圖: 紅色 data-URI 底圖 + 兩張部分重疊影像(綠/藍) + 黃色多邊形 + 面板(底圖選擇/圖層顯隱/比例尺)
//   4. 點頁面按鈕(#btnSwapImages / #btnResetBasemaps)或面板 checkbox 觸發 runtime 變更
//   5. 觀察地圖區域像素、面板 DOM、父層 #pgVisLog 文字的變化
//   6. (補強)讀取 window.__getMapStyle() 之地圖 style 快照, 驗證圖層順序/paint 設定值
//
// 按鈕全清單比對: 範例頁可點元素 = [子選單項, #btnSwapImages, #btnResetBasemaps, #btnClearImageUrl,
//   #btnShiftPoints, #btnIconSlow, #btnIconFast, #btnTerrainTune, #btnReorderBasemaps,
//   panelItems 之各 checkbox, panelBaseMaps 之 radio/checkbox/opacity 滑桿, 縮放 +/- 按鈕, 地圖 canvas]。
//   covered: 子選單項(每 case; E2E-014 另以切換子選單卸載元件), #btnSwapImages(E2E-001),
//     #btnResetBasemaps(E2E-003, E2E-007), panelItems 之 polygon R checkbox(E2E-002),
//     #btnClearImageUrl(E2E-008), #btnIconSlow/#btnIconFast(E2E-009, E2E-014),
//     #btnShiftPoints 與 point A checkbox(E2E-010), 地圖 canvas 點擊圖徵(E2E-010, E2E-011),
//     #btnTerrainTune(E2E-012), #btnReorderBasemaps(E2E-013)。
//   uncovered(非本 spec 標的): panelBaseMaps 之 radio/checkbox/滑桿(底圖面板互動屬 AppPBM* 範例生態),
//     縮放按鈕與 canvas 拖曳(hover/displayorder 測試已涵蓋地圖互動)。
//
// act 全走 user-facing(真實點擊); assert 以使用者可觀察為主(區域像素變化, 面板 DOM 型別,
// 比例尺文字, 父層 span 文字), style 快照斷言僅作補強。
// E2E-006 例外: 測試環境無 vector 圖磚, 無 UI 終態可觀察, 僅能斷言 style 內 paint 設定值(合法 gap: 純設定值驗證)。
//
// 像素比對政策: 本頁底圖為 data-URI 色塊(畫面決定性), 仍沿用套件既有政策——僅做當次
// in-memory 前/後區域比對, 無跨 run 標準圖(與 e2e-hover 一致)。無 i18n 差異, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-001 帶 key 影像 runtime 重排: 初始 [綠,藍] 重疊區為藍(後者)在上; 點 #btnSwapImages 反轉
//               陣列後, 重疊區改為綠在上(區域像素改變); style 圖層序 imgG 晚(高)於 imgB(補強)
//   - E2E-002 面板顯隱寫回 opt 響應性: polygon R 於 opt 未宣告 visible; 取消勾選 → 地圖上多邊形
//               即時隱藏(區域像素改變)且父層 #pgVisLog 由 'undefined' 變 'false'; 再勾選 →
//               多邊形恢復(區域像素還原)且 #pgVisLog 變 'true'
//   - E2E-003 底圖結構性更換清除舊圖層: 點 #btnResetBasemaps 整組換為單一透明 blank →
//               原紅色底圖不得殘留(取樣區像素改變為背景色); style 內 basemap layer/source 各僅剩 1(補強)
//   - E2E-004 colorShade 省略之面板分類: 'noshade overlay' 項(未給 colorShade, 文件預設 '')
//               應歸類疊加層 → 面板呈現 checkbox 而非 radio
//   - E2E-005 赤道比例尺: center 緯度 0(有效值)時比例尺依緯度 0 計算 → 文字為 '12 km'(zoom 10)
//   - E2E-006 vector line 底圖初始透明度: 初始 style 之 basemap line 圖層 paint line-opacity 應為 0.3
//   - E2E-007 底圖結構性更換後 hillshade 疊序: terrain-hillshade 須維持在底圖之上(不被新底圖蓋住)
//   - E2E-008 visible 影像 url 清空: 該影像圖層即時移除(重疊區露出下方影像), 不得殘留舊圖
//   - E2E-009 icon 同 key 換內容競態: 較舊圖(延遲載入)完成較晚時, 不得覆寫最新設定之圖示
//   - E2E-010 keyed pointSets 重排後自面板隱藏該組: 其既開之 popup 一併關閉(owner 依組身分, 不受索引位移影響)
//   - E2E-011 icon 點(預設 popupAnchor=-iconHeight)靠上緣點擊: 溢出判斷計入 anchorOffset → 翻轉至下側, popup 完整在容器內
//   - E2E-012 runtime 重套 terrain(調整地形參數): hillshade 應插回「全部資料圖層之下」(依實際疊序, 非追蹤陣列插入序)
//   - E2E-013 底圖增量重排(非結構性): hillshade 應維持在全部底圖/疊加層之上(疊加層不得被移到 hillshade 上方)
//   - E2E-014 icon 載入中卸載元件(切換子選單): 待載完成之回呼不得對已銷毀地圖操作(無未捕捉 TypeError)
import assert from 'assert'
import { chromium } from 'playwright'
import { baseUrl, startServer, waitUntilExist } from './e2e-setup.mjs'

// 範例頁 AppBSCRuntimeSync 之固定地圖參數(與該頁 opt 一致)
const MAP_CENTER = [0, 121.0] //[lat, lng]
const MAP_ZOOM = 10

// E2E-009 網路模擬用 1x1 純色 PNG(程式化產生並經解碼回驗之 base64, 與範例頁常數同源)
const PNG_RED_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4o6HxHwAFPAIs0Zo91QAAAABJRU5ErkJggg==' //[220,40,40]
const PNG_BLUE_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPQcHv2HwAEQgJU1FeLxgAAAABJRU5ErkJggg==' //[40,70,230]

// web mercator: latLng → canvas 內像素座標(projection='mercator', 無旋轉/傾斜時為精確解)
function latLngToCanvasXY(lat, lng, canvasW, canvasH) {
    let worldSize = 512 * Math.pow(2, MAP_ZOOM)
    let px = (l) => (l + 180) / 360 * worldSize
    let py = (la) => {
        let r = la * Math.PI / 180
        return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2 * worldSize
    }
    let x = canvasW / 2 + (px(lng) - px(MAP_CENTER[1]))
    let y = canvasH / 2 + (py(lat) - py(MAP_CENTER[0]))
    return { x, y }
}

describe('e2e-runtime', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    let cbb = null //canvas boundingBox(viewport 座標)
    beforeEach(async function() {
        browser = await chromium.launch({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } })
        page = await ctx.newPage()
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
        cbb = null
    })

    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsSubMenu-basic', { hasText: 'runtimeSync' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'))
        await page.waitForTimeout(3000) //等圖層 render + idle 就位(data-URI 圖磚無網路等待)
        cbb = await page.locator('.maplibregl-canvas').boundingBox()
    }
    //以 latLng 為中心之 canvas 取樣區(w×h px)
    let clipAt = (lat, lng, w, h) => {
        let p = latLngToCanvasXY(lat, lng, cbb.width, cbb.height)
        return { x: cbb.x + p.x - w / 2, y: cbb.y + p.y - h / 2, width: w, height: h }
    }
    //擷取指定區域截圖(連續兩張相同視為 settle)
    let captureRegionStable = async (clip) => {
        let prev = await page.screenshot({ clip })
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(250)
            let curr = await page.screenshot({ clip })
            if (curr.equals(prev)) return curr
            prev = curr
        }
        return prev
    }
    //輪詢至區域畫面「不同於 before」(runtime 變更需經 debounce+render, 固定等待易搶拍);
    //超時仍未變則回傳最後一張, 交由呼叫端斷言失敗(紅燈訊息明確)
    let waitRegionChanged = async (clip, before, { rounds = 14, interval = 500 } = {}) => {
        let last = before
        for (let i = 0; i < rounds; i++) {
            await page.waitForTimeout(interval)
            last = await captureRegionStable(clip)
            if (!last.equals(before)) return last
        }
        return last
    }
    //輪詢至區域畫面「等於 target」(還原場景); 超時回最後一張交由呼叫端斷言
    let waitRegionEquals = async (clip, target, { rounds = 14, interval = 500 } = {}) => {
        let last = null
        for (let i = 0; i < rounds; i++) {
            await page.waitForTimeout(interval)
            last = await captureRegionStable(clip)
            if (last.equals(target)) return last
        }
        return last
    }
    //style 快照補強斷言用: 取 basemap / image 圖層 id 序列
    let getStyleLayerIds = async () => {
        return await page.evaluate(() => {
            let st = window.__getMapStyle ? window.__getMapStyle() : null
            if (!st || !st.layers) return null
            return st.layers.map((l) => l.id)
        })
    }

    it('E2E-001 帶 key 影像 runtime 重排: 交換陣列順序後重疊區改為新後者(綠)在上', async function() {
        await gotoExample()
        //取樣區: 兩影像重疊區(lng 121.05~121.08)之內部, 避開邊緣反鋸齒
        let clip = clipAt(0, 121.065, 24, 30)
        let shotBefore = await captureRegionStable(clip) //初始: 陣列 [綠,藍] → 藍(後者)在上

        await page.locator('#btnSwapImages').click()
        //spec: 交換順序後「陣列後者在上」語意須維持 → 重疊區由藍轉綠, 區域像素改變
        let shotAfter = await waitRegionChanged(clip, shotBefore)
        assert.ok(!shotAfter.equals(shotBefore), '交換 imageSets 順序後重疊區畫面應改變(綠在上), 但仍與交換前相同(堆疊未回歸)')

        //補強(spec: 圖層順序即堆疊): style 內 imgG 圖層應晚(高)於 imgB
        let ids = await getStyleLayerIds()
        assert.ok(ids, '應可取得 style 圖層清單')
        let idxG = ids.indexOf('image-layer-k-imgG')
        let idxB = ids.indexOf('image-layer-k-imgB')
        assert.ok(idxG >= 0 && idxB >= 0, '兩張影像圖層皆應存在')
        assert.ok(idxG > idxB, `交換後 imgG 應在 imgB 之上(style 序 ${idxB} vs ${idxG})`)
    })

    it('E2E-002 面板顯隱寫回 opt 響應性: 取消勾選後父層 span 即時顯示 false, 地圖隱藏該多邊形; 再勾選還原', async function() {
        await gotoExample()
        //取樣區: polygon R 內部(黃色實心, 避開框線)
        let clip = clipAt(-0.08, 121.07, 24, 24)
        let shotOn = await captureRegionStable(clip)

        //spec: 面板取消勾選 → 寫回 opt.polygonSets[0].visible=false 且父層可響應讀到
        await page.locator('label', { hasText: 'polygon R' }).locator('input[type=checkbox]').click()
        await waitUntilExist(page, '#pgVisLog 顯示 false(寫回 opt 具響應性)', () => {
            let el = document.querySelector('#pgVisLog')
            return !!el && el.innerText.trim() === 'false'
        })
        //spec: 地圖上多邊形即時隱藏(取樣區回到底圖紅色)
        let shotOff = await waitRegionChanged(clip, shotOn)
        assert.ok(!shotOff.equals(shotOn), '取消勾選後多邊形區域畫面應改變(隱藏)')

        //spec: 再勾選 → 寫回 true 且多邊形恢復, 畫面與初始一致
        await page.locator('label', { hasText: 'polygon R' }).locator('input[type=checkbox]').click()
        await waitUntilExist(page, '#pgVisLog 顯示 true', () => {
            let el = document.querySelector('#pgVisLog')
            return !!el && el.innerText.trim() === 'true'
        })
        let shotRestore = await waitRegionEquals(clip, shotOn)
        assert.ok(shotRestore && shotRestore.equals(shotOn), '再勾選後多邊形應恢復, 區域畫面應與初始一致')
    })

    it('E2E-003 底圖結構性更換: 舊底圖圖層不得殘留, 取樣區回到背景色', async function() {
        await gotoExample()
        //取樣區: 遠離影像/多邊形/面板之純底圖區(初始為紅色圖磚)
        let clip = clipAt(-0.04, 120.85, 20, 20)
        let shotRed = await captureRegionStable(clip)

        await page.locator('#btnResetBasemaps').click()
        //spec: 整組換為單一透明 blank → 原紅色底圖圖層被清除, 取樣區改變(透出背景色)
        let shotAfter = await waitRegionChanged(clip, shotRed)
        assert.ok(!shotAfter.equals(shotRed), '更換底圖清單後原紅色底圖不得殘留, 取樣區畫面應改變(目前仍為舊底圖)')

        //補強: style 內 basemap layer / source 各僅剩 1(無舊條目殘留)
        let ids = await getStyleLayerIds()
        assert.ok(ids, '應可取得 style 圖層清單')
        let bmLayers = ids.filter((id) => String(id).indexOf('basemap-layer-') === 0)
        assert.strictEqual(bmLayers.length, 1, `basemap 圖層應僅剩 1 層, 實際 ${bmLayers.length}(${bmLayers.join(', ')})`)
        let bmSrcCount = await page.evaluate(() => {
            let st = window.__getMapStyle ? window.__getMapStyle() : null
            if (!st || !st.sources) return null
            return Object.keys(st.sources).filter((id) => id.indexOf('basemap-src-') === 0).length
        })
        assert.strictEqual(bmSrcCount, 1, `basemap source 應僅剩 1 個, 實際 ${bmSrcCount}`)
    })

    it('E2E-004 colorShade 省略之面板分類: noshade 項應為疊加層 checkbox 而非 radio', async function() {
        await gotoExample()
        //spec: colorShade 文件預設 '' = 疊加層 → 面板應呈現 checkbox(與渲染端 isestr 判斷一致)
        let inp = page.locator('label', { hasText: 'noshade overlay' }).locator('input')
        await inp.waitFor({ state: 'attached', timeout: 15000 })
        let t = await inp.getAttribute('type')
        assert.strictEqual(t, 'checkbox', `colorShade 省略之項目應為 checkbox(疊加層), 實際為 ${t}`)
    })

    it('E2E-005 赤道比例尺: center 緯度 0 時比例尺依緯度 0 計算(zoom 10 → 12 km)', async function() {
        await gotoExample()
        //spec: 比例尺依「當前中心緯度」計算; 緯度 0 為有效值不得回退預設緯度
        //zoom 10 緯度 0: 156543.03392*cos(0)/2^10*80 = 12229.9m → '12 km'(回退 23.5 度時誤為 '11 km')
        await waitUntilExist(page, '比例尺顯示 12 km', () => {
            let el = document.querySelector('.clsScale')
            return !!el && el.innerText.indexOf('12 km') >= 0
        })
    })

    it('E2E-006 vector line 底圖初始透明度: style 之 line 圖層 paint line-opacity 應為 0.3', async function() {
        await gotoExample()
        //spec: opacity 設定於初始建層即生效(與後續更新路徑一致); 無 vector 圖磚故僅能驗 style 設定值(合法 gap)
        let r = await page.evaluate(() => {
            let st = window.__getMapStyle ? window.__getMapStyle() : null
            if (!st || !st.layers) return { found: false }
            let ly = st.layers.find((l) => l.type === 'line' && String(l.id).indexOf('basemap-layer-') === 0)
            if (!ly) return { found: false }
            return { found: true, lineOpacity: ly.paint ? ly.paint['line-opacity'] : undefined }
        })
        assert.ok(r.found, 'vector line 底圖圖層應存在於 style')
        assert.strictEqual(r.lineOpacity, 0.3, `line 底圖初始 line-opacity 應為 0.3, 實際為 ${r.lineOpacity}`)
    })

    it('E2E-007 底圖結構性更換後 hillshade 疊序: 應維持在底圖之上', async function() {
        await gotoExample()
        //前置: hillshade 圖層存在(頁面配置平坦本地 DEM)
        let ids0 = await getStyleLayerIds()
        assert.ok(ids0 && ids0.indexOf('terrain-hillshade') >= 0, 'hillshade 圖層應存在')
        await page.locator('#btnResetBasemaps').click()
        //等結構重建完成(basemap 僅剩 1 層)
        await waitUntilExist(page, 'basemap 重建完成(僅剩 1 層)', () => {
            let st = window.__getMapStyle ? window.__getMapStyle() : null
            if (!st || !st.layers) return false
            return st.layers.filter((l) => String(l.id).indexOf('basemap-layer-') === 0).length === 1
        })
        //spec: hillshade 疊序為「底圖上、資料下」, 底圖重建後不得被新底圖蓋住
        let ids = await getStyleLayerIds()
        let iH = ids.indexOf('terrain-hillshade')
        let iB = ids.findIndex((id) => String(id).indexOf('basemap-layer-') === 0)
        assert.ok(iH >= 0, 'hillshade 圖層應仍存在')
        assert.ok(iH > iB, `hillshade(序 ${iH}) 應在底圖(序 ${iB}) 之上`)
    })

    it('E2E-008 visible 影像 url 清空: 舊影像圖層即時移除不殘留', async function() {
        await gotoExample()
        //取樣區: 兩影像重疊區(初始為藍 B 在上)
        let clip = clipAt(0, 121.065, 24, 30)
        let shotBefore = await captureRegionStable(clip)
        await page.locator('#btnClearImageUrl').click()
        //spec: url 已無效 → 該影像移除, 重疊區露出下方綠 A(畫面改變)
        let shotAfter = await waitRegionChanged(clip, shotBefore)
        assert.ok(!shotAfter.equals(shotBefore), 'url 清空後舊影像不得殘留, 重疊區畫面應改變')
        //補強: imgB 圖層已自 style 移除
        let ids = await getStyleLayerIds()
        assert.ok(ids && ids.indexOf('image-layer-k-imgB') < 0, 'image-layer-k-imgB 應已移除')
    })

    it('E2E-009 icon 同 key 換內容競態: 較舊載入完成較晚不得覆寫最新圖示', async function() {
        //網路模擬: slow 圖延遲 3000ms 回應(紅), fast 圖即時回應(藍) — 迫使較舊請求較晚完成
        let slowSeenResolve = null
        let slowSeenPm = new Promise((resolve) => {
            slowSeenResolve = resolve
        })
        await page.route('**/e2e-icon-slow.png', async (route) => {
            slowSeenResolve()
            await new Promise((resolve) => setTimeout(resolve, 3000))
            await route.fulfill({ contentType: 'image/png', body: Buffer.from(PNG_RED_B64, 'base64') })
        })
        await page.route('**/e2e-icon-fast.png', async (route) => {
            await route.fulfill({ contentType: 'image/png', body: Buffer.from(PNG_BLUE_B64, 'base64') })
        })
        await gotoExample()
        let clip = clipAt(-0.05, 120.88, 16, 16) //p3 icon 中心區(iconAnchor 為圖示中心)
        let shotInit = await captureRegionStable(clip) //初始 icon(灰)
        await page.locator('#btnIconSlow').click()
        await slowSeenPm //slow 載入已開始(請求送出, 3 秒後才會完成)
        await page.locator('#btnIconFast').click()
        //spec: 最新設定為 fast(藍) → icon 呈現 fast 圖(此時 slow 尚未完成)
        let shotFast = await waitRegionChanged(clip, shotInit, { rounds: 10, interval: 400 })
        assert.ok(!shotFast.equals(shotInit), '換 fast 圖後 icon 應更新(藍)')
        //spec: slow(較舊設定)於 3 秒後完成載入, 不得覆寫最新的 fast 圖示
        await page.waitForTimeout(3500)
        let shotLate = await captureRegionStable(clip)
        assert.ok(shotLate.equals(shotFast), '較舊 slow 圖完成較晚, 不得覆寫最新 fast 圖示(icon 應維持不變)')
    })

    it('E2E-010 keyed pointSets 重排後自面板隱藏: 既開 popup 應一併關閉', async function() {
        await gotoExample()
        //真實滑鼠點擊 p1 circle 點 → 開 point popup
        let p = latLngToCanvasXY(0.02, 120.90, cbb.width, cbb.height)
        await page.mouse.click(cbb.x + p.x, cbb.y + p.y)
        await waitUntilExist(page, 'point popup 開啟', () => {
            let el = document.querySelector('.maplibregl-popup')
            return !!el && el.innerText.indexOf('[Point popup]') >= 0
        })
        //重排: 頭部插入一組(point A 索引 0→1, 其 key 身分不變)
        await page.locator('#btnShiftPoints').click()
        await page.waitForTimeout(1200) //等 debounce + 增量渲染
        //面板隱藏 point A
        await page.locator('label', { hasText: 'point A' }).locator('input[type=checkbox]').click()
        //spec: 隱藏集合時其既開 popup 一併關閉(owner 依組身分對應, 不受索引位移影響)
        await waitUntilExist(page, 'popup 已關閉', () => !document.querySelector('.maplibregl-popup'))
    })

    it('E2E-011 icon 點靠上緣點擊: 溢出判斷計入 anchorOffset, popup 翻轉不被裁切', async function() {
        await gotoExample()
        //p2 為預設 icon(錨點底部中央, 圖示繪於 latLng 上方) → 點擊位置取 latLng 上方 15px 圖示內
        let p = latLngToCanvasXY(0.0412, 120.95, cbb.width, cbb.height)
        await page.mouse.click(cbb.x + p.x, cbb.y + p.y - 15)
        await waitUntilExist(page, 'point popup 開啟', () => {
            let el = document.querySelector('.maplibregl-popup')
            return !!el && el.innerText.indexOf('[Point popup]') >= 0
        })
        await page.waitForTimeout(600) //等二階段實尺寸校正完成
        //spec: 預設 popupAnchor(-iconHeight)使實際位置更靠上, 溢出判斷須計入 → 靠上緣時翻轉至下側, popup 完整在容器內
        let rect = await page.locator('.maplibregl-popup').boundingBox()
        assert.ok(rect, '應取得 popup 外框')
        assert.ok(rect.y >= cbb.y - 2, `popup 不得超出地圖上緣(popup top=${Math.round(rect.y)}, canvas top=${Math.round(cbb.y)})`)
        assert.ok(rect.y + rect.height <= cbb.y + cbb.height + 2, 'popup 不得超出地圖下緣')
    })

    //style 疊序斷言用: 資料圖層前綴
    const DATA_PREFIXES = ['image-', 'contour-', 'polygon-', 'geojson-', 'polyline-', 'point-']

    it('E2E-012 runtime 重套 terrain: hillshade 應在全部資料圖層之下', async function() {
        await gotoExample()
        await page.locator('#btnTerrainTune').click()
        await page.waitForTimeout(1200) //等 terrainChanged → applyTerrain 重建完成
        //spec: hillshade 疊序為「底圖上、資料下」— 重套 terrain 後仍須插回全部資料圖層之下
        let ids = await getStyleLayerIds()
        assert.ok(ids, '應可取得 style 圖層清單')
        let iH = ids.indexOf('terrain-hillshade')
        assert.ok(iH >= 0, 'hillshade 圖層應存在')
        let above = ids.filter((id, i) => i < iH && DATA_PREFIXES.some((pfx) => String(id).indexOf(pfx) === 0))
        assert.strictEqual(above.length, 0, `hillshade(序 ${iH}) 應在全部資料圖層之下, 但這些資料圖層在其下: ${above.join(', ')}`)
    })

    it('E2E-013 底圖增量重排: hillshade 應維持在全部底圖圖層之上', async function() {
        await gotoExample()
        await page.locator('#btnReorderBasemaps').click()
        await page.waitForTimeout(1200) //等增量重排(moveLayer)完成
        //spec: hillshade 疊序為「底圖上、資料下」— 增量重排不得把疊加層移到 hillshade 之上
        let ids = await getStyleLayerIds()
        assert.ok(ids, '應可取得 style 圖層清單')
        let iH = ids.indexOf('terrain-hillshade')
        assert.ok(iH >= 0, 'hillshade 圖層應存在')
        let bmAbove = ids.filter((id, i) => i > iH && String(id).indexOf('basemap-layer-') === 0)
        assert.strictEqual(bmAbove.length, 0, `hillshade(序 ${iH}) 應在全部底圖圖層之上, 但這些在其上: ${bmAbove.map((s) => s.slice(0, 40)).join(', ')}`)
        //sanity: hillshade 仍在資料圖層之下
        let dataBelow = ids.filter((id, i) => i < iH && DATA_PREFIXES.some((pfx) => String(id).indexOf(pfx) === 0))
        assert.strictEqual(dataBelow.length, 0, 'hillshade 應仍在全部資料圖層之下')
    })

    it('E2E-014 icon 載入中卸載元件: 待載回呼不得對已銷毀地圖操作(無未捕捉 TypeError)', async function() {
        //網路模擬: slow 圖延遲 3000ms — 使載入完成時元件已卸載(地圖已 remove)
        let slowSeenResolve = null
        let slowSeenPm = new Promise((resolve) => {
            slowSeenResolve = resolve
        })
        await page.route('**/e2e-icon-slow.png', async (route) => {
            slowSeenResolve()
            await new Promise((resolve) => setTimeout(resolve, 3000))
            await route.fulfill({ contentType: 'image/png', body: Buffer.from(PNG_RED_B64, 'base64') })
        })
        //收集未捕捉例外(啟動期已知 WebGL shader 噪音非本 spec 對象, 僅認 TypeError 類)
        let typeErrors = []
        page.on('pageerror', (e) => {
            if (/TypeError|Cannot read|is not a function/i.test(String(e && e.message))) typeErrors.push(String(e.message))
        })
        await gotoExample()
        await page.locator('#btnIconSlow').click()
        await slowSeenPm //slow 載入已開始(3 秒後才會完成)
        //切換子選單 → 卸載本頁(元件 beforeDestroy 會 map.remove())
        await page.locator('.clsSubMenu-basic', { hasText: 'size' }).first().click()
        await page.waitForTimeout(4500) //等 slow 載入完成後之回呼執行
        //spec: 元件卸載後, 待載完成之 icon 回呼不得對已銷毀地圖操作而拋未捕捉例外
        assert.strictEqual(typeErrors.length, 0, `卸載後不得有未捕捉 TypeError, 實際: ${typeErrors.join(' | ')}`)
    })
})
