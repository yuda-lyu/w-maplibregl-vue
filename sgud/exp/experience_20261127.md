# 累積經驗(2026-11-27 抽出之舊節)

本檔為 `sgud/exp/experience.md` 之抽出檔(2026-11-27 m674b 依 sgud 過長整理:原檔約 29 KB,逼近 30 KB 門檻):下列 3 節自該檔**逐字搬移**,節號與標題不變:
- e2e 進場載入條件改 domcontentloaded 之經驗(2026-11-19 wml550b,規則帳本 R5〈e2e 進場載入條件〉)
- e2e 取得受管瀏覽器之經驗(2026-11-25 tml632,排程第 632 項,規則帳本 R20 要求 5、6)
- 升 maplibre-gl 6.18.0 → 6.19.0 之經驗(2026-11-25 tml619,規則帳本 R1)

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

## 升 maplibre-gl 6.18.0 → 6.19.0 之經驗(2026-11-25 tml619,規則帳本 R1)

(前兩次升版之經驗〔6.14.0 → 6.16.0、6.16.0 → 6.18.0〕已抽出至 `sgud/exp/experience_20261125.md`;影響清單與探測數據見 `sgud/rule/rulebook_upgrade.md`〈破壞性變更紀錄:maplibre-gl 6.18.0 → 6.19.0〉.)

