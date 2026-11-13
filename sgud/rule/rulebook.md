# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

> 盤點指令皆於專案根執行.`src/js/maplibreWorkerInline.mjs` 為 500KB 機器產製檔,grep 時一律排除.

## 索引:哪類查哪檔

本檔原約 91 KB,逾全域設定 30 KB 之整理門檻,2026-11-06 起依類型拆為下列分檔;**節號與標題不變**,既有引用(「規則帳本 R12」、「R16-6」等)照舊,依下表找檔.`### R12 實作後站點表` 隨 R12 置於 `rulebook_pose.md`.

| 類型 | 檔 | 收錄節 | 何時查 |
| --- | --- | --- | --- |
| 依賴、建置與 worker 載入 | `rulebook_build.md` | R1、R2、R3、R4、R17、〈破壞性變更紀錄:maplibre-gl 5.24.0 → 6.x〉 | 改 `package.json` 之 maplibre-gl 版號、`mapCore.mjs` 之 worker 設定、建置腳本或 `script.txt`、file:// 或 sandbox iframe 載入問題、升 maplibre-gl 大版時查 |
| 測試配置與 e2e | `rulebook_test.md` | R5、R19、R20、〈e2e 映射(本套件之落地與偏離)〉 | 新增或改測試檔、跑測試、改 e2e 啟動輔助、啟動瀏覽器(經 w-playwright,R20)或埠、查 e2e 映射與偏離時查 |
| 底圖、地形與疊加層 | `rulebook_basemap.md` | R6、R7、R8、R9、R10、R14、R18 | 改 `basemapManager.mjs`、`defBaseMaps.mjs`、`defTerrainMap.mjs`、底圖/地形/疊加層欄位或其執行期變更之差異判斷(含僅 `name`、僅地形倍率之就地路徑)、`previewOverlayOpacity` 時查 |
| 位姿(縮放範圍與 `opt` 寫回) | `rulebook_pose.md` | R11、R12(含〈R12 實作後站點表〉)、R13、〈破壞性/行為變更紀錄:圖台縮放範圍預設放寬〉、〈重評條件〉 | 改 `opt.zoom`/`opt.center`/`opt.minZoom`/`opt.maxZoom`、`changeOpt` 位姿段、寫回(`holdWriteBack`、`panTarget`、`syncZoomFromMap` 等)、`configProcessor.computeBasicOpt`/`computeZoomRange`,或要新增任何元件改寫 `opt` 之欄位、評估是否調整 `opt` 雙向同步結構時查 |
| 比例尺與移動狀態 | `rulebook_display.md` | R15、R16 | 改 `scaleBar.mjs`、比例尺顯示、`moveState.mjs`、根節點 `state` 屬性時查 |

分檔各於檔頭說明收錄範圍;新增規則時依上表類型放入對應分檔,並更新本索引(單一檔逾約 30 KB 再依類型拆分).
