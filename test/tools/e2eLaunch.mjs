// e2e 取得與啟動瀏覽器之唯一站點(規則帳本 R20; 排程第 442、632 項)。
//
// 啟動: 一律經自有套件 w-playwright 啟動(本套件不直接依賴 playwright／playwright-core): w-playwright 於每次啟動合併出恰一串 `--disable-features`
// (Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者), 避免 Windows 上 Chromium 系瀏覽器每啟動一個新根行程即以
// 錯誤密碼替目前使用者登入一次、累積而鎖住帳號。不提供停用守門之選項。
//
// 本套件 e2e 各檔皆傳 `{ headless: true }`(不給 channel／executablePath): 與修前同為無頭之 headless shell(不是真 Chrome／Edge／完整 Chromium),
// Playwright 版本與預設參數不變, 守門僅多停用一個與繪製無關之功能。不改用 w-package-tools-e2e 之 launchBrowser(其多帶六個確定性渲染旗標, 會改變像素)。
//
// 取得(排程第 632 項): 受管瀏覽器(headless shell, 壓縮檔約 130 MB)缺檔時須下載安裝, 時間取決於頻寬。原 `launchE2eBrowser` 帶 `autoInstall: true`,
// 於每檔第一個案之 `beforeEach` 內隱性安裝, 受該案之時限(`--timeout 180000`)約束, 慢網路下逾時而整檔紅。現改為「集中取得、時限對齊安裝預算」:
//   ① `ensureE2eBrowser()` 為取得瀏覽器之唯一入口(同一 Node 行程只做一次, 結果以 Promise 記憶; 失敗亦記憶, 後續呼叫立即以同一錯誤失敗, 不重試十幾分鐘);
//   ② 逾時為 `PW_INSTALL_BUDGET_MS`(安裝子行程逾時即結束其行程樹並失敗), 呼叫它之 `before` 之限時為預算加 60 秒(各 e2e 檔第一個 `before`; unit-e2eLaunch EL-03e 檢查);
//   ③ `launchE2eBrowser` 改 `autoInstall: false`: 其後各案只用已備妥者, 缺檔以 E_BROWSER_MISSING 立即失敗, 不在案內隱性下載。
// 若日後有測試改啟動真 Chrome／Edge／完整 Chromium(channel／headed): 另須 `ensureChromium({ kind: 'chromium' })` 取得完整 Chromium 或以 `wpw.findSystemChrome` 判斷可用性,
// 並依設計每檔最多啟動一次(before 起、after 關, 案例各開 newContext)、跑前後讀錯誤密碼次數。
//
// 接線測試見 unit-e2eLaunch(替身接住, 不啟動瀏覽器; EL-06 以替身驗取得之記憶、預算與紀錄)與 api-e2eLaunch(真路徑, 取得並啟動 headless shell 一次); 配套子行程 e2eLaunchChild.mjs。
import wpw from 'w-playwright'

/**
 * 取得受管瀏覽器(安裝)之逾時預算, 毫秒
 * 取值依據(2026-11-25 實測與推算): headless shell 壓縮檔 129,830,431 B(Chrome 159.0.8154.6, 另有數 MB 之 ffmpeg 與 winldd), 約 131 MB;
 *   900000 ms(15 分鐘)可容忍持續頻寬 ≥ 0.146 MB/s(約 1.2 Mbit/s); 舊寫法受案時限 180000 ms 約束, 頻寬 < 0.73 MB/s(約 5.8 Mbit/s)即逾時。
 *   本機實測下載約 3 秒(不逾時, 故自然環境不重現); 限速鏡像 500 KB/s 下約 5 分鐘(舊寫法紅、新寫法綠, 實測與重現作法見規則帳本 R20)。
 *   w-playwright 尚未匯出建議之安裝預算常數; 其匯出後改引用之。
 * @type {number}
 */
export const PW_INSTALL_BUDGET_MS = 900000

//失敗時附於錯誤訊息之安裝子行程輸出末段之長度上限(字元); w-playwright 之錯誤只有離開碼, DNS 失敗、404、磁碟滿等真因只存在子行程輸出
const INSTALL_TAIL_MAX = 2000

//去除終端機色碼(以 String.fromCharCode 組字, 避免 no-control-regex)
const RE_ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

