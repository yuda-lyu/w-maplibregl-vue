/**
 * configProcessor.mjs
 * 負責將傳入的 opt prop 正規化為各面板配置，全部為純函式（無副作用）
 */
import each from 'lodash-es/each.js'
import get from 'lodash-es/get.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import size from 'lodash-es/size.js'
import isNumber from 'lodash-es/isNumber.js'
import isEqual from 'lodash-es/isEqual.js'
import isbol from 'wsemi/src/isbol.mjs'
import isstr from 'wsemi/src/isstr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'


/** 面板尺寸樣式輔助（純函式） */
export function buildPanelStyle(p) {
    let s = {}
    if (isNumber(p.width)) s.width = `${p.width}px`
    if (isNumber(p.maxWidth)) s.maxWidth = `${p.maxWidth}px`
    if (isNumber(p.height)) s.height = `${p.height}px`
    if (isNumber(p.maxHeight)) s.maxHeight = `${p.maxHeight}px`
    return s
}


/**
 * 計算底圖面板配置
 * @param {Object} opt - Vue component 的 opt prop
 * @param {Array} currentBaseMaps - 目前 panelBaseMaps.baseMaps（用於保留已選底圖）
 * @param {Object} currentTerrainMapTemp - 上次 terrainMap 快照（用於 diff）
 * @param {Array} currentBaseMapsDataTemp - 上次底圖資料快照（用於 diff）
 * @param {Array} defBaseMapsData - 預設底圖配置
 * @param {Object} defTerrainMapData - 預設地形配置
 * @returns {{ panelBaseMaps, terrainMap, baseMapsChanged, terrainChanged }}
 */
export function computePanelBaseMaps(opt, currentBaseMaps, currentTerrainMapTemp, currentBaseMapsDataTemp, defBaseMapsData, defTerrainMapData) {
    let def = { show: true, position: 'topleft', baseMaps: [], stopWheel: false }
    let p = get(opt, 'panelBaseMaps', null); if (!isobj(p)) p = {}
    p = { ...def, ...p }
    if (size(get(p, 'baseMaps', [])) === 0) {
        p.baseMaps = size(currentBaseMaps) === 0 ? cloneDeep(defBaseMapsData) : cloneDeep(currentBaseMaps)
    }
    p = cloneDeep(p); p.style = buildPanelStyle(p)

    //colorShade 未給時補文件預設 ''(疊加層): 使面板分類(radio/checkbox)、switchBaseMap 與渲染端 isestr 判斷一致
    each(p.baseMaps, (bm) => {
        if (isobj(bm) && !isstr(bm.colorShade)) bm.colorShade = ''
    })

    let tm = get(p, 'terrainMap', null)
    if (!isobj(tm)) tm = cloneDeep(defTerrainMapData)
    let terrainChanged = !isEqual(currentTerrainMapTemp, tm)

    let baseMapsChanged = !isEqual(currentBaseMapsDataTemp, p.baseMaps)

    return { panelBaseMaps: p, terrainMap: tm, baseMapsChanged, terrainChanged }
}


/**
 * 計算羅盤圖標面板配置
 * @param {Object} opt
 * @param {{ iconCompassRoseLight, iconCompassRoseDark }} uiResData
 * @returns {Object} panelCompassRose
 */
export function computePanelCompassRose(opt, uiResData) {
    let def = {
        show: false,
        position: 'topright',
        size: 120,
        withPanel: false,
        iconSrc: null,
        iconSrcLight: uiResData.iconCompassRoseLight,
        iconSrcDark: uiResData.iconCompassRoseDark,
    }
    let p = get(opt, 'panelCompassRose', null); if (!isobj(p)) p = {}
    return cloneDeep({ ...def, ...p })
}


/** 計算 3D 指北針面板配置 */
export function computePanelCompass3d(opt) {
    let def = { show: true, position: 'topright', size: 44 }
    let p = get(opt, 'panelCompass3d', null); if (!isobj(p)) p = {}
    return cloneDeep({ ...def, ...p })
}


/** 計算地圖資訊面板配置 */
export function computePanelLabels(opt) {
    let def = { show: true, title: '', useItems: ['lng', 'lat', 'zoom'], lng: 'Longitude', lat: 'Latitude', zoom: 'Zoom', position: 'topright' }
    let p = get(opt, 'panelLabels', null); if (!isobj(p)) p = {}
    p = cloneDeep({ ...def, ...p }); p.style = buildPanelStyle(p)
    return p
}


/** 計算圖層顯隱面板配置 */
export function computePanelItems(opt) {
    let def = { show: true, position: 'topleft', stopWheel: false }
    let p = get(opt, 'panelItems', null); if (!isobj(p)) p = {}
    p = cloneDeep({ ...def, ...p }); p.style = buildPanelStyle(p)
    return p
}