- **U52/U53 這次沒有紅,先跑再判斷、不為「上次紅」而預先改檢查式**:6.19.0 之 `workerFactory`、`isClassicWorkerUrl`、`isCrossOrigin` 與 6.18.0 相同(把 `maplibre-gl.mjs` 內 `WORKER_URL` 附近各處之識別字全換成固定字樣後逐字相同:`sed 's/[A-Za-z_$][A-Za-z0-9_$]*/X/g'` 後 `diff` 無差異;獨立複審另將 `isCrossOrigin` 至 `workerFactory` 整段〔1383 與 1395 字元〕依識別字對照改名後逐字比對,唯一差異是 `createWorker` 於 `new Worker` 前多一次 `createScriptURL`〔#9068 Trusted Types;未設政策時為恆等函式,本套件不設〕);該函式本體不在 U52 任何正則內(6.18.0 亦然),宿主頁面若設了 Trusted Types 政策,政策會收到本套件之 data:/blob: URL,拒絕時於 `try` 之外拋錯,U52/U53 不會察覺——現況無此使用情境,未加檢查,列為選配.
- **本次差異在內部架構而非公開 API**:#8694 移除 `Transform` 類別、相機狀態集中到 zustand store(兩版 `src/` 差異 175 項,新增 `camera/` 31 檔).「本庫 `src/` 無 `transform` 命中」只證明沒有直接存取,不證明行為不變;找影響之順序:①取 CHANGELOG 該節(發布包不含 CHANGELOG,本機無 `gh`;`curl https://raw.githubusercontent.com/maplibre/maplibre-gl-js/v<版>/CHANGELOG.md` 可取,節內以 `awk '/^## 6.19.0/{f=1} /^## 6.18.0/{f=0} f'` 截出);②兩版 `npm pack` 解開,比對 `src/`(`diff -rq` 先看檔級增刪)與 `dist/maplibre-gl.d.ts`(`Map$1` 類別之公開成員);③以 Grep `-o` 列出本套件實際呼叫之 `map.xxx(` 與私有欄位(`map._delegatedListeners` 唯一)逐一對照;④並排探測證明行為(下)。`Map` 兩版皆無公開 `transform`;`map._camera.transform`(`@internal`)6.19.0 移除,改為 `_store`.
- **並排探測之陷阱(下次直接沿用 `tmp` 內作法,但先避開這些)**:
  - **容器 `id="map"` 使 `window.map` 為該 DIV**:`window.map.remove()` 把容器自頁面移除,下一次建圖報 `Container 'map' not found`;地圖實例改存 `window.__m`.
  - **「0 處不同」可能是兩邊同樣出錯**:`map.project()` 回傳 `Point`(`{x,y}`),無 `toArray()`,包在 try/catch 時兩版得相同錯誤字串,位姿與投影比對空轉;事件紀錄器內呼叫不存在之 `map.isEasing()`(`Map` 無此方法)使 `movestart`/`moveend`/`idle` 全不入紀錄,事件比對亦空轉.**比對前先確認結果裡有預期之真值(非錯誤字串、事件數 > 0)**,每個場景附「非空洞」抽查(本輪補 I、J 場景時列出各層數量)。
  - 6.x 已無 `getFreeCameraOptions`/`setFreeCameraOptions`(改為 `calculateCameraOptionsFromTo`、`calculateCameraOptionsFromCameraLngLatAltRotation`、`calculateAnchoredCameraOptions`);誤用舊 API 兩版皆拋錯而空轉.
  - **`idle` 只在「由忙轉閒」時發一次**:已 idle 之地圖呼叫 `triggerRepaint()` 不會再發 `idle`,`once('idle')` 必須配逾時,否則掛住(本輪第一版手勢場景因此卡住 10 分鐘以上才被終止).
  - **事件序列比對之噪音**:連續型事件(`move`/`zoom`/`rotate`/`pitch`/`roll`/`drag`)之交錯與次數隨影格而變,收斂為單一記號再比;起訖事件與當下之 `isMoving`/`isZooming`/`isRotating` 逐項比;每個動作 3 次重複並**先量版本內差異再比跨版本**;被中斷之動作(`sleep` 100~150 ms 後下新指令)終值隨動畫進度而變,版本內即不同,不是版本差異.
  - **渲染比對**:`preserveDrawingBuffer: true` 加 `gl.readPixels` 可得整張畫布之 FNV 雜湊與分色像素計數;`fadeDuration: 0` 使放置(placement)於數個影格內落定而可重現,但與本套件實際設定(預設淡入、`antialias: true`)不同,另以 J 場景用本套件之設定(`antialias`、`attributionControl: false`、`minZoom`/`maxZoom`、`load` 後自動投影、`zoomend` 再套、於 `projectiontransition`/`zoomend`/`moveend` 事件當下讀 `getZoom`/`getCenter`/`isMoving`)比對事件序列.
  - **文字圖層需字型伺服器**:Playwright 路由以手工編碼之 protobuf(`glyphs{ stacks{ name, range, glyphs{ id, bitmap, width, height, left, top, advance } } }`,欄位 1/2/3,`sint32` 需 zigzag)供應合成字形(每個 ASCII 可印字元一塊實心方塊,含 3 px SDF 緩衝),即可比對 `text-halo`、`text-variable-anchor`、`text-overlap`、線上標籤與叢集計數之渲染;空回應不行(無字形即不繪)。
  - **真手勢**(Playwright 滑鼠鍵盤與觸控 `tap`)之慣性終值隨滑鼠移動間隔而變(快速拖曳 3 次中有 1 次終值較遠),結論須以版本內重複次數支持:K 場景快速拖曳 20 次量分佈.
- **6.18.0 之 `setMaxBounds` 缺陷(#9022)會損壞相機狀態**:`setMaxBounds([[-180,-60],[180,60]])` 於 6.18.0 拋 `Cannot read properties of null (reading '0')`,其後 `getBounds` 得 ±180、`project` 得 NaN,渲染迴圈連續拋錯;探測腳本把此步放在一條序列中段,使其後所有步驟皆「不同」而蓋過真正之比對——**會損壞狀態之探測步驟放在序列最後或獨立地圖**(本輪第一次 A 因此全部後段步驟誤報不同).
- **發布包配置全套之沙箱**:`npm pack` 之 tarball(380 檔,5.8 MB)解開後自建 `node_modules`,以鎖檔 `npm ci`;使用者之 npm 設定有 `min-release-age`(7 天冷卻)時,鎖檔所釘之自有套件新版會 `ETARGET`(`No matching version found for wsemi@x with a date before …`),該次安裝加 `--min-release-age=0`(版本由鎖檔釘住,不放寬任何範圍);`npm ci` 失敗後 `node_modules` 殘留空殼,重跑前先確認(`robocopy /L` 列舉模式)再重裝。
