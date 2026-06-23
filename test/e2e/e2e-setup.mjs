// e2e 共用 setup: dev server 生命週期(進場 spawn / 離場 cleanup) + 共用 helper
// 端點一律 127.0.0.1(避開 Windows IPv6 Happy-Eyeballs 回退)
import { spawn } from 'node:child_process'
import http from 'node:http'

export const PORT = 8123
export const baseUrl = `http://127.0.0.1:${PORT}`

let serverProc = null
let started = false

function ping(url) {
    return new Promise((resolve) => {
        let req = http.get(url, (res) => { res.resume(); resolve(true) })
        req.on('error', () => resolve(false))
        req.setTimeout(1000, () => { req.destroy(); resolve(false) })
    })
}

// 進場: port 已被佔用則 reuse(不 spawn); 否則 spawn vue-cli serve 等到 Compiled successfully
export async function startServer() {
    if (started) return
    if (await ping(baseUrl)) { started = true; return }
    started = true
    await new Promise((resolve, reject) => {
        serverProc = spawn('npx', ['vue-cli-service', 'serve', '--port', String(PORT)], {
            cwd: process.cwd(),
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let done = false
        let onData = (buf) => {
            let s = buf.toString()
            if (!done && /Compiled successfully|App running at/.test(s)) { done = true; resolve() }
            if (!done && /Failed to compile|ERROR in/.test(s)) { done = true; reject(new Error('serve compile failed:\n' + s)) }
        }
        serverProc.stdout.on('data', onData)
        serverProc.stderr.on('data', onData)
        serverProc.on('error', (e) => { if (!done) { done = true; reject(e) } })
        setTimeout(() => { if (!done) { done = true; reject(new Error('serve start timeout(120s)')) } }, 120000)
    })
}

// 離場: 殺掉自己 spawn 的 server 進程樹(不誤殺別人手動啟動的: serverProc 為 null 時不動作)
export function stopServer() {
    if (!serverProc) return
    let pid = serverProc.pid
    serverProc = null
    started = false
    try {
        if (process.platform === 'win32') spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { shell: true })
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
