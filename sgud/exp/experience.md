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
- **Playwright 版本與瀏覽器 revision 不符**:如 playwright 1.61.1 需 chromium 1228 而本機僅有新版 revision,三檔全數於 `chromium.launch` 失敗.以 `node node_modules/playwright/cli.js install chromium` 補裝(不用 cd、確保用專案內版本).

## 差異路徑(僅 name、僅地形倍率)與 `opt` 位姿契約文件之實作與測試經驗(2026-11-06 ma327,規則帳本 R8、R12〈重評條件〉)

- **同來源 `map.setTerrain({ source, exaggeration })` 不重抓 DEM**(maplibre 6.14.0 實測,一次性探測腳本,未入版控):頁內包裝 `addSource/removeSource/setTerrain`、監聽 `terrain-src` 之 `dataloading`、`page.on('request')` 計數 DEM 請求,三者並用;現行整組重套 = 1 次請求、2 次 `dataloading`、`setTerrain(null)`→`removeSource`→`addSource`→`setTerrain`;同來源就地 = 0 次請求、0 次 `dataloading`、`getTerrain().exaggeration` 讀回新值.平坦 DEM 無高程,倍率無法由畫面觀察,以 `getTerrain()` 為準.
- **改了某路徑後,要找「靠舊路徑做事」之既有 e2e 是否已變空驗**:F10 就地化後,範例頁 `tuneTerrain` 只改 `exaggeration` 即走就地路徑,E2E-012(重套 terrain 後 hillshade 疊序)仍綠卻不再驗重套;處置是範例頁按鈕連 `hillshadeExaggeration` 一併改(斷言不動).做法:grep 觸發該欄位變更之範例頁按鈕與測試,逐一判斷其目的是否仍被執行.
- **差異路徑之 e2e 量測法(不動範例頁)**:於既有頁面再掛第二個元件實例——取既有實例 `el.__vue__.constructor.super` 為 Vue,父層 `new Vue({ data: { opt }, render })` 持有響應式 `opt`(同使用端用法);圖磚與 DEM 用 `ctx.route('http://tile.local/…')` 回應並於測試端計數(永不連外);元件之 `applyBaseMaps/applyTerrain` 與地圖之 `addSource/removeSource/setTerrain` 於頁內包裝計數.「不再請求」只能以穩定窗(請求數連續 600 ms 不變)觀察;正向事件(名稱出現於面板、`getTerrain` 為新值)以事件等待.元件之寬高須給在元件本身(`h(Ctor, { style })`),只給外層則真滑鼠命中不到.
- **禁用 `git stash`/`checkout` 時之「修前紅」**:手動還原修改取得修前等價狀態(把 `name` 自 `BASEMAP_PAINT_STATE` 移除、元件改 `false &&`)跑新 e2e,同時得修前紅與變異證據(D1、D3 紅,負向 D2、D4、D5 綠);另以兩個過寬變異(把 `maxzoom` 納入放行、忽略僅倍率旗標)驗負向案例(D2、D4、UD3 紅).單元測試因整檔新增而得真正之修前紅(原碼未改).
- **README 契約句須逐句實測,且探測要控制變因**:「只改 `opt.center` 至高緯度則 `opt.zoom` 被改寫」僅地球投影成立,探測初版固定 `projection:'mercator'` 量到「不變」,補成未給/`'globe'`/`'mercator'` 三組才分清(未給與 `'globe'` 為 6→5.1249,`'mercator'` 不變);真滑鼠點擊面板勾選框須限定於本實例之面板(`#host .clsPanel input`),`.first()` 可能點到頁面上另一實例而得無效資料;凍結資料集物件本身時,面板顯隱勾選框狀態會變、圖層不隱藏、`opt` 無 `visible`,但頁面**無** `pageerror`——不能以「無錯誤」判定行為正常,須讀 `opt` 值與圖層 `visibility`.
- **sgud 之 rulebook/experience 為 CRLF(state 為 LF)**:拆分腳本以 `\n` 切行會保留行尾 `\r`,新增之檔頭若為 LF 即混用,須統一為 CRLF;比對「原有行是否仍存在」時先去除 `\r`.Edit 工具編輯 CRLF 檔會保留 CRLF.拆分腳本寫在 `./tmp/`,輸出可導向暫存目錄先做純搬移驗證(遺失行 0)再改內容,以免「搬移」與「修改」混在一起無法區分.

## 高負載下只出現一次之 e2e 紅之查證經驗(2026-11-07 mv329,`e2e-movestate` E2E-M8,規則帳本 R16)

