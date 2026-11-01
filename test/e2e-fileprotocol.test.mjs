// e2e: 以 file:// 直接開啟之頁面(於檔案總管雙擊 html)與不透明來源(sandbox iframe)須能載入 maplibre worker 並繪出點位與面板(規則帳本 R17, Gitea #46)
//
// 目的: 本套件以 module Blob 供 worker, maplibre 於 file:// 判為跨來源而以 module worker 載入 Blob, 不透明來源(sandbox iframe)亦以 module worker 載入 Blob,
//   Chromium 皆載入失敗('Worker failed to load', 建構子不丟錯、失敗於非同步 error 事件), 點位(GeoJSON, 須經 worker)與面板皆不顯示, 底圖照常(1.0.5 正常)。
//   修正後該等環境改以 data: URL 供 classic 版 worker(src/js/mapCore.mjs), 結果須與 http 相同; http(s) 路徑不變(仍為 module Blob)。
//   本測試同時釘住 mapCore.mjs 所依賴之 maplibre 內部判斷(僅 '.cjs' 結尾走 classic): maplibre-gl 升版改了判斷時, F1、F3、F4 即紅。
//
// 須測當前 src 之產物, 不得靜默測到過期之 dist: before 自 src 建置 umd 到 test/_tmp/e2e-fileprotocol/dist(與 script.txt 之 gDistRollupComps.mjs 同設定: umd、kebabCase、壓縮),
//   不讀 ./dist; after 刪除該夾(含 dist)。內嵌 worker(src/js/maplibreWorkerInline.mjs)須已由 toolg/gDistRollupMaplibreGlWorker.mjs 產製(unit-workerClassic U47 檢查其與切分規則同步)。
//
// 真實 user path(3 步):
//   1. 開啟頁面(file://: 於檔案總管雙擊 test/fixtures/fileProtocol.html; 頁面以相對路徑載入本機 vue 與上述 umd)
//   2. 等地圖首次完成(idle)
//   3. 看到點位(地圖上 3 個點)與面板(圖層面板之點組名稱、底圖面板之底圖名稱)
//   (act 僅為「開啟頁面」, 無其餘互動; 斷言走使用者可觀察之結果: 點位出現在畫面、面板文字可見、無 worker 載入錯誤)
//
// 重要流程(spec bullets):
//   - E2E-F1 file:// 開啟: 無 'Worker failed to load'; 地圖 idle; 3 個點位繪出(地圖上 Point 圖徵 3 個且畫面上有點位色); 面板列出點組名稱 'pts A' 與底圖名稱 'base red'; worker 為 classic
//   - E2E-F2 http 開啟(對照, 現行路徑不變): 同上結果; worker 為 module 且來自 blob:
//   - E2E-F3 sandbox iframe(src, 不透明來源〔window.origin 為 'null'〕但 location.origin 仍為該頁來源、protocol 為 http:): 同 F1 結果; worker 為 classic
//   - E2E-F4 sandbox iframe(srcdoc, location.origin 為 'null'、protocol 為 about:): 同 F3
//
// http 與 sandbox 以 context.route 於瀏覽器內供應(來源為虛擬之 127.0.0.1:8195, 不開 port、不連外); file:// 為真實檔案路徑。
// 標準圖政策: 依規則帳本〈e2e 映射〉無跨 run 標準圖(語意斷言 + 畫面取樣)。每個 it() 各自 new browser。
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { PNG } from 'pngjs'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'

//以模組位置定位(不依執行目錄)
let ROOT = fileURLToPath(new URL('../', import.meta.url))
let DIR_TMP = path.join(ROOT, 'test', '_tmp', 'e2e-fileprotocol')
let DIR_DIST = path.join(DIR_TMP, 'dist')
let FP_PAGE = path.join(ROOT, 'test', 'fixtures', 'fileProtocol.html')

//虛擬 http 來源(由 context.route 攔截供應, 不開 port)
let ORIGIN = 'http://127.0.0.1:8195'
let PATH_PAGE = '/test/fixtures/fileProtocol.html'
let PATH_SANDBOX_SRC = '/test/fixtures/sandboxSrc.html'
let PATH_SANDBOX_SRCDOC = '/test/fixtures/sandboxSrcdoc.html'

let MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

//供 route 取檔之白名單(測試頁、本機 vue、本測試建置之 umd)
let isServable = (pathname) => pathname === PATH_PAGE || pathname === '/node_modules/vue/dist/vue.min.js' || pathname === '/test/_tmp/e2e-fileprotocol/dist/w-maplibregl-vue.umd.js'

let escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

