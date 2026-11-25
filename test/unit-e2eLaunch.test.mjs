// 測試 e2e 啟動瀏覽器一律經 w-playwright(規則帳本 R20; 排程第 442 項; w-playwright 帳本 R-PW-ONLY／R-PW-WIRING)
//
// 背景: Chromium 系瀏覽器每啟動一個新根行程即可能觸發一次錯誤密碼登入紀錄(Windows, 累積達本機原則門檻即鎖帳號); w-playwright 於每次啟動合併出恰一串
//   `--disable-features`(Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者)。本套件 e2e 以 test/tools/e2eLaunch.mjs 為唯一啟動點,
//   其下一律走 `wpw.launchChromium`, 不直接依賴 playwright／playwright-core。
//
// 本檔不啟動任何瀏覽器(接線以 setBrowserTypeForTest 之替身接住, 在子行程內; 真路徑見 api-e2eLaunch)。
// 項目:
//   EL-01 R-PW-ONLY:  src／test／toolg 與根目錄設定檔不得匯入 playwright／playwright-core(靜態、動態、require)
//   EL-02 依賴:       package.json 不宣告 playwright／playwright-core; w-playwright 為 devDependencies(下限 1.0.1)、不入 dependencies; 已安裝版本相符
//   EL-03 站點全集:   e2e-*.test.mjs 皆經 ./tools/e2eLaunch.mjs 啟動、無任何直接 launch 呼叫、不再引用 w-package-tools-e2e 之 launchChromium; wpw.launchChromium( 只在 e2eLaunch.mjs 一處
//   EL-04 R-PW-WIRING: 啟動點送出之選項含守門(args 最後一個元素為合併之 --disable-features 且含 AutofillAiWalletPrivatePasses、全命令列恰一串),
//                    為 headless shell 之形態(無頭、不給通道與執行檔), 呼叫端自給之參數被保留; 替身確被呼叫(次數 1)
//   EL-03e/EL-06 取得瀏覽器(排程第 632 項): 每個 e2e 檔(及 api-e2eLaunch)之第一個 before 為「this.timeout(PW_INSTALL_BUDGET_MS + 60000) 後 await ensureE2eBrowser()」且早於啟動伺服器與瀏覽器;
//                    ensureE2eBrowser 同行程只做一次(失敗亦記憶)、以安裝預算為逾時、紀錄安裝與下載次數; 啟動不自動安裝(缺檔即 E_BROWSER_MISSING, 不產生下載)
// 跑法: node C:/opensrcOper/tools/quiet-run.mjs --name pm-mlv --lock -- npx mocha test/unit-e2eLaunch.test.mjs --timeout 180000
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { createEnsureE2eBrowser, PW_INSTALL_BUDGET_MS } from './tools/e2eLaunch.mjs'

const A = assert.strict
const fdTest = path.dirname(fileURLToPath(import.meta.url))
const projRoot = path.join(fdTest, '..')
const SELF = path.basename(fileURLToPath(import.meta.url))
const CHILD = path.join(fdTest, 'tools', 'e2eLaunchChild.mjs')
const PW = 'play' + 'wright' //以串接組字, 避免本檔原文被自己之盤點命中

//R-PW-ONLY 盤點用之正則(與 w-playwright 帳本同源)
const RE_IMPORT = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/

let rel = (fp) => path.relative(projRoot, fp).replace(/\\/g, '/')

