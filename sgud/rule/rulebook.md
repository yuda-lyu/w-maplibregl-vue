# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

> 盤點指令皆於專案根執行.`src/js/maplibreWorkerInline.mjs` 為 500KB 機器產製檔,grep 時一律排除.

## R1 maplibre-gl 依賴固定版號,且三處版本一致

- **要求**:`package.json` 之 `dependencies.maplibre-gl` 為固定版號(無 `^`/`~`),且 = 實際安裝版 = 內嵌 worker 版(`maplibreWorkerInline.mjs` 之 `maplibreVersion`).
- **why**:內嵌 worker 依開發端安裝版打包;範圍版號時使用端以 src 引用本套件,主程式取自其 node_modules 而可能為較新版,與 worker 不一致即可能崩潰(maplibre 6.13.0 曾修「stale cached worker crashing the map」).固定後 npm 保證本套件 src 解析到該版(使用端另依賴他版時為本套件巢狀安裝).
- **單一擁有者**:版號只在 `package.json` 改;改後 `npm i` → `node toolg/gDistRollupWorkerFuncs.mjs`.
- **盤點**:`node -e "let p=require('./package.json').dependencies['maplibre-gl'],i=require('./node_modules/maplibre-gl/package.json').version,w=(require('fs').readFileSync('./src/js/maplibreWorkerInline.mjs','utf8').match(/maplibreVersion = \"([^\"]+)\"/)||[])[1];console.log(JSON.stringify({spec:p,installed:i,inline:w,ok:/^\d+\.\d+\.\d+$/.test(p)&&p===i&&i===w}))"` → 須 `ok:true`.2026-10-16:三處皆 `6.14.0`.
- **守門**:①建置期 `toolg/gDistRollupWorkerFuncs.mjs` 對「非固定版號」與「與安裝版不符」拋錯(2026-10-16 負向實測 4 案:`^`、`~`、不符各擋下,固定且相符放行;2026-11-02 起由 `test/unit-workerBuild.test.mjs` U55 以副本並指定 cwd 執行腳本自動驗證:`^`、`~`、未指定、不符 4 案皆非零離開且不產出,U54 為固定且相符放行);②執行期 `src/js/mapCore.mjs` 之 `ensureWorkerUrl()` 比對 `maplibregl.getVersion()` 與內嵌版,不符 `console.warn`.
- **已知限制**:使用端若自己也直接依賴另一版 maplibre-gl 並打包,bundle 會含兩份 maplibre;maplibre 之安全修補須由本套件改版跟進.

## R2 maplibre-gl 一律以 namespace 匯入

- **要求**:`import * as maplibregl from 'maplibre-gl'`,禁 default import(6.x 為 ESM-only 且無 default export,default import 得 undefined).
- **盤點**:`git grep -n --untracked "from 'maplibre-gl" -- src ':!src/js/maplibreWorkerInline.mjs'`;default 殘留:同指令改搜 `import maplibregl from 'maplibre-gl'`,須 0 筆.
- **站點全集(2026-10-16)**:`src/js/mapCore.mjs:10`、`src/js/popupManager.mjs:7` → 皆已套.CSS 另以 `import 'maplibre-gl/dist/maplibre-gl.css'` 引入(`src/components/WMaplibreglVue.vue`),路徑於 6.x 不變.

## R3 worker 只經 `ensureWorkerUrl()` 設定,且早於任何建圖

- **要求**:`setWorkerUrl` 只出現於 `mapCore.mjs` 之 `ensureWorkerUrl()`;所有 `new maplibregl.Map(` 之前須先呼叫它.不得於範例 `main.js` 或 `vue.config.js` 另設 worker(2026-10-01 曾以 `/mlg` 中介層暫解,已回收).
- **盤點**:`git grep -n --untracked -E "setWorkerUrl\(|new maplibregl\.Map\(|ensureWorkerUrl\(\)" -- src ':!src/js/maplibreWorkerInline.mjs'`.
- **站點全集(2026-11-02)**:定義 `mapCore.mjs:72`、唯一 `setWorkerUrl` 呼叫 `:99`、唯一建圖點 `:119`,其前 `:113` 呼叫 `ensureWorkerUrl()` → 已套.新增建圖點時須同步套用.`ensureWorkerUrl()` 內依環境分 module Blob 與 classic data: URL 兩路(R17),`setWorkerUrl` 仍只此一處.
- **驗證**:dist 僅單一 umd 檔時,以 test-html 範例頁(http)實測 Worker URL 為 `blob:`、對外部 `maplibre-gl-worker`/`shared` 檔之請求 0、worker 錯誤 0(2026-10-16 通過);file:// 與 sandbox iframe 見 R17(`e2e-fileprotocol`).

## R4 建置順序(script.txt)

- **要求**:依 dspec〈自有套件之發布與建置腳本〉(`C:\opensrcOper\dspec\自有套件之發布與建置腳本.md`)規則 3 之型 B 列序與規則 4、5 之 toolg 標準寫法;本套件不另立列序、腳本寫法或盤點規則,`script.txt` 由使用者維護(agent 不改其內容與順序).
- **事實(非規則,供查證)**:`gDistApp`、`gDistRollupComps` 之產物皆含 `src/js/maplibreWorkerInline.mjs`,故先產 worker 進 src 之 `gDistRollupWorkerFuncs` 排在其前(即型 B 之〔gDistRollupWorkerFuncs〕位置);`gDistApp` 會清空 `docs/examples/`,其後接 `gExtractHtml`、`gDocExams`.
- **撤除(2026-11-02 依 dspec 規則 1)**:原要求中「各腳本單一職責,不於腳本內互相呼叫」與以 `node -e` 解析 `script.txt` 之列序盤點指令;列序之盤點改由主控 `tools/inventory-build.mjs` 統一處理.

## R5 測試配置

- **要求**:測試檔放 `test/` 根層、`*.test.mjs`、以 `e2e-`/`api-`/`unit-` 前綴分層,不開層級子目錄;配套工具放 `test/tools/*.mjs`(不帶 `.test.`);`package.json` 之 scripts 測試類僅 `test`,值為 `mocha --no-parallel "test/*.test.mjs" --timeout 180000`.
- **站點全集(2026-10-16)**:`test/e2e-displayorder.test.mjs`、`test/e2e-hover.test.mjs`、`test/e2e-runtime.test.mjs`(E2E-001–015;displayorder、hover、runtime 三檔合計 34 案)、`test/e2e-basemapzoom.test.mjs`(E2E-A/B)、`test/e2e-zoomrange.test.mjs`(E2E-Z1–Z21 含 Z4b、Z6b/c、Z7a/b/c、Z8b、Z9b/c、Z11b、Z12b、Z14c、Z16×2、Z16b×4、Z16c、Z17b、Z18–Z21,共 39 案〔2026-11-04 wm71 增 Z16b×4、Z16c〕;R11/R12/R13/R15)、`test/e2e-opacity.test.mjs`(E2E-O1–O4,R14)、`test/e2e-movestate.test.mjs`(E2E-M1、M2a–f、M3–M11、M12a/b、M13、M14,共 20 案,R16)、`test/unit-basemapManager.test.mjs`(U1–U16、U27–U29)、`test/unit-zoomRange.test.mjs`(U17–U26、U30–U32)、`test/unit-moveState.test.mjs`(U33–U46 含 U42b,共 15 案,R16)、`test/unit-workerClassic.test.mjs`(U47–U53,共 7 案,R17)、`test/e2e-fileprotocol.test.mjs`(E2E-F1–F4,共 4 案,R17;不經 dev server,測試頁 `test/fixtures/fileProtocol.html`)、`test/unit-workerBuild.test.mjs`(U54–U55,共 2 案,R1 守門①/R17;以副本並指定 cwd 執行 `toolg/gDistRollupWorkerFuncs.mjs`)、`test/unit-scaleBar.test.mjs`(U56–U61,共 6 案,R15;純函式 `src/js/scaleBar.mjs`),`test/tools/e2e-setup.mjs`、`test/tools/toolgCopy.mjs`(副本複製與指定 cwd 執行之輔助,供 `e2e-fileprotocol`、`unit-workerBuild`).
- **執行**:`npm test`;單案 `npm test -- --reporter list --grep "<案名>"`.e2e 共用基準埠 8123(dev server;`e2e-fileprotocol` 例外,不起服務);**基準埠被占用時自動整組位移(8223、8323…),不沿用也不下殺占用者**(R19,2026-11-05 wm309);要沿用本機常駐之 dev server(變異檢驗等快速迴圈)須明確設 `E2E_PORT_OFFSET=0`,且該埠上的監聽者須確為本專案之 `vue-cli-service`,否則拒絕.
- **站點補充(2026-11-05 wm309)**:`test/tools/e2ePorts.mjs`(基準埠單一定義與 `reserveE2ePorts`)、`test/tools/devServerIdentity.mjs`(埠上監聽者身分確認,無副作用)、`test/unit-e2ePortReserve.test.mjs`(PR-001～PR-013,15 案,R19).
- **已修(2026-11-05 wm309,R19)**:`test/tools/e2e-setup.mjs` 之 `stopServer` 原以非同步 `spawn('taskkill')`,exit/SIGINT/SIGTERM 備援路徑實測無效(`process.exit`、SIGINT 後真實 `npx vue-cli-service` 殘留,2026-11-05 以 `tmp/wm309/exitpath.mjs` 重現),Ctrl+C 或 `mocha --exit` 後 dev server 會殘留;導入自動換埠後殘留者不再被「埠通即沿用」重用而每次多占一組埠,故改為同步 `spawnSync('taskkill …')`(只殺自己 spawn 的行程樹),`unit-e2ePortReserve` PR-013 守護(修前紅:shell 鏈替身於 `process.exit` 後殘留;修後綠).

## R6 圖磚來源之層級欄位(minzoom/maxzoom)單一正規化

- **要求**:`baseMaps[i]` 與 `terrainMap.terrainSource`/`hillshadeSource` 之 `minzoom`/`maxzoom` 只經 `src/js/basemapManager.mjs` 之 `assignSourceZoomRange(spec, cfg, label, useMin)` 寫入 maplibre source;正規化只在 `toTileZoom(v, kind)`:數字或數字字串;非有限數(含 `Infinity`)、負數、非數值視為未給而**不寫鍵**;maxzoom 無條件捨去、minzoom 無條件進位;minzoom>maxzoom 時只捨 minzoom 並 `console.warn`(maxzoom 為保護性欄位).未給或無效者 source 與未支援前**逐鍵相同**(opt-in).
- **why**:①raster(tileSize 256)請求層級＝round(zoom+1)(maplibre `covering_tiles.ts:172-178`),服務層級有上限時未給 maxzoom 即請求不存在之層級——無地形時初載與平移新區域空白、有地形時仍每畫面報錯(2026-10-16 審計實測);②maplibre 對 source 數值只驗型別,`NaN` 被拒收即整個 source 不存在、負數則錯畫(實測);③小數層級之效果等同進位(`covering_tiles.ts:367,373-374`),故捨 max、進 min 方保守;④`cdbl` 經 lodash toFinite 會把 `Infinity` 轉成 `Number.MAX_VALUE`,須先判有限.
- **站點全集與判準(2026-10-16)**:vector 分支(`map.addSource(srcId, assignSourceZoomRange({ type: 'vector', url: u }, …))`)、raster/wms 分支(`assignSourceZoomRange({ type: 'raster', tiles, tileSize: 256 }, …)`)= min+max 已套;terrain、hillshade(`useMin=false`)= 只 max(**刻意不開放 minzoom**:DEM 低於 minzoom 時地形變平而非不顯示,`terrain_tile_manager.ts:288-292`,語義不同);style 分支 = 刻意不套(source 由 style JSON 自帶).hillshade 與 terrain 同 url 時共用 `terrain-src`,hillshade 自身欄位不生效(另案 F7).
- **盤點**:`Grep "assignSourceZoomRange\(" src/js/basemapManager.mjs` → 定義 1 + 呼叫 4(vector、raster/wms、terrain、hillshade);`Grep "\.(minzoom|maxzoom)\s*=" src/js/basemapManager.mjs` → 只在 helper 內(2 筆);`Grep "parseInt\(" src/js/basemapManager.mjs` → 0 筆(舊 `isnum`+`parseInt` 寫法已收斂).2026-10-16 實跑皆符.
- **測試**:`test/unit-basemapManager.test.mjs` U1–U14;e2e `test/e2e-basemapzoom.test.mjs` E2E-A、E2E-B.

## R7 底圖/地形設定欄位與 JSDoc 一一對應

- **要求**:`basemapManager.mjs` 讀取之 `bm.*`、`tsrc.*`、`hsrc.*`、`tm.*` 欄位皆須有 `src/components/WMaplibreglVue.vue` 之 `@vue-prop`(`opt.panelBaseMaps.baseMaps[i].*`、`opt.panelBaseMaps.terrainMap.*`);url 之說明依 type 分述.
- **盤點**:`Grep -o "\b(bm|tsrc|hsrc|tm)\.[a-zA-Z]+" src/js/basemapManager.mjs` 去重,另加 helper 以 `get(cfg, 'minzoom'|'maxzoom')` 讀取之兩欄 → 逐一對 `Grep "@vue-prop.*panelBaseMaps\.(baseMaps\[i\]|terrainMap)" src/components/WMaplibreglVue.vue`(2026-10-16:baseMaps[i] 12 項、terrainMap 8 項,皆對上).
- **站點全集(2026-10-16)**:bm:name、url、type、colorShade、visible、opacity、layerType、layer、layers、colorFillExtrusion、maxzoom、minzoom;tsrc/hsrc:url、encoding、tileSize、maxzoom;tm:terrainSource、hillshadeSource、exaggeration、hillshadeExaggeration → 皆已有 JSDoc.`defTerrainMap.terrainSource.layerType` 無程式讀取,為保留欄位,刻意不列 JSDoc(預設檔已加註).

