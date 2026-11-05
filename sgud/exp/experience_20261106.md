# 累積經驗(舊經驗抽出)

本檔為 `sgud/exp/experience.md` 於 2026-11-06 抽出之舊經驗(2026-10-01~10-31 之各節;抽出原因:原檔約 43 KB 逾全域設定 30 KB 之整理門檻).節號與標題不變,不刪內容,只搬移;需要久遠經驗時再調閱.

## maplibre-gl 6.x 之 worker(2026-10-01 升 5→6、2026-10-16 固定 6.14.0)

- **worker 載入失敗之徵狀**:console 僅一行 `Error: Worker failed to load. Check that the worker URL is correct.`,地圖只畫底色(圖磚交 worker 解析),頁面 `networkidle` 永不達成 → e2e 全數於 `page.goto` 逾時 30s.此時 `curl http://127.0.0.1:8123/` 仍回 200,**勿誤判為 dev server 或網路問題**.
- **兩種打包之 worker URL 推導不同**(實測):rollup 打 umd 時 `import.meta.url` 被轉為 `document.currentScript.src`,推導出產物旁之 `./maplibre-gl-worker.mjs`;webpack 下 maplibre 內部有 `if(!/^https?:/.test(t))return""`,推導結果為**空字串**,`new Worker('')` 直接失敗.診斷法:頁面載入前覆寫 `window.Worker` 記錄其 URL 參數.
- **現行解法**:`toolg/gDistRollupWorkerFuncs.mjs`(2026-11-02 由 `gDistRollupMaplibreGlWorker.mjs` 改名,依 dspec〈自有套件之發布與建置腳本〉規則 5 之先產 worker 進 src 一律此名)把 worker 打包成自足單檔內嵌為字串(`src/js/maplibreWorkerInline.mjs`),`src/js/mapCore.mjs` 之 `ensureWorkerUrl()` 建 Blob 交 `setWorkerUrl`.v6 只有 `setWorkerUrl(string)`,無 setWorkerClass/工廠入口.
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
- **變異檢驗(mutation check)有用**:逐一破壞單一機制後跑對應 e2e,可得「哪個機制被哪個案例鑑別」之證據;本輪發現 `holdWriteBack` 於外審修正 `needZoom` 後在 e2e 已無可觀察差異(縱深防禦),及 `!==` 對 `1e-9` 容差不可由 e2e 觀察.做法:`tmp/probe-run02/mutate2.mjs`(逐檔記原文、改字串、等 HMR 20s、跑 `--grep`、finally 還原;前提 8123 已有常駐 dev server,e2e-setup 會 reuse,每輪約 1 分鐘;**2026-11-05 起須設 `E2E_PORT_OFFSET=0` 才沿用常駐者**,未設則視為被占用而位移自起,見〈測試與實測腳本〉與規則帳本 R19).**cmd 之 `|` 會被當管線**:spawn `shell:true` 傳 `--grep` 含 `|` 須外包雙引號.
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

- **容器尺寸改變曾有兩個 `map.resize()` 來源**(2026-11-05 wm313,規則帳本 R16-6):maplibre 6.14.0 之 `trackResize` 預設為真,以 `ResizeObserver`(`maplibre-gl-dev.mjs` `_setupResizeObserver`,`throttle(…, 50)` 首次立即)於回呼內即時 `resize(entries)` + `redraw()`;元件另掛 `v-domresize`(`domDetect` 亦用 `ResizeObserver`,惟經 `setTimeout` 延後發出,探測 30 輪晚第一次約 19~23ms〔另有單輪 53ms〕,CPU 節流 6x 下第二次晚至點擊後約 +190~310ms)→ 公開方法 `resize()` → 同一次尺寸改變第二次 `map.resize()`(`map.resize()` 無條件發 `movestart`/`move`/`resize`/`moveend`,不檢查尺寸有無改變).診斷法:包 `map.fire`(movestart/idle 附 `new Error().stack`)與 `map.resize`、另掛 `ResizeObserver` 記錄,綠輪即可見兩次 `resize()`(`entries` 引數者為 maplibre、`undefined` 引數者為元件之 `resize()`);偶發紅不需等自然出現,綠輪之事件時刻差即可定位來源.
- **偶發紅單案 0/30 重現不出時之證據作法**:①CDP `Emulation.setCPUThrottlingRate` 6x(M8 已用之手法)放大計時器與繪製之相對時序差,修前 3/10 輪出現目標序列;②注入 `window.setTimeout`(≤5ms 之計時器延後 150ms)直接「控制 resize 時序」,修前 8/8 輪出現同一序列,可做成確定性案例(M6b);③**事件組數**(一次尺寸改變之 `resize`/`movestart`/`moveend` 各 1)與時序無關,修前綠輪亦為 2,是最穩之回歸斷言.
- **修一種失敗模式後,須在原誘發條件下重跑,觀察是否露出被掩蓋之另一種**:本例修前之「雙組」會把另一合法時序掩蓋——`ResizeObserver` 回呼內 `resize()`+`redraw()` 若同步達成 `idle`(`idle` 之堆疊為 `_render ← redraw ← ResizeObserver`),`moving`/`idle` 兩次寫入 `data.state` 皆在 Vue 之微任務更新之前,被合併,DOM 屬性不曾顯示 `moving`;修前第二組使屬性出現 `moving → idle` 而測試誤綠.修後在 CPU 節流 6x 下此時序約 2~3 成(M6c 7/25、探測 2/12;不節流 0/30),原 M6 之「必須觀察到 `moving → idle`」斷言(`settleTrace` 等 `l.length >= 2`)會因此 20 秒逾時.處置不是放寬:以頁內 `queueMicrotask` 標記判定 `movestart` 後是否已過微任務檢查點(Vue `nextTick` 先排,標記為真即 DOM 已更新),兩種時序各有確定期望(已過 → 恰 `moving → idle`;未過 → 屬性序列為空),其他序列一律紅;該時序下追蹤器壞掉與合法完成在 DOM 不可分,由單元測試與其他觸發案例(M2a–f)負責.
- **移除「重複」之機制前,先問它還順帶做了什麼**(2026-11-05 wm313,獨立審查指出、實測證實):`v-domresize`(`resizeWithWindow`)除與 `trackResize` 重複外,還在任何視窗 `resize` 事件呼叫 `map.resize()`,順帶使 `devicePixelRatio` 改變時畫布重算;maplibre 6.14.0 無 `devicePixelRatio` 監聽、`ResizeObserver` 對固定像素容器不觸發,移除後畫布停在舊解析度(CDP `Emulation.setDeviceMetricsOverride` 模擬縮放 125%:有指令 → 畫布 1000×625 像素,移除後 800×500).補償只在 ①`devicePixelRatio` 與上次 `resize` 時不同、②容器尺寸未變時呼叫(容器尺寸亦變者交 `ResizeObserver`),避免再造雙來源;`window.addEventListener('resize')` 之處理器先於同影格之 `ResizeObserver` 回呼(依 HTML 規格「更新渲染」之順序:resize 事件 → rAF → 版面 → `ResizeObserver`,未逐項實測).
- **記錄 `state` 屬性變化之 `MutationObserver` 不是逐次寫入記錄**:Vue 合併更新後屬性只變一次或不變,`window.__stateLog` 之長度不等於 `data.state` 之寫入次數;要驗「追蹤器有無轉換」須用單元測試(`unit-moveState` 以假 map 逐事件斷言 `onChange`),不可由 DOM 序列反推.
