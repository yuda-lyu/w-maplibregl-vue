// e2e: 圖台移動狀態 — 根節點唯讀屬性 state('moving' | 'idle', 規則帳本 R16, src/js/moveState.mjs)
//
// 規格句(src/components/WMaplibreglVue.vue 元件說明之〈根節點 state 屬性〉, 以下代稱):
//   J-attr  根節點有唯讀屬性 state, 值為 'moving'(移動中)或 'idle'(靜止), 比照 w-component-vue WDrawer 之 state 語彙
//   J-init  初次載入完成(首次 idle)前為 moving, 首次 idle 後為 idle
//   J-move  自 maplibre 的 movestart 起為 moving(panTo/centerTo、easeTo、flyTo、jumpTo、zoomTo、縮放按鈕、拖曳、容器尺寸改變), 至 idle 止;
//           相機停止後仍等圖磚載入與繪製完成才轉 idle
//   J-idle  idle 時 map.isMoving() 為 false 且 map.loaded() 為 true, 畫面(中心、層級、投影)不再改變
//   J-wheel 靜止時收到滾輪事件即轉 moving(搶在 movestart 之前); 滾輪未引起移動(層級已達上限)則短時間內落定 idle
//   J-proj  投影切換(opt.projection 變更、自動投影於層級 8 切換)期間亦為 moving, 切換結束後才轉 idle
//   J-back  逾時後備: 相機停止 3000ms 後仍未收到 idle 事件(圖磚逾時未載完、繪製被暫停等)亦落定為 idle; 高負載下亦須落定
//   J-keep  只新增屬性, 不改變既有行為(R16 以既有 e2e 全套不變為證, 不在本檔)
//
// 真實 user path(6 步):
//   1. 開首頁(App.vue 範例選單)
//   2. 點 basic > moveState 子選單(真實點擊)
//   3. 看到地圖(7 級 globe, 單色離線圖磚)、頁面讀數 #rootState(根節點 state 即時值)
//   4. 真實點擊頁面按鈕(#btnPanTo 等)、縮放 +/- 按鈕(.clsZoomBtn)、滾輪(page.mouse.wheel)、拖曳(page.mouse.down/move/up)
//   5. 觀察根節點 state 屬性(頁內 MutationObserver 記錄每次變化 window.__stateLog, 屬觀察非 act)、maplibre 事件序列與逐影格位姿(頁內鉤子)
//   6. (補強)idle 後逐影格位姿不再改變、idle 當下 isMoving()=false / loaded()=true
//
// 按鈕全清單比對(範例頁): 子選單項、#btnPanTo(M2a)、#btnCenterTo(M2b)、#btnEaseTo(M2c)、#btnFlyTo(M2d)、#btnZoomTo(M2e)、#btnJumpTo(M2f)、
//   #btnLongEase(M14)、#btnApiMercator(M13)、#btnOptCenter(M12a)、#btnZoom7(前置/M8)、#btnZoom22(M4 前置、M12b)、#btnMercator(M5)、#btnGlobe(M5)、
//   #btnAuto(未獨立案例: 與 #btnMercator/#btnGlobe 同為 opt.projection 賦值, 路徑同 M5)、#btnTall(M6)、縮放 +/- 按鈕(M11)、滾輪(M3、M4)、拖曳(M10)。
//
// 觀察量以事件同步, 不以固定等待判定: 等「state 變化記錄出現 moving 後再出現 idle」、等「idle 後累計 N 影格」;
// 唯二用到時間量者: ①否定斷言「idle 事件被吞時, 逾時前不得落定」(M7, 以 moveend 起算之時間差, 下限為逾時常數本身), ②CPU 節流下仍落定(M8)之上限為防懸置。
//
// 圖磚: 範例頁以 maplibregl.addProtocol('e2ems') 供應單色圖磚, 永不連外。
// 標準圖政策: 依規則帳本〈e2e 映射〉無跨 run 標準圖(語意斷言)。無 i18n, 單一變體。每個 it() 各自 new browser。
import assert from 'assert'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'

