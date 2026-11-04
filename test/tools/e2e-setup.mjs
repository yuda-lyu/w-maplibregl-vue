// e2e 共用 setup: dev server 生命週期(進場 spawn / 離場 cleanup) + 共用 helper
// 端點一律 127.0.0.1(避開 Windows IPv6 Happy-Eyeballs 回退)
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import resolveE2ePort from 'w-package-tools-e2e/src/resolveE2ePort.mjs'
import { FRONTEND_PORT, reservation } from './e2ePorts.mjs' //須先於下方任何 resolveE2ePort(e2ePorts.mjs 模組頂層已 reserveE2ePorts)
import { judgeOwnDevServer, describeOwners } from './devServerIdentity.mjs'

// 埠: 基準埠 8123 空閒即 8123(行為同導入前); 被占用則整組位移(e2ePorts.mjs, 排程第 309 項/規格 E1～E8), 實際埠由 resolveE2ePort 取得
export const PORT = resolveE2ePort(FRONTEND_PORT)
export const baseUrl = `http://127.0.0.1:${PORT}`

let serverProc = null
let started = false

// 埠上是否有人在監聽(TCP 連線檢查, 不送 HTTP 請求: 對他人之服務不留任何請求, 規格 E4)
function isListening(port) {
    return new Promise((resolve) => {
        let s = net.connect({ host: '127.0.0.1', port })
        s.setTimeout(1500, () => { s.destroy(); resolve(false) })
        s.once('connect', () => { s.destroy(); resolve(true) })
        s.once('error', () => resolve(false))
    })
}

// 進場: 埠上無人監聽 → spawn vue-cli serve 等到 Compiled successfully, 並確認埠上確為自己啟動之 vue-cli-service;
//   埠上已有人監聽: 自動換埠下(未手動設 E2E_PORT_OFFSET)必為保留後被他人占走(規格 E5), 不沿用、不下殺, 拋錯寫明占用者(重跑即重選埠);
//   手動鎖基準埠(E2E_PORT_OFFSET 已設, 含 0＝沿用本機常駐 dev server 之逃生口)方可沿用, 且須確認監聽者確為本專案之 vue-cli-service(devServerIdentity.mjs)。
//   (導入前為「埠通即沿用, 不問身分」: 被占用時 e2e 會打到別人的服務。)
//opts 供單元測試(unit-e2ePortReserve)注入, 一般呼叫不傳: opts.spawnFn(port)=>ChildProcess 取代 spawn vue-cli-service(須印出 Compiled successfully 表示就緒); opts.verifyMs 為 spawn 後確認監聽者身分之等待上限。
export async function startServer(opts = {}) {
    if (started) return
    try {
        if (await isListening(PORT)) {
            if (reservation.source === 'auto') {
                throw new Error(`埠 ${PORT} 於保留後被他人占用(${describeOwners(PORT)}), 不沿用、不下殺; 重跑即重選埠`)
            }
            let v = judgeOwnDevServer(PORT)
            if (!v.ok) {
                throw new Error(`埠 ${PORT} 已有服務但不是本專案之 vue-cli-service(${v.reason}), 不沿用、不下殺`)
            }
            console.log(`[e2e-setup] frontend already running on ${PORT} (本專案之 vue-cli-service, PID ${v.listeners.map((l) => l.pid).join(',')}), reusing`)
            started = true
            return
        }
        await spawnServer(opts.spawnFn)
        //spawn 後確認埠上監聽者確為本專案之 vue-cli-service: 偵測與綁定之間埠被占走時 vue-cli 之 portfinder 會靜默改用別的埠, 而本測試連的仍是 PORT(占走者)
        let v = judgeOwnDevServer(PORT)
        for (let t0 = Date.now(); !v.ok && Date.now() - t0 < (opts.verifyMs || 90000);) {
            await new Promise((r) => setTimeout(r, 500))
            v = judgeOwnDevServer(PORT)
        }
        if (!v.ok) {
            throw new Error(`dev server 已就緒但埠 ${PORT} 上的監聽者不是本專案之 vue-cli-service(埠於啟動期間被他人占用, vue-cli 已改用其他埠): ${v.reason}`)
        }
        reservation.noteOwn(serverProc) //記下本實例之服務行程, 供下次開跑依身分清除殘留
        started = true
    }
    catch (e) {
        stopServer() //失敗時收掉自己 spawn 的(若有); started 維持 false, 後續呼叫會重新偵測並再拋同樣的錯, 不靜默放行
        throw e
    }
}

