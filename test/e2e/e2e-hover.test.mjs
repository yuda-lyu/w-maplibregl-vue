// e2e: 圖層 hover 互動（cursor / tooltip / hover 樣式 / hover 後點擊）
//
// 目的: 凍結各互動圖層 mouseenter/mouseleave 之對外可觀察行為,
//       作為 layerRenderers hover 機制重構(集中式 hover 管理)之保護網。
//
// 真實 user path（6 步）:
//   1. 開首頁(App.vue 範例選單)
//   2. 點 basic > hoverInteractions 子選單(真實點擊選單項)
//   3. 看到地圖: 各型別圖徵分散配置(circle點/icon點/點群聚/折線/多邊形/GeoJSON/等值線)
//   4. 滑鼠移入某圖徵 → cursor 變 pointer、tooltip 顯示(等值線另有 hover 樣式變化)
//   5. 滑鼠移出至空白處 → cursor 還原、tooltip 消失(等值線樣式還原)
//   6. (E2E-009) 滑入點後點擊 → point popup 開啟
//
// 按鈕全清單比對: 範例頁可點元素 = [子選單項, 地圖 canvas, #btnMutate, #btnShiftSets] — 皆有真實點擊/滑入。
// act 全走 user-facing(真實滑鼠移動/點擊); assert 走 user-facing(canvas cursor 樣式,
// tooltip DOM 文字, popup DOM 文字, 等值線 hover 前後畫面區域像素差異)。
// 無 i18n 文字差異(範例固定中英標籤), 故單一變體。每個 it() 各自 new browser。
//
// 滑鼠座標換算: 範例頁固定 projection='mercator'/center/zoom, 以 web mercator 公式
// 直接推算圖徵之 canvas 座標(靜態數學換算, 非讀取 runtime 內部狀態), act 仍為真實滑鼠。
//
// 像素比對政策: 等值線 hover 樣式僅做「當次 in-memory 前/中/後區域比對」(hover 中須與
// hover 前不同; 滑出後須還原回 hover 前), 無跨 run 標準圖。why: 底圖磚來自遠端伺服器
// 非決定性, 跨 run byte 比對必 flake; 主驗證仍為語意斷言(cursor/tooltip), 區域比對僅
// 補強 hover 樣式切換此一 spec 行為。
//
// 重要流程(spec bullets):
//   - E2E-001 circle 點: 滑入 → cursor pointer + [Point tooltip]; 滑出 → cursor 還原 + tooltip 消失
//   - E2E-002 icon 點(symbol 圖層): 滑入 → cursor pointer + [Point tooltip]; 滑出 → 還原
//   - E2E-003 點群聚 cluster: 滑入群聚圓 → cursor pointer; 滑出 → cursor 還原
//   - E2E-004 折線: 滑入 → cursor pointer + [Polyline tooltip]; 滑出 → 還原
//   - E2E-005 多邊形: 滑入 → cursor pointer + [Polygon tooltip]; 滑出 → 還原
//   - E2E-006 GeoJSON 面: 滑入 → cursor pointer + [Geojson tooltip]; 滑出 → 還原
//   - E2E-007 等值線: 滑入 → cursor pointer + [Contour tooltip] + hover 樣式變化(區域像素不同);
//               滑出 → tooltip 消失 + 樣式還原(區域像素還原)
//   - E2E-008 跨圖層連續移動: 點 → 折線, tooltip 由 [Point tooltip] 切換為 [Polyline tooltip]
//   - E2E-009 hover 後點擊: 滑入 circle 點後原地點擊 → [Point popup] 開啟(hover 不干擾 click)
//   - E2E-010 runtime 變更: 點 #btnMutate 後折線換色即時生效(區域像素不同);
//               直接改 opt visible 的多邊形即時隱藏(hover 無 cursor/tooltip); 折線 hover 仍正常
//   - E2E-011 陣列頭部插入 pointSet(索引位移): 新組可 hover; 位移後原 circle/icon 點
//               hover tooltip 資料仍正確(無錯置), 點擊 popup 資料正確
import assert from 'assert'
import { chromium } from 'playwright'
import { baseUrl, startServer, waitUntilExist } from './e2e-setup.mjs'

