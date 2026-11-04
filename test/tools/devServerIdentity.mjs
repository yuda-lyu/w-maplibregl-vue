// 確認埠上之監聽者身分(排程第 309 項, 2026-11-05 wm309; 規格 E4「絕不沿用或下殺占用者, 除非已正面確認是本實例」; 規則帳本 R-E2E-PORT-01)
//
// 本模組無副作用(不保留埠、不 spawn、不改環境變數), 供 e2e-setup.mjs 與 unit-e2ePortReserve 共用; 身分判準只有一處(judgeOwnDevServer)。
// 導入前 e2e-setup 以「HTTP 探測有回應即沿用, 不問身分」, 埠被別的套件占用時會打到別人的服務。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import listenerPids from 'w-package-tools-e2e/src/listenerPids.mjs'
import sleepSync from 'w-package-tools-e2e/src/sleepSync.mjs'

//本專案根(去掉結尾分隔); 命令列須含「本專案根絕對路徑＋分隔字元」才算本專案之行程
const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]+$/, '')

//監聽指定埠之行程與其命令列: [{ pid, cmd }]; 無人監聽回 []; 查詢失敗(監聽表或命令列取不到)回 null——呼叫端不得把 null 當成無人或當成自己人。
//  監聽表用套件 listenerPids(判定不看狀態欄: 本機 netstat 會把監聽列成 FIN_WAIT_1 並漏列新起之監聽); 命令列在 Windows 以 PowerShell 取得
//  (-EncodedCommand 免跳脫、$ErrorActionPreference="Stop" 使查詢失敗即整段失敗而非回空表, 以 UTF-8 輸出 JSON 在 node 端比對: 本專案根路徑含非 ASCII「開源」)。
//查詢失敗(null)時重試至多 opts.attempts 次(預設 3): 機器負載高時 netstat／PowerShell 常逾時(2026-11-05 實測 CPU 緊時單次 3～7 秒、約 15% 逾時回 null);
//  重試只針對「查詢失敗」, 查得「無人監聽」([])不重試; 重試後仍失敗仍回 null(預設拒絕, 不當成無人)。
//opts.exec 供測試注入 listenerPids 之子指令執行函數; opts.cmdOf 供測試注入「PID → 命令列」; opts.timeout 為每個子指令之逾時毫秒數(預設 15000)。
export function describeListeners(port, opts = {}) {
    let attempts = opts.attempts || 3
    let r = null
    for (let i = 0; i < attempts; i++) {
        r = describeOnce(port, opts)
        if (r !== null) {
            return r
        }
        if (i < attempts - 1) {
            sleepSync(500)
        }
    }
    return null
}

function describeOnce(port, opts) {
    let timeout = opts.timeout || 15000
    let pids = listenerPids(port, { useBoth: true, timeout, exec: opts.exec })
    if (pids === null) return null
    if (pids.length === 0) return []
    let cmds = null
    if (typeof opts.cmdOf === 'function') {
        cmds = new Map(pids.map((p) => [Number(p), opts.cmdOf(Number(p))]))
    }
    else if (process.platform === 'win32') {
        let filter = pids.map((p) => `ProcessId=${Number(p)}`).join(' or ')
        let script = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference="Stop"; ' +
            `$p = @(Get-CimInstance Win32_Process -Filter "${filter}" | Select-Object ProcessId,CommandLine); ` +
            'ConvertTo-Json -Compress -Depth 3 -InputObject @{ procs = $p }'
        let r = spawnSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: timeout + 10000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
        if (r.status !== 0 || !r.stdout) return null
        try {
            cmds = new Map([].concat(JSON.parse(r.stdout.trim()).procs || []).map((x) => [Number(x.ProcessId), x.CommandLine]))
        }
        catch (e) {
            return null
        }
    }
    else {
        cmds = new Map(pids.map((p) => {
            let r = spawnSync('ps', ['-p', String(p), '-o', 'args='], { encoding: 'utf8', timeout: 10000 })
            return [Number(p), r.status === 0 ? r.stdout.trim() : null]
        }))
    }
    let out = []
    for (let p of pids) {
        let cmd = cmds.get(Number(p))
        if (typeof cmd !== 'string' || cmd === '') return null //監聽者存在而命令列取不到(權限不足、行程剛結束): 無法確認身分
        out.push({ pid: Number(p), cmd })
    }
    return out
}

//監聽指定埠者是否「全部」為本專案之 vue-cli-service(命令列同時含本專案根絕對路徑加分隔字元與 vue-cli-service)。
//  回傳 { ok, reason, listeners }; 查不到、無人監聽、任一監聽者非本專案之 vue-cli-service 皆 ok=false(預設拒絕, 規格 E4)。
//  根路徑後須接分隔字元: 前綴相近之他專案(w-maplibregl-vue-copy)不命中。
//opts.root 供測試注入; opts.describe 供測試注入 describeListeners。
export function judgeOwnDevServer(port, opts = {}) {
    let { root = ROOT, describe = describeListeners } = opts
    let ls = describe(port)
    if (ls === null) return { ok: false, reason: '查不到監聽表或行程命令列, 無法確認身分', listeners: [] }
    if (ls.length === 0) return { ok: false, reason: '無人監聽', listeners: [] }
    let norm = (s) => String(s).toLowerCase().replace(/\\/g, '/')
    let rootPrefix = norm(root).replace(/\/+$/, '') + '/'
    //vue-cli-service 須為腳本路徑之檔名(前接路徑分隔字元, 如 …/bin/vue-cli-service.js 或 …/.bin/vue-cli-service), 不是命令列任一處出現該字串(如 mocha --grep 之參數)
    let isVueCli = (cmd) => /[\\/]vue-cli-service(\.[cm]?js)?(["'\s]|$)/i.test(cmd)
    let notOwn = ls.filter((l) => !(norm(l.cmd).includes(rootPrefix) && isVueCli(l.cmd)))
    if (notOwn.length > 0) {
        return { ok: false, reason: `非本專案之 vue-cli-service: ${notOwn.map((l) => `PID ${l.pid} ${l.cmd.slice(0, 160)}`).join('; ')}`, listeners: ls }
    }
    return { ok: true, reason: '', listeners: ls }
}

//占用者描述(供錯誤訊息): 查不到時明說不明, 不假裝無人
export function describeOwners(port, opts = {}) {
    let ls = describeListeners(port, opts)
    return ls === null ? '占用者不明(查不到監聽表或命令列)' : (ls.length === 0 ? '無人監聽' : ls.map((l) => `PID ${l.pid} ${l.cmd.slice(0, 120)}`).join('; '))
}
