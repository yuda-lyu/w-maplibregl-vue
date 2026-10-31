# 套件現況(state)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,不寫過程(過程見 `sgud/exp/experience.md`);與 `sgud/rule/rulebook.md`(藍圖)比對即知尚未做到者.

- **套件版本**:`package.json` 1.0.58(2026-10-31 未動,版號與發布由主控流程定);`maplibre-gl` 固定 6.14.0(R1).
- **最近一次驗證**:2026-10-31 map30(圖台移動狀態 `state` 屬性):`unit-moveState` U33–U46 含 U42b(15 案)、`e2e-movestate` 20 案、全套 `npm test`(結果見任務報告 `C:\opensrcOper\dnow\20261031175415\agent-out\map30-修正報告.md`);2026-10-31 map30c 修 `e2e-hover` 視窗高後全套 `npm test` 141 passing / 0 failing(報告 `…\map30c-修正報告.md`).其餘條目最近一次整體驗證為 2026-10-16(各條 R 之盤點日期).

| 功能 | 規則 | 測試 | 現況與缺口 |
| --- | --- | --- | --- |
| maplibre-gl 固定版號、namespace 匯入、內嵌 worker、建置順序 | R1–R4 | 建置期守門 + 盤點指令 | 已做 |
| 測試配置 | R5 | — | 已做;缺口:`test/tools/e2e-setup.mjs` 之 exit/SIGINT/SIGTERM 備援為非同步 `spawn('taskkill')` 實測無效(待裁示) |
| 圖磚來源 minzoom/maxzoom、底圖/地形欄位與 JSDoc、底圖欄位執行期變更、預設底圖層級、url 無效略過 | R6–R10 | `unit-basemapManager` U1–U16、U27–U29;`e2e-basemapzoom` | 已做;缺口:僅 `name` 變更亦走 P3(F5)、terrainMap 任一欄位變更皆全重建(F10)、hillshade 與 terrain 同 url 時 hillshade 欄位不生效(F7) |
| 圖台縮放範圍、opt↔地圖寫回、輸入正規化、比例尺 | R11–R13、R15 | `unit-zoomRange` U17–U26、U30–U32;`e2e-zoomrange` E2E-Z1–Z21 | 已做;已知限制 L1–L7、D4(縮放鈕於邊界不顯示停用)見帳本 |
| 疊加層 opacity | R14 | `unit-basemapManager` U28–U29;`e2e-opacity` O1–O4 | 已做 |
| 圖台移動狀態(根節點 `state`:`moving`/`idle`) | R16 | `unit-moveState` U33–U46 含 U42b;`e2e-movestate` M1–M14(20 案);範例頁 `AppBSCMoveState.vue` | 已做:movestart/滾輪預標記/投影遷移 → moving,idle 事件為主、逾時後備(相機停止 3000ms、滾輪後 600ms);限制:慢網路圖磚逾 3000ms 未載完時先轉 idle、不反映資料圖層增刪改 |

待辦/待裁示:

- **`e2e-hover` 8 案紅(E2E-004/005/006/008/010/012/014/015)已修**(2026-10-31 map30c;根因查證 map30b):根因是 map30 於範例頁 `src/App.vue` 之 `basic` 子選單新增 `'moveState'`,選單由 8 項變 9 項、第 9 項換行,canvas 下移 33px(頂緣 366 → 399),`e2e-hover` 以固定 1000×760 視窗硬算之下排目標(緯度 23.92,視窗 y 743 → 776)出界,滑鼠落在視窗外而地圖收不到 mousemove(症狀:cursor 不變 pointer、tooltip 不出現、E2E-010 截圖 clip 越界);非依賴、非元件、非環境、非圖磚.修法:`test/e2e-hover.test.mjs` 視窗高 760 → 1100(`VIEWPORT`),`gotoExample` 取得 canvas `boundingBox` 後加前置斷言(最低目標 `LOWEST_TARGET_LAT` 出界即以「目標落在視窗外:範例頁版面改變」失敗);範例頁選單未動.修前 9 passing / 8 failing → 修後單檔 17 passing;視窗高變異回 760 時 17 案皆以新斷言失敗(0 筆逾時).全套 2026-10-31:141 passing / 0 failing.判準見規則帳本〈e2e 映射〉「以視窗座標定位之 e2e」.

- `e2e-setup.mjs` 備援改 `execSync`(R5,待使用者裁示).
- 建議書 Gitea #30 之發布與刪除建議檔由主控處理;若要提供 `state` 變化之 `$emit` 事件(目前僅屬性),屬另案.
