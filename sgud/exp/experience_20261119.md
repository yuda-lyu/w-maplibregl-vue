# 累積經驗(2026-11-19 抽出之舊節)

本檔為 `sgud/exp/experience.md` 之抽出檔(2026-11-19 wml550b 依 sgud 過長整理):下列 2 節自該檔**逐字搬移**,節號與標題不變:
- 差異路徑(僅 name、僅地形倍率)與 `opt` 位姿契約文件之實作與測試經驗(2026-11-06 ma327)
- 高負載下只出現一次之 e2e 紅之查證經驗(2026-11-07 mv329)

## 差異路徑(僅 name、僅地形倍率)與 `opt` 位姿契約文件之實作與測試經驗(2026-11-06 ma327,規則帳本 R8、R12〈重評條件〉)

- **同來源 `map.setTerrain({ source, exaggeration })` 不重抓 DEM**(maplibre 6.14.0 實測,一次性探測腳本,未入版控):頁內包裝 `addSource/removeSource/setTerrain`、監聽 `terrain-src` 之 `dataloading`、`page.on('request')` 計數 DEM 請求,三者並用;現行整組重套 = 1 次請求、2 次 `dataloading`、`setTerrain(null)`→`removeSource`→`addSource`→`setTerrain`;同來源就地 = 0 次請求、0 次 `dataloading`、`getTerrain().exaggeration` 讀回新值.平坦 DEM 無高程,倍率無法由畫面觀察,以 `getTerrain()` 為準.
- **改了某路徑後,要找「靠舊路徑做事」之既有 e2e 是否已變空驗**:F10 就地化後,範例頁 `tuneTerrain` 只改 `exaggeration` 即走就地路徑,E2E-012(重套 terrain 後 hillshade 疊序)仍綠卻不再驗重套;處置是範例頁按鈕連 `hillshadeExaggeration` 一併改(斷言不動).做法:grep 觸發該欄位變更之範例頁按鈕與測試,逐一判斷其目的是否仍被執行.
- **差異路徑之 e2e 量測法(不動範例頁)**:於既有頁面再掛第二個元件實例——取既有實例 `el.__vue__.constructor.super` 為 Vue,父層 `new Vue({ data: { opt }, render })` 持有響應式 `opt`(同使用端用法);圖磚與 DEM 用 `ctx.route('http://tile.local/…')` 回應並於測試端計數(永不連外);元件之 `applyBaseMaps/applyTerrain` 與地圖之 `addSource/removeSource/setTerrain` 於頁內包裝計數.「不再請求」只能以穩定窗(請求數連續 600 ms 不變)觀察;正向事件(名稱出現於面板、`getTerrain` 為新值)以事件等待.元件之寬高須給在元件本身(`h(Ctor, { style })`),只給外層則真滑鼠命中不到.
- **禁用 `git stash`/`checkout` 時之「修前紅」**:手動還原修改取得修前等價狀態(把 `name` 自 `BASEMAP_PAINT_STATE` 移除、元件改 `false &&`)跑新 e2e,同時得修前紅與變異證據(D1、D3 紅,負向 D2、D4、D5 綠);另以兩個過寬變異(把 `maxzoom` 納入放行、忽略僅倍率旗標)驗負向案例(D2、D4、UD3 紅).單元測試因整檔新增而得真正之修前紅(原碼未改).
- **README 契約句須逐句實測,且探測要控制變因**:「只改 `opt.center` 至高緯度則 `opt.zoom` 被改寫」僅地球投影成立,探測初版固定 `projection:'mercator'` 量到「不變」,補成未給/`'globe'`/`'mercator'` 三組才分清(未給與 `'globe'` 為 6→5.1249,`'mercator'` 不變);真滑鼠點擊面板勾選框須限定於本實例之面板(`#host .clsPanel input`),`.first()` 可能點到頁面上另一實例而得無效資料;凍結資料集物件本身時,面板顯隱勾選框狀態會變、圖層不隱藏、`opt` 無 `visible`,但頁面**無** `pageerror`——不能以「無錯誤」判定行為正常,須讀 `opt` 值與圖層 `visibility`.
- **sgud 之 rulebook/experience 為 CRLF(state 為 LF)**:拆分腳本以 `\n` 切行會保留行尾 `\r`,新增之檔頭若為 LF 即混用,須統一為 CRLF;比對「原有行是否仍存在」時先去除 `\r`.Edit 工具編輯 CRLF 檔會保留 CRLF.拆分腳本寫在 `./tmp/`,輸出可導向暫存目錄先做純搬移驗證(遺失行 0)再改內容,以免「搬移」與「修改」混在一起無法區分.

## 高負載下只出現一次之 e2e 紅之查證經驗(2026-11-07 mv329,`e2e-movestate` E2E-M8,規則帳本 R16)