//程式碼文字(去除 // 與 /* */ 註解; 規則同 unit-e2ePortReserve)
let stripComments = (src) => src.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`\\])\/\/.*$/gm, '$1')

//掃描範圍: src／test／toolg 下之自有 .mjs／.js／.cjs／.vue, 加根目錄之設定檔; 排除第三方、建置產物、暫存與測試資料夾
let walk = (dir, out) => {
    for (let e of fs.readdirSync(dir, { withFileTypes: true })) {
        let fp = path.join(dir, e.name)
        if (e.isDirectory()) {
            if (!['node_modules', 'dist', 'docs', 'tmp', 'testPending', '_tmp', 'fixtures', 'pics'].includes(e.name)) {
                walk(fp, out)
            }
        }
        else if (/\.(mjs|js|cjs|vue)$/.test(e.name)) {
            out.push(fp)
        }
    }
    return out
}
let listScanFiles = () => {
    let out = []
    for (let d of ['src', 'test', 'toolg']) {
        walk(path.join(projRoot, d), out)
    }
    for (let e of fs.readdirSync(projRoot, { withFileTypes: true })) {
        if (e.isFile() && /\.(mjs|js|cjs)$/.test(e.name)) {
            out.push(path.join(projRoot, e.name))
        }
    }
    return out
}

//e2e 測試檔全集(test/ 根層, 依前綴)
let listE2eFiles = () => {
    return fs.readdirSync(fdTest).filter((n) => /^e2e-.*\.test\.mjs$/.test(n)).sort()
}

let runChild = (mode) => {
    //子行程環境不帶 PWDEBUG／SELENIUM_*(w-playwright 一律拒絕之環境; 本檔測的是選項接線, 不是環境檢查)
    let env = { ...process.env }
    for (let k of ['PWDEBUG', 'SELENIUM_REMOTE_URL', 'SELENIUM_REMOTE_CAPABILITIES']) {
        delete env[k]
    }
    let r = spawnSync(process.execPath, [CHILD, mode], { cwd: projRoot, env, encoding: 'utf8', windowsHide: true, timeout: 100000 })
    let line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
    if (!line) {
        throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
    }
    return JSON.parse(line.slice('RESULT:'.length))
}

describe('unit-e2eLaunch', function() {
    this.timeout(180000)

    describe('EL-01 R-PW-ONLY: 自有碼不得直接匯入 playwright／playwright-core', function() {
        it('EL-01a 盤點正則對五種寫法皆命中、對 w-playwright 與近似名不命中(防空集合: 正負例)', function() {
            //spec 句: R-PW-ONLY 盤點正則(w-playwright 帳本)須有效, 否則 0 命中無意義
            let samples = [
                `import { chromium } from '${PW}'`,
                `import { chromium } from "${PW}-core"`,
                `let m = await import('${PW}')`,
                `let m = require("${PW}-core")`,
                `import x from '${PW}/lib/foo.js'`,
            ]
            for (let s of samples) {
                A.ok(RE_IMPORT.test(s), `應命中: ${s}`)
            }
            A.ok(!RE_IMPORT.test(`import wpw from 'w-${PW}'`), 'w-playwright 不應命中')
            A.ok(!RE_IMPORT.test(`import x from '${PW}x'`), '近似名不應命中')
        })

        it('EL-01b 掃描範圍非空(防空集合): 含 src 元件、toolg 腳本、test 啟動輔助、本檔與根目錄設定檔', function() {
            let rels = listScanFiles().map(rel)
            for (let r of ['src/components/WMaplibreglVue.vue', 'toolg/gDistRollupComps.mjs', 'test/tools/e2e-setup.mjs', `test/${SELF}`, 'vue.config.js']) {
                A.ok(rels.includes(r), `掃描範圍應含 ${r}`)
            }
            A.ok(rels.length > 40, `掃描檔數過少: ${rels.length}`)
        })

        it('EL-01c src／test／toolg 與根目錄設定檔匯入 playwright／playwright-core 者 0 處', function() {
            //spec 句: 全庫各自有套件之 .mjs／.js 不得以靜態或動態匯入、require 引用 playwright／playwright-core(只許 w-playwright 與 w-package-tools)
            let hits = []
            for (let fp of listScanFiles()) {
                fs.readFileSync(fp, 'utf8').split(/\r?\n/).forEach((ln, i) => {
                    if (RE_IMPORT.test(ln)) {
                        hits.push(`${rel(fp)}:${i + 1}: ${ln.trim().slice(0, 120)}`)
                    }
                })
            }
            A.deepEqual(hits, [])
        })
    })

    describe('EL-02 依賴宣告', function() {
        let pkg = JSON.parse(fs.readFileSync(path.join(projRoot, 'package.json'), 'utf8'))

        it('EL-02a package.json 不宣告 playwright／playwright-core(任一依賴類別)', function() {
            //spec 句: 各使用端 package.json 不得宣告 playwright／playwright-core(w-package-tools 除外)
            for (let k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
                let names = Object.keys(pkg[k] || {}).filter((n) => n === PW || n === PW + '-core')
                A.deepEqual(names, [], `${k} 不得含 ${PW}／${PW}-core`)
            }
        })

        it('EL-02b w-playwright 為 devDependencies(下限 1.0.1)且不入 dependencies(僅 e2e 測試使用, 不入 dist)', function() {
            let range = (pkg.devDependencies || {})['w-' + PW]
            A.equal(typeof range, 'string', 'devDependencies 須宣告 w-playwright')
            let m = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range)
            A.ok(m, `版本範圍須為 ^x.y.z(實得 ${range})`)
            let v = [Number(m[1]), Number(m[2]), Number(m[3])]
            let min = [1, 0, 1]
            let ok = v[0] > min[0] || (v[0] === min[0] && (v[1] > min[1] || (v[1] === min[1] && v[2] >= min[2])))
            A.ok(ok, `下限須 >= 1.0.1(實得 ${range})`)
            A.equal((pkg.dependencies || {})['w-' + PW], undefined, '不得列入 dependencies')
        })

        it('EL-02c 已安裝之 w-playwright 版本 >= 1.0.1, 其依賴之 playwright-core 以精確版號釘選(版本所有權在 w-playwright, 本庫不寫死哪一版)', function() {
            let inst = JSON.parse(fs.readFileSync(path.join(projRoot, 'node_modules', 'w-' + PW, 'package.json'), 'utf8'))
            let v = inst.version.split('.').map(Number)
            A.ok(v[0] > 1 || (v[0] === 1 && (v[1] > 0 || v[2] >= 1)), `已安裝版本 ${inst.version}`)
            A.ok(/^\d+\.\d+\.\d+$/.test(inst.dependencies[PW + '-core']), `須為精確版號(實得 ${inst.dependencies[PW + '-core']})`)
        })
    })

    describe('EL-03 啟動點站點全集', function() {
        it('EL-03a e2e 測試檔全集非空(防空集合)', function() {
            A.ok(listE2eFiles().length >= 9, `e2e 檔數 ${listE2eFiles().length}`)
        })

        it('EL-03b 每個 e2e 檔皆經 ./tools/e2eLaunch.mjs 之 launchE2eBrowser 啟動, 且無任何直接 launch 呼叫', function() {
            //spec 句: 多個啟動點先收斂為單一內部啟動點(R-PW-WIRING); 新增之 e2e 檔亦須遵守
            let bad = []
            for (let n of listE2eFiles()) {
                let code = stripComments(fs.readFileSync(path.join(fdTest, n), 'utf8'))
                if (!/import launchE2eBrowser, \{ ensureE2eBrowser, PW_INSTALL_BUDGET_MS \} from '\.\/tools\/e2eLaunch\.mjs'/.test(code)) {
                    bad.push(`${n}: 未匯入 ./tools/e2eLaunch.mjs 之 launchE2eBrowser、ensureE2eBrowser、PW_INSTALL_BUDGET_MS`)
                }
                if (!/await launchE2eBrowser\(\{ headless: true \}\)/.test(code)) {
                    bad.push(`${n}: 未以 launchE2eBrowser({ headless: true }) 啟動`)
                }
                if (/\.launch\w*\(|\bchromium\b/.test(code)) {
                    bad.push(`${n}: 含直接 launch 呼叫或 chromium 字樣`)
                }
            }
            A.deepEqual(bad, [])
        })

        it('EL-03c 全庫(src／test／toolg)不再引用 w-package-tools-e2e 之 launchChromium(該套件將移除之匯出)', function() {
            let hits = []
            for (let fp of listScanFiles()) {
                if (path.basename(fp) === SELF) {
                    continue
                }
                if (/w-package-tools-e2e\/src\/launchChromium/.test(fs.readFileSync(fp, 'utf8'))) {
                    hits.push(rel(fp))
                }
            }
            A.deepEqual(hits, [])
        })

        it('EL-03d wpw.launchChromium( 於 src 0 處、於 test 只在 e2eLaunch.mjs 一處, 且帶 autoInstall: false(不在案內隱性安裝)', function() {
            //spec 句: 啟動為 `wpw.launchChromium({ ...原選項, autoInstall: false })`: 受管瀏覽器由各檔第一個 before 之 ensureE2eBrowser() 集中取得, 其後各案只用已備妥者(排程第 632 項; 原為 autoInstall: true)
            let re = /\bwpw\.(launchChromium|launchChromiumPersistent)\(/
            let hits = []
            for (let fp of listScanFiles()) {
                let r = rel(fp)
                if (r === `test/${SELF}` || r === 'test/api-e2eLaunch.test.mjs') {
                    continue
                }
                stripComments(fs.readFileSync(fp, 'utf8')).split(/\r?\n/).forEach((ln) => {
                    if (re.test(ln)) {
                        hits.push(`${r}: ${ln.trim()}`)
                    }
                })
            }
            A.equal(hits.length, 1, `實得 ${JSON.stringify(hits)}`)
            A.ok(hits[0].startsWith('test/tools/e2eLaunch.mjs: '), hits[0])
            A.ok(/wpw\.launchChromium\(\{ \.\.\.opt, autoInstall: false \}\)/.test(hits[0]), hits[0])
        })

        it('EL-03e 每個 e2e 檔與 api-e2eLaunch 之第一個 before 為「this.timeout(PW_INSTALL_BUDGET_MS + 60000) 後 await ensureE2eBrowser()」, 且早於啟動伺服器與瀏覽器; 全庫無 autoInstall: true', function() {
            //spec 句: 取得集中於共用工具、取得處之時限對齊安裝預算、其後之案只用已備妥者(排程第 632 項); 新增之 e2e 檔亦須遵守
            let names = [...listE2eFiles(), 'api-e2eLaunch.test.mjs']
            let bad = []
            let reHook = /^ {4}before\(async function\(\) \{\s*this\.timeout\(PW_INSTALL_BUDGET_MS \+ 60000\)\s*await ensureE2eBrowser\(\)\s*\}\)/m
            for (let n of names) {
                let code = stripComments(fs.readFileSync(path.join(fdTest, n), 'utf8'))
                //第一個頂層(4 格縮排)before 即為取得之 before
                let m = /^ {4}before\(/m.exec(code)
                let h = reHook.exec(code)
                if (!m || !h || h.index !== m.index) {
                    bad.push(`${n}: 第一個 before 不是取得瀏覽器之 before(須為 this.timeout(PW_INSTALL_BUDGET_MS + 60000) 後 await ensureE2eBrowser())`)
                }
                if (/\b(describe|it)\.(only|skip)\(/.test(code)) {
                    bad.push(`${n}: 含 describe／it 之 only／skip(整檔或個案不跑, 取得之守門形同虛設)`)
                }
                let calls = code.match(/\bensureE2eBrowser\(\)/g) || []
                if (calls.length !== 1 && n !== 'api-e2eLaunch.test.mjs') {
                    bad.push(`${n}: ensureE2eBrowser() 呼叫應恰 1 處(實得 ${calls.length})`)
                }
                //取得須早於啟動伺服器與瀏覽器(api-e2eLaunch 無此二者, 以子行程啟動)
                let iEnsure = code.indexOf('await ensureE2eBrowser()')
                let iUse = code.search(/\bstartServer\(|\blaunchE2eBrowser\(|spawnSync\(/)
                if (iUse >= 0 && iEnsure > iUse) {
                    bad.push(`${n}: ensureE2eBrowser() 晚於啟動伺服器／瀏覽器`)
                }
            }
            A.deepEqual(bad, [])
        })

        it('EL-03f 全庫(src／test／toolg)程式碼無 autoInstall: true(取得只經 ensureE2eBrowser)', function() {
            let hits = []
            for (let fp of listScanFiles()) {
                let r = rel(fp)
                if (r === `test/${SELF}`) {
                    continue
                }
                stripComments(fs.readFileSync(fp, 'utf8')).split(/\r?\n/).forEach((ln) => {
                    if (/autoInstall\s*:\s*true/.test(ln)) {
                        hits.push(`${r}: ${ln.trim()}`)
                    }
                })
            }
            A.deepEqual(hits, [])
        })
    })

    describe('EL-04 R-PW-WIRING: 啟動點送出之選項含守門(替身接住, 不啟動瀏覽器)', function() {
        let r = null
        before(function() {
            r = runChild('fake')
        })

        it('EL-04a 替身確被呼叫恰 1 次(依賴樹有兩份 w-playwright 時未斷言即可能空過)', function() {
            A.equal(r.calls, 1)
        })

        it('EL-04b 內附表與實裝之 playwright-core 版本吻合(否則 w-playwright 會拒絕啟動)', function() {
            A.equal(r.tableMatch, true)
            //實裝版本須等於 w-playwright 所釘者(不寫死哪一版; 2026-11-21 升 1.65.1 時之殷鑑)
            let pin = JSON.parse(fs.readFileSync(path.join(projRoot, 'node_modules', 'w-' + PW, 'package.json'), 'utf8')).dependencies[PW + '-core']
            A.equal(r.coreVersion, pin)
        })

        it('EL-04c 命令列恰一串 --disable-features, 為 args 最後一個元素, 且含守門功能 AutofillAiWalletPrivatePasses', function() {
            //spec 句: 每次啟動之命令列恰給一個 --disable-features(Playwright 預設＋守門＋呼叫端自給), 置於呼叫端 args 之末
            let args = r.seen[0].args
            let dis = args.filter((a) => /^--disable-features=/i.test(a))
            A.equal(dis.length, 1)
            A.equal(args[args.length - 1], dis[0])
            A.ok(dis[0].split('=')[1].split(',').includes('AutofillAiWalletPrivatePasses'))
        })

        it('EL-04d 以 ignoreDefaultArgs 去掉 Playwright 預設之那一串 --disable-features, 且無 ignoreAllDefaultArgs', function() {
            let ign = r.seen[0].ignoreDefaultArgs
            A.ok(Array.isArray(ign))
            A.ok(ign.some((a) => /^--disable-features=/i.test(a)))
            A.equal(r.seen[0].hasIgnoreAll, false)
        })

        it('EL-04e 為 headless shell 之形態(無頭、不給通道與執行檔): 與修前 chromium.launch 同為無頭, 非真 Chrome／Edge／完整 Chromium', function() {
            //spec 句: 不改用 launchBrowser(以免多六旗標而改變像素); 不啟動真 Chrome、Edge 或完整 Chromium
            A.equal(r.seen[0].headless, true)
            A.equal(r.seen[0].channelUndefined, true)
            A.equal(r.seen[0].executablePathUndefined, true)
        })

        it('EL-04f 呼叫端自給之參數被轉傳並併入同一串(args 含 --lang=en-US)', function() {
            A.ok(r.seen[0].args.includes('--lang=en-US'))
        })
    })

    describe('EL-06 取得瀏覽器(排程第 632 項): ensureE2eBrowser 之預算、記憶與紀錄(替身 ensureChromium, 不下載)', function() {
        //建立一個以替身 ensureChromium 與收集式紀錄出口組成之取得函數
        let mk = (impl) => {
            let calls = []
            let logs = []
            let ensure = createEnsureE2eBrowser((opt) => {
                calls.push(opt)
                return impl(opt)
            }, (s) => logs.push(s))
            return { calls, logs, ensure }
        }

        it('EL-06a 預算 PW_INSTALL_BUDGET_MS 為整數, 大於測試指令之案時限(package.json test 之 --timeout), 且不超過 1 小時', function() {
            //spec 句: 取得處之時限對齊安裝預算(須大於舊寫法受制之案時限, 否則慢網路下仍於取得途中逾時)
            let pkg = JSON.parse(fs.readFileSync(path.join(projRoot, 'package.json'), 'utf8'))
            let m = /--timeout (\d+)/.exec(pkg.scripts.test)
            A.ok(m, 'package.json 之 test 指令須有 --timeout')
            let caseTimeout = Number(m[1])
            A.ok(Number.isInteger(PW_INSTALL_BUDGET_MS), '預算須為整數')
            A.ok(PW_INSTALL_BUDGET_MS > caseTimeout, '預算須大於案時限')
            A.ok(PW_INSTALL_BUDGET_MS <= 3600000, '預算不超過 1 小時(安裝卡死時不無限期占住)')
        })

        it('EL-06b 以 { kind: headless-shell, timeout: 預算 } 呼叫 ensureChromium(逾時不是預設之 0＝不限)', async function() {
            //spec 句: ensureChromium({ timeout }) 逾時即結束安裝子行程樹並失敗; kind 與 e2e 各檔 launchE2eBrowser({ headless: true }) 所用之種類一致
            let { calls, ensure } = mk(async () => ({ kind: 'headless-shell' }))
            let r = await ensure()
            A.equal(r.kind, 'headless-shell')
            A.equal(calls.length, 1)
            A.equal(calls[0].kind, 'headless-shell')
            A.equal(calls[0].timeout, PW_INSTALL_BUDGET_MS)
            A.equal(typeof calls[0].onTrace, 'function')
            A.equal(typeof calls[0].funLog, 'function')
        })

        it('EL-06c 同行程只做一次: 並發與其後之重複呼叫皆回傳同一個 Promise, ensureChromium 僅被呼叫 1 次', async function() {
            //spec 句: 各 e2e 檔之第一個 before 皆呼叫之, 同一 Node 行程內安裝恰一次
            let { calls, ensure } = mk(async () => ({ kind: 'headless-shell' }))
            let p1 = ensure()
            let p2 = ensure()
            A.equal(p1, p2, '並發呼叫須回傳同一個 Promise')
            await p1
            A.equal(ensure(), p1, '其後之呼叫須回傳同一個 Promise')
            A.equal(calls.length, 1)
        })

        it('EL-06d 失敗亦記憶: 首次以帶 code 之錯誤失敗(訊息含 code 與預算), 其後之呼叫立即以同一錯誤失敗而不重試', async function() {
            //spec 句: 失敗不重試(逾時一次即十幾分鐘, 每個 e2e 檔重試一次不可接受)
            let err = Object.assign(new Error('browser installation timed out'), { code: 'E_INSTALL' })
            let { calls, ensure } = mk(async () => {
                throw err
            })
            let e1 = null
            try {
                await ensure()
            }
            catch (e) {
                e1 = e
            }
            A.ok(e1 !== null, '首次須失敗')
            A.ok(e1.code === 'E_INSTALL', '錯誤須保留 code')
            A.ok(/E_INSTALL/.test(e1.message) && new RegExp(String(PW_INSTALL_BUDGET_MS)).test(e1.message), '訊息須含 code 與預算')
            let e2 = null
            try {
                await ensure()
            }
            catch (e) {
                e2 = e
            }
            A.ok(e2 === e1, '其後之呼叫須以同一錯誤失敗')
            A.equal(calls.length, 1)
        })

        it('EL-06e 同步拋錯之 ensureChromium 亦轉為 rejection(code E_ENSURE), 不同步拋出', async function() {
            let { ensure } = mk(() => {
                throw new Error('boom')
            })
            let p = null
            A.doesNotThrow(() => {
                p = ensure()
            })
            let e = null
            try {
                await p
            }
            catch (err) {
                e = err
            }
            A.ok(e !== null && e.code === 'E_ENSURE')
        })

        it('EL-06f 紀錄一行: 安裝程序次數(onTrace install-start)與下載動作次數(install-output 之 Downloading), 已備妥者下載為 0', async function() {
            //spec 句: 驗收以事件或計數為證(安裝恰一次): 下載動作 N 次出現在測試輸出
            let dl = mk(async (opt) => {
                opt.onTrace({ type: 'install-start', kind: 'headless-shell' })
                opt.funLog('install-output', { kind: 'headless-shell' }, 'Downloading Chrome Headless Shell 1 from https://example.invalid/a.zip\n')
                opt.funLog('install-output', { kind: 'headless-shell' }, '|■■■■| 10% of 123 MiB\n')
                opt.funLog('install-output', { kind: 'headless-shell' }, 'Downloading FFmpeg 2 from https://example.invalid/b.zip\n')
                opt.onTrace({ type: 'install-done', kind: 'headless-shell' })
                return { kind: 'headless-shell' }
            })
            await dl.ensure()
            await dl.ensure()
            A.equal(dl.logs.length, 1, '同行程只紀錄一行')
            A.ok(/安裝程序 1 次/.test(dl.logs[0]) && /下載動作 2 次/.test(dl.logs[0]), '紀錄須含安裝程序 1 次與下載動作 2 次')
            let ok = mk(async (opt) => {
                opt.onTrace({ type: 'install-start', kind: 'headless-shell' })
                opt.onTrace({ type: 'install-done', kind: 'headless-shell' })
                return { kind: 'headless-shell' }
            })
            await ok.ensure()
            A.ok(/安裝程序 1 次/.test(ok.logs[0]) && /下載動作 0 次/.test(ok.logs[0]), '已備妥者下載動作須為 0 次')
            //start 與 done／fail 之次數取不同(2、1、1), 才分得出計的是 install-start(鑑別力: 計 done 或 fail 之變異會得 1 次)
            let multi = mk(async (opt) => {
                opt.onTrace({ type: 'install-start', kind: 'headless-shell' })
                opt.onTrace({ type: 'install-done', kind: 'headless-shell' })
                opt.onTrace({ type: 'install-start', kind: 'deps' })
                opt.onTrace({ type: 'install-fail', kind: 'deps', exitCode: 1 })
                return { kind: 'headless-shell' }
            })
            await multi.ensure()
            A.ok(/安裝程序 2 次/.test(multi.logs[0]), '安裝程序次數須依 install-start 計(2 次)')
        })

        it('EL-06i 安裝失敗時錯誤訊息附安裝輸出末段(上限 2000 字元、去色碼)與 install-error, 並以 cause 保留原錯誤', async function() {
            //spec 句: w-playwright 之錯誤只有離開碼, DNS 失敗、404、磁碟滿等真因只存在子行程輸出, 失敗時須讓使用者看得到
            let orig = Object.assign(new Error('browser installation failed with exit code 1'), { code: 'E_INSTALL' })
            let ESC = String.fromCharCode(27)
            let { ensure } = mk(async (opt) => {
                opt.funLog('install-output', { kind: 'headless-shell' }, 'x'.repeat(5000))
                opt.funLog('install-output', { kind: 'headless-shell' }, `${ESC}[31mgetaddrinfo ENOTFOUND cdn.example.invalid${ESC}[0m\n`)
                opt.funLog('install-error', { kind: 'headless-shell', exitCode: -1 }, new Error('spawn boom'))
                throw orig
            })
            let e = null
            try {
                await ensure()
            }
            catch (err) {
                e = err
            }
            A.ok(e !== null, '須失敗')
            A.ok(e.code === 'E_INSTALL', '錯誤須保留 code')
            A.ok(e.cause === orig, '須以 cause 保留原錯誤')
            A.ok(/exit code 1/.test(e.message), '訊息須含原錯誤訊息')
            A.ok(/ENOTFOUND cdn\.example\.invalid/.test(e.message), '訊息須含安裝輸出末段')
            A.ok(/spawn boom/.test(e.message), '訊息須含 install-error')
            A.ok(!e.message.includes(ESC), '訊息不得含色碼')
            A.ok(e.message.length < 3500, '訊息長度須受上限約束(輸出末段 2000 字元)')
            A.ok(!/x{3000}/.test(e.message), '較早之輸出須被截掉')
        })

        it('EL-06g 預設實例 ensureE2eBrowser 接 wpw.ensureChromium(原始碼接線; 真路徑見 api-e2eLaunch EL-05b)', function() {
            let code = stripComments(fs.readFileSync(path.join(fdTest, 'tools', 'e2eLaunch.mjs'), 'utf8'))
            A.ok(/export const ensureE2eBrowser = createEnsureE2eBrowser\(\(opt\) => wpw\.ensureChromium\(opt\)\)/.test(code))
        })

        describe('EL-06h 啟動不自動安裝(真 w-playwright, 空瀏覽器夾, 不連外)', function() {
            const DIR = path.join(fdTest, '_tmp', 'e2eLaunch-missing')
            const DIR_BROWSERS = path.join(DIR, 'browsers')
            before(function() {
                fs.rmSync(DIR, { recursive: true, force: true })
                fs.mkdirSync(DIR_BROWSERS, { recursive: true })
            })
            after(function() {
                fs.rmSync(DIR, { recursive: true, force: true })
                try {
                    fs.rmdirSync(path.dirname(DIR)) //test/_tmp 若已空則一併移除(非空則保留, 他測試之臨時夾不動)
                }
                catch (err) { /* 非空或不存在 */ }
            })

            it('EL-06h 瀏覽器缺檔時 launchE2eBrowser 以 E_BROWSER_MISSING 立即失敗, 且瀏覽器夾內無任何下載或安裝產物', function() {
                //spec 句: 其後之案只用已備妥者, 不在案內隱性下載(autoInstall: false)
                //兩個下載主機變數都指向不通之位址(Playwright 對 chromium 先看 PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST, 使用者環境若已設之會蓋過另一個)
                let env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: DIR_BROWSERS, PLAYWRIGHT_DOWNLOAD_HOST: 'http://127.0.0.1:9', PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: 'http://127.0.0.1:9' }
                for (let k of ['PWDEBUG', 'SELENIUM_REMOTE_URL', 'SELENIUM_REMOTE_CAPABILITIES']) {
                    delete env[k]
                }
                let r = spawnSync(process.execPath, [CHILD, 'missing'], { cwd: projRoot, env, encoding: 'utf8', windowsHide: true, timeout: 100000 })
                let line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
                if (!line) {
                    throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
                }
                let out = JSON.parse(line.slice('RESULT:'.length))
                A.equal(out.errorCode, 'E_BROWSER_MISSING', out.errorMsg)
                A.deepEqual(fs.readdirSync(DIR_BROWSERS), [], '瀏覽器夾內不得有任何下載或安裝產物')
            })
        })
    })
})
