# 規則帳本(底圖、地形與疊加層)

本檔為 `sgud/rule/rulebook.md` 之分檔(2026-11-06 依全域設定 sgud 過長整理):圖磚來源層級欄位、底圖/地形欄位與 JSDoc 對應、底圖欄位執行期變更之路徑、預設底圖、url 無效處理、疊加層 opacity、透明度預覽.節號與標題與拆分前一致,內容以搬移為主(同日另有修訂,標註 2026-11-06);索引與盤點指令說明見 `rulebook.md`.

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

- **要求**:`processPanelBaseMaps` 依差異函式分三路——僅 paint 欄位(`colorFillExtrusion`、`opacity`)→ P1 `updateBaseMapPaint`;僅 `visible`/`name`/順序(+paint)→ P2 `updateBaseMapsIncremental`(`name` 自 2026-11-06 起,見下〈2026-11-06 修訂〉);其餘一切欄位(含 minzoom/maxzoom 等 source 欄位)→ P3 `applyBaseMaps` 完整重建.新增 source 欄位不需改差異函式;key 衍生(`baseMapKey`)與 layer/source id 不含 source 選填欄位.
- **盤點**:`Grep "BASEMAP_PAINT_STATE|stripPaint" src/js/basemapManager.mjs`(paint 清單只在此二處).
- **測試**:U5、U14;E2E-B(執行期加 maxzoom 即生效).
- **2026-11-06 修訂(ma327)**:`BASEMAP_PAINT_STATE` 加入 `name`(F5):僅 `name` 變更(含與可見性、順序、paint 同改)走 P2 增量,不重建、不重抓圖磚,面板名稱照常更新;`name` 與 source 欄位(maxzoom/minzoom 等)同改仍走 P3.`name` 為純顯示欄位(圖層 id 由 `baseMapKey` 衍生,不含 `name`).測試:`test/unit-diffpath.test.mjs` UD1~UD5、`test/e2e-diffpath.test.mjs` E2E-D1(正向)、E2E-D2(負向).
- **地形倍率就地路徑(F10,2026-11-06 修訂)**:僅 `terrainMap.exaggeration` 變更時,`computePanelBaseMaps` 回 `terrainExaggerationOnly: true`,元件呼叫 `basemapManager.updateTerrainExaggeration(map, terrainMap)` 以同來源 `map.setTerrain({ source: 'terrain-src', exaggeration })` 就地更新(不移除/重建 DEM 來源、不重抓 DEM、hillshade 不動);就地條件不成立(無 `terrain-src`、地形未啟用或非指向該來源、`setTerrain` 拋錯)回 `false`,改走 `applyTerrain` 整組重套.倍率解讀(數字字串、非數值預設 1.5)與 `applyTerrain` 共用 `getTerrainExaggeration`.**探測依據**(2026-11-06 一次性實測,腳本未入版控):整組重套 1 次 DEM 請求、2 次 `terrain-src` dataloading;同來源就地 `setTerrain` 0 次請求、0 次 dataloading,`getTerrain().exaggeration` 1.5→2→3 確實生效.測試:`unit-diffpath` UD6~UD12、`e2e-diffpath` E2E-D3(正向)、D4(負向)、D5(後備);`e2e-runtime` E2E-012 之範例頁按鈕 `tuneTerrain` 一併改 `hillshadeExaggeration`,使其仍走整組重套(否則僅改倍率走就地路徑,E2E-012 之「重套後 hillshade 疊序」變成空驗).
- **已知限制**:地形除 `exaggeration` 外之任一欄位變更(含 `hillshadeExaggeration`)仍整組重套(F10 只收倍率,未擴大);Vue2 以一般賦值新增鍵不觸發 deep watcher,須 `$set`.

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

## R14 疊加層 opacity 預設與值域單一擁有者

