# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

## maplibre-gl 6.x 之 worker(2026-10-01 升 5→6、2026-10-16 固定 6.14.0)

- **worker 載入失敗之徵狀**:console 僅一行 `Error: Worker failed to load. Check that the worker URL is correct.`,地圖只畫底色(圖磚交 worker 解析),頁面 `networkidle` 永不達成 → e2e 全數於 `page.goto` 逾時 30s.此時 `curl http://127.0.0.1:8123/` 仍回 200,**勿誤判為 dev server 或網路問題**.
- **兩種打包之 worker URL 推導不同**(實測):rollup 打 umd 時 `import.meta.url` 被轉為 `document.currentScript.src`,推導出產物旁之 `./maplibre-gl-worker.mjs`;webpack 下 maplibre 內部有 `if(!/^https?:/.test(t))return""`,推導結果為**空字串**,`new Worker('')` 直接失敗.診斷法:頁面載入前覆寫 `window.Worker` 記錄其 URL 參數.
- **現行解法**:`toolg/gDistRollupMaplibreGlWorker.mjs` 把 worker 打包成自足單檔內嵌為字串(`src/js/maplibreWorkerInline.mjs`),`src/js/mapCore.mjs` 之 `ensureWorkerUrl()` 建 Blob 交 `setWorkerUrl`.v6 只有 `setWorkerUrl(string)`,無 setWorkerClass/工廠入口.
- **6.13.0 起 worker 已自足**:不再 import `maplibre-gl-shared.mjs`(該檔為 0 bytes 之棄用檔).6.12 以前 worker 會 import shared(約 516KB),兩檔須同目錄.
- **主程式與 worker 不可跨版**:maplibre 6.13.0 即修正「stale cached worker crashing the map」.內嵌 worker 依開發端安裝版打包,故依賴須固定版號(見 `sgud/rule/rulebook.md` R1).
- **`w-package-tools/src/rollupWorkerCore.mjs` 不適用第三方 worker**:實測其產物為主執行緒 proxy 模組(`export{H as default}`,頂層無 `self.onmessage`,外包自身 init/call/return 協定),而 `setWorkerUrl` 要的是 worker 腳本本身.其 base64 係因內嵌於模板字串,本專案直接產檔以 `JSON.stringify` 即可.
- **`wsemi/src/b642u8arr.mjs` 不宜處理大量資料**:檔首自述 crypto-js 無 chunk/stream 機制.

## maplibre-gl 6.14.0 縮放範圍與相機事件語意(2026-10-16 issue #3 審計與實作)

- **`minZoom` 實作預設為 -2(文件寫 0)**(`maplibre-gl-dev.mjs:56767` `defaultMinZoom = -2`),`setMinZoom(null)` 亦回 -2;`maxZoom` 預設 22.下限須由本套件明給(R11 預設 0).
- **`jumpTo` 以夾後實際值判斷是否觸發 zoomend**:請求值被夾成與現行同值時不發 zoomend,元件不補寫則 `opt.zoom` 與地圖脫節.
- **`setMinZoom/setMaxZoom` 於範圍衝突時拋錯**(新 min 大於現行 max、新 max 小於現行 min),`new Map({minZoom>maxZoom})` 亦拋錯;須依序設定(`mapCore.applyZoomRange`).
- **地圖實際可達最小層級隨投影而變**:globe 為 `minZoom + log2(cos 緯度)`(緯度 25° ≈ -0.143)、mercator 受容器高度限制(`log2(高/512)`,800×600 為 0.2288;容器變高時抬高最小層級,**且 `resize()` 只發 resize/moveend 不發 zoomend**).元件側不得對 `map.getZoom()` 再夾範圍(會與地圖振盪),只能以地圖實際值為準.
- **`jumpTo/easeTo/panTo/setZoom` 第一步 `stop()` 會同步結束進行中之動畫並補發其 `zoomend/moveend`**(`:55005`、`:55431-55451`、`:55564-55576`),且(未傳 `allowGestures`)`_stopHandlers()` 中斷使用者手勢/慣性.元件寫回 opt 之 handler 須以此為前提:同一 `changeOpt` 內先 `setZoom` 再 `panTo` 會讓 `setZoom` 同步觸發之 moveend 把尚未平移之舊 center 寫回 opt(center+zoom 同 tick 吞 center 之成因).
- **`jumpTo` 先設 zoom 後設 center**(`:43509-43513`):center 非法(緯度超界/NaN)時 zoom 已被改而不發事件 → center 必須先驗證才能合併 `jumpTo`.`setProjection` 帶約束遷移 transform 且不發事件(`:47370-47373`).globe 下僅改 center 之 `easeTo` 會依緯度差調整層級(`:46069`、`:46074`).
- **公開 `Map` 沒有 `isEasing()`**(僅內部 `Camera` 類),有 `isMoving()`/`isZooming()`;元件發起之平移動畫須自維護目標(`panTarget`),並以 `isMoving()` 為保險(避免 panTo 為空操作而未發 moveend 時殘留).
- **「元件再夾一次地圖已有之範圍」是結構性缺陷**:凡元件把地圖狀態寫回輸入、又對輸入另有一套正規化(夾值),兩者之值域必須由同一擁有者(地圖)決定,否則在地圖自有條件性限制(投影、容器)時會彈回.
- **驗「彈回」須看事件序列而非終值**:終值相同而過程彈回者(`[18,19,18,19,18]`)只看終值測不出;e2e 以頁內 `zoom/zoomend` 鉤子記錄序列,斷言單調(`nonDecreasing/nonIncreasing`),下限斷言容許 `[min-0.2, min+0.3]` 並在註解寫明依據.

