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

## 升 maplibre-gl 6.14.0 → 6.16.0 之經驗(2026-11-09 ml01,規則帳本 R1、R17)

- **升版後第一個紅的是「以正則檢查壓縮檔內部判斷」之守門測試,不是功能**:`unit-workerClassic` U52/U53 以正則比對 `maplibre-gl.mjs`(production 壓縮檔)內 `isClassicWorkerUrl`/`isCrossOrigin`/`workerFactory` 之形狀,6.16.0 起壓縮器產生含 `$` 之識別字(如 `$c`)而 6.15.0(#8769)又讓 `isClassicWorkerUrl` 多一個整串 `endsWith('.cjs')` 條款,兩者各使檢查式失配;處置是識別字樣式 `\w` → `[\w$]`、檢查式改為新形狀並補一種單點改動(U53 共 8 種),**語意不變**(本套件 data: URL 無 `?#` 且以 `//.cjs` 結尾,新舊兩式皆判 classic).往後升版先看此二案:紅燈意味「第三方實作細節變了」,先讀兩版 `-dev.mjs` 同名函式再改檢查式,不要只放寬正則到不再鑑別.比對兩版行為時,`diff -u` 整份 `-dev.mjs` 因類別搬位達 7.8 千行雜訊,改以腳本「依方法名抽本體逐字比對」(60 餘個方法,多數逐字相同;差異僅 `Transform` 欄位收進 `_cameraState`、地形 DEM 載入中不覆寫相機高程、`TileManager` 之 `error` 僅非 tile 層才標記 source 已載入).

## 升 maplibre-gl 6.16.0 → 6.18.0 之經驗(2026-11-19 wml550,規則帳本 R1、R17)

- **兩版 `npm pack` 解開後比對套件內附之 `src/*.ts`(型別化原始碼)比 `-dev.mjs` 好讀**:`diff -rq old/package/src new/package/src` 先看檔級增刪(6.17.0 起相機排程新增 `ui/camera_movement_scheduler.ts`、`HandlerManager` 拆出 `create_map_handlers.ts`、`geo/transform_helper.ts` 併入 `geo/transform.ts`),再對相機、地圖、`handler_manager` 取 `diff -u`;發布說明未載之行為變更(如 `Camera.jumpTo` 不再中止使用者手勢,僅 `Map.stop()` 會)只有此法讀得到.
- **升版後第一個紅的仍是 U52/U53(同 6.15.0、6.16.0 之經驗)**:6.17.0 #8912 於 `workerFactory` 最前新增「`asModule && globalThis.origin === 'null'` → fetch 後以 data: URL 建」分支.先讀新舊兩版該函式再改檢查式:判斷依賴點是「該分支只限 module」(本套件之 classic data: URL 不經),故把 `t&&` 守衛釘進正則,並加「守衛不再限 module」「分支被移除」之變異;新增之 `不透明來源判斷`、`data: URL 輔助` 兩檢查各配一變異.
- **「事件序列在新舊版相同」要用並排實測證明,不要只讀碼推論**:`tmp` 內一次性探測(純 maplibre 頁面,Playwright `context.route` 於虛擬來源 `http://ml.test` 供應兩版 `dist/`,同一 Chromium、空樣式單背景層即可 `idle`)跑 S1~S7 七個情境(`setMaxBounds`、右鍵旋轉慣性、手勢中呼叫 `jumpTo`/`panTo`、動畫被中斷、滾輪至 `movestart` 延遲、容器改尺寸、投影切換),每情境兩版各一個全新頁面;發現讀碼不易得到者:旋轉慣性滑行由約 9° 增為約 96°、手勢中 `jumpTo` 不再中止手勢.元件層再以範例頁 `moveState`(`window.__getMap`、`__getRoot`、`__stateLog`)補一次(`__getRoot().__vue__` 取元件實例,用 `$watch` 計 `opt` 寫回次數).
- **`getMapObject()` 回傳 Proxy(`publicApi.mjs`),對它賦值會寫到原 map 實例**:探測腳本想包裝 `m.panTo` 計次時,`orig` 取到的是 Proxy 之 `panToLatLng` 轉接函式,賦值又寫回原 map → 轉接函式呼叫被包裝之 `map.panTo` → 無限遞迴(`Maximum call stack size exceeded`).要計相機指令次數只包 `jumpTo`/`easeTo`/`flyTo`/`setZoom`/`setCenter`,不包 `panTo`.
- **globe 投影(範例頁 moveState 預設,層級 7)下 `setMaxBounds` 不約束鏡頭,因而不發事件**;要觀察事件須先切 mercator(真點擊 `#btnMercator`).同一探測在純 maplibre 頁面(預設 mercator)則兩版皆約束鏡頭,6.18.0 才多發一組事件.
- **評估「上游修了,本套件之繞道是否可廢」之法**:把 `test/e2e-fileprotocol.test.mjs` 複製成 `tmp/` 內之探測測試(匯入改 `../../test/tools/…`、`ROOT` 取專案根),`before` 於副本夾(`test/_tmp/e2e-fileprotocol`)之 `src/js/mapCore.mjs` 以字串取代令 `needClassicWorker` 恆回 false 再建置,四環境(file://、http、sandbox iframe 之 src 與 srcdoc)逐一取 `window.__e2e`、點色像素與面板文字;不動 repo 之 `src`,探測完 `after` 刪副本.面板文字須 `waitFor` 而非 `isVisible()`(面板於首次 idle 後才渲染,立即判斷會得假 false,http 對照組亦然).
- **全套中途出現一次 `page.goto` networkidle 逾時不等於新版造成**:升版後三次全套中有兩次各出現 1 案 `page.goto(baseUrl, { waitUntil: 'networkidle' })` 30s 逾時(第 2 次 `e2e-displayorder` E2E-001、第 3 次 `e2e-zoomrange` E2E-Z12b,案例不同),首頁預設範例載入遠端底圖,取決於外網與 dev server 冷啟動.判別:同案於其餘全套綠(displayorder E2E-001 首次全套 17.3s 綠)、單檔重跑全綠(displayorder 檔 6 次 12/12、Z12b 5/5)、隔離探測進首頁 30 次 0 次逾時(3.2~11.4s,平均 5.6s,一次一個全新瀏覽器);第 3 次逾時時僅有輪詢、無本機額外負載.推估單次 `networkidle` 逾時率約 1%(2 次/約 250 次進首頁),與 maplibre 版本無關之既有寫法.不以加長逾時或重試掩蓋,依失敗率回報;同類寫法(`networkidle` 進首頁)見 `e2e-movestate` 檔頭註解之 `domcontentloaded` 作法,其餘 6 檔 7 處當時仍為 `networkidle`(**2026-11-19 wml550b 已全數改走共用 `gotoApp`**,見下節).全套回報時須如實寫「全套未能單次全綠」,並附各失敗案例之重跑結果.
- **下游盤點之 Grep 用法**:對 `C:/opensrc` 根以 `*/*/src/**`、`*/*/test/**`、`*/*/package.json` 各一次(不帶 `!` 排除、不用大括號合併排除式,後者逾時只回本庫);本庫命中以「回傳路徑為相對於 cwd(無磁碟機前綴)」辨識,其他套件為絕對路徑;式樣若用不分大小寫之 `maplibre` 會把 `maplibregl-vue` 字樣全吃進來(本庫 291 檔),盤點用 `maplibre-gl`.

## e2e 進場載入條件改 domcontentloaded 之經驗(2026-11-19 wml550b,規則帳本 R5〈e2e 進場載入條件〉)

- **`networkidle` 描述的是網路,不是 App 就緒**:首頁預設範例(size)載入遠端底圖,外網慢時 30 秒逾時;3 次獨立偶發(批 6 跟跑 `e2e-zoomrange` Z16、wml550 全套 `e2e-displayorder` E2E-001 與 `e2e-zoomrange` Z12b)皆時敗時過、重跑皆綠.修法同 `e2e-movestate`:`domcontentloaded` 後以 DOM 可觀察狀態判定 App 掛載(`gotoApp`:主選單與子選單項已渲染),抽到 `test/tools/e2e-setup.mjs` 共用,6 檔 7 處不各寫一份;`e2e-movestate`、`e2e-diffpath` 之行內 `domcontentloaded` 寫法維持(本即不依賴外網).
- **「不等待就緒」之變異在 e2e 層不轉紅,因為 Playwright 之 `click()`(及 `boundingBox()`、`innerText()` 等 locator 動作)自帶自動等待,且各檔又有自己之等待**:把 `gotoApp` 改成 `waitUntil: 'commit'` 且不等選單,於外網掛住之環境下 7 個代表案例仍 7/7 綠.因此 `gotoApp` 之選單等待是**標示用**(失敗訊息指向「App 未掛載」而非泛泛之 click 逾時),不是鑑別力之來源;要證明 `gotoApp` 不依賴外網,須改用下一條之注入法.
- **有鑑別力之驗證 = 注入「外網掛住」,而非等外網偶發**:在 `routeCdnLocal` 開頭暫加 `await ctx.route((u) => u.protocol.startsWith('http') && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost', () => new Promise(() => {}))`(**必須註冊於 CDN 副本路由之前**:Playwright 後註冊之路由優先,先註冊者才只接住副本以外之請求;反序則連 5 支外部 script 都被掛住,首頁停在 DOMContentLoaded 之前).對照組(真 `gotoApp` + 同注入)7/7 綠——證明各目標範例本身不連外;變異 M1(`gotoApp` 改回 `networkidle`)7/7 於 `page.goto: Timeout 30000ms exceeded` 轉紅,與原偶發失敗訊息完全相同;M2(`domcontentloaded` 後加 `waitForLoadState('networkidle')`)7/7 轉紅.代表案例:`e2e-basemapzoom` E2E-A、`e2e-displayorder` E2E-001、`e2e-hover` E2E-001、`e2e-opacity` E2E-O1、`e2e-runtime` E2E-001、`e2e-zoomrange` Z10(走主選單之第二站點)與 Z12b(曾失敗者);腳本 `tmp/wml550b/mut-run.mjs`(用後清除),暫改檔以 sha256 對暫存之原檔回驗已還原.注入碼不入版控(避免測試輔助多一個故障開關).
- **規則盤點測試(`unit-e2eGoto` G1–G3)承擔結構面之鑑別**:變異 M3(不等待就緒)→ G3 紅;M6(helper 內 `networkidle`)→ G1、G3 紅;M7(移除 `waitUntilExist`)→ G3 紅;M8(一處改回 `page.goto(baseUrl, { waitUntil: 'networkidle' })`)→ G1、G2 紅.單元測試不 import `e2e-setup.mjs`(模組頂層保留埠),以去註解後之原始碼文字比對.
- **同類寫法盤點**:`git grep -n "networkidle" -- test` 程式碼命中 0;`waitUntil: 'load'` 僅 `e2e-fileprotocol`(自有測試頁,不連外).連跑結果:6 檔各連跑 3 次 18/18 全綠(basemapzoom 2、displayorder 2、hover 17、opacity 8、runtime 15、zoomrange 39 案).

## e2e 取得受管瀏覽器之經驗(2026-11-25 tml632,排程第 632 項,規則帳本 R20 要求 5、6)

- **安裝發生在哪個 hook 要實查,不要信任務書**:任務書寫「`before` 之 150 秒短於安裝」,實際 `before` 只做 `startServer`;安裝在每檔第一個案之 `beforeEach` 內(`launchE2eBrowser` 帶 `autoInstall: true`),受 describe 層 `this.timeout(180000)`.查法:讀各檔 `before`/`beforeEach` 與 w-playwright `_launchCore.mjs` 之 `launchWithInstall`(缺檔且 `autoInstall` 為真時以 timeout 0 呼叫安裝)。
- **自然環境不重現逾時**:本機網路下 headless shell 安裝僅約 3 秒(以 `chromium_headless_shell-*` 夾之建立時間與 `INSTALLATION_COMPLETE` 之修改時間量得)。要得到「修前紅」須模擬慢網路:空 `PLAYWRIGHT_BROWSERS_PATH`＋限速鏡像(`PLAYWRIGHT_DOWNLOAD_HOST` 指到本機小程式,轉到 `https://cdn.playwright.dev/<path>` 並限速)。zip 129,830,431 B,500 KB/s 約 288 秒 > 180 秒。鏡像必須**跟隨 307**(cdn 轉到 `storage.googleapis.com`,Playwright 不會替鏡像追轉址之後仍限速);`PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` 若已設會蓋過 `PLAYWRIGHT_DOWNLOAD_HOST`。`playwright-core/cli.js install --dry-run --only-shell chromium` 可印出各項下載網址而不下載。
- **舊寫法逾時後之連帶現象**:hook 逾時只讓 mocha 判該 hook 失敗並跳過其餘案,安裝子行程與懸置之 `launchE2eBrowser` 不被取消——安裝完成後該 launch 真的開出一個無人關閉之 headless shell,mocha 行程因此不退出,須手動結束行程樹。
- **「安裝恰 1 次」之證據用計數,不用「沒再看到安裝」**:①鏡像紀錄(每個下載項恰 1 筆完成之請求:zip、ffmpeg、winldd);②`ensureE2eBrowser()` 完成時印之一行(安裝程序 1 次、下載動作 3 次);③空夾內三個項目夾皆有 `INSTALLATION_COMPLETE`。下載動作次數依 Playwright 輸出之 `Downloading` 行計,`npm_config_loglevel` 為 silent／error／warn 時 Playwright 不輸出而恆為 0(紀錄行已註明,以鏡像紀錄為準)。
- **`ensureChromium` 之錯誤只有離開碼**:DNS 失敗、404、磁碟滿等真因只在子行程輸出(`funLog('install-output')`),取得函式須自行收末段附在錯誤訊息並以 `cause` 保留原錯誤,否則慢網路／離線出事時只看到 `exit code 1`。
- **不保留 `autoInstall: true` 作防呆**:它使漏掉取得之新 e2e 檔仍在案內靜默安裝(無逾時),重演逾時;改 `false` 後缺檔即 `E_BROWSER_MISSING` 立即失敗,並以 EL-03e(各檔第一個 `before` 之形狀與順序)與 EL-06h(真 w-playwright、空夾、兩個下載主機變數皆指向不通位址,缺檔須立即失敗且夾內無產物)守住。
- **靜態文字判定之邊界**:EL-03e 以 strip 註解後之正則判定,會誤判(句尾分號、`describe` 前之輔助函式含 `launchE2eBrowser(`)但不漏判已驗證之破壞形狀(19 項變異,含 `describe.skip`)。獨立複審(sonnet)以記憶體內變異另找出漏判 `describe.skip/only` 與 EL-06f 分不出計 `install-start` 或 `install-done`,皆已補。
- **`du -sh node_modules` 在全套執行中會與測試搶磁碟且逾時**:判斷 `node_modules` 規模時不用 `du`(Defender 掃描下 120 秒仍不完),改看依賴數或以 `npm ls --depth=0`。
