// e2e 啟動點之真路徑(規則帳本 R20; 排程第 442 項; R-PW-WIRING「至少一案走真路徑」): 經 w-playwright 實際啟動 headless shell 一次並關閉。
//
// 只啟動 headless shell(無頭、不給通道與執行檔): 不啟動真 Chrome／Edge／完整 Chromium, 不觸發 w-playwright 之登入守門讀取。
// 替身只記錄 w-playwright 合併後之選項, 再以 next() 走真 Playwright, 故同時證明「替身確被呼叫」與「真路徑可啟動」。
// 取得(排程第 632 項): 子行程之真啟動不自動安裝(autoInstall: false), 故本檔第一個 before 先經真路徑之 ensureE2eBrowser() 取得受管瀏覽器(缺檔時於此下載安裝,
//   時限為安裝預算; 同一 mocha 行程只做一次, 之後各 e2e 檔之呼叫為記憶命中); EL-05b 驗其真路徑之回傳與記憶。
// 跑法: node C:/opensrcOper/tools/quiet-run.mjs --name pm-mlv --lock -- npx mocha test/api-e2eLaunch.test.mjs --timeout 180000
import path from 'path'
import assert from 'assert'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { ensureE2eBrowser, PW_INSTALL_BUDGET_MS } from './tools/e2eLaunch.mjs'

const A = assert.strict
const fdTest = path.dirname(fileURLToPath(import.meta.url))
const projRoot = path.join(fdTest, '..')
const CHILD = path.join(fdTest, 'tools', 'e2eLaunchChild.mjs')

describe('api-e2eLaunch', function() {
    this.timeout(180000)

    before(async function() {
        //首次取得受管瀏覽器(缺檔時於此下載安裝, 時限對齊安裝預算; 排程第 632 項); 其後子行程之真啟動只用已備妥者
        this.timeout(PW_INSTALL_BUDGET_MS + 60000)
        await ensureE2eBrowser()
    })

    it('EL-05b 取得之真路徑: ensureE2eBrowser() 以 w-playwright 之 ensureChromium 備妥 headless shell, 回傳 { kind } 且同行程重複呼叫為同一個 Promise(記憶)', async function() {
        //spec 句: 取得集中於共用工具, 同一 Node 行程只做一次(接縫不用替身: 此處走真 wpw.ensureChromium)
        let p1 = ensureE2eBrowser()
        let p2 = ensureE2eBrowser()
        A.equal(p1, p2, '同行程之重複呼叫須回傳同一個 Promise')
        let r = await p1
        A.equal(r.kind, 'headless-shell')
    })

    it('EL-05 真路徑: 啟動點經 w-playwright(替身被呼叫 1 次, 含守門選項)並真的啟動 headless shell、取得版本、關閉', function() {
        //spec 句: 接縫至少一案不用替身(此處替身只記錄, 以 next() 走真 Playwright)
        let env = { ...process.env }
        for (let k of ['PWDEBUG', 'SELENIUM_REMOTE_URL', 'SELENIUM_REMOTE_CAPABILITIES']) {
            delete env[k]
        }
        let r = spawnSync(process.execPath, [CHILD, 'real'], { cwd: projRoot, env, encoding: 'utf8', windowsHide: true, timeout: 150000 })
        let line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) {
            throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
        }
        let out = JSON.parse(line.slice('RESULT:'.length))
        A.equal(out.calls, 1)
        let args = out.seen[0].args
        A.match(args[args.length - 1], /^--disable-features=.*AutofillAiWalletPrivatePasses/)
        A.equal(out.seen[0].channelUndefined && out.seen[0].executablePathUndefined, true)
        A.match(out.version, /^\d+\.\d+/)
    })
})
