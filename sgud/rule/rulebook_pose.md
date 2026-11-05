# 規則帳本:位姿(縮放範圍與 `opt` 寫回)

本檔為 `sgud/rule/rulebook.md` 之分檔(2026-11-06 依全域設定 sgud 過長整理):縮放範圍單一擁有者、`opt`↔地圖寫回迴圈(含實作後站點表)、`opt` 輸入正規化、縮放範圍預設放寬之行為變更紀錄.節號與標題與拆分前一致,內容以搬移為主(同日另有修訂,標註 2026-11-06:R12 要求首行與實作後站點表、新增〈重評條件〉);索引與盤點指令說明見 `rulebook.md`.

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

- **要求**:元件把地圖狀態寫回 `opt` 之欄位(現為 3 條通道:①位姿 `zoom`、`center`〔6 處〕;②`syncBaseMapsToOpt` 之底圖 visible/opacity;③`setOptVisibleReactive` 之資料集 `visible`〔`opt.xxxSets[i].visible`,2026-11-06 登錄,見〈實作後站點表〉〕),與 `changeOpt` 對地圖之 `setZoom/jumpTo/panTo/applyZoomRange` 必須:
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

### R12 實作後站點表(2026-10-16;行號為 `WMaplibreglVue.vue`)

元件改寫 `opt` 之站點(`Grep "vo\.opt\.[a-zA-Z]+ *=[^=]"`)與判準:

| 站點 | 欄位 | 判準 |
|---|---|---|
| `:898` `initMap` 建圖後 | zoom | R12-7:`opt.zoom`(未給/非數值為預設 6)與地圖實際層級差 >1e-9 才回寫;一致者不寫、不新增鍵 → 已套(Z14、Z14c) |
| `:917` `zoomend` | zoom | `holdWriteBack` 期間不寫(R12-2)→ 已套 |
| `:921` `moveend` | center | `holdWriteBack` 期間整個 handler 略過;`isEqual` 守門 → 已套 |
| `:965` `syncZoomFromMap` | zoom | R12-6:僅差 >1e-9 才寫;由 `zoomend`、`moveend`、`projectiontransition` 呼叫 → 已套(Z12、Z12b、Z13) |
| `:976` `syncCenterFromMap` | center | R12-6:僅差 >1e-9 且地圖不在移動中才寫;由 `projectiontransition` 呼叫 → 已套(Z12、Z12b) |
| `:1152` `changeOpt` 呼叫地圖後 | zoom | R12-3:以地圖實際層級回寫,`isnum` 守門不對非數值強制轉型 → 已套(Z5、Z7、Z14) |
| `:1036` `syncBaseMapsToOpt`(第 ② 通道) | 底圖 visible/opacity | `$set`、`isEqual` 守門;與 zoom/center 無耦合 → 不適用 R12-1~7 |
| `:1819` `setOptVisibleReactive`(第 ③ 通道,2026-11-06 登錄) | 資料集 `visible`(`opt.xxxSets[i].visible`) | `$set` 寫回(欄位可能原不存在,直接賦值不具響應性);呼叫端 `:1841`(`toggleItemVisible`,面板顯隱)、`:2030`(公開方法 `modifyItemsVisible`);與 zoom/center 無耦合 → 不適用 R12-1~7;其同 tick/跨 tick 多欄位賦值之專屬案例**未有**——現有 E2E-002(`e2e-runtime`)只驗面板勾選後父層可響應讀到;owner 須為可寫物件(`Object.freeze` 之資料集物件使寫回失敗,實測見 README〈`opt` 位姿契約〉) |

元件對地圖之相機呼叫(`git grep -nE "map\.(setZoom|jumpTo|panTo|easeTo|flyTo|zoomTo|zoomIn|zoomOut)\(" -- src`):`changeOpt` 內 `jumpTo`(同 tick:`:1129`;`panTarget`:`:1134`)、`setZoom`(`:1137`)、`panTo`(`:1142`,於其後設 `panTarget`:`:1145`)= R12 管轄;`zoomIn/zoomOut`(縮放鈕,`:1078`、`:1081`)、`easeTo({pitch,bearing})`(羅盤,`:1253`)、公開 `panTo` 方法(`:1962`)、`layerRenderers.mjs:723` 叢集展開 `easeTo`、`publicApi.mjs:32`、`:33` 之 `getMapObject` 代理 `panTo` = 使用者/使用端觸發,結果走 `zoomend/moveend` 寫回(L7).

(2026-11-06 核對:上表行號依 `WMaplibreglVue.vue` 現況逐項重取,行號隨編輯漂移,改動該檔後須重核;核對指令:`Grep -n "vo\.opt\.[a-zA-Z]+ *=[^=]|map\.(setZoom|jumpTo|panTo|easeTo|zoomIn|zoomOut)\(|^        (syncZoomFromMap|syncCenterFromMap|changeOpt|syncBaseMapsToOpt|setOptVisibleReactive|panTo)\(|panTarget = " src/components/WMaplibreglVue.vue`.)

