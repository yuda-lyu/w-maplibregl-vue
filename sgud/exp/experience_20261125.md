# 累積經驗(2026-11-25 抽出之舊節)

本檔為 `sgud/exp/experience.md` 之抽出檔(2026-11-25 tml619 依 sgud 過長整理):下列 2 節自該檔**逐字搬移**,節號與標題不變:
- 升 maplibre-gl 6.14.0 → 6.16.0 之經驗(2026-11-09 ml01)
- 升 maplibre-gl 6.16.0 → 6.18.0 之經驗(2026-11-19 wml550)

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
- **下游盤點之 Grep 用法**:對 套件庫根以 `*/*/src/**`、`*/*/test/**`、`*/*/package.json` 各一次(不帶 `!` 排除、不用大括號合併排除式,後者逾時只回本庫);本庫命中以「回傳路徑為相對於 cwd(無磁碟機前綴)」辨識,其他套件為絕對路徑;式樣若用不分大小寫之 `maplibre` 會把 `maplibregl-vue` 字樣全吃進來(本庫 291 檔),盤點用 `maplibre-gl`.
