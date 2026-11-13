// e2e 啟動瀏覽器之唯一站點(規則帳本 R20; 排程第 442 項)。
//
// 一律經自有套件 w-playwright 啟動(本套件不直接依賴 playwright／playwright-core): w-playwright 於每次啟動合併出恰一串 `--disable-features`
// (Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者), 避免 Windows 上 Chromium 系瀏覽器每啟動一個新根行程即以
// 錯誤密碼替目前使用者登入一次、累積而鎖住帳號。不提供停用守門之選項。
//
// 本套件 e2e 各檔皆傳 `{ headless: true }`(不給 channel／executablePath): 與修前同為無頭之 headless shell(不是真 Chrome／Edge／完整 Chromium),
// Playwright 版本(1.64.1)與預設參數不變, 守門僅多停用一個與繪製無關之功能。不改用 w-package-tools-e2e 之 launchBrowser(其多帶六個確定性渲染旗標, 會改變像素)。
// autoInstall: true — 受管瀏覽器(Playwright 1.64.1 之 headless shell)缺檔時安裝一次再啟動(同修前之行為; 離線改設 PLAYWRIGHT_BROWSERS_PATH, 見 README〈Testing〉)。
//
// 若日後有測試改啟動真 Chrome／Edge／完整 Chromium(channel／headed): 依設計須每檔最多啟動一次(before 起、after 關, 案例各開 newContext)、
// 以 wpw.findSystemChrome 判斷可用性(不以真啟動探測), 並於跑前後讀錯誤密碼次數。
//
// 接線測試見 unit-e2eLaunch(替身接住, 不啟動瀏覽器)與 api-e2eLaunch(真路徑, 啟動 headless shell 一次); 配套子行程 e2eLaunchChild.mjs。
import wpw from 'w-playwright'

/**
 * 啟動 e2e 用之瀏覽器(Promise<Browser>); 每個 case 各呼叫一次, 由呼叫端負責 close
 * @param {Object} [opt={}] - Playwright chromium.launch 之選項(e2e 各檔皆傳 { headless: true }), autoInstall 恆為 true
 * @returns {Promise<Object>} 回傳 Promise, resolve 為 Playwright Browser
 */
async function launchE2eBrowser(opt = {}) {
    return wpw.launchChromium({ ...opt, autoInstall: true })
}

export default launchE2eBrowser
