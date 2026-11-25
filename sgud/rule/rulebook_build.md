# 規則帳本(依賴、建置與 worker 載入)

本檔為 `sgud/rule/rulebook.md` 之分檔(2026-11-06 依全域設定 sgud 過長整理):maplibre-gl 依賴與匯入、worker 設定、建置順序、file:// 與不透明來源之 worker 載入.節號、標題與內容與拆分前一致,只搬移;索引與盤點指令說明見 `rulebook.md`.**各次升版之〈破壞性變更紀錄〉(5.24.0 → 6.x、6.14.0 → 6.16.0、6.16.0 → 6.18.0、6.18.0 → 6.19.0)自 2026-11-25 tml619 起於 `rulebook_upgrade.md`**(本檔增 6.19.0 紀錄後將逾 30 KB,依 sgud 過長整理逐字搬移).

## R1 maplibre-gl 依賴固定版號,且三處版本一致

- **要求**:`package.json` 之 `dependencies.maplibre-gl` 為固定版號(無 `^`/`~`),且 = 實際安裝版 = 內嵌 worker 版(`maplibreWorkerInline.mjs` 之 `maplibreVersion`).
- **why**:內嵌 worker 依開發端安裝版打包;範圍版號時使用端以 src 引用本套件,主程式取自其 node_modules 而可能為較新版,與 worker 不一致即可能崩潰(maplibre 6.13.0 曾修「stale cached worker crashing the map」).固定後 npm 保證本套件 src 解析到該版(使用端另依賴他版時為本套件巢狀安裝).
- **單一擁有者**:版號只在 `package.json` 改;改後 `npm i` → `node toolg/gDistRollupWorkerFuncs.mjs`.
- **盤點**:`node -e "let p=require('./package.json').dependencies['maplibre-gl'],i=require('./node_modules/maplibre-gl/package.json').version,w=(require('fs').readFileSync('./src/js/maplibreWorkerInline.mjs','utf8').match(/maplibreVersion = \"([^\"]+)\"/)||[])[1];console.log(JSON.stringify({spec:p,installed:i,inline:w,ok:/^\d+\.\d+\.\d+$/.test(p)&&p===i&&i===w}))"` → 須 `ok:true`.2026-10-16:三處皆 `6.14.0`;2026-11-09:三處皆 `6.16.0`(`npm i maplibre-gl@6.16.0 --save-exact` → `node toolg/gDistRollupWorkerFuncs.mjs`,內嵌檔 `maplibreVersion = "6.16.0"`、`classicLength = 520092`,升版項目見〈破壞性變更紀錄:maplibre-gl 6.14.0 → 6.16.0〉);2026-11-19:三處皆 `6.18.0`(`npm i maplibre-gl@6.18.0 --save-exact` → `node toolg/gDistRollupWorkerFuncs.mjs`,內嵌檔 `maplibreVersion = "6.18.0"`、`classicLength = 521333`,升版項目見〈破壞性變更紀錄:maplibre-gl 6.16.0 → 6.18.0〉);2026-11-25:三處皆 `6.19.0`(`npm i maplibre-gl@6.19.0 --save-exact` → `node toolg/gDistRollupWorkerFuncs.mjs`,內嵌檔 `maplibreVersion = "6.19.0"`、`classicLength = 551727`,升版項目見〈破壞性變更紀錄:maplibre-gl 6.18.0 → 6.19.0〉,各次升版紀錄於 `rulebook_upgrade.md`).
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

- **要求**:依 dspec〈自有套件之發布與建置腳本〉(主控之規格庫)規則 3 之型 B 列序與規則 4、5 之 toolg 標準寫法;本套件不另立列序、腳本寫法或盤點規則,`script.txt` 由使用者維護(agent 不改其內容與順序).
- **事實(非規則,供查證)**:`gDistApp`、`gDistRollupComps` 之產物皆含 `src/js/maplibreWorkerInline.mjs`,故先產 worker 進 src 之 `gDistRollupWorkerFuncs` 排在其前(即型 B 之〔gDistRollupWorkerFuncs〕位置);`gDistApp` 會清空 `docs/examples/`,其後接 `gExtractHtml`、`gDocExams`.
- **撤除(2026-11-02 依 dspec 規則 1)**:原要求中「各腳本單一職責,不於腳本內互相呼叫」與以 `node -e` 解析 `script.txt` 之列序盤點指令;列序之盤點改由主控 `tools/inventory-build.mjs` 統一處理.

## R17 file:// 與不透明來源之頁面須可載入 worker(Gitea #46)