let sandboxHtml = (frameAttrs) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>sandbox parent</title></head><body style="margin:0;"><iframe id="f" sandbox="allow-scripts" style="width:920px;height:620px;border:0;" ${frameAttrs}></iframe></body></html>`

//以 context.route 供應虛擬 http 來源之頁面: 測試頁、sandbox 外層頁(src 與 srcdoc 兩種)與其所需之 js
async function serveVirtualHttp(ctx) {
    await ctx.route(`${ORIGIN}/**`, async (route) => {
        let pathname = new URL(route.request().url()).pathname
        if (pathname === PATH_SANDBOX_SRC) {
            return route.fulfill({ status: 200, contentType: MIME['.html'], body: sandboxHtml('src="fileProtocol.html"') })
        }
        if (pathname === PATH_SANDBOX_SRCDOC) {
            //srcdoc 之相對路徑以外層頁(本 URL)為基準, 故內容與 fileProtocol.html 相同
            return route.fulfill({ status: 200, contentType: MIME['.html'], body: sandboxHtml(`srcdoc="${escapeAttr(fs.readFileSync(FP_PAGE, 'utf8'))}"`) })
        }
        if (!isServable(pathname)) {
            return route.fulfill({ status: 404, body: 'not found' })
        }
        let body = fs.readFileSync(path.join(ROOT, pathname))
        return route.fulfill({ status: 200, contentType: MIME[path.extname(pathname)] || 'application/octet-stream', body })
    })
}

//記錄頁面(含 iframe)內所有 new Worker(url, options)之 URL 開頭與 type(只讀觀察, 不改行為)
let recordWorkers = () => {
    let W = window.Worker
    window.__workers = []
    window.Worker = new Proxy(W, {
        construct(target, args) {
            window.__workers.push({ url: String(args[0]).slice(0, 12), type: (args[1] && args[1].type) || 'classic' })
            return Reflect.construct(target, args)
        },
    })
}

//點位色(pointSets fillColor #2196f3)之像素數: 取地圖左上 900x600 區內三個點位中心附近(zoom 10, 每度約 1456px: p1 中心、p2 偏右上 44x29、p3 偏左下 44x29)
function countPointPixels(buf) {
    let png = PNG.sync.read(buf)
    let centers = [[450, 300], [494, 271], [406, 329]]
    return centers.map(([cx, cy]) => {
        let n = 0
        for (let y = cy - 12; y <= cy + 12; y++) {
            for (let x = cx - 12; x <= cx + 12; x++) {
                let i = (y * png.width + x) * 4
                let r = png.data[i]
                let g = png.data[i + 1]
                let b = png.data[i + 2]
                //藍(#2196f3 = 33,150,243)而非底圖紅(220,40,40)
                if (b > 200 && r < 90 && g > 110 && g < 190) n++
            }
        }
        return n
    })
}

describe('e2e-fileprotocol', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(300000)

        //自 src 建置當前產物到本測試專用夾(清空後寫入), 不讀 ./dist
        fs.rmSync(DIR_TMP, { recursive: true, force: true })
        fs.mkdirSync(DIR_TMP, { recursive: true })
        await rollupFiles({
            fns: 'WMaplibreglVue.vue',
            fdSrc: path.join(ROOT, 'src', 'components'),
            fdTar: DIR_DIST,
            format: 'umd',
            nameDistType: 'kebabCase',
            globals: {},
            external: [],
            bSourcemap: false,
            bLog: false,
        })
        assert.ok(fs.existsSync(path.join(DIR_DIST, 'w-maplibregl-vue.umd.js')), `須已自 src 建置 ${DIR_DIST}`)
    })
    after(function() {
        fs.rmSync(DIR_TMP, { recursive: true, force: true })
        assert.ok(!fs.existsSync(DIR_TMP), '測試專用夾須已刪除')
        try {
            fs.rmdirSync(path.dirname(DIR_TMP)) //test/_tmp 若為本測試建立且已空則一併移除(非空則保留, 其他測試之臨時夾不動)
        }
        catch (err) { /* 非空或不存在 */ }
    })

    let browser = null
    let ctx = null
    let page = null
    let errs = null
    beforeEach(async function() {
        browser = await launchChromium({ headless: true })
        ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } })
        await ctx.addInitScript(recordWorkers)
        page = await ctx.newPage()
        errs = []
        page.on('console', (m) => {
            if (m.type() === 'error') errs.push(m.text())
        })
        page.on('pageerror', (e) => errs.push(String(e.message)))
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        ctx = null
        page = null
    })

    //共同斷言: frame(主頁面或 iframe)內之地圖已 idle、3 個點位繪出且畫面上有點位色、面板可見、無 worker 載入錯誤; 回傳 worker 記錄
    let assertMapShown = async (frame, shot) => {
        //2. 等地圖首次 idle(頁面於 idle 或 20 秒後寫入 window.__e2e)
        await frame.waitForFunction(() => window.__e2e && window.__e2e.done === true, null, { timeout: 60000 })
        let r = await frame.evaluate(() => window.__e2e)

        //3. spec: 無 worker 載入失敗; 地圖 idle; 3 個點位皆繪出; 面板列出點組與底圖名稱(面板於首次 idle 後才渲染, 以 locator 等其可見)
        assert.deepStrictEqual(errs.filter((e) => e.indexOf('Worker failed to load') >= 0), [], '不得出現 worker 載入失敗')
        assert.strictEqual(r.idle, true, '地圖須於逾時前 idle')
        assert.strictEqual(r.points, 3, '3 個點位皆繪出')
        await frame.getByText('pts A', { exact: true }).waitFor({ state: 'visible', timeout: 15000 }) //圖層面板列出點組名稱
        await frame.getByText('base red', { exact: true }).waitFor({ state: 'visible', timeout: 15000 }) //底圖面板列出底圖名稱

        //畫面上三個點位位置皆有點位色(使用者看到點)
        let counts = countPointPixels(await shot())
        for (let i = 0; i < counts.length; i++) {
            assert.ok(counts[i] > 20, `點位 p${i + 1} 附近應有點位色像素(實得 ${counts[i]})`)
        }
        return await frame.evaluate(() => window.__workers)
    }

    it('E2E-F1 以 file:// 開啟: worker 載入成功, 點位與面板皆顯示(classic worker)', async function() {
        //1. 以 file:// 開啟測試頁
        await page.goto(pathToFileURL(FP_PAGE).href, { waitUntil: 'load' })
        assert.strictEqual(await page.evaluate(() => location.protocol), 'file:', '須為 file:// 頁面')

        let workers = await assertMapShown(page.mainFrame(), () => page.screenshot())

        //經 classic 載入(maplibre 判為跨來源, fetch 該 data: URL 後建 classic Blob worker); module 者即為失效之舊路徑
        assert.ok(workers.length > 0, '須建立 worker')
        assert.deepStrictEqual([...new Set(workers.map((w) => w.type))], ['classic'], 'file:// 須以 classic worker 載入')
    })

    it('E2E-F2 以 http 開啟(對照): 結果相同, 且仍為 module Blob worker(現行路徑不變)', async function() {
        await serveVirtualHttp(ctx)
        await page.goto(ORIGIN + PATH_PAGE, { waitUntil: 'load' })
        assert.strictEqual(await page.evaluate(() => location.origin), ORIGIN, '須為 http 來源')

        let workers = await assertMapShown(page.mainFrame(), () => page.screenshot())

        assert.ok(workers.length > 0, '須建立 worker')
        assert.deepStrictEqual([...new Set(workers.map((w) => w.type))], ['module'], 'http 須維持 module worker')
        assert.deepStrictEqual([...new Set(workers.map((w) => w.url.slice(0, 5)))], ['blob:'], 'http 須維持 Blob URL')
    })

    //sandbox iframe(allow-scripts, 無 allow-same-origin)為不透明來源: window.origin 為 'null'
    //(src 載入時 location.origin 仍為該 URL 之來源, srcdoc 時為 'null'; 故判斷不能用 location.origin, 見 src/js/mapCore.mjs)
    for (let [name, pathParent, expectedProtocol, expectedLocationOrigin] of [
        ['E2E-F3 sandbox iframe(src, protocol http:)', PATH_SANDBOX_SRC, 'http:', ORIGIN],
        ['E2E-F4 sandbox iframe(srcdoc, protocol about:)', PATH_SANDBOX_SRCDOC, 'about:', 'null'],
    ]) {
        it(`${name}: 不透明來源下 worker 載入成功, 點位與面板皆顯示(classic worker)`, async function() {
            await serveVirtualHttp(ctx)
            await page.goto(ORIGIN + pathParent, { waitUntil: 'load' })
            let frame = await (await page.locator('iframe#f').elementHandle()).contentFrame()
            assert.deepStrictEqual(await frame.evaluate(() => [window.origin, location.origin, location.protocol]), ['null', expectedLocationOrigin, expectedProtocol], '須為不透明來源')

            let workers = await assertMapShown(frame, () => page.locator('iframe#f').screenshot())

            //module 者即為失效之舊路徑; classic 之 URL 形式依 maplibre 是否判為跨來源而異(blob: 或 data:), 不斷言
            assert.ok(workers.length > 0, '須建立 worker')
            assert.deepStrictEqual([...new Set(workers.map((w) => w.type))], ['classic'], '不透明來源須以 classic worker 載入')
        })
    }

})
