/**
 * moveState.mjs
 * 圖台「移動中」狀態追蹤(元件根節點 state 屬性之來源, 規則帳本 R16)。
 * 比照 w-component-vue WDrawer 之 state 語彙: 過場中為進行式('moving'), 落定為終態('idle');
 * 落定以 maplibre 之 idle 事件(相機停止, 且圖磚載入與繪製完成)為主, 逾時後備為輔(事件未觸發亦須落定)。
 * 純邏輯模組(不依賴 Vue / DOM 全域), 計時器可注入, 供單元測試。
 */

export const MOVE_STATE_MOVING = 'moving'
export const MOVE_STATE_IDLE = 'idle'

/** 相機停止(moveend)或標記移動中後, 等 idle 事件之上限(ms), 逾時即落定, 為 idle 事件未觸發(圖磚逾時未載完、繪製被暫停等)之後備 */
export const MOVE_IDLE_WAIT_MS = 3000

/** 滾輪事件後, 等 maplibre 開始移動(movestart)之上限(ms)。maplibre 滾輪縮放自首個 wheel 事件到 movestart 約 40~80ms(辨識滾輪類型之 40ms 計時加下一影格), 層級已達上下限之滾輪則根本不移動 */
export const MOVE_WHEEL_WAIT_MS = 600


/**
 * 建立圖台移動狀態追蹤
 *
 * 轉換時點:
 *   'moving' ← 初始(首次 idle 前, 含載入中)、movestart(panTo/easeTo/flyTo/zoomTo/jumpTo、滾輪、拖曳、縮放鈕、羅盤、resize 等任何相機移動)、
 *              靜止時之滾輪事件(搶在 movestart 之前, 見 MOVE_WHEEL_WAIT_MS)、projectiontransition(投影真正遷移:
 *              opt.projection 變更、自動投影跨層級 8、使用端 setProjection; 此類切換可無 movestart, 但其後重繪與圖磚重載至 idle 前畫面仍在變)
 *   'idle'   ← map 的 idle 事件(滾輪事件後 movestart 前之 idle 不採計)、或逾時後備: 計時到時地圖不在移動中即落定(移動中則續等)
 * 計時器於 load、movestart、moveend、projectiontransition、靜止時之滾輪事件重設, 於 idle 與 dispose 清除。
 *
 * @param {Object} map - MapLibre 地圖實例(須有 on/off/isMoving/getCanvasContainer)
 * @param {Function} onChange - 狀態改變時呼叫 (state, reason), reason 為 'movestart'|'wheel'|'projection' 進入原因, 或 'idle'|'timeout' 落定原因
 * @param {Object} [opt] - { idleWaitMs, wheelWaitMs, setTimer, clearTimer }, 供測試注入; 預設 MOVE_IDLE_WAIT_MS、MOVE_WHEEL_WAIT_MS、setTimeout、clearTimeout
 * @returns {{ getState: Function, dispose: Function }}
 */
export function createMoveState(map, onChange, opt = {}) {
    let isPosNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
    let idleWaitMs = isPosNum(opt.idleWaitMs) ? opt.idleWaitMs : MOVE_IDLE_WAIT_MS
    let wheelWaitMs = isPosNum(opt.wheelWaitMs) ? opt.wheelWaitMs : MOVE_WHEEL_WAIT_MS
    let setTimer = typeof opt.setTimer === 'function' ? opt.setTimer : (fn, ms) => setTimeout(fn, ms)
    let clearTimer = typeof opt.clearTimer === 'function' ? opt.clearTimer : (h) => clearTimeout(h)

    let state = MOVE_STATE_MOVING
    let timer = null
    let wheelPending = false //靜止時收到滾輪, 尚未見 movestart
    let disposed = false

    let set = (s, reason) => {
        if (state === s) return
        state = s
        onChange(s, reason)
    }
    let disarm = () => {
        if (timer !== null) {
            clearTimer(timer); timer = null
        }
    }
    //逾時後備: 到時地圖仍在移動(長動畫、使用者持續手勢)則續等, 不在移動中才落定
    let arm = (ms) => {
        disarm()
        timer = setTimer(() => {
            timer = null
            if (disposed) return
            wheelPending = false
            if (map.isMoving()) {
                arm(idleWaitMs); return
            }
            set(MOVE_STATE_IDLE, 'timeout')
        }, ms)
    }
    let toMoving = (reason, ms) => {
        set(MOVE_STATE_MOVING, reason)
        arm(ms)
    }

    let onLoad = () => {
        if (state === MOVE_STATE_MOVING) arm(idleWaitMs) //載入完成, 等首次 idle(繪製與圖磚載入完成)
    }
    let onMoveStart = () => {
        wheelPending = false
        toMoving('movestart', idleWaitMs)
    }
    let onMoveEnd = () => {
        if (state === MOVE_STATE_MOVING) arm(idleWaitMs) //相機已停止, 等 idle
    }
    let onIdle = () => {
        if (wheelPending) return //滾輪已到而 movestart 未至: 此 idle 非本次移動之終點
        disarm()
        set(MOVE_STATE_IDLE, 'idle')
    }
    let onWheel = () => {
        if (state !== MOVE_STATE_IDLE) return //已在移動中(或等 idle 中), movestart 到來時會重設計時
        wheelPending = true
        toMoving('wheel', wheelWaitMs)
    }
    //maplibre 僅在投影真正遷移(migrateProjection)時發此事件, 同型別重設不發; 遷移後圖磚重載, idle 於重載完成後才發
    let onProjection = () => {
        toMoving('projection', idleWaitMs)
    }

    let evs = { load: onLoad, movestart: onMoveStart, moveend: onMoveEnd, projectiontransition: onProjection, idle: onIdle }
    for (let k of Object.keys(evs)) map.on(k, evs[k])
    let elWheel = typeof map.getCanvasContainer === 'function' ? map.getCanvasContainer() : null
    if (elWheel) elWheel.addEventListener('wheel', onWheel, { passive: true })

    return {
        getState: () => state,
        dispose: () => {
            disposed = true
            disarm()
            for (let k of Object.keys(evs)) map.off(k, evs[k])
            if (elWheel) elWheel.removeEventListener('wheel', onWheel)
        },
    }
}