## 寫回迴圈之實作與測試經驗(2026-10-16 issue #3 實作)

- **「先記狀態再呼叫會同步補發事件之相機方法」是反模式**:`panTo` 之 `stop()` 會同步補發被中斷動畫之 `moveend`,若 handler 清除了「剛設好」之 `panTarget`,保護即失效;狀態須於呼叫之後設(`panTarget = map.isMoving() ? 目標 : null`).同理凡 handler 會重設之旗標,不要在會同步觸發該 handler 之呼叫之前設.
- **`projectiontransition` 是投影切換後重讀層級/中心之最乾淨入口**:`migrateProjection` 後同步發出(`maplibre-gl-dev.mjs:59935-59937`),涵蓋 `load` 後自動投影、`opt.projection`、使用端經 `getMapObject().setProjection`;比在每個 `applyProjection` 呼叫點後補同步完整.mercator 約束亦會改中心(globe 縮到底 → 切 mercator,中心緯度 25.06° → 4.21°),只同步 zoom 不夠.中心同步須在地圖不移動時才做(動畫中途點非最終值).
- **範圍變更先於 center 處理時,`needZoom` 須以範圍變更前之層級判斷**:範圍把現行層級拉到恰等於父層明給之 zoom 時,若只剩 center 走 `panTo`,globe 下 maplibre 會依緯度差調整層級(實測 5 → 4.1426)丟掉明給之 zoom.
- **變異檢驗(mutation check)有用**:逐一破壞單一機制後跑對應 e2e,可得「哪個機制被哪個案例鑑別」之證據;本輪發現 `holdWriteBack` 於外審修正 `needZoom` 後在 e2e 已無可觀察差異(縱深防禦),及 `!==` 對 `1e-9` 容差不可由 e2e 觀察.做法:`tmp/probe-run02/mutate2.mjs`(逐檔記原文、改字串、等 HMR 20s、跑 `--grep`、finally 還原;前提 8123 已有常駐 dev server,e2e-setup 會 reuse,每輪約 1 分鐘).**cmd 之 `|` 會被當管線**:spawn `shell:true` 傳 `--grep` 含 `|` 須外包雙引號.
- **跨 tick 情境之 e2e 不要靠測試端兩次 Playwright 點擊之間隔**:兩次點擊間隔不確定(可能落在 500ms 動畫結束後 → 無鑑別力之假綠).改由範例頁(父層程式)以 `setTimeout` 依序賦值,並把「賦值當下 `isMoving()`」記於 `window.__movingAtZoom`,測試斷言其為前提.
- **以包裝 `maplibregl.Map.prototype.setZoom/jumpTo` 記錄元件之相機呼叫**:`getMapObject()` 之 Proxy 不影響元件內部使用之原 map,spy 須掛原型;範例頁 `mounted` 包裝、`beforeDestroy` 還原.用於「無關之 opt 變更不應呼叫 setZoom」類斷言.
- **globe 下滾輪縮小以游標為錨**:游標偏離畫布中心時中心會往高緯度漂移,而 globe 下限 `minZoom + log2(cos 緯度)` 隨之放寬(實測 -1.91,緯度 74.6°);測「縮到底」須把游標置於畫布中心.
- **ESLint 規則**:`brace-style` 不允許單行 `{ stmt }` 區塊(含 `try { } finally { }`、箭頭函式 `=> { a; b }`),`promise/param-names` 要求 `new Promise((resolve) => …)` 命名;提交前對改動檔跑 `npx eslint --no-eslintrc -c .eslintrc.js <檔>`(不加 `--fix`).`defBaseMaps.mjs:97` 之行尾空白為既有.
- **opencode(muse 1.3)外審可能無回應**:2026-10-16 探測最小任務(「只回一行」)四種選項組合皆逾時 120s(含預設模型 big-pickle),主因疑為服務端;派工 detached 後長時間無輸出時不要空等,以其他審查者之結果為主並於報告記錄.
- **Playwright `locator.click` 後之 `page.evaluate` 取地圖物件前須確認為「新實例」**:remount 場景以 `getMapObject()` 代理物件身分比對(代理於 `map._wlfProxy` 快取,每個 map 一個).

