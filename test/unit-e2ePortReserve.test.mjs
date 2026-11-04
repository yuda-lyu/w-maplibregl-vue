// 測試 e2e 單開之自動換埠與「不沿用、不下殺非本實例」(規則帳本 R-E2E-PORT-01; 排程第 309 項, 2026-11-05 wm309; 規格 C:/opensrcOper/dspec/e2e埠與多套件同跑.md E1～E8)
//
// 受測: test/tools/e2ePorts.mjs(基準埠單一定義＋reserveE2ePorts)、test/tools/e2e-setup.mjs(PORT／baseUrl／startServer／describeListeners／judgeOwnDevServer)、test/ 下之下殺站點與寫死之埠。
// 契約(R-E2E-PORT-01):
//   1. [E1][E2] 沒有占用時即基準埠 8123(E2E_PORT_OFFSET 維持未設); 基準埠被真實監聽者占用時整組位移, 位移後之 PORT／baseUrl 皆為位移後之實際埠, 占用者沒有收到任何 HTTP 請求(保留與偵測只做綁定檢查)。
//   2. [E3] 兩個同時開跑之行程(同一登錄目錄)不會選到同一組埠。
//   3. [E4][E5] startServer 不沿用占用者: 自動換埠下, 保留後埠上出現他人之監聽者 → 拋錯寫明占用者, 不沿用、不下殺、不送 HTTP 請求;
//      手動鎖基準埠(E2E_PORT_OFFSET 已設, 含 0＝沿用常駐 dev server 之逃生口)下, 監聽者須確為本專案之 vue-cli-service 才沿用, 非本專案者拒絕(導入前「埠通即沿用, 不問身分」會打到別人的服務)。
//   4. [E4] judgeOwnDevServer 預設拒絕: 查不到、無人監聽、任一監聽者非本專案之 vue-cli-service 皆不沿用; 根路徑須接分隔字元(前綴相近之他專案不命中)。
//   5. [E4] test/ 內之下殺站點全集固定(只殺自己 spawn 之子行程), 無依埠或依名稱下殺; 新增下殺站點即紅, 逼出逐處審查。
//   6. 測試碼(e2e-／api-／tools)無寫死之 host:埠 網址(唯一例外 e2e-fileprotocol 之虛擬來源, 其埠須列入 OTHER_TEST_PORTS); 基準埠字面站點只在 e2ePorts.mjs; OTHER_TEST_PORTS 與實際寫死之埠一致。
// 占用者為真實 http 監聽(同 node 預設之雙棧位址)或真實子行程; 期望一律由當下環境動態算出(他人占用者、本行程之 dev server 皆計入), 不用 skip 當常態(全套同一 mocha 行程內 e2e 之 dev server 可能正占著 8123)。
// 跑法: node C:/opensrcOper/tools/quiet-run.mjs --name e2ePortReserve --lock -- npx mocha test/unit-e2ePortReserve.test.mjs --timeout 120000
import fs from 'fs'
import net from 'net'
import http from 'http'
import path from 'path'
import assert from 'assert'
import { spawn, spawnSync } from 'child_process'
import { fileURLToPath, pathToFileURL } from 'url'
import { judgeOwnDevServer, describeListeners } from './tools/devServerIdentity.mjs' //無副作用之身分確認模組(不保留埠)

const A = assert.strict
const fdTest = path.dirname(fileURLToPath(import.meta.url))
//基準埠與其他測試寫死之埠自 e2ePorts.mjs「原始碼文字」取得, 不 import 該模組: import 會在本 mocha 行程內實際呼叫 reserveE2ePorts(保留埠、改環境變數), 使靜態盤點依賴環境
const PORTS_SRC = fs.readFileSync(path.join(fdTest, 'tools', 'e2ePorts.mjs'), 'utf8')
const FRONTEND_PORT = Number(/export const FRONTEND_PORT = (\d+)/.exec(PORTS_SRC)[1])
const OTHER_TEST_PORTS = JSON.parse(/export const OTHER_TEST_PORTS = (\[[^\]]*\])/.exec(PORTS_SRC)[1])
const projRoot = path.join(fdTest, '..')
const fdTmp = path.join(fdTest, '_tmp', 'e2ePortReserve') //測試中介資料(測完即刪)
const fdReg = path.join(fdTmp, 'reg') //私有之埠預約登錄目錄(不干擾真實預約)
const fdFakeBin = path.join(fdTmp, 'fakebin') //假 taskkill.cmd 所在(PR-012c)
const SETUP_URL = pathToFileURL(path.join(fdTest, 'tools', 'e2e-setup.mjs')).href
const PORTS_URL = pathToFileURL(path.join(fdTest, 'tools', 'e2ePorts.mjs')).href
const SELF = path.basename(fileURLToPath(import.meta.url))
const STEP = 100 //reserveE2ePorts 預設 portStep