/** 計算縮放按鈕面板配置 */
export function computePanelZoom(opt) {
    let def = { show: true, position: 'bottomleft' }
    let p = get(opt, 'panelZoom', null); if (!isobj(p)) p = {}
    return cloneDeep({ ...def, ...p })
}


/** 計算比例尺面板配置 */
export function computePanelScale(opt) {
    let def = { show: true, position: 'bottomright' }
    let p = get(opt, 'panelScale', null); if (!isobj(p)) p = {}
    return cloneDeep({ ...def, ...p })
}


/** 計算圖例面板配置 */
export function computePanelLegends(opt) {
    let def = { show: true, position: 'bottomright', maxWidth: 300, stopWheel: false }
    let p = get(opt, 'panelLegends', null); if (!isobj(p)) p = {}
    p = cloneDeep({ ...def, ...p }); p.style = buildPanelStyle(p)
    return p
}


/**
 * 計算叢集化設定
 * @param {Object} opt
 * @returns {{ enabled, radius, maxZoom, levelNum, levelValues, levelRadius,
 *             levelFillColors, levelLineColors, levelLineWidths, levelTextSizes, levelTextColors, key }}
 */
export function computeClusterOpts(opt) {
    let cpEnabled = get(opt, 'clusterPoints', null)
    if (!isbol(cpEnabled)) cpEnabled = false
    let cpRadius = get(opt, 'clusterPointsRadius', null)
    if (!isnum(cpRadius)) cpRadius = 50; else cpRadius = cdbl(cpRadius)
    let cpMaxZoom = get(opt, 'clusterPointsMaxZoom', null)
    if (!isnum(cpMaxZoom)) cpMaxZoom = 14; else cpMaxZoom = cdbl(cpMaxZoom)
    let cpLevelNum = get(opt, 'clusterPointsLevelNum', null)
    if (!isnum(cpLevelNum)) cpLevelNum = 3; else cpLevelNum = Math.max(1, Math.round(cdbl(cpLevelNum)))
    //預設陣列補齊到指定長度: levelNum > 預設長度時依規則外插, 避免靜默降級成較少級數
    let padArr = (arr, n, fnNext) => {
        let r = arr.slice(0, n)
        while (r.length < n) r.push(fnNext(r[r.length - 1]))
        return r
    }
    let cpLevelValues = get(opt, 'clusterPointsLevelValues', null)
    if (!isarr(cpLevelValues) || cpLevelValues.length !== cpLevelNum - 1) cpLevelValues = padArr([10, 100], cpLevelNum - 1, (last) => last * 10)
    let cpLevelRadius = get(opt, 'clusterPointsLevelRadius', null)
    if (!isarr(cpLevelRadius) || cpLevelRadius.length !== cpLevelNum) cpLevelRadius = padArr([10, 15, 20], cpLevelNum, (last) => last + 5)
    let cpLevelFillColors = get(opt, 'clusterPointsLevelFillColors', null)
    if (!isarr(cpLevelFillColors) || cpLevelFillColors.length !== cpLevelNum) cpLevelFillColors = padArr(['rgba(140, 40, 25, 0.75)', 'rgba(255, 125, 50, 0.75)', 'rgba(255, 50, 100, 0.75)'], cpLevelNum, (last) => last)
    let cpLevelLineColors = get(opt, 'clusterPointsLevelLineColors', null)
    if (!isarr(cpLevelLineColors) || cpLevelLineColors.length !== cpLevelNum) cpLevelLineColors = padArr(['#fff', '#fff', '#fff'], cpLevelNum, (last) => last)
    let cpLevelLineWidths = get(opt, 'clusterPointsLevelLineWidths', null)
    if (!isarr(cpLevelLineWidths) || cpLevelLineWidths.length !== cpLevelNum) cpLevelLineWidths = padArr([2, 2, 2], cpLevelNum, (last) => last)
    let cpLevelTextSizes = get(opt, 'clusterPointsLevelTextSizes', null)
    if (!isarr(cpLevelTextSizes) || cpLevelTextSizes.length !== cpLevelNum) cpLevelTextSizes = padArr([12, 12, 12], cpLevelNum, (last) => last)
    let cpLevelTextColors = get(opt, 'clusterPointsLevelTextColors', null)
    if (!isarr(cpLevelTextColors) || cpLevelTextColors.length !== cpLevelNum) cpLevelTextColors = padArr(['#fff', '#fff', '#fff'], cpLevelNum, (last) => last)

    let key = JSON.stringify({
        cpEnabled,
        cpRadius,
        cpMaxZoom,
        cpLevelNum,
        cpLevelValues,
        cpLevelRadius,
        cpLevelFillColors,
        cpLevelLineColors,
        cpLevelLineWidths,
        cpLevelTextSizes,
        cpLevelTextColors,
    })

    return {
        enabled: cpEnabled,
        radius: cpRadius,
        maxZoom: cpMaxZoom,
        levelNum: cpLevelNum,
        levelValues: cpLevelValues,
        levelRadius: cpLevelRadius,
        levelFillColors: cpLevelFillColors,
        levelLineColors: cpLevelLineColors,
        levelLineWidths: cpLevelLineWidths,
        levelTextSizes: cpLevelTextSizes,
        levelTextColors: cpLevelTextColors,
        key,
    }
}


