# 規則帳本(依賴、建置與 worker 載入)

本檔為 `sgud/rule/rulebook.md` 之分檔(2026-11-06 依全域設定 sgud 過長整理):maplibre-gl 依賴與匯入、worker 設定、建置順序、file:// 與不透明來源之 worker 載入、5→6 破壞性變更紀錄.節號、標題與內容與拆分前一致,只搬移;索引與盤點指令說明見 `rulebook.md`.

## R1 maplibre-gl 依賴固定版號,且三處版本一致

- **要求**:`package.json` 之 `dependencies.maplibre-gl` 為固定版號(無 `^`/`~`),且 = 實際安裝版 = 內嵌 worker 版(`maplibreWorkerInline.mjs` 之 `maplibreVersion`).
- **why**:內嵌 worker 依開發端安裝版打包;範圍版號時使用端以 src 引用本套件,主程式取自其 node_modules 而可能為較新版,與 worker 不一致即可能崩潰(maplibre 6.13.0 曾修「stale cached worker crashing the map」).固定後 npm 保證本套件 src 解析到該版(使用端另依賴他版時為本套件巢狀安裝).
- **單一擁有者**:版號只在 `package.json` 改;改後 `npm i` → `node toolg/gDistRollupWorkerFuncs.mjs`.
- **盤點**:`node -e "let p=require('./package.json').dependencies['maplibre-gl'],i=require('./node_modules/maplibre-gl/package.json').version,w=(require('fs').readFileSync('./src/js/maplibreWorkerInline.mjs','utf8').match(/maplibreVersion = \"([^\"]+)\"/)||[])[1];console.log(JSON.stringify({spec:p,installed:i,inline:w,ok:/^\d+\.\d+\.\d+$/.test(p)&&p===i&&i===w}))"` → 須 `ok:true`.2026-10-16:三處皆 `6.14.0`;2026-11-09:三處皆 `6.16.0`(`npm i maplibre-gl@6.16.0 --save-exact` → `node toolg/gDistRollupWorkerFuncs.mjs`,內嵌檔 `maplibreVersion = "6.16.0"`、`classicLength = 520092`,升版項目見〈破壞性變更紀錄:maplibre-gl 6.14.0 → 6.16.0〉).
- **守門**:①建置期 `toolg/gDistRollupWorkerFuncs.mjs` 對「非固定版號」與「與安裝版不符」拋錯(2026-10-16 負向實測 4 案:`^`、`~`、不符各擋下,固定且相符放行;2026-11-02 起由 `test/unit-workerBuild.test.mjs` U55 以副本並指定 cwd 執行腳本自動驗證:`^`、`~`、未指定、不符 4 案皆非零離開且不產出,U54 為固定且相符放行);②執行期 `src/js/mapCore.mjs` 之 `ensureWorkerUrl()` 比對 `maplibregl.getVersion()` 與內嵌版,不符 `console.warn`.
- **已知限制**:使用端若自己也直接依賴另一版 maplibre-gl 並打包,bundle 會含兩份 maplibre;maplibre 之安全修補須由本套件改版跟進.

## R2 maplibre-gl 一律以 namespace 匯入

- **要求**:`import * as maplibregl from 'maplibre-gl'`,禁 default import(6.x 為 ESM-only 且無 default export,default import 得 undefined).
- **盤點**:`git grep -n --untracked "from 'maplibre-gl" -- src ':!src/js/maplibreWorkerInline.mjs'`;default 殘留:同指令改搜 `import maplibregl from 'maplibre-gl'`,須 0 筆.
- **站點全集(2026-10-16)**:`src/js/mapCore.mjs:10`、`src/js/popupManager.mjs:7` → 皆已套.CSS 另以 `import 'maplibre-gl/dist/maplibre-gl.css'` 引入(`src/components/WMaplibreglVue.vue`),路徑於 6.x 不變.

## R3 worker 只經 `ensureWorkerUrl()` 設定,且早於任何建圖

