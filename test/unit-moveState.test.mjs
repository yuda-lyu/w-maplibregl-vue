// unit: 圖台移動狀態追蹤(根節點 state 屬性之來源 src/js/moveState.mjs, 規則帳本 R16)
//
// 以假 map + 假時鐘驗證(不需瀏覽器; 計時器一律注入, 以虛擬時間推進, 不用 sleep 後斷言):
//   J-init   state 初值為 'moving'(初次載入至首次 idle 前亦為移動中)
//   J-start  maplibre movestart 設為 'moving'; moveend 後仍為 'moving'(等圖磚載入與繪製完成), idle 事件才設為 'idle'
//   J-wheel  靜止時收到滾輪事件即轉 'moving'(搶在 movestart 之前); 其後 movestart 前之 idle 事件不採計; 未引起移動(層級已達上下限)則逾時落定
//   J-proj   投影遷移(maplibre projectiontransition, 無 movestart 亦然)期間為 'moving', idle 事件或逾時落定
//   J-back   逾時後備: idle 事件未觸發(圖磚逾時未載完、繪製被暫停)時, 相機停止 idleWaitMs 後仍落定為 'idle'; 逾時當下地圖仍在移動則續等
//   J-once   狀態有變才通知(onChange); dispose 後不再回應事件、不留計時器與監聽
import assert from 'assert'
import { createMoveState, MOVE_STATE_MOVING, MOVE_STATE_IDLE, MOVE_IDLE_WAIT_MS, MOVE_WHEEL_WAIT_MS } from '../src/js/moveState.mjs'

//假時鐘: setTimer/clearTimer 注入, advance 依到期序執行(含執行中新排入且到期者)
function fakeClock() {
    let now = 0
    let seq = 0
    let timers = new Map()
    return {
        get now() {
            return now
        },
        get pending() {
            return timers.size
        },
        setTimer(fn, ms) {
            let id = ++seq
            timers.set(id, { at: now + ms, fn })
            return id
        },
        clearTimer(id) {
            timers.delete(id)
        },
        advance(ms) {
            let end = now + ms
            for (;;) {
                let next = null
                for (let [id, t] of timers) {
                    if (t.at <= end && (next === null || t.at < next.t.at || (t.at === next.t.at && id < next.id))) next = { id, t }
                }
                if (!next) break
                timers.delete(next.id)
                now = Math.max(now, next.t.at)
                next.t.fn()
            }
            now = end
        },
    }
}

//假 map: Evented 子集 + isMoving + getCanvasContainer(含 wheel 監聽)
function fakeMap(withContainer = true) {
    let hs = {}
    let wheelHs = []
    let map = {
        moving: false,
        on(k, f) {
            (hs[k] = hs[k] || []).push(f)
        },
        off(k, f) {
            hs[k] = (hs[k] || []).filter((x) => x !== f)
        },
        fire(k) {
            for (let f of (hs[k] || []).slice()) f()
        },
        count(k) {
            return (hs[k] || []).length
        },
        isMoving() {
            return map.moving
        },
        wheelCount: () => wheelHs.length,
        wheel() {
            for (let f of wheelHs.slice()) f()
        },
    }
    if (withContainer) {
        let el = {
            addEventListener(k, f, o) {
                assert.strictEqual(k, 'wheel')
                assert.strictEqual(o && o.passive, true, 'wheel 監聽須為 passive(不改變滾輪縮放行為)')
                wheelHs.push(f)
            },
            removeEventListener(k, f) {
                wheelHs = wheelHs.filter((x) => x !== f)
            },
        }
        map.getCanvasContainer = () => el
    }
    return map
}

function setup(opt = {}) {
    let clock = fakeClock()
    let map = fakeMap()
    let log = []
    let ms = createMoveState(map, (s, reason) => log.push([s, reason]), { setTimer: clock.setTimer, clearTimer: clock.clearTimer, ...opt })
    return { clock, map, log, ms }
}

