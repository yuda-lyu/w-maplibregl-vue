// 供 unit-e2eLaunch／api-e2eLaunch 以真實子行程載入 e2eLaunch.mjs 並回報啟動點送出之選項(配套工具, 非測試檔; 規則帳本 R20)。
// 用法: node test/tools/e2eLaunchChild.mjs <fake|real>
//   fake: 以 wpw.setBrowserTypeForTest 之替身接住啟動(不啟動任何瀏覽器), 回報替身收到之「合併後」選項
//   real: 替身只記錄選項, 再以 next() 走真路徑啟動 headless shell(經 w-playwright), 取版本後關閉
// 輸出最後一行為 `RESULT:<json>`。
// 為何用子行程: 啟動點與替身取自同一份真實 node 載入之 w-playwright(依賴樹有兩份時, 替身只作用於呼叫者那一份);
//   且替身不會殘留於 mocha 行程內(其餘 e2e 檔同一行程內真啟動)。真路徑也在乾淨之 node 行程中跑。
import wpw from 'w-playwright'
import launchE2eBrowser from './e2eLaunch.mjs'

let mode = process.argv[2] === 'real' ? 'real' : 'fake'
let seen = []

//只取斷言需要之欄位(undefined 以旗標表示, 避免 JSON 序列化吃掉)
let snapshot = (opt) => {
    return {
        args: opt.args,
        ignoreDefaultArgs: opt.ignoreDefaultArgs,
        headless: opt.headless,
        channelUndefined: opt.channel === undefined,
        executablePathUndefined: opt.executablePath === undefined,
        hasIgnoreAll: Object.prototype.hasOwnProperty.call(opt, 'ignoreAllDefaultArgs'),
    }
}

let restore = wpw.setBrowserTypeForTest({
    async launch(opt, next) {
        seen.push(snapshot(opt))
        if (mode === 'real') {
            return next()
        }
        return { async close() {}, version: () => 'fake' }
    },
    async launchPersistentContext() {
        throw new Error('e2e 啟動點不應呼叫 launchPersistentContext')
    },
})

let out = { mode, calls: 0, seen, version: '', tableMatch: null, coreVersion: '' }
try {
    //與 e2e 各檔之呼叫形狀相同(headless: true), 另帶一個呼叫端自給參數, 驗證原選項被轉傳並併入合併結果
    let browser = await launchE2eBrowser({ headless: true, args: ['--lang=en-US'] })
    out.version = browser.version()
    await browser.close()
}
finally {
    restore()
}
let info = wpw.getPlaywrightInfo()
out.calls = seen.length
out.tableMatch = info.tableMatch
out.coreVersion = info.coreVersion
console.log('RESULT:' + JSON.stringify(out))