## R8 底圖欄位執行期變更之路徑

- **要求**:`processPanelBaseMaps` 依差異函式分三路——僅 paint 欄位(`colorFillExtrusion`、`opacity`)→ P1 `updateBaseMapPaint`;僅 `visible`/順序(+paint)→ P2 `updateBaseMapsIncremental`;其餘一切欄位(含 minzoom/maxzoom 等 source 欄位)→ P3 `applyBaseMaps` 完整重建.新增 source 欄位不需改差異函式;key 衍生(`baseMapKey`)與 layer/source id 不含 source 選填欄位.
- **盤點**:`Grep "BASEMAP_PAINT_STATE|stripPaint" src/js/basemapManager.mjs`(paint 清單只在此二處).
- **測試**:U5、U14;E2E-B(執行期加 maxzoom 即生效).
- **已知限制**:僅 `name` 變更亦走 P3(另案 F5);terrainMap 任一欄位變更皆全重建(另案 F10);Vue2 以一般賦值新增鍵不觸發 deep watcher,須 `$set`.

## R9 預設底圖之層級須符合服務實況

- **要求**:`src/js/defBaseMaps.mjs` 中服務層級有上限之 raster 預設必帶 `maxzoom`.
- **修訂(2026-10-16,圖台上限放寬至 22 後)**:原「OpenStreetMap、Mapbox 19 級有實圖 = 不需」之前提是圖台被寫死 ≤18(256px 圖磚於地圖層級 z 請求 round(z+1) 級,地圖 ≤18.49 時圖磚 ≤19)——R11 把圖台預設上限放寬至 22 後該前提**失效**:OSM 於 z≥20 回 400(30 bytes `Bad Request`,無 CORS 標頭,不補則放大過 18.5 即空白並報 CORS 錯誤),故 OSM 須 `maxzoom: 19`;Mapbox 衛星 TileJSON(`api.mapbox.com/v4/mapbox.satellite.json`)宣告 `maxzoom: 22`,對齊宣告,不依賴「超出宣告仍回 200」之未載明行為.
- **站點全集(2026-10-16 以 curl 抽驗,修訂後)**:OpenTopoMap = `maxzoom: 17`(18 級起回固定佔位圖「max zoom layer = 17」且無 CORS 標頭,未帶時每畫面 24 則 CORS 錯誤);OpenStreetMap = `maxzoom: 19`(z16~19 實圖、z≥20 回 400);Mapbox = `maxzoom: 22`;style 型別 = 不適用(自帶);vector(OpenFreeMap Buildings)= TileJSON 自帶(`maxzoom:14`,放大靠 overzoom);地形 DEM = 沿用 13(保守,不動).
- **盤點**:對每個未註解之 raster 預設以 `curl -s -o /dev/null -w "%{http_code} %{size_download}"` 抽驗 18~23 級是否為實圖(不同座標大小相同且 md5 相同即佔位圖;HTTP 400 即服務無該級);另 `Grep "maxzoom" src/js/defBaseMaps.mjs` 須見 OSM 19、Mapbox 22、OpenTopoMap 17.
- **使用端自訂底圖**:本套件不替自訂 raster/wms 補 `maxzoom`;服務層級有限者放大過其層級後空白並報錯,須自行加 `baseMaps[i].maxzoom` 或以 `opt.maxZoom` 限制圖台(見〈圖台縮放範圍預設放寬〉).
- **測試**:U15、U27.

## R10 baseMaps 之 url 無效條目略過

- **要求**:`applyBaseMaps` 內 `bm.url` 非非空字串之條目一律略過並 `console.warn`,不拋例外、不影響其他條目(與地形/陰影之 `isestr(url)` 對稱).
- **why**:未檢查時 `u.startsWith`/`u.includes` 拋 TypeError,中斷 `applyBaseMaps`(此時舊 source 已全移除),初載時更中斷 load 處理器其後之地形、資料圖層與 idle 登記.
- **盤點**:`Grep "isestr\(bm\.url\)" src/js/basemapManager.mjs` → `addBaseMapLayer` 開頭 1 處.
- **測試**:U16.

## R11 圖台縮放範圍單一擁有者:地圖為唯一仲裁

- **要求**:
  1. `opt.minZoom`/`opt.maxZoom`(預設 0/22)只經 `configProcessor.computeZoomRange(opt)` 正規化:數字或數字字串依數值;非數值/非有限(`NaN`、`±Infinity`、`null`、布林、陣列、物件、空字串)視為未給用預設;夾在 0~24(maplibre `MapOptions` 合法上限,`toZoomLimit` 為唯一夾值處);`minZoom > maxZoom` 時忽略 `minZoom`(保留 `maxZoom`,與 R6 對圖磚 `minzoom>maxzoom` 之作法一致)並由呼叫端 `console.warn`(同一組輸入只警告一次,與有效範圍是否改變無關:例如只給 `minZoom:23` 而有效範圍仍為預設 0~22 亦警告;建圖時由 `createMap` 警告一次,執行期由 `changeOpt` 依輸入組合去重),警告文字須寫明有效 `maxZoom`(含預設).
  2. 範圍只經 `mapCore.createMap`(建構時傳入 `new maplibregl.Map`)與 `mapCore.applyZoomRange(map, next)`(執行期)寫入 maplibre;`applyZoomRange` 須依現行值先設不與另一端衝突者(maplibre 之 `setMinZoom` 於新 min 大於現行 max、`setMaxZoom` 於新 max 小於現行 min 時**拋錯**),並以 `try/catch` 保底(不外洩例外).
  3. **元件側不得對 `opt.zoom` 另夾範圍**:`computeBasicOpt` 之 `zoom` 僅轉數值(非數值→6),不 `Math.min/max`;超出範圍者交 `map.setZoom/jumpTo`,由地圖拉入範圍,元件以地圖實際層級回寫(R12).
  4. `mapCore.mjs` 不得有第二份 center/zoom 正規化(`createMap` 呼叫 `computeBasicOpt`).
