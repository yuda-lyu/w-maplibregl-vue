# 套件現況(state)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,不寫過程(過程見 `sgud/exp/experience.md`);與 `sgud/rule/rulebook.md`(藍圖)比對即知尚未做到者.

- **套件版本**:1.0.61(2026-11-02 主控發布:file:// 與不透明來源之 worker〔Gitea #46〕;依賴升 w-component-vue ^2.5.38、wsemi ^1.9.40、w-package-tools ^1.1.22;版號與發布由主控流程定);`maplibre-gl` 固定 6.14.0(R1).
- **最近一次驗證**:2026-11-02 mlw267(發布與建置腳本依 dspec〈自有套件之發布與建置腳本〉:worker 腳本改名 `toolg/gDistRollupWorkerFuncs.mjs`、`e2e-fileprotocol` 改為副本並指定 cwd 執行 toolg 腳本、新增 `unit-workerBuild` U54–U55、sgud 撤除據偏離寫法所立之規則):全套 `npm test` 154 passing / 0 failing(第 2 次;第 1 次 153 passing / 1 failing,失敗為 `e2e-movestate` E2E-M6 之已知偶發,同案單跑 0/9 紅);改前同日全套 152 passing / 0 failing;建置實跑(`cleanFolder` → jsdoc → `gDistRollupWorkerFuncs` → `gDistApp` → `gExtractHtml` → `gDocExams` → `gDistRollupComps`)後 `dist/` 兩檔位元組與改前相同,`src/js/maplibreWorkerInline.mjs` 僅註解中之腳本名三行不同(報告 `C:\opensrcOper\dnow\20261102075126\agent-out\mlw267-修正報告.md`).2026-11-02 mlfile(file:// 與不透明來源之 worker,Gitea #46,R17):`unit-workerClassic` U47–U53(7 案)、`e2e-fileprotocol` E2E-F1–F4(4 案)、全套 `npm test` 152 passing / 0 failing(第 2 次;第 1 次 151 passing / 1 failing,失敗為 `e2e-movestate` E2E-M6 之偶發,見待辦),修前 141 passing(2026-10-31 map30c);`./dist` 以新碼重建後於 file:// 實測點位 3、面板可見(報告 `C:\opensrcOper\dnow\20261102000509\agent-out\mlfile-修正報告.md`).2026-10-31 map30(圖台移動狀態 `state` 屬性):`unit-moveState` U33–U46 含 U42b(15 案)、`e2e-movestate` 20 案、全套 `npm test`(結果見任務報告 `C:\opensrcOper\dnow\20261031175415\agent-out\map30-修正報告.md`);2026-10-31 map30c 修 `e2e-hover` 視窗高後全套 `npm test` 141 passing / 0 failing(報告 `…\map30c-修正報告.md`).其餘條目最近一次整體驗證為 2026-10-16(各條 R 之盤點日期).

| 功能 | 規則 | 測試 | 現況與缺口 |
| --- | --- | --- | --- |
| maplibre-gl 固定版號、namespace 匯入、內嵌 worker、建置順序 | R1–R4 | `unit-workerBuild` U54–U55(R1 守門①)+ 盤點指令 | 已做;內嵌 worker 產製腳本為 `toolg/gDistRollupWorkerFuncs.mjs`(2026-11-02 由 `gDistRollupMaplibreGlWorker.mjs` 改名);發布列序與 toolg 寫法依 dspec〈自有套件之發布與建置腳本〉,本套件不另立規則(R4) |
| 測試配置 | R5 | — | 已做;缺口:`test/tools/e2e-setup.mjs` 之 exit/SIGINT/SIGTERM 備援為非同步 `spawn('taskkill')` 實測無效(待裁示) |
| 圖磚來源 minzoom/maxzoom、底圖/地形欄位與 JSDoc、底圖欄位執行期變更、預設底圖層級、url 無效略過 | R6–R10 | `unit-basemapManager` U1–U16、U27–U29;`e2e-basemapzoom` | 已做;缺口:僅 `name` 變更亦走 P3(F5)、terrainMap 任一欄位變更皆全重建(F10)、hillshade 與 terrain 同 url 時 hillshade 欄位不生效(F7) |
| 圖台縮放範圍、opt↔地圖寫回、輸入正規化、比例尺 | R11–R13、R15 | `unit-zoomRange` U17–U26、U30–U32;`e2e-zoomrange` E2E-Z1–Z21 | 已做;已知限制 L1–L7、D4(縮放鈕於邊界不顯示停用)見帳本 |
| 疊加層 opacity | R14 | `unit-basemapManager` U28–U29;`e2e-opacity` O1–O4 | 已做 |
| 圖台移動狀態(根節點 `state`:`moving`/`idle`) | R16 | `unit-moveState` U33–U46 含 U42b;`e2e-movestate` M1–M14(20 案);範例頁 `AppBSCMoveState.vue` | 已做:movestart/滾輪預標記/投影遷移 → moving,idle 事件為主、逾時後備(相機停止 3000ms、滾輪後 600ms);限制:慢網路圖磚逾 3000ms 未載完時先轉 idle、不反映資料圖層增刪改 |
| file:// 與不透明來源(sandbox iframe)之 worker 載入 | R17(連帶 R3) | `unit-workerClassic` U47–U53;`unit-workerBuild` U54–U55;`e2e-fileprotocol` E2E-F1–F4(`before` 以副本並指定 cwd 執行 `toolg/gDistRollupComps.mjs`) | 已做:`mapCore.needClassicWorker`(`protocol === 'file:'` 或 Blob URL 來源為 `null`)→ classic data: URL(`//.cjs` 結尾),其餘環境維持 module Blob;切分規則 `toolg/gDistRollupWorkerFuncs.mjs` 之 `findClassicLength`(`vm.Script` 驗證,不合法中止產製)→ `maplibreWorkerInline.mjs` 之 `classicLength`(508994);README 已寫明.缺口:Firefox/Safari 於 file:// 未測;自帶 CSP 者(file:// 需 `worker-src blob:` 且 `connect-src` 允許 `data:`)未處理(原本即失敗) |

待辦/待裁示:

- **`CLAUDE.md:11` 仍寫舊檔名**(`toolg/gDistRollupMaplibreGlWorker.mjs`;2026-11-02 mlw267 改名為 `gDistRollupWorkerFuncs.mjs`):`CLAUDE.md` 不入版控且 agent 不改,待使用者或主控更新.
- **`toolg/gDistRollupWorkerFuncs.mjs` 之內容是否仍屬 dspec 標準寫法待裁示**:本輪依指示只改檔名(內容與產物不變),腳本內含套件專屬檢查(`dependencies.maplibre-gl` 須為固定版號且等於安裝版,對應使用者 2026-10-16 指示;`findClassicLength` 之 `vm.Script` 驗證)與以 `fileURLToPath(import.meta.url)` 判斷是否直接執行(`:144`,使測試可 import `findClassicLength` 而不觸發產製);R1 守門①、R17 之切分規則皆依賴之,故未動.

- **`e2e-movestate` E2E-M6(resize)偶發紅**(2026-11-02 mlfile 全套第 1 次):狀態序列多出一組 `moving → idle`(`['moving','idle','moving','idle']`,斷言 `無中途 idle 閃爍`);同一案單跑 0/10、整檔 0/3、全套第 2 次通過,屬不穩定,未改碼、未查出根因(本次改動未觸及 resize 與 `moveState`;http 路徑行為不變,仍以 Blob 建 module worker);若再現,依全域規範 §15 先以失敗率判斷,並查 resize 後第二次 `movestart`/`projectiontransition` 之來源.2026-11-02 mlw267 全套第 1 次再現(同序列 `['moving','idle','moving','idle']`),同案單跑 0/9、全套第 2 次通過;該輪改動僅限 toolg、測試與註解,與 resize 無關(改前同日基準全套 152 passing 亦曾綠);全套下已觀察 5 次紅 2 次(mlfile 第 1 次、mlw267 改後第 1 次),根因仍未查.

- **`e2e-hover` 8 案紅(E2E-004/005/006/008/010/012/014/015)已修**(2026-10-31 map30c;根因查證 map30b):根因是 map30 於範例頁 `src/App.vue` 之 `basic` 子選單新增 `'moveState'`,選單由 8 項變 9 項、第 9 項換行,canvas 下移 33px(頂緣 366 → 399),`e2e-hover` 以固定 1000×760 視窗硬算之下排目標(緯度 23.92,視窗 y 743 → 776)出界,滑鼠落在視窗外而地圖收不到 mousemove(症狀:cursor 不變 pointer、tooltip 不出現、E2E-010 截圖 clip 越界);非依賴、非元件、非環境、非圖磚.修法:`test/e2e-hover.test.mjs` 視窗高 760 → 1100(`VIEWPORT`),`gotoExample` 取得 canvas `boundingBox` 後加前置斷言(最低目標 `LOWEST_TARGET_LAT` 出界即以「目標落在視窗外:範例頁版面改變」失敗);範例頁選單未動.修前 9 passing / 8 failing → 修後單檔 17 passing;視窗高變異回 760 時 17 案皆以新斷言失敗(0 筆逾時).全套 2026-10-31:141 passing / 0 failing.判準見規則帳本〈e2e 映射〉「以視窗座標定位之 e2e」.

- `e2e-setup.mjs` 備援改 `execSync`(R5,待使用者裁示).
- 建議書 Gitea #30 之發布與刪除建議檔由主控處理;若要提供 `state` 變化之 `$emit` 事件(目前僅屬性),屬另案.