//子行程: 匯入 e2e-setup(模組頂層即保留埠)後回報實際埠。
//  WM309_MODE=info: 回報後結束; hold: 回報後續留(保留不釋放)至父行程寫入一行; start: 回報後等父行程寫入一行, 再呼叫 startServer 並回報結果(拋錯或成功沿用; 不會 spawn dev server: 不是拋錯就是沿用)。
//  start 模式另可設 WM309_SPAWN(替身腳本路徑)與 WM309_LOG: startServer 改以該替身取代 vue-cli-service(opts.spawnFn; 替身印出 Compiled successfully 即就緒); WM309_VERIFY_MS 縮短身分確認之等待(僅否定案例用);
//  WM309_HOLD_AFTER=1: 回報 START 後續留至父行程再寫入一行(讓父行程檢查預約檔等)。
const CHILD_CODE = `
import { spawn } from 'node:child_process'
const m = await import(${JSON.stringify(SETUP_URL)})
const p = await import(${JSON.stringify(PORTS_URL)})
console.log('RESULT ' + JSON.stringify({ source: p.reservation.source, offset: p.reservation.offset, ports: p.reservation.ports, env: process.env.E2E_PORT_OFFSET === undefined ? null : process.env.E2E_PORT_OFFSET, PORT: m.PORT, baseUrl: m.baseUrl }))
const wait = () => new Promise((resolve) => process.stdin.once('data', resolve))
if (process.env.WM309_MODE === 'hold') {
    await wait()
}
if (process.env.WM309_MODE === 'start') {
    await wait()
    try {
        //未指定替身時, 本情境不應 spawn dev server(不是拋錯就是沿用): 若真走到 spawn 即以此拋錯顯現(例: 埠上有人監聽卻被誤判為無人), 不會真的起 npx vue-cli-service
        let opts = { spawnFn: () => { throw new Error('unexpected spawn: 測試情境不應 spawn dev server') } }
        if (process.env.WM309_SPAWN) {
            //WM309_SPAWN_SHELL=1: 經 shell 啟動(行程鏈 cmd.exe → node, 同 npx vue-cli-service 之 shell:true 啟動形狀); 否則直接啟動
            let spawnFn = (port) => spawn(process.execPath, [process.env.WM309_SPAWN, String(port), process.env.WM309_LOG], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
            if (process.env.WM309_SPAWN_SHELL === '1') {
                spawnFn = (port) => spawn('"' + process.execPath + '" "' + process.env.WM309_SPAWN + '" ' + port + ' "' + process.env.WM309_LOG + '"', { shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
            }
            opts = { verifyMs: Number(process.env.WM309_VERIFY_MS) || undefined, spawnFn }
        }
        await m.startServer(opts)
        console.log('START ' + JSON.stringify({ ok: true }))
    }
    catch (err) {
        console.log('START ' + JSON.stringify({ ok: false, message: String(err && err.message) }))
    }
    if (process.env.WM309_HOLD_AFTER === '1') {
        await wait()
    }
    //WM309_EXIT_MODE=exit: 不經 stopServer 直接 process.exit(模擬 mocha --exit、Ctrl+C 之備援路徑: 只有 process.on('exit') 之備援會收掉自己 spawn 的 dev server)
    if (process.env.WM309_EXIT_MODE === 'exit') {
        process.exit(0)
    }
}
m.stopServer()
`

//假的「本專案 vue-cli-service」: 檔名含 vue-cli-service 且位於本專案根內之真實行程(命令列同時含專案根絕對路徑與 vue-cli-service), 在指定埠真實監聽並記錄收到之請求
const FAKE_DEV_CODE = `
import http from 'http'
import fs from 'fs'
const port = Number(process.argv[2])
const fpLog = process.argv[3]
http.createServer((req, res) => {
    fs.appendFileSync(fpLog, 'hit ' + req.method + ' ' + req.url + '\\n')
    res.end('fake dev server')
}).listen(port, () => {
    fs.appendFileSync(fpLog, 'listening pid=' + process.pid + '\\n')
    console.log('Compiled successfully')
})
`

//印出就緒字樣後立即結束的替身(模擬 dev server 啟動後即死: 其 PID 隨即可能被作業系統回收給無關行程)
const EXIT_STUB_CODE = `
process.stdout.write('Compiled successfully\\n', () => process.exit(0))
`

let baseEnv = () => {
    let env = { ...process.env, E2E_PORT_REG_DIR: fdReg }
    for (let k of ['E2E_PORT_OFFSET', 'E2E_PORT_HOLD', 'E2E_REGEN', 'E2E_BARE', 'E2E_DIAG', 'E2E_COLLECT', 'WM309_MODE']) {
        delete env[k]
    }
    return env
}

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let alive = (pid) => {
    try {
        process.kill(pid, 0)
        return true
    }
    catch (err) {
        return err.code === 'EPERM'
    }
}

//等行程確實結束(輪詢至 PID 消失, 上限 30 秒; 以可觀察之條件同步, 不以固定延時後斷言)
let waitDead = async (pid, limitMs = 30000) => {
    let t0 = Date.now()
    while (alive(pid)) {
        if (Date.now() - t0 > limitMs) {
            return false
        }
        await sleep(100)
    }
    return true
}

//事件同步: 輪詢 cond 為真, 上限 limitMs
let waitUntil = async (cond, limitMs, what) => {
    let t0 = Date.now()
    while (!cond()) {
        if (Date.now() - t0 > limitMs) {
            throw new Error(`逾時未見: ${what}`)
        }
        await sleep(50)
    }
}

let live = [] //本檔建立之子行程(after 一律收掉)
let occupants = [] //本檔建立之占用者(after 一律關閉)

let spawnChild = (mode, envExtra = {}) => {
    let env = baseEnv()
    env.WM309_MODE = mode
    Object.assign(env, envExtra)
    let child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_CODE], { cwd: projRoot, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let h = { child, out: '', err: '', exited: false }
    child.stdin.on('error', () => {}) //info 模式之子行程印完即結束, 其後寫入 stdin 會 EPIPE(競態; 無須處理)
    child.stdout.on('data', (d) => {
        h.out += d
    })
    child.stderr.on('data', (d) => {
        h.err += d
    })
    child.once('exit', () => {
        h.exited = true
    })
    live.push(h)
    return h
}

//取子行程某行輸出之 JSON(RESULT／START)
let waitJson = async (h, tag, limitMs = 90000) => {
    let re = new RegExp(`${tag} (.*)`)
    await waitUntil(() => re.test(h.out) || h.exited, limitMs, `子行程輸出 ${tag}(stderr: ${h.err.slice(-600)})`)
    let m = re.exec(h.out)
    A.ok(m, `子行程須輸出 ${tag}(stdout: ${h.out.slice(-400)} stderr: ${h.err.slice(-600)})`)
    return JSON.parse(m[1])
}

let finishChild = async (h) => {
    if (!h.exited) {
        try {
            h.child.stdin.write('go\n')
            h.child.stdin.end()
        }
        catch (err) { /* 已結束 */ }
    }
    await waitUntil(() => h.exited, 30000, '子行程結束')
}

//以真實 http 監聽占用一個埠(node 預設之雙棧位址); 記錄收到之 HTTP 請求數
let occupy = (port) => new Promise((resolve, reject) => {
    let hits = 0
    let server = http.createServer((req, res) => {
        hits++
        res.end('occupied')
    })
    server.once('error', reject)
    server.listen(port, () => {
        let o = { port, own: true, hits: () => hits, close: () => new Promise((r) => server.close(r)) }
        occupants.push(o)
        resolve(o)
    })
})