- **要求**:`setWorkerUrl` 只出現於 `mapCore.mjs` 之 `ensureWorkerUrl()`;所有 `new maplibregl.Map(` 之前須先呼叫它.不得於範例 `main.js` 或 `vue.config.js` 另設 worker(2026-10-01 曾以 `/mlg` 中介層暫解,已回收).
- **盤點**:`git grep -n --untracked -E "setWorkerUrl\(|new maplibregl\.Map\(|ensureWorkerUrl\(\)" -- src ':!src/js/maplibreWorkerInline.mjs'`.
- **站點全集(2026-11-02)**:定義 `mapCore.mjs:72`、唯一 `setWorkerUrl` 呼叫 `:99`、唯一建圖點 `:119`,其前 `:113` 呼叫 `ensureWorkerUrl()` → 已套.新增建圖點時須同步套用.`ensureWorkerUrl()` 內依環境分 module Blob 與 classic data: URL 兩路(R17),`setWorkerUrl` 仍只此一處.**交給 `setWorkerUrl` 之 module Blob URL 於頁面生命期內不得 revoke**(`mapCore.mjs:97` 保存於 `urlWorker`):maplibre 6.16.0 起 `WorkerPool.restart()` 於瀏覽器收掉背景 worker 後以 `config.WORKER_URL` 重建 worker,URL 失效即重建失敗;classic 路徑之 Blob URL 從未交給 maplibre,改走 data: URL 時 revoke(`:92`)無礙.
- **驗證**:dist 僅單一 umd 檔時,以 test-html 範例頁(http)實測 Worker URL 為 `blob:`、對外部 `maplibre-gl-worker`/`shared` 檔之請求 0、worker 錯誤 0(2026-10-16 通過);file:// 與 sandbox iframe 見 R17(`e2e-fileprotocol`).

## R4 建置順序(script.txt)

- **要求**:依 dspec〈自有套件之發布與建置腳本〉(`C:\opensrcOper\dspec\自有套件之發布與建置腳本.md`)規則 3 之型 B 列序與規則 4、5 之 toolg 標準寫法;本套件不另立列序、腳本寫法或盤點規則,`script.txt` 由使用者維護(agent 不改其內容與順序).
- **事實(非規則,供查證)**:`gDistApp`、`gDistRollupComps` 之產物皆含 `src/js/maplibreWorkerInline.mjs`,故先產 worker 進 src 之 `gDistRollupWorkerFuncs` 排在其前(即型 B 之〔gDistRollupWorkerFuncs〕位置);`gDistApp` 會清空 `docs/examples/`,其後接 `gExtractHtml`、`gDocExams`.
- **撤除(2026-11-02 依 dspec 規則 1)**:原要求中「各腳本單一職責,不於腳本內互相呼叫」與以 `node -e` 解析 `script.txt` 之列序盤點指令;列序之盤點改由主控 `tools/inventory-build.mjs` 統一處理.

## R17 file:// 與不透明來源之頁面須可載入 worker(Gitea #46)

