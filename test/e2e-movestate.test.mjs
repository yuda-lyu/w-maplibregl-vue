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
//   J-resize 一次容器尺寸改變只發一組 movestart/resize/moveend(尺寸追蹤單一來源: maplibre 內建 trackResize, 元件不另行偵測尺寸; R16-6), 故 state 恰一組 moving → idle
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
//   #btnAuto(未獨立案例: 與 #btnMercator/#btnGlobe 同為 opt.projection 賦值, 路徑同 M5)、#btnTall(M6、M6b、M6c)、縮放 +/- 按鈕(M11)、滾輪(M3、M4)、拖曳(M10)。
//
// 觀察量以事件同步, 不以固定等待判定: 等「state 變化記錄出現 moving 後再出現 idle」、等「idle 後累計 N 影格」;
// 唯二用到時間量者: ①否定斷言「idle 事件被吞時, 逾時前不得落定」(M7, 以 moveend 起算之時間差, 下限為逾時常數本身), ②CPU 節流下仍落定(M8)之上限為防懸置。
// 滾輪手勢(M8 滾輪段、M8b): 連續滾輪不保證為同一手勢(頁面端間隔受負載影響), 依「手勢中地圖是否發過 idle 事件」決定確定期望(assertWheelSeq; 排程第 329 項);
//   M8b 以事件同步之停頓(等 state=idle)確定性重現中途真停, M8c(注入 idle 事件)、M8d(停頓中未經滾輪之 easeTo)證明該斷言對「中途錯誤 idle」「無輸入之 moving」判紅。
//
// 圖磚: 範例頁以 maplibregl.addProtocol('e2ems') 供應單色圖磚, 永不連外。
// 標準圖政策: 依規則帳本〈e2e 映射〉無跨 run 標準圖(語意斷言)。無 i18n, 單一變體。每個 it() 各自 new browser。
import assert from 'assert'
import launchE2eBrowser from './tools/e2eLaunch.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'
import { routeCdnLocal } from './tools/e2eCdnLocal.mjs'

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
        browser = await launchE2eBrowser({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 } })
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
    //opt.afterLastWheel: 最後一筆 idle 記錄須晚於最後一個 wheel 事件(滾輪手勢可能中途真停而先有中途 idle, 見 assertWheelSeq; 中途 idle 不是終點)
    let settleTrace = async (label, timeout = 20000, opt = {}) => {
        try {
            await page.waitForFunction((afterLastWheel) => {
                let l = window.__stateLog.filter((e) => e.t >= window.__mark)
                if (!(l.length >= 2 && l[l.length - 1].state === 'idle')) return false
                if (!afterLastWheel) return true
                let wh = window.__ev.filter((e) => e.type === 'wheel')
                return wh.length > 0 && l[l.length - 1].t > wh[wh.length - 1].t
            }, !!opt.afterLastWheel, { timeout })
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

    //J-wheel/J-idle 滾輪手勢之確定期望(排程第 329 項, 2026-11-07 mv329b; 規則帳本 R16〈測試〉M8):
    //  連續滾輪(每次後 waitForTimeout(60))不保證為同一手勢——頁面端實收間隔受負載影響(CPU 節流 6x 實測 116~361ms),
    //  相鄰兩次滾輪之間隔超過「滾輪至 idle」(實測 584~1601ms)時地圖真的停下並發 idle, 依 J-idle 須為 idle, 下一次滾輪依 J-wheel 再轉 moving
    //  (2026-11-02 全庫跟跑之 E2E-M8 紅即此形狀)。故依可觀察條件——手勢中(第一個與最後一個 wheel 事件之間)地圖是否發過 idle 事件——決定期望, 兩者皆確定:
    //    未發過 → 恰 moving → idle(assertMoveSeq, 同前)
    //    發過   → moving/idle 交替且以 idle 結束; 第一筆 moving 不早於第一個 wheel; 每段 moving 期間逐影格 state 皆 moving; 每筆 idle 記錄:
    //             本段 moving 之後有 moveend 及其後之 idle 事件(相機已停、圖磚與繪製完成)且 idle 記錄緊隨該事件(<= 1000ms)、記錄當下 isMoving()=false、loaded()=true;
    //             中途 idle 記錄至下一筆 moving 記錄之間: 須有晚於該 idle 之 wheel(J-wheel; 無輸入之 moving 不接受)、無 movestart、逐影格位姿不變且 state 皆 idle
    //  中途錯誤 idle(地圖仍在移動)與無輸入之 moving 皆判紅(E2E-M8c、M8d 以注入證明); 最終落定與 idle 後位姿不變另由 assertIdleSettled 斷言
    let assertWheelSeq = (d, label) => {
        let wh = d.ev.filter((e) => e.type === 'wheel')
        assert.ok(wh.length >= 1, `${label}: 前提 — 有 wheel 事件`)
        let w0 = wh[0]
        let wN = wh[wh.length - 1]
        let midIdle = d.ev.filter((e) => e.type === 'idle' && e.t > w0.t && e.t < wN.t)
        if (midIdle.length === 0) return { mid: 0, ...assertMoveSeq(d, label, { wheel: true }) }
        let names = seqNames(d)
        let alt = names.length >= 4 && names.length % 2 === 0 && names.every((s, i) => s === (i % 2 === 0 ? 'moving' : 'idle'))
        assert.ok(alt, `${label} J-wheel/J-idle: 手勢中地圖發過 idle(${midIdle.length} 次), state 變化應為 moving/idle 交替並以 idle 結束, 實際 ${JSON.stringify(names)}`)
        assert.ok(d.seq[0].t >= w0.t, `${label} J-wheel: 第一筆 moving 記錄不應早於第一個 wheel 事件`)
        for (let i = 1; i < d.seq.length; i += 2) {
            let rm0 = d.seq[i - 1] //本段 moving 記錄
            let ri = d.seq[i] //本段 idle 記錄
            let mf = d.frames.filter((f) => f.t >= rm0.t && f.t < ri.t)
            assert.ok(mf.every((f) => f.state === 'moving'), `${label}: seq[${i - 1}] 至 seq[${i}] 之 moving 期間逐影格 state 應皆為 moving`)
            let me = d.ev.filter((e) => e.type === 'moveend' && e.t > rm0.t && e.t <= ri.t)
            assert.ok(me.length >= 1, `${label} J-idle: seq[${i}] 之 idle 記錄之前(本段 moving 之後)應有 moveend(相機已停), 實際無`)
            let tMe = me[me.length - 1].t
            let ei = d.ev.find((e) => e.type === 'idle' && e.t >= tMe && e.t <= ri.t)
            assert.ok(ei, `${label} J-idle: seq[${i}] 之 idle 記錄須由 moveend 之後之 idle 事件導致(圖磚與繪製完成後才靜止)`)
            assert.ok(ri.t - ei.t <= 1000, `${label} J-idle: seq[${i}] 之 idle 記錄應緊隨 idle 事件(實際相隔 ${Math.round(ri.t - ei.t)}ms)`)
            assert.strictEqual(ri.moving, false, `${label} J-idle: seq[${i}] 轉 idle 當下 map.isMoving() 應為 false`)
            assert.strictEqual(ri.loaded, true, `${label} J-idle: seq[${i}] 轉 idle 當下 map.loaded() 應為 true`)
            if (i === d.seq.length - 1) break
            let rm = d.seq[i + 1] //下一段 moving 記錄
            let wTrig = wh.find((w) => w.t > ri.t && w.t <= rm.t)
            assert.ok(wTrig, `${label} J-wheel: seq[${i + 1}] 之 moving 記錄應由晚於 seq[${i}] 之 idle 記錄之 wheel 引起(無輸入之 moving 不接受), idle 於 ${Math.round(ri.t)}ms、moving 於 ${Math.round(rm.t)}ms, 其間 wheel 0 個`)
            let ms = d.ev.filter((e) => e.type === 'movestart' && e.t > ri.t && e.t < rm.t)
            assert.strictEqual(ms.length, 0, `${label} J-idle: seq[${i}] 至 seq[${i + 1}] 之 idle 期間不應有 movestart(地圖於 state=idle 時開始移動), 實際 ${ms.length}`)
            let fr = d.frames.filter((f) => f.t > ri.t && f.t < rm.t)
            let drift = fr.filter((f) => !poseEq(f, fr[0]) || f.state !== 'idle')
            assert.strictEqual(drift.length, 0, `${label} J-idle: seq[${i}] 至 seq[${i + 1}] 之 idle 期間位姿不應變動且 state 皆 idle, 不符影格 ${drift.length}/${fr.length}`)
        }
        return { mid: midIdle.length }
    }

    //滾輪手勢(E2E-M8b/M8c/M8d 共用; 前置由呼叫端完成: 7 級 globe 靜止): 畫布中心 deltaY -120 × 14, 每次後 waitForTimeout(60)(僅模擬連續滾動之間隔, 非同步手段)
    //  opt.throttle: CDP CPU 節流倍率; opt.pauseAt: 第 n 次滾輪前以事件同步停頓——等根節點 state=idle(地圖已真停), 不以固定時間; opt.inPause: 停頓中執行(注入用);
    //  opt.beforeWheel(i): 第 i 次滾輪前執行(注入用)。回傳 settleTrace 之結果(最後一筆 idle 晚於最後一個 wheel)
    let runWheelGesture = async (label, opt = {}) => {
        let cdp = null
        if (opt.throttle) {
            cdp = await page.context().newCDPSession(page)
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: opt.throttle })
        }
        try {
            await startTrace()
            let bb = await page.locator('.maplibregl-canvas').boundingBox()
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
            for (let i = 0; i < 14; i++) {
                if (i === opt.pauseAt) {
                    await waitUntilExist(page, `${label}: 中途 state=idle(地圖真停)`, () => window.__getRoot().getAttribute('state') === 'idle', { timeout: 60000 })
                    if (opt.inPause) await opt.inPause()
                }
                if (opt.beforeWheel) await opt.beforeWheel(i)
                await page.mouse.wheel(0, -120)
                await page.waitForTimeout(60)
            }
            return await settleTrace(label, 60000, { afterLastWheel: true })
        }
        finally {
            if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        }
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

    //M6/M6b/M6c 共用: 容器高 500 → 400(#btnTall), 斷言
    //  J-resize: 一次容器尺寸改變只發一組 movestart/resize/moveend(尺寸追蹤單一來源: maplibre 內建 trackResize, 規則帳本 R16-6)
    //    — 同一次尺寸改變若有第二個來源呼叫 map.resize(), 第二組晚於繪製時 idle 事件會夾在兩組之間, state 變成 moving → idle → moving → idle;
    //    該序列的出現與否取決於兩個來源之相對時序(負載越高越常見), 故以事件組數(與時序無關)斷言單一來源
    //  J-move: 依 maplibre 之 resize 為 ResizeObserver 回呼內「同步 resize() 加同步 redraw()」, idle 可能於同一 JS task 內即發出(redraw 內之 _render 末段),
    //    此時 moving → idle 兩次寫入 data.state 皆在 Vue 非同步更新(微任務)之前, Vue 合併為不變, 根節點 state 屬性不曾顯示 moving(map 已靜止, 屬性維持 idle 即為真);
    //    idle 於其後之影格才發出時, 屬性須顯示 moving 後轉 idle。兩種情形由「movestart 後是否已過微任務檢查點」判定, 各自之期望序列是確定的, 不接受其他序列:
    //      已過檢查點 → 變化序列恰為 moving → idle(assertMoveSeq/assertIdleSettled, 與其他觸發同一組斷言), 且 idle 事件當下屬性已為 moving
    //      未過檢查點 → 變化序列為空(屬性不曾改變), idle 事件當下 isMoving()=false、loaded()=true, 其後位姿與屬性不再變動
    //  前提: 畫布確實隨之改變(預設:容器縮小, 畫布 CSS 高 500 → 400; opt.before/opt.after 可改), 否則「只發一組」可能只是因為根本沒有 resize
    //  以事件同步: 等 moveend 之後之 idle 事件, 再累計 POSE_FRAMES 影格
    //  opt.act: 觸發尺寸改變之動作(預設點 #btnTall); opt.before/opt.after: 動作前後畫布(canvas.width/height 為畫布像素, clientWidth/clientHeight 為 CSS 尺寸)應有之值
    let runResizeCase = async (label, opt = {}) => {
        let act = opt.act || (async () => await page.locator('#btnTall').click())
        let before = opt.before || { ch: 500 }
        let after = opt.after || { ch: 400 }
        let readCanvas = async () => await page.evaluate(() => {
            let c = window.__getMap().getCanvas()
            return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }
        })
        await startTrace()
        let c0 = await readCanvas()
        await page.evaluate(() => {
            let m = window.__getMap()
            let root = window.__getRoot()
            window.__rs = []
            window.__idleInfo = []
            let mc = { ran: true } //movestart 之後是否已過微任務檢查點(Vue 之 nextTick 排在本微任務之前, 故 ran 為真時 Vue 已更新過 DOM)
            //元件 data.state 於追蹤器回呼內同步寫入(早於 Vue 之 DOM 更新, 不受批次合併影響): 本鉤子註冊晚於追蹤器, 故各事件當下讀到的是該事件處理後之值
            let vm = root.__vue__
            window.__dataAt = []
            let hRs = () => window.__rs.push(performance.now())
            let hMs = () => {
                mc.ran = false
                queueMicrotask(() => {
                    mc.ran = true
                })
                window.__dataAt.push({ type: 'movestart', data: vm.state })
            }
            let hMe = () => window.__dataAt.push({ type: 'moveend', data: vm.state })
            let hIdle = () => {
                window.__idleInfo.push({ t: performance.now(), ran: mc.ran, dom: root.getAttribute('state') })
                window.__dataAt.push({ type: 'idle', data: vm.state })
            }
            m.on('resize', hRs); m.on('movestart', hMs); m.on('moveend', hMe); m.on('idle', hIdle)
            window.__offs.push(() => {
                m.off('resize', hRs)
                m.off('movestart', hMs)
                m.off('moveend', hMe)
                m.off('idle', hIdle)
            })
        })
        await act()
        try {
            await page.waitForFunction(() => {
                let me = window.__ev.filter((e) => e.type === 'moveend')
                return me.length >= 1 && window.__ev.some((e) => e.type === 'idle' && e.t >= me[me.length - 1].t)
            }, null, { timeout: 20000 })
        }
        catch (err) {
            throw new Error(`${label}: 20s 內未見 moveend 後之 idle 事件, 事件=${JSON.stringify(await page.evaluate(() => window.__ev.map((e) => e.type)))}, state 變化=${JSON.stringify((await stateSeq()).map((e) => e.state))}`)
        }
        let tIdle = await page.evaluate(() => {
            let me = window.__ev.filter((e) => e.type === 'moveend')
            return window.__ev.find((e) => e.type === 'idle' && e.t >= me[me.length - 1].t).t
        })
        await page.waitForFunction(({ t, n }) => window.__frames.filter((f) => f.t > t).length >= n, { t: tIdle, n: POSE_FRAMES }, { timeout: 15000 })
        let d = await page.evaluate(() => {
            window.__rafOn = false
            return { seq: window.__stateLog.filter((e) => e.t >= window.__mark), ev: window.__ev, frames: window.__frames, rs: window.__rs, idleInfo: window.__idleInfo, dataAt: window.__dataAt }
        })
        let c1 = await readCanvas()
        for (let k of Object.keys(before)) assert.strictEqual(c0[k], before[k], `${label}: 前提 — 動作前畫布 ${k} 應為 ${before[k]}, 實際 ${JSON.stringify(c0)}`)
        for (let k of Object.keys(after)) assert.strictEqual(c1[k], after[k], `${label}: 前提 — 動作後畫布 ${k} 應為 ${after[k]}, 實際 ${JSON.stringify(c1)}`)
        //J-resize
        assert.strictEqual(d.rs.length, 1, `${label} J-resize: 一次尺寸改變應只發 1 次 resize 事件, 實際 ${d.rs.length}`)
        assert.strictEqual(d.ev.filter((e) => e.type === 'movestart').length, 1, `${label} J-resize: 應只發 1 次 movestart`)
        assert.strictEqual(d.ev.filter((e) => e.type === 'moveend').length, 1, `${label} J-resize: 應只發 1 次 moveend`)
        //J-move(追蹤器逐事件, 與 DOM 之批次合併無關): movestart、moveend 處理後 data.state 皆為 moving, idle 處理後為 idle
        //  — 同 task 時序下 DOM 屬性不可觀察, 此組斷言使追蹤器之錯誤(movestart 不轉 moving、moveend 即轉 idle)在兩種時序下皆被抓到
        assert.deepStrictEqual(d.dataAt.map((x) => `${x.type}:${x.data}`).slice(0, 3), ['movestart:moving', 'moveend:moving', 'idle:idle'], `${label} J-move: 追蹤器於 movestart/moveend/idle 事件處理後之 data.state, 實際 ${JSON.stringify(d.dataAt)}`)
        //J-move / J-idle
        let tEnd = d.ev.find((e) => e.type === 'moveend').t
        let ei = d.idleInfo.find((x) => x.t >= tEnd) //moveend 之後第一個 idle 事件
        assert.ok(ei, `${label}: 前提 — moveend 之後有 idle 事件`)
        console.log(`    [${label}] idle 時序: ${ei.ran ? '其後之 task(屬性經 moving → idle)' : '與 movestart 同一 task(屬性不變)'}`)
        if (ei.ran) {
            assert.strictEqual(ei.dom, 'moving', `${label} J-move: idle 於其後之 task 才發出, 事件當下根節點 state 屬性應已為 moving, 實際 ${ei.dom}`)
            assertMoveSeq(d, label)
            assertIdleSettled(d, label)
        }
        else {
            assert.strictEqual(ei.dom, 'idle', `${label} J-move: movestart 與 idle 同一 task, 屬性不曾改變而維持 idle, 實際 ${ei.dom}`)
            assert.deepStrictEqual(seqNames(d), [], `${label} J-move: movestart 與 idle 同一 task 時屬性不應有任何變化(不得出現 moving 殘留或中途 idle 閃爍), 實際 ${JSON.stringify(seqNames(d))}`)
            let evIdle = d.ev.find((e) => e.type === 'idle' && e.t >= tEnd)
            assert.strictEqual(evIdle.moving, false, `${label} J-idle: idle 當下 map.isMoving() 應為 false`)
            assert.strictEqual(evIdle.loaded, true, `${label} J-idle: idle 當下 map.loaded() 應為 true`)
            let after = d.frames.filter((f) => f.t > ei.t)
            assert.ok(after.length >= POSE_FRAMES, `${label}: idle 後影格數 ${after.length}`)
            let last = after[after.length - 1]
            assert.strictEqual(after.filter((f) => !poseEq(f, last)).length, 0, `${label} J-idle: idle 後位姿不應再變動`)
            assert.ok(after.every((f) => f.state === 'idle'), `${label} J-idle: idle 後 state 不應為 moving`)
        }
        assert.strictEqual(await getState(), 'idle', `${label}: 最終 state 應為 idle`)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    }

    it('E2E-M6 J-move/J-resize 容器尺寸改變(resize): moving → idle, idle 後位姿不再變動, 一次尺寸改變只發一組 movestart/resize/moveend', async function() {
        await gotoExample()
        await runResizeCase('resize')
    })

    it('E2E-M6c J-move/J-resize 容器尺寸改變(resize)於高負載(CPU 節流 6x): 無論 idle 與 movestart 是否同一 task, 序列皆符合期望且只發一組', async function() {
        await gotoExample()
        let cdp = await page.context().newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
        try {
            await runResizeCase('resize(CPU 節流 6x)')
        }
        finally {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        }
    })

    it('E2E-M6b J-move/J-resize 容器尺寸改變(resize)且短計時器(<=5ms)被延後 150ms(模擬高負載下計時器晚於繪製): 仍只發一組, 序列符合期望', async function() {
        await gotoExample()
        //時序注入(控制 resize 時序, 非真實負載): 其後建立之 <=5ms 計時器延後 150ms, 使任何「以計時器延後呼叫 map.resize()」之第二來源必晚於第一組繪製與 idle;
        //  maplibre 內建 trackResize 為 ResizeObserver 回呼內即時呼叫(節流器之 50ms 計時器不受影響), 不經 <=5ms 計時器
        await page.evaluate((ms) => {
            let st = window.setTimeout
            window.setTimeout = function(fn, d, ...a) {
                return st.call(window, fn, (d || 0) <= 5 ? (d || 0) + ms : d, ...a)
            }
        }, 150)
        await runResizeCase('resize(計時器延後)')
    })

    it('E2E-M6d J-resize 瀏覽器縮放(devicePixelRatio 1 → 1.25, 固定像素容器之 CSS 尺寸不變): 畫布解析度隨之重算, 只發一組 movestart/resize/moveend, 序列符合期望', async function() {
        await gotoExample()
        //CDP 模擬縮放 125%: 視窗 CSS 尺寸 1000x1100 → 800x880、devicePixelRatio 1 → 1.25; 容器為固定 800x500px, CSS 尺寸不變, ResizeObserver 不觸發,
        //  maplibre 6.14.0 亦無 devicePixelRatio 監聽, 須由元件於視窗 resize 事件補一次 map.resize()(R16-6; 否則畫布停在 800x500 像素, 於 1.25 倍下被放大而模糊)
        let cdp = await page.context().newCDPSession(page)
        await runResizeCase('瀏覽器縮放(DPR 1 → 1.25)', {
            act: async () => await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 880, deviceScaleFactor: 1.25, mobile: false }),
            before: { w: 800, h: 500, cw: 800, ch: 500 },
            after: { w: 1000, h: 625, cw: 800, ch: 500 },
        })
        //devicePixelRatio 已無變化時視窗再 resize(1.25 不變、視窗寬 800 → 790): 不應再呼叫 map.resize()(以事件同步: 等視窗 resize 事件處理完, 元件之處理器先於本監聽器執行)
        await page.evaluate(() => {
            window.__nWin = 0
            window.addEventListener('resize', () => {
                window.__nWin++
            })
        })
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 790, height: 880, deviceScaleFactor: 1.25, mobile: false })
        await page.waitForFunction(() => window.__nWin >= 1, null, { timeout: 10000 })
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
        let nResize = await page.evaluate(() => window.__rs.length)
        assert.strictEqual(nResize, 1, `devicePixelRatio 無變化之視窗 resize 不應再觸發 map.resize(), map resize 事件累計 ${nResize}`)
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
            let d2 = await settleTrace('高負載 滾輪', 60000, { afterLastWheel: true })
            //14 次滾輪是否為同一手勢由負載決定(頁面端間隔), 依手勢中地圖是否發過 idle 決定確定期望(assertWheelSeq; 2026-11-02 之紅即中途真停)
            let rw = assertWheelSeq(d2, '高負載 滾輪')
            console.log(`    [高負載 滾輪] 手勢中地圖發 idle ${rw.mid} 次(${rw.mid ? '中途真停, 逐段判定' : '同一手勢, 恰 moving → idle'}), 變化序列=${JSON.stringify(seqNames(d2))}`)
            let fin = assertIdleSettled(d2, '高負載 滾輪')
            assert.ok(fin.z > 7)
        }
        finally {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        }
    })

    it('E2E-M8b J-wheel/J-idle 滾輪手勢中途停頓至地圖真停(CPU 節流 6x, 第 7、8 次滾輪間等 state=idle): 停頓處確有 idle, 序列至少 moving → idle → moving → idle 且逐段為真, 其後 moving 由下一次滾輪引起', async function() {
        await gotoExample()
        assert.strictEqual(await getState(), 'idle', '前置: 載入完成後靜止')
        //停頓注入(以事件同步, 不以固定時間): 重現 2026-11-02 E2E-M8 之形狀——頁面端相鄰滾輪間隔超過「滾輪至 idle」, 地圖真停
        let d = await runWheelGesture('停頓注入', { throttle: 6, pauseAt: 7 })
        let r = assertWheelSeq(d, '停頓注入')
        assert.ok(r.mid >= 1, `前提: 手勢中地圖確發過 idle(走「發過」之期望), 實際 ${r.mid}`)
        //停頓處(第 7、8 次滾輪之間)確有一筆 idle 記錄, 故序列至少兩段(只斷言恰 moving → idle 之舊斷言於此必紅);
        //  不斷言恰 4 筆: 負載更高時其餘間隔亦可能逾「滾輪至 idle」而多停一次, 各段之真偽由 assertWheelSeq 逐段判定
        let wh = d.ev.filter((e) => e.type === 'wheel')
        assert.strictEqual(wh.length, 14, '前提: 頁面收到 14 個 wheel 事件')
        assert.ok(d.seq.some((e) => e.state === 'idle' && e.t > wh[6].t && e.t < wh[7].t), `J-idle: 停頓處(第 7、8 次滾輪之間)應有 idle 記錄, 變化序列=${JSON.stringify(seqNames(d))}`)
        assert.ok(seqNames(d).length >= 4, `停頓注入: state 變化應至少 moving → idle → moving → idle, 實際 ${JSON.stringify(seqNames(d))}`)
        let fin = assertIdleSettled(d, '停頓注入')
        assert.ok(fin.z > 7, `滾輪後層級應大於 7, 實際 ${fin.z}`)
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-M8c J-idle 斷言之鑑別力(負向): 滾輪手勢中注入 idle 事件(地圖仍在移動)使 state 中途轉 idle, assertWheelSeq 須判紅', async function() {
        await gotoExample()
        //注入: 第 5 次滾輪前(縮放動畫進行中)經公開 API 之 map 派發 idle 事件, 模擬「地圖仍在動卻落定 idle」之缺陷
        let d = await runWheelGesture('注入 idle', {
            beforeWheel: async (i) => {
                if (i === 4) await page.evaluate(() => window.__getMap().fire('idle'))
            },
        })
        //前提: 注入之 idle 於地圖移動中發出, 且使 state 中途轉 idle
        let wh = d.ev.filter((e) => e.type === 'wheel')
        assert.strictEqual(wh.length, 14, '前提: 頁面收到 14 個 wheel 事件')
        assert.ok(d.ev.some((e) => e.type === 'idle' && e.moving === true && e.t > wh[3].t && e.t < wh[4].t), '前提: 第 4、5 次滾輪之間有於 map.isMoving()=true 時發出之 idle 事件(注入)')
        assert.ok(d.seq.some((e) => e.state === 'idle' && e.t > wh[3].t && e.t < wh[4].t), `前提: 注入使 state 中途轉 idle, 變化序列=${JSON.stringify(seqNames(d))}`)
        assert.throws(() => assertWheelSeq(d, '注入 idle'), /J-idle: seq\[\d+\] 之 idle 記錄之前\(本段 moving 之後\)應有 moveend/)
    })

    it('E2E-M8d J-wheel 斷言之鑑別力(負向): 中途真停後未經滾輪即移動(以 easeTo 模擬非使用者輸入之移動來源)使 state 再轉 moving, assertWheelSeq 須判紅', async function() {
        await gotoExample()
        let d = await runWheelGesture('無輸入之 moving', {
            pauseAt: 7,
            //停頓中(地圖已真停): 未經滾輪呼叫 easeTo, 等其 moving → idle 完成後才續滾
            inPause: async () => {
                let n0 = await page.evaluate(() => window.__stateLog.length)
                await page.evaluate(() => {
                    let m = window.__getMap()
                    m.easeTo({ zoom: m.getZoom() + 0.1, duration: 300 })
                })
                await waitUntilExist(page, 'easeTo 之 moving → idle', (n) => {
                    let l = window.__stateLog.slice(n)
                    return l.length >= 2 && l[l.length - 1].state === 'idle'
                }, { arg: n0, timeout: 30000 })
            },
        })
        let wh = d.ev.filter((e) => e.type === 'wheel')
        assert.strictEqual(wh.length, 14, '前提: 頁面收到 14 個 wheel 事件')
        let inPause = d.seq.filter((e) => e.t > wh[6].t && e.t < wh[7].t).map((e) => e.state)
        assert.deepStrictEqual(inPause, ['idle', 'moving', 'idle'], `前提: 停頓中先真停(idle), easeTo 再使 state 多一段 moving → idle, 實際停頓中之變化=${JSON.stringify(inPause)}`)
        assert.throws(() => assertWheelSeq(d, '無輸入之 moving'), /J-wheel: seq\[\d+\] 之 moving 記錄應由晚於 seq\[\d+\] 之 idle 記錄之 wheel 引起/)
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