- **只有序列、沒有頁內紀錄的一次紅,先補觀察手段再重跑**:不改測試檔,以 mocha `--require` 掛鉤於 playwright 層包 `chromium.launch`〔2026-11-13 起專案不直接依賴 playwright,不得再 import `playwright`;此類觀察掛鉤改以 w-playwright 之 `setBrowserTypeForTest` 替身 `launch(opt, next)` 包裝真啟動(w-playwright README 載明此用法;本套件未實測)〕——`newContext` 後 `addInitScript` 注入記錄器(全程記錄,不被測試之 `startTrace` 重設:wheel 事件、地圖事件、`data.state` 每次寫入〔`vm.$watch('state', …, { sync: true })` 即 `moveState` onChange 當下〕、逐影格位姿、long task),`browser.close` 前取回紀錄並截圖,root `afterEach` 寫入結果(通過者刪截圖).`--grep E2E-M8` 每次獨立 mocha 與 dev server,與 `npm test` 之路徑相同.
- **堆疊判讀因受 V8 `Error.stackTraceLimit`(預設 10)所限**:Vue 之 watcher 框架吃掉多層,`toMoving` 之呼叫端(onWheel/onMoveStart/onProjection)被截掉;下次於記錄器先設 `Error.stackTraceLimit = 50`.本次改以時間判定:moving 寫入於第一個 wheel 後 0.8~12.3ms 且早於 movestart → 滾輪預標記.
- **滾輪手勢之結束窗(maplibre 6.14.0 `scroll_zoom.ts`)**:wheel 型之 easing 以「距上一個 wheel 之時間 /200ms」推進,滿 1 後再設 200ms `_finishTimeout` 才發 `zoomend`/`moveend`;下一個 wheel 在此之前到達即續為同一手勢.實測 CPU 節流 6x:最後一次 wheel 後 436~736ms 發 `moveend`、584~1601ms 發 `idle`(自然 30 次,跨 8 級含投影切換與圖磚重載;停頓注入 3 次為 464~514ms、605~684ms);`moveend` 之後、`idle` 之前到達之 wheel 會開新手勢但 `state` 仍為 moving(不閃;讀碼推論:`onWheel` 於非 idle 時不動作、`onMoveStart` 重設計時,未實測),間隔須逾「wheel 至 `idle`」才閃.`waitForTimeout(60)` 之間隔在頁面端實為 116~361ms(節流 6x;一般條件與負載 ≤ 70% 相近;推測因 Playwright `mouse.wheel` 等瀏覽器處理完才返回,未以對照實驗驗證),故「14 次滾輪 = 一個手勢」只在本輪條件下成立,負載更高時是否逾此延遲為推測.
- **同形狀可能是真停,不一定是缺陷**:`moving → idle → moving → idle` 先問中途 idle 是否為真——該 idle 前有無 `moveend` 與 `idle` 事件、當下 `isMoving()`/`loaded()`、idle 至下一個 moving 間位姿是否不變、下一個 moving 是否由晚於 idle 之輸入引起;全成立即狀態機正確,紅在測試前提.停頓注入要以事件同步(等 `state=idle` 再續滾),不用固定毫秒.
- **負載產生器**:8 邏輯核、5 個低於標準優先權之忙迴圈子行程(佔空比由父行程依 `os.cpus()` 每秒調節,目標 62%、上限 70%)——佔空比 1 時整機約 50%,測試執行期間平均 56~62%、p95 70~82%(瀏覽器與 dev server 另占);quiet-run 之獨佔鎖需整機 ≤ 30% 才放行,他 agent 跑多開時排鎖約 15 分.
- **外部 CDN 慢會使 `page.goto(domcontentloaded)` 逾時**:`public/index.html` 有 5 支同步外部 script(含 `yuda-lyu.github.io` 兩支 1.0~1.4MB);2026-11-07 github.io 一度 60 秒未下載完,e2e 於進場即逾時(與被測功能無關).量測時以 `ctx.route` 回應先前完整下載之同一檔案;2026-11-07 mv329b 起正式 e2e 以 `test/tools/e2eCdnLocal.mjs` 處理(R5).
- **(mv329b)`ctx.route` 之先後**:Playwright 之路由後註冊者優先;某檔另掛 `**/*` 攔截且對外部請求 `abort`(`e2e-diffpath`)時,先註冊之本機副本路由不會被呼叫——該檔原本就不連外,不必套用.套用與否以「其後有無涵蓋外部網址之攔截」判,不以檔名判;是否真的接手以回應次數核對(探測:5 支各 1 次、長度與副本相同,進場 875ms).
- **(mv329b)把「確定期望」寫成正負向一組**:新斷言 `assertWheelSeq` 依可觀察條件(手勢中地圖是否發過 `idle` 事件)分兩種期望;正向案(停頓注入 M8b)要另證「舊斷言下確定紅」,負向案(M8c 注入 `idle`、M8d 停頓中 `easeTo`)以 `assert.throws` 加訊息正則固定「被哪一條判紅」,並以暫改(M8c/M8d 直接呼叫、不包 `assert.throws`;M8b 換回舊斷言)實跑三案皆紅,還原後以 sha256 回驗.正向案不寫「恰 4 筆」:負載更高時其餘間隔亦可能逾窗而多停一次,恰 N 筆會把同一不穩定帶回來;以「注入點處有 idle 記錄」與逐段判定取代;負向案之前提亦以注入點(第幾個 wheel 之間)定位,不以序列索引.
