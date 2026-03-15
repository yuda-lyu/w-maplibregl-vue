/**
 * configProcessor.mjs
 * 負責將傳入的 opt prop 正規化為各面板配置，全部為純函式（無副作用）
 */
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
        show: false, position: 'topright', size: 120, withPanel: false, iconSrc: null,
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
    let cpLevelValues = get(opt, 'clusterPointsLevelValues', null)
    if (!isarr(cpLevelValues) || cpLevelValues.length !== cpLevelNum - 1) cpLevelValues = [10, 100].slice(0, cpLevelNum - 1)
    let cpLevelRadius = get(opt, 'clusterPointsLevelRadius', null)
    if (!isarr(cpLevelRadius) || cpLevelRadius.length !== cpLevelNum) cpLevelRadius = [10, 15, 20].slice(0, cpLevelNum)
    let cpLevelFillColors = get(opt, 'clusterPointsLevelFillColors', null)
    if (!isarr(cpLevelFillColors) || cpLevelFillColors.length !== cpLevelNum) cpLevelFillColors = ['rgba(140, 40, 25, 0.75)', 'rgba(255, 125, 50, 0.75)', 'rgba(255, 50, 100, 0.75)'].slice(0, cpLevelNum)
    let cpLevelLineColors = get(opt, 'clusterPointsLevelLineColors', null)
    if (!isarr(cpLevelLineColors) || cpLevelLineColors.length !== cpLevelNum) cpLevelLineColors = ['#fff', '#fff', '#fff'].slice(0, cpLevelNum)
    let cpLevelLineWidths = get(opt, 'clusterPointsLevelLineWidths', null)
    if (!isarr(cpLevelLineWidths) || cpLevelLineWidths.length !== cpLevelNum) cpLevelLineWidths = [2, 2, 2].slice(0, cpLevelNum)
    let cpLevelTextSizes = get(opt, 'clusterPointsLevelTextSizes', null)
    if (!isarr(cpLevelTextSizes) || cpLevelTextSizes.length !== cpLevelNum) cpLevelTextSizes = [12, 12, 12].slice(0, cpLevelNum)
    let cpLevelTextColors = get(opt, 'clusterPointsLevelTextColors', null)
    if (!isarr(cpLevelTextColors) || cpLevelTextColors.length !== cpLevelNum) cpLevelTextColors = ['#fff', '#fff', '#fff'].slice(0, cpLevelNum)

    let key = JSON.stringify({
        cpEnabled, cpRadius, cpMaxZoom, cpLevelNum, cpLevelValues,
        cpLevelRadius, cpLevelFillColors, cpLevelLineColors, cpLevelLineWidths,
        cpLevelTextSizes, cpLevelTextColors,
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


/**
 * 計算基本 opt 設定（zoom, center, panelBackgroundColor 等）
 * @param {Object} opt
 * @param {Number} currentZoom
 * @param {Array} currentCenter
 * @returns {{ zoom, center, panelBackgroundColor, displayPopupOnlyone, popupPosition, tooltipPosition, projection }}
 */
export function computeBasicOpt(opt, currentZoom, currentCenter) {
    let pbc = get(opt, 'panelBackgroundColor', null)
    if (!isstr(pbc)) pbc = 'rgba(255,255,255,0.95)'

    let zoom = get(opt, 'zoom', null)
    if (!isnum(zoom)) zoom = 6
    zoom = Math.min(Math.max(zoom, 1), 18)

    let center = get(opt, 'center', null)
    let ck = isarr(center) && size(center) === 2 && isNumber(center[0]) && isNumber(center[1])
    if (!ck) center = [23.5, 121.1]
    center = cloneDeep(center)

    let displayPopupOnlyone = get(opt, 'displayPopupOnlyone', null)
    if (!isbol(displayPopupOnlyone)) displayPopupOnlyone = true

    let pp = get(opt, 'popupPosition', null)
    let popupPosition = (isestr(pp) && ['top', 'bottom', 'left', 'right'].includes(pp)) ? pp : null

    let tp = get(opt, 'tooltipPosition', null)
    let tooltipPosition = (isestr(tp) && ['top', 'bottom', 'left', 'right'].includes(tp)) ? tp : null

    let projection = get(opt, 'projection', null)
    if (!isstr(projection) || !['globe', 'mercator'].includes(projection)) projection = ''

    return { zoom, center, panelBackgroundColor: pbc, displayPopupOnlyone, popupPosition, tooltipPosition, projection }
}