// 範例頁 AppBSCHoverInteractions 之固定地圖參數(與該頁 opt 一致)
const MAP_CENTER = [24.0, 121.0] //[lat, lng]
const MAP_ZOOM = 10

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

describe('e2e-hover', function() {
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
        await page.locator('.clsSubMenu-basic', { hasText: 'hoverInteractions' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'))
        await page.waitForTimeout(3000) //等圖層(含非同步 icon/等值線)render + idle 就位
        cbb = await page.locator('.maplibregl-canvas').boundingBox()
    }
    //滑鼠移到指定 latLng 對應之畫面位置(dx/dy 為額外像素偏移, 如 icon 點須落在錨點上方之圖示內)
    let hoverAt = async (lat, lng, dx = 0, dy = 0) => {
        let p = latLngToCanvasXY(lat, lng, cbb.width, cbb.height)
        await page.mouse.move(cbb.x + p.x + dx, cbb.y + p.y + dy)
    }
    //park 至地圖中央空白處(無任何圖徵), 觸發各圖層 leave
    let hoverAtEmpty = async () => {
        await hoverAt(MAP_CENTER[0], MAP_CENTER[1])
    }
    //spec: 滑入互動圖徵 cursor 變 pointer / 滑出還原為 ''
    let assertCursor = async (val) => {
        await waitUntilExist(page, `canvas cursor='${val}'`, (v) => {
            let el = document.querySelector('.maplibregl-canvas')
            return !!el && el.style.cursor === v
        }, { arg: val })
    }
    //spec: 滑入顯示 tooltip 且內容含該型別標記文字
    let assertTooltip = async (marker) => {
        await waitUntilExist(page, `tooltip 含「${marker}」`, (m) => {
            let el = document.querySelector('.wlv2-tooltip')
            return !!el && el.innerText.indexOf(m) >= 0
        }, { arg: marker })
    }
    //spec: 滑出後 tooltip 消失
    let assertNoTooltip = async () => {
        await waitUntilExist(page, 'tooltip 消失', () => !document.querySelector('.wlv2-tooltip'))
    }
    //單一圖徵之滑入/滑出完整驗證(cursor + tooltip; marker=null 代表該圖層無 tooltip, 僅驗 cursor)
    let checkEnterLeave = async (lat, lng, marker, dx = 0, dy = 0) => {
        await hoverAt(lat, lng, dx, dy)
        await assertCursor('pointer')
        if (marker) await assertTooltip(marker)
        await hoverAtEmpty()
        await assertCursor('')
        await assertNoTooltip()
    }
    //滑入並輪詢至 cursor 變 pointer: 目標可能尚在渲染中(hover 命中測試僅於 mousemove 觸發,
    //單次移入後光等待不會再觸發), 故每輪重新微移滑鼠直到命中
    let hoverAtUntilPointer = async (lat, lng, dx = 0, dy = 0) => {
        let p = latLngToCanvasXY(lat, lng, cbb.width, cbb.height)
        for (let i = 0; i < 25; i++) {
            await page.mouse.move(cbb.x + p.x + dx + (i % 2), cbb.y + p.y + dy)
            await page.waitForTimeout(300)
            let c = await page.evaluate(() => document.querySelector('.maplibregl-canvas').style.cursor)
            if (c === 'pointer') return
        }
        throw new Error(`hover (${lat},${lng}) 輪詢後 cursor 仍未變 pointer`)
    }
    //擷取指定 canvas 內區域截圖(等到連續兩張相同視為 settle)
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

    it('E2E-001 circle 點: 滑入 cursor pointer + point tooltip, 滑出還原', async function() {
        await gotoExample()
        await checkEnterLeave(24.08, 120.88, '[Point tooltip]')
    })

    it('E2E-002 icon 點(symbol 圖層): 滑入 cursor pointer + point tooltip, 滑出還原', async function() {
        await gotoExample()
        //預設 icon 錨點為底部中央, 圖示繪於 latLng 上方 → 滑入點落在 latLng 上方 15px 之圖示內
        await checkEnterLeave(24.08, 121.12, '[Point tooltip]', 0, -15)
    })

    it('E2E-003 點群聚 cluster: 滑入群聚圓 cursor pointer, 滑出還原', async function() {
        await gotoExample()
        //cluster 僅切換 cursor, 無 tooltip
        await checkEnterLeave(24.08, 121.00, null)
    })

    it('E2E-004 折線: 滑入 cursor pointer + polyline tooltip, 滑出還原', async function() {
        await gotoExample()
        await checkEnterLeave(23.92, 120.88, '[Polyline tooltip]')
    })

    it('E2E-005 多邊形: 滑入 cursor pointer + polygon tooltip, 滑出還原', async function() {
        await gotoExample()
        await checkEnterLeave(23.92, 121.00, '[Polygon tooltip]')
    })

    it('E2E-006 GeoJSON 面: 滑入 cursor pointer + geojson tooltip, 滑出還原', async function() {
        await gotoExample()
        await checkEnterLeave(23.92, 121.12, '[Geojson tooltip]')
    })

    it('E2E-007 等值線: 滑入 cursor pointer + contour tooltip + hover 樣式變化, 滑出還原', async function() {
        await gotoExample()
        //取樣區域: hover 點右側 8~28px(避開向左彈出之 tooltip; 被 hover 之最內圈色帶僅延伸約 30px, 實測窗須落在其內)
        let p = latLngToCanvasXY(24.00, 121.18, cbb.width, cbb.height)
        let clip = { x: cbb.x + p.x + 8, y: cbb.y + p.y - 20, width: 20, height: 40 }
        let shotBase = await captureRegionStable(clip) //hover 前基準

        await hoverAt(24.00, 121.18)
        await assertCursor('pointer')
        await assertTooltip('[Contour tooltip]')
        //spec: changeStyleWhenHover 開啟時 hover 中填色/線樣式改變 → 區域畫面與 hover 前不同
        let shotHover = await captureRegionStable(clip)
        assert.ok(!shotHover.equals(shotBase), 'hover 中等值線區域畫面應與 hover 前不同(樣式變化)')

        await hoverAtEmpty()
        await assertCursor('')
        await assertNoTooltip()
        //spec: 滑出後樣式還原 → 區域畫面回到 hover 前(輪詢等 repaint)
        let restored = false
        for (let i = 0; i < 10; i++) {
            let shotAfter = await page.screenshot({ clip })
            if (shotAfter.equals(shotBase)) { restored = true; break }
            await page.waitForTimeout(300)
        }
        assert.ok(restored, '滑出後等值線區域畫面應還原為 hover 前樣式')
    })

    it('E2E-008 跨圖層連續移動: 點 → 折線, tooltip 內容切換', async function() {
        await gotoExample()
        await hoverAt(24.08, 120.88)
        await assertTooltip('[Point tooltip]')
        await hoverAt(23.92, 120.88)
        //spec: 移入折線後 tooltip 換為折線內容(先發原圖層 leave 再發新圖層 enter)
        await assertTooltip('[Polyline tooltip]')
        await waitUntilExist(page, 'point tooltip 已被替換', () => {
            let el = document.querySelector('.wlv2-tooltip')
            return !!el && el.innerText.indexOf('[Point tooltip]') < 0
        })
    })

    it('E2E-009 hover 後點擊: 滑入 circle 點後原地點擊 → point popup 開啟', async function() {
        await gotoExample()
        let p = latLngToCanvasXY(24.08, 120.88, cbb.width, cbb.height)
        await page.mouse.move(cbb.x + p.x, cbb.y + p.y)
        await assertCursor('pointer')
        await page.mouse.click(cbb.x + p.x, cbb.y + p.y)
        //spec: 點擊點圖徵開啟 point popup(hover 管理不影響 click 註冊)
        await waitUntilExist(page, 'point popup 開啟', () => {
            let el = document.querySelector('.maplibregl-popup-content')
            return !!el && el.innerText.indexOf('[Point popup]') >= 0 && el.innerText.indexOf('point-circle') >= 0
        })
    })

    it('E2E-010 runtime 變更: 折線換色即時生效, 直接改 opt visible 即時隱藏多邊形', async function() {
        await gotoExample()
        let pl = latLngToCanvasXY(23.92, 120.88, cbb.width, cbb.height)
        let clipLine = { x: cbb.x + pl.x - 20, y: cbb.y + pl.y - 12, width: 40, height: 24 }
        let shotBefore = await captureRegionStable(clipLine) //變更前折線區域(藍色)

        await page.locator('#btnMutate').click()
        //spec: runtime 改 lineColor 後 paint 即時更新 → 折線區域畫面改變(藍→紅)
        let changed = false
        for (let i = 0; i < 10; i++) {
            let s = await page.screenshot({ clip: clipLine })
            if (!s.equals(shotBefore)) {
                changed = true; break
            }
            await page.waitForTimeout(300)
        }
        assert.ok(changed, 'runtime 改 lineColor 後折線區域畫面應改變')

        //spec: 直接改 opt.polygonSets[0].visible=false → 多邊形圖層即時隱藏(hover 無 cursor/tooltip)
        await hoverAt(23.92, 121.00)
        await page.waitForTimeout(1000) //給 debounce 與 hover 命中測試節流時間, 再驗「無反應」
        let cursor = await page.evaluate(() => document.querySelector('.maplibregl-canvas').style.cursor)
        assert.strictEqual(cursor, '', '多邊形已隱藏, hover 不應出現 pointer cursor')
        let hasTip = await page.evaluate(() => !!document.querySelector('.wlv2-tooltip'))
        assert.ok(!hasTip, '多邊形已隱藏, 不應顯示 tooltip')

        //spec: 折線 hover 仍正常(handler 於事件時取得最新一輪 render 資料)
        await hoverAt(23.92, 120.88)
        await assertCursor('pointer')
        await assertTooltip('[Polyline tooltip]')
    })

    it('E2E-011 陣列頭部插入 pointSet: 位移後各組 hover/click 資料仍正確', async function() {
        await gotoExample()
        await page.locator('#btnShiftSets').click()
        //spec: 新頭部組的點渲染完成後可 hover, tooltip 帶其 title(point-head)
        await hoverAtUntilPointer(24.00, 120.88)
        await assertTooltip('point-head')
        //spec: 位移後原 circle 點 hover tooltip 仍為自己的 title(資料未錯置)
        await hoverAtEmpty()
        await assertCursor('')
        await hoverAtUntilPointer(24.08, 120.88)
        await assertTooltip('point-circle')
        //spec: 位移後 icon 點 hover 仍正常且資料正確(icon/資料未錯置)
        await hoverAtEmpty()
        await assertCursor('')
        await hoverAtUntilPointer(24.08, 121.12, 0, -15)
        await assertTooltip('point-icon')
        //spec: 位移後點群聚組(內容未變, 差異更新下屬「跳過重建」組)hover 仍正常
        await hoverAtEmpty()
        await assertCursor('')
        await hoverAtUntilPointer(24.08, 121.00)
        //spec: 位移後點擊原 circle 點 → popup 資料正確
        let p = latLngToCanvasXY(24.08, 120.88, cbb.width, cbb.height)
        await page.mouse.click(cbb.x + p.x, cbb.y + p.y)
        await waitUntilExist(page, 'popup 帶 point-circle', () => {
            let el = document.querySelector('.maplibregl-popup-content')
            return !!el && el.innerText.indexOf('[Point popup]') >= 0 && el.innerText.indexOf('point-circle') >= 0
        })
    })

})