const EPS = 1e-9
const IDLE_WAIT_MS = 3000 //= MOVE_IDLE_WAIT_MS(src/js/moveState.mjs); e2e 以頁面外觀察, 不 import src 以免與被測碼同源
const POSE_FRAMES = 40 //idle 後累計影格數(約 0.7s @60Hz)內位姿須不變

describe('e2e-movestate', function() {
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
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 } })
        page = await ctx.newPage()
        errs = []
        page.on('pageerror', (e) => errs.push(String(e.message)))
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
    })

    //首頁預設範例(size)載入遠端底圖, networkidle 取決於外網而可能逾時; 本檔只需 App 掛載完成(選單出現), 故用 domcontentloaded
    let gotoExample = async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
        await page.locator('.clsSubMenu-basic', { hasText: 'moveState' }).first().click()
        await waitUntilExist(page, '地圖就緒', () => {
            let m = window.__getMap && window.__getMap()
            return !!m && m.loaded() && !!document.querySelector('.maplibregl-canvas')
        })
        await waitIdle()
    }
    //等根節點 state 為 idle(涵蓋載入階段; 呼叫端不得拿它當「移動結束」之判定, 見 observe)
    let waitIdle = async () => {
        await waitUntilExist(page, '根節點 state=idle', () => window.__getRoot().getAttribute('state') === 'idle', { timeout: 20000 })
    }
    let getState = async () => await page.evaluate(() => window.__getRoot().getAttribute('state'))

    //觀察鉤子: 事件(maplibre movestart/moveend/idle/projectiontransition/load, DOM wheel〈capture, 先於元件〉)、逐影格位姿與 state、
    //標記時間 __mark(其後之 state 變化記錄才計入)
    let startTrace = async () => {
        await page.evaluate(() => {
            let m = window.__getMap()
            let root = window.__getRoot()
            if (window.__offs) window.__offs.forEach((f) => f())
            window.__offs = []
            window.__ev = []
            window.__frames = []
            let rec = (type, extra) => () => window.__ev.push({ t: performance.now(), type, moving: m.isMoving(), loaded: m.loaded(), stateDom: root.getAttribute('state'), z: m.getZoom(), proj: m.getProjection() ? m.getProjection().type : null, ...extra })
            for (let tp of ['movestart', 'moveend', 'idle', 'projectiontransition', 'zoomend']) {
                let h = rec(tp)
                m.on(tp, h)
                window.__offs.push(() => m.off(tp, h))
            }
            let hw = rec('wheel')
            document.addEventListener('wheel', hw, true)
            window.__offs.push(() => document.removeEventListener('wheel', hw, true))
            window.__rafOn = true
            let loop = () => {
                let c = m.getCenter()
                window.__frames.push({ t: performance.now(), state: root.getAttribute('state'), lat: c.lat, lng: c.lng, z: m.getZoom(), proj: m.getProjection() ? m.getProjection().type : null })
                if (window.__rafOn) requestAnimationFrame(loop)
            }
            requestAnimationFrame(loop)
            window.__mark = performance.now()
        })
    }
    //state 於標記後之變化序列
    let stateSeq = async () => await page.evaluate(() => window.__stateLog.filter((e) => e.t >= window.__mark))
    //等「標記後 state 出現 moving, 之後為 idle」(事件同步; 從未出現 moving 即逾時失敗, 訊息帶變化序列), 再等 idle 後累計 POSE_FRAMES 影格
    let settleTrace = async (label, timeout = 20000) => {
        try {
            await page.waitForFunction(() => {
                let l = window.__stateLog.filter((e) => e.t >= window.__mark)
                return l.length >= 2 && l[l.length - 1].state === 'idle'
            }, null, { timeout })
        }
        catch (err) {
            let seq = await stateSeq()
            throw new Error(`${label}: 標記後 state 未出現「moving → idle」, 變化序列=${JSON.stringify(seq.map((e) => e.state))}`)
        }
        let tIdle = await page.evaluate(() => window.__stateLog.filter((e) => e.t >= window.__mark).slice(-1)[0].t)
        await page.waitForFunction(({ t, n }) => window.__frames.filter((f) => f.t > t).length >= n, { t: tIdle, n: POSE_FRAMES }, { timeout: 15000 })
        return await page.evaluate(() => {
            window.__rafOn = false
            return { seq: window.__stateLog.filter((e) => e.t >= window.__mark), ev: window.__ev, frames: window.__frames }
        })
    }
    let seqNames = (d) => d.seq.map((e) => e.state)
    let poseEq = (a, b) => Math.abs(a.lat - b.lat) <= EPS && Math.abs(a.lng - b.lng) <= EPS && Math.abs(a.z - b.z) <= EPS && a.proj === b.proj
    //J-idle: 第一個 idle 記錄之後所有影格位姿與 state 皆定格(與最後一格相同), 且 idle 記錄當下 isMoving=false、loaded=true
    let assertIdleSettled = (d, label) => {
        let idleRec = d.seq[d.seq.length - 1]
        assert.strictEqual(idleRec.state, 'idle', `${label}: 最後一筆變化應為 idle`)
        assert.strictEqual(idleRec.moving, false, `${label} J-idle: 轉 idle 當下 map.isMoving() 應為 false`)
        assert.strictEqual(idleRec.loaded, true, `${label} J-idle: 轉 idle 當下 map.loaded() 應為 true`)
        let after = d.frames.filter((f) => f.t > idleRec.t)
        assert.ok(after.length >= POSE_FRAMES, `${label}: idle 後影格數 ${after.length}`)
        let last = after[after.length - 1]
        let drift = after.filter((f) => !poseEq(f, last))
        assert.strictEqual(drift.length, 0, `${label} J-idle: idle 後位姿不應再變動, 變動影格 ${drift.length}/${after.length}: ${JSON.stringify(drift.slice(0, 2))}`)
        assert.ok(after.every((f) => f.state === 'idle'), `${label} J-idle: idle 後 state 不應再回到 moving`)
        return last
    }
    //J-move: 變化記錄恰為 moving → idle(中途無 idle 閃爍); movestart 先於 moving 記錄; idle 事件先於 idle 記錄; moveend 先於 idle 事件
    //opt.wheel: 以滾輪觸發 — moving 記錄由滾輪事件搶先標記(J-wheel), 故晚於第一個 wheel 事件、早於 movestart; 其餘以 movestart 為起點
    let assertMoveSeq = (d, label, opt = {}) => {
        assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], `${label} J-move: state 變化應恰為 moving → idle(無中途 idle 閃爍)`)
        let ms = d.ev.filter((e) => e.type === 'movestart')
        let me = d.ev.filter((e) => e.type === 'moveend')
        let idles = d.ev.filter((e) => e.type === 'idle')
        assert.ok(ms.length >= 1 && me.length >= 1, `${label}: 前提 — 應有 movestart/moveend 事件 (${ms.length}/${me.length})`)
        assert.ok(idles.length >= 1, `${label}: 前提 — 應有 idle 事件`)
        let tMoving = d.seq[0].t
        let tIdle = d.seq[1].t
        if (opt.wheel) {
            let w0 = d.ev.find((e) => e.type === 'wheel')
            assert.ok(w0, `${label}: 前提 — 有 wheel 事件`)
            assert.ok(tMoving >= w0.t, `${label} J-wheel: moving 記錄不應早於第一個 wheel 事件`)
        }
        else {
            assert.ok(tMoving >= ms[0].t, `${label} J-move: moving 記錄不應早於 movestart`)
        }
        assert.ok(tIdle >= me[me.length - 1].t, `${label} J-move: idle 記錄不應早於最後一次 moveend(相機停止前不得為 idle)`)
        //落定以 idle 事件為主(同一次重繪內), 而非逾時後備: 最後一次 moveend 後第一個 idle 事件與 idle 記錄相隔應遠小於逾時常數
        let ei = idles.find((e) => e.t >= me[me.length - 1].t)
        assert.ok(ei && ei.t <= tIdle, `${label} J-move: idle 記錄須由 moveend 之後的 idle 事件導致(圖磚與繪製完成後才靜止)`)
        assert.ok(tIdle - ei.t <= 1000, `${label} J-move: idle 記錄應緊隨 idle 事件(實際相隔 ${Math.round(tIdle - ei.t)}ms; 久於此表示靠逾時後備而非事件)`)
        let movingFrames = d.frames.filter((f) => f.t >= tMoving && f.t < tIdle)
        assert.ok(movingFrames.every((f) => f.state === 'moving'), `${label}: moving 期間逐影格 state 應皆為 moving`)
        return { ms, me, idles }
    }

    it('E2E-M1 J-init 開啟頁面: state 自 moving 轉 idle(載入完成), 轉 idle 當下 loading 屬性已移除、map.loaded()=true', async function() {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
        await page.locator('.clsSubMenu-basic', { hasText: 'moveState' }).first().click()
        await waitUntilExist(page, '根節點', () => !!(window.__getRoot && window.__getRoot()))
        await waitIdle()
        let log = await page.evaluate(() => window.__stateLog)
        //J-attr/J-init: 掛載當下的初始值為 moving, 最終為 idle
        assert.strictEqual(log[0].state, 'moving', `初始值應為 moving: ${JSON.stringify(log.map((e) => e.state))}`)
        assert.strictEqual(log[0].loading, 'true', '載入階段 loading 屬性為 true')
        assert.strictEqual(log[log.length - 1].state, 'idle')
        //J-init: 首次 idle 之前一直是 moving(不得在載入完成前就是 idle)
        let firstIdle = log.findIndex((e) => e.state === 'idle')
        assert.ok(firstIdle > 0, `首次 idle 前應有 moving 記錄: ${JSON.stringify(log.map((e) => e.state))}`)
        assert.ok(log.slice(0, firstIdle).every((e) => e.state === 'moving'))
        let idleRec = log[firstIdle]
        assert.strictEqual(idleRec.loaded, true, '轉 idle 當下 map.loaded() 應為 true')
        assert.strictEqual(idleRec.moving, false)
        assert.strictEqual(idleRec.loading, null, '轉 idle 當下 loading 屬性已移除(與 state 同一次重繪)')
        //J-attr: 值域僅 moving/idle
        assert.ok(log.every((e) => e.state === 'moving' || e.state === 'idle'), JSON.stringify(log.map((e) => e.state)))
        assert.strictEqual(await page.locator('#rootState').innerText(), 'idle', '頁面讀數 #rootState 同步為 idle')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    //M2: 相機移動類 API 與按鈕(J-move/J-idle), 共用斷言
    let triggers = [
        { id: 'M2a', sel: '#btnPanTo', name: '元件方法 panTo(動畫平移)', animated: true },
        { id: 'M2b', sel: '#btnCenterTo', name: '元件方法 centerTo(動畫平移)', animated: true },
        { id: 'M2c', sel: '#btnEaseTo', name: 'API easeTo(動畫縮放)', animated: true },
        { id: 'M2d', sel: '#btnFlyTo', name: 'API flyTo(飛行動畫)', animated: true },
        { id: 'M2e', sel: '#btnZoomTo', name: 'API zoomTo(動畫縮放)', animated: true },
        { id: 'M2f', sel: '#btnJumpTo', name: 'API jumpTo(瞬移, 無動畫)', animated: false },
    ]
    for (let tr of triggers) {
        it(`E2E-${tr.id} J-move/J-idle ${tr.name}: 呼叫後轉 moving, 動畫與圖磚載入完成才 idle, idle 後位姿不再變動`, async function() {
            await gotoExample()
            assert.strictEqual(await getState(), 'idle', '前置: 載入完成後靜止')
            await startTrace()
            let pose0 = await page.evaluate(() => {
                let c = window.__getMap().getCenter()
                return { lat: c.lat, lng: c.lng, z: window.__getMap().getZoom() }
            })
            await page.locator(tr.sel).click()
            let d = await settleTrace(tr.name)
            let { me } = assertMoveSeq(d, tr.name)
            let fin = assertIdleSettled(d, tr.name)
            //前提: 位姿確實改變(否則觸發無效, 斷言無鑑別力)
            assert.ok(Math.abs(fin.lat - pose0.lat) > 1e-6 || Math.abs(fin.lng - pose0.lng) > 1e-6 || Math.abs(fin.z - pose0.z) > 1e-6, `${tr.name}: 前提 — 位姿應改變`)
            //J-move: 動畫類在 moving 期間位置逐影格在變(建議書〈現況〉: 過場期間位置仍在變, 故須有 moving 可偵測)
            if (tr.animated) {
                let movingFrames = d.frames.filter((f) => f.t >= d.seq[0].t && f.t < d.seq[1].t)
                let distinct = new Set(movingFrames.map((f) => `${f.lat.toFixed(6)},${f.lng.toFixed(6)},${f.z.toFixed(5)}`))
                assert.ok(distinct.size >= 5, `${tr.name}: moving 期間位姿應連續變動(動畫), 相異位姿數 ${distinct.size}`)
            }
            //前提: moveend 後 idle 記錄才出現(相機停止後仍 moving 一段 — 等圖磚與繪製)
            assert.ok(d.seq[1].t >= me[me.length - 1].t)
            assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
        })
    }

    it('E2E-M3 J-wheel/J-proj 滾輪自 7 級放大至 9 級(跨 8 級自動投影切換): 滾輪一到即 moving, 投影切換完成後才 idle', async function() {
        await gotoExample()
        assert.strictEqual(await getState(), 'idle')
        let z0 = await page.evaluate(() => window.__getMap().getZoom())
        let p0 = await page.evaluate(() => window.__getMap().getProjection().type)
        assert.ok(Math.abs(z0 - 7) < 0.3 && p0 === 'globe', `前置: 7 級 globe (${z0}, ${p0})`)
        await startTrace()
        //於 movestart 當下同步讀 DOM state: 滾輪搶先標記的話此時 DOM 已為 moving(無搶先標記則為 idle: 元件於 movestart 才改 data, DOM 於微任務後才更新)
        await page.evaluate(() => {
            let m = window.__getMap()
            let root = window.__getRoot()
            window.__domAtFirstMovestart = null
            let h = () => {
                if (window.__domAtFirstMovestart === null) window.__domAtFirstMovestart = root.getAttribute('state')
            }
            m.on('movestart', h)
            window.__offs.push(() => m.off('movestart', h))
        })
        let bb = await page.locator('.maplibregl-canvas').boundingBox()
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
        let n = 0
        for (; n < 60; n++) {
            let z = await page.evaluate(() => window.__getMap().getZoom())
            if (z >= 9) break
            await page.mouse.wheel(0, -120)
            await page.waitForTimeout(60) //事件間隔僅為模擬連續滾動, 非同步手段
        }
        assert.ok(n >= 3 && n < 60, `前提: 滾輪次數 ${n}`)
        let d = await settleTrace('滾輪 7→9')
        let { ms } = assertMoveSeq(d, '滾輪 7→9', { wheel: true })
        let fin = assertIdleSettled(d, '滾輪 7→9')
        //J-wheel: 第一個 wheel 事件之後、movestart 之前, state 已轉 moving
        let w0 = d.ev.find((e) => e.type === 'wheel')
        assert.ok(w0, '前提: 有 wheel 事件')
        assert.ok(ms[0].t > w0.t, '前提: movestart 晚於第一個 wheel(滾輪縮放有起始延遲)')
        assert.strictEqual(await page.evaluate(() => window.__domAtFirstMovestart), 'moving', 'J-wheel: 第一個 movestart 當下 DOM 之 state 已為 moving(滾輪搶先標記)')
        assert.ok(d.seq[0].t < ms[0].t + 50, `J-wheel: moving 記錄(${d.seq[0].t})應在 wheel 之後不久(movestart ${ms[0].t})`)
        assert.ok(d.seq[0].t > w0.t)
        //J-proj: 跨 8 級 → 發生 projectiontransition, 且早於 idle 記錄; idle 時已為 mercator、層級 ≥ 9, 其後投影與層級不再改變
        let pt = d.ev.filter((e) => e.type === 'projectiontransition')
        assert.ok(pt.length >= 1, `前提: 跨 8 級應發生投影切換 (${pt.length})`)
        assert.ok(pt.every((e) => e.t < d.seq[1].t), 'J-proj: 投影切換須早於 idle 記錄(切換結束後才靜止)')
        assert.strictEqual(fin.proj, 'mercator', 'J-proj: idle 時投影已切為 mercator')
        assert.ok(fin.z >= 9, `idle 時層級 ${fin.z}`)
        //J-proj: moving 期間不得有 idle 閃爍(已由 assertMoveSeq 斷言序列恰為 moving → idle)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-M4 J-wheel 滾輪於層級上限(不會移動): 滾輪一到即 moving, 短時間內落定 idle, 層級不變, 無 movestart', async function() {
        await gotoExample()
        await page.locator('#btnZoom22').click()
        await waitUntilExist(page, '到達 22 級', () => Math.abs(window.__getMap().getZoom() - 22) < 1e-6)
        await waitIdle()
        await startTrace()
        let bb = await page.locator('.maplibregl-canvas').boundingBox()
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
        await page.mouse.wheel(0, -120)
        let d = await settleTrace('上限滾輪')
        assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], 'J-wheel: state 變化應恰為 moving → idle')
        assert.strictEqual(d.ev.filter((e) => e.type === 'movestart').length, 0, '前提: 上限滾輪不引起移動(無 movestart)')
        assert.ok(d.ev.some((e) => e.type === 'wheel'))
        assert.ok(Math.abs(d.frames[d.frames.length - 1].z - 22) < EPS, '層級維持 22')
        let w = d.ev.find((e) => e.type === 'wheel')
        let dt = d.seq[1].t - w.t
        assert.ok(dt < 3000, `J-wheel: 滾輪未引起移動應在遠小於 ${IDLE_WAIT_MS}ms 內落定, 實際 ${Math.round(dt)}ms`)
        assertIdleSettled(d, '上限滾輪')
    })

    it('E2E-M5 J-proj 投影切換(無相機移動): opt.projection 變更期間為 moving, 切換完成(重繪與圖磚重載)後才 idle', async function() {
        await gotoExample()
        for (let [sel, to] of [['#btnMercator', 'mercator'], ['#btnGlobe', 'globe']]) {
            await startTrace()
            await page.locator(sel).click()
            let d = await settleTrace(`投影→${to}`)
            assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], `投影→${to} J-proj: state 變化應恰為 moving → idle`)
            let pt = d.ev.filter((e) => e.type === 'projectiontransition')
            assert.ok(pt.length >= 1, `前提: 應發生 projectiontransition (${pt.length})`)
            assert.strictEqual(d.ev.filter((e) => e.type === 'movestart').length, 0, '前提: 投影切換不經 movestart(否則無法鑑別 J-proj)')
            assert.ok(d.seq[0].t <= pt[0].t + 50 && d.seq[0].t >= d.ev[0].t - 1000)
            assert.ok(pt.every((e) => e.t < d.seq[1].t), 'J-proj: 投影切換須早於 idle 記錄')
            let idles = d.ev.filter((e) => e.type === 'idle' && e.t >= pt[0].t)
            assert.ok(idles.length >= 1, '前提: 切換後有 idle 事件')
            let fin = assertIdleSettled(d, `投影→${to}`)
            assert.strictEqual(fin.proj, to)
        }
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-M6 J-move 容器尺寸改變(resize): moving → idle, idle 後位姿不再變動', async function() {
        await gotoExample()
        await startTrace()
        await page.locator('#btnTall').click()
        let d = await settleTrace('resize')
        assertMoveSeq(d, 'resize')
        assertIdleSettled(d, 'resize')
    })

    it('E2E-M7 J-back 逾時後備: idle 事件未觸發時, 相機停止 3000ms 後仍落定 idle(逾時前不得落定)', async function() {
        await gotoExample()
        //吞掉 idle 事件的派發(模擬高負載/圖磚逾時未載完: 事件不到); 驗證前提: 掛在 map 上的 idle 監聽收到 0 次
        await page.evaluate(() => {
            let m = window.__getMap()
            let f0 = m.fire
            window.__swallowed = 0
            m.fire = function(ev, d) {
                let type = typeof ev === 'string' ? ev : ev && ev.type
                if (type === 'idle') {
                    window.__swallowed++
                    return this
                }
                return f0.call(this, ev, d)
            }
        })
        await startTrace()
        await page.locator('#btnPanTo').click()
        let d = await settleTrace('idle 事件被吞', 30000)
        assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], 'J-back: state 變化應恰為 moving → idle')
        assert.strictEqual(d.ev.filter((e) => e.type === 'idle').length, 0, '前提: idle 事件已被吞(監聽器 0 次)')
        assert.ok(await page.evaluate(() => window.__swallowed) >= 1, '前提: 確有 idle 事件被攔截')
        let me = d.ev.filter((e) => e.type === 'moveend')
        assert.ok(me.length >= 1)
        let dt = d.seq[1].t - me[me.length - 1].t
        //J-back: 逾時前不得落定(下限為逾時常數, 容 setTimeout 精度 50ms); 上限僅防懸置
        assert.ok(dt >= IDLE_WAIT_MS - 50, `J-back: 落定不得早於 moveend 後 ${IDLE_WAIT_MS}ms(實際 ${Math.round(dt)}ms, 否則是提早設終態)`)
        assert.ok(dt < IDLE_WAIT_MS + 5000, `J-back: 落定應在逾時後不久(實際 ${Math.round(dt)}ms)`)
        assert.strictEqual(d.seq[1].moving, false)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-M8 J-back 高負載(CPU 節流 6x): 平移與滾輪縮放後仍落定 idle, 且 idle 後位姿不再變動', async function() {
        await gotoExample()
        let cdp = await page.context().newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
        try {
            await startTrace()
            await page.locator('#btnPanTo').click()
            let d = await settleTrace('高負載 panTo', 60000)
            assertMoveSeq(d, '高負載 panTo')
            assertIdleSettled(d, '高負載 panTo')
            //滾輪(跨 8 級)
            await page.locator('#btnZoom7').click()
            await waitUntilExist(page, '回 7 級', () => Math.abs(window.__getMap().getZoom() - 7) < 1e-6, { timeout: 60000 })
            await waitIdle()
            await startTrace()
            let bb = await page.locator('.maplibregl-canvas').boundingBox()
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
            for (let i = 0; i < 14; i++) {
                await page.mouse.wheel(0, -120)
                await page.waitForTimeout(60)
            }
            let d2 = await settleTrace('高負載 滾輪', 60000)
            assertMoveSeq(d2, '高負載 滾輪', { wheel: true })
            let fin = assertIdleSettled(d2, '高負載 滾輪')
            assert.ok(fin.z > 7)
        }
        finally {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        }
    })

    it('E2E-M9 J-move 移動中再觸發(panTo 後立即 flyTo): state 全程 moving 無 idle 閃爍, 終點 idle', async function() {
        await gotoExample()
        await startTrace()
        await page.evaluate(() => {
            document.getElementById('btnPanTo').click()
            setTimeout(() => document.getElementById('btnFlyTo').click(), 150) //於平移動畫中途(約 500ms)再觸發飛行
        })
        let d = await settleTrace('連續觸發', 30000)
        assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], 'J-move: 移動中再觸發, state 變化應恰為 moving → idle')
        assert.ok(d.ev.filter((e) => e.type === 'movestart').length >= 2, '前提: 兩次移動皆有 movestart')
        assertIdleSettled(d, '連續觸發')
        let fin = d.frames[d.frames.length - 1]
        assert.ok(Math.abs(fin.z - 9) < 0.01, `終點應為 flyTo 目標層級 9, 實際 ${fin.z}`)
    })

    it('E2E-M10 J-move 使用者拖曳平移(真滑鼠): 拖曳中 moving, 放開並慣性/圖磚完成後 idle, idle 後位姿不再變動', async function() {
        await gotoExample()
        await startTrace()
        let bb = await page.locator('.maplibregl-canvas').boundingBox()
        let cx = bb.x + bb.width / 2
        let cy = bb.y + bb.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 120, cy + 40, { steps: 12 })
        //拖曳中(尚未放開): 已為 moving
        await waitUntilExist(page, '拖曳中 state=moving', () => window.__getRoot().getAttribute('state') === 'moving')
        assert.strictEqual(await page.evaluate(() => window.__getMap().isMoving()), true, '前提: 拖曳中 map.isMoving()=true')
        await page.mouse.up()
        let d = await settleTrace('拖曳')
        assertMoveSeq(d, '拖曳')
        assertIdleSettled(d, '拖曳')
    })

    it('E2E-M11 J-move 縮放 +/- 按鈕(真點擊): moving → idle, idle 後層級不再變動', async function() {
        await gotoExample()
        for (let i of [0, 1]) {
            await startTrace()
            await page.locator('.clsZoomBtn').nth(i).click()
            let d = await settleTrace(`縮放鈕${i}`)
            assertMoveSeq(d, `縮放鈕${i}`)
            assertIdleSettled(d, `縮放鈕${i}`)
        }
    })

    it('E2E-M12a J-move opt.center 賦值(changeOpt → panTo 動畫): moving → idle, idle 後位姿不再變動', async function() {
        await gotoExample()
        await startTrace()
        await page.locator('#btnOptCenter').click()
        let d = await settleTrace('opt.center')
        assertMoveSeq(d, 'opt.center')
        let fin = assertIdleSettled(d, 'opt.center')
        assert.ok(Math.abs(fin.lat - 23.5) < 0.01 && Math.abs(fin.lng - 120.9) < 0.01, `前提: 中心應移至 opt.center, 實際 ${fin.lat},${fin.lng}`)
    })

    it('E2E-M12b J-move/J-proj opt.zoom 賦值 7→22(changeOpt → setZoom, 跨 8 級自動投影): moving → idle, idle 時已為 mercator 且層級 22', async function() {
        await gotoExample()
        await startTrace()
        await page.locator('#btnZoom22').click()
        let d = await settleTrace('opt.zoom')
        assertMoveSeq(d, 'opt.zoom')
        let fin = assertIdleSettled(d, 'opt.zoom')
        let pt = d.ev.filter((e) => e.type === 'projectiontransition')
        assert.ok(pt.length >= 1 && pt.every((e) => e.t < d.seq[1].t), 'J-proj: 跨 8 級之投影切換須早於 idle 記錄')
        assert.strictEqual(fin.proj, 'mercator')
        assert.ok(Math.abs(fin.z - 22) < EPS, `層級應為 22, 實際 ${fin.z}`)
    })

    it('E2E-M13 J-proj 使用端經 getMapObject().setProjection 切換(不經 opt.projection、無相機移動): moving → idle', async function() {
        await gotoExample()
        await startTrace()
        await page.locator('#btnApiMercator').click()
        let d = await settleTrace('API setProjection')
        assert.deepStrictEqual(seqNames(d), ['moving', 'idle'], 'J-proj: state 變化應恰為 moving → idle')
        let pt = d.ev.filter((e) => e.type === 'projectiontransition')
        assert.ok(pt.length >= 1, '前提: 應發生 projectiontransition')
        assert.strictEqual(d.ev.filter((e) => e.type === 'movestart').length, 0, '前提: 不經 movestart(否則無法鑑別 J-proj)')
        assert.ok(pt.every((e) => e.t < d.seq[1].t), 'J-proj: 投影切換須早於 idle 記錄')
        let fin = assertIdleSettled(d, 'API setProjection')
        assert.strictEqual(fin.proj, 'mercator')
    })

    it('E2E-M14 J-back 長動畫(easeTo 5s 長於逾時後備 3s): 逾時當下仍在移動不得落定, state 全程 moving, 動畫結束後才 idle', async function() {
        await gotoExample()
        await startTrace()
        await page.locator('#btnLongEase').click()
        let d = await settleTrace('長動畫', 40000)
        let { ms, me } = assertMoveSeq(d, '長動畫')
        //前提: 移動時間確實長於逾時常數(否則無法鑑別「逾時當下仍在移動則續等」)
        let span = me[me.length - 1].t - ms[0].t
        assert.ok(span > IDLE_WAIT_MS + 1000, `前提: 動畫時間 ${Math.round(span)}ms 應長於逾時常數 ${IDLE_WAIT_MS}ms`)
        //J-back: idle 記錄不早於 moveend(逾時當下仍在移動者不得落定; assertMoveSeq 亦斷言), 此處再明示與 movestart 之相隔大於動畫時間
        assert.ok(d.seq[1].t - ms[0].t > span, 'idle 應在動畫結束之後')
        assertIdleSettled(d, '長動畫')
    })

})
