// e2e: 圖台縮放範圍(opt.minZoom/maxZoom)、opt↔地圖寫回迴圈、center 驗證、比例尺文字之畫面行為
//
// 規格句(src/components/WMaplibreglVue.vue 之 @vue-prop, 以下代稱; 規則見 CLAUDE_rulebook.md R11/R12/R13/R15):
//   J-max   opt.maxZoom 預設22, 夾在0~24; 「使用者縮放、縮放按鈕、opt.zoom與API皆受此限制」「可於執行期變更(須於opt預先宣告此鍵)」
//   J-min   opt.minZoom 預設0, 夾在0~24; 「大於maxZoom時忽略minZoom並console.warn」
//   J-zoom  opt.zoom 「元件不另夾值, 超出範圍者由地圖拉入範圍, 使用者縮放、縮放按鈕或API縮放後會把地圖實際層級寫回本欄位
//           (地球投影下實際下限隨緯度略低於minZoom, 墨卡托投影下受容器高度限制而略高於minZoom, 皆以實際層級為準)」
//   J-ctr   opt.center 「兩值皆須為有限數且緯度在±90內, 否則視為未給(用預設[23.5, 121.1])」
//   J-scale 比例尺文字為 80px 對應之實際地面距離(R15)
//   R12     父層同一 tick 同時變更 center 與 zoom(含整個換新 opt)兩者皆生效; 平移動畫中改 zoom 不吞 center; 切換投影/容器 resize 後 opt.zoom 與地圖一致
//
// 真實 user path(6 步):
//   1. 開首頁(App.vue 範例選單)
//   2. 點 basic > zoomRange 子選單(真實點擊)(E2E-Z10 改點 panelBaseMaps > baseMap.maxzoom)
//   3. 看到地圖(17 級, 單色離線圖磚)、縮放 +/- 按鈕、比例尺、父層 opt 即時值(#optZoom 等)
//   4. 真實點擊頁面按鈕(#btnMax20 等, 於單一 handler 內同一 tick 變更 opt)、縮放按鈕 .clsZoomBtn、滾輪(page.mouse.wheel)、點叢集
//   5. 觀察地圖層級(公開 API getMapObject().getZoom())、#optZoom/#optCenter、比例尺文字、console 警告
//   6. (補強)zoom/zoomend 事件序列(頁內鉤子, 屬觀察非 act): 證明「無彈回」而非只看終值
//
// 按鈕全清單比對(範例頁): 子選單項、#btnMax20(Z2)、#btnMin5(Z3)、#btnShrink/#btnExpand(Z5)、#btnBad(Z6)、#btnShrinkMove(Z9)、
//   #btnFly(Z8)、#btnReplace(Z8b)、#btnPan(Z11)、#btnZoom3(Z4)、#btnZoom7(Z3)、#btnZoom10(Z5/Z9)、#btnZoom14(Z11)、#btnZoom04(Z13)、
//   #btnApiZoomTo21/#btnApiEaseTo21/#btnApiFlyTo20(Z7a/b/c)、#btnMercator(Z12/Z13/Z16)、#btnTall(Z13)、#btnBadCenter(Z17)、
//   #btnScale1/#btnScale2(Z16)、#btnRemount25/#btnRemountNoZoom(Z14)、縮放 +/- 按鈕(Z1~Z5、Z10)、滾輪(Z2、Z4b)、叢集點擊(Z15)。全數 covered。
//
// 下限斷言之容差 [min-0.2, min+0.3]: 地圖實際可達最小層級受投影影響(maplibre-gl-dev.mjs:44811-44818: globe 為 minZoom+log2(cos 緯度),
// 緯度 25° ≈ -0.143; mercator 受容器高度限制, 800x500 容器 ≈ -0.034), 屬 maplibre 自身行為(R11 L1)。
// 「無彈回」以 zoomend 事件序列單調為斷言(終值相同而過程彈回者只看終值測不出)。
//
// 圖磚: 範例頁以 maplibregl.addProtocol('e2ezr') 供應單色圖磚, 永不連外。
// 標準圖政策: 依 CLAUDE_rulebook.md〈e2e 映射〉無跨 run 標準圖(語意斷言)。無 i18n, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-Z1  預設上限 22: 自 17 級連按放大鈕 4 次依序 18、19、20、21, 無彈回(issue #3); getMaxZoom()=22
//   - E2E-Z2  opt.maxZoom=20: 放大鈕與滾輪皆停於 20, getMaxZoom()=20
//   - E2E-Z3  opt.minZoom=5: 縮小鈕停於 5(globe 下 ≈4.857), 無振盪
//   - E2E-Z4  預設下限 0: 自 3 級連按縮小鈕不彈回 1, 停於 0(globe ≈ -0.143)
//   - E2E-Z4b 預設下限 0: 滾輪縮到底不彈回 1
//   - E2E-Z5  執行期收縮 maxZoom=8: 地圖被拉入 8 且 opt.zoom 寫回 8; 放寬 22 後不動, 再放大到 9
//   - E2E-Z6  minZoom=14 大於 maxZoom=10: 忽略 minZoom(getMinZoom()=0), console.warn 恰 1 則並寫明有效 maxZoom; Z6b 建圖時同; Z6c 只給 minZoom=23(有效範圍不變)亦警告
//   - E2E-Z7a/b/c 公開 API zoomTo(21)/easeTo(21)/flyTo(20) 不彈回
//   - E2E-Z8  同一 tick 設 center+zoom: 兩者皆生效; E2E-Z8b 整個換新 opt: 兩者皆生效
//   - E2E-Z9  同一 tick 設 maxZoom=8 與 center: zoom 8、center 為新值; Z9b 加 zoom=8; Z9c globe 下往高緯度之 center(zoom 維持父層明給值)
//   - E2E-Z10 baseMaps[i].maxzoom 與圖台上限分工: 自 18 級放大鈕續放大至 21, 超過服務層級仍以 18 級圖磚放大顯示且不請求 19 級以上
//   - E2E-Z11 元件發起之平移動畫進行中改 zoom: 不吞 center(跨 tick); Z11b 連續兩次改 center 後第二段動畫中改 zoom
//   - E2E-Z12 切換投影後 opt.zoom/opt.center 與地圖一致; Z12b 經公開 API setProjection 切換
//   - E2E-Z13 容器 resize 後 opt.zoom 與地圖一致
//   - E2E-Z14 初始超界 opt.zoom=25 於建圖後寫回 22; opt 未宣告 zoom 鍵者不新增鍵; Z14c 未宣告 zoom 鍵而預設 6 落在範圍外(maxZoom=4)時回寫且其後無關之 opt 變更不 setZoom/jumpTo
//   - E2E-Z15 叢集點擊展開層級 > 18 不彈回
//   - E2E-Z16 比例尺文字為 80px 實際地面距離(兩組 zoom/緯度)
//   - E2E-Z17 center=[91,121] 非法值+zoom 同 tick: 不崩潰, center 用預設, zoom 生效; Z17b 建圖時同
//   - E2E-Z18~Z21 開啟地形(離線平坦 DEM)之代表案例: 連按放大鈕不彈回、同 tick center+zoom、範圍拉入+center、平移動畫中改 zoom
import assert from 'assert'
import { PNG } from 'pngjs'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'