- **只有序列、沒有頁內紀錄的一次紅,先補觀察手段再重跑**:不改測試檔,以 mocha `--require` 掛鉤於 playwright 層包 `chromium.launch`——`newContext` 後 `addInitScript` 注入記錄器(全程記錄,不被測試之 `startTrace` 重設:wheel 事件、地圖事件、`data.state` 每次寫入〔`vm.$watch('state', …, { sync: true })` 即 `moveState` onChange 當下〕、逐影格位姿、long task),`browser.close` 前取回紀錄並截圖,root `afterEach` 寫入結果(通過者刪截圖).`--grep E2E-M8` 每次獨立 mocha 與 dev server,與 `npm test` 之路徑相同.
- **堆疊判讀因受 V8 `Error.stackTraceLimit`(預設 10)所限**:Vue 之 watcher 框架吃掉多層,`toMoving` 之呼叫端(onWheel/onMoveStart/onProjection)被截掉;下次於記錄器先設 `Error.stackTraceLimit = 50`.本次改以時間判定:moving 寫入於第一個 wheel 後 0.8~12.3ms 且早於 movestart → 滾輪預標記.
- **滾輪手勢之結束窗(maplibre 6.14.0 `scroll_zoom.ts`)**:wheel 型之 easing 以「距上一個 wheel 之時間 /200ms」推進,滿 1 後再設 200ms `_finishTimeout` 才發 `zoomend`/`moveend`;下一個 wheel 在此之前到達即續為同一手勢.實測 CPU 節流 6x:最後一次 wheel 後 436~736ms 發 `moveend`、584~1601ms 發 `idle`(自然 30 次,跨 8 級含投影切換與圖磚重載;停頓注入 3 次為 464~514ms、605~684ms);`moveend` 之後、`idle` 之前到達之 wheel 會開新手勢但 `state` 仍為 moving(不閃;讀碼推論:`onWheel` 於非 idle 時不動作、`onMoveStart` 重設計時,未實測),間隔須逾「wheel 至 `idle`」才閃.`waitForTimeout(60)` 之間隔在頁面端實為 116~361ms(節流 6x;一般條件與負載 ≤ 70% 相近;推測因 Playwright `mouse.wheel` 等瀏覽器處理完才返回,未以對照實驗驗證),故「14 次滾輪 = 一個手勢」只在本輪條件下成立,負載更高時是否逾此延遲為推測.
- **同形狀可能是真停,不一定是缺陷**:`moving → idle → moving → idle` 先問中途 idle 是否為真——該 idle 前有無 `moveend` 與 `idle` 事件、當下 `isMoving()`/`loaded()`、idle 至下一個 moving 間位姿是否不變、下一個 moving 是否由晚於 idle 之輸入引起;全成立即狀態機正確,紅在測試前提.停頓注入要以事件同步(等 `state=idle` 再續滾),不用固定毫秒.
- **負載產生器**:8 邏輯核、5 個低於標準優先權之忙迴圈子行程(佔空比由父行程依 `os.cpus()` 每秒調節,目標 62%、上限 70%)——佔空比 1 時整機約 50%,測試執行期間平均 56~62%、p95 70~82%(瀏覽器與 dev server 另占);quiet-run 之獨佔鎖需整機 ≤ 30% 才放行,他 agent 跑多開時排鎖約 15 分.
- **外部 CDN 慢會使 `page.goto(domcontentloaded)` 逾時**:`public/index.html` 有 5 支同步外部 script(含 `yuda-lyu.github.io` 兩支 1.0~1.4MB);2026-11-07 github.io 一度 60 秒未下載完,e2e 於進場即逾時(與被測功能無關).量測時以 `ctx.route` 回應先前完整下載之同一檔案;2026-11-07 mv329b 起正式 e2e 以 `test/tools/e2eCdnLocal.mjs` 處理(R5).
- **(mv329b)`ctx.route` 之先後**:Playwright 之路由後註冊者優先;某檔另掛 `**/*` 攔截且對外部請求 `abort`(`e2e-diffpath`)時,先註冊之本機副本路由不會被呼叫——該檔原本就不連外,不必套用.套用與否以「其後有無涵蓋外部網址之攔截」判,不以檔名判;是否真的接手以回應次數核對(探測:5 支各 1 次、長度與副本相同,進場 875ms).
- **(mv329b)把「確定期望」寫成正負向一組**:新斷言 `assertWheelSeq` 依可觀察條件(手勢中地圖是否發過 `idle` 事件)分兩種期望;正向案(停頓注入 M8b)要另證「舊斷言下確定紅」,負向案(M8c 注入 `idle`、M8d 停頓中 `easeTo`)以 `assert.throws` 加訊息正則固定「被哪一條判紅」,並以暫改(M8c/M8d 直接呼叫、不包 `assert.throws`;M8b 換回舊斷言)實跑三案皆紅,還原後以 sha256 回驗.正向案不寫「恰 4 筆」:負載更高時其餘間隔亦可能逾窗而多停一次,恰 N 筆會把同一不穩定帶回來;以「注入點處有 idle 記錄」與逐段判定取代;負向案之前提亦以注入點(第幾個 wheel 之間)定位,不以序列索引.