//埠是否仍在監聽(以 TCP 連線檢查, 不送 HTTP)
let isListening = (port) => new Promise((resolve) => {
    let s = net.connect({ host: '127.0.0.1', port })
    s.once('connect', () => {
        s.destroy()
        resolve(true)
    })
    s.once('error', () => resolve(false))
})

//使該埠處於「被占用」: 占得到就以真實 http 監聽占用(own=true, 可驗占用者沒被打到); 該埠已被他人占用(如全套同一 mocha 行程內 e2e 之 dev server 正占著 8123)
//  則視為已被占用(own=false), 不重複占。使占用情境在單檔跑與全套皆能成立, 不因環境而整批 skip。
let holdBusy = async (port) => {
    try {
        return await occupy(port)
    }
    catch (err) {
        if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
            throw err
        }
        return { port, own: false, hits: () => 0, close: async () => {} }
    }
}

//埠是否空閒(同套件偵測: 四個位址皆可綁定; 該位址族不存在視為可綁)
let isFree = async (port) => {
    for (let host of ['127.0.0.1', '0.0.0.0', '::', '::1']) {
        let ok = await new Promise((resolve) => {
            let s = net.createServer()
            s.once('error', (err) => resolve(err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL'))
            s.listen(port, host, () => s.close(() => resolve(true)))
        })
        if (!ok) {
            return false
        }
    }
    return true
}

//等埠釋放(輪詢至四個位址皆可綁定, 上限 limitMs; 行程結束後作業系統釋放監聽埠略有延遲, 以可觀察之條件同步)
let waitFree = async (port, limitMs = 15000) => {
    let t0 = Date.now()
    while (!(await isFree(port))) {
        if (Date.now() - t0 > limitMs) {
            return false
        }
        await sleep(100)
    }
    return true
}

//依「由小到大逐一試位移 from、from+100…, 基準埠＋位移空閒之第一個」算出期望位移(與當下環境無關: 他人占用者、本行程之 dev server、本測試之占用者皆計入)
let firstFreeOffset = async (from = 0) => {
    for (let off = from; off < 2000; off += STEP) {
        if (!OTHER_TEST_PORTS.includes(FRONTEND_PORT + off) && (await isFree(FRONTEND_PORT + off))) {
            return off
        }
    }
    throw new Error('找不到空閒之位移')
}

//程式碼文字(去除 // 與 /* */ 註解; 區塊註解只認行首或空白後之 /*, 免把字串中之 '/**' 當註解起點; 行尾 // 前一字元為 : 引號 反引號 反斜線者視為字串內容不剝)
let stripComments = (src) => src.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`\\])\/\/.*$/gm, '$1')

//test/ 下全部 .mjs(不含本檔; _tmp、fixtures 除外)
let listTestFiles = () => {
    let out = []
    let walk = (d) => {
        for (let e of fs.readdirSync(d, { withFileTypes: true })) {
            let fp = path.join(d, e.name)
            if (e.isDirectory()) {
                if (e.name !== '_tmp' && e.name !== 'fixtures') {
                    walk(fp)
                }
            }
            else if (e.name.endsWith('.mjs') && e.name !== SELF) {
                out.push(fp)
            }
        }
    }
    walk(fdTest)
    return out
}

let rel = (fp) => path.relative(fdTest, fp).replace(/\\/g, '/')

describe('unit-e2ePortReserve', function() {
    this.timeout(180000)

    before(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
        fs.mkdirSync(fdReg, { recursive: true })
        fs.writeFileSync(path.join(fdTmp, 'vue-cli-service.mjs'), FAKE_DEV_CODE)
        fs.writeFileSync(path.join(fdTmp, 'foreign-listener.mjs'), FAKE_DEV_CODE) //同一段監聽碼, 檔名不含 vue-cli-service: 命令列不是 vue-cli-service 之監聽者
        fs.writeFileSync(path.join(fdTmp, 'exit-stub.mjs'), EXIT_STUB_CODE)
        //假的 taskkill(置於子行程 PATH 最前): 只記錄被呼叫時之參數, 不殺任何行程; 供驗證「已結束之自建行程不下殺」
        fs.mkdirSync(fdFakeBin, { recursive: true })
        fs.writeFileSync(path.join(fdFakeBin, 'taskkill.cmd'), '@echo %*>>"%WM309_KILL_LOG%"\r\n')
    })

    after(async function() {
        for (let h of live) {
            if (!h.exited) {
                //行程樹一併收(替身 dev server 為子行程之子行程, 只殺子行程會殘留); 只殺本檔自己 spawn 者
                try {
                    if (process.platform === 'win32') {
                        spawnSync('taskkill', ['/F', '/T', '/PID', String(h.child.pid)], { stdio: 'ignore', windowsHide: true })
                    }
                    else {
                        h.child.kill()
                    }
                }
                catch (err) { /* 已結束 */ }
                await waitDead(h.child.pid)
            }
        }
        for (let o of occupants) {
            await o.close().catch(() => {})
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
        assert.ok(!fs.existsSync(fdTmp), '測試專用夾須已刪除')
        try {
            fs.rmdirSync(path.dirname(fdTmp)) //test/_tmp 若為本測試建立且已空則一併移除(非空則保留, 其他測試之臨時夾不動)
        }
        catch (err) { /* 非空或不存在 */ }
    })

    describe('自動換埠([E1][E2][E3])', function() {
        it('PR-001 沒有占用時即基準埠、E2E_PORT_OFFSET 維持未設; 當下有占用者(他人或本行程之 dev server)則取首個空閒位移(期望動態算出)', async function() {
            //spec 句: 沒有占用時埠與行為不變(基準埠 8123, 位移環境變數未設); 否則整組位移
            let expectOff = await firstFreeOffset()
            let h = spawnChild('info')
            let r = await waitJson(h, 'RESULT')
            await finishChild(h)
            A.equal(r.source, 'auto')
            A.equal(r.offset, expectOff)
            A.deepEqual(r.ports, [FRONTEND_PORT + expectOff])
            A.equal(r.PORT, FRONTEND_PORT + expectOff)
            A.equal(r.baseUrl, `http://127.0.0.1:${FRONTEND_PORT + expectOff}`)
            A.equal(r.env, expectOff === 0 ? null : String(expectOff), '位移為 0 時 E2E_PORT_OFFSET 維持未設; 非 0 時為位移')
            A.ok(!OTHER_TEST_PORTS.includes(r.PORT), '實際埠不得落在其他測試寫死之埠上')
        })

        it('PR-002 基準埠被真實監聽者占用 → 整組位移, PORT／baseUrl 為位移後之實際埠, 占用者仍在監聽且沒有收到任何 HTTP 請求', async function() {
            //spec 句: 基準埠被占用且不是本實例, 自動換可用之埠; 絕不動占用者(E4)
            let occ = await holdBusy(FRONTEND_PORT)
            let expectOff = await firstFreeOffset()
            A.ok(expectOff >= STEP, '基準埠已被占用, 期望位移至少為一個間距')
            let h = spawnChild('info')
            let r = await waitJson(h, 'RESULT')
            await finishChild(h)
            A.equal(r.source, 'auto')
            A.equal(r.offset, expectOff)
            A.equal(r.PORT, FRONTEND_PORT + expectOff)
            A.equal(r.baseUrl, `http://127.0.0.1:${FRONTEND_PORT + expectOff}`)
            A.equal(r.env, String(expectOff))
            A.equal(occ.hits(), 0, '占用者不得收到任何 HTTP 請求(自己占得到時才可驗; 他人占用者以 PR-004／PR-005 之真實占用者驗)')
            A.ok(await isListening(FRONTEND_PORT), '占用者仍在監聽')
            await occ.close()
        })

        it('PR-003 兩個同時開跑之行程(同一登錄目錄)不會選到同一組埠', async function() {
            //spec 句: 多套件同跑時不互撞; 偵測與綁定之間有時間差, 以預約排他
            let a = spawnChild('hold')
            let ra = await waitJson(a, 'RESULT')
            let b = spawnChild('info')
            let rb = await waitJson(b, 'RESULT')
            await finishChild(b)
            await finishChild(a)
            A.equal(ra.source, 'auto')
            A.equal(rb.source, 'auto')
            A.notEqual(ra.PORT, rb.PORT, '兩行程不得取得同一埠')
            A.ok(rb.offset > ra.offset, `後到者須位移更遠(a=${ra.offset}, b=${rb.offset})`)
        })
    })

    describe('startServer 不沿用占用者([E4][E5])', function() {
        it('PR-004 自動換埠: 保留後埠上出現他人之監聽者 → 拋錯寫明占用者, 不沿用、不下殺、占用者沒有收到任何 HTTP 請求', async function() {
            //spec 句: 偵測與綁定之間被搶走要停止並寫明誰占用(E5); 絕不殺占用者(E4)。導入前: 埠通即沿用(打到別人的服務)
            let h = spawnChild('start')
            let r = await waitJson(h, 'RESULT')
            A.equal(r.source, 'auto')
            let occ = await occupy(r.PORT) //保留後才占走(模擬偵測與綁定之間被未導入者搶走)
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            await finishChild(h)
            A.equal(s.ok, false, '埠被他人占用時不得沿用')
            A.ok(s.message.includes(`埠 ${r.PORT} 於保留後被他人占用`), s.message)
            //占用者 PID 取自監聽表; 機器負載高致查詢逾時(重試後仍失敗)時訊息明寫「占用者不明」(寧可明說不明, 不假裝無人), 亦屬合格
            A.ok(s.message.includes(String(process.pid)) || s.message.includes('占用者不明'), `訊息須寫明占用者 PID(本行程 ${process.pid})或明說占用者不明: ${s.message}`)
            A.ok(s.message.includes('不沿用、不下殺'), s.message)
            A.equal(occ.hits(), 0, '占用者不得收到任何 HTTP 請求(連線檢查只做 TCP 連線)')
            A.ok(await isListening(r.PORT), '占用者仍在監聽')
            await occ.close()
        })

        it('PR-005 手動鎖埠(E2E_PORT_OFFSET 已設)且占用者非本專案之 vue-cli-service → 拒絕沿用、不下殺、占用者沒有收到任何 HTTP 請求', async function() {
            //spec 句: 占用者可能是別的套件正在跑之測試, 絕不沿用也不殺。導入前: 埠通即沿用, 不問身分
            let off = await firstFreeOffset() //期望動態: 取當下空閒之位移(可為 0＝逃生口形式)
            let occ = await occupy(FRONTEND_PORT + off)
            let h = spawnChild('start', { E2E_PORT_OFFSET: String(off) })
            let r = await waitJson(h, 'RESULT')
            A.equal(r.source, 'pinned')
            A.equal(r.PORT, FRONTEND_PORT + off)
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            await finishChild(h)
            A.equal(s.ok, false, '占用者非本專案之 vue-cli-service 時不得沿用')
            A.ok(s.message.includes('不是本專案之 vue-cli-service'), s.message)
            A.ok(s.message.includes('非本專案之 vue-cli-service'), `拒絕之原因須為身分判定「非本專案之 vue-cli-service」(而非查詢失敗): ${s.message}`)
            A.ok(s.message.includes('不沿用、不下殺'), s.message)
            A.equal(occ.hits(), 0, '占用者不得收到任何 HTTP 請求')
            A.ok(await isListening(FRONTEND_PORT + off), '占用者仍在監聽')
            await occ.close()
        })

        it('PR-006 手動鎖埠且占用者確為本專案之 vue-cli-service(真實行程) → 沿用(不 spawn、不殺), 占用者仍在且沒有收到任何 HTTP 請求', async function() {
            //spec 句: 常駐 dev server 沿用(逃生口)須確認身分; 沿用即不 spawn 也不負責關
            let off = await firstFreeOffset()
            let port = FRONTEND_PORT + off
            let fpLog = path.join(fdTmp, `fake-${port}.log`)
            let fake = spawn(process.execPath, [path.join(fdTmp, 'vue-cli-service.mjs'), String(port), fpLog], { cwd: projRoot, windowsHide: true, stdio: 'ignore' })
            live.push({ child: fake, out: '', err: '', exited: false })
            fake.once('exit', () => {
                live.find((x) => x.child === fake).exited = true
            })
            await waitUntil(() => fs.existsSync(fpLog) && fs.readFileSync(fpLog, 'utf8').includes('listening'), 20000, '假 dev server 開始監聽')
            let h = spawnChild('start', { E2E_PORT_OFFSET: String(off) })
            let r = await waitJson(h, 'RESULT')
            A.equal(r.source, 'pinned')
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            await finishChild(h)
            A.equal(s.ok, true, `本專案之 vue-cli-service 占用手動鎖定之埠時可沿用(實得 ${JSON.stringify(s)})`)
            A.ok(alive(fake.pid), '沿用者不得被殺')
            A.equal((fs.readFileSync(fpLog, 'utf8').match(/^hit /gm) || []).length, 0, '沿用前之身分確認不得送 HTTP 請求')
            fake.kill()
            A.ok(await waitDead(fake.pid), '假 dev server 須已結束')
        })
    })

    describe('startServer spawn 後之身分確認(替身行程; opts.spawnFn)', function() {
        it('PR-012a spawn 後埠上的監聽者不是本專案之 vue-cli-service(例: vue-cli 之 portfinder 因埠被占走而改埠, 占走者在原埠) → 拋錯並收掉自己 spawn 之行程, 不放行', async function() {
            //spec 句: 偵測與綁定之間被搶走要停止並寫明誰占用(E5); 不連到別人的服務。替身以「命令列非 vue-cli-service 之監聽者」代表該情形
            let fpLog = path.join(fdTmp, 'foreign-after-spawn.log')
            //子行程於回報 START 後續留(WM309_HOLD_AFTER): 在其結尾之 stopServer 之前確認替身已死, 證明是 startServer 失敗路徑自己收掉的
            let h = spawnChild('start', { WM309_SPAWN: path.join(fdTmp, 'foreign-listener.mjs'), WM309_LOG: fpLog, WM309_VERIFY_MS: '3000', WM309_HOLD_AFTER: '1' })
            await waitJson(h, 'RESULT')
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            A.equal(s.ok, false, 'spawn 後埠上的監聽者非本專案之 vue-cli-service 時不得放行')
            A.ok(s.message.includes('不是本專案之 vue-cli-service') && s.message.includes('埠於啟動期間被他人占用'), s.message)
            A.ok(s.message.includes('非本專案之 vue-cli-service'), `拒絕之原因須為身分判定「非本專案之 vue-cli-service」(而非查詢失敗): ${s.message}`)
            let pid = Number(/pid=(\d+)/.exec(fs.readFileSync(fpLog, 'utf8'))[1])
            A.ok(await waitDead(pid), '失敗時須由 startServer 收掉自己 spawn 之行程(子行程此時尚未結束, 排除結尾 stopServer 之功)')
            await finishChild(h)
        })

        it('PR-012c 自己 spawn 之行程已結束時不下殺(其 PID 可能已被作業系統回收給無關行程); 仍存活時才下殺(對照組, 以假 taskkill 記錄呼叫)', async function() {
            //spec 句: 下殺邏輯只動本實例(規格 §5-3)。假 taskkill 置於子行程 PATH 最前(只記錄參數, 不殺任何行程); 先以仍存活之替身確認假 taskkill 確實攔得到呼叫(對照組), 再驗已結束者不呼叫
            let pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH' //Windows 之鍵為 Path: 只設既有那一個鍵, 免得環境區出現大小寫不同之兩個 PATH
            let pathEnv = `${fdFakeBin}${path.delimiter}${process.env[pathKey] || ''}`
            //對照組: 替身仍存活(foreign-listener 監聽中) → 失敗路徑 stopServer 須呼叫 taskkill /F /T /PID <其 PID>
            let fpKill1 = path.join(fdTmp, 'kill-alive.log')
            let fpLog1 = path.join(fdTmp, 'alive-stub.log')
            let h1 = spawnChild('start', { WM309_SPAWN: path.join(fdTmp, 'foreign-listener.mjs'), WM309_LOG: fpLog1, WM309_VERIFY_MS: '3000', WM309_KILL_LOG: fpKill1, [pathKey]: pathEnv })
            await waitJson(h1, 'RESULT')
            h1.child.stdin.write('go\n')
            let s1 = await waitJson(h1, 'START')
            A.equal(s1.ok, false, s1.message)
            let alivePid = Number(/pid=(\d+)/.exec(fs.readFileSync(fpLog1, 'utf8'))[1])
            await waitUntil(() => fs.existsSync(fpKill1), 30000, '假 taskkill 之呼叫記錄(對照組)')
            A.ok(new RegExp(`/F /T /PID ${alivePid}\\b`).test(fs.readFileSync(fpKill1, 'utf8')), `仍存活之自建行程須被下殺(實得 ${fs.readFileSync(fpKill1, 'utf8').trim()})`)
            spawnSync('taskkill', ['/F', '/T', '/PID', String(alivePid)], { stdio: 'ignore', windowsHide: true }) //假 taskkill 沒殺, 由本測試收掉自己造的替身(其 stdout 管線未關, 子行程在此之前無法結束)
            A.ok(await waitDead(alivePid))
            await finishChild(h1)
            //實驗組: 替身印出就緒字樣後立即結束 → 身分確認失敗(埠上無人監聽)→ stopServer 見行程已結束, 不得呼叫 taskkill
            let fpKill2 = path.join(fdTmp, 'kill-exited.log')
            let h2 = spawnChild('start', { WM309_SPAWN: path.join(fdTmp, 'exit-stub.mjs'), WM309_LOG: path.join(fdTmp, 'exit-stub.log'), WM309_VERIFY_MS: '3000', WM309_KILL_LOG: fpKill2, [pathKey]: pathEnv })
            await waitJson(h2, 'RESULT')
            h2.child.stdin.write('go\n')
            let s2 = await waitJson(h2, 'START')
            await finishChild(h2)
            A.equal(s2.ok, false, '埠上無人監聽時不得放行')
            A.ok(s2.message.includes('不是本專案之 vue-cli-service'), s2.message)
            A.ok(!fs.existsSync(fpKill2), `已結束之自建行程不得下殺(假 taskkill 被呼叫: ${fs.existsSync(fpKill2) ? fs.readFileSync(fpKill2, 'utf8').trim() : ''})`)
        })

        it('PR-012b spawn 後埠上的監聽者確為本專案之 vue-cli-service → 放行, 並把本實例之服務行程記入預約檔(noteOwn); 結束時 stopServer 收掉自己 spawn 之行程', async function() {
            //spec 句: 服務就緒後記下本實例之行程, 供下次開跑依身分清除殘留(預約殘留回收); 離場只殺自己 spawn 的
            let fpLog = path.join(fdTmp, 'own-after-spawn.log')
            let h = spawnChild('start', { WM309_SPAWN: path.join(fdTmp, 'vue-cli-service.mjs'), WM309_LOG: fpLog, WM309_HOLD_AFTER: '1' })
            let r = await waitJson(h, 'RESULT')
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            A.equal(s.ok, true, `替身確為本專案之 vue-cli-service 時須放行(實得 ${JSON.stringify(s)})`)
            let pid = Number(/pid=(\d+)/.exec(fs.readFileSync(fpLog, 'utf8'))[1])
            let fpRes = path.join(fdReg, `p${r.PORT}.json`)
            await waitUntil(() => {
                try {
                    return JSON.parse(fs.readFileSync(fpRes, 'utf8')).known.some((k) => k.pid === pid)
                }
                catch (err) {
                    return false
                }
            }, 120000, `預約檔 ${fpRes} 之 known 記有服務行程 PID ${pid}`) //noteOwn 在背景以 PowerShell 取行程表: 機器負載高(全套＋他套件同跑)時可超過 30 秒(2026-11-05 全套中實測逾時一次); 以條件同步, 上限只防懸置
            await finishChild(h)
            A.ok(await waitDead(pid), '結束時 stopServer 須收掉自己 spawn 之行程')
        })
    })

    describe('離場備援(process.exit 路徑)', function() {
        it('PR-013 行程不經 stopServer 直接 process.exit(mocha --exit／Ctrl+C 之備援路徑) → 自己 spawn 的 dev server 仍被同步收掉, 不殘留', async function() {
            //spec 句: 離場只殺自己 spawn 的; 殘留之 dev server 會占住埠——導入自動換埠後不再被「埠通即沿用」掩蓋, 每次殘留都多占一組埠(上限 20 組後 E2E_PORT_EXHAUSTED)。
            //  exit 事件處理器內之非同步 spawn 不會被等待(process.exit 放棄 event loop 內工作), 故備援須同步下殺
            let fpLog = path.join(fdTmp, 'exit-path.log')
            //替身經 shell 啟動(行程鏈 cmd.exe → node): 實測(2026-11-05)真實 npx vue-cli-service 於 process.exit／SIGINT 路徑會殘留(非同步 spawn taskkill 不被等待)
            let h = spawnChild('start', { WM309_SPAWN: path.join(fdTmp, 'vue-cli-service.mjs'), WM309_LOG: fpLog, WM309_EXIT_MODE: 'exit', WM309_SPAWN_SHELL: '1' })
            await waitJson(h, 'RESULT')
            h.child.stdin.write('go\n')
            let s = await waitJson(h, 'START')
            A.equal(s.ok, true, `替身確為本專案之 vue-cli-service 時須放行(實得 ${JSON.stringify(s)})`)
            let pid = Number(/pid=(\d+)/.exec(fs.readFileSync(fpLog, 'utf8'))[1])
            await waitUntil(() => h.exited, 30000, '子行程 process.exit 結束')
            A.ok(await waitDead(pid), `子行程以 process.exit 結束後, 自己 spawn 的 dev server(PID ${pid})須已被收掉`)
        })
    })

    describe('judgeOwnDevServer／describeListeners(身分確認; 預設拒絕)', function() {
        it('PR-007 真實行程: 本專案之 vue-cli-service → ok; 換另一個根 → 不 ok; 非 vue-cli-service 之監聽者 → 不 ok; 無人監聽 → 不 ok', async function() {
            //spec 句: 沿用或下殺前須正面確認是本實例(E4); 命令列取自真實行程(路徑含非 ASCII「開源」, 驗 UTF-8 往返)
            let off = await firstFreeOffset()
            let port = FRONTEND_PORT + off
            let fpLog = path.join(fdTmp, `fake-j${port}.log`)
            let fake = spawn(process.execPath, [path.join(fdTmp, 'vue-cli-service.mjs'), String(port), fpLog], { cwd: projRoot, windowsHide: true, stdio: 'ignore' })
            live.push({ child: fake, out: '', err: '', exited: false })
            fake.once('exit', () => {
                live.find((x) => x.child === fake).exited = true
            })
            await waitUntil(() => fs.existsSync(fpLog) && fs.readFileSync(fpLog, 'utf8').includes('listening'), 20000, '假 dev server 開始監聽')
            //身分查詢(監聽表、PowerShell)在機器負載高時可能逾時而回「查不到」(預設拒絕, 屬被測碼之正確行為); 本案要驗的是身分「判定」, 故只對「查詢失敗」重試(最多 5 輪, 每輪內已重試 3 次),
            //  判定結果本身(ok／原因)不重試——判定錯了仍一次即紅。「查不到」之預設拒絕由 PR-008 以注入驗(與環境無關)
            let judgeSettled = (p, o) => {
                let j = judgeOwnDevServer(p, o)
                for (let i = 0; i < 4 && j.reason.startsWith('查不到'); i++) {
                    j = judgeOwnDevServer(p, o)
                }
                return j
            }
            let own = judgeSettled(port)
            A.equal(own.ok, true, `本專案根內之 vue-cli-service 須判為本實例(實得 ${JSON.stringify(own)})`)
            A.deepEqual(own.listeners.map((l) => l.pid), [fake.pid])
            A.ok(own.listeners[0].cmd.includes('vue-cli-service.mjs'), own.listeners[0].cmd)
            let other = judgeOwnDevServer(port, { root: path.join(path.parse(projRoot).root, 'definitely-not-this-project') })
            A.equal(other.ok, false, '專案根不同者不得判為本實例')
            fake.kill()
            A.ok(await waitDead(fake.pid))
            A.ok(await waitFree(port), '假 dev server 結束後埠須釋放')
            //非 vue-cli-service 之監聽者(本行程之 http 伺服器; 命令列為 mocha)
            let occ = await occupy(port)
            let foreign = judgeSettled(port)
            A.equal(foreign.ok, false, '命令列不含 vue-cli-service 者不得判為本實例')
            A.ok(foreign.reason.includes('非本專案之 vue-cli-service'), foreign.reason)
            A.deepEqual(foreign.listeners.map((l) => l.pid), [process.pid])
            await occ.close()
            //無人監聽: 查得到則為「無人監聽」(describeListeners 回 []); 查詢逾時則為「查不到」(null)——兩者都不得判為本實例(預設拒絕), 不得為了等於 [] 而在負載高時假紅
            let none = judgeSettled(port)
            A.equal(none.ok, false)
            A.ok(none.reason === '無人監聽' || none.reason.startsWith('查不到'), none.reason)
            let ls = describeListeners(port)
            A.ok(ls === null || (Array.isArray(ls) && ls.length === 0), `無人監聽時 describeListeners 只可回 [] 或 null(實得 ${JSON.stringify(ls)})`)
            A.equal(occ.hits(), 0, '身分確認不得送 HTTP 請求')
        })

        it('PR-008 注入: 查詢失敗(null)、無人監聽、他人、混合、前綴相近之他專案根 → 皆不 ok; 只有全部為本專案之 vue-cli-service 才 ok', function() {
            //spec 句: 取不到監聽表不沿用(預設拒絕, 查詢失敗與無人要分開)
            let root = 'C:\\proj\\w-maplibregl-vue'
            let own = { pid: 11, cmd: '"node"  "C:\\proj\\w-maplibregl-vue\\node_modules\\.bin\\..\\@vue\\cli-service\\bin\\vue-cli-service.js" serve --port 8123' }
            let foreign = { pid: 22, cmd: '"node"  "C:\\other\\w-xxx\\node_modules\\@vue\\cli-service\\bin\\vue-cli-service.js" serve --port 8123' }
            let sibling = { pid: 33, cmd: '"node"  "C:\\proj\\w-maplibregl-vue-copy\\node_modules\\@vue\\cli-service\\bin\\vue-cli-service.js" serve --port 8123' }
            let notVue = { pid: 44, cmd: '"node"  "C:\\proj\\w-maplibregl-vue\\srv.mjs"' }
            //命令列任一處出現 vue-cli-service 字串(如 mocha 之 --grep 參數)但腳本本身不是 vue-cli-service
            let grepVue = { pid: 55, cmd: '"node"  "C:\\proj\\w-maplibregl-vue\\node_modules\\mocha\\bin\\mocha.js" --grep vue-cli-service' }
            let j = (ls) => judgeOwnDevServer(8123, { root, describe: () => ls })
            A.equal(j(null).ok, false, '查詢失敗不得視為本實例')
            A.equal(j([]).ok, false, '無人監聽不得視為本實例')
            A.equal(j([foreign]).ok, false)
            A.equal(j([sibling]).ok, false, '根路徑後須接分隔字元, 前綴相近之他專案不命中')
            A.equal(j([notVue]).ok, false, '同專案根但非 vue-cli-service 不命中')
            A.equal(j([grepVue]).ok, false, 'vue-cli-service 只是參數字串(非腳本路徑)不命中')
            A.equal(j([own, foreign]).ok, false, '任一監聽者非本實例即不 ok')
            A.equal(j([own]).ok, true)
            A.equal(judgeOwnDevServer(8123, { root: root.toLowerCase() + '\\', describe: () => [own] }).ok, true, '大小寫與結尾分隔字元不影響')
        })
    })

    describe('原始碼守護([E4][E8])', function() {
        it('PR-009 test/ 內之下殺站點全集固定(只殺自己 spawn 之子行程), 無依埠或依名稱下殺', function() {
            //spec 句: 下殺邏輯只動本實例(規格 §5-3); 新增下殺站點即紅, 逼出逐處審查
            let re = /killPortListeners|taskkill|Stop-Process|process\.kill\(|\.kill\(|wmic|netstat|execProcessKill/
            let sites = []
            for (let fp of listTestFiles()) {
                let code = stripComments(fs.readFileSync(fp, 'utf8')).split(/\r?\n/)
                code.forEach((line) => {
                    if (re.test(line)) {
                        sites.push(`${rel(fp)}: ${line.trim()}`)
                    }
                })
            }
            let expect = [
                "tools/e2e-setup.mjs: if (process.platform === 'win32') spawnSync(`taskkill /F /T /PID ${pid}`, { shell: true, stdio: 'ignore', windowsHide: true })",
                "tools/e2e-setup.mjs: else process.kill(-pid, 'SIGKILL')",
                'tools/toolgCopy.mjs: p.kill()',
            ]
            A.deepEqual(sites.sort(), expect.sort(), '下殺站點全集須為已審查之三處(其 PID 皆取自本測試自己 spawn 之子行程)')
            //e2e-setup 之 pid 取自本實例 spawn 之 serverProc; 無依埠下殺
            let setup = stripComments(fs.readFileSync(path.join(fdTest, 'tools', 'e2e-setup.mjs'), 'utf8'))
            A.ok(/let pid = serverProc\.pid/.test(setup), 'stopServer 須只殺 serverProc.pid(自己 spawn 之 dev server 行程樹)')
            A.ok(!/killPortListeners|killOwnListeners|listenerPids\([^)]*\)\.(forEach|map)/.test(setup), 'e2e-setup 不得依埠下殺')
            //toolgCopy 之 p 為其自己 spawn 之子行程
            let tc = stripComments(fs.readFileSync(path.join(fdTest, 'tools', 'toolgCopy.mjs'), 'utf8'))
            A.ok(/let p = spawn\(|const p = spawn\(|p = spawn\(/.test(tc), 'toolgCopy 之 p 須為自己 spawn 之子行程')
        })

        it('PR-010 測試碼無寫死之 host:埠 網址(唯一例外 e2e-fileprotocol 之虛擬來源); 基準埠字面站點只在 e2ePorts.mjs; OTHER_TEST_PORTS 與實際寫死之埠一致', function() {
            //spec 句: 寫死之網址與埠改由解析後之值衍生(規格 §5-1); 非 e2e 測試寫死之埠須與他套件錯開(E8)
            let reHost = /(?:localhost|127\.0\.0\.1):(\d+)/g
            let found = {} //檔 → 埠[]
            for (let fp of listTestFiles()) {
                let name = rel(fp)
                if (!(/^e2e-.*\.test\.mjs$/.test(name) || /^api-.*\.test\.mjs$/.test(name) || /^tools\//.test(name))) {
                    continue //unit-* 之字串資料不連線(unit-workerClassic 之 8080／8195 為純函式輸入)
                }
                let code = stripComments(fs.readFileSync(fp, 'utf8'))
                for (let m of code.matchAll(reHost)) {
                    ;(found[name] = found[name] || []).push(Number(m[1]))
                }
            }
            A.deepEqual(Object.keys(found), ['e2e-fileprotocol.test.mjs'], `寫死 host:埠 之站點只可為虛擬來源(實得 ${JSON.stringify(found)})`)
            A.deepEqual([...new Set(found['e2e-fileprotocol.test.mjs'])].sort(), [...OTHER_TEST_PORTS].sort(), '虛擬來源之埠須與 OTHER_TEST_PORTS 一致(新增忘了列、或列了已不存在者即紅)')
            //e2e-fileprotocol 之 ORIGIN 為 context.route 攔截供應之虛擬來源(不開 port)
            let fpTest = stripComments(fs.readFileSync(path.join(fdTest, 'e2e-fileprotocol.test.mjs'), 'utf8'))
            A.ok(/ctx\.route\(`\$\{ORIGIN\}\/\*\*`/.test(fpTest), '虛擬來源須由 context.route 攔截供應')
            //基準埠字面站點
            let sites = []
            for (let fp of listTestFiles()) {
                let code = stripComments(fs.readFileSync(fp, 'utf8'))
                if (new RegExp(`\\b${FRONTEND_PORT}\\b`).test(code)) {
                    sites.push(rel(fp))
                }
            }
            A.deepEqual(sites, ['tools/e2ePorts.mjs'], '基準埠字面只可在 e2ePorts.mjs(其餘一律經 resolveE2ePort／PORT／baseUrl)')
            //本套件不得有以字面埠開真實監聽之測試(規格 E8)
            let listens = []
            for (let fp of listTestFiles()) {
                let code = stripComments(fs.readFileSync(fp, 'utf8'))
                if (/\.listen\(\s*\d/.test(code)) {
                    listens.push(rel(fp))
                }
            }
            A.deepEqual(listens, [], '測試不得以字面埠開真實監聽')
            //src/ 內之基準埠字面: 已知兩處範例頁之 TileJSON 圖磚網址字串(bounds 在視野外、視圖內零請求, 不連線; 規則帳本 R19 要求 7, 產品側本輪不改)。新增第三處即紅
            let srcSites = []
            let walkSrc = (d) => {
                for (let e of fs.readdirSync(d, { withFileTypes: true })) {
                    let fp = path.join(d, e.name)
                    if (e.isDirectory()) {
                        walkSrc(fp)
                    }
                    else if (/\.(vue|mjs|js)$/.test(e.name) && e.name !== 'maplibreWorkerInline.mjs') {
                        if (new RegExp(`\\b${FRONTEND_PORT}\\b`).test(fs.readFileSync(fp, 'utf8'))) {
                            srcSites.push(e.name)
                        }
                    }
                }
            }
            walkSrc(path.join(projRoot, 'src'))
            A.deepEqual(srcSites.sort(), ['AppBSCRuntimeSync.vue', 'AppPBMOpacity.vue'], 'src/ 內之基準埠字面只可為已審查之兩處(範例頁 TileJSON 圖磚網址字串)')
        })

        it('PR-011 接線: e2ePorts 將 OTHER_TEST_PORTS 交給 avoid、e2e-setup 以 resolveE2ePort(FRONTEND_PORT) 取埠並以實際埠啟動 vue-cli-service', function() {
            //spec 句: 前端以實際埠啟動(vue-cli-service serve --port <實際埠>, 否則其 portfinder 會靜默改埠); 導入前指令列為 --port 8123, 未位移時不變
            let ports = stripComments(fs.readFileSync(path.join(fdTest, 'tools', 'e2ePorts.mjs'), 'utf8'))
            A.ok(/reserveE2ePorts\(\[FRONTEND_PORT\], \{ avoid: OTHER_TEST_PORTS \}\)/.test(ports), 'reserveE2ePorts 須宣告本實例全部基準埠並帶 avoid')
            let setup = stripComments(fs.readFileSync(path.join(fdTest, 'tools', 'e2e-setup.mjs'), 'utf8'))
            A.ok(/export const PORT = resolveE2ePort\(FRONTEND_PORT\)/.test(setup))
            A.ok(/export const baseUrl = `http:\/\/127\.0\.0\.1:\$\{PORT\}`/.test(setup))
            A.ok(/spawn\('npx', \['vue-cli-service', 'serve', '--port', String\(PORT\)\]/.test(setup), 'vue-cli-service 須以實際埠啟動')
            //e2e-setup 須自 e2ePorts 匯入(其模組頂層先 reserveE2ePorts, 早於 resolveE2ePort)
            A.ok(/from '\.\/e2ePorts\.mjs'/.test(setup))
            //沿用須先確認身分: startServer 內不得有「埠通即 return」之路徑
            let start = setup.slice(setup.indexOf('export async function startServer'), setup.indexOf('function spawnServer'))
            A.ok(/reservation\.source === 'auto'/.test(start) && /judgeOwnDevServer\(PORT\)/.test(start), 'startServer 沿用前須依保留來源與身分確認把關')
            A.ok(!/ping\(/.test(setup), '不得再有以 HTTP 請求探測的 ping(對他人之服務會留下請求)')
        })
    })
})