describe('unit-moveState', function() {

    it('U33 J-init 初值為 moving; load 後仍 moving(等首次 idle); 首次 idle 才為 idle', function() {
        let { clock, map, log, ms } = setup()
        assert.strictEqual(ms.getState(), MOVE_STATE_MOVING)
        assert.strictEqual(MOVE_STATE_MOVING, 'moving')
        assert.strictEqual(MOVE_STATE_IDLE, 'idle')
        map.fire('load')
        assert.strictEqual(ms.getState(), MOVE_STATE_MOVING)
        assert.deepStrictEqual(log, [], '初值不通知; load 不改變狀態')
        clock.advance(100)
        map.fire('idle')
        assert.strictEqual(ms.getState(), MOVE_STATE_IDLE)
        assert.deepStrictEqual(log, [['idle', 'idle']])
        assert.strictEqual(clock.pending, 0, 'idle 落定後不留計時器')
    })

    it('U34 J-start movestart → moving; moveend 後仍 moving; idle → idle', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        assert.strictEqual(ms.getState(), 'moving')
        clock.advance(500)
        map.moving = false
        map.fire('moveend')
        assert.strictEqual(ms.getState(), 'moving', '相機已停止仍須等圖磚載入與繪製完成(idle 事件)')
        clock.advance(200)
        assert.strictEqual(ms.getState(), 'moving')
        map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'idle']])
    })

    it('U35 J-back 逾時後備: idle 事件未觸發, moveend 後 idleWaitMs 內仍 moving, 到時落定為 idle(reason=timeout)', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        map.moving = false
        map.fire('moveend')
        clock.advance(MOVE_IDLE_WAIT_MS - 1)
        assert.strictEqual(ms.getState(), 'moving', `未到 ${MOVE_IDLE_WAIT_MS}ms 不得落定`)
        clock.advance(1)
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'timeout']])
        assert.strictEqual(clock.pending, 0)
    })

    it('U36 J-back 逾時當下地圖仍在移動(長動畫/持續手勢)不落定, 續等; 停止後才落定', function() {
        let { clock, map, log, ms } = setup({ idleWaitMs: 1000 })
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        clock.advance(1000) //計時到, 但仍在移動
        clock.advance(1000)
        clock.advance(500)
        assert.strictEqual(ms.getState(), 'moving', '長動畫期間(movestart 後 2500ms 無 moveend)不得落定')
        map.moving = false
        map.fire('moveend')
        clock.advance(999)
        assert.strictEqual(ms.getState(), 'moving')
        clock.advance(1)
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'timeout']])
    })

    it('U37 J-back 新的 movestart 重設計時: 舊計時不得落定新一輪移動', function() {
        let { clock, map, log, ms } = setup({ idleWaitMs: 1000 })
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        map.moving = false
        map.fire('moveend') //t=0 起算 1000
        clock.advance(600)
        map.moving = true
        map.fire('movestart') //t=600 重設 → 1600
        clock.advance(900) //t=1500 > 舊計時(1000)
        map.moving = false
        assert.strictEqual(ms.getState(), 'moving', '舊計時(t=1000)已被重設, 不得在 t=1000 落定')
        clock.advance(100) //t=1600 新計時到, 不在移動中 → 落定
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'timeout']], '連續兩次 movestart 只通知一次 moving')
    })

    it('U38 J-once 狀態有變才通知: 重複 idle 只通知一次; 移動中重複 movestart/moveend 不重複通知', function() {
        let { map, log } = setup()
        map.fire('load')
        map.fire('idle'); map.fire('idle'); map.fire('idle')
        assert.deepStrictEqual(log, [['idle', 'idle']])
        log.length = 0
        map.moving = true
        map.fire('movestart'); map.fire('movestart'); map.fire('moveend'); map.fire('moveend')
        assert.deepStrictEqual(log, [['moving', 'movestart']])
    })

    it('U39 J-wheel 靜止時滾輪 → 立即 moving(搶在 movestart 前); movestart 前之 idle 事件不採計; movestart 後 idle 才落定', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        assert.strictEqual(ms.getState(), 'idle')
        map.wheel()
        assert.strictEqual(ms.getState(), 'moving')
        clock.advance(40)
        map.fire('idle') //與滾輪無關之 idle(如圖磚淡入結束)
        assert.strictEqual(ms.getState(), 'moving', '滾輪已到而 movestart 未至: 此 idle 非本次移動之終點')
        clock.advance(40)
        map.moving = true
        map.fire('movestart')
        clock.advance(300)
        map.moving = false
        map.fire('moveend')
        map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'wheel'], ['idle', 'idle']])
    })

    it('U40 J-wheel 滾輪未引起移動(層級已達上下限): wheelWaitMs 後落定 idle(reason=timeout), 不等 idleWaitMs', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        map.wheel()
        clock.advance(MOVE_WHEEL_WAIT_MS - 1)
        assert.strictEqual(ms.getState(), 'moving')
        clock.advance(1)
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'wheel'], ['idle', 'timeout']])
        assert.ok(MOVE_WHEEL_WAIT_MS < MOVE_IDLE_WAIT_MS)
    })

    it('U41 J-wheel 已在移動中(等 idle 中)之滾輪不縮短等待, 也不改為 pending', function() {
        let { clock, map, log, ms } = setup({ idleWaitMs: 3000, wheelWaitMs: 600 })
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        map.moving = false
        map.fire('moveend') //等 idle, 計時 3000
        clock.advance(100)
        map.wheel() //已 moving: 不重設為 600
        clock.advance(700)
        assert.strictEqual(ms.getState(), 'moving', '不得因滾輪縮短為 600ms')
        map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle', '非 pending 狀態下之 idle 照常採計')
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'idle']])
    })

    it('U42 J-proj 投影遷移(projectiontransition, 無 movestart): idle → moving(reason=projection); idle 事件落定; 無 idle 事件則逾時落定', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        map.fire('projectiontransition')
        assert.strictEqual(ms.getState(), 'moving')
        map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle')
        map.fire('projectiontransition')
        clock.advance(MOVE_IDLE_WAIT_MS - 1)
        assert.strictEqual(ms.getState(), 'moving', '逾時前不得落定')
        clock.advance(1)
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'projection'], ['idle', 'idle'], ['moving', 'projection'], ['idle', 'timeout']])
    })

    it('U42b J-proj 移動中發生投影遷移(自動投影於 zoomend 內切換): 仍 moving 不重複通知, 重設計時, 其後 idle 事件落定', function() {
        let { clock, map, log, ms } = setup({ idleWaitMs: 1000 })
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        clock.advance(900)
        map.fire('projectiontransition') //重設 → t=1900
        map.moving = false
        map.fire('moveend') //重設 → t=1900
        clock.advance(999)
        assert.strictEqual(ms.getState(), 'moving')
        map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['moving', 'movestart'], ['idle', 'idle']])
    })

    it('U43 J-init 首次 idle 前載入逾時(load 後 idle 事件未觸發)亦落定 idle', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load')
        clock.advance(MOVE_IDLE_WAIT_MS - 1)
        assert.strictEqual(ms.getState(), 'moving')
        clock.advance(1)
        assert.strictEqual(ms.getState(), 'idle')
        assert.deepStrictEqual(log, [['idle', 'timeout']])
    })

    it('U44 J-once dispose: 取消監聽與計時器, 其後事件與 markMoving 不改狀態', function() {
        let { clock, map, log, ms } = setup()
        map.fire('load'); map.fire('idle'); log.length = 0
        map.moving = true
        map.fire('movestart')
        assert.ok(clock.pending > 0)
        ms.dispose()
        assert.strictEqual(clock.pending, 0, 'dispose 須清除計時器')
        for (let k of ['load', 'movestart', 'moveend', 'projectiontransition', 'idle']) assert.strictEqual(map.count(k), 0, `dispose 須取消 ${k} 監聽`)
        assert.strictEqual(map.wheelCount(), 0, 'dispose 須取消 wheel 監聽')
        map.fire('idle'); map.wheel(); map.fire('projectiontransition'); map.fire('movestart')
        clock.advance(MOVE_IDLE_WAIT_MS * 2)
        assert.strictEqual(ms.getState(), 'moving', 'dispose 後狀態凍結')
        assert.deepStrictEqual(log, [['moving', 'movestart']])
    })

    it('U45 opt 非法值(NaN/負數/字串/null)用預設; 合法 0 有效; map 無 getCanvasContainer 不拋錯', function() {
        for (let bad of [NaN, -1, '500', null, undefined, Infinity]) {
            let { clock, map, ms } = setup({ idleWaitMs: bad, wheelWaitMs: bad })
            map.fire('load'); map.fire('idle')
            map.wheel()
            clock.advance(MOVE_WHEEL_WAIT_MS)
            assert.strictEqual(ms.getState(), 'idle', `wheelWaitMs=${String(bad)} 應用預設 ${MOVE_WHEEL_WAIT_MS}`)
            map.moving = true; map.fire('movestart'); map.moving = false; map.fire('moveend')
            clock.advance(MOVE_IDLE_WAIT_MS - 1)
            assert.strictEqual(ms.getState(), 'moving', `idleWaitMs=${String(bad)} 應用預設 ${MOVE_IDLE_WAIT_MS}`)
            clock.advance(1)
            assert.strictEqual(ms.getState(), 'idle')
        }
        let z = setup({ idleWaitMs: 0 }) //0 為有效值(不可視為未給)
        z.map.fire('load')
        z.clock.advance(0)
        assert.strictEqual(z.ms.getState(), 'idle', 'idleWaitMs=0 有效')
        let clock = fakeClock()
        let map = fakeMap(false)
        let ms = createMoveState(map, () => {}, { setTimer: clock.setTimer, clearTimer: clock.clearTimer })
        map.fire('load'); map.fire('idle')
        assert.strictEqual(ms.getState(), 'idle')
        ms.dispose()
    })

    it('U46 預設計時器為真實 setTimeout/clearTimeout(未注入時可用); 以狀態通知事件同步, 非固定等待', async function() {
        let map = fakeMap()
        let ms = null
        let got = await new Promise((resolve) => {
            ms = createMoveState(map, (s, r) => resolve([s, r]), { idleWaitMs: 20 })
            map.fire('load')
        })
        assert.deepStrictEqual(got, ['idle', 'timeout'])
        ms.dispose()
    })

})
