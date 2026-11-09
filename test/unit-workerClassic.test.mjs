// unit: file:// 與不透明來源(sandbox iframe)以 classic 版 worker 載入之純邏輯(src/js/mapCore.mjs、toolg/gDistRollupWorkerFuncs.mjs, 規則帳本 R17)
//
// 不需瀏覽器; 真瀏覽器於 file:// 與 sandbox iframe 載入 worker 之結果由 test/e2e-fileprotocol.test.mjs 驗證。
// 規格句(以下代稱 J-xxx):
//   J-split  classic 前段之切分規則只在 findClassicLength 一處: 前段(0..classicLength)為合法 classic 腳本(vm.Script 可解析), 其後只剩末尾 `export { X as default };`;
//            內嵌產製物(maplibreWorkerInline.mjs 之 classicLength)與該規則同步; 規則對不合法輸入(殘留 export/import/import.meta/頂層 await/語法錯誤)拋錯而中止產製
//   J-cond   needClassicWorker: protocol 為 'file:' 或 Blob URL 之來源為不透明('null': file://、sandbox iframe 之 srcdoc 與 src)才走 classic; http(s) 與其他來源維持 module Blob;
//            不以 location.origin 判斷(sandbox iframe 以 src 載入時 location.origin 仍為該 URL 之來源)
//   J-url    buildClassicWorkerUrl: data: URL 解碼後 = classic 前段 + '\n//.cjs'; 去掉 ?、# 之後以 '.cjs' 結尾(maplibre 以此判為 classic); 編碼後無 ? 與 #(否則 '.cjs' 判斷被截斷);
//            含非 ASCII 與 URL/模板特殊字元之原始碼可還原; 長度不超過 Chrome 之 URL 上限(2 MiB)
//   J-maplibre  依賴之 maplibre 內部判斷(僅認 '.cjs' 結尾為 classic; 跨來源且 classic 時 fetch 後建 Blob; 以 URL 來源與 location.origin 比對判跨來源)未變;
//            此為第三方實作細節, maplibre-gl 升版若改了, 本案即紅, 須重新評估 mapCore.mjs 之 data: URL 作法並跑 e2e-fileprotocol
import assert from 'assert'
import fs from 'fs'
import vm from 'vm'
import workerSource, { classicLength } from '../src/js/maplibreWorkerInline.mjs'
import { needClassicWorker, buildClassicWorkerUrl } from '../src/js/mapCore.mjs'
import { findClassicLength } from '../toolg/gDistRollupWorkerFuncs.mjs'