- **why**:①HEAD 兩份寫死之 1~18 夾值(`configProcessor.mjs`、`mapCore.mjs`)與地圖真實範圍(maplibre 6.14.0 實作之 `minZoom` 預設 **-2**〔文件寫 0〕、`maxZoom` 22)分離,使用者縮放/縮放鈕/滾輪/`opt.zoom`/API 一超出 1~18 即被 `setZoom` 拉回(issue #3:自 17 連按放大鈕 4 次,第 2 次起 19→18 彈回);②「兩處夾值改夾同一組 minZoom~maxZoom」不足:地圖自身有條件性限制——globe 投影最小層級 = `minZoom + log2(cos 緯度)`(緯度 25° 縮到底 ≈ -0.143)、mercator 受容器高度限制(800×600 容器為 0.2288),元件側再夾一次必與地圖實際值不一致而振盪(實測 `[…,-0.143,0,-0.143,0…]`、`setZoom` 6 次/縮到底);③`minZoom>maxZoom` 傳入 `new Map` 拋錯使整個元件無法建立;④維持 minZoom 預設 -2 會使全球視圖縮得過小,0 對標 react-map-gl/vue-maplibre-gl 且 512px 世界於 z0 恰為一幅.
- **盤點**(皆排除 `src/js/maplibreWorkerInline.mjs`):
  - `git grep -nE --untracked "LIM_ZOOM|Math\.(min|max)\(.*[zZ]oom|[zZ]oom.*Math\.(min|max)" -- src ':!src/js/maplibreWorkerInline.mjs'` → 命中僅限:`configProcessor.mjs` 之 `LIM_ZOOM`(定義與 `toZoomLimit` 夾 0~24)、`computeZoomRange` 內 `Math.min(DEF_MIN_ZOOM, maxZoom)`,及 `WMaplibreglVue.vue` 資訊區 Zoom 純顯示用之 `Math.max(0, …currentZoom…)`(N2,不影響地圖;HEAD:另有 2 行夾 `opt.zoom` 於 1~18 → 改後 0 行);
  - `git grep -nE --untracked "setMinZoom|setMaxZoom" -- src ':!src/js/maplibreWorkerInline.mjs'` → 僅 `mapCore.mjs` 之 `applyZoomRange`(含其 JSDoc 一行);
  - `git grep -n --untracked -A14 "new maplibregl.Map" -- src/js/mapCore.mjs` 之物件須含 `minZoom`、`maxZoom`(實跑 2026-10-16 通過;`git grep` 之 `-A` 與 `--untracked` 可並用).
- **站點全集(2026-10-16)**:建圖點 1(`mapCore.createMap`)、執行期寫入點 1(`WMaplibreglVue.changeOpt` → `applyZoomRange`)、正規化點 1(`computeZoomRange`)→ 皆已套.新增建圖點或第二個寫入範圍處須先改本規則.
- **已知限制(文件化,不修)**:
  - L1 地圖實際可達最小層級受投影影響(見 why②),故 `opt.zoom` 寫回值可略低於或高於 `minZoom`;globe 下**僅改 `center`** 時 maplibre 亦會依緯度差調整層級並寫回(預設 zoom 6 即 globe:6→5.1426,`handleEaseTo` 加 `getZoomAdjustment`);面板 Zoom 顯示 `Math.max(0, …)` 不顯示負值;globe 下滾輪以游標為錨縮小時,偏離畫布中心的游標會使中心往高緯度漂移,下限隨 `log2(cos 中心緯度)` 放寬至遠低於 `minZoom`(實測游標偏離中心時縮至 -1.91、中心緯度 74.6°),亦屬 maplibre 自身行為,非彈回.
  - L2 `opt.pitch`/`opt.bearing` 無輸入也無寫回(只有唯讀鏡射 `currentPitch/currentBearing` 供羅盤),屬功能缺口,非本類別缺陷.
  - L3 Vue 2 響應式:欲於執行期變更或接收寫回之 `opt.zoom`、`opt.center`、`opt.minZoom`、`opt.maxZoom` 須於 `opt` 預先宣告該鍵,否則為非響應式(缺鍵時元件寫回之值不觸發父層,且下一次無關之 opt 變更會以舊值拉回);執行期把 `opt.zoom` 設非數值或刪鍵 → 視為未給,地圖跳到預設 6(與初始「未給→預設」一致).
  - L4 `clusterPointsMaxZoom` 須 < 18(GeoJSON source 預設 maxzoom 18,≥ 時 maplibre `warnOnce` 但仍叢集);仍設 ≥ 18 者,叢集點擊展開層級可 > 18(HEAD 彈回 18,現不彈回,最高至 `maxZoom`).
  - L5 `type:'style'`/`'vector'` 底圖放大靠 overzoom(TileJSON/style 自帶層級);`baseMaps[i].maxzoom` 為「圖磚層級」,地圖層級 z 約請求 z+1;非疊加層(radio)之 vector 底圖亦以 0.8 繪製而面板無指示.
  - L6 範圍變更期間(`holdWriteBack`)moveend 不更新 `currentCenter`;若範圍變更連帶移動中心(mercator 世界高度適配、globe 緯度夾值;極窄:高緯度且 `maxZoom` 極小),`currentCenter` 於下一次 moveend 才同步(自癒).修法會引入「護欄期間 `currentCenter` 與 `opt.center` 不一致 → 反向 panTo」之新風險,故不修.
  - D4 縮放 +/- 鈕於邊界不顯示停用狀態:另案(排程第 34 項).
- **測試**:`test/unit-zoomRange.test.mjs` U17–U26、U31(`applyZoomRange` 窮舉:所有「現行範圍 × 新範圍」轉換不拋錯且結果為新範圍);`test/e2e-zoomrange.test.mjs` E2E-Z1(預設上限 22 不彈回)、Z2(`opt.maxZoom:20` 停於 20)、Z3(`opt.minZoom:5` 停於 5 無振盪)、Z4(預設下限 0 不彈回 1)、Z5(執行期收縮/放寬)、Z6(`min>max` 忽略並警告;Z6b 建圖時同;Z6c 只給 `minZoom:23` 有效範圍不變亦警告)、Z7a/b/c(公開 API 不彈回)、Z10(`baseMaps[i].maxzoom` 與圖台上限分工,zoom 21)、Z15(叢集展開 > 18 不彈回)、Z18–Z21(開啟地形之代表案例,離線平坦 DEM).

## R12 opt↔地圖寫回迴圈不得吞值

- **要求**:元件把地圖狀態寫回 `opt` 之欄位(現為 `zoom`、`center`,及 `syncBaseMapsToOpt` 之底圖 visible/opacity),與 `changeOpt` 對地圖之 `setZoom/jumpTo/panTo/applyZoomRange` 必須:
  1. zoom 與 center **同時**需變更時,單一 `map.jumpTo({ center, zoom })`(瞬移,與僅變更 zoom 之 `setZoom` 一致);僅 center 變更仍 `panTo`(動畫),僅 zoom 變更仍 `setZoom`.「zoom 需變更」以**範圍變更前**之現行層級與範圍變更後之現行層級**任一**與 `opt.zoom` 不同判定(`needZoom`):範圍變更可能把現行層級拉到恰等於父層明給之 zoom,若只以拉入後判斷則僅剩 center 走 `panTo`,globe 下 maplibre 會依緯度差調整層級而丟掉父層明給之 zoom(例:globe zoom 7,同 tick `maxZoom=5`、`zoom=5`、center 緯度 60° → 4.14).
  2. 範圍變更(`applyZoomRange`)期間 `holdWriteBack=true`:`zoomend/moveend` 不回寫 `opt`(maplibre 於範圍外之現行層級被拉入時**同步**觸發 zoomend/moveend,護欄使舊 center 不會於範圍變更期間被寫回 `opt.center`).**縱深防禦**:R12-1 之 `needZoom` 判定使範圍拉入時必走 `jumpTo`(其 moveend 於同一呼叫內寫入新 center),故停用護欄於 e2e 已無可觀察差異(變異檢驗 M2:Z9、Z9b、Z9c 皆仍綠);保留以免範圍變更連帶之 moveend 暫時把舊 center 寫進父層 `opt`.
  3. 呼叫地圖後**以地圖實際層級回寫** `opt.zoom`(maplibre 之 `jumpTo` 以夾後值判斷 `zoomChanged`,請求值被夾成同值時不觸發 zoomend,不補寫則 `opt.zoom` 與地圖脫節);比較前須判 `isnum(opt.zoom)`,不可對非數值強制轉型(`Number(Symbol)` 拋 TypeError、`Number(true)===1`).
  4. 比較用容差(`Math.abs(a-b) > 1e-9`)而非 `!==`(浮點雜訊不視為變更).
  5. 元件發起之平移動畫(`panTo`,約 500 ms)未結束又要改 zoom 時,經 `panTarget` 一併落定(`jumpTo({ center: panTarget, zoom })`,且僅當 `map.isMoving()` 為真):`setZoom/jumpTo/panTo` 第一步 `stop()` 會**同步**結束進行中動畫並補發 `moveend`,否則動畫中途點被寫回 `opt.center`、新 center 永久遺失;使用者手勢造成之動畫不設 `panTarget`(避免把使用者拖曳拉回舊 center).**`panTarget` 須於 `panTo` 呼叫之後設**(`panTarget = map.isMoving() ? 目標 : null`):`panTo` 之 `stop()` 會同步補發被中斷動畫(如前一次 `opt.center` 變更之平移)之 moveend,其 handler 清除 `panTarget`,先設則被清掉而第二段動畫中改 zoom 走 `setZoom`,第二個 center 永久遺失(Z11b).
  6. 不經 `zoomend` 之層級/中心變更(切換投影 `setProjection` 帶約束遷移 transform 且不發 zoomend/moveend、容器 `resize()` 只發 resize/moveend)後以 `syncZoomFromMap()`/`syncCenterFromMap()` 重讀地圖層級與中心並同步 `currentZoom/currentCenter/opt.zoom/opt.center`(僅差 >1e-9 才寫,故不覆蓋父層尚未處理之賦值;中心同步於動畫進行中不做〔中途點非最終值,動畫結束之 moveend 會寫回〕):投影切換經 `projectiontransition` 事件(maplibre 於 `migrateProjection` 後同步發出,涵蓋 `load` 後之自動投影、`changeOpt` 之 `opt.projection`、使用端經 `getMapObject().setProjection`),resize 經 `moveend`.
  7. 建圖後若 `opt.zoom`(未給/非數值者為預設 6)與地圖實際層級不同(被地圖夾入範圍),回寫實際層級;與地圖一致者(含未給 `opt.zoom` 而預設 6 落在範圍內)**不回寫、不新增鍵**.不一致卻不回寫,日後第一次無關之 opt 變更會觸發 `setZoom(過期值) → jumpTo → stop()`,中斷使用者進行中之手勢/慣性(Z14c:`maxZoom:4` 且未宣告 `zoom` 鍵).
  8. **任何新增之「元件改寫 `opt`」欄位須先登錄於本規則,並附同 tick、跨 tick 多欄位賦值之測試.**
- **why**:HEAD 實測 `opt.center=[23.5,120.9]; opt.zoom=14` 同 tick(三種賦值順序皆然,及整個換新 `opt` 物件)→ 地圖與 `opt.center` 皆回到舊 center:`changeOpt` 先 `setZoom` → maplibre 同步觸發 `moveend` → 把尚未平移之舊 center 寫回 `opt.center` → 第二輪 watcher 再 `panTo` 回舊值;平移動畫中改 zoom 同理(中途點);切換投影/resize 後 `opt.zoom` 與地圖失步(例 0.4 vs 1.2288).`maplibre-gl-dev.mjs:55005`、`:55431-55451`、`:55564-55576`(`stop()` 補發事件與 `_stopHandlers`)、`:47370-47373`(`setProjection` 不發事件).**公開 `Map` 沒有 `isEasing()`**(僅內部 `Camera` 類),平移動畫狀態須自維護(`panTarget`).
- **盤點**:`Grep "vo\.opt\.[a-zA-Z]+ *=[^=]" src/components/WMaplibreglVue.vue`(元件改寫 opt 之全部站點);`Grep "map\.(setZoom|jumpTo|panTo|easeTo|flyTo|zoomTo)" src`(元件對地圖之相機呼叫全部站點).
- **站點全集(2026-10-16,實作後)**:見本規則末〈實作後站點表〉.
- **已知限制**:L6(見 R11);`holdWriteBack` 為全域護欄而非 eventData 標記——`setMinZoom/setMaxZoom` 不收 eventData,範圍變更路徑仍須護欄,故不採標記法;**L7** 經元件公開方法 `panTo/centerTo`(`WMaplibreglVue.vue` 的 `panTo` 方法)發起之平移動畫、叢集展開 `easeTo`、縮放按鈕、羅盤等**非 `changeOpt` 發起**之動畫進行中,父層同時改 `opt.zoom`/`opt.center` 者,以 maplibre `stop()` 語意中斷動畫並以當下點寫回 `opt.center`(父層賦值之值不被吞;但公開 `panTo` 之目標會被動畫中途點取代)——`panTarget` 只涵蓋 `changeOpt` 內 `panTo`,未納入公開方法(罕見且不屬 issue #3 範圍).
- **R12-4(容差)無自動化測試**:`!==` 與 1e-9 容差之差異僅為多餘一次無實際位移之 `setZoom`(浮點雜訊),使用者可觀察結果相同;以盤點(`Grep "1e-9" src/components/WMaplibreglVue.vue`,現 4 處)與變異檢驗(M7:改回 `!==` 時 E2E-Z1 仍綠)確認不可由 e2e 觀察,刻意不補測.
- **測試**:E2E-Z8(center+zoom 同 tick)、Z8b(整個換新 opt,含 opt 值)、Z9(範圍+center 同 tick)、Z9b(範圍+zoom+center 同 tick)、Z9c(globe 下範圍+zoom+較高緯度 center,R12-1 `needZoom` 判定之鑑別案例)、Z11(平移動畫中改 zoom,跨 tick;賦值當下是否仍在動畫中由範例頁記錄於 `window.__movingAtZoom` 並於測試斷言為前提,不靠測試端兩次點擊之間隔)、Z11b(連續兩次改 center 後第二段動畫中改 zoom,R12-5 `panTarget` 設定順序之鑑別案例)、Z12(切換投影,含 center)、Z12b(經公開 API `setProjection`)、Z13(resize)、Z14(初始超界回寫與不新增鍵)、Z14c(未宣告 `zoom` 鍵而預設 6 落在範圍外,R12-7;以範例頁包裝之 `Map.prototype.setZoom/jumpTo` 呼叫記錄斷言其後無關之 opt 變更不呼叫)、Z17/Z17b(center 非法值,執行期與建圖)、Z18–Z21(開啟地形).
- **變異檢驗(2026-10-16,`tmp/probe-run02/mutate.mjs`、`mutate2.mjs`,逐一破壞單一機制後跑對應 e2e,結束必還原)**:第一輪:M1 停用 `panTarget` 分支 → Z11 紅;M3 停用 `syncZoomFromMap` → Z12、Z13 紅;M4 停用同 tick 單一 `jumpTo` → Z8、Z8b 紅;M5 停用 center 驗證 → Z17 紅;M6 停用建圖後回寫 → Z14 紅;M7 改回 `!==` → Z1 仍綠(見 R12-4).第二輪(外審後新增機制;紅燈訊息實測值):M8 `panTarget` 改為 `panTo` 之前設 → Z11b 紅(Z11 仍綠;中心 [24.506,121.379] 非目標 [24.5,121.5]);M9 `needZoom` 改回只看範圍拉入後 → Z9c 紅(zoom 4.1426 非父層明給之 5);M13 投影事件只同步 zoom 不同步 center → Z12、Z12b 紅(地圖中心緯度 4.21° 而 `opt.center` 仍 25.06);M10 建圖後回寫改回只處理已給數值 → Z14c 紅;M11 警告改回只在有效範圍改變時發 → Z6、Z6c 紅;M12 停用 `projectiontransition` 同步 → Z12、Z12b 紅;**M2 停用 `holdWriteBack` → Z9、Z9b、Z9c 皆仍綠**(見 R12-2 縱深防禦,護欄在 e2e 無可觀察差異;第一輪曾以 Z9b 鑑別,R12-1 修正後失效).

## R13 opt 輸入正規化為全函式

- **要求**:`computeBasicOpt`/`computeZoomRange` 對任何輸入(非數值、`NaN`、`±Infinity`、超界、數字字串、型別錯、`opt` 為 `null/undefined`)皆回合法值並**不拋錯**;不合法值之處置(預設/夾限/忽略)逐欄位寫於 `@vue-prop`:
  - `zoom`:數字或數字字串;非數值(含 `NaN`)→6;**不夾範圍**(R11),`±Infinity` 亦原樣交地圖(由地圖夾至範圍端點,R12 回寫實際層級).
  - `minZoom`/`maxZoom`:見 R11.
  - `center`:兩值皆須為**有限數**且緯度 |lat| ≤ 90(經度 |lng| 不限,maplibre 會 wrap),否則視為未給用預設 `[23.5, 121.1]`(`isNumber` 對 `NaN` 為 true,僅驗型別會使 `new Map` 拋 `Invalid LngLat latitude value`/`Invalid LngLat object: (NaN, NaN)` → 元件崩潰,執行中賦值則 `currentCenter` 被污染為非法值).數字字串 `['25','121']` 維持視為非法(HEAD 行為).
- **why**:center 驗證為 R12 合併 `jumpTo` 之**前置條件**:center 非法時 `jumpTo` 先套 zoom 後設 center 而拋錯(`maplibre-gl-dev.mjs:43509-43513`),無地形時活的 transform 被半改且不發事件、有地形時 zoom 停在舊值而 `opt.zoom` 已寫新值;HEAD 為 `setZoom` 先成功、`panTo` 才拋錯,故不驗證即上線比 HEAD 更糟.
- **盤點**:`computeBasicOpt` 內 zoom/minZoom/maxZoom/center 四欄皆有「非法→預設」分支;`Grep "isNumber\(center" src` 不得再有只驗型別之 center 檢查(HEAD 站點:`configProcessor.mjs:220`、`mapCore.mjs:57`)→ 改後 0.
- **測試**:U18–U22、U30(center)、U32(`computeBasicOpt`/`computeZoomRange` 對異常輸入集 fuzz 不拋錯、輸出合法)、E2E-Z17.

## R14 疊加層 opacity 預設與值域單一擁有者

- **要求**:疊加層(`colorShade` 空字串)之預設透明度與值域只經 `basemapManager.getBaseMapOpacity(bm)`:`bm.opacity` 為數字或數字字串 → 夾在 0~1 之有限數(`0` 有效,不可視為未給);非數值/非有限(`NaN`、`±Infinity`、`'abc'`、`''`、布林、陣列)→ 依型別預設(vector **0.8**,raster/wms 及其餘 **1**);`type:'style'` 回 `null`(不支援:各層自帶 opacity,常為 zoom 表達式).渲染(vector/raster 建立與 paint 更新,共 4 個站點)與面板(經元件方法 `bmOpacity(bm)`)一律呼叫之;面板於 `type==='style'` 不渲染滑桿與百分比(互動指示符號兌現不了就移除).`getBaseMapOpacity` 不寫入使用者 `opt`(相較於 `computePanelBaseMaps` 補預設,後者會使 `syncBaseMapsToOpt` 首次顯隱切換時把 `opacity:0.8` 寫進父層 opt).
- **why**:HEAD 預設透明度有 5 個互不相知之擁有者:渲染端 4 處(vector 0.8、raster 1)符合 JSDoc 契約,面板 `:value`/百分比(`WMaplibreglVue.vue:98-99`)不分型別一律 1 → 未給 opacity 之 vector 疊加層面板顯示 100%、實繪 80%(X3);另 raster/wms 疊加層 `opacity` 為字串數字/超界/`NaN` 時,maplibre 驗證 paint 失敗(`raster-opacity: number expected, string found` 等)→ **整個圖層不被建立**,面板卻顯示 `50%`/`150%`/`NaN%`.對照 `imageSets[i].opacity` 已有夾限 0~1.
- **盤點**:`git grep -nE --untracked "bm\.opacity|\.opacity != null|get\(.*'opacity'" -- src/js/basemapManager.mjs src/components/WMaplibreglVue.vue` → 命中僅限:`getBaseMapOpacity` 內(`get(bm, 'opacity', null)` 為唯一讀取點,另其 JSDoc 一行)、`setOverlayOpacity` 之寫入(`bm.opacity = parseFloat(val)`,滑桿值域本即 0~1)與其 `setPaintProperty` 讀取(讀剛寫入之值)、`syncBaseMapsToOpt` 之 `isNumber(bm.opacity)`,及 `imageSets[i].opacity` 之夾限(`WMaplibreglVue.vue` 的 imageSets 處理,屬影像集合,不屬本規則).HEAD:5 個獨立預設站點(`basemapManager.mjs:171,205,378,391`、`WMaplibreglVue.vue:98-99`)→ 改後 1.新增讀取 `bm.opacity` 之站點須改呼叫 `getBaseMapOpacity`,不得另寫 `get(bm,'opacity',…)`.
- **已知限制**:非疊加層(radio)之 vector 底圖亦以 0.8 繪製而面板無指示(L5);`setOverlayOpacity` 為面板滑桿(值域本即 0~1)之寫入路徑,不經 `getBaseMapOpacity`,以程式化方式(非公開方法)傳入 `NaN` 者不在本規則範圍;`imageSets[i].opacity` 之夾限對 `NaN` 無效(`isNumber(NaN)` 為 true)屬既有行為,範圍外(另案).
- **範圍**:`getBaseMapOpacity` 適用所有 raster/wms/vector 條目之渲染(含底圖〔radio〕與疊加層),非僅疊加層:既有使用端若對底圖(radio)給字串數字/超界/`NaN` opacity,升版後同樣被夾限/視為未給(見〈圖台縮放範圍預設放寬〉C14);面板專屬變化(滑桿與百分比)僅疊加層.
- **測試**:U28(`getBaseMapOpacity` 各型別/值域)、U29(4 個渲染站點之 paint = `getBaseMapOpacity`)、E2E-O1–O4(面板滑桿 `value`、百分比文字與實繪 paint 三者一致,含 raster、wms、vector 三種 layerType;無效值圖層仍建立;style 型不顯示滑桿).連續調整(拖曳)期間之預覽見 R18.

## R15 比例尺:色條依整齊距離換算、文字恆與色條相符,且距離對應 maplibre 512px 世界(獨立於 R11–R13)

- **要求**:
  1. **每像素公尺**須對應 maplibre 的 **512px 世界**(zoom 0 = 512px):`40075016.686 / 512 = 78271.51696`(m/px,赤道,zoom 0),`mpp = 78271.51696 × cos(緯度) / 2^zoom`.不得再用 256px 世界之 `156543.03392`(2026-10-16).
  2. **色條寬不固定**(2026-11-04,Gitea #71):取色條上限寬 80px 內**最大之整齊距離**(1、2、3、5 × 10^n 公尺,同 maplibre 內建 `ScaleControl` 之 `getRoundNum` 慣例),色條寬 = 距離 / mpp,恆落在 **(40, 80] px**(相鄰整齊距離之比 ≤ 2);文字即為色條所示之距離,不再以 `Math.round` 取整.
  3. **色條 `box-sizing:border-box`、外高維持 5px**:實寬(含 1px 邊框)即為算出之寬度(修前 content-box 實寬 82px,使文字與實際距離再差 2.5%;若 `border-box` 而 `height:3px` 則外高變 3px,屬樣式改變,故 `height:5px`).
  4. **文字格式**:≥1000 m 以 `N km`(N 必為 ≥1 之整數),其餘以 `N m`(N < 1000);< 1 m 以固定小數位表示(`0.5 m`),不出現科學記號;不得出現 `0.5 km`、`1000 m` 等不一致之表達.
  5. **輸入**:緯度 0 為有效值;非有限數字(含 `NaN`、`Infinity`、字串、`null`、`undefined`)或超出 ±90 回退預設 23.5(同 R12 對 `center` 之規則);`cos(緯度)` 夾下限 1e-6(≈ ±89.99994°,免緯度 ±90 時每像素公尺趨近 0);層級非有限回退 7(同元件 data 預設)、夾在 [-10, 40](免 `2^zoom` 溢位).
  6. **實作位置**:`src/js/scaleBar.mjs` 之 `computeScaleBar(lat, zoom)`(回傳 `{ meters, width, text }`)與 `niceDistance(max)`;元件以 computed `scaleBar` 取用.`panelScale.show/position`、`getPanelOrder`、面板樣式、對外 `opt` 皆不變(不新增 `opt`).
- **決定(是否改用 maplibre 內建 `ScaleControl`,2026-11-04)**:不改用,維持自製面板.查證:內建控制項為 `map.addControl` 掛入 maplibre 自己的四角容器(`.maplibregl-ctrl-*`),不經本元件的 `panelScale.position` 與 `getPanelOrder` 排序,無法與其他面板同角依 `order` 排列;其樣式(`maplibre-gl.css`:白底 75%、`#333` 字與邊框)與本元件深色玻璃面板(`rgba(0,0,0,0.6)`、白字)不同;文字帶不斷行空白(`scale_control.ts:142` 之 ` `),使用端以 `^\d+ (km|m)$` 比對者會失配;`maxWidth` 以 `getRoundNum` 取整後色條寬可超過 `maxWidth`(`scale_control.ts:140-141` 之 `ratio = 距離/上限距離` 可 > 1,例 0.37 m → 0.4 m 使 80px 變 86px).以上讀碼與讀 CSS 所得,未實跑內建控制項.故不能同時滿足位置、排序與樣式,依任務指示採自製 `computeScaleBar`.內建控制項以 `map.unproject` 實測,故在 globe 低層級較準(見〈限制〉).
- **why**:①(2026-10-16)`156543.03392` 為 256px 世界之常數(Leaflet 慣例),本套件自 Leaflet 移植後未換算,比例尺文字為實際距離之 **2 倍**(實測 80px 之真實地面距離:zoom 10/緯度 0° 為 6111 m 而顯示 `12 km`;zoom 16/緯度 25° 為 86.3 m 而顯示 `173 m`;顯示/實際 = 1.96~2.17;以 `unproject` 兩點 `distanceTo` 量測).②(2026-11-04,Gitea #71)修常數後文字仍以 `Math.round` 取整、色條固定寬(含邊框實寬 82px),兩者不相符:1.0.66 實測(以 `unproject` 量色條實寬兩點之 `distanceTo`)緯度 0 zoom 12 顯示 `2 km` 而色條實為 1565.2 m(比值 1.278)、緯度 24.7 zoom 12 顯示 `1 km` 而實為 1422.0 m(0.703)、緯度 0 zoom 10 顯示 `6 km` 而實為 6260.8 m(0.958);比例尺是使用者量距離之工具,此差異畫面上無從察覺.①②皆為「畫面數字變動」(見 C13).
- **盤點**:`git grep -nE --untracked "156543|78271" -- src ':!src/js/maplibreWorkerInline.mjs'` → 命中 3 行皆在 `src/js/scaleBar.mjs`:運算用 `78271.51696` 1 處(`computeScaleBar`)、說明註解 2 處(提及 512px 世界之換算與舊常數 `156543.03392` 以記錄成因,非運算).`git grep -nE --untracked "scaleText|Math\.round\(d" -- src ':!src/js/maplibreWorkerInline.mjs'` → 應無命中(舊 `scaleText` computed 已移除).
- **限制**:
  - **globe 投影低層級,文字與色條彼此相符,但與地面實距不符**:公式為墨卡托每像素公尺(取地圖中心緯度與 `currentZoom`),globe 投影下低層級偏離 `unproject` 實測(2026-11-04 實測,公式/實測 80px 距離:預設投影〔低層級自動為 globe〕zoom 0 為 0.667、zoom 1 為 0.927~0.939、zoom 2 為 0.977~0.980、zoom 3 為 0.992~0.993、zoom ≥5 為 0.999~1.001;墨卡托投影全層級 1.001~1.010).此為本元件 R15 自始之公式限制(修前同),#71 未涉及,**未處理**(證據 `wm71-evidence/02`);解法為改以 `map.unproject` 實測中心列兩點(同內建 `ScaleControl`),需新增與地圖事件同步之狀態,待裁示.
  - 公式取赤道周長換算而 `distanceTo` 取地球半徑 6371008.8 m,系統差約 0.11%;e2e 容差取 2%.
  - 色條寬隨縮放變動(40~80px 內),面板寬度隨之變動:面板貼右角時左緣移動、右緣錨點與高度(19px)不變.
  - 層級 ≥ 23 或緯度極高時文字為小數公尺(如 `0.5 m`、`0.0005 m`),緯度 ±90 內 `cos` 夾下限 1e-6 時文字為極小數字(僅為免溢位,實際地圖不會用到).
- **測試**:
  - `test/unit-scaleBar.test.mjs`:U56(6 緯度 × 層級 0~24 每 0.25 級共 582 組:色條寬 = 距離/mpp、(40, 80] px、整齊值、為 80px 內最大者)、U57(各整齊值之文字與單位、不出現 `0.5 km`/`1000 m`/科學記號)、U58(緯度 0 有效、非數字/超界回退 23.5、南北對稱)、U59(`niceDistance` 恰為 10^k 與 2、3、5 × 10^k 邊界)、U60(緯度 ±90、層級極大極小、非數字)、U61(`Math.log10` 偏小時仍正確,以 `Math.log(x)/Math.LN10` 暫代).
  - `test/e2e-zoomrange.test.mjs`:E2E-Z16(緯度 0 zoom 10、緯度 25 zoom 16:文字/色條實寬對應之 `unproject` 實距比值 0.98~1.02、整齊值、(40, 80] px、`border-box`、外高 5px)、**E2E-Z16b**(取整邊界 4 組:緯度 0 zoom 12 → `1 km`、緯度 24.7 zoom 12 → `1 km`、緯度 0 zoom 10 → `5 km`、緯度 23.82 zoom 7 → `30 km`)、**E2E-Z16c**(墨卡托 3 緯度 × 6 層級網格,含 `0.5 m`、`300 km`、`50 m`、`20 km`).
  - `test/e2e-runtime.test.mjs` E2E-005:zoom 10 緯度 0 為 `5 km` 且色條 65.41px(回退 23.5 度為 71.3px 可鑑別)、放大兩級 zoom 12 為 `1 km` 且色條 52.33px.**舊期望值 `12 km`(2× 錯誤值)與 `6 km`(取整,與色條差 4%)皆為現狀指紋,隨修正更新**.
  - 變異(2026-11-04,wm71):取整改回(U56/U57/U58/U60 紅)、整齊距離表少 3(U56/U57/U59/U60 紅)、緯度 0 回退預設(U56/U58 紅)、拿掉 `border-box`(Z16 兩案紅,比值 0.972/0.960)、外高 3px(Z16 兩案紅)、拿掉 `Math.log10` 偏小之修正(僅 U61 紅;V8 之 `Math.log10` 於 10 的次方精確,故 U59 於本機走不到該分支)皆被偵測.

## R16 圖台移動狀態(根節點 `state` 屬性)單一擁有者:`moveState.mjs`

- **要求**(Gitea #30,下游 rddmanager 提出;只新增可偵測之狀態屬性,既有外觀、行為、動畫時間不變):
  1. 元件根節點提供唯讀屬性 `state`,值域僅 `'moving'`(`MOVE_STATE_MOVING`)與 `'idle'`(`MOVE_STATE_IDLE`),比照 w-component-vue WDrawer 之 `state` 語彙(進行式為過程、終態為落定;落定以事件為主、逾時為後備).
  2. **單一擁有者**:狀態只經 `src/js/moveState.mjs` 之 `createMoveState(map, onChange, opt)` 追蹤;元件僅 ①`initMap` 建立一次並於回呼寫 `data.state`、②根節點 `:state="state"`、③`beforeDestroy` 呼叫 `dispose()`.元件他處不得寫 `state`,不得自行以計時器判定移動結束.追蹤器為非響應式實例屬性 `moveState`(不宣告於 `data`).
  3. **轉換時點**:初值 `moving`(初次載入至首次 idle);`movestart` → `moving`(`panTo`/`centerTo`/`easeTo`/`flyTo`/`jumpTo`/`zoomTo`、縮放鈕、滾輪、拖曳、羅盤、`resize`);**靜止時**收到畫布容器之 `wheel` 事件 → `moving`(搶在 `movestart` 前,maplibre 滾輪起始延遲 40~80ms);`projectiontransition` → `moving`(投影真正遷移:`opt.projection` 變更、自動投影跨層級 8、使用端 `getMapObject().setProjection`);`idle` 事件 → `idle`(滾輪已到而 `movestart` 未至之 `idle` 不採計).
  4. **逾時後備**(事件未觸發、高負載、圖磚逾時未載完、繪製被暫停):每次進入/續留 moving 重設計時——`load`、`movestart`、`moveend`、`projectiontransition` 為 `MOVE_IDLE_WAIT_MS`(3000ms),靜止時之滾輪為 `MOVE_WHEEL_WAIT_MS`(600ms);到時 `map.isMoving()` 為真則續等一輪 3000ms,否則落定 `idle`.`idle` 事件與 `dispose()` 清除計時.
  5. **不改既有行為**:`wheel` 監聽為 `passive`、不 `preventDefault`;不新增 `$emit`、不改 `loading`、不改任何 opt 寫回(R12).
  6. **容器尺寸追蹤單一來源**(2026-11-05):容器尺寸改變只由 maplibre 內建 `trackResize`(`ResizeObserver`,回呼內即時 `resize()` 加 `redraw()`)處理,一次尺寸改變只發一組 `movestart`/`resize`/`moveend`;元件不得另行偵測尺寸並呼叫 `map.resize()`(不掛 `v-domresize`/`@domresize`,`createMap` 不設 `trackResize: false`).公開方法 `resize()` 保留(手動重算尺寸).**例外一處(devicePixelRatio 改變)**:瀏覽器縮放、跨不同像素比之螢幕而容器 CSS 尺寸不變(固定像素容器)時 `ResizeObserver` 不觸發、maplibre 6.14.0 亦無 `devicePixelRatio` 監聽(畫布解析度只在 `_resizeInternal` 重算),畫布會停在舊解析度而模糊(實測 1 → 1.25:畫布 800×500 像素,應為 1000×625;修前由 `v-domresize` 之視窗事件路徑「順帶」補上,移除後須自補);元件以視窗 `resize` 事件之處理器 `onWindowResize` 補一次 `map.resize()`,**只在 ①`devicePixelRatio` 與地圖上次 `resize` 時記下之值(`dprApplied`,於地圖 `resize` 事件更新)不同、②畫布 CSS 尺寸與容器相同(容器尺寸亦變者交 `trackResize`,其 `resize` 同樣以當下 `devicePixelRatio` 重算)時才呼叫**,故兩來源不重複.`state` 為 Vue 響應式屬性(微任務更新):`moving → idle` 於同一 JS task 內完成時(`ResizeObserver` 回呼內 `redraw()` 之 `_render` 末段即發 `idle`)被 Vue 合併,屬性不曾顯示 `moving`——此時地圖已靜止(`isMoving()` 為 false、`loaded()` 為 true),維持 `idle` 即為真,非缺陷,已寫入 README/JSDoc(使用端等 `idle`,不等 `moving` 出現).
- **why(6)**:修前元件另掛 `v-domresize`(w-component-vue,`wsemi` 之 `domDetect` 亦以 `ResizeObserver` 觀察,惟經 `setTimeout` 延後發出)→ `resize()` → `map.resize()`,同一次容器尺寸改變呼叫兩次 `map.resize()`:第一次在 maplibre 之 `ResizeObserver` 回呼內(實測點擊後約 +45ms),第二次由延後之計時器(探測 30 輪皆晚第一次約 19~23ms〔另有單輪 53ms〕;CPU 節流 6x 下第二次晚至點擊後約 +190~310ms),各發一組 `movestart`/`resize`/`moveend`(探測 30/30 輪皆兩組).第二組晚到而第一組之 `idle`(約 +100~150ms)已先發時,`state` 為 `moving → idle → moving → idle`(E2E-M6 之偶發紅;重現:CDP CPU 節流 6x 修前 3/10 輪,時序注入〔≤5ms 計時器延後 150ms〕修前 8/8 輪;第二組 `movestart` 之呼叫堆疊為 `VueComponent.resize ← createVnodeEmitter ← createDetectDirective(v-domresize)`).第二次呼叫時容器高度(400)與縮放層級(7)皆與第一次相同(探測已記錄者;中心與其他位姿未記錄),無尺寸變化,屬重複呼叫而非 maplibre 之合法行為,故修在來源(移除元件側重複來源),`moveState` 與斷言序列不動.
- **why**:建議書所述現況經真瀏覽器重現屬實(2026-10-31,證據見任務報告):①根節點屬性只有 `loading`(且 false 時被 Vue 移除),無移動狀態;②panTo 動畫 506ms 內中心逐影格變動(32 個相異位置)、moveend 後約 120ms 才 idle(圖磚載入),使用端只能輪詢數值;③滾輪 7 → 9 級:wheel 到 movestart 相隔 79ms,投影切換在 `zoomend` 處理器內、早於 `moveend` 與 `idle`.只依 `movestart` 設 moving 會在滾輪窗口與無相機移動之投影切換期間讀到舊 idle(e2e 之 flaky 成因),故加滾輪預標記與 `projectiontransition`.
- **盤點**(皆排除 `src/js/maplibreWorkerInline.mjs`):
  - `git grep -nE --untracked "createMoveState\(" -- src` → 定義 1 + 元件呼叫 1(`initMap`);
  - `git grep -nE --untracked "vo\.state\s*=[^=]" -- src/components/WMaplibreglVue.vue` → 2 處(`initMap` 重置初值、`createMoveState` 回呼);
  - `git grep -nE --untracked ":state=" -- src/components/WMaplibreglVue.vue` → 根節點 1 處;
  - `git grep -nE --untracked "moveState\.dispose" -- src` → `beforeDestroy` 1 處;
  - `git grep -nE --untracked "setTimeout|clearTimeout" -- src/js/moveState.mjs` → 僅預設計時器注入點 2 行;
  - (6)`git grep -nE --untracked "domresize|domResize" -- src ':!src/js/maplibreWorkerInline.mjs'` → 0;`git grep -nE --untracked "trackResize\s*:" -- src ':!src/js/maplibreWorkerInline.mjs'` → 0;`git grep -nE --untracked "(this|vo)\.map\.resize\(" -- src ':!src/js/maplibreWorkerInline.mjs'` → 2(公開方法 `resize()`、`onWindowResize`);`git grep -nE --untracked "(add|remove)EventListener\('resize'" -- src ':!src/js/maplibreWorkerInline.mjs'` → 2(`mounted` 註冊、`beforeDestroy` 移除).
- **站點全集(2026-10-31)**:建立點 1、寫入點 2(初值、回呼)、根節點綁定 1、dispose 1 → 皆已套.(6)尺寸追蹤來源 1(maplibre 內建 `trackResize`),`map.resize()` 呼叫點 2(公開方法、`devicePixelRatio` 補償)→ 已套(2026-11-05 移除 `v-domresize` 重複來源,並補回其「順帶」之像素比重算).
- **已知限制**:慢網路下圖磚超過 3000ms 未載完時,`state` 於相機停止 3000ms 後先轉 `idle`(後備之代價,已寫入 README/JSDoc);`state` 只反映相機移動與投影切換,不反映資料圖層增刪改(setData、底圖切換等造成之重繪/圖磚載入);滾輪於層級上限(不會移動)時 `moving` 維持 600ms;`dispose()` 後狀態凍結.
- **測試**:`test/unit-moveState.test.mjs` U33–U46 含 U42b(共 15 案;假 map + 假時鐘,窮舉轉換、逾時、重設計時、滾輪 pending、投影遷移、dispose、非法 opt);`test/e2e-movestate.test.mjs` E2E-M1(載入 moving → idle,`loading` 同步移除)、M2a–f(`panTo`/`centerTo`/`easeTo`/`flyTo`/`zoomTo`/`jumpTo`:變化序列恰 moving → idle、idle 當下 `isMoving()=false`/`loaded()=true`、idle 後 40 影格位姿不變)、M3(滾輪 7 → 9 跨 8 級:wheel 預標記、投影切換早於 idle)、M4(上限滾輪)、M5(`opt.projection` 切換,不經 movestart)、M6(resize;2026-11-05 起一次尺寸改變須只發 1 組 `movestart`/`resize`/`moveend`,畫布 500 → 400,並依「`movestart` 後是否已過微任務檢查點」決定確定之期望序列:已過 → 屬性序列恰 `moving → idle` 且 `idle` 事件當下屬性為 `moving`;未過〔`idle` 與 `movestart` 同一 task〕→ 屬性序列為空、`idle` 當下靜止、其後位姿與屬性不變;其他序列一律紅)、M6b(同 M6,其後建立之 ≤5ms 計時器延後 150ms,模擬計時器晚於繪製之確定性時序注入)、M6c(同 M6,CDP CPU 節流 6x,兩種時序皆可能出現,皆須符合期望;另於 `movestart`/`moveend`/`idle` 事件處理後讀元件 `data.state`〔追蹤器同步寫入,不受 Vue 批次合併影響〕須依序為 `moving`/`moving`/`idle`,使追蹤器錯誤在兩種時序下皆被抓到)、M6d(CDP `Emulation.setDeviceMetricsOverride` 模擬瀏覽器縮放 125%:固定 800×500 px 容器之 CSS 尺寸不變,畫布須由 800×500 重算為 1000×625 像素,且只發一組事件、序列符合期望;`devicePixelRatio` 不變之視窗再 resize 不得再呼叫 `map.resize()`)、M7(吞掉 `idle` 事件 → 逾時 3000ms 後落定,逾時前不得落定)、M8(CPU 節流 6x)、M9(移動中再觸發)、M10(真滑鼠拖曳)、M11(縮放鈕)、M12a(`opt.center` 賦值〔changeOpt → panTo〕)、M12b(`opt.zoom` 賦值 7 → 22 跨 8 級)、M13(使用端經 `getMapObject().setProjection`,不經 movestart)、M14(5 秒長動畫長於逾時常數:逾時當下仍在移動不得落定);範例頁 `src/AppBSCMoveState.vue`(basic > moveState).
- **變異檢驗**:見任務報告〈變異〉(`tmp/map30/mutate.mjs` 逐一破壞 `moveState.mjs` 單一機制後跑 unit + e2e-movestate,結束必還原並以雜湊回驗).
- **變異(6,2026-11-05,手動單項變異後跑 `e2e-movestate` `--grep E2E-M6`〔M6/M6b/M6c/M6d 共 4 案〕,結束以 `git hash-object` 對備份回驗)**:A 重加 `v-domresize`+`@domresize="resize"`+import+`directives` → 4/4 紅(M6/M6b/M6c:`resize` 事件數 2 ≠ 1;M6d:`devicePixelRatio` 無變化之視窗 resize 仍多呼叫 `map.resize()`,累計 2);B `createMap` 加 `trackResize: false`(無 `ResizeObserver` 追蹤)→ M6/M6b/M6c 紅(20s 內無 `moveend` 後之 `idle`;`e2e-zoomrange` E2E-Z13 亦紅),M6d 綠(像素比路徑不經 `trackResize`,預期);C `moveState.onMoveStart` 不設 `moving` → 4/4 紅(`data.state` 於 `movestart` 處理後為 `idle`;此項於同 task 時序下亦確定紅——初版僅靠 DOM 序列時,M6c 走同 task 時序會誤綠,審查指出後補 `data.state` 逐事件斷言);D `onMoveEnd` 於 `moveend` 即轉 `idle`(早於 `idle` 事件)→ 4/4 紅;E 移除 `mounted` 之視窗 `resize` 監聽 → M6d 紅(畫布未重算,20s 內無事件);G 移除地圖 `resize` 事件對 `dprApplied` 之更新 → M6d 紅(`devicePixelRatio` 不變之視窗 resize 多呼叫一次 `map.resize()`).未被變異覆蓋者:`onWindowResize` 之「容器尺寸亦改變則不呼叫」守衛(百分比容器 + 瀏覽器縮放同時發生,測試頁容器為固定像素,無法確定性重現;守衛失效之後果為瀏覽器縮放時多一組事件〔視窗 `resize` 事件先於 `ResizeObserver`,兩者間可能夾一次繪製與 `idle`,使 `state` 閃爍一次〕,僅限容器為百分比尺寸者;未實測)。

## R17 file:// 與不透明來源之頁面須可載入 worker(Gitea #46)

- **要求**(使用端 cgsmdb 提出:umd 產頁以檔案總管雙擊開啟〔file://〕時只剩底圖,點位與面板皆不顯示,console 有 `Worker failed to load`;1.0.5 正常為回歸):
  1. **兩條路徑,單一擁有者 `mapCore.ensureWorkerUrl()`**:`needClassicWorker(urlBlob, loc)` 為真——`loc.protocol === 'file:'`,或內嵌原始碼 Blob URL 之來源為不透明(`new URL(urlBlob).origin === 'null'`,sandbox iframe〔src 與 srcdoc〕)——時,釋放該 Blob URL 並以 `buildClassicWorkerUrl(workerSource, classicLength)`(`data:text/javascript;charset=utf-8,` + `encodeURIComponent(前段 + '\n//.cjs')`)供 `setWorkerUrl`;其餘環境(http(s)、webpack、vite、下游 bundler)維持 module Blob,行為不變(R3 之唯一 `setWorkerUrl` 呼叫點不變).
  2. **classic 前段之切分規則只在 `toolg/gDistRollupWorkerFuncs.mjs` 之 `findClassicLength(code)` 一處**:找末尾 `export { X as default };` 之位置,前段以 `vm.Script` 解析(不執行)驗證為合法 classic 腳本,不合法(殘留 import/export、`import.meta`、頂層 await、語法錯誤)即拋錯中止產製;結果寫入 `src/js/maplibreWorkerInline.mjs` 之 `export const classicLength`.`mapCore.mjs` 與測試只讀 `classicLength`,不重算切點.
  3. **判斷條件不得改為**:`location.origin === 'null'`(sandbox iframe 以 src 載入時 `location.origin` 仍為該 URL 之來源)、maplibre 之準則「Blob URL 來源與 `location.origin` 不同」(srcdoc 兩者皆 `'null'`),或 `protocol === 'file:'` 單獨(漏 sandbox iframe);三者皆有實測反例(見 `sgud/exp/experience.md`).`protocol === 'file:'` 條款在 Chromium 上與 Blob 來源條款重疊,保留為對 Firefox/Safari(未測)之保守條款.
  4. **依賴之 maplibre 內部判斷**(第三方實作細節,非公開 API):`isClassicWorkerUrl`(去掉 `?#` 後以 `.cjs` 結尾才走 classic)、`isCrossOrigin`、`workerFactory`(跨來源且 classic → `fetch` 後建 classic Blob;同來源 → 直接 `new Worker(url)`).於 `mapCore.mjs` 註解寫明,由 unit U52/U53 與 e2e F1/F3/F4 釘住——maplibre-gl 升版若改了,測試即紅,須重新評估 data: URL 作法.
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
- **變異證明(2026-11-02,`tmp/mlfile/mutate.mjs`,逐一破壞後跑 `unit-workerClassic`〔+ `e2e-fileprotocol`〕,結束必還原並比對內容;紅燈案例實測)**:M1 `ensureWorkerUrl` 新分支改回原碼 → F1、F3、F4 紅(F2 綠);M2 去掉 Blob 來源不透明條款 → U49、F3、F4 紅(F1 綠);M3 去掉 `file:` 條款 → 僅 U49 紅(Chromium 上與 Blob 來源條款重疊,e2e 不可鑑別,見上〈要求〉3);M4 不編碼 → U50、U51 紅;M5 不加 `//.cjs` → U50、U51、F1、F3、F4 紅;M6 切分規則回傳切點加 5 → U47、U48、U50 紅;M7 略過 `vm.Script` 驗證 → U48 紅;M8 去掉 export 末尾錨點 → U48 紅;M9 `classicLength` 過期(少 1)→ U47 紅;M10 `classicLength` 含末尾 export → U47、F1、F3、F4 紅.maplibre 檢查式本身之鑑別力由 U53 的 7 種單點改動確認.

### R12 實作後站點表(2026-10-16;行號為 `WMaplibreglVue.vue`)

元件改寫 `opt` 之站點(`Grep "vo\.opt\.[a-zA-Z]+ *=[^=]"`)與判準:

| 站點 | 欄位 | 判準 |
|---|---|---|
| `:881` `initMap` 建圖後 | zoom | R12-7:`opt.zoom`(未給/非數值為預設 6)與地圖實際層級差 >1e-9 才回寫;一致者不寫、不新增鍵 → 已套(Z14、Z14c) |
| `:900` `zoomend` | zoom | `holdWriteBack` 期間不寫(R12-2)→ 已套 |
| `:908` `moveend` | center | `holdWriteBack` 期間整個 handler 略過;`isEqual` 守門 → 已套 |
| `:939` `syncZoomFromMap` | zoom | R12-6:僅差 >1e-9 才寫;由 `zoomend`、`moveend`、`projectiontransition` 呼叫 → 已套(Z12、Z12b、Z13) |
| `:951` `syncCenterFromMap` | center | R12-6:僅差 >1e-9 且地圖不在移動中才寫;由 `projectiontransition` 呼叫 → 已套(Z12、Z12b) |
| `:1121` `changeOpt` 呼叫地圖後 | zoom | R12-3:以地圖實際層級回寫,`isnum` 守門不對非數值強制轉型 → 已套(Z5、Z7、Z14) |
| `syncBaseMapsToOpt` | 底圖 visible/opacity | `$set`、`isEqual` 守門;與 zoom/center 無耦合 → 不適用 R12-1~7 |

元件對地圖之相機呼叫(`git grep -nE "map\.(setZoom|jumpTo|panTo|easeTo|flyTo|zoomTo|zoomIn|zoomOut)\(" -- src`):`changeOpt` 內 `jumpTo`(同 tick:`:1098`;`panTarget`:`:1103`)、`setZoom`(`:1106`)、`panTo`(`:1111`,於其後設 `panTarget`)= R12 管轄;`zoomIn/zoomOut`(縮放鈕,`:1047`、`:1050`)、`easeTo({pitch,bearing})`(羅盤,`:1220`)、公開 `panTo` 方法(`:1914`)、`layerRenderers.mjs:723` 叢集展開 `easeTo`、`publicApi.mjs` 之 `getMapObject` 代理 `panTo` = 使用者/使用端觸發,結果走 `zoomend/moveend` 寫回(L7).

## R18 疊加層透明度預覽 `previewOverlayOpacity`:只改地圖繪製,不回寫(Gitea #76)

- **要求**(使用端自帶圖層列表與滑桿,拖曳中地圖要即時跟著變、放開時才提交;使用端原本引用內部模組與元件私有欄位繞道):
  1. **公開方法與單一擁有者**:元件方法 `previewOverlayOpacity(name, val)` 為薄委派(`!this.map || !this.mapLoaded` 回 `false`),邏輯只在 `basemapManager.previewOverlayOpacity(map, baseMaps, name, val)`;使用端不得再引用 `basemapManager.mjs` 或 `panelBaseMaps`、`map` 私有欄位.
  2. **輕量**:一次預覽對地圖只呼叫 `getLayer` 與 `setPaintProperty` 各一次;**不寫** `baseMaps`(元件內部值)與 `opt`,不取 `getStyle`、不改 layout、不 `cloneDeep`、不 `baseMapsDataTemp`、不 `syncBaseMapsToOpt`、不 `$forceUpdate`,故不觸發 `opt` deep watcher(`changeOpt`).
  3. **預覽是暫態,不改內部值**:預覽值不進 `baseMaps`,故底圖三條重套路徑(P1 `updateBaseMapPaint`、P2 `updateBaseMapsIncremental`、P3 `applyBaseMaps`)皆自 `getBaseMapOpacity(bm)` 設值,**未提交之預覽於重套時回到已提交值**;提交由使用端呼叫 `setOverlayOpacity(idx, val)` 或更新 `opt.panelBaseMaps.baseMaps[i].opacity`(走 P1).提案草案重用 `_setOverlayOpacity` 會改 `bm.opacity`:查證其後果(`tmp/wm76b/probe-draft.mjs` 以頁內暫代模擬該語意,非實跑草案碼;結果 `wm76-evidence/probe-draft.json`)——預覽期間內部值(0.3)≠ `opt`(未給),面板於下一次偶發重繪即顯示預覽值 `30%`(A1;違反「不重繪面板」);下一次無關之 `opt` 變更使 `changeOpt` 以 opt 為準把內部值覆蓋回已提交值,面板回 `80%`,而 `baseMapsDataTemp` 未同步 → 不重繪,地圖仍停在 0.3(A2:地圖與面板不一致).不改內部值時面板自始至終為已提交值 `80%`(B1、B2),且已滿足「放開時由 `setOverlayOpacity` 提交」「面板顯示已提交值」「重套圖層回已提交值」,故不改.另(讀碼推論,未實測):`opt` 未給 `baseMaps`(沿用執行期狀態)時,草案改的內部值會在下一次無關 `changeOpt` 被 `baseMapsChanged` 判為變更而 P1 套用,使未提交之預覽被靜默提交.
  4. **回傳 `true`/`false`,一律不拋錯、`false` 時不改繪製**:`map` 缺;`baseMaps` 非陣列(或含 `null`/`undefined` 元素);`name` 非非空字串;`val` 非有效數字(wsemi `isenum`:數字或十進位數字字串,去頭尾空白;不收 `NaN`、`±Infinity`、`'0x10'`、`'1e400'`、`''`、`'-'`、`null`、布林、陣列、包裝物件、BigInt、Symbol)或超出 0~1;名稱查無;**名稱對到多個條目**(同名疊加層、疊加層與底圖同名、內容完全相同之兩條目)——收嚴不擇一(process_principle 〇之一 原則 3);名稱對到底圖(`isestr(colorShade)`);`type:'style'`;圖層尚未加入(含 `url` 無效被 `applyBaseMaps` 略過者);地圖方法拋錯(style 未就緒).`colorShade` 未給者視為疊加層(與 `applyBaseMaps` 第二輪一致).
  5. **值域不夾限**:`val` 為「必須參數」,超出 0~1 回 `false`;與 R14 之 `bm.opacity`(opt 鍵,夾限)不同——依 dspec〈輸入參數之檢測機制〉K3(opt 鍵非預期改用預設/夾限;必須參數之非預期值〔含超出範圍〕為無效).檢測之值即使用之值:`isenum(val)` 後只用 `Number(val)`(K4),字串不直接交給 maplibre.
  6. **paint 屬性**:raster/wms → `raster-opacity`;vector 依 `layerType`:`fill-extrusion` → `fill-extrusion-opacity`、`line` → `line-opacity`、其餘(含未給)→ `fill-opacity`(與 `setOverlayOpacity`、`updateBaseMapPaint` 一致).
- **why**:`setOverlayOpacity` 回寫 `opt` 觸發 deep watcher → `changeOpt` 全流程,耗時隨 `opt` 大小、圖層數增長(實測見下),不適合逐幀呼叫.
- **效能實測(2026-11-04 wm76b,`tmp/wm76/measure.mjs`,headless Chromium;批次 100 次取平均、5 組取中位數;證據 `wm76-evidence/`)**:

| 情境 | `setOverlayOpacity` 同步段 | `setOverlayOpacity` 含 Vue 沖刷(nextTick) | 原生 `setPaintProperty` | `previewOverlayOpacity`(含沖刷) | 每 500 次 `changeOpt` 次數(`setOverlayOpacity`/預覽) |
| --- | --- | --- | --- | --- | --- |
| 範例頁原樣(11 層) | 0.061 ms | 0.85 ms(修後再量 0.66 ms) | 0.002 ms | 0.020 ms | 500 / 0 |
| 加大(71 層 + `opt` 內 2 萬筆無關資料) | 0.24 ms | 36.5 ms(修後再量 38.4 ms) | 0.003 ms | 0.062 ms | 500 / 0 |

  結論:差距屬實且隨 `opt` 與圖層數增長;提案引用之「70 ms/次」為其應用情境,範例頁原樣僅 0.85 ms,加大情境 37 ms 同量級.
- **已知限制**:①預覽為暫態:未提交且沒有重套時,地圖停留在預覽值(`opt` 變更但 `baseMaps` 無差異者,如地圖移動寫回 `center`,不重套 paint),使用端應以提交收尾;②預覽不論圖層可見與否皆設 paint,之後切為可見時顯示最後一次預覽值;③`type:'style'` 不支援(同 `setOverlayOpacity`);④同名一律 `false`(使用端應確保疊加層名稱唯一,或改用 `setOverlayOpacity` 以索引定位);⑤`setOverlayOpacity` 維持原行為(索引定位、不檢值域、回寫 opt),不納入本規則;⑥`basemapManager.mjs` 內 opacity→paint 屬性之對照另見 `setOverlayOpacity`、`updateBaseMapPaint`、`applyBaseMaps` 各一份(本函式為第四份,未收斂:依指示不動既有函式).
- **盤點**:`git grep -nE --untracked "previewOverlayOpacity" -- src` → `basemapManager.mjs`(定義 1)、`WMaplibreglVue.vue`(import 1、方法 1、檔頭說明 1);`git grep -nE --untracked "setPaintProperty\(id, prop" -- src` → 僅 `previewOverlayOpacity` 內 1 處.
- **測試**:`test/unit-previewOpacity.test.mjs` U62–U72(11 案:各型別 paint 屬性、輕量〔呼叫序列〕、值域與數字字串、無效值〔33 種加未給〕、名稱、同名、底圖與 style、地圖/圖層狀態、重複呼叫、預覽後提交、預覽後重套);`test/e2e-opacity.test.mjs` E2E-O5(實繪改變、`syncBaseMapsToOpt`/`$forceUpdate`/`changeOpt`/`applyBaseMaps` 皆 0 次、`opt` 與內部 `baseMaps` 序列化不變、面板仍為已提交值、無效輸入回 `false`)、O6(預覽後經 `setOverlayOpacity` 或 `opt` 提交)、O7(預覽後不提交,經 paint-only、增量、完整重建三路徑皆回已提交值)、O8(第二個元件實例:未載入回 `false`、底圖與同名回 `false`、一般疊加層逐幀預覽).
- **變異證明(2026-11-04,`tmp/wm76b/mutate.mjs`,逐一破壞後跑 `unit-previewOpacity`〔元件層跑 `e2e-opacity` O5–O8〕,結束必還原並以雜湊回驗)**:M1a `isenum`→`isnum`、M1b 移除有效數字檢測、M2 超界改夾限(提案原寫法)、M3 用原字串、M4 同名取最後一個、M5a 不擋底圖、M5b 不擋 style、M6 不查圖層存在、M7 catch 改外拋、M8 回寫 `bm.opacity`(提案草案語意)、M9a/b/c 錯誤 paint 屬性、M10 名稱比對放寬、M11 多取 style、M12 圖層 id 用錯索引、M13 不檢 `name`、M14 不檢 `baseMaps` 為陣列 → 皆被偵測(紅燈案例見證據);M15(略過非物件元素之守門)存活——等價變異:`null`/`undefined` 元素於 `baseMapKeys` 同樣使函式回 `false`,結果相同,保留為防禦性寫法.元件層變異見證據 `wm76-evidence/mutate-e2e.json`.

## R19 e2e 埠:基準埠單一定義、被占用時整組位移、不沿用也不下殺非本實例(排程第 309 項,2026-11-05 wm309;規格 `C:/opensrcOper/dspec/e2e埠與多套件同跑.md` E1～E8)

- **要求**:
  1. **基準埠只在 `test/tools/e2ePorts.mjs` 定義**(`FRONTEND_PORT = 8123`),該模組載入時呼叫一次 `reserveE2ePorts([FRONTEND_PORT], { avoid: OTHER_TEST_PORTS })`;其餘處一律經 `resolveE2ePort(FRONTEND_PORT)`(`e2e-setup.mjs` 之 `PORT`、`baseUrl`)取實際埠,基準埠字面只可出現在 `e2ePorts.mjs`.沒有占用時即 8123、`E2E_PORT_OFFSET` 維持未設、指令列 `vue-cli-service serve --port 8123` 與導入前相同.
  2. **`OTHER_TEST_PORTS` 列本套件其他測試寫死之埠**(現為 `[8195]`:`e2e-fileprotocol` 之虛擬 http 來源,`context.route` 供應、不開 port、不連外;`unit-workerClassic` 之 8080、8195 只是純函式輸入字串,不連線).新增寫死埠忘了列即紅(PR-010).本套件無 api-／unit- 測試開真實監聽埠(PR-010 掃描 `.listen(<字面埠>`),故無規格 E8 之撞埠待處理.
  3. **`startServer` 不沿用占用者**:以 TCP 連線檢查(不送 HTTP 請求)偵測埠上是否有人監聽;有人監聽時,自動換埠(`reservation.source === 'auto'`)下必為保留後被他人占走(E5),拋錯寫明占用者(PID 與命令列)、不沿用、不下殺;手動鎖埠(`E2E_PORT_OFFSET` 已設,含 0＝沿用本機常駐 dev server 之逃生口)下,須 `judgeOwnDevServer` 確認監聽者**全部**為本專案之 `vue-cli-service`(命令列同時含「專案根絕對路徑＋分隔字元」與 `vue-cli-service`)才沿用,其餘一律拒絕.查不到監聽表或命令列、無人監聽皆視為不是(預設拒絕;查詢失敗與無人要分開).導入前為「埠通即沿用,不問身分」,被占用時會打到別人的服務.
  4. **spawn 後確認埠上的監聽者確為本專案之 `vue-cli-service`**(`vue-cli-service` 之 portfinder 在埠被占走時會靜默改用別的埠,而測試連的仍是原埠);不是則拋錯並收掉自己 spawn 的行程(`stopServer`),`started` 維持 false.就緒後 `reservation.noteOwn(serverProc)` 記下本實例之服務行程,供下次開跑依身分清除殘留(`taskkill /F` 後殘留之 dev server)。
  5. **下殺只動自己 spawn 的行程**:`test/` 內下殺站點全集固定為三處(`e2e-setup.mjs` `stopServer` 之同步 `taskkill /F /T /PID <serverProc.pid>` 與 POSIX `process.kill(-pid, 'SIGKILL')`、`toolgCopy.mjs` 之 `p.kill()`),無依埠、依名稱、依命令列下殺(PR-009;新增下殺站點即紅).`stopServer` 見自建行程已結束(`exitCode`／`signalCode` 非 null)即不下殺(其 PID 可能已被作業系統回收給無關行程;PR-012c);下殺為同步(exit／SIGINT／SIGTERM 備援路徑內之非同步 spawn 不會被等待;PR-013).身分確認(`devServerIdentity.mjs`)只用於「是否沿用」,不用於下殺.套件 `reserveE2ePorts` 另有「殘留預約回收」:持有者已死且專案根相同時,只依預約檔記錄之身分(PID＋起始時間＋映像)與行程鏈下殺本專案之殘留 dev server(`noteOwn` 登錄者),未登錄者不殺.
  6. **畫面含埠之流程**:本套件無(無跨 run 標準圖;e2e 無 `location`／`href`／`origin` 斷言,截圖只作色彩比例取樣),規格 E7 不適用.日後新增含埠之流程依套件 README §2.12:`runBaselineCase` 之 `compareBuf` 以 `overlayRegions` 覆蓋,或 `reserveE2ePorts(..., { baseOnly: true })`.
  7. **範例頁 `src/AppBSCRuntimeSync.vue:54`、`src/AppPBMOpacity.vue:28` 之 `http://127.0.0.1:8123/nope/{z}/{x}/{y}.pbf`** 是 TileJSON 內的圖磚網址字串,`bounds` 指向視野外極小區域,視圖內零圖磚請求,實際不會連線(2026-11-05 以真實占用者占 8123、dev server 位移至 8223 跑 `e2e-opacity`／`e2e-runtime`,占用者被打到 0 次);屬套件範例頁(產品側),本輪不改.
- **why**:多套件同機同跑時基準埠可能被別的套件占用;原寫法「埠通即沿用」使本套件 e2e 打到別人的服務(修前實測:占用 8123 跑 `e2e-displayorder` 0 passing／2 failing,占用者被打到 3 次),且全綠無法證明沒打到別人.
- **盤點指令**:`git grep -nE --untracked "killPortListeners|taskkill|Stop-Process|process\.kill|\.kill\(|wmic|netstat" -- test`(下殺站點全集);`git grep -nE --untracked "localhost:|127\.0\.0\.1:" -- test`(寫死網址與埠;`unit-*` 為字串資料);`git grep -nE --untracked "\b8123\b" -- test src`(基準埠字面:`test/` 只在 `e2ePorts.mjs`;`src/` 為上條 7 之兩處).
- **測試**:`test/unit-e2ePortReserve.test.mjs` PR-001～PR-013(15 案;真實子行程、真實監聽、真實命令列;期望由當下環境動態算出,不用 `skip`):PR-001～003 自動換埠(沒有占用／占用／兩行程不同組)、PR-004 保留後被搶走(E5)、PR-005 手動鎖埠遇非本專案占用者拒絕、PR-006 手動鎖埠遇本專案 `vue-cli-service` 沿用、PR-007／008 身分確認(真實命令列含非 ASCII 路徑往返、注入各形狀)、PR-009 下殺站點全集、PR-010 寫死網址與埠及 `OTHER_TEST_PORTS` 一致(含 `src/` 內基準埠字面只可為已審查之兩處)、PR-011 接線、PR-012a／b／c spawn 後身分確認、`noteOwn`、已結束之自建行程不下殺(以置於 PATH 最前之假 `taskkill` 記錄呼叫,含對照組)、PR-013 `process.exit` 路徑同步收掉自己 spawn 之行程樹.注入縫:`startServer(opts)` 之 `spawnFn`／`verifyMs`(僅單元測試用).PR-001 的「沒有占用即 8123、環境變數未設」只在 8123 當下空閒時被驗到(單檔跑);全套同一 mocha 行程內 e2e 之 dev server 占著 8123 時只驗到「位移」.
- **變異證明(2026-11-05,`tmp/wm309/mutate.mjs`,逐一破壞後跑 `unit-e2ePortReserve`,結束必還原並以雜湊回驗)**:M1 不呼叫 `reserveE2ePorts`、M2 埠通即沿用(導入前行為)、M3 手動鎖埠不驗身分、M4 自動換埠下不拋 E5 錯、M5 spawn 後不驗身分、M6 身分判準不看專案根、M7 不看 vue-cli-service、M8 根路徑不接分隔字元、M9 查不到視為本實例、M10 無人監聽視為本實例、M11 `OTHER_TEST_PORTS` 漏列、M12 `avoid` 未交給 reserve、M13 `PORT` 寫死基準埠、M14 不 `noteOwn`、M15 存在性探測改送 HTTP、M16 新增依埠下殺站點、M17 失敗時不收自己 spawn 之行程、M18 `--port` 寫死 8123、M19 已結束之自建行程仍下殺、M20 vue-cli-service 比對放寬為任一處出現、M21 基準埠字面被改 → 皆被偵測(逐項紅燈案例見證據 `wm309-evidence/mutation-result*.json`);M22 同步下殺改回非同步另見證據.
- **跑法**:`node C:/opensrcOper/tools/quiet-run.mjs --name e2ePortReserve --lock -- npx mocha test/unit-e2ePortReserve.test.mjs --timeout 180000`.
- **已知限制**:①身分確認以 PowerShell(`Get-CimInstance Win32_Process`)取命令列(Windows;POSIX 走 `ps`,未實測);機器負載高時 `listenerPids`／PowerShell 偶逾時回 `null`,`describeListeners` 重試 3 次,仍失敗則預設拒絕(重跑即可).②exit／SIGINT／SIGTERM 備援已改為同步下殺(PR-013),但 `taskkill /F` 硬殺 mocha 本身時備援不執行(由下次開跑之「殘留預約回收」依 `noteOwn` 登錄之身分處理).③同機另有未導入、於保留後才綁定同埠者,由 `startServer` 大聲報錯,不自動處理(套件 README §2.12〈限制〉).

## e2e 映射(本套件之落地與偏離)

| 項目 | 本套件 | 偏離與依據 |
|---|---|---|
| runner | mocha `npm test`,逐檔同一程序 | — |
| 服務 | `test/tools/e2e-setup.mjs`:`vue-cli-service serve --port <實際埠>`(基準埠 8123 空閒即 8123,指令列同導入前;被占用則整組位移,實際埠印入輸出 `[e2e-port]`);**埠上已有人監聽不沿用**:自動換埠下(保留後被占走)拋錯寫明占用者,手動鎖埠(`E2E_PORT_OFFSET` 已設)下須確認監聽者確為本專案之 `vue-cli-service` 才沿用(R19;導入前為「port 被佔則 reuse」,不問身分,會打到別人的服務) | 無共用埠位移以外之偏離;本套件只有前端 dev server 一個埠,無後端、redirect、CORS、種子之衍生埠 |
| 啟動 | `w-package-tools-e2e/src/launchChromium.mjs`,每 `it()` 新瀏覽器 | — |
| 語系 | 無 i18n,單一變體 | — |
| 標準圖 | **無跨 run 標準圖**;以當次 in-memory 區域取樣(前後比對或色彩比例)與 style 快照為斷言 | 本套件為元件庫、無操作手冊用圖;地圖畫面為 WebGL 畫布,圖磚以 data URI 或頁內自訂協定供應而離線決定性,語意(顏色出現/消失、請求計數)即可判定;既有三檔沿用此政策 |
| 圖磚來源 | data URI(runtimeSync)或頁內 `maplibregl.addProtocol('e2ezlim', …)`(baseMap.maxzoom 頁),永不連外 | — |
| 移動狀態觀察(R16) | 範例頁 `src/AppBSCMoveState.vue`(basic > moveState):離線圖磚協定 `e2ems://`;`window.__getMap()`(公開 API `getMapObject()`)、`window.__getRoot()`(元件根節點)、`window.__stateLog`(頁內 `MutationObserver` 記錄根節點 `state` 每次變化,含 `performance.now()`、`loading` 屬性、`map.loaded()`、`map.isMoving()`);測試端另掛 maplibre 事件(`movestart`/`moveend`/`idle`/`projectiontransition`/`zoomend`)、capture 階段 `wheel`、逐影格位姿(`requestAnimationFrame`)皆為只讀觀察 | 以頁內記錄對時(同一 `performance.now()` 時鐘)取代固定等待;唯二用時間量者:M7(吞 `idle` 事件後逾時下限 = 逾時常數)與 M8(CPU 節流,上限防懸置)。resize 案(M6/M6b/M6c)以事件同步(等 `moveend` 後之 `idle` 事件再累計 40 影格)並以頁內微任務標記(`queueMicrotask`)判定 `movestart` 與 `idle` 是否同一 JS task(Vue 之 `nextTick` 排在該微任務之前,故標記已過即表示 DOM 已更新過);M6b 之 `setTimeout`(≤5ms 者延後 150ms)與 M6c 之 CDP CPU 節流為時序注入,非同步手段(M6b 控制「計時器晚於繪製」之時序、修前確定性紅;M6c 提高同 task 時序出現率〔修後 25 輪中 7 輪〕以經常走到該分支之斷言)。逾時後備之驗證須覆寫 `map.fire` 吞 `idle`(經 `getMapObject()` Proxy 設定實例屬性,事後 `delete`) |
| file:// 與 sandbox iframe(R17,2026-11-02 新增) | `test/e2e-fileprotocol.test.mjs`:`before` 依 dspec〈自有套件之發布與建置腳本〉規則 4,把 `src`、`toolg/gDistRollupComps.mjs`、`package.json` 複製到 `test/_tmp/e2e-fileprotocol/` 後以該夾為 cwd 執行 `node toolg/gDistRollupComps.mjs`(輔助 `test/tools/toolgCopy.mjs`;建置選項只在 toolg 腳本內,測試不另寫;`after` 刪除),測試頁 `test/fixtures/fileProtocol.html` 以相對路徑載入本機 vue 與該 umd;file:// 為真實路徑,http 與 sandbox 外層頁由 `context.route` 於虛擬來源 `http://127.0.0.1:8195` 供應(不開 port、不連外);`ctx.addInitScript` 以 `Proxy` 記錄 `new Worker(url, options)`;點位以畫面像素取樣佐證 | 不起 dev server(與其餘 e2e 不同):須測 umd 產物而非 dev bundle;不讀 `./dist` 以免靜默測到過期產物;建置約 25 秒,故該檔單跑約 30 秒.(2026-11-02 依 dspec 撤:原於測試內以 `rollupFiles` 另寫「與發布同設定」之建置選項〔`bSourcemap:false` 等〕,改為執行 toolg 腳本本身) |
| 改動範圍 → e2e 檔(2026-10-31 建) | ①`src/js/moveState.mjs`、元件 `state` 綁定/`initMap` 事件註冊/`applyProjection` → `unit-moveState` + `e2e-movestate`,並因動到元件事件註冊與根節點而加跑 `e2e-runtime`(含縮放按鈕、比例尺);容器尺寸追蹤(元件根節點之指令/`resize()`、`mapCore.createMap` 之 `trackResize`)→ `e2e-movestate`(M6/M6b/M6c)+ `e2e-zoomrange`(E2E-Z13,容器 resize 後 opt.zoom 與地圖一致)+ `e2e-runtime`(R16-6);②`src/js/basemapManager.mjs`、`defBaseMaps.mjs` → `unit-basemapManager` + `unit-previewOpacity`(R18) + `e2e-basemapzoom` + `e2e-opacity`;元件 `previewOverlayOpacity`/`setOverlayOpacity`/`syncBaseMapsToOpt` → `unit-previewOpacity` + `e2e-opacity`(R18);③`src/js/configProcessor.mjs`(縮放範圍/center 正規化)、`mapCore.mjs`、元件 `changeOpt` 寫回 → `unit-zoomRange` + `e2e-zoomrange`;④`layerRenderers.mjs`、圖層順序/hover → `e2e-displayorder` + `e2e-hover`;⑤測試輔助(`test/tools/e2e-setup.mjs`、`e2ePorts.mjs`、`devServerIdentity.mjs`)、`vue.config.js`、`package.json` 之 maplibre-gl 版號、元件 template 版面 → 全套 `npm test`(埠與身分確認相關另有 `unit-e2ePortReserve`,R19);⑥`src/js/mapCore.mjs` 之 `ensureWorkerUrl`/`needClassicWorker`/`buildClassicWorkerUrl`、`src/js/maplibreWorkerInline.mjs`、`toolg/gDistRollupWorkerFuncs.mjs`、`toolg/gDistRollupComps.mjs`、`test/tools/toolgCopy.mjs`、maplibre-gl 升版(worker 載入路徑) → `unit-workerClassic` + `unit-workerBuild` + `e2e-fileprotocol`(R1/R17;維持 http 路徑不變另加跑 `e2e-runtime`);⑦`src/js/scaleBar.mjs`、元件比例尺之 template(`.clsScale`)與 computed `scaleBar`、`panelScale` 相關 → `unit-scaleBar` + `e2e-zoomrange`(Z16/Z16b/Z16c)+ `e2e-runtime`(E2E-005)(R15;`.clsScale` 只有此二 e2e 檔引用,`grep -ln clsScale test/*.mjs` 查得) | 帳本新建,範圍依本表擴大;凍結碼上之最末全套由主控跑 |
| 以視窗座標定位之 e2e(2026-10-31 map30c 新增判準) | 凡以 `cbb.y + 換算值` 等視窗座標做 `mouse.move`/`mouse.click`/截圖 clip 者:①**視窗高須含範例頁版面變動之餘裕**(範例頁選單換行會使 canvas 下移 33px/行);②**`gotoExample` 取得 canvas `boundingBox` 後須斷言最低目標(與 `hoverAt` 同一換算)落在視窗內**,否則立即以「目標落在視窗外:範例頁版面改變」失敗,不得淪為 15 秒 cursor/tooltip 逾時;③新增更低之目標須同步更新該斷言所用之最低目標常數.盤點:`grep -n "viewport: {" test/*.test.mjs`.站點全集(2026-10-31):`e2e-hover` 1000×1100(已套②,`LOWEST_TARGET_LAT`);`e2e-zoomrange` 1000×1100、`e2e-movestate` 1000×1100、`e2e-opacity` 1000×1000(map30b 判餘裕充足,未逐一量測最低目標;刻意不套②);`e2e-runtime`、`e2e-displayorder`、`e2e-basemapzoom` 1000×760(目標貼近 canvas 中心,最低目標估算 y ≤ 629、餘裕 ≥ 130px,刻意不套②,選配統一) | 根因查證見 map30b 報告:`e2e-hover` 於 1000×760 視窗下排目標(緯度 23.92)在 HEAD 僅距視窗底 17px,map30 於 `App.vue` 之 `basic` 子選單加 `'moveState'` 使選單換行、canvas 頂 366→399,目標 y 743→776 出界,8 案紅;修法為視窗高 760→1100 + 前置斷言(不動範例頁選單) |
| 範例頁 | `src/AppBSCRuntimeSync.vue`(basic > runtimeSync)、`src/AppPBMMaxzoom.vue`(panelBaseMaps > baseMap.maxzoom)、`src/AppBSCZoomRange.vue`(basic > zoomRange,R11–R13/R15)、`src/AppPBMOpacity.vue`(panelBaseMaps > baseMap.opacity,R14) | zoomRange 頁圖磚為頁內 `e2ezr://` 協定供應之單色圖磚(無 `{z}` 區分,各層級同圖;離線),觀測量(`#optZoom` 等)由父層 opt 即時值顯示;`window.__getMap()` 只取公開 API `getMapObject()`(Proxy,不改 map);`window.__calls` 為頁面對 `Map.prototype.setZoom/jumpTo` 之只記錄不改行為之包裝(Z14c 用,頁面卸載時還原);跨 tick 情境(Z11、Z11b)由範例頁(父層程式)以計時器依序賦值並記錄賦值當下 `isMoving()` 於 `window.__movingAtZoom`,測試斷言其為前提,不靠測試端兩次點擊之間隔.離線說明:各 e2e 之首頁導航(`page.goto(baseUrl, { waitUntil: 'networkidle' })`,沿用既有三檔作法)會載入預設首個範例(size,使用預設遠端底圖/地形),此為首頁行為,測試標的頁本身(zoomRange、opacity、maxzoom)之圖磚/DEM/TileJSON 皆離線(地形案例用 `public/e2e-dem.png`) |

## 破壞性/行為變更紀錄:圖台縮放範圍預設放寬(預期 1.0.55)

起因:issue #3(frliq:自 17 級連按放大鈕,第 2 次起 19→18 彈回,無法看更細).版號與發布由主控流程定;本節為使用端升版說明之依據.

| # | 變化(未給新設定時) | 影響 | 還原舊行為之配方 |
|---|---|---|---|
| C1 | **圖台上限 18 → 22**:使用者縮放、縮放鈕、滾輪、`opt.zoom`、公開 API(`zoomTo/easeTo/flyTo`)皆可至 22(原一律彈回 18) | 使用端自訂 raster/wms 底圖若服務層級有限,放大超過其層級後**空白並報錯**(實測服務只到 18 級、未設 maxzoom、zoom 20 → 請求 z21 皆 400、畫面 0% 覆蓋;設 `maxzoom:18` 後只請求 z18、100% 覆蓋、0 錯誤).內建底圖已同版處理:OSM 補 `maxzoom:19`(R9)、Mapbox `22` | `opt.maxZoom: 18`;自訂底圖加 `baseMaps[i].maxzoom` |
| C2 | **圖台下限 1 → 0**(`opt.zoom` 0~1 不再被夾到 1;使用者可縮至 0,globe 下略低於 0) | 全球視圖多縮小約 1 級;mercator 下受容器高度限制(800×600 為 0.2288)故不致過度縮小 | `opt.minZoom: 1` |
| C3 | `opt.zoom` **寫回值可略低於 `minZoom`**(globe 緯度修正;HEAD 因夾 1 不會出現);globe 下僅改 `center` 時 `opt.zoom` 亦會被調整 | 使用端若假設 `opt.zoom ≥ 0` 或 `≥ minZoom`,或「只改 center 不會改 zoom」須知 | 文件化(`@vue-prop`,R11 L1) |
| C4 | 執行期 `opt.zoom` 賦值超過上限:HEAD 寫回 18;現寫回地圖實際值(≤ `maxZoom`) | 同 C1 | — |
| C5 | **center+zoom 同 tick 賦值**(含整個換新 `opt` 物件)兩者皆生效(HEAD 吞 center);同時變更為瞬移 `jumpTo`,無平移動畫 | 修正缺陷;僅「同時變更兩者」之情形不再有 center 之 `panTo` 動畫 | — |
| C6 | 浮點雜訊不再觸發多餘 `setZoom`/`zoomend` | 僅減少事件 | — |
| C7 | 非數值 `opt.zoom`(含執行中刪鍵/設 null)維持 → 預設 6(與 HEAD 同) | 無變化,文件化(R11 L3) | — |
| C8 | `computeBasicOpt` 回傳 `zoom` 不再夾值;新增 `minZoom/maxZoom/ignoredMin`;`center` 非法值(含 `NaN`、緯度超界)改為用預設 | `configProcessor.mjs` 非公開 API;若使用端 import 該檔須知;非法 center 原本使元件崩潰,現視為未給 | — |
| C9 | 新增 `opt.minZoom`/`opt.maxZoom`;`minZoom>maxZoom` 時 `console.warn` 一次並忽略 minZoom | 新功能 | — |
| C10 | 執行期變更 `opt.minZoom/maxZoom` 須於 opt 預先宣告該鍵(Vue 2) | 同既有 `opt.zoom/center` 限制 | 文件化(R11 L3) |
| C11 | 資料圖層(polygon)、地形(DEM `maxzoom:13`)於 zoom 21:polygon 100% 繪出、DEM 請求止於 z13、0 錯誤;vector/style 型底圖靠 overzoom(OpenFreeMap 明亮 zoom 21 → 99.2% 覆蓋、0 錯誤) | 無須處置 | — |
| C12 | 建圖後若 `opt.zoom` 已給且被夾入範圍,`opt.zoom` 於建圖後即被改為實際值(HEAD 維持原值至首次縮放);自動投影模式下地圖先以 mercator 建立、`load` 後才切 globe,故初始請求低於「建圖時 mercator 受限最小層級」(800×600 容器為 0.2288;容器越高越大)者,以建圖時夾後值回寫(例 `zoom:0` → 0.2288) | 父層若以 `opt.zoom` 做「初始值回顯」會看到夾後值;差距於 800×600 容器之例 <0.25 級,容器越高差距越大(mercator 建圖時最小層級 = `log2(容器高/512)`,例:高 1200px、`zoom:0` → 1.23);**未給 `opt.zoom` 而預設 6 落在範圍外**(例 `maxZoom:4`)者,亦於建圖後回寫地圖實際層級(此時新增 `zoom` 鍵,非響應式;預設 6 落在範圍內者不回寫、不新增鍵) | — |
| C13 | **比例尺**(R15):①(2026-10-16)文字由實際距離之 2 倍修正為實際值(例 zoom 10 緯度 0:`12 km` → `6 km`);②(2026-11-04,Gitea #71)**色條改依整齊距離換算、文字改為色條所示距離**:色條由固定實寬 82px(80px + 邊框)改為 (40, 80] px(`border-box`,外高仍 5px),文字由「80px 距離取整」改為 1、2、3、5 × 10^n 公尺(例 緯度 0 zoom 10:`6 km` + 82px → `5 km` + 65.4px;緯度 0 zoom 12:`2 km` + 82px → `1 km` + 52.3px;緯度 24.7 zoom 12:`1 km` + 82px → `1 km` + 57.6px;緯度 25 zoom 16:`87 m` + 82px → `50 m` + 46.2px);< 1 m 時以小數公尺(`0.5 m`);色條寬隨縮放變動,面板寬度隨之變動 | 畫面文字與色條長度變動(無 API 與 `opt` 變動);依賴舊文字/色條 82px 之使用端測試與標準圖須同步(frliq 以比值斷言,待此版後升級重產;cgsmdb `genHtmlLocs` 用預設面板無依賴);本套件 `test/pics` 無標準圖 | — |
| C14 | **opacity**(R14):①未給 opacity 之 vector 疊加層面板由 `100%` 改 `80%`(滑桿位置同步,實際繪製不變);②raster/wms/vector 底圖與疊加層 `opacity` 給數字字串(`'0.5'`)由「圖層消失」(maplibre 驗證 paint 失敗)變正常顯示,給 1.5/-0.2 夾至 1/0,給 `NaN`/非數值字串視為未給(vector 預設 0.8、其餘 1);**適用底圖(radio)與疊加層之渲染**,既有使用端若曾給此類無效值,升版後圖層由消失變顯示;③`type:'style'` 疊加層面板不再顯示無效滑桿 | 面板顯示更正;UI 減一個惰性元件 | — |
| C15 | 內建底圖 OSM 加 `maxzoom:19`、Mapbox 加 `maxzoom:22`(R9) | OSM 放大過 19 級改以 19 級圖磚放大顯示(不空白) | — |
| C16 | **跨 tick 賦值**:元件發起之平移動畫(`opt.center` 變更)進行中,父層再改 `opt.zoom`,現為瞬移 `jumpTo` 至平移目標(HEAD:動畫中途點被寫回 `opt.center`,新 center 永久遺失);平移動畫因此被截斷 | 修正缺陷;僅「動畫進行中再改 zoom」之情形不再有剩餘平移動畫 | — |
| C17 | **`opt.zoom`/`opt.center` 寫回時機增加**:容器 resize、切換投影(`opt.projection`、使用端經 `getMapObject().setProjection`、`load` 後自動投影)使層級/中心被約束改動時,現亦寫回 `opt.zoom`/`opt.center`(HEAD 失步);父層之 `opt` watcher 因而於此類時機被觸發 | 使用端若以 `opt.zoom`/`opt.center` 之變更觸發自身邏輯,會多收到此類通知(值為地圖實際值) | — |
| C18 | **非法 `opt.center`**(如 `[91,121]`)被視為未給後,地圖移至預設中心,`opt.center` 由 `moveend` 以地圖實際中心覆寫(HEAD:元件崩潰或狀態被污染);建圖時 `opt.center` 本身不被覆寫,至首次 moveend 才被地圖實際中心取代(建圖時不發 moveend 回寫;Z17b 只驗地圖中心為預設) | 父層讀 `opt.center` 回顯者會看到預設中心 | — |
| C19 | **`minZoom` 被忽略之警告**:`console.warn` 於 `minZoom>maxZoom` 時發出,同一組輸入只警告一次(建圖時一次;執行期輸入組合改變才再警告),與有效範圍是否改變無關;警告文字含有效 `maxZoom` | 新功能 | — |

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