## R13 opt 輸入正規化為全函式

- **要求**:`computeBasicOpt`/`computeZoomRange` 對任何輸入(非數值、`NaN`、`±Infinity`、超界、數字字串、型別錯、`opt` 為 `null/undefined`)皆回合法值並**不拋錯**;不合法值之處置(預設/夾限/忽略)逐欄位寫於 `@vue-prop`:
  - `zoom`:數字或數字字串;非數值(含 `NaN`)→6;**不夾範圍**(R11),`±Infinity` 亦原樣交地圖(由地圖夾至範圍端點,R12 回寫實際層級).
  - `minZoom`/`maxZoom`:見 R11.
  - `center`:兩值皆須為**有限數**且緯度 |lat| ≤ 90(經度 |lng| 不限,maplibre 會 wrap),否則視為未給用預設 `[23.5, 121.1]`(`isNumber` 對 `NaN` 為 true,僅驗型別會使 `new Map` 拋 `Invalid LngLat latitude value`/`Invalid LngLat object: (NaN, NaN)` → 元件崩潰,執行中賦值則 `currentCenter` 被污染為非法值).數字字串 `['25','121']` 維持視為非法(HEAD 行為).
- **why**:center 驗證為 R12 合併 `jumpTo` 之**前置條件**:center 非法時 `jumpTo` 先套 zoom 後設 center 而拋錯(`maplibre-gl-dev.mjs:43509-43513`),無地形時活的 transform 被半改且不發事件、有地形時 zoom 停在舊值而 `opt.zoom` 已寫新值;HEAD 為 `setZoom` 先成功、`panTo` 才拋錯,故不驗證即上線比 HEAD 更糟.
- **盤點**:`computeBasicOpt` 內 zoom/minZoom/maxZoom/center 四欄皆有「非法→預設」分支;`Grep "isNumber\(center" src` 不得再有只驗型別之 center 檢查(HEAD 站點:`configProcessor.mjs:220`、`mapCore.mjs:57`)→ 改後 0.
- **測試**:U18–U22、U30(center)、U32(`computeBasicOpt`/`computeZoomRange` 對異常輸入集 fuzz 不拋錯、輸出合法)、E2E-Z17.

## 破壞性/行為變更紀錄:圖台縮放範圍預設放寬(預期 1.0.55)