/**
 * 建立「同行程只做一次」之取得函數(測試以替身注入 ensureChromium; 預設實例見 ensureE2eBrowser)
 * @param {Function} ensureChromium - 取得瀏覽器之函數(wpw.ensureChromium 形狀: opt => Promise<{ kind }>)
 * @param {Function} [log=console.log] - 一行紀錄出口(取得完成與下載項目)
 * @returns {Function} 無參數函數, 回傳 Promise<{ kind }>; 重複呼叫回傳同一個 Promise(失敗亦然)
 */
export function createEnsureE2eBrowser(ensureChromium, log = console.log) {
    let pending = null
    return function ensure() {
        if (pending !== null) {
            return pending
        }
        let t0 = Date.now()
        let nStart = 0
        let nDownload = 0
        let tail = ''
        let keepTail = (s) => {
            tail = (tail + s).slice(-INSTALL_TAIL_MAX)
        }
        pending = Promise.resolve()
            .then(() => ensureChromium({
                kind: 'headless-shell', //與 e2e 各檔之 launchE2eBrowser({ headless: true }) 所用之種類一致
                timeout: PW_INSTALL_BUDGET_MS,
                onTrace: (ev) => {
                    if (ev && ev.type === 'install-start') {
                        nStart++
                    }
                },
                funLog: (label, safe, detail) => {
                    //Playwright 之安裝輸出: 實際下載一個項目(瀏覽器、ffmpeg、winldd)時才有 `Downloading ...` 行(重試各算一次), 已備妥者無
                    if (label === 'install-output') {
                        let s = String(detail)
                        nDownload += (s.match(/Downloading /g) || []).length
                        keepTail(s)
                    }
                    else if (label === 'install-error') {
                        keepTail(`\n[install-error] ${detail && detail.message ? detail.message : String(detail)}\n`)
                    }
                },
            }))
            .then((r) => {
                log(`[e2e-browser] 已備妥受管瀏覽器(${r && r.kind}): 安裝程序 ${nStart} 次, 下載動作 ${nDownload} 次(依 Playwright 輸出之 Downloading 行計; 0＝本機已備妥, 但 npm loglevel 為 silent／error／warn 時 Playwright 不輸出而恆為 0), 用時 ${Date.now() - t0} ms(預算 ${PW_INSTALL_BUDGET_MS} ms)`)
                return r
            })
            .catch((err) => {
                let code = err && err.code ? err.code : 'E_ENSURE'
                let out = tail.replace(RE_ANSI, '').trim()
                let msg = `取得 e2e 受管瀏覽器失敗(${code}: ${err && err.message}); 用時 ${Date.now() - t0} ms, 預算 ${PW_INSTALL_BUDGET_MS} ms; `
                if (out) {
                    msg += `安裝輸出末段: ${out}; `
                }
                msg += '離線請依 README〈Testing〉以 PLAYWRIGHT_BROWSERS_PATH 指向已備妥之資料夾'
                let e = new Error(msg, { cause: err })
                e.code = code
                throw e
            })
        return pending
    }
}

/**
 * 取得 e2e 用之受管瀏覽器(無頭 headless shell; 缺檔時下載安裝, 逾時為 PW_INSTALL_BUDGET_MS); 同一 Node 行程只做一次
 * 各 e2e 檔須於其第一個 `before` 先 `this.timeout(PW_INSTALL_BUDGET_MS + 60000)` 並 `await ensureE2eBrowser()`, 其後之 `launchE2eBrowser` 才可用
 * @returns {Promise<Object>} 回傳 Promise, resolve 為 { kind }
 */
export const ensureE2eBrowser = createEnsureE2eBrowser((opt) => wpw.ensureChromium(opt))

/**
 * 啟動 e2e 用之瀏覽器(Promise<Browser>); 每個 case 各呼叫一次, 由呼叫端負責 close; 只用已備妥之瀏覽器(須先 ensureE2eBrowser)
 * @param {Object} [opt={}] - Playwright chromium.launch 之選項(e2e 各檔皆傳 { headless: true }), autoInstall 恆為 false
 * @returns {Promise<Object>} 回傳 Promise, resolve 為 Playwright Browser
 */
async function launchE2eBrowser(opt = {}) {
    return wpw.launchChromium({ ...opt, autoInstall: false })
}

export default launchE2eBrowser
