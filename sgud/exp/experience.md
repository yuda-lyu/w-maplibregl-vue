# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

> **2026-11-06 抽出舊經驗**:下列 4 節(2026-10-01~10-31)已抽出至 `sgud/exp/experience_20261106.md`,節號與標題不變,需要時再調閱:
> - maplibre-gl 6.x 之 worker(2026-10-01 升 5→6、2026-10-16 固定 6.14.0)
> - maplibre-gl 6.14.0 縮放範圍與相機事件語意(2026-10-16 issue #3 審計與實作)
> - 寫回迴圈之實作與測試經驗(2026-10-16 issue #3 實作)
> - 圖台移動狀態 `state` 屬性之實作與測試經驗(2026-10-31 map30,Gitea #30,規則帳本 R16)
>
> 本檔其餘各節(含〈測試與實測腳本〉內提及之〈圖台移動狀態〉等標題引用)請依標題至上列抽出檔查找;規則帳本同日已依類型拆檔,索引見 `sgud/rule/rulebook.md`(原引用之 R1 等節號照舊,依索引找分檔).

> **2026-11-07 抽出舊經驗**:下列 3 節(2026-11-02~11-04)已抽出至 `sgud/exp/experience_20261107.md`,節號與標題不變:
> - file:// 與不透明來源(sandbox iframe)之 worker(2026-11-02 mlfile)
> - 比例尺色條與文字之實作與測試經驗(2026-11-04 wm71)
> - 疊加層透明度預覽 `previewOverlayOpacity` 之實作與測試經驗(2026-11-04 wm76)

> **2026-11-19 抽出舊經驗**:下列 2 節(2026-11-06~11-07)已抽出至 `sgud/exp/experience_20261119.md`,節號與標題不變:
> - 差異路徑(僅 name、僅地形倍率)與 `opt` 位姿契約文件之實作與測試經驗(2026-11-06 ma327,規則帳本 R8、R12〈重評條件〉)
> - 高負載下只出現一次之 e2e 紅之查證經驗(2026-11-07 mv329,`e2e-movestate` E2E-M8,規則帳本 R16)

> **2026-11-25 抽出舊經驗**:下列 2 節(maplibre-gl 升版,2026-11-09~11-19)已抽出至 `sgud/exp/experience_20261125.md`,節號與標題不變(下次升 maplibre-gl 先讀此二節與本檔〈升 maplibre-gl 6.18.0 → 6.19.0 之經驗〉):
> - 升 maplibre-gl 6.14.0 → 6.16.0 之經驗(2026-11-09 ml01,規則帳本 R1、R17)
> - 升 maplibre-gl 6.16.0 → 6.18.0 之經驗(2026-11-19 wml550,規則帳本 R1、R17)

> **2026-11-27 抽出舊經驗**:下列 3 節(2026-11-19~11-25)已抽出至 `sgud/exp/experience_20261127.md`,節號與標題不變(2026-11-25 之抽出說明所稱「本檔〈升 maplibre-gl 6.18.0 → 6.19.0 之經驗〉」現亦在該檔):
> - e2e 進場載入條件改 domcontentloaded 之經驗(2026-11-19 wml550b,規則帳本 R5〈e2e 進場載入條件〉)
> - e2e 取得受管瀏覽器之經驗(2026-11-25 tml632,排程第 632 項,規則帳本 R20 要求 5、6)
> - 升 maplibre-gl 6.18.0 → 6.19.0 之經驗(2026-11-25 tml619,規則帳本 R1)

## 建置流程(script.txt)

- **`gDistApp.mjs` 會清空 `docs/examples/`**(`rollupVueToHtml` 所致),116 個 `ex-*.html` 須由其後之 `gExtractHtml.mjs` + `gDocExams.mjs` 重建.**驗證時不可只挑部分步驟跑**,否則 docs 被刪(2026-10-01 曾發生,補跑兩步後恢復).只需驗 dist 時只跑 `gDistRollupComps.mjs`(僅寫 dist).
- **`gDistApp.mjs` 之產物亦含內嵌 worker**:`App.vue` → 各範例組件 → `WMaplibreglVue.vue` → `mapCore.mjs` → `maplibreWorkerInline.mjs`(重產後 app.umd.js 增約 500KB 可證).
- **以副本並指定 cwd 驗 toolg 腳本(2026-11-02 mlw267;作法依 dspec〈自有套件之發布與建置腳本〉規則 4)**:toolg 腳本取 `./src`、`./dist`、`./package.json`、`./node_modules/<套件>/…` 等 cwd 相對路徑,故測試把所需檔複製到 `test/_tmp/<名>/`(保持相對位置)後 `spawn(process.execPath, ['toolg/xxx.mjs'], { cwd })`(輔助 `test/tools/toolgCopy.mjs`).副本夾**不需 `node_modules` 目錄連結**:腳本之裸 import(`w-package-tools`、`rollup`)與被建置之 `src` 內裸 import 皆由 node 與 rollup 往上層解析到套件根 `node_modules`(實測 `gDistRollupComps` 於副本成功建置);腳本若直接讀 `./node_modules/<套件>/…`(如 worker 產製腳本)則只複製其所需的幾個檔到副本同一相對位置.`rollupFile` 之 banner 以 `getPks('./package.json')` 讀 cwd 之 package.json(缺檔即拋錯),副本須含.不為測試改寫 toolg.
- **vue-cli `devServer` 設定會與預設做物件合併**:傳陣列(如 `static: [...]`)會被併成 `{0:..,1:..}` 而 schema 驗證失敗;且 `static` 預設承載 `public/`(內有 e2e 用之 `e2e-dem.png`、`e2e-icon-init.png`).需加中介層時用 `setupMiddlewares`(`@vue/cli-service/lib/commands/serve.js:252-253` 會呼叫專案者並採其回傳值).

## 測試與實測腳本

- **`spawn(..., {shell:true})` 之參數只拼接不跳脫**:`node -e "…(q,s)=>…"` 之括號被 cmd.exe 吃掉、`>` 變重導向,會在 cwd 建出 `s.end('x')).listen(…)` 之類空檔,且 server 根本沒起來(實測假陽性之成因).實測用之 server 一律寫成獨立 .mjs.
- **實測「殺不殺得掉」必附對照組**:另跑一組「完全不殺」並先自我驗證 server 確已 listen,否則分不出「被殺掉」與「從未起來」.
- **`process.on('exit')` 與 SIGINT handler 內之非同步 `spawn('taskkill')` 無效**(2026-09-12 實測 5 組):`process.exit()` 會放棄 event loop 內工作;同樣的非同步 spawn 於「自然退出」(mocha root after hook)路徑則有效.`test/tools/e2e-setup.mjs` 之 exit/SIGINT/SIGTERM 備援因此實際無效,改 `execSync` 即可修(未改,待使用者裁示).
- **e2e 埠:導入自動換埠後,「沿用本機常駐 dev server」須明設 `E2E_PORT_OFFSET=0`**(2026-11-05 wm309,規則帳本 R19):原 `e2e-setup` 以 HTTP 探測「埠通即沿用,不問身分」(上文變異檢驗所依之快速迴圈),被別的套件占用 8123 時會把 e2e 打到別人的服務——修前實測 `e2e-displayorder` 0 passing／2 failing,占用者被打到 3 次.現行:未設位移時基準埠被占用即整組位移(8223…)並自起 dev server,不沿用任何占用者;設 `E2E_PORT_OFFSET=0` 才可沿用常駐者,且須監聽者命令列同時含本專案根絕對路徑與 `vue-cli-service`(否則拒絕).**全綠不能證明沒打到別人**:驗收看占用者 PID 存活、仍回應、被測碼打到 0 次(`tmp/wm309/scenario.mjs` 樣式:自建真實 http 占用者,請求計數,探測帶標頭區分).
- **身分確認的探測不得送 HTTP**:埠上是否有人用 TCP 連線檢查(`net.connect` 連上即斷),不送請求,否則對他人之服務留下請求(占用者計數會非 0);命令列取自 PowerShell `Get-CimInstance Win32_Process`(`-EncodedCommand`、`[Console]::OutputEncoding=UTF8`、node 端比對,路徑含非 ASCII「開源」)。
- **`listenerPids`／PowerShell 在機器負載高時偶逾時回 `null`**(2026-11-05 實測 CPU 緊時單次 3～7 秒,連續 20 次約 15% 為 `null`):`null`＝查詢失敗,不得當成無人或當成自己人;`describeListeners` 重試 3 次、逾時放寬為 15 秒,仍失敗則預設拒絕.單元測試因此不得以固定短時限等身分確認(spawn 後確認之等待上限預設 90 秒,否定案例才縮短).
- **單元測試不得為取用基準埠常數而 `import` 有保留副作用之模組**:`import e2ePorts.mjs`／`e2e-setup.mjs` 會在 mocha 行程內實際呼叫 `reserveE2ePorts`(保留埠、改 `process.env.E2E_PORT_OFFSET`),使靜態盤點依賴環境.身分確認抽成無副作用之 `test/tools/devServerIdentity.mjs`,基準埠與 `OTHER_TEST_PORTS` 自 `e2ePorts.mjs` 原始碼文字取得(範本 w-web-perm 獨立審查指出之同類缺陷).
- **導入自動換埠後,殘留的 dev server 不再被重用,必須讓它不殘留**(2026-11-05 wm309):`process.exit`／SIGINT 路徑下非同步 `spawn('taskkill')` 實測無效(`tmp/wm309/exitpath.mjs` 以真實 `npx vue-cli-service` 重現:兩種路徑結束後 20 秒埠上仍有監聽者);原寫法下一輪「埠通即沿用」會把殘留者當常駐 dev server 重用而掩蓋此洩漏,改後每次殘留多占一組埠(位移上限 20 組,`E2E_PORT_EXHAUSTED`).改為同步 `spawnSync('taskkill …')`;單元測試用經 shell 啟動之替身(行程鏈 cmd.exe → node)重現,直接啟動之替身(無 shell 鏈)在非同步路徑下反而會被殺掉,不具鑑別力.**測試造的替身行程若紅燈時殘留,須自己收掉**(此次紅燈後以 `describeListeners` 確認命令列屬本輪替身再 `taskkill`).
- **A/B 對照組用 HEAD 版 `test/`(`git archive HEAD test | tar -x -C tmp/…/old`)時,HEAD 版 `e2e-setup` 之 120 秒計時器未清除,每次 mocha 要多等約 107 秒才退出**(單跑 E2E-M6 一次 120 秒 vs 新版 13 秒);對照組可加 mocha `--exit`,但 HEAD 版備援為非同步 taskkill,`--exit` 路徑會殘留 dev server(須事後收掉自己造成者).E2E-M6 失敗率(同一台負載高之機器、單跑):HEAD 版 0/8 與 1/14,新版 3/14,新版移除 `noteOwn` 1/10——差異在雜訊內,未證實與本輪改動有關,當時仍屬已知偶發(2026-11-05 wm313 已查出根因為元件之重複 `map.resize()` 來源並修正,見規則帳本 R16-6 與本檔〈圖台移動狀態〉).
- **`startServer` 內 120 秒逾時計時器要在就緒或失敗後清除**:原寫法不清除,使 spawn 過 dev server 之行程在就緒後仍要等計時器到期才能自然結束(單元測試之子行程因此久久不退,逾時假紅);改為 `clearTimeout`.
- **子行程印完即結束時,父行程寫其 stdin 會 EPIPE(競態)**:測試 harness 的 `child.stdin` 須掛 `error` 空處理.
- **以真元件探測「改版前後」而不動受追蹤檔**(2026-10-16 審計 maxzoom 時實作):`vue-cli-service serve tmp/probe/main.js --port 9082`(serve 可帶 entry)+ 環境變數 `VUE_CLI_SERVICE_CONFIG_PATH=<abs>/tmp/probe/vue.config.probe.js`(另一份 vue 設定,不碰 `vue.config.js`),其內 `new webpack.NormalModuleReplacementPlugin(/^\.\.\/js\/basemapManager\.mjs$/, '<abs>/tmp/probe/bmSwitch.mjs')` 只換元件內那一個 import;bmSwitch 依 `window.__PROBE_VARIANT` 轉呼叫 src 現行版或 tmp 內之 patch 副本(regex 綁 request 字串,bmSwitch 自身以 `../../src/js/...` 匯入現行版不會被換掉).一次編譯即可在同一頁比 head/A/B 三版.
- **元件根為 `display:inline-block`**(`WMaplibreglVue.vue:3`):掛元件須明給 width 與 height(範例頁皆 `style="width:800px; height:500px;"`),只給 height 則畫布寬 0,截圖整片白但面板照常顯示,極易誤判為「圖層沒畫」.
- **maplibre raster(tileSize 256)請求層級＝round(zoom+1)**(`covering_tiles.ts:172-178`,raster `roundZoom:true`):服務只到 N 級時,地圖 zoom ≥ N−0.5 即請求 N+1 級.圖磚失敗後 maplibre 要等**下一次 tile 更新(任何地圖移動)**才改請求父圖磚(`tile_manager.ts:699-719`),故症狀是「初載與平移進新區域時空白,再動一下才補上」;自低層級放大時已載父圖磚會暫留,看起來正常但錯誤照報.
- **`map.addSource` 驗證失敗不丟例外**(`style.ts` `shouldValidate && this._validate(...)) return`):只發 error 事件、source 不加,其後 addLayer 報 `source ... not found` 亦不丟例外 → 該底圖整個不存在而面板仍列項目.數字欄位一律先正規化成有限數字再交 maplibre(數字字串、NaN 都會被拒).
- **`parseInt` 與 `cdbl` 之數字陷阱**:`parseInt(Infinity)` 為 NaN、`parseInt('1e1')` 為 1;wsemi `cdbl` 經 lodash `toFinite`,`cdbl(Infinity)` 為 `Number.MAX_VALUE`(有限).要排除非有限數須先 `Number.isFinite(Number(v))` 再 cdbl.
- **審計中途 repo 可能被改動**:2026-10-16 審計期間(12:06–12:11)使用者本人把 maplibre-gl 鎖定 6.14.0 並重產 worker/dist、改寫本檔與 rulebook(主控事後告知).長任務中途以 `git status --short` 與檔案時間戳複查,實測與基準須註明各自所用之版本;非自己所改者先問主控歸屬,不還原.
- **e2e 執行中不可改 src**:e2e 經 vue-cli dev server(8123)即時編譯 src,跑測試期間改 `src/` 任一被匯入之檔(含 `App.vue`)會觸發重新編譯,進行中之案例可能失敗(2026-10-16 基準 2 之 E2E-010「point popup 開啟」逾時即與改 `App.vue` 同時,單跑與全量重跑皆過).改 src 前先等測試結束;只改 gitignore 之 md、`./tmp/` 不受影響.
- **e2e 之離線圖磚以頁內 `maplibregl.addProtocol` 供應**(`src/AppPBMMaxzoom.vue`):範例頁 `created` 註冊(早於子元件建圖)、`beforeDestroy` 移除;loadFn 回 `{ data: ArrayBuffer }`,拋錯即圖磚失敗(maplibre 照常報錯);可在頁上顯示請求計數供 e2e 以 DOM 觀察.比 `page.route` 好處是範例頁本身(含 docs)亦可離線運作.
- **「執行期補上 maxzoom 後顯示」之畫面不具鑑別力**:現行碼結構性重建後,maplibre 之父圖磚退回亦可能把畫面補上(E2E-B 於修前即轉藍);具鑑別力的是「之後不再請求不存在之層級」之計數.設計 e2e 時先以修前碼跑,確認每條斷言至少一條會紅.
- **以視窗座標硬算目標之 e2e:範例頁選單多換一行即可使目標出界**(2026-10-31 map30c,根因查證見 map30b):`e2e-hover` 以固定 1000×760 視窗,下排目標(緯度 23.92)視窗 y = canvas 頂 + 377,HEAD 時 canvas 頂 366 → y 743,僅距視窗底 17px;map30 於 `App.vue` 之 `basic` 子選單加 `'moveState'`,1000px 寬下第 9 項換到第二行,canvas 下移 33px → y 776 出界,滑鼠落在視窗外、地圖收不到 mousemove,症狀為 cursor 不變 pointer、tooltip 不出現、截圖 clip 越界(`Clipped area is either empty or outside the resulting image`)共 8 案紅.修法:視窗高改 1100(與 `e2e-zoomrange`、`e2e-movestate` 一致)+ `gotoExample` 前置斷言(目標出界即以明確訊息失敗).**症狀是三種不同的逾時/截圖錯誤,根因是同一個幾何越界**——遇「滑鼠互動全無反應」類紅燈先量目標之視窗座標是否在視窗內(`boundingBox` + 換算),再查依賴與圖磚.
- **對照組須連同範例頁與測試輔助一併換回**(2026-10-31 map30c;map30 誤判之成因):判斷既有 e2e 之紅燈是否由本輪改動造成,對照組要把整個 `src/`(範例頁、元件、輔助)與 `test/` 換回 HEAD(`git archive HEAD` 解到 `./tmp/` 另裝依賴),只換元件 `.vue` 時範例頁之改動(此例為選單多一項)仍留在對照組內,測不出真正的變因.map30 因此誤記「HEAD 元件同樣紅、與本輪無關」與「根因未診斷、疑環境或圖磚」,實際是本輪之 `App.vue` 間接造成.查證時用因子化對照(依賴 × 源碼 × 單一檔單一字串),找出「必要且充分」之最小變因,不以「換回一部分仍紅」推論無關.
- **Playwright 版本與瀏覽器 revision 不符**:如 playwright 1.61.1 需 chromium 1228 而本機僅有新版 revision,三檔全數於 `chromium.launch` 失敗.以 `node node_modules/playwright/cli.js install chromium` 補裝(不用 cd、確保用專案內版本).〔2026-11-13 起 e2e 經 w-playwright 啟動;2026-11-25 起(排程第 632 項)受管瀏覽器由各檔第一個 `before` 之 `ensureE2eBrowser()` 集中取得(`wpw.ensureChromium({ timeout })`,缺檔時下載安裝),`launchE2eBrowser` 為 `autoInstall: false`;要預先取得用 `wpw.ensureChromium()`,不用 `npx playwright install` 或上列 `cli.js`,見 R20 要求 5.〕

## e2e 埠單元測試之 `noteOwn` 完成同步(2026-11-27 m674、m674b,排程第 674 項,規則帳本 R19 要求 8)

- **經過**:m674 時 `w-package-tools-e2e` 1.0.59 之 `reservation.noteOwn` 回傳 `undefined`、無完成通知(派工所稱「實作在本庫」不成立,本庫只在 `e2e-setup.mjs:56` 呼叫;動工前先 `Grep` 函數所在套件),本庫借該套件未文件化之 `opt.tableAsync` 並在 `e2ePorts.mjs` 開測試專用注入點(`globalThis.__e2ePortsTableAsync`)取得事件;主控據此請套件補觀察點,m674b 起套件 1.0.60 之 `noteOwn` 回傳永不 reject 之 `Promise<{ ok, attempts, reason }>`、`opt.tableAsync` 為正式注入點、取樣失敗有界重試,本庫改用正式觀察點並**移除注入點、移除子行程自己之取樣與重試**.
- **以正式選項注入、不改 e2ePorts.mjs**:同一行程內第二次呼叫 `reserveE2ePorts`(基準埠相同、無新增埠)沿用第一次之保留(`extendActive` 回同一 handle),故測試子行程於匯入 `e2ePorts.mjs` **之前**先以 `{ avoid, tableAsync, noteTries… }` 呼叫一次,其後 `e2ePorts.mjs` 之呼叫即取得帶該選項之保留;`reservation.noteOwn` 以子行程內外包一層(只印 `NOTE-CALLED`／`NOTED`,不改行為)取得 `await` 之結果.
- **替身代替加壓**:以 `WM674_GATE`(標記檔閘門)＋正式選項 `opt.tableAsync` 之合成行程表(`WM674_TABLE=gated`)使 `noteOwn`「延遲完成」,同一替身、同一延遲(125 秒;須另設 `noteTimeoutMs` 大於延遲,否則單次取樣於 60 秒被套件判逾時而重試)只換等待寫法,修前寫法(輪詢＋120 秒時限)逾時、事件寫法綠,不需 CPU 壓力;重現訊息與 11-27 之滿載重現逐字相同.
- **延遲須落在被驗之等待期間**:初版 PR-012d 先 `sleep` 再放行閘門再等待,「等待改回 1000 ms 輪詢」變異存活;改為放行計時器與等待並行、放行當下記否定斷言證據後才被殺.變異存活先查「延遲有沒有落在等待期間」,不是補斷言.
- **「等事件」測試須另證防懸置上限有效**:閘門永不放行且把上限縮為 4000 ms,訊息須可辨為懸置(`逾 4000 ms 仍未見(懸置)`);上限 `NOTE_HANG_MS`＝182000＋120000 ms:套件預設最壞等待 `noteTries×noteTimeoutMs＋(noteTries-1)×noteRetryMs`＝3×60000＋2×1000,餘裕取 11-27 重現紀錄之逾時值 120000.m674 之 600000 ms 為無套件最壞值可依時之估計,已由此取代.
- **成因仍未證實,但已可辨**:滿載時 120 秒仍未見記錄,可能是取樣慢,也可能是取樣失敗(1.0.59 於行程表 `null` 時不寫不重試);同一輪 PR-007、PR-012a、PR-012c 等同樣依賴 PowerShell 查詢之案各約 7~15 秒完成,略偏向失敗,但無法在不自起加壓下證實.現由套件有界重試(3 次、間隔 1 秒、單次 60 秒),測試端不再重試;PR-012b 之判定輔助 `assertNoted` 於 `ok:false` 時訊息帶 `reason`(`table-failed`／`table-timeout`＝系統忙碌,其餘為邏輯錯誤),日後再紅即可分辨.
- **「`ok` 不檢」之變異須有只有它抓得到之案**:PR-012b／d 之 `ok` 斷言與「預約檔記有服務行程」斷言互為備援(`ok:true` 當且僅當已記入),拿掉 `ok` 斷言變異仍綠;須另設 PR-012e(`tableAsync` 立即 `cb(null)`＋`noteTries:1` 之確定性失敗:`ok:false`、`reason:'table-failed'`、`startServer` 不失敗、預約檔不記入,且 `A.throws(() => assertNoted(...))` 驗輔助對 `ok:false` 拋錯並帶 `reason`)才殺得掉.
- **`npm i <套件>@<版> -D` 之副作用**:會把 `package.json` 補上檔尾換行(原檔無)、並把 `package-lock.json` 頂層 `version` 與 `package.json` 同步;前者可事後以 Write 還原為無換行,後者為 npm 自動行為(不改)。
- 子行程碼以 template literal 內嵌於測試檔(`CHILD_CODE`):內不可有反引號與 `${`(除刻意內插之常數),行尾註解以 `//` 起而不併成同一行,Edit 後以 `node --check` 與跑單元測試驗(語法錯在子行程才現形,父行程等不到 `RESULT`).
- Git Bash 呼叫主控工具時,Windows 路徑參數一律正斜線(反斜線被殼層吃掉,`decision-log.mjs` 報任務資料夾不存在).
