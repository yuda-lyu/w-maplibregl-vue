// e2e 埠之單一定義與保留(排程第 309 項, 2026-11-05 wm309; 規格 C:/opensrcOper/dspec/e2e埠與多套件同跑.md E1～E8; 套件 w-package-tools-e2e >= 1.0.22 README §2.12; 規則帳本 R-E2E-PORT-01)
//
// 本模組為「基準埠」唯一定義處, 並於模組載入時呼叫一次 reserveE2ePorts(本實例全部基準埠)——須早於任何 resolveE2ePort:
//   test/tools/e2e-setup.mjs 自本檔取得基準埠與保留(ES 模組先評估被匯入者, 故先於其本體之任何取埠)。本套件無逐檔 runner, 單元測試(unit-e2ePortReserve)亦自本檔取得。
// 行為(沒有占用時與導入前相同):
//   - 基準埠 8123 空閒 → 即基準埠, E2E_PORT_OFFSET 維持未設, 指令列(vue-cli-service serve --port 8123)、網址與行為皆與導入前相同。
//   - 基準埠被占用(別的套件正在跑, 或本機其他服務, 或本套件手動起的常駐 dev server) → 整組位移 portStep(預設 100)至空閒之組, 位移寫入 E2E_PORT_OFFSET,
//     其後 resolveE2ePort 一律取得同一組實際埠; 實際埠印入輸出([e2e-port] …)。絕不殺占用者、也不沿用占用者之服務(E4)。
//   - 手動設 E2E_PORT_OFFSET(含 0)＝不換埠: 0 為「沿用本機已起之常駐 dev server」逃生口(e2e-setup 另驗該監聽者確為本專案之 vue-cli-service, 否則拒絕); 上層已保留(E2E_PORT_HOLD)＝沿用上層之位移。
//
// OTHER_TEST_PORTS 為本套件其他測試寫死之埠(盤點 2026-11-05, 實查見規則帳本 R-E2E-PORT-01): 位移後之實際埠不得落在其上。
//   8195: e2e-fileprotocol 之虛擬 http 來源(context.route 於瀏覽器內供應, 不開 port、不連外; unit-workerClassic 亦以此字串當純函式輸入)。
//   現行基準埠 8123 以間距 100 位移, 實際埠恆以 23 結尾(8223、8323…), 不會落在 8195; 列出為防日後改基準埠或間距, 並由 unit-e2ePortReserve 守護清單與實際寫死埠一致(新增忘了列即紅)。
//   本套件無 api-／unit- 測試開真實監聽埠(unit-workerClassic 之 8080、8195 只是字串資料), 故無規格 E8 之撞埠待處理。

import reserveE2ePorts from 'w-package-tools-e2e/src/reserveE2ePorts.mjs'

//基準埠(正式實例用): vue-cli-service serve 之 dev server。其餘處一律經 resolveE2ePort(FRONTEND_PORT)／reservation.portOf(FRONTEND_PORT)。
export const FRONTEND_PORT = 8123
//其他測試寫死之埠(虛擬來源, 不監聽)
export const OTHER_TEST_PORTS = [8195]

export const reservation = reserveE2ePorts([FRONTEND_PORT], { avoid: OTHER_TEST_PORTS })