//maplibre 判斷 classic 之規則(maplibre-gl 之 isClassicWorkerUrl 的複本, 由 U52 釘住其與 maplibre 同步)
//6.15.0 起(#8769)於「去掉 ?、# 後以 .cjs 結尾」之前加「整串 URL 以 .cjs 結尾」; 本套件之 data: URL 兩者皆成立(編碼後無 ? 與 #)
let isClassicWorkerUrl = (url) => url.endsWith('.cjs') || url.split(/[?#]/)[0].endsWith('.cjs')

let PREFIX = 'data:text/javascript;charset=utf-8,'
let EXPORT_TAIL = /^\n*export\s*\{\s*[\w$]+\s+as\s+default\s*\};?\s*$/

//檢查 maplibre-gl 主程式(production build, 識別字被壓縮故以 [\w$]+ 代之: 6.16.0 起壓縮器產生含 $ 之識別字如 $c, 純 \w 比對不到)內 worker 建立之判斷是否仍如 mapCore.mjs 所依賴; 回傳未通過之檢查名稱
function checkMaplibreWorkerFactory(s) {
    let failed = []
    let checks = [
        // isClassicWorkerUrl(6.15.0 起): 整串 URL 以 .cjs 結尾, 或去掉 ? 與 # 之後以 .cjs 結尾
        ['isClassicWorkerUrl', /function [\w$]+\(([\w$])\)\{return \1\.endsWith\(`\.cjs`\)\|\|\1\.split\(\/\[\?#\]\/\)\[0\]\.endsWith\(`\.cjs`\)\}/],
        // isCrossOrigin: new URL(url, location.href).origin !== location.origin
        ['isCrossOrigin', /function [\w$]+\(([\w$])\)\{if\(!\1\)return!1;let ([\w$])=globalThis\.location;if\(!\2\)return!1;try\{return new URL\(\1,\2\.href\)\.origin!==\2\.origin\}catch\{return!1\}\}/],
        // workerFactory: asModule = !isClassic(url); 同來源直接 createWorker; 跨來源且 module 包 import Blob; 跨來源且 classic → fetch 後建 Blob 再 createWorker
        ['workerFactory', /async function [\w$]+\(\)\{let ([\w$])=[\w$.]+\.WORKER_URL\|\|[\w$]+\(\),([\w$])=!([\w$]+)\(\1\);if\(!([\w$]+)\(\1\)\)return ([\w$]+)\(\1,\2\);if\(\2\)\{let ([\w$])=([\w$]+)\(\1\);try\{return \5\(\6,\2\)\}finally\{URL\.revokeObjectURL\(\6\)\}\}let ([\w$])=await ([\w$]+)\(\1\);try\{return \5\(\8,\2\)\}finally\{URL\.revokeObjectURL\(\8\)\}\}/],
        // fetch 輔助: fetch 後須檢查 response.ok 再建 Blob
        ['fetch 輔助', /async function [\w$]+\(([\w$])\)\{let ([\w$])=await fetch\(\1\);if\(!\2\.ok\)throw Error\(`Failed to fetch worker script/],
    ]
    for (let [name, re] of checks) {
        if (!re.test(s)) failed.push(name)
    }
    return failed
}

describe('unit-workerClassic', function() {

    // ---- J-split ----
    it('U47 內嵌產製物: classicLength 與切分規則同步, 前段為合法 classic 腳本且其後只剩末尾 export', function() {
        // J-split: 產製物之 classicLength = findClassicLength(內嵌原始碼)(重跑產製腳本後兩者一致)
        assert.strictEqual(findClassicLength(workerSource), classicLength)
        assert.ok(Number.isInteger(classicLength) && classicLength > 0 && classicLength < workerSource.length)

        // J-split: 前段可由 vm.Script 解析為 classic 腳本(只解析不執行)
        let front = workerSource.slice(0, classicLength)
        assert.doesNotThrow(() => new vm.Script(front), '前段須為合法 classic 腳本')

        // J-split: 其後只剩末尾 export { X as default };
        assert.ok(EXPORT_TAIL.test(workerSource.slice(classicLength)), `前段之後須只剩末尾 export, 實為[${JSON.stringify(workerSource.slice(classicLength))}]`)

        // J-split: 整份(含 export)不是合法 classic 腳本, 證明切分確有必要(前段與整份之差即在此)
        assert.throws(() => new vm.Script(workerSource), /export/)
    })

    it('U48 findClassicLength: 合法輸入回傳切點; 不合法輸入拋錯(中止產製)', function() {
        // J-split: 合法(含動態 import(), classic 腳本允許)→ 切點為 export 前
        let okCode = 'const a = 1;\nself.onmessage = () => { import("x") };'
        let withExport = okCode + '\n\nexport { a as default };\n'
        assert.strictEqual(findClassicLength(withExport), okCode.length)
        assert.strictEqual(findClassicLength(okCode + '\nexport { a as default }'), okCode.length) //無分號亦可
        assert.ok(EXPORT_TAIL.test(withExport.slice(findClassicLength(withExport))))

        // J-split: 不合法輸入一律拋錯
        let bads = [
            ['無末尾 export', 'const a = 1;', /末尾非 export/],
            ['空字串', '', /末尾非 export/],
            ['export 非 default 形式', 'const a = 1;\nexport { a };', /末尾非 export/],
            ['export 之後仍有程式碼', 'const a = 1;\nexport { a as default };\nconst b = 2;', /末尾非 export/],
            ['前段殘留另一個 export', 'export const x = 1;\nconst a = 1;\nexport { a as default };', /非合法 classic 腳本/],
            ['前段殘留靜態 import', 'import x from "y";\nconst a = x;\nexport { a as default };', /非合法 classic 腳本/],
            ['前段含 import.meta', 'const a = import.meta.url;\nexport { a as default };', /非合法 classic 腳本/],
            ['前段含頂層 await', 'const a = await 1;\nexport { a as default };', /非合法 classic 腳本/],
            ['前段語法錯誤', 'const = ;\nexport { a as default };', /非合法 classic 腳本/],
        ]
        for (let [name, code, re] of bads) {
            assert.throws(() => findClassicLength(code), re, name)
        }
    })

    // ---- J-cond ----
    it('U49 needClassicWorker: file:// 與 Blob 來源不透明者走 classic, 其餘環境維持 module Blob', function() {
        // J-cond: 判斷表(Blob URL 之來源 = 建立它之環境的安全來源; 不透明者為字串 'null')
        let table = [
            ['Chrome 之 file://(Blob 來源 null)', 'blob:null/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'file:', origin: 'file://' }, true],
            ['protocol 為 file: 即走 classic, 不論 Blob 來源如何表示(Firefox/Safari 未測, 取最保守之 classic; 以假想之可辨識來源單獨釘住此條款)', 'blob:http://127.0.0.1:8080/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'file:' }, true],
            ['sandbox iframe(srcdoc): location.origin 與 Blob 來源皆 null', 'blob:null/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'about:', origin: 'null' }, true],
            ['sandbox iframe(src 為 http 頁): location.origin 仍為該 URL 之來源, 僅 Blob 來源為 null', 'blob:null/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'http:', origin: 'http://127.0.0.1:8195' }, true],
            ['http', 'blob:http://127.0.0.1:8080/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'http:', origin: 'http://127.0.0.1:8080' }, false],
            ['https', 'blob:https://example.com/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'https:', origin: 'https://example.com' }, false],
            ['https(含埠)', 'blob:https://example.com:8443/6f1c1c9e-0000-4000-8000-000000000001', { protocol: 'https:', origin: 'https://example.com:8443' }, false],
        ]
        for (let [name, urlBlob, loc, expected] of table) {
            assert.strictEqual(needClassicWorker(urlBlob, loc), expected, name)
        }

        // J-cond: 無 location(Node、SSR)而 Blob 來源可辨者依 Blob 來源判斷; 省略 loc 取 globalThis.location(Node 下無)
        assert.strictEqual(needClassicWorker('blob:null/x', null), true)
        assert.strictEqual(needClassicWorker('blob:http://a.example/x', null), false)
        assert.strictEqual(needClassicWorker('blob:http://a.example/x'), false)

        // J-cond: Blob URL 不可解析(缺值、非 URL)不走 classic, 且不拋錯
        for (let bad of [undefined, null, '', 'not a url', 123]) {
            assert.strictEqual(needClassicWorker(bad, { protocol: 'http:' }), false, `不可解析之 Blob URL[${String(bad)}]`)
        }
    })

    // ---- J-url ----
    it('U50 buildClassicWorkerUrl: 解碼後為前段加 //.cjs, 判為 classic, 編碼後無 ? 與 #, 特殊字元可還原', function() {
        // J-url: 原始碼含非 ASCII、#、?、%、反引號、${}、換行、引號與末尾 export
        let front = 'var a = "中文 #hash ?q=1 %41 `tpl` ${x} \'s\' \\"d\\"";\nself.x = a;'
        let src = front + '\n\nexport { a as default };\n'
        let len = findClassicLength(src)
        let url = buildClassicWorkerUrl(src, len)

        assert.ok(url.startsWith(PREFIX), '須為 data:text/javascript;charset=utf-8, 開頭')
        assert.strictEqual(new URL(url).protocol, 'data:')
        let decoded = decodeURIComponent(url.slice(PREFIX.length))
        assert.strictEqual(decoded, front + '\n//.cjs', '解碼後 = classic 前段 + 換行 + //.cjs')
        assert.ok(!/export/.test(decoded), '不含末尾 export')
        assert.doesNotThrow(() => new vm.Script(decoded), '解碼後仍為合法 classic 腳本(//.cjs 為行註解)')

        // J-url: 編碼後無 ? 與 #(否則 maplibre 去掉 ?/# 之後的 '.cjs' 判斷被截斷)
        assert.ok(url.indexOf('?') < 0 && url.indexOf('#') < 0, `編碼後不得含 ? 或 #: ${url.slice(0, 200)}`)
        assert.ok(isClassicWorkerUrl(url), 'maplibre 之判斷須視為 classic')
        assert.ok(!isClassicWorkerUrl(PREFIX + encodeURIComponent(front)), '對照: 不加 //.cjs 結尾則為 module')
    })

    it('U51 內嵌 worker 之 data: URL: 可還原為 classic 前段, 長度不超過 Chrome URL 上限 2 MiB', function() {
        // J-url: 以現行內嵌原始碼組出之 URL
        let url = buildClassicWorkerUrl(workerSource, classicLength)
        assert.strictEqual(decodeURIComponent(url.slice(PREFIX.length)), workerSource.slice(0, classicLength) + '\n//.cjs')
        assert.ok(isClassicWorkerUrl(url))
        assert.ok(url.indexOf('?') < 0 && url.indexOf('#') < 0)

        // J-url: Chrome 之 URL 長度上限為 2 MiB(2*1024*1024 字元), 超過則 fetch/new Worker 失敗; maplibre 升版使 worker 變大時須改以其他編碼
        let LIMIT = 2 * 1024 * 1024
        assert.ok(url.length < LIMIT, `data: URL 長度 ${url.length} 逾 Chrome 上限 ${LIMIT}(內嵌原始碼 ${workerSource.length} 字元)`)
    })

    // ---- J-maplibre ----
    it('U52 maplibre 內部判斷未變: 僅認 .cjs 結尾為 classic、跨來源且 classic 時 fetch 後建 Blob、以 URL 來源與 location.origin 判跨來源', function() {
        // J-maplibre: 讀實際被打包之 maplibre-gl 主程式(production build)
        let s = fs.readFileSync(new URL('../node_modules/maplibre-gl/dist/maplibre-gl.mjs', import.meta.url), 'utf8')
        assert.deepStrictEqual(checkMaplibreWorkerFactory(s), [], 'maplibre-gl 之 workerFactory 判斷已變, 須重新評估 src/js/mapCore.mjs 之 data: URL(//.cjs 結尾)作法, 並跑 test/e2e-fileprotocol.test.mjs')
    })

    it('U53 U52 之檢查本身有鑑別力: 對 maplibre 原始碼的各種改動皆被偵測', function() {
        // J-maplibre: 以實際原始碼為底做單點改動, 逐一須被偵測(防檢查式寫鬆而永遠通過)
        let s = fs.readFileSync(new URL('../node_modules/maplibre-gl/dist/maplibre-gl.mjs', import.meta.url), 'utf8')
        assert.deepStrictEqual(checkMaplibreWorkerFactory(s), [], '前提: 未改動者通過')
        let mutations = [
            ['classic 之判斷由 .cjs 改為 .cjs2', (t) => t.replaceAll('endsWith(`.cjs`)', 'endsWith(`.cjs2`)'), 'isClassicWorkerUrl'],
            ['classic 之判斷不再整串比對結尾(6.15.0 前之舊式)', (t) => t.replace(/(function [\w$]+\([\w$]\)\{return )[\w$]\.endsWith\(`\.cjs`\)\|\|/, '$1'), 'isClassicWorkerUrl'],
            ['classic 之判斷不再去掉 ? 與 #', (t) => t.replace(/(function [\w$]+\(([\w$])\)\{return \2\.endsWith\(`\.cjs`\))\|\|\2\.split\(\/\[\?#\]\/\)\[0\]\.endsWith\(`\.cjs`\)/, '$1'), 'isClassicWorkerUrl'],
            ['跨來源改為同來源才成立', (t) => t.replace(/(new URL\([\w$],[\w$]\.href\)\.origin)!==/, '$1==='), 'isCrossOrigin'],
            ['跨來源不再比對 location.origin', (t) => t.replace(/(new URL\([\w$],[\w$]\.href\)\.origin!==)[\w$]\.origin/, '$1""'), 'isCrossOrigin'],
            ['跨來源且 classic 不再 fetch', (t) => t.replace(/let ([\w$])=await ([\w$]+)\(([\w$])\);try\{return ([\w$]+)\(\1,([\w$])\)\}finally\{URL\.revokeObjectURL/, 'let $1=$3;try{return $4($1,$5)}finally{URL.revokeObjectURL'), 'workerFactory'],
            ['同來源不再直接建 worker', (t) => t.replace(/(,[\w$]=![\w$]+\([\w$]\);)if\(!([\w$]+)\(([\w$])\)\)return ([\w$]+)\(\3,([\w$])\);/, '$1'), 'workerFactory'],
            ['fetch 輔助不再檢查 response.ok', (t) => t.replace(/if\(!([\w$])\.ok\)throw Error\(`Failed to fetch worker script/, 'if(!1)throw Error(`Failed to fetch worker script'), 'fetch 輔助'],
        ]
        for (let [name, mutate, expected] of mutations) {
            let t = mutate(s)
            assert.notStrictEqual(t, s, `變異未生效: ${name}`)
            assert.ok(checkMaplibreWorkerFactory(t).includes(expected), `改動應被偵測為[${expected}]: ${name}`)
        }
    })

})