- **要求**:疊加層(`colorShade` 空字串)之預設透明度與值域只經 `basemapManager.getBaseMapOpacity(bm)`:`bm.opacity` 為數字或數字字串 → 夾在 0~1 之有限數(`0` 有效,不可視為未給);非數值/非有限(`NaN`、`±Infinity`、`'abc'`、`''`、布林、陣列)→ 依型別預設(vector **0.8**,raster/wms 及其餘 **1**);`type:'style'` 回 `null`(不支援:各層自帶 opacity,常為 zoom 表達式).渲染(vector/raster 建立與 paint 更新,共 4 個站點)與面板(經元件方法 `bmOpacity(bm)`)一律呼叫之;面板於 `type==='style'` 不渲染滑桿與百分比(互動指示符號兌現不了就移除).`getBaseMapOpacity` 不寫入使用者 `opt`(相較於 `computePanelBaseMaps` 補預設,後者會使 `syncBaseMapsToOpt` 首次顯隱切換時把 `opacity:0.8` 寫進父層 opt).
- **why**:HEAD 預設透明度有 5 個互不相知之擁有者:渲染端 4 處(vector 0.8、raster 1)符合 JSDoc 契約,面板 `:value`/百分比(`WMaplibreglVue.vue:98-99`)不分型別一律 1 → 未給 opacity 之 vector 疊加層面板顯示 100%、實繪 80%(X3);另 raster/wms 疊加層 `opacity` 為字串數字/超界/`NaN` 時,maplibre 驗證 paint 失敗(`raster-opacity: number expected, string found` 等)→ **整個圖層不被建立**,面板卻顯示 `50%`/`150%`/`NaN%`.對照 `imageSets[i].opacity` 已有夾限 0~1.
- **盤點**:`git grep -nE --untracked "bm\.opacity|\.opacity != null|get\(.*'opacity'" -- src/js/basemapManager.mjs src/components/WMaplibreglVue.vue` → 命中僅限:`getBaseMapOpacity` 內(`get(bm, 'opacity', null)` 為唯一讀取點,另其 JSDoc 一行)、`setOverlayOpacity` 之寫入(`bm.opacity = parseFloat(val)`,滑桿值域本即 0~1)與其 `setPaintProperty` 讀取(讀剛寫入之值)、`syncBaseMapsToOpt` 之 `isNumber(bm.opacity)`,及 `imageSets[i].opacity` 之夾限(`WMaplibreglVue.vue` 的 imageSets 處理,屬影像集合,不屬本規則).HEAD:5 個獨立預設站點(`basemapManager.mjs:171,205,378,391`、`WMaplibreglVue.vue:98-99`)→ 改後 1.新增讀取 `bm.opacity` 之站點須改呼叫 `getBaseMapOpacity`,不得另寫 `get(bm,'opacity',…)`.
- **已知限制**:非疊加層(radio)之 vector 底圖亦以 0.8 繪製而面板無指示(L5);`setOverlayOpacity` 為面板滑桿(值域本即 0~1)之寫入路徑,不經 `getBaseMapOpacity`,以程式化方式(非公開方法)傳入 `NaN` 者不在本規則範圍;`imageSets[i].opacity` 之夾限對 `NaN` 無效(`isNumber(NaN)` 為 true)屬既有行為,範圍外(另案).
- **範圍**:`getBaseMapOpacity` 適用所有 raster/wms/vector 條目之渲染(含底圖〔radio〕與疊加層),非僅疊加層:既有使用端若對底圖(radio)給字串數字/超界/`NaN` opacity,升版後同樣被夾限/視為未給(見〈圖台縮放範圍預設放寬〉C14);面板專屬變化(滑桿與百分比)僅疊加層.
- **測試**:U28(`getBaseMapOpacity` 各型別/值域)、U29(4 個渲染站點之 paint = `getBaseMapOpacity`)、E2E-O1–O4(面板滑桿 `value`、百分比文字與實繪 paint 三者一致,含 raster、wms、vector 三種 layerType;無效值圖層仍建立;style 型不顯示滑桿).連續調整(拖曳)期間之預覽見 R18.

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