## 圖台移動狀態 `state` 屬性之實作與測試經驗(2026-10-31 map30,Gitea #30,規則帳本 R16)

- **Vue 2 對 `false` 值之屬性綁定會移除該屬性**:根節點 `:loading="loading"` 在 `loading=false` 時整個屬性消失(只有 `true` 時才有 `loading="true"`),不是 `loading="false"`;`:state="state"` 為字串故恆存在.偵測「載入中」用屬性存在與否.
- **根節點 DOM 屬性比 maplibre 事件晚一個微任務**:Vue 於 `nextTick`(微任務)才 patch,故在 maplibre 事件處理器內同步讀 `getAttribute('state')` 讀到的是上一輪的值;e2e 要斷言「事件當下已是 moving」須用更早發生的觸發(如 wheel 預標記,與 movestart 相隔 40~80ms)或改看 MutationObserver 記錄之順序.Playwright 的下一個指令必在微任務之後,故「操作後立即讀到 moving」成立.
- **maplibre 6.14.0 滾輪縮放有起始延遲**(`ScrollZoomHandler.wheel`/`_start`,`maplibre-gl-dev.mjs:53487-53535`):首個 wheel 事件若辨識不出類型(Playwright `deltaY=120` 即是)先 `setTimeout(_onTimeout, 40)`,再等下一影格 `renderFrame` 才開始,實測 wheel → movestart 43~79ms;期間 `isMoving()` 為 false,若只依 `movestart` 設 moving,此窗口內 `state` 仍是 idle(讀到舊 idle 即 e2e 之 flaky 成因).層級已達上下限時滾輪**不發 movestart/moveend**,但約 430ms 後仍會有 `idle`(`_finishTimeout` 200ms 後觸發重繪).
- **`projectiontransition` 只在真正遷移(`migrateProjection`)時發**(`:59935-59937`),同型別 `setProjection` 於 `style.setProjection` 提前 return(`:47338`)不發,但 `Map.setProjection` 仍呼叫 `_update(true)` 重繪;遷移後 `tileManagers[*].reload()`(`:47374`),故 `loaded()` 在重載期間為 false,`idle` 於圖磚重載後才發.投影切換不經 `movestart`/`moveend`(opt.projection 變更、`getMapObject().setProjection`).
- **`map.resize()` 會發 `movestart`/`move`/`resize`/`moveend`**:容器尺寸改變也會讓 `state` 短暫為 moving.
- **自動投影於層級 8 之切換發生在 `zoomend` 處理器內**(元件 `zoomend` → `applyProjection`),早於同一影格之 `moveend` 與其後之 `idle`;實測滾輪 7 → 9:`projectiontransition` 2021.1ms → `zoomend` → `moveend` 2021.7ms → `idle` 2038.7ms.故以 `idle` 為終點即涵蓋投影切換.
- **`idle` 事件緊跟 `moveend`**:panTo 動畫實測 moveend 506ms、idle 625ms(圖磚載入);滾輪縮放 moveend 到 idle 僅 33ms.`moveend` 當下 `map.loaded()` 為 false.
- **設計取捨(R16)**:逾時後備常數 `MOVE_IDLE_WAIT_MS=3000`(相機停止後等 idle 之上限)與 `MOVE_WHEEL_WAIT_MS=600`(滾輪後等 movestart 之上限);逾時當下 `map.isMoving()` 為真則續等,不強行落定.慢網路下圖磚超過 3 秒未載完時 `state` 會先轉 idle(後備之代價,已文件化).
- **e2e 觀察手法**:頁內 `MutationObserver` 記錄根節點 `state` 每次變化(`window.__stateLog`,含 `performance.now()`、`loaded`、`isMoving` 與 `loading` 屬性)+ 事件鉤子 + `requestAnimationFrame` 逐影格位姿,三者同一時鐘可互相對時;斷言以「變化序列恰為 moving → idle(無中途 idle 閃爍)」「idle 後 N 影格位姿不變」「idle 記錄不早於最後 moveend 且由其後之 idle 事件導致」為主,免固定等待.逾時後備之驗證以覆寫 `map.fire` 吞掉 `idle` 事件(實例屬性遮蔽原型方法,經 `getMapObject()` Proxy 之 `set` 落到原 map),並斷言 idle 監聽收到 0 次以證前提(每案新瀏覽器,故不還原).
- **修前紅之作法(不動工作樹)**:`git archive HEAD src | tar -x -C tmp/map30/old` 解出 HEAD 之 src,另寫 vue 設定(`VUE_CLI_SERVICE_CONFIG_PATH`)以 `NormalModuleReplacementPlugin(/^\.\/components\/WMaplibreglVue\.vue$/, <HEAD 副本>)` 只換元件,其餘(含新增之範例頁)照現行;在同一 8123 埠換掉 dev server 後跑新增之 e2e,即得「既有碼無此屬性」之紅.**此法只適用於證明「新 e2e 對舊元件會紅」;不可用來判定既有 e2e 之紅燈歸屬**——對照組仍含新版範例頁(見〈測試與實測腳本〉之對照組教訓,2026-10-31 map30c).
- **變異檢驗腳本不可被背景指令時限強殺**(2026-10-31 實例):`run_in_background` 之 `timeout` 給 3600000(1 小時)而變異鏈約 5 分鐘一項、11 項超過 1 小時,第 8 項執行中被強制終止,`finally` 未執行 → `src/js/moveState.mjs` 殘留變異內容(`onIdle` 插入 `return`),且 quiet-run 之測試鎖殘留(`web-tests-b`,以 `quiet-run --release-stale --cwd <repo>` 回收).對策:時限給到上限 7200000 並分批(每批 ≤ 6 項);腳本開跑前以備份檔(`tmp/map30/moveState.orig.mjs`)檢查/還原現檔;每批結束與收尾皆以 `git hash-object` 回驗還原.
- **首頁 `networkidle` 取決於外網**:`page.goto(baseUrl, { waitUntil: 'networkidle' })` 會等首頁預設範例(size)之遠端底圖,外網慢時 30 秒逾時(變異檢驗中 1 次 `page.goto` 逾時,與被測碼無關);新測試檔用 `domcontentloaded` 再以選單 locator 自動等待;既有三檔仍沿用 `networkidle`(未改).
- **追蹤器初值與元件初值須單一來源**:變異「初值改 idle」只被單元測試抓到、e2e 不可觀察——因元件在載入時另有 `projectiontransition`(`load` 後自動投影遷移)把狀態推成 moving 再由 idle 落定;元件初值改取 `moveState.getState()` 避免兩處各寫一個常數.
- **主控守門 hooks 擋 `>`/`>>` 寫檔**:迴圈重跑、背景鏈改寫成 `tmp/map30/*.mjs`(`spawnSync` 呼叫 `quiet-run`)再以 `node` 執行;`Atomics.wait` 可在同步 node 腳本內睡眠.

