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
// 跑法: node C:/opensrcOper/tools/quiet-run.mjs --name pm-mlv --lock -- npx mocha test/unit-e2eLaunch.test.mjs --timeout 180000
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

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

        it('EL-02c 已安裝之 w-playwright 版本 >= 1.0.1, 其依賴之 playwright-core 為精確 1.64.1', function() {
            let inst = JSON.parse(fs.readFileSync(path.join(projRoot, 'node_modules', 'w-' + PW, 'package.json'), 'utf8'))
            let v = inst.version.split('.').map(Number)
            A.ok(v[0] > 1 || (v[0] === 1 && (v[1] > 0 || v[2] >= 1)), `已安裝版本 ${inst.version}`)
            A.equal(inst.dependencies[PW + '-core'], '1.64.1')
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
                if (!/import launchE2eBrowser from '\.\/tools\/e2eLaunch\.mjs'/.test(code)) {
                    bad.push(`${n}: 未匯入 ./tools/e2eLaunch.mjs`)
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

        it('EL-03d wpw.launchChromium( 於 src 0 處、於 test 只在 e2eLaunch.mjs 一處, 且帶 autoInstall: true', function() {
            //spec 句: 啟動改 `wpw.launchChromium({ ...原選項, autoInstall: true })`(受管瀏覽器缺檔時安裝一次再啟動, 同修前行為)
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
            A.ok(/wpw\.launchChromium\(\{ \.\.\.opt, autoInstall: true \}\)/.test(hits[0]), hits[0])
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
            A.equal(r.coreVersion, '1.64.1')
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
})
