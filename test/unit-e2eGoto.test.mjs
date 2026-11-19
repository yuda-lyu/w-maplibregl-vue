// unit: e2e 進場載入條件之共用(test/tools/e2e-setup.mjs 之 gotoApp, 規則帳本 R5〈e2e 進場載入條件〉, 排程第 550 項 wml550b)
//
// 緣起: 首頁預設範例(size)載入遠端底圖, e2e 以 page.goto(baseUrl, { waitUntil: 'networkidle' }) 進場時, networkidle 取決於外網,
//   外網慢時 30 秒逾時(與被測功能無關; 2026-11 批 6 跟跑之 e2e-zoomrange E2E-Z16、wml550 全套之 e2e-displayorder E2E-001、e2e-zoomrange E2E-Z12b 各現一次, 皆時敗時過)。
//
// 規格句(主控 2026-11-19 裁定, wml550b):
//   G1 e2e 進場不以 networkidle 為載入條件(程式碼中不得出現; 說明文字不計)
//   G2 經 dev server 首頁進場之 e2e 以共用 gotoApp(page) 進場, 各檔不另寫一份; 任何 page.goto(baseUrl, ...) 之載入條件只可為 domcontentloaded
//   G3 gotoApp 之載入條件為 domcontentloaded, 其後以可觀察狀態(waitUntilExist: App 選單已渲染)判定就緒, 不以固定延時代替
//
// 本檔為規則盤點測試(原始碼文字比對), 不 import e2e-setup.mjs(模組頂層會保留埠, 單元測試不得為此 import, 見經驗檔)。
// 行為面之證據為各 e2e 檔之實跑與變異檢驗(報告 wml550b-修正報告)。
import assert from 'assert'
import fs from 'fs'
import path from 'path'

let fdTest = path.resolve('./test')
let rd = (rel) => fs.readFileSync(path.join(fdTest, rel), 'utf8')
//去註解(同 unit-e2ePortReserve): 區塊註解、整行註解、行尾註解(保留 'http://' 這類字串內之 //)
let stripComments = (src) => src.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`\\])\/\/.*$/gm, '$1')

//經 dev server 首頁進場、改呼叫共用 gotoApp 之 e2e 檔與其呼叫次數(E2E-Z10 另走主選單, 同檔共 2 處)
const GOTO_APP_SITES = {
    'e2e-basemapzoom.test.mjs': 1,
    'e2e-displayorder.test.mjs': 1,
    'e2e-hover.test.mjs': 1,
    'e2e-opacity.test.mjs': 1,
    'e2e-runtime.test.mjs': 1,
    'e2e-zoomrange.test.mjs': 2,
}

let listE2eFiles = () => fs.readdirSync(fdTest).filter((f) => /^e2e-.*\.test\.mjs$/.test(f)).sort()
let countOf = (src, re) => (src.match(re) || []).length

describe('unit-e2eGoto', function() {

    it('G1 e2e 進場不以 networkidle 為載入條件(test/ 下全部 .mjs 之程式碼, 說明文字不計)', function() {
        let files = []
        let walk = (d) => {
            for (let e of fs.readdirSync(d, { withFileTypes: true })) {
                let fp = path.join(d, e.name)
                if (e.isDirectory()) {
                    if (e.name === '_tmp' || e.name === 'fixtures') continue
                    walk(fp)
                }
                else if (e.name.endsWith('.mjs') && e.name !== 'unit-e2eGoto.test.mjs') files.push(fp)
            }
        }
        walk(fdTest)
        assert.ok(files.length >= 20, `前提: 盤點到 test/ 之 .mjs 檔(實際 ${files.length})`)
        let hits = []
        for (let fp of files) {
            stripComments(fs.readFileSync(fp, 'utf8')).split(/\r?\n/).forEach((line, i) => {
                if (/networkidle/.test(line)) hits.push(`${path.relative(fdTest, fp)}: ${line.trim()}`)
            })
        }
        assert.deepStrictEqual(hits, [], 'G1: 程式碼中不得以 networkidle 為載入條件(首頁預設範例載入遠端底圖, 取決於外網)')
    })

    it('G2 首頁進場: 6 檔以共用 gotoApp(page) 進場且不另寫 page.goto(baseUrl; 全部 e2e 之 page.goto(baseUrl 載入條件只可為 domcontentloaded', function() {
        for (let [f, n] of Object.entries(GOTO_APP_SITES)) {
            let code = stripComments(rd(f))
            assert.ok(/import \{[^}]*\bgotoApp\b[^}]*\} from '\.\/tools\/e2e-setup\.mjs'/.test(code), `G2: ${f} 須自 e2e-setup 匯入 gotoApp`)
            assert.strictEqual(countOf(code, /\bgotoApp\(page\)/g), n, `G2: ${f} 應呼叫 gotoApp(page) ${n} 次`)
            assert.strictEqual(countOf(code, /page\.goto\(baseUrl/g), 0, `G2: ${f} 不得另寫 page.goto(baseUrl(進場改走共用 gotoApp)`)
        }
        //全部 e2e 檔(含 e2e-movestate、e2e-diffpath 既有之 inline 寫法): 凡 page.goto(baseUrl, 載入條件皆為 domcontentloaded
        let bad = []
        for (let f of listE2eFiles()) {
            stripComments(rd(f)).split(/\r?\n/).forEach((line) => {
                if (/page\.goto\(baseUrl/.test(line) && !/waitUntil:\s*'domcontentloaded'/.test(line)) bad.push(`${f}: ${line.trim()}`)
            })
        }
        assert.deepStrictEqual(bad, [], 'G2: page.goto(baseUrl 之載入條件只可為 domcontentloaded')
    })

    it('G3 gotoApp: 載入條件 domcontentloaded, 其後以 waitUntilExist 等 App 選單已渲染(可觀察狀態), 不用固定延時', function() {
        let src = stripComments(rd('tools/e2e-setup.mjs'))
        let m = /export async function gotoApp\(page\) \{([\s\S]*?)\n\}/.exec(src)
        assert.ok(m, 'G3: e2e-setup.mjs 須匯出 gotoApp(page)')
        let body = m[1]
        let iGoto = body.search(/page\.goto\(baseUrl,\s*\{\s*waitUntil:\s*'domcontentloaded'\s*\}\)/)
        let iWait = body.search(/waitUntilExist\(page,/)
        assert.ok(iGoto >= 0, 'G3: 須以 page.goto(baseUrl, { waitUntil: \'domcontentloaded\' }) 載入')
        assert.ok(iWait > iGoto, 'G3: 載入後須以 waitUntilExist 等就緒')
        assert.ok(/clsMainMenu-basic/.test(body) && /clsSubMenu-basic/.test(body), 'G3: 就緒條件為主選單與子選單項已渲染(App.vue)')
        assert.ok(!/waitForTimeout|setTimeout|sleep\(|delay\(/.test(body), 'G3: 就緒不得以固定延時代替')
        assert.ok(!/networkidle/.test(body), 'G3: 不得含 networkidle')
    })
})