## 建置流程(script.txt)

- **`gDistApp.mjs` 會清空 `docs/examples/`**(`rollupVueToHtml` 所致),116 個 `ex-*.html` 須由其後之 `gExtractHtml.mjs` + `gDocExams.mjs` 重建.**驗證時不可只挑部分步驟跑**,否則 docs 被刪(2026-10-01 曾發生,補跑兩步後恢復).只需驗 dist 時只跑 `gDistRollupComps.mjs`(僅寫 dist).
- **`gDistApp.mjs` 之產物亦含內嵌 worker**:`App.vue` → 各範例組件 → `WMaplibreglVue.vue` → `mapCore.mjs` → `maplibreWorkerInline.mjs`(重產後 app.umd.js 增約 500KB 可證).
- **vue-cli `devServer` 設定會與預設做物件合併**:傳陣列(如 `static: [...]`)會被併成 `{0:..,1:..}` 而 schema 驗證失敗;且 `static` 預設承載 `public/`(內有 e2e 用之 `e2e-dem.png`、`e2e-icon-init.png`).需加中介層時用 `setupMiddlewares`(`@vue/cli-service/lib/commands/serve.js:252-253` 會呼叫專案者並採其回傳值).

## 測試與實測腳本

- **`spawn(..., {shell:true})` 之參數只拼接不跳脫**:`node -e "…(q,s)=>…"` 之括號被 cmd.exe 吃掉、`>` 變重導向,會在 cwd 建出 `s.end('x')).listen(…)` 之類空檔,且 server 根本沒起來(實測假陽性之成因).實測用之 server 一律寫成獨立 .mjs.
- **實測「殺不殺得掉」必附對照組**:另跑一組「完全不殺」並先自我驗證 server 確已 listen,否則分不出「被殺掉」與「從未起來」.
- **`process.on('exit')` 與 SIGINT handler 內之非同步 `spawn('taskkill')` 無效**(2026-09-12 實測 5 組):`process.exit()` 會放棄 event loop 內工作;同樣的非同步 spawn 於「自然退出」(mocha root after hook)路徑則有效.`test/tools/e2e-setup.mjs` 之 exit/SIGINT/SIGTERM 備援因此實際無效,改 `execSync` 即可修(未改,待使用者裁示).
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