function spawnServer(spawnFn) {
    return new Promise((resolve, reject) => {
        serverProc = typeof spawnFn === 'function'
            ? spawnFn(PORT)
            : spawn('npx', ['vue-cli-service', 'serve', '--port', String(PORT)], {
                cwd: process.cwd(),
                shell: true,
                windowsHide: true, //不彈出主控台視窗
                stdio: ['ignore', 'pipe', 'pipe'],
            })
        let done = false
        //逾時計時器於就緒或失敗後即清除(導入前不清, 其後 120 秒內行程無法自然結束; 單元測試之子行程因此久久不退)
        let timer = setTimeout(() => { if (!done) { done = true; reject(new Error('serve start timeout(120s)')) } }, 120000)
        let onData = (buf) => {
            let s = buf.toString()
            if (!done && /Compiled successfully|App running at/.test(s)) { done = true; clearTimeout(timer); resolve() }
            if (!done && /Failed to compile|ERROR in/.test(s)) { done = true; clearTimeout(timer); reject(new Error('serve compile failed:\n' + s)) }
        }
        serverProc.stdout.on('data', onData)
        serverProc.stderr.on('data', onData)
        serverProc.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e) } })
    })
}

// 離場: 殺掉自己 spawn 的 server 進程樹(不誤殺別人手動啟動的: serverProc 為 null 時不動作)
export function stopServer() {
    if (!serverProc) return
    let proc = serverProc
    let pid = serverProc.pid
    serverProc = null
    started = false
    //自己 spawn 的行程已結束: PID 可能已被作業系統回收給無關行程, 不下殺(獨立審查 2026-11-05 指出; 導入前即無此判斷)
    if (proc.exitCode !== null || proc.signalCode !== null) return
    try {
        //同步下殺(導入前為非同步 spawn): exit／SIGINT／SIGTERM 備援內之非同步 spawn 不會被等待, 實測(2026-11-05)真實 npx vue-cli-service 於 process.exit、SIGINT 路徑會殘留。
        //  導入自動換埠後殘留者不再被「埠通即沿用」掩蓋而重用, 每次殘留會多占一組埠(上限 20 組後 E2E_PORT_EXHAUSTED), 故須同步收掉; 只殺自己 spawn 的 serverProc 行程樹
        if (process.platform === 'win32') spawnSync(`taskkill /F /T /PID ${pid}`, { shell: true, stdio: 'ignore', windowsHide: true })
        else process.kill(-pid, 'SIGKILL')
    }
    catch (e) { /* ignore */ }
}

// 框架環境: mocha root after hook 觸發 cleanup
if (typeof globalThis.after === 'function') {
    globalThis.after(function() { this.timeout(20000); stopServer() })
}
// Ctrl+C / 終止備援
process.on('exit', stopServer)
process.on('SIGINT', () => { stopServer(); process.exit(1) })
process.on('SIGTERM', () => { stopServer(); process.exit(1) })

// 每步驟先偵測對象就緒再進下一步, 超時拋錯
export async function waitUntilExist(page, label, fn, opts = {}) {
    let { timeout = 15000, arg = null } = opts
    try {
        await page.waitForFunction(fn, arg, { timeout })
    }
    catch (err) {
        throw new Error(`waitUntilExist 超過 ${timeout}ms 仍找不到「${label}」`)
    }
}