//圖台縮放範圍預設: 0~22(maxZoom 同 maplibre 預設; minZoom 0=整個世界於 512px 圖磚恰為一幅; maplibre 6.14.0 實作之 minZoom 預設為 -2〔文件寫 0〕, 故由本套件明給)
export const DEF_MIN_ZOOM = 0
export const DEF_MAX_ZOOM = 22
const LIM_ZOOM = 24 //maplibre MapOptions 之合法上限

function toZoomLimit(v) {
    if (!isnum(v)) return null
    v = Number(v)
    if (!Number.isFinite(v)) return null
    return Math.min(Math.max(v, 0), LIM_ZOOM)
}

/**
 * 正規化圖台縮放範圍(opt.minZoom、opt.maxZoom): 數字或數字字串依數值; 非數值/非有限視為未給用預設(0、22); 夾在 0~24;
 * minZoom 大於 maxZoom 時忽略 minZoom(ignoredMin=true, 由呼叫端警告一次; 同圖磚 minzoom/maxzoom 之作法, maxZoom 為保護性欄位)。
 * 範圍只交給地圖把關(R11), 元件側不另夾 opt.zoom
 * @param {Object} opt
 * @returns {{ minZoom: Number, maxZoom: Number, ignoredMin: Boolean }}
 */
export function computeZoomRange(opt) {
    let mn = toZoomLimit(get(opt, 'minZoom', null))
    let mx = toZoomLimit(get(opt, 'maxZoom', null))
    let minZoom = mn === null ? DEF_MIN_ZOOM : mn
    let maxZoom = mx === null ? DEF_MAX_ZOOM : mx
    let ignoredMin = false
    if (minZoom > maxZoom) {
        ignoredMin = true
        minZoom = Math.min(DEF_MIN_ZOOM, maxZoom)
    }
    return { minZoom, maxZoom, ignoredMin }
}

//center 合法: 兩值皆為有限數且緯度在 ±90 內(經度不限, maplibre 會 wrap); isNumber 對 NaN 為 true, 故須另驗有限
function isValidCenter(c) {
    return isarr(c) && size(c) === 2 && isNumber(c[0]) && isNumber(c[1]) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 90
}

/**
 * 計算基本 opt 設定（zoom, minZoom, maxZoom, center, panelBackgroundColor 等）。對任何輸入皆回合法值且不拋錯(R13)
 * @param {Object} opt
 * @param {Number} currentZoom
 * @param {Array} currentCenter
 * @returns {{ zoom, minZoom, maxZoom, ignoredMin, center, panelBackgroundColor, displayPopupOnlyone, displayOrderByType, popupPosition, tooltipPosition, projection }}
 */
export function computeBasicOpt(opt, currentZoom, currentCenter) {
    let pbc = get(opt, 'panelBackgroundColor', null)
    if (!isstr(pbc)) pbc = 'rgba(255,255,255,0.95)'

    let zr = computeZoomRange(opt)

    //zoom 不在此夾值: 層級範圍只由地圖之 minZoom/maxZoom 把關(地圖實際可達層級另受投影影響, 如 globe 之下限隨緯度而略低於 minZoom,
    //元件側另夾一次必與地圖實際值不一致而拉回); 超出範圍之值交 map.setZoom/jumpTo, 由 changeOpt 以地圖實際值回寫
    let zoom = get(opt, 'zoom', null)
    zoom = isnum(zoom) ? Number(zoom) : 6

    let center = get(opt, 'center', null)
    if (!isValidCenter(center)) center = [23.5, 121.1]
    center = cloneDeep(center)

    let displayPopupOnlyone = get(opt, 'displayPopupOnlyone', null)
    if (!isbol(displayPopupOnlyone)) displayPopupOnlyone = true

    let displayOrderByType = get(opt, 'displayOrderByType', null)
    if (!isbol(displayOrderByType)) displayOrderByType = true

    let pp = get(opt, 'popupPosition', null)
    let popupPosition = (isestr(pp) && ['top', 'bottom', 'left', 'right'].includes(pp)) ? pp : null

    let tp = get(opt, 'tooltipPosition', null)
    let tooltipPosition = (isestr(tp) && ['top', 'bottom', 'left', 'right'].includes(tp)) ? tp : null

    let projection = get(opt, 'projection', null)
    if (!isstr(projection) || !['globe', 'mercator'].includes(projection)) projection = ''

    return { zoom, minZoom: zr.minZoom, maxZoom: zr.maxZoom, ignoredMin: zr.ignoredMin, center, panelBackgroundColor: pbc, displayPopupOnlyone, displayOrderByType, popupPosition, tooltipPosition, projection }
}