起因:issue #3(使用端:自 17 級連按放大鈕,第 2 次起 19→18 彈回,無法看更細).版號與發布由主控流程定;本節為使用端升版說明之依據.

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
| C13 | **比例尺**(R15):①(2026-10-16)文字由實際距離之 2 倍修正為實際值(例 zoom 10 緯度 0:`12 km` → `6 km`);②(2026-11-04,Gitea #71)**色條改依整齊距離換算、文字改為色條所示距離**:色條由固定實寬 82px(80px + 邊框)改為 (40, 80] px(`border-box`,外高仍 5px),文字由「80px 距離取整」改為 1、2、3、5 × 10^n 公尺(例 緯度 0 zoom 10:`6 km` + 82px → `5 km` + 65.4px;緯度 0 zoom 12:`2 km` + 82px → `1 km` + 52.3px;緯度 24.7 zoom 12:`1 km` + 82px → `1 km` + 57.6px;緯度 25 zoom 16:`87 m` + 82px → `50 m` + 46.2px);< 1 m 時以小數公尺(`0.5 m`);色條寬隨縮放變動,面板寬度隨之變動 | 畫面文字與色條長度變動(無 API 與 `opt` 變動);依賴舊文字/色條 82px 之使用端測試與標準圖須同步(使用端 以比值斷言,待此版後升級重產;使用端 `genHtmlLocs` 用預設面板無依賴);本套件 `test/pics` 無標準圖 | — |
| C14 | **opacity**(R14):①未給 opacity 之 vector 疊加層面板由 `100%` 改 `80%`(滑桿位置同步,實際繪製不變);②raster/wms/vector 底圖與疊加層 `opacity` 給數字字串(`'0.5'`)由「圖層消失」(maplibre 驗證 paint 失敗)變正常顯示,給 1.5/-0.2 夾至 1/0,給 `NaN`/非數值字串視為未給(vector 預設 0.8、其餘 1);**適用底圖(radio)與疊加層之渲染**,既有使用端若曾給此類無效值,升版後圖層由消失變顯示;③`type:'style'` 疊加層面板不再顯示無效滑桿 | 面板顯示更正;UI 減一個惰性元件 | — |
| C15 | 內建底圖 OSM 加 `maxzoom:19`、Mapbox 加 `maxzoom:22`(R9) | OSM 放大過 19 級改以 19 級圖磚放大顯示(不空白) | — |
| C16 | **跨 tick 賦值**:元件發起之平移動畫(`opt.center` 變更)進行中,父層再改 `opt.zoom`,現為瞬移 `jumpTo` 至平移目標(HEAD:動畫中途點被寫回 `opt.center`,新 center 永久遺失);平移動畫因此被截斷 | 修正缺陷;僅「動畫進行中再改 zoom」之情形不再有剩餘平移動畫 | — |
| C17 | **`opt.zoom`/`opt.center` 寫回時機增加**:容器 resize、切換投影(`opt.projection`、使用端經 `getMapObject().setProjection`、`load` 後自動投影)使層級/中心被約束改動時,現亦寫回 `opt.zoom`/`opt.center`(HEAD 失步);父層之 `opt` watcher 因而於此類時機被觸發 | 使用端若以 `opt.zoom`/`opt.center` 之變更觸發自身邏輯,會多收到此類通知(值為地圖實際值) | — |
| C18 | **非法 `opt.center`**(如 `[91,121]`)被視為未給後,地圖移至預設中心,`opt.center` 由 `moveend` 以地圖實際中心覆寫(HEAD:元件崩潰或狀態被污染);建圖時 `opt.center` 本身不被覆寫,至首次 moveend 才被地圖實際中心取代(建圖時不發 moveend 回寫;Z17b 只驗地圖中心為預設) | 父層讀 `opt.center` 回顯者會看到預設中心 | — |
| C19 | **`minZoom` 被忽略之警告**:`console.warn` 於 `minZoom>maxZoom` 時發出,同一組輸入只警告一次(建圖時一次;執行期輸入組合改變才再警告),與有效範圍是否改變無關;警告文字含有效 `maxZoom` | 新功能 | — |

## 重評條件(`opt` 雙向同步與深層監看之結構調整)

- **使用者裁定(2026-11-05)**:本套件**不重構**,採結構審計(2026-11-05)之選項 A——維持逐案修,補 3 項小修(僅 `name` 變更、僅地形倍率變更不整組重建;移除只寫不讀之 `panelBaseMapsTemp`)、1 份契約文件(README〈`opt` 位姿契約〉)與下列重評條件;**`opt` 雙向同步(R12)與單一深層監看之結構不動**.2026-11-06 已完成(見 `rulebook_basemap.md` R8 之〈2026-11-06 修訂〉與 README).
- **審計之判讀(留作重評之基準)**:`opt.zoom`/`opt.center` 同時是輸入與輸出(位姿雙向同步),且任何 `opt` 變更皆走訪整個 `opt` 再全量重推(深層監看);此為真實之結構債,但近期多數問題與它無關(比對 2026-10-16 以來之行為修正提交:7 筆中 2 筆源自此結構,其餘為獨立之功能缺口與第三方包裝問題);R12 機制自 2026-10-16 起未再變動.**已知代價**:使用端陷阱 T1~T5、T7、T8 以文件告知而非消除(README〈`opt` 位姿契約〉);大資料時走訪成本以凍結 `points` 緩解.
- **重評條件**(閾值為審計提案,成立即依右欄改走,不得因「已裁定不重構」而略過):

| 條件 | 成立時改走 |
| --- | --- |
| 出現新的位姿類**使用端回報**(README〈`opt` 位姿契約〉已寫明之行為不計;該文件完成前之回報一律計入) | 重開結構審計,評估單向資料流(停止寫回 `opt`,位姿改以事件與方法讀寫) |
| 要新增任何位姿寫回欄位(R12-8;如 `opt.pitch`、`opt.bearing`,見 R11 L2) | 先改為單向資料流,再加欄位,不再擴大雙向同步 |
| 使用端實測 `moveend` 後 Vue 沖刷 ≥ 50 ms(約 5 萬點)且無法凍結資料 | 收窄監看:`watch.opt` 改監看「排除各資料鍵」之 computed(資料鍵已各有 watcher),約 10 行 |
| 升 Vue 3,或姊妹元件 `w-leaflet-vue` 需同步重寫 | 併做單向資料流 |

- **反對理由(裁定時已知,留存)**:雙向同步已證為難做對之結構(2026-10-16 實作後外審抓到 4 個此機制內之功能缺陷,R12 有 8 條規則、19 項旗標與特例中 13 項屬它),`holdWriteBack` 已成冗餘之縱深防禦而保留,文件化不等於解決;且目前使用端少,為重構成本最低之時機.使用者全域原則「程式碼品質優先、破壞性變更由下游連帶修正」與「沒有已被觀察、後果具體之問題不主動做」之取捨由使用者裁量,2026-11-05 取後者.
- **未收進本輪、續留之項目**(另案,與本結構無關):底圖來源 `tileSize`/`scheme`/`bounds`/`attribution` 不可設(B7)、hillshade 與 terrain 同 url 時共用來源致陰影 DEM 精度較粗(F7)、terrain 缺時 hillshade 被靜默忽略(F8)、縮放鈕於邊界不顯示停用(D4,R11)、`opt.pitch`/`opt.bearing` 無輸入無寫回(L2,R11)、`e2e-movestate` E2E-M8 高負載偶發紅未查實.收窄監看(B1)暫不做,依上表第 3 列觸發.