- **要求**(使用端 提出:umd 產頁以檔案總管雙擊開啟〔file://〕時只剩底圖,點位與面板皆不顯示,console 有 `Worker failed to load`;1.0.5 正常為回歸):
  1. **兩條路徑,單一擁有者 `mapCore.ensureWorkerUrl()`**:`needClassicWorker(urlBlob, loc)` 為真——`loc.protocol === 'file:'`,或內嵌原始碼 Blob URL 之來源為不透明(`new URL(urlBlob).origin === 'null'`,sandbox iframe〔src 與 srcdoc〕)——時,釋放該 Blob URL 並以 `buildClassicWorkerUrl(workerSource, classicLength)`(`data:text/javascript;charset=utf-8,` + `encodeURIComponent(前段 + '\n//.cjs')`)供 `setWorkerUrl`;其餘環境(http(s)、webpack、vite、下游 bundler)維持 module Blob,行為不變(R3 之唯一 `setWorkerUrl` 呼叫點不變).
  2. **classic 前段之切分規則只在 `toolg/gDistRollupWorkerFuncs.mjs` 之 `findClassicLength(code)` 一處**:找末尾 `export { X as default };` 之位置,前段以 `vm.Script` 解析(不執行)驗證為合法 classic 腳本,不合法(殘留 import/export、`import.meta`、頂層 await、語法錯誤)即拋錯中止產製;結果寫入 `src/js/maplibreWorkerInline.mjs` 之 `export const classicLength`.`mapCore.mjs` 與測試只讀 `classicLength`,不重算切點.
  3. **判斷條件不得改為**:`location.origin === 'null'`(sandbox iframe 以 src 載入時 `location.origin` 仍為該 URL 之來源)、maplibre 之準則「Blob URL 來源與 `location.origin` 不同」(srcdoc 兩者皆 `'null'`),或 `protocol === 'file:'` 單獨(漏 sandbox iframe);三者皆有實測反例(見 `sgud/exp/experience.md`).`protocol === 'file:'` 條款在 Chromium 上與 Blob 來源條款重疊,保留為對 Firefox/Safari(未測)之保守條款.
  4. **依賴之 maplibre 內部判斷**(第三方實作細節,非公開 API):`isClassicWorkerUrl`(6.15.0 起:整串 URL 以 `.cjs` 結尾,**或**去掉 `?#` 後以 `.cjs` 結尾才走 classic;6.14.0 僅後者,本套件 data: URL 編碼後無 `?#` 且以 `//.cjs` 結尾,兩式皆成立)、`isCrossOrigin`、`workerFactory`(跨來源且 classic → `fetch` 後建 classic Blob;同來源 → 直接 `new Worker(url)`).於 `mapCore.mjs` 註解寫明,由 unit U52/U53 與 e2e F1/F3/F4 釘住——maplibre-gl 升版若改了,測試即紅,須重新評估 data: URL 作法.
- **why**:module worker + Blob URL 於 file:// 與 sandbox iframe 皆於非同步 `error` 事件失敗(Chromium 153 實測;建構子不丟錯,maplibre 的 try/catch 不會退回 classic),classic + Blob、module + data:、classic + data: 皆可;失敗無提示,與 `mapCore.mjs` 註解承諾「於 umd script / webpack / vite / 下游 bundler 皆一致可用」不符.完整實測表與成因見 `sgud/exp/experience.md`〈file:// 與不透明來源之 worker〉.
- **環境 × 路徑判準(2026-11-02 實測)**:

| 環境 | 路徑 | 實測 | 測試 |
| --- | --- | --- | --- |
| http(s) 頁面 | module Blob(不變) | worker 全為 `module` 且 `blob:`,點位 3、面板可見 | e2e F2 |
| file:// | classic(maplibre 判跨來源 → fetch data: → classic Blob) | 修前:點位 0、`Worker failed to load`;修後:點位 3、面板可見 | e2e F1 |
| sandbox iframe(src;`window.origin` 為 `null`、`location.origin` 為頁面來源) | classic | 修後:點位 3、面板可見 | e2e F3 |
| sandbox iframe(srcdoc;`location.origin` 為 `null`) | classic(同來源 → 直接 `new Worker(data:)`) | 修後:點位 3、面板可見 | e2e F4 |
| 上述環境自帶 CSP | 未處理(原本即失敗) | file://:需 `worker-src blob:` 且 `connect-src` 允許 `data:`(或不設);僅 `worker-src data:` 或 `connect-src 'self'` 時點位與面板不顯示 | `tmp/mlfile/probe-csp.mjs`(探測,未入測試);README 已寫明 |
| Firefox、Safari 於 file:// | 同 file:// 路徑(未測) | 未測 | — |

- **盤點**(皆排除 `src/js/maplibreWorkerInline.mjs`):
  - `git grep -nE --untracked "needClassicWorker|buildClassicWorkerUrl|classicLength" -- src toolg ':!src/js/maplibreWorkerInline.mjs'` → `mapCore.mjs`(import 1、定義 2、`ensureWorkerUrl` 呼叫 2)與 `toolg/gDistRollupWorkerFuncs.mjs`(產製 `classicLength`);
  - `git grep -nE --untracked "findClassicLength" -- src toolg test` → 切分規則定義 1(toolg)+ 呼叫 1(toolg 產製)+ unit 引用;`mapCore.mjs` 不得出現(規則只一處);
  - `git grep -nE --untracked "setWorkerUrl\(" -- src ':!src/js/maplibreWorkerInline.mjs'` → 仍僅 1 處(R3).
- **已知限制**:①CSP(上表);②僅 Chromium 實測,Firefox/Safari 於 file:// 未測(若其 Blob module worker 本即可用,現改走 classic data: URL,為最保守之形式但未實測);③data: URL 長度 733,682 字元(Chrome URL 上限 2 MiB 之 35%),maplibre 升版使 worker 增大逾約 2.8 倍時須改編碼(U51 守門);④classic 為 sloppy mode:acorn 掃內嵌 worker 無頂層 `this`/`arguments`(6 處 `this` 皆在 class `static{}` 內),日後出現須重新評估(是否加 `"use strict"` 前綴).
- **測試**:`test/unit-workerClassic.test.mjs` U47–U53(7 案:產製物與切分規則同步且前段為合法 classic 腳本、`findClassicLength` 合法/不合法輸入、`needClassicWorker` 判斷表、`buildClassicWorkerUrl` 形式與特殊字元還原、data: URL 長度、maplibre 內部判斷檢查式與其單點改動鑑別力);`test/unit-workerBuild.test.mjs` U54–U55(2 案,2026-11-02 新增:把 `toolg/gDistRollupWorkerFuncs.mjs`、`package.json`、`node_modules/maplibre-gl` 之 worker 與 package.json 複製到 `test/_tmp/unit-workerBuild/`,以該夾為 cwd 執行腳本;U54 驗離開碼 0、匯出恰 `maplibreVersion`/`classicLength`/`default`、版本 = 安裝版、`classicLength` = `findClassicLength(default)`、與入版控之產製物一致〔忽略換行〕;U55 驗 R1 守門①〔`^`、`~`、未指定、不符 4 案非零離開、說明原因、不產出〕);`test/e2e-fileprotocol.test.mjs` E2E-F1–F4(4 案:`before` 把 `src`、`toolg/gDistRollupComps.mjs`、`package.json` 複製到 `test/_tmp/e2e-fileprotocol/`,以該夾為 cwd 執行 `node toolg/gDistRollupComps.mjs` 得副本之 dist〔約 25 秒,不讀 `./dist`,建置選項只在 toolg 腳本內,測試不另寫〕,並驗產物與 sourcemap 存在、banner、全域匯出名 `w-maplibregl-vue`、無 external;`after` 刪除;測試頁 `test/fixtures/fileProtocol.html`;file:// 為真實路徑,http 與 sandbox 外層頁由 `context.route` 於虛擬來源 `http://127.0.0.1:8195` 供應,不開 port).
- **變異證明(2026-11-02,`tmp/mlfile/mutate.mjs`,逐一破壞後跑 `unit-workerClassic`〔+ `e2e-fileprotocol`〕,結束必還原並比對內容;紅燈案例實測)**:M1 `ensureWorkerUrl` 新分支改回原碼 → F1、F3、F4 紅(F2 綠);M2 去掉 Blob 來源不透明條款 → U49、F3、F4 紅(F1 綠);M3 去掉 `file:` 條款 → 僅 U49 紅(Chromium 上與 Blob 來源條款重疊,e2e 不可鑑別,見上〈要求〉3);M4 不編碼 → U50、U51 紅;M5 不加 `//.cjs` → U50、U51、F1、F3、F4 紅;M6 切分規則回傳切點加 5 → U47、U48、U50 紅;M7 略過 `vm.Script` 驗證 → U48 紅;M8 去掉 export 末尾錨點 → U48 紅;M9 `classicLength` 過期(少 1)→ U47 紅;M10 `classicLength` 含末尾 export → U47、F1、F3、F4 紅.maplibre 檢查式本身之鑑別力由 U53 的單點改動確認(2026-11-09 升 6.16.0 時由 7 種增為 8 種:新增「不再整串比對結尾」,並將識別字樣式由 `\w` 放寬為 `[\w$]`——6.16.0 之壓縮器產生含 `$` 之識別字如 `$c`,純 `\w` 比對不到而 U52/U53 紅).

## 破壞性變更紀錄:maplibre-gl 5.24.0 → 6.x

升版動機:5.24.0 帶 GHSA-jrc7-96c5-q579(Critical,XSS),修補版 6.4.1.2026-10-01 升 6.11.2,2026-10-16 固定 6.14.0(6.12～6.14 無 breaking 段落;6.13.0 起 worker 自足、shared 為空檔).

| v6 變更 | 本專案 | 處置 |
|---|---|---|
| ESM-only、移除 default export | 2 處 default import | 改 namespace(R2) |
| worker 改外部檔案 | 打包後 worker 失敗、地圖只剩底色 | 內嵌 Blob(R3) |
| WebGL2 強制 | headless chromium | 實測正常 |
| style-spec 25 拒 legacy expression | 全為現代語法,`['has','point_count']` 亦為現代 expression | 不影響 |
| GeoJSON 巢狀物件編 `__$json__` | 自塞 properties 全為 primitive | 專案碼不影響;使用者資料若含巢狀物件,popup/tooltip 收到之值會變 |
| `GeoJSONSource.setData` 移除第二參數與回傳值 | 6 處皆單參數、不取回傳值 | 不影響 |
| `zoomLevelsToOverscale` 預設改 4 | `queryRenderedFeatures` 多處 | e2e 34 案全過,命中未變 |
| icon scaling with offset 停用 | 有 `icon-offset`,`icon-size: 1` | e2e 全過 |
| 透明重疊線修正(line-opacity) | basemapManager 用 line-opacity | e2e 全過 |
| `map.transform` 移除、`MapLibreZoomEvent` 改名、`MapDataEvent` 移除、`styleimagemissing` 改 notify-only、Hash 改 URLSearchParams、`#pragma` 改名 | 皆未使用 | 不影響 |
| get/set Layout/PaintProperty 型別、TS target ES2022 | JS 專案經 babel | 不影響 |
| CSS 路徑 | `maplibre-gl/dist/maplibre-gl.css` | 不變 |

## 破壞性變更紀錄:maplibre-gl 6.14.0 → 6.16.0(2026-11-09 ml01)

升版依據:使用者原則「有新版且沒問題就升」(不跨主版號;6.17.0 未滿 7 天不採).作法依 R1:`npm i maplibre-gl@6.16.0 --save-exact` → `node toolg/gDistRollupWorkerFuncs.mjs`(只執行,toolg 未改;內嵌檔 `maplibreVersion` 6.14.0 → 6.16.0、`classicLength` 508994 → 520092、檔大小 513,335 → 524,437 位元組)→ 全套 `npm test` 223 passing / 0 failing.CHANGELOG 6.15.0、6.16.0 無 breaking 段落;兩版 `-dev.mjs` 以「依方法名抽本體逐字比對」(60 餘個方法)核對本套件用到之路徑:

| 6.15.0/6.16.0 變更 | 本專案 | 處置與依據 |
|---|---|---|
| `setWorkerUrl` 之 classic 判斷多「整串 URL 以 `.cjs` 結尾」條款(#8769) | R17 依賴 `isClassicWorkerUrl` | 本套件 data: URL 編碼後無 `?#` 且以 `//.cjs` 結尾,新舊兩式皆判 classic;`test/unit-workerClassic.test.mjs` 檢查式同步(U52/U53 修前紅 → 綠),`e2e-fileprotocol` F1–F4 綠 |
| 壓縮器產生含 `$` 之識別字(如 `$c`) | U52/U53 之正則以 `\w` 比對識別字 | 改 `[\w$]`;語意不變 |
| `WorkerPool.restart()`/`watchWorkers`:回前景 ping 失敗則以 `config.WORKER_URL` 重建 worker(#8461、#8491) | `ensureWorkerUrl` 之 URL 生命期 | module Blob URL 不 revoke(R3 已寫明);classic 為字串 data: URL;讀碼確認,未實測 iOS |
| `TileManager` 之 `error` 僅非 tile 層才標記 source 已載入,tile 失敗不再使 `load`/`idle` 提前為真(#8785) | R16 `moveState` 之 idle 判定、元件 `once('idle')` | `e2e-movestate` 26 案、`e2e-basemapzoom`(圖磚不存在層級)綠 |
| 地形:DEM 載入中 `jumpTo`/`_render` 不覆寫相機高程(#8549);DEM maxzoom 低於地形圖磚層級(#8765);低層級地形(#8772) | `applyTerrain`、`updateTerrainExaggeration` | `e2e-diffpath` D3/D4、`unit-diffpath` 綠;`setTerrain` 簽章不變 |
| popup 關閉鈕 `innerHTML="&#215;"` → `textContent="×"`(#8795) | 本套件以 class `maplibregl-popup-close-button` 設樣式 | 渲染同(U+00D7);popup 之 CSS 規則兩版逐條相同 |
| `Transform` 內部欄位收進 `_cameraState`(`setMinZoom`/`setMaxZoom`/`setZoom`/`resize` 等) | R11–R13、R16 | 方法本體僅欄位改名;Map 層 `setMinZoom`/`setMaxZoom` 驗證與訊息、`defaultMinZoom = -2`、`jumpTo`/`easeTo`/`panTo`/`stop`/`isMoving`/滾輪 `wheel`/`_start`/`renderFrame` 本體逐字相同 |
| MLT 之 accept 標頭依能力協商(#7483);過期向量圖磚 ETag(#8771);向量圖磚超過 maxzoom 切片(#8681) | 本套件支援 `vector`、`style` 底圖 | 讀碼層級;e2e 以離線 TileJSON 供應,未涵蓋真實向量圖磚伺服器之內容協商(**未實測**) |
| `dragRotate.around`、`addProjection`/`identity`、`setMaxBounds` 單軸、`transformStyle`、`font-faces`、`GeoJSONSource.updateData`/`getBounds`、`line-dasharray` 常數、`addImage` 跨 180°、`queryRenderedFeatures` 多邊形環 | 專案碼未使用(`git grep` 於 `src`)或僅為修正 | 不影響 |
| CSS | 僅控制項圖示/標誌之 data URI 與一條 `@media(forced-colors)` 包裝調整 | 本套件不用 maplibre 內建控制項圖示;popup 規則相同 |

**日後升版須重評(6.17.0,未採用)**:#8912(「map not loading from a file or in a sandboxed iframe」,與 R17 之 classic data: URL 作法直接相關,驗收為 `e2e-fileprotocol` F1–F4)、#8961(「camera movement bugs by using task scheduling」,相機事件時序,驗收為 `unit-moveState`、`e2e-movestate`).