- **要求**(使用端 提出:umd 產頁以檔案總管雙擊開啟〔file://〕時只剩底圖,點位與面板皆不顯示,console 有 `Worker failed to load`;1.0.5 正常為回歸):
  1. **兩條路徑,單一擁有者 `mapCore.ensureWorkerUrl()`**:`needClassicWorker(urlBlob, loc)` 為真——`loc.protocol === 'file:'`,或內嵌原始碼 Blob URL 之來源為不透明(`new URL(urlBlob).origin === 'null'`,sandbox iframe〔src 與 srcdoc〕)——時,釋放該 Blob URL 並以 `buildClassicWorkerUrl(workerSource, classicLength)`(`data:text/javascript;charset=utf-8,` + `encodeURIComponent(前段 + '\n//.cjs')`)供 `setWorkerUrl`;其餘環境(http(s)、webpack、vite、下游 bundler)維持 module Blob,行為不變(R3 之唯一 `setWorkerUrl` 呼叫點不變).
  2. **classic 前段之切分規則只在 `toolg/gDistRollupWorkerFuncs.mjs` 之 `findClassicLength(code)` 一處**:找末尾 `export { X as default };` 之位置,前段以 `vm.Script` 解析(不執行)驗證為合法 classic 腳本,不合法(殘留 import/export、`import.meta`、頂層 await、語法錯誤)即拋錯中止產製;結果寫入 `src/js/maplibreWorkerInline.mjs` 之 `export const classicLength`.`mapCore.mjs` 與測試只讀 `classicLength`,不重算切點.
  3. **判斷條件不得改為**:`location.origin === 'null'`(sandbox iframe 以 src 載入時 `location.origin` 仍為該 URL 之來源)、maplibre 之準則「Blob URL 來源與 `location.origin` 不同」(srcdoc 兩者皆 `'null'`),或 `protocol === 'file:'` 單獨(漏 sandbox iframe);三者皆有實測反例(見 `sgud/exp/experience.md`).`protocol === 'file:'` 條款在 Chromium 上與 Blob 來源條款重疊,保留為對 Firefox/Safari(未測)之保守條款.
  4. **依賴之 maplibre 內部判斷**(第三方實作細節,非公開 API):`isClassicWorkerUrl`(6.15.0 起:整串 URL 以 `.cjs` 結尾,**或**去掉 `?#` 後以 `.cjs` 結尾才走 classic;6.14.0 僅後者,本套件 data: URL 編碼後無 `?#` 且以 `//.cjs` 結尾,兩式皆成立)、`isCrossOrigin`、`workerFactory`(6.17.0 起〔#8912〕先判「不透明來源〔`globalThis.origin === 'null'`〕且為 module」→ `fetch` 後以 data: URL 建 module worker,**該分支只限 module,本套件之 classic data: URL 不經此分支**;其後跨來源且 classic → `fetch` 後建 classic Blob;同來源 → 直接 `new Worker(url)`).U52 對上列各項與不透明來源判斷、data: URL 輔助逐一以檢查式釘住(2026-11-19 wml550 隨 6.18.0 納入新分支).於 `mapCore.mjs` 註解寫明,由 unit U52/U53 與 e2e F1/F3/F4 釘住——maplibre-gl 升版若改了,測試即紅,須重新評估 data: URL 作法.
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
- **變異證明(2026-11-02,`tmp/mlfile/mutate.mjs`,逐一破壞後跑 `unit-workerClassic`〔+ `e2e-fileprotocol`〕,結束必還原並比對內容;紅燈案例實測)**:M1 `ensureWorkerUrl` 新分支改回原碼 → F1、F3、F4 紅(F2 綠);M2 去掉 Blob 來源不透明條款 → U49、F3、F4 紅(F1 綠);M3 去掉 `file:` 條款 → 僅 U49 紅(Chromium 上與 Blob 來源條款重疊,e2e 不可鑑別,見上〈要求〉3);M4 不編碼 → U50、U51 紅;M5 不加 `//.cjs` → U50、U51、F1、F3、F4 紅;M6 切分規則回傳切點加 5 → U47、U48、U50 紅;M7 略過 `vm.Script` 驗證 → U48 紅;M8 去掉 export 末尾錨點 → U48 紅;M9 `classicLength` 過期(少 1)→ U47 紅;M10 `classicLength` 含末尾 export → U47、F1、F3、F4 紅.maplibre 檢查式本身之鑑別力由 U53 的單點改動確認(2026-11-09 升 6.16.0 時由 7 種增為 8 種:新增「不再整串比對結尾」,並將識別字樣式由 `\w` 放寬為 `[\w$]`——6.16.0 之壓縮器產生含 `$` 之識別字如 `$c`,純 `\w` 比對不到而 U52/U53 紅;2026-11-19 升 6.18.0 時 `workerFactory` 檢查式納入 6.17.0 之不透明來源 module 分支、另增「不透明來源判斷」「data: URL 輔助」兩項檢查,變異由 8 種增為 12 種〔「同來源不再直接建 worker」之式依新結構改錨點,新增 4 種:該分支不再限 module、該分支被移除、判斷改字串、輔助不再編碼〕,修前 U52/U53 於 6.18.0 紅〔`workerFactory` 未過〕、修後綠).