const EPS = 1e-6
const MIN_TOL = [-0.2, 0.3] //下限容差(相對 minZoom), 依據見檔頭

let near = (a, b, tol = EPS) => Math.abs(a - b) <= tol
//序列單調不減/不增(容許浮點 EPS)
let nonDecreasing = (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1] - EPS)
let nonIncreasing = (arr) => arr.every((v, i) => i === 0 || v <= arr[i - 1] + EPS)

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

describe('e2e-zoomrange', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    let errs = null //pageerror
    let warns = null //console.warn
    beforeEach(async function() {
        browser = await launchChromium({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 } })
        page = await ctx.newPage()
        errs = []
        warns = []
        page.on('pageerror', (e) => errs.push(String(e.message)))
        page.on('console', (m) => {
            if (m.type() === 'warning') warns.push(m.text())
        })
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
    })

    //地圖就緒(公開 API getMapObject() 取得且 loaded) + 掛 zoom/zoomend/move 事件鉤子(觀察用)
    let waitMapReady = async () => {
        await waitUntilExist(page, '地圖就緒', () => {
            let m = window.__getMap && window.__getMap()
            return !!m && m.loaded()
        })
        await page.evaluate(() => {
            let m = window.__getMap()
            window.__ev = []
            let rec = (type) => () => window.__ev.push({ t: performance.now(), type, z: m.getZoom() })
            m.on('zoom', rec('zoom')); m.on('zoomend', rec('zoomend')); m.on('move', rec('move'))
        })
    }
    let resetEv = async () => {
        await page.evaluate(() => {
            window.__ev = []
        })
    }
    //靜止: 地圖不在移動/動畫中且 q ms 內無 zoom/move 事件(涵蓋寫回迴圈之下一輪 watcher 與彈回); 不用固定秒數
    let settle = async (q = 600) => {
        await page.evaluate((qq) => new Promise((resolve) => {
            let m = window.__getMap()
            let t0 = performance.now()
            let tick = () => {
                let last = window.__ev.length ? window.__ev[window.__ev.length - 1].t : 0
                let quiet = performance.now() - Math.max(last, t0)
                if (!m.isMoving() && quiet > qq) resolve()
                else setTimeout(tick, 50)
            }
            setTimeout(tick, 100)
        }), q)
    }
    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsSubMenu-basic', { hasText: 'zoomRange' }).first().click()
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'))
        await waitMapReady()
        await settle()
    }
    //點重新掛載按鈕後等「新地圖實例」就緒(以公開 API 代理物件身分判斷, 免誤鉤舊實例)並重掛事件鉤子
    let remountAndWait = async (sel) => {
        await page.evaluate(() => {
            window.__prevMap = window.__getMap()
        })
        await page.locator(sel).click()
        await waitUntilExist(page, '新地圖實例', () => {
            let m = window.__getMap && window.__getMap()
            return !!m && m !== window.__prevMap
        })
        await waitMapReady()
        await settle()
    }
    let getZoom = async () => await page.evaluate(() => window.__getMap().getZoom())
    let getMinMax = async () => await page.evaluate(() => ({ min: window.__getMap().getMinZoom(), max: window.__getMap().getMaxZoom() }))
    let getCenter = async () => await page.evaluate(() => {
        let c = window.__getMap().getCenter()
        return [c.lat, c.lng]
    })
    let optZoom = async () => Number(await page.locator('#optZoom').innerText())
    let optCenterText = async () => await page.locator('#optCenter').innerText()
    let optCenterNums = async (i) => Number((await optCenterText()).split(',')[i])
    //事件序列(依發生序)
    let evZ = async (type) => await page.evaluate((ty) => window.__ev.filter((e) => e.type === ty).map((e) => e.z), type)
    let click = async (sel) => {
        await page.locator(sel).click()
    }
    //縮放按鈕(真實點擊), 每次點後等靜止
    let zoomBtn = async (dir) => {
        await page.locator('.clsZoomBtn').nth(dir === 'in' ? 0 : 1).click()
        await settle()
    }
    //滾輪(真實滾輪事件): 游標置於畫布中心(globe 下以游標為錨縮小時, 偏離中心的游標會使中心往高緯度漂移, 而 globe 下限為
    //minZoom+log2(cos 中心緯度)隨之放寬至遠低於 minZoom, 屬 maplibre 自身行為〔R11 L1〕, 非彈回; 置中則中心不動, 下限容差才有意義),
    //逐格送出(事件間隔 40ms 僅為模擬連續滾動, 非同步手段)
    let wheel = async (deltaY, n) => {
        let bb = await page.locator('.maplibregl-canvas').boundingBox()
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
        for (let i = 0; i < n; i++) {
            await page.mouse.wheel(0, deltaY)
            await page.waitForTimeout(40)
        }
        await settle(800)
    }

    it('E2E-Z1 預設上限 22: 自 17 級連按放大鈕 4 次依序 18、19、20、21 且無彈回(issue #3)', async function() {
        await gotoExample()
        assert.ok(near(await getZoom(), 17), '前置: 初始 17 級')
        await resetEv()
        let seen = []
        for (let i = 0; i < 4; i++) {
            await zoomBtn('in')
            seen.push(await getZoom())
        }
        //J-max: 使用者縮放按鈕皆受 maxZoom(預設22)限制而非舊的 18 夾值 → 18、19、20、21
        assert.deepStrictEqual(seen.map((v) => Math.round(v * 1e6) / 1e6), [18, 19, 20, 21], `連按 4 次後層級 ${JSON.stringify(seen)}`)
        //補強(無彈回): zoomend 序列單調不減(修前為 [18,19,18,19,18,…])
        let zs = await evZ('zoomend')
        assert.ok(nonDecreasing(zs), `zoomend 序列不應回降: ${JSON.stringify(zs)}`)
        //J-zoom: 地圖實際層級寫回 opt.zoom
        assert.ok(near(await optZoom(), 21, 1e-3), `opt.zoom 應為 21, 實際 ${await optZoom()}`)
        //J-max: 預設 22
        assert.strictEqual((await getMinMax()).max, 22)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-Z2 opt.maxZoom=20: 放大鈕與滾輪皆停於 20, getMaxZoom()=20', async function() {
        await gotoExample()
        await click('#btnMax20')
        await settle()
        //J-max: 執行期變更生效, 地圖範圍上限為 20(HEAD 忽略 opt.maxZoom 恆 22)
        assert.strictEqual((await getMinMax()).max, 20)
        await resetEv()
        for (let i = 0; i < 6; i++) await zoomBtn('in') //17 → 18、19、20、20、20、20
        assert.ok(near(await getZoom(), 20), `放大鈕應停於 20, 實際 ${await getZoom()}`)
        assert.ok(nonDecreasing(await evZ('zoomend')), `zoomend 序列不應回降: ${JSON.stringify(await evZ('zoomend'))}`)
        await wheel(-400, 20) //J-max: 滾輪亦受限
        assert.ok(near(await getZoom(), 20), `滾輪過量放大仍應停於 20, 實際 ${await getZoom()}`)
        assert.ok(near(await optZoom(), 20, 1e-3), `opt.zoom 應為 20, 實際 ${await optZoom()}`)
    })

    it('E2E-Z3 opt.minZoom=5: 縮小鈕停於 5(globe 下 ≈4.857)且無振盪', async function() {
        await gotoExample()
        await click('#btnMin5')
        await settle()
        assert.strictEqual((await getMinMax()).min, 5) //J-min: 執行期變更生效
        await click('#btnZoom7')
        await settle()
        await resetEv()
        for (let i = 0; i < 5; i++) await zoomBtn('out') //7 → 6、5、(≈4.857)、不再變
        let z = await getZoom()
        assert.ok(z >= 5 + MIN_TOL[0] && z <= 5 + MIN_TOL[1], `縮小鈕應停於 5 附近, 實際 ${z}`)
        //補強(無振盪): zoomend 序列單調不增(修前被元件夾值與地圖範圍不一致拉回而振盪; HEAD 另忽略 minZoom 縮至更低)
        let zs = await evZ('zoomend')
        assert.ok(nonIncreasing(zs), `zoomend 序列不應回升: ${JSON.stringify(zs)}`)
        assert.ok(zs.every((v) => v >= 5 + MIN_TOL[0]), `不應低於 minZoom 容差: ${JSON.stringify(zs)}`)
    })

    it('E2E-Z4 預設下限 0: 自 3 級連按縮小鈕不彈回 1, 停於 0 附近', async function() {
        await gotoExample()
        await click('#btnZoom3')
        await settle()
        await resetEv()
        for (let i = 0; i < 8; i++) await zoomBtn('out')
        let z = await getZoom()
        //J-min: 預設 0(原寫死 1 而彈回); globe 下實際下限 ≈ -0.143, 容差見檔頭
        assert.ok(z >= MIN_TOL[0] && z <= MIN_TOL[1], `縮小鈕應停於 0 附近, 實際 ${z}`)
        let zs = await evZ('zoomend')
        assert.ok(nonIncreasing(zs), `zoomend 序列不應回升(修前 [2,1,1,0,1,0,…]): ${JSON.stringify(zs)}`)
        assert.ok(near(await optZoom(), z, 1e-3), `opt.zoom 應為地圖實際層級 ${z}, 實際 ${await optZoom()}`)
    })

    it('E2E-Z4b 預設下限 0: 滾輪縮到底不彈回 1', async function() {
        await gotoExample()
        await click('#btnZoom3')
        await settle()
        await resetEv()
        await wheel(400, 25)
        let z = await getZoom()
        assert.ok(z >= MIN_TOL[0] && z <= MIN_TOL[1], `滾輪縮到底應停於 0 附近, 實際 ${z}`)
        let zs = await evZ('zoomend')
        assert.ok(nonIncreasing(zs), `zoomend 序列不應回升: ${JSON.stringify(zs)}`)
    })

    it('E2E-Z5 執行期變更範圍: 收縮 maxZoom=8 → 地圖被拉入 8 且 opt.zoom 寫回 8; 放寬 22 後不動, 再放大到 9', async function() {
        await gotoExample()
        await click('#btnZoom10')
        await settle()
        assert.ok(near(await getZoom(), 10))
        await click('#btnShrink')
        await settle()
        //J-max/J-zoom: 收縮後現行層級被地圖拉入範圍, 並以實際層級寫回 opt.zoom
        assert.deepStrictEqual(await getMinMax(), { min: 0, max: 8 })
        assert.ok(near(await getZoom(), 8), `收縮後地圖應為 8, 實際 ${await getZoom()}`)
        assert.ok(near(await optZoom(), 8, 1e-3), `收縮後 opt.zoom 應為 8, 實際 ${await optZoom()}`)
        await click('#btnExpand')
        await settle()
        assert.strictEqual((await getMinMax()).max, 22)
        assert.ok(near(await getZoom(), 8), `放寬後不應自動變動, 實際 ${await getZoom()}`)
        await zoomBtn('in')
        assert.ok(near(await getZoom(), 9), `放寬後再放大應可到 9, 實際 ${await getZoom()}`)
    })

    it('E2E-Z6 minZoom=14 大於 maxZoom=10: 忽略 minZoom(getMinZoom()=0)並 console.warn 恰 1 則(寫明有效 maxZoom)', async function() {
        await gotoExample()
        warns.length = 0
        await click('#btnBad')
        await settle()
        //J-min: 大於maxZoom時忽略minZoom並console.warn
        assert.deepStrictEqual(await getMinMax(), { min: 0, max: 10 })
        let w = warns.filter((t) => t.includes('minZoom'))
        assert.strictEqual(w.length, 1, `應恰 1 則 minZoom 警告, 實際 ${JSON.stringify(warns)}`)
        assert.ok(w[0].includes('10'), `警告應寫明有效 maxZoom(10): ${w[0]}`)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤(HEAD 之 A 方案會使元件無法建立): ${errs.join(' | ')}`)
        await zoomBtn('in')
        assert.ok(near(await getZoom(), 10), `元件仍可用且停於有效 maxZoom 10, 實際 ${await getZoom()}`)
    })

    it('E2E-Z6b 建圖時 minZoom=14 大於 maxZoom=10(重新掛載): 元件可建立, 忽略 minZoom, console.warn 恰 1 則', async function() {
        await gotoExample()
        warns.length = 0
        await remountAndWait('#btnRemountBad')
        //J-min: 建圖路徑(createMap)亦同; 修前 minZoom>maxZoom 傳入 new Map 會拋錯使整個元件無法建立
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
        assert.deepStrictEqual(await getMinMax(), { min: 0, max: 10 })
        let w = warns.filter((t) => t.includes('minZoom'))
        assert.strictEqual(w.length, 1, `應恰 1 則 minZoom 警告(建圖時一次, 不因其後 changeOpt 重複), 實際 ${JSON.stringify(warns)}`)
        assert.ok(w[0].includes('10'), `警告應寫明有效 maxZoom(10): ${w[0]}`)
        assert.ok(near(await getZoom(), 10), `初始 17 級應被拉入 10, 實際 ${await getZoom()}`)
    })

    it('E2E-Z6c 只給 minZoom=23(有效範圍仍為預設 0~22): 忽略 minZoom 並 console.warn 恰 1 則', async function() {
        await gotoExample()
        warns.length = 0
        await click('#btnMin23')
        await settle()
        //J-min: 大於maxZoom(預設22)時忽略minZoom並console.warn; 與有效範圍是否改變無關(修前警告只在有效範圍改變時才發出)
        assert.deepStrictEqual(await getMinMax(), { min: 0, max: 22 })
        let w = warns.filter((t) => t.includes('minZoom'))
        assert.strictEqual(w.length, 1, `應恰 1 則 minZoom 警告, 實際 ${JSON.stringify(warns)}`)
        assert.ok(w[0].includes('22'), `警告應寫明有效 maxZoom(22): ${w[0]}`)
    })

    //公開 API: 使用端程式呼叫 getMapObject() 取得 map 後操作(以頁面按鈕呼叫)
    for (let [id, label, target] of [['Z7a', '#btnApiZoomTo21', 21], ['Z7b', '#btnApiEaseTo21', 21], ['Z7c', '#btnApiFlyTo20', 20]]) {
        it(`E2E-${id} 公開 API ${label.slice(4)} 不彈回: 終值為 ${target}`, async function() {
            await gotoExample()
            await resetEv()
            await click(label)
            await waitUntilExist(page, '動畫開始', () => window.__getMap().isMoving() || Math.abs(window.__getMap().getZoom() - 17) > 0.01)
            await settle(900)
            //J-max: API 縮放亦受 maxZoom(22)而非舊夾值 18 限制; 修前峰值後彈回 18
            assert.ok(near(await getZoom(), target), `終值應為 ${target}, 實際 ${await getZoom()}`)
            assert.ok(near(await optZoom(), target, 1e-3), `opt.zoom 應為 ${target}, 實際 ${await optZoom()}`)
            let zs = await evZ('zoomend')
            assert.ok(zs.length >= 1 && near(zs[zs.length - 1], target), `最後一次 zoomend 應為 ${target}: ${JSON.stringify(zs)}`)
        })
    }

    it('E2E-Z8 同一 tick 設 center+zoom=14: 地圖與 opt 兩者皆生效(不吞 center)', async function() {
        await gotoExample()
        await click('#btnFly')
        await settle()
        //R12: 同變更用單一 jumpTo; 修前 setZoom 同步觸發 moveend 把舊 center 寫回 opt.center, 新 center 被吞
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
        assert.strictEqual(await optCenterText(), '23.5,120.9', `opt.center 應為新值, 實際 ${await optCenterText()}`)
        assert.ok(near(await optZoom(), 14, 1e-3))
    })

    it('E2E-Z8b 整個換新 opt(center+zoom=14): 兩者皆生效', async function() {
        await gotoExample()
        await click('#btnReplace')
        await settle()
        let c = await getCenter()
        assert.ok(near(c[0], 24, 2e-3) && near(c[1], 121, 2e-3), `地圖中心應為 [24,121], 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
        //opt 值亦須為新值(修前 opt.center 被舊 center 蓋回)
        assert.strictEqual(await optCenterText(), '24,121', `opt.center 應為新值, 實際 ${await optCenterText()}`)
        assert.ok(near(await optZoom(), 14, 1e-3), `opt.zoom 應為 14, 實際 ${await optZoom()}`)
    })

    it('E2E-Z9 同一 tick 設 maxZoom=8 與 center: zoom 被拉入 8 且 center 為新值', async function() {
        await gotoExample()
        await click('#btnZoom10')
        await settle()
        await click('#btnShrinkMove')
        await settle()
        //R12: 範圍變更期間護欄, 範圍外層級被拉入時同步觸發之 moveend 不得以舊 center 蓋掉父層同 tick 賦值之新 center
        assert.strictEqual((await getMinMax()).max, 8)
        assert.ok(near(await getZoom(), 8), `zoom 應被拉入 8, 實際 ${await getZoom()}`)
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
        assert.strictEqual(await optCenterText(), '23.5,120.9')
    })

    it('E2E-Z9b 同一 tick 設 maxZoom=8、zoom=8 與 center(範圍外之現行層級被拉入後 zoom 已等於目標): center 為新值', async function() {
        await gotoExample()
        await click('#btnZoom10')
        await settle()
        await click('#btnShrinkZoomMove')
        await settle()
        //R12-2: 此情形範圍變更把 zoom 拉到 8 後 needZoom 為假、僅剩 center 需變更; 無護欄時拉入所同步觸發之 moveend 先把舊 center 寫回 opt.center,
        //其後重排之 watcher 以舊 center panTo 回去 → 新 center 被吞(護欄 holdWriteBack 之鑑別案例)
        assert.strictEqual((await getMinMax()).max, 8)
        assert.ok(near(await getZoom(), 8), `zoom 應為 8, 實際 ${await getZoom()}`)
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
        assert.strictEqual(await optCenterText(), '23.5,120.9')
    })

    it('E2E-Z9c globe 下同一 tick 設 maxZoom=5、zoom=5 與較高緯度 center(zoom 已等於範圍拉入結果): zoom 維持 5 且 center 為新值', async function() {
        await gotoExample()
        await click('#btnZoom7') //7 級 → 自動投影為 globe
        await settle()
        await click('#btnShrinkNorth')
        await settle()
        //R12-1: 範圍把現行層級拉到 5 = 父層明給之 zoom 時, 若只剩 center 走 panTo, globe 下 maplibre 會依緯度差調整層級(約 4.14)而丟掉父層明給之 zoom 5;
        //needZoom 須以範圍變更前之層級判斷, 同變更走帶明確 zoom 之 jumpTo
        assert.strictEqual((await getMinMax()).max, 5)
        assert.ok(near(await getZoom(), 5, 1e-3), `zoom 應維持父層明給之 5, 實際 ${await getZoom()}`)
        let c = await getCenter()
        assert.ok(near(c[0], 60, 2e-3) && near(c[1], 121, 2e-3), `地圖中心應為 [60,121], 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await optZoom(), 5, 1e-3), `opt.zoom 應為 5, 實際 ${await optZoom()}`)
    })

    it('E2E-Z10 baseMaps[i].maxzoom 與圖台上限分工: 自 18 級放大鈕續放大至 21, 仍以 18 級圖磚放大顯示且不請求 19 級以上', async function() {
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.locator('.clsMainMenu-basic', { hasText: 'panelBaseMaps' }).first().click()
        await page.locator('.clsSubMenu-basic', { hasText: 'baseMap.maxzoom' }).first().click()
        await waitUntilExist(page, '頁面計數 #overRed', () => !!document.querySelector('#overRed'))
        await waitMapReady()
        await settle()
        await page.locator('label', { hasText: '紅 maxzoom:18' }).locator('input[type=checkbox]').click()
        await resetEv()
        for (let i = 0; i < 3; i++) await zoomBtn('in') //18 → 19、20、21
        //J-max(opt.maxZoom 預設 22): 修前被夾回 18
        assert.ok(near(await getZoom(), 21), `應可放大到 21, 實際 ${await getZoom()}`)
        assert.ok(nonDecreasing(await evZ('zoomend')))
        //baseMaps[i].maxzoom=18: 超過時改以 18 級圖磚放大顯示 → 取樣區仍為紅, 且不請求 19 級以上
        let bb = await page.locator('.maplibregl-canvas').boundingBox()
        let clip = { x: Math.round(bb.x + bb.width / 2 - 20), y: Math.round(bb.y + bb.height / 2 - 20), width: 40, height: 40 }
        let r = 0
        for (let i = 0; i < 20; i++) {
            r = colorRatio(await page.screenshot({ clip }), [220, 40, 40])
            if (r > 0.9) break
            await page.waitForTimeout(300)
        }
        assert.ok(r > 0.9, `zoom 21 取樣區應仍為紅色, 實際紅色比例 ${r.toFixed(3)}`)
        assert.strictEqual(Number(await page.locator('#overRed').innerText()), 0, '不應請求 19 級以上圖磚')
    })

    //跨 tick: 由範例頁(父層程式)以計時器依序賦值(按鈕一次點擊), 賦值 zoom 當下地圖是否仍在移動中由頁面記錄於 window.__movingAtZoom 供驗證前提
    //(不用「測試端先點兩次」, 因 Playwright 兩次點擊之間隔不確定而可能落在動畫結束後, 造成無鑑別力之假綠)
    it('E2E-Z11 平移動畫進行中改 zoom(跨 tick): 不吞 center', async function() {
        await gotoExample()
        await click('#btnPanThenZoom') //opt.center 改新值 → 元件 panTo 動畫(約 500ms); 150ms 後(動畫中)父層改 opt.zoom=14
        await waitUntilExist(page, 'zoom 已賦值', () => window.__movingAtZoom !== undefined)
        assert.strictEqual(await page.evaluate(() => window.__movingAtZoom), true, '前置: 父層賦值 zoom 當下平移動畫應仍在進行中(跨 tick 情境)')
        await settle(900)
        //R12-5: panTarget 一併落定; 修前 setZoom 之 stop() 補發 moveend 把動畫中途點寫回 opt.center
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為目標 [23.5,120.9](非動畫中途點), 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
        assert.strictEqual(await optCenterText(), '23.5,120.9')
    })

    it('E2E-Z11b 連續兩次改 center 後、第二段平移動畫進行中改 zoom: 不吞第二個 center', async function() {
        await gotoExample()
        await click('#btnPanPanZoom') //t=0 center→A; t=120ms center→B(中斷 A 之動畫); t=260ms(B 動畫中)zoom=14
        await waitUntilExist(page, 'zoom 已賦值', () => window.__movingAtZoom !== undefined)
        assert.strictEqual(await page.evaluate(() => window.__movingAtZoom), true, '前置: 賦值 zoom 當下第二段平移動畫應仍在進行中')
        await settle(900)
        //R12-5: 第二次 panTo 之 stop() 同步補發被中斷動畫之 moveend 會清除 panTarget; panTarget 須於 panTo 之後設, 否則第二段動畫中改 zoom 走 setZoom,
        //其 stop() 把 B 之動畫中途點寫回 opt.center, B 永久遺失
        let c = await getCenter()
        assert.ok(near(c[0], 24.5, 2e-3) && near(c[1], 121.5, 2e-3), `地圖中心應為第二個目標 [24.5,121.5], 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
        assert.strictEqual(await optCenterText(), '24.5,121.5')
    })

    it('E2E-Z12 切換投影後 opt.zoom 與地圖一致(globe 縮到底 → mercator)', async function() {
        await gotoExample()
        await click('#btnZoom3')
        await settle()
        for (let i = 0; i < 5; i++) await zoomBtn('out') //globe 下縮到底 ≈ -0.143
        let zBefore = await getZoom()
        await click('#btnMercator')
        await waitUntilExist(page, 'opt.projection 已更新', () => document.querySelector('#optProj').innerText === 'mercator')
        await settle()
        let zAfter = await getZoom()
        assert.ok(Math.abs(zAfter - zBefore) > 0.05, `前置: 切換投影應使層級改變(globe 下限 → mercator 受限), 切換前 ${zBefore} 後 ${zAfter}`)
        //J-zoom: 以地圖實際層級為準; 修前切換投影不發 zoomend, opt.zoom 仍為切換前值
        assert.ok(near(await optZoom(), zAfter, 1e-3), `opt.zoom 應等於地圖層級 ${zAfter}, 實際 ${await optZoom()}`)
        //J-zoom/R12-6: 切換投影帶約束遷移 transform 亦可能改動中心(mercator 世界高度適配把中心拉近赤道), opt.center 須與地圖一致
        let c = await getCenter()
        assert.ok(near(await optCenterNums(0), c[0], 2e-3) && near(await optCenterNums(1), c[1], 2e-3), `opt.center 應等於地圖中心 ${JSON.stringify(c)}, 實際 ${await optCenterText()}`)
    })

    it('E2E-Z12b 使用端經公開 API getMapObject().setProjection 切換投影後 opt.zoom/opt.center 與地圖一致', async function() {
        await gotoExample()
        await click('#btnZoom3')
        await settle()
        for (let i = 0; i < 5; i++) await zoomBtn('out') //globe 下縮到底
        let zBefore = await getZoom()
        await click('#btnApiMercator') //不經 opt.projection, 亦不發 zoomend/moveend
        await waitUntilExist(page, '投影已切換', () => window.__getMap().getProjection().type === 'mercator')
        await settle()
        let zAfter = await getZoom()
        assert.ok(Math.abs(zAfter - zBefore) > 0.05, `前置: 切換投影應使層級改變, 切換前 ${zBefore} 後 ${zAfter}`)
        //R12-6: projectiontransition 事件重讀; 修前 opt.zoom 仍為切換前值
        assert.ok(near(await optZoom(), zAfter, 1e-3), `opt.zoom 應等於地圖層級 ${zAfter}, 實際 ${await optZoom()}`)
        let c = await getCenter()
        assert.ok(near(await optCenterNums(0), c[0], 2e-3) && near(await optCenterNums(1), c[1], 2e-3), `opt.center 應等於地圖中心 ${JSON.stringify(c)}, 實際 ${await optCenterText()}`)
    })

    it('E2E-Z13 容器 resize 後 opt.zoom 與地圖一致(mercator, 容器高 500 → 1200)', async function() {
        await gotoExample()
        await click('#btnMercator')
        await click('#btnZoom04')
        await settle()
        assert.ok(near(await getZoom(), 0.4, 1e-3), `前置: mercator zoom 0.4, 實際 ${await getZoom()}`)
        await click('#btnTall') //容器變高 → mercator 世界高度適配抬高最小層級 log2(1200/512)=1.2288
        await waitUntilExist(page, '地圖層級被抬高', () => window.__getMap().getZoom() > 1)
        await settle()
        let z = await getZoom()
        assert.ok(near(z, 1.2288, 0.01), `地圖層級應被抬高至約 1.2288, 實際 ${z}`)
        //J-zoom: resize 只發 resize/moveend 不發 zoomend; 修前 opt.zoom 仍為 0.4
        assert.ok(near(await optZoom(), z, 1e-3), `opt.zoom 應等於地圖層級 ${z}, 實際 ${await optZoom()}`)
    })

    it('E2E-Z14 初始超界 opt.zoom=25 於建圖後寫回 22; opt 未宣告 zoom 鍵者不新增鍵', async function() {
        await gotoExample()
        await remountAndWait('#btnRemount25')
        //J-zoom: 超出範圍者由地圖拉入範圍並以實際層級寫回; 修前 opt.zoom 維持 25(stale)至首次縮放
        assert.ok(near(await getZoom(), 22), `地圖應被夾在 22, 實際 ${await getZoom()}`)
        assert.ok(near(await optZoom(), 22, 1e-3), `opt.zoom 應寫回 22, 實際 ${await optZoom()}`)

        //未宣告 zoom 鍵: 不得替使用端新增(否則日後第一次無關之 opt 變更會以過期值 setZoom 而中斷使用者手勢)
        await remountAndWait('#btnRemountNoZoom')
        assert.strictEqual(await page.evaluate(() => window.__hasZoomKey()), false, 'opt 未宣告 zoom 鍵時元件不得新增該鍵')
    })

    it('E2E-Z14c opt 未宣告 zoom 鍵而預設 6 落在範圍外(maxZoom=4): 建圖後 opt.zoom 與地圖一致, 其後無關之 opt 變更不以過期值 setZoom/jumpTo', async function() {
        await gotoExample()
        await remountAndWait('#btnRemountMax4')
        //R12-7: 預設 6 被地圖夾入 4 → 回寫 4(此時地圖與請求不一致才回寫; 與請求一致者不新增鍵, 見 Z14)
        assert.ok(near(await getZoom(), 4), `地圖應被夾在 4, 實際 ${await getZoom()}`)
        assert.ok(near(await page.evaluate(() => window.__getOptZoom()), 4, 1e-3), `opt.zoom 應寫回 4, 實際 ${await page.evaluate(() => window.__getOptZoom())}`)
        //無關之 opt 變更(面板底色): 修前 needZoom 因 currentZoom(4) ≠ 預設 6 而成立 → setZoom(6) → jumpTo → stop() 中斷使用者進行中之手勢/慣性
        await page.evaluate(() => {
            window.__calls.length = 0
        })
        await click('#btnTouch')
        await settle()
        let calls = await page.evaluate(() => window.__calls.slice())
        assert.deepStrictEqual(calls, [], `無關之 opt 變更不應對地圖呼叫 setZoom/jumpTo, 實際 ${JSON.stringify(calls)}`)
        assert.ok(near(await getZoom(), 4))
    })

    it('E2E-Z15 叢集點擊展開層級大於 18(clusterPointsMaxZoom:20 非建議配置): 不彈回', async function() {
        await gotoExample()
        await waitUntilExist(page, '叢集圖層與圖徵就緒', () => {
            let m = window.__getMap()
            let l = m.getStyle().layers.find((x) => x.type === 'circle' && JSON.stringify(x.filter || []).indexOf('point_count') >= 0)
            return !!l && m.queryRenderedFeatures({ layers: [l.id] }).length > 0
        })
        let pos = await page.evaluate(() => {
            let m = window.__getMap()
            let l = m.getStyle().layers.find((x) => x.type === 'circle' && JSON.stringify(x.filter || []).indexOf('point_count') >= 0)
            let f = m.queryRenderedFeatures({ layers: [l.id] })[0]
            let p = m.project(f.geometry.coordinates); let r = m.getCanvas().getBoundingClientRect()
            return { x: r.left + p.x, y: r.top + p.y }
        })
        await resetEv()
        await page.mouse.click(pos.x, pos.y) //真實點擊叢集 → easeTo(展開層級)
        await waitUntilExist(page, '叢集展開動畫開始', () => window.__getMap().isMoving() || window.__getMap().getZoom() > 17.5)
        await settle(900)
        //J-max: 展開層級(≈21)不受舊夾值 18 限制; 修前 [21,18] 彈回
        assert.ok(near(await getZoom(), 21, 0.01), `叢集展開後應為 21, 實際 ${await getZoom()}`)
        let zs = await evZ('zoomend')
        assert.ok(nonDecreasing(zs), `zoomend 序列不應回降: ${JSON.stringify(zs)}`)
    })

    //比例尺: 文字 → 公尺
    let scaleMeters = async () => {
        let t = await page.locator('.clsScale span').innerText()
        let m = t.match(/^(\d+) (km|m)$/)
        assert.ok(m, `比例尺文字格式應為「N km」或「N m」, 實際「${t}」`)
        return { text: t, meters: Number(m[1]) * (m[2] === 'km' ? 1000 : 1) }
    }
    //地圖畫布中央橫向 80px 兩點間之實際地面距離(公尺)
    let realMeters80 = async () => await page.evaluate(() => {
        let m = window.__getMap()
        let r = m.getCanvas().getBoundingClientRect()
        let cx = r.width / 2; let cy = r.height / 2
        return m.unproject([cx, cy]).distanceTo(m.unproject([cx + 80, cy]))
    })
    for (let [btn, label] of [['#btnScale1', '緯度 0 zoom 10'], ['#btnScale2', '緯度 25 zoom 16']]) {
        it(`E2E-Z16 比例尺文字為 80px 實際地面距離(${label})`, async function() {
            await gotoExample()
            await click(btn)
            await settle()
            await waitUntilExist(page, '比例尺文字更新', () => document.querySelector('.clsScale') && /^\d+ (km|m)$/.test(document.querySelector('.clsScale span').innerText))
            let s = await scaleMeters()
            let real = await realMeters80()
            //J-scale: 80px 對應之實際地面距離(取整後容差 5%); 修前為 2 倍(例 zoom 10 緯度 0: 12 km vs 實際 6.1 km)
            let ratio = s.meters / real
            assert.ok(ratio > 0.95 && ratio < 1.05, `比例尺「${s.text}」(${s.meters} m) 與實際 ${real.toFixed(1)} m 之比值應約 1, 實際 ${ratio.toFixed(3)}`)
        })
    }

    it('E2E-Z17 center=[91,121] 非法值+zoom=14 同一 tick: 不崩潰, center 用預設 [23.5,121.1], zoom 生效', async function() {
        await gotoExample()
        await click('#btnBadCenter')
        await settle()
        //J-ctr: 緯度超界視為未給用預設; 修前 panTo([121,91]) 拋 Invalid LngLat latitude value 且 currentCenter 被污染
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 121.1, 2e-3), `地圖中心應為預設 [23.5,121.1], 實際 ${JSON.stringify(c)}`)
        assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
        assert.strictEqual(await optCenterText(), '23.5,121.1', `opt.center 應為預設, 實際 ${await optCenterText()}`)
    })

    it('E2E-Z17b 建圖時 center=[91,121] 非法值(重新掛載): 不崩潰, center 用預設 [23.5,121.1]', async function() {
        await gotoExample()
        await remountAndWait('#btnRemountBadCenter')
        //J-ctr: 建圖路徑亦同; 修前 new Map 拋 Invalid LngLat latitude value 使元件無地圖
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
        let c = await getCenter()
        assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 121.1, 2e-3), `地圖中心應為預設 [23.5,121.1], 實際 ${JSON.stringify(c)}`)
    })

    //開啟地形(離線本地平坦 DEM)之代表案例: maplibre 有地形時 jumpTo/_afterEase 走另一套 transform 與事件路徑(requestedCameraState、putCenterBackOnTerrain),
    //預設設定(套件預設會開地形)下之寫回迴圈須同樣成立
    describe('開啟地形', function() {
        it('E2E-Z18 自 17 級連按放大鈕 4 次依序 18、19、20、21 且無彈回', async function() {
            await gotoExample()
            await remountAndWait('#btnRemountTerrain')
            assert.ok(near(await getZoom(), 17))
            await resetEv()
            let seen = []
            for (let i = 0; i < 4; i++) {
                await zoomBtn('in')
                seen.push(await getZoom())
            }
            assert.deepStrictEqual(seen.map((v) => Math.round(v * 1e6) / 1e6), [18, 19, 20, 21], `連按 4 次後層級 ${JSON.stringify(seen)}`)
            assert.ok(nonDecreasing(await evZ('zoomend')), `zoomend 序列不應回降: ${JSON.stringify(await evZ('zoomend'))}`)
            assert.ok(near(await optZoom(), 21, 1e-3), `opt.zoom 應為 21, 實際 ${await optZoom()}`)
        })

        it('E2E-Z19 同一 tick 設 center+zoom=14: 兩者皆生效', async function() {
            await gotoExample()
            await remountAndWait('#btnRemountTerrain')
            await click('#btnFly')
            await settle()
            let c = await getCenter()
            assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
            assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
            assert.strictEqual(await optCenterText(), '23.5,120.9')
        })

        it('E2E-Z20 同一 tick 設 maxZoom=8、zoom=8 與 center: 範圍拉入後 center 為新值', async function() {
            await gotoExample()
            await remountAndWait('#btnRemountTerrain')
            await click('#btnZoom10')
            await settle()
            await click('#btnShrinkZoomMove')
            await settle()
            assert.strictEqual((await getMinMax()).max, 8)
            assert.ok(near(await getZoom(), 8, 1e-3), `zoom 應為 8, 實際 ${await getZoom()}`)
            let c = await getCenter()
            assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
            assert.strictEqual(await optCenterText(), '23.5,120.9')
        })

        it('E2E-Z21 平移動畫進行中改 zoom(跨 tick): 不吞 center', async function() {
            await gotoExample()
            await remountAndWait('#btnRemountTerrain')
            await page.evaluate(() => {
                window.__movingAtZoom = undefined
            })
            await click('#btnPanThenZoom')
            await waitUntilExist(page, 'zoom 已賦值', () => window.__movingAtZoom !== undefined)
            await settle(900)
            let c = await getCenter()
            assert.ok(near(c[0], 23.5, 2e-3) && near(c[1], 120.9, 2e-3), `地圖中心應為目標 [23.5,120.9], 實際 ${JSON.stringify(c)}`)
            assert.ok(near(await getZoom(), 14), `zoom 應為 14, 實際 ${await getZoom()}`)
            assert.strictEqual(await optCenterText(), '23.5,120.9')
        })
    })
})
