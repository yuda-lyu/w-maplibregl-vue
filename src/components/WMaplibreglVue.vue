<template>
    <div
        style="position:relative; display:inline-block;"
        v-domresize
        @domresize="resize"
        :loading="loading"
    >

        <!-- 圖台區 -->
        <div
            ref="panel"
            style="width:100%; height:100%;"
        ></div>

        <!-- 輔助區 -->
        <div v-if="!loading">

            <!-- 四角面板容器，面板依順序由上往下堆疊，不重疊 -->
            <div
                class="clsCorner"
                :class="'clsCorner-'+corner"
                :key="corner"
                v-for="corner in corners"
            >

                <!-- 羅盤 -->
                <div
                    :style="{ order: getPanelOrder('panelCompassRose', corner), padding: panelCompassRose.withPanel ? '3px' : '0', background: panelCompassRose.withPanel ? panelBackgroundColor : 'transparent', borderRadius: '5px' }"
                    v-if="panelCompassRose.show && panelCompassRose.position===corner"
                >
                    <img
                        :style="{ width: panelCompassRose.size+'px', height: panelCompassRose.size+'px', display:'block' }"
                        :src="useIconCompassRose"
                    />
                </div>

                <!-- 3D 指北針（含視角傾斜效果，點擊恢復 2D 正北） -->
                <div
                    :style="{ order: getPanelOrder('panelCompass3d', corner), cursor:'pointer', display:'inline-block', lineHeight:'0' }"
                    :title="currentPitch > 0 ? 'Click to reset 2D north-up view' : 'Click to face north'"
                    @click="resetTo2d"
                    v-if="panelCompass3d.show && panelCompass3d.position===corner"
                >

                    <div :style="compass3dDiscStyle">
                        <svg :width="panelCompass3d.size" :height="panelCompass3d.size" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
                            <!-- 外圓背景 -->
                            <circle cx="22" cy="22" r="21" fill="rgba(20,20,20,0.78)" stroke="rgba(255,255,255,1)" stroke-width="1"/>
                            <!-- 旋轉群組：指針依 bearing 旋轉 -->
                            <g :transform="`rotate(${-currentBearing}, 22, 22)`">
                                <!-- 北方指針（紅色） -->
                                <polygon points="22,4 18.5,22 22,19.5 25.5,22" fill="#e84040"/>
                                <!-- 南方指針（灰色） -->
                                <polygon points="22,40 18.5,22 22,24.5 25.5,22" fill="#999999"/>
                                <!-- 東西刻度短線 -->
                                <line x1="4" y1="22" x2="7" y2="22" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
                                <line x1="37" y1="22" x2="40" y2="22" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
                            </g>
                            <!-- 中心圓點 -->
                            <circle cx="22" cy="22" r="2.2" fill="rgba(255,255,255,0.85)"/>
                        </svg>
                    </div>

                </div>

                <!-- 底圖選擇 -->
                <div
                    class="clsPanel"
                    :style="{ order: getPanelOrder('panelBaseMaps', corner), background: panelBackgroundColor }"
                    v-if="panelBaseMaps.show && panelBaseMaps.position===corner"
                >

                    <div
                        :style="{ overflow:'auto', ...panelBaseMaps.style }"
                        @wheel="handleWheel($event, panelBaseMaps)"
                    >
                        <div
                            :key="'bm:'+kbm"
                            style="padding:2px 0;"
                            v-for="(bm, kbm) in panelBaseMaps.baseMaps"
                        >

                            <!-- 底圖（colorShade 非空）：radio 單選 -->
                            <template v-if="bm.colorShade !== ''">
                                <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.8rem;">
                                    <input type="radio" :name="'bmr_'+_uid" :checked="bm.visible" @change="switchBaseMap(kbm)" />
                                    <span>{{ bm.name }}</span>
                                </label>
                            </template>

                            <!-- 疊加圖層（colorShade 空字串）：checkbox 多選 + opacity 滑桿 -->
                            <template v-else>
                                <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.8rem;">
                                    <input type="checkbox" :checked="bm.visible" @change="toggleOverlayVisible(kbm)" />
                                    <span>{{ bm.name }}</span>
                                </label>
                                <!-- type 為 style 不支援整組透明度(各層自帶 opacity), 不渲染滑桿; 預設值與值域統一由 getBaseMapOpacity 決定(R14) -->
                                <div v-if="bm.type !== 'style'" style="display:flex; align-items:center; gap:4px; padding-left:20px; padding-top:2px; font-size:0.75rem;">
                                    <input type="range" min="0" max="1" step="0.01" :value="bmOpacity(bm)" :disabled="!bm.visible" @input="setOverlayOpacity(kbm, $event.target.value)" style="width:70px;" />
                                    <span>{{ Math.round(bmOpacity(bm) * 100) }}%</span>
                                </div>
                            </template>

                        </div>
                    </div>

                </div>

                <!-- 圖層顯隱 -->
                <div
                    class="clsPanel"
                    :style="{ order: getPanelOrder('panelItems', corner), background: panelBackgroundColor }"
                    v-if="panelItems.show && items.length>0 && panelItems.position===corner"
                >

                    <div
                        :style="{ overflow:'auto', ...panelItems.style }"
                        @wheel="handleWheel($event, panelItems)"
                    >

                        <div
                            :key="'item:'+ki"
                            style="padding:2px 0;"
                            v-for="(item, ki) in items"
                        >

                            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.8rem;">
                                <input type="checkbox" :checked="item.visible" @change="toggleItemVisible(ki)" />
                                <span style="display:inline-flex; flex-direction:column; gap:1px;">
                                    <span>{{ item.name }}</span>
                                    <span v-if="item.msg" style="font-size:0.7rem; color:#888; font-weight:normal; white-space:pre-wrap;">{{ item.msg }}</span>
                                </span>
                            </label>

                        </div>

                    </div>

                </div>

                <!-- 地圖資訊（經緯度/縮放） -->
                <div
                    class="clsPanel"
                    :style="{ order: getPanelOrder('panelLabels', corner), background: panelBackgroundColor }"
                    v-if="panelLabels.show && panelLabels.position===corner"
                >

                    <div :style="{ overflow:'auto', ...panelLabels.style }">
                        <template v-if="panelLabels.title !== ''">
                            <div style="font-size:1.1rem; font-weight:bold; text-align:center;">{{ panelLabels.title }}</div>
                            <div style="border-top:1px solid #b9b9b9; margin:4px 0;"></div>
                        </template>
                        <table><tbody>
                            <tr v-for="(u, ku) in panelLabels.useItems" :key="ku">
                                <td style="text-align:right;">{{ panelLabels[u] }}</td><td> : </td>
                                <td>{{ u==='lng'||u==='lat' ? showLoc[u] : u==='zoom' ? Math.max(0, Math.round(currentZoom*1e5)/1e5) : '' }}</td>
                            </tr>
                        </tbody></table>
                    </div>

                </div>

                <!-- 縮放按鈕 -->
                <div
                    class="clsPanel"
                    :style="{ order: getPanelOrder('panelZoom', corner), padding: '0' }"
                    v-if="panelZoom.show && panelZoom.position===corner"
                >
                    <button class="clsZoomBtn" @click="zoomIn" title="放大">+</button>
                    <div style="border-top:1px solid #ccc;"></div>
                    <button class="clsZoomBtn" @click="zoomOut" title="縮小">−</button>
                </div>

                <!-- 比例尺 -->
                <div
                    class="clsPanel clsScale"
                    :style="{ order: getPanelOrder('panelScale', corner), background: 'rgba(0,0,0,0.6)', color:'#fff' }"
                    v-if="panelScale.show && panelScale.position===corner"
                >
                    <div style="display:flex; align-items:center; gap:4px;">
                        <div style="width:80px; height:3px; background:#fff; border:1px solid #fff;"></div>
                        <span>{{ scaleText }}</span>
                    </div>
                </div>

                <!-- 圖例區（等值線用） -->
                <div
                    class="clsPanel"
                    :style="{ order: getPanelOrder('panelLegends', corner), background: panelBackgroundColor }"
                    v-if="panelLegends.show && countVisible(contourSets)>0 && panelLegends.position===corner"
                >

                    <div
                        :style="{ display:'flex', alignItems:'flex-start', overflow:'auto', ...panelLegends.style }"
                        @wheel="handleWheel($event, panelLegends)"
                    >

                        <div
                            :key="'contourSet:'+kcontourSet"
                            v-for="(contourSet, kcontourSet) in contourSets"
                        >

                            <div
                                style="padding:4px 6px; white-space:nowrap;"
                                v-if="contourSet.visible"
                            >
                                <div style="margin-bottom:5px;">
                                    <div style="text-align:center;" v-html="contourSet.title"></div>
                                    <div style="font-size:0.85rem; text-align:center;" v-html="contourSet.legendMsg"></div>
                                </div>
                                <table style="border-collapse:collapse;">
                                    <tbody>
                                        <tr :key="'klegend:'+klegend" v-for="(legend, klegend) in contourSet.legend">
                                            <td style="height:18px; line-height:18px;" v-if="false">
                                                <span :style="`opacity:${legend.arrow?1:0};`">▶</span>
                                            </td>
                                            <td :style="`background:${legend.color}; width:18px; height:18px;`"></td>
                                            <td style="padding-left:5px;"></td>
                                            <td style="text-align:right; font-size:0.7rem; height:18px; line-height:18px;">
                                                <span v-html="legend.low"></span>
                                            </td>
                                            <td style="padding:0px 2px; text-align:center; font-size:0.7rem; height:18px; line-height:18px;">
                                                <span v-html="legend.delimiter"></span>
                                            </td>
                                            <td style="text-align:left; font-size:0.7rem; height:18px; line-height:18px;">
                                                <span v-html="legend.up"></span>
                                            </td>
                                            <td style="padding-left:3px;" v-if="legend.textExt"></td>
                                            <td style="text-align:left; font-size:0.7rem; height:18px; line-height:18px;" v-if="legend.textExt">
                                                <span v-html="legend.textExt"></span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>

        <!-- 隱藏的 slot 容器：用來承載外部傳入的 popup/tooltip slot 內容 -->
        <div style="display:none;">
            <!-- point popup -->
            <div ref="refPointPopup">
                <div ref="refPointPopupInner">
                    <CmpPopupResizable
                        :resizable="popupResizeCfg.resizable"
                        :resizeModes="popupResizeCfg.resizeModes"
                        :minWidth="popupResizeCfg.minWidth"
                        :minHeight="popupResizeCfg.minHeight"
                        :width="popupResizeCfg.width"
                        :height="popupResizeCfg.height"
                        @resizing-change="onPopupResizingChange"
                    >
                        <slot name="point-popup"
                            :point="activePoint"
                            :pointSet="activePointSet"
                        ></slot>
                    </CmpPopupResizable>
                </div>
            </div>
            <!-- point tooltip -->
            <div ref="refPointTooltip">
                <slot name="point-tooltip"
                    :point="activePointTooltip"
                    :pointSet="activePointSetTooltip"
                ></slot>
            </div>
            <!-- polyline popup -->
            <div ref="refPolylinePopup">
                <div ref="refPolylinePopupInner">
                    <CmpPopupResizable
                        :resizable="popupResizeCfg.resizable"
                        :resizeModes="popupResizeCfg.resizeModes"
                        :minWidth="popupResizeCfg.minWidth"
                        :minHeight="popupResizeCfg.minHeight"
                        :width="popupResizeCfg.width"
                        :height="popupResizeCfg.height"
                        @resizing-change="onPopupResizingChange"
                    >
                        <slot name="polyline-popup"
                            :polylineSet="activePolylineSet"
                            :polylineSets="polylineSets"
                        ></slot>
                    </CmpPopupResizable>
                </div>
            </div>
            <!-- polyline tooltip -->
            <div ref="refPolylineTooltip">
                <slot name="polyline-tooltip"
                    :polylineSet="activePolylineSetTooltip"
                    :polylineSets="polylineSets"
                ></slot>
            </div>
            <!-- polygon popup -->
            <div ref="refPolygonPopup">
                <div ref="refPolygonPopupInner">
                    <CmpPopupResizable
                        :resizable="popupResizeCfg.resizable"
                        :resizeModes="popupResizeCfg.resizeModes"
                        :minWidth="popupResizeCfg.minWidth"
                        :minHeight="popupResizeCfg.minHeight"
                        :width="popupResizeCfg.width"
                        :height="popupResizeCfg.height"
                        @resizing-change="onPopupResizingChange"
                    >
                        <slot name="polygon-popup"
                            :polygonSet="activePolygonSet"
                            :polygonSets="polygonSets"
                        ></slot>
                    </CmpPopupResizable>
                </div>
            </div>
            <!-- polygon tooltip -->
            <div ref="refPolygonTooltip">
                <slot name="polygon-tooltip"
                    :polygonSet="activePolygonSetTooltip"
                    :polygonSets="polygonSets"
                ></slot>
            </div>
            <!-- geojson popup -->
            <div ref="refGeojsonPopup">
                <div ref="refGeojsonPopupInner">
                    <CmpPopupResizable
                        :resizable="popupResizeCfg.resizable"
                        :resizeModes="popupResizeCfg.resizeModes"
                        :minWidth="popupResizeCfg.minWidth"
                        :minHeight="popupResizeCfg.minHeight"
                        :width="popupResizeCfg.width"
                        :height="popupResizeCfg.height"
                        @resizing-change="onPopupResizingChange"
                    >
                        <slot name="geojson-popup"
                            :geojsonSet="activeGeojsonSet"
                            :geojsonSets="geojsonSets"
                        ></slot>
                    </CmpPopupResizable>
                </div>
            </div>
            <!-- geojson tooltip -->
            <div ref="refGeojsonTooltip">
                <slot name="geojson-tooltip"
                    :geojsonSet="activeGeojsonSetTooltip"
                    :geojsonSets="geojsonSets"
                ></slot>
            </div>
            <!-- contour popup -->
            <div ref="refContourPopup">
                <div ref="refContourPopupInner">
                    <CmpPopupResizable
                        :resizable="popupResizeCfg.resizable"
                        :resizeModes="popupResizeCfg.resizeModes"
                        :minWidth="popupResizeCfg.minWidth"
                        :minHeight="popupResizeCfg.minHeight"
                        :width="popupResizeCfg.width"
                        :height="popupResizeCfg.height"
                        @resizing-change="onPopupResizingChange"
                    >
                        <slot name="contour-popup"
                            :contourSet="activeContourSet"
                            :contourSets="contourSets"
                        ></slot>
                    </CmpPopupResizable>
                </div>
            </div>
            <!-- contour tooltip -->
            <div ref="refContourTooltip">
                <slot name="contour-tooltip"
                    :contourSet="activeContourSetTooltip"
                    :contourSets="contourSets"
                ></slot>
            </div>
        </div>

    </div>
</template>

<script>
import map from 'lodash-es/map.js'
import each from 'lodash-es/each.js'
import omit from 'lodash-es/omit.js'
import get from 'lodash-es/get.js'
import set from 'lodash-es/set.js'
import isNumber from 'lodash-es/isNumber.js'
import isEqual from 'lodash-es/isEqual.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import isfun from 'wsemi/src/isfun.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import dig from 'wsemi/src/dig.mjs'
import debounce from 'wsemi/src/debounce.mjs'
import domResize from 'w-component-vue/src/js/domResize.mjs'
import 'maplibre-gl/dist/maplibre-gl.css'
import defBaseMaps from '../js/defBaseMaps.mjs'
import defTerrainMap from '../js/defTerrainMap.mjs'
import uiRes from '../uiRes.mjs'
import { createMap, applyProjection as _applyProjection, applyZoomRange } from '../js/mapCore.mjs'
import { applyBaseMaps, preloadBaseMapStyles, applyTerrain, switchBaseMap as _switchBaseMap, toggleOverlayVisible as _toggleOverlayVisible, setOverlayOpacity as _setOverlayOpacity, getBaseMapOpacity, updateBaseMapPaint, isBaseMapsPaintOnlyDiff, isBaseMapsStructuralDiff, updateBaseMapsIncremental } from '../js/basemapManager.mjs'
import { computeBasicOpt, computePanelBaseMaps, computePanelCompassRose, computePanelCompass3d, computePanelLabels, computePanelItems, computePanelZoom, computePanelScale, computePanelLegends, computeClusterOpts } from '../js/configProcessor.mjs'
import { clearTrackedByPrefix, buildItemsList, countVisible } from '../js/layerVisibility.mjs'
import { createDirectionalPopup, recheckSinglePopupDir, registerIconImage } from '../js/popupManager.mjs'
import { renderPointSets as renderPointSetsImpl, renderPolylineSets as renderPolylineSetsImpl, renderPolygonSets as renderPolygonSetsImpl, renderGeojsonSets as renderGeojsonSetsImpl, renderImageSets as renderImageSetsImpl, renderContourSets as renderContourSetsImpl } from '../js/layerRenderers.mjs'
import { getMapObject as _getMapObject, calcPanToCenter, findPointById, resolveFeatureById } from '../js/publicApi.mjs'
import CmpPopupResizable from './CmpPopupResizable.vue'


const defPanelsOrder = ['panelBaseMaps', 'panelLabels', 'panelScale', 'panelCompassRose', 'panelCompass3d', 'panelZoom', 'panelItems', 'panelLegends']


/**
 * 深度凍結「大量座標」欄位（points / latLngs），使 Vue 2 observe 直接跳過該子樹
 * Vue 2 之 observe() 對 !Object.isExtensible 者不遞迴、不掛 getter/setter，
 * 萬點級資料存入 reactive data 之深走訪成本(數百 ms)因此免除。
 *
 * 僅可用於「套件內外皆唯讀」之座標欄位:
 *   - 組物件本身不可凍結: syncSetsVisible / toggleItemVisible / modifyItemsVisible 會回寫 visible
 *   - contourSets 不可凍結: renderContourSets 會回寫 cs.legend
 * 座標欄位來源為 processSetsChange 內 cloneDeep 之私有副本, 凍結不影響呼叫端原資料。
 */
function freezeCoordField(v) {
    if (isarr(v)) {
        for (let i = 0; i < v.length; i++) freezeCoordField(v[i])
        return Object.freeze(v)
    }
    if (isobj(v)) {
        let ks = Object.keys(v)
        for (let i = 0; i < ks.length; i++) freezeCoordField(v[ks[i]])
        return Object.freeze(v)
    }
    return v //數值/字串/函數等原生值不處理
}


/**
 * WMaplibreglVue2 - 使用 MapLibre GL JS 重構的地圖組件（Vue 2）
 * 所有面板透過四角容器 (corner container) 自動堆疊，不重疊。
 *
 * 核心業務邏輯已提取至 src/js/ 模組，此元件僅保留：
 *   - 響應式狀態（data / computed / watch）
 *   - 薄委派方法（調用模組函式 + 同步 Vue 狀態）
 *   - Vue 特定操作（$nextTick / $refs / $forceUpdate）
 *
 * @vue-prop {Object} opt 輸入資料設定物件
 * @vue-prop {Array} [opt.center=[23.5, 121.1]] 輸入地圖顯示中點陣列，陣列為WGS84[緯度,經度]，兩值皆須為有限數(數字字串視為非法)且緯度在±90內，否則視為未給(用預設)，預設[23.5, 121.1]
 * @vue-prop {Number} [opt.zoom=6] 輸入地圖顯示層級數字，可給數字或數字字串，非數值視為未給(用預設6)，範圍由opt.minZoom與opt.maxZoom決定(元件不另夾值)，超出範圍者由地圖拉入範圍，使用者縮放、縮放按鈕或API縮放後會把地圖實際層級寫回本欄位(地球投影下實際下限隨緯度略低於minZoom，墨卡托投影下受容器高度限制而略高於minZoom，皆以實際層級為準；地球投影下僅改center時地圖亦會依緯度差調整層級並寫回本欄位)，欲於執行期變更或接收寫回須於opt預先宣告此鍵，預設6
 * @vue-prop {Number} [opt.minZoom=0] 輸入地圖可縮小至之最小顯示層級數字，使用者縮放、縮放按鈕、opt.zoom與API皆受此限制，可給數字或數字字串，夾在0~24，非數值或非有限數視為未給，大於maxZoom時忽略minZoom並console.warn，可於執行期變更(須於opt預先宣告此鍵)，預設0
 * @vue-prop {Number} [opt.maxZoom=22] 輸入地圖可放大至之最大顯示層級數字，給法同minZoom(夾在0~24)，可於執行期變更(須於opt預先宣告此鍵)，預設22；此為地圖顯示層級上限，與圖磚層級不同(256px圖磚於地圖層級z約請求z+1級)，各底圖服務之層級上限請以baseMaps[i].maxzoom設定(超過時改以該級圖磚放大顯示)，勿以本欄位遷就單一圖資；欲還原舊版上限18可給18
 * @vue-prop {String} [opt.panelBackgroundColor='rgba(255,255,255,0.95)'] 輸入各顯示資訊區背景顏色字串，預設'rgba(255,255,255,0.95)'
 * @vue-prop {String} [opt.projection=''] 輸入地圖投影方式字串，''代表自動(顯示層級≤8用球面globe、以上用平面mercator)，可選'globe'、'mercator'，預設''
 * @vue-prop {Boolean} [opt.displayPopupOnlyone=true] 輸入是否同時只顯示一個popup布林值，開啟時點擊新圖徵會關閉其他已開的popup，預設true
 * @vue-prop {Boolean} [opt.displayOrderByType=true] 輸入是否依圖徵型別面積序堆疊布林值，開啟時圖層由上而下為點>線>面>等值線>影像，且點擊命中最上層型別(小面積優先)，預設true
 * @vue-prop {String} [opt.popupPosition='top'] 輸入popup預設彈出方向字串，可選'top'、'bottom'、'left'、'right'，靠近地圖邊緣時會自動翻轉，預設'top'
 * @vue-prop {String} [opt.tooltipPosition='left'] 輸入tooltip預設彈出方向字串，可選'top'、'bottom'、'left'、'right'，預設'left'
 * @vue-prop {Array} [opt.panelsOrder=詳見程式碼] 輸入各角落內面板的堆疊順序陣列，預設值詳見程式碼的defPanelsOrder
 * @vue-prop {Object} [opt.popupResize={}] 輸入popup可拖曳調整大小的設定物件，預設{}
 * @vue-prop {Boolean} [opt.popupResize.resizable=false] 輸入是否開啟popup四邊/四角拖曳調整大小布林值，false時為純穿透、行為與未啟用一致，預設false
 * @vue-prop {Array} [opt.popupResize.resizeModes=詳見程式碼] 輸入可拖曳的把手方向陣列，元素可為'top'、'bottom'、'left'、'right'、'top-left'、'top-right'、'bottom-left'、'bottom-right'，預設為八向全開
 * @vue-prop {Number} [opt.popupResize.minWidth=200] 輸入popup可調整的最小寬度數字，單位px，預設200
 * @vue-prop {Number} [opt.popupResize.minHeight=200] 輸入popup可調整的最小高度數字，單位px，預設200
 * @vue-prop {Number} [opt.popupResize.width=400] 輸入popup初始寬度數字，單位px，預設400
 * @vue-prop {Number} [opt.popupResize.height=300] 輸入popup初始高度數字，單位px，預設300
 * @vue-prop {Boolean} [opt.clusterPoints=false] 輸入是否啟用點叢集布林值，預設false
 * @vue-prop {Number} [opt.clusterPointsRadius=50] 輸入點叢集半徑數字，單位px，預設50
 * @vue-prop {Number} [opt.clusterPointsMaxZoom=14] 輸入點叢集套用的最大顯示層級數字，預設14
 * @vue-prop {Number} [opt.clusterPointsLevelNum=3] 輸入點叢集分級數量數字(需≥1)，預設3
 * @vue-prop {Array} [opt.clusterPointsLevelValues=[10,100]] 輸入點叢集各級的點數門檻陣列，長度需為分級數量-1，預設[10,100]
 * @vue-prop {Array} [opt.clusterPointsLevelRadius=[10,15,20]] 輸入點叢集各級的圓半徑陣列，單位px，長度需為分級數量，預設[10,15,20]
 * @vue-prop {Array} [opt.clusterPointsLevelFillColors=詳見程式碼] 輸入點叢集各級的填充顏色陣列，長度需為分級數量，預設值詳見程式碼
 * @vue-prop {Array} [opt.clusterPointsLevelLineColors=['#fff','#fff','#fff']] 輸入點叢集各級的框線顏色陣列，預設['#fff','#fff','#fff']
 * @vue-prop {Array} [opt.clusterPointsLevelLineWidths=[2,2,2]] 輸入點叢集各級的框線寬度陣列，單位px，預設[2,2,2]
 * @vue-prop {Array} [opt.clusterPointsLevelTextSizes=[12,12,12]] 輸入點叢集各級的計數文字大小陣列，單位px，預設[12,12,12]
 * @vue-prop {Array} [opt.clusterPointsLevelTextColors=['#fff','#fff','#fff']] 輸入點叢集各級的計數文字顏色陣列，預設['#fff','#fff','#fff']
 * @vue-prop {Boolean} [opt.panelBaseMaps.show=true] 輸入是否顯示底圖選擇區布林值，預設true
 * @vue-prop {Array} [opt.panelBaseMaps.baseMaps=詳見程式碼] 輸入底圖選擇清單陣列，各元素為底圖設定物件(欄位見下)，預設值詳見程式碼的defBaseMaps
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].name=詳見程式碼] 輸入第i個底圖的名稱字串，供面板清單顯示
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].url=詳見程式碼] 輸入第i個底圖的連結字串，依type而異：raster為圖磚網址樣板，支援{s}(子網域a/b/c)、{z}/{x}/{y}、//(自動補https)，maplibre原生之{quadkey}、{bbox-epsg-3857}等佔位符原樣支援；wms為服務端點(自動附加GetMap參數)；vector為TileJSON網址(支援//自動補https，不支援圖磚樣板與{s})；style為MapLibre style JSON網址。url非有效字串之條目會被略過(console.warn)且不影響其他條目
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].type=raster] 輸入第i個底圖的來源類型字串，省略代表raster圖磚，可為'wms'、'vector'、'style'(url指向完整MapLibre style JSON，整組sources/layers注入現有地圖，glyphs/sprite為全域單例由最後套用者決定)，預設raster
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].colorShade=''] 輸入第i個底圖的色調字串，非空(如'light'/'dark')代表底圖(radio單選)，空字串''代表疊加層(checkbox多選並有透明度滑桿)，預設''
 * @vue-prop {Boolean} [opt.panelBaseMaps.baseMaps[i].visible=false] 輸入是否顯示第i個底圖布林值，預設false
 * @vue-prop {Number} [opt.panelBaseMaps.baseMaps[i].opacity=1] 輸入第i個底圖的透明度數字(0~1)，可給數字或數字字串，超出範圍夾限、非數值視為未給，raster與wms預設1、vector預設0.8(疊加層面板滑桿與實繪一致)，type為'style'時不支援(各層自帶opacity，面板亦不顯示滑桿)
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].layerType='fill'] 輸入第i個底圖(type為vector時)的圖層類型字串，可選'fill'、'line'、'fill-extrusion'，預設'fill'
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].layer=''] 輸入第i個底圖(type為vector時)的source-layer名稱字串，預設''
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].layers=''] 輸入第i個底圖(type為wms時)的LAYERS參數字串，預設''
 * @vue-prop {Number} [opt.panelBaseMaps.baseMaps[i].maxzoom=null] 輸入第i個底圖(type為raster、wms、vector時)的圖磚來源最大層級整數，即服務實際提供圖磚之最深「圖磚層級」(非地圖顯示層級：256px圖磚於地圖層級z時約請求z+1級)，超過時改以該級圖磚放大顯示，避免請求不存在之層級致圖層空白並報錯，圖台可放大至opt.maxZoom(預設22，此時請求之圖磚層級可達23)，故服務層級未達該值之圖磚服務須給本欄位，可給數字或數字字串，小數無條件捨去，負數、非有限數或非數值視為未給，不給則沿用maplibre預設(raster與wms為22，vector依其TileJSON)，vector僅宜往內限縮TileJSON之範圍(大於TileJSON者會請求不存在之層級)，type為'style'時不適用(由style JSON自帶)，預設null
 * @vue-prop {Number} [opt.panelBaseMaps.baseMaps[i].minzoom=null] 輸入第i個底圖(type為raster、wms、vector時)的圖磚來源最小層級整數，需求之圖磚層級低於此值時不請求圖磚且該處不顯示(地圖俯視或開啟地形時，遠景低於此層級之區域亦不顯示)，給法同maxzoom但小數無條件進位，須不大於服務最大層級，與maxzoom同時給且大於maxzoom時忽略minzoom，不給則沿用maplibre預設(raster與wms為0，vector依其TileJSON)，type為'style'時不適用，預設null
 * @vue-prop {String} [opt.panelBaseMaps.baseMaps[i].colorFillExtrusion=null] 輸入第i個底圖(layerType為fill-extrusion時)的統一建物顏色字串，不傳則回退用資料colour屬性，預設null
 * @vue-prop {String} [opt.panelBaseMaps.position='topleft'] 輸入底圖選擇區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'topleft'
 * @vue-prop {Number} [opt.panelBaseMaps.width=null] 輸入底圖選擇區寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelBaseMaps.maxWidth=null] 輸入底圖選擇區最大寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelBaseMaps.height=null] 輸入底圖選擇區高度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelBaseMaps.maxHeight=null] 輸入底圖選擇區最大高度數字，單位px，預設null
 * @vue-prop {Boolean} [opt.panelBaseMaps.stopWheel=false] 輸入底圖選擇區當過高出現垂直捲軸時，是否可接收捲軸布林值，預設false
 * @vue-prop {Object} [opt.panelBaseMaps.terrainMap=詳見程式碼] 輸入3D地形設定物件，不給則使用程式碼的defTerrainMap(遠端DEM)，給物件即整組取代預設(未給之欄位不繼承預設，例如只給exaggeration則無地形)，給{}則不套用地形，預設值詳見程式碼的defTerrainMap
 * @vue-prop {String} [opt.panelBaseMaps.terrainMap.terrainSource.url] 輸入地形DEM圖磚網址樣板字串，支援{z}/{x}/{y}、//(自動補https)，未給則不套用地形(陰影亦不套用)
 * @vue-prop {String} [opt.panelBaseMaps.terrainMap.terrainSource.encoding='terrarium'] 輸入地形DEM編碼字串，可選'terrarium'、'mapbox'，預設'terrarium'
 * @vue-prop {Number} [opt.panelBaseMaps.terrainMap.terrainSource.tileSize=256] 輸入地形DEM圖磚尺寸數字，單位px，預設256
 * @vue-prop {Number} [opt.panelBaseMaps.terrainMap.terrainSource.maxzoom=null] 輸入地形DEM圖磚來源最大層級整數，給法同baseMaps[i].maxzoom，預設null(defTerrainMap給13)
 * @vue-prop {Number} [opt.panelBaseMaps.terrainMap.exaggeration=1.5] 輸入地形高度誇張倍率數字，預設1.5
 * @vue-prop {Object} [opt.panelBaseMaps.terrainMap.hillshadeSource=null] 輸入陰影DEM來源設定物件，欄位同terrainSource(url、encoding、tileSize、maxzoom)，須同時給有效之terrainSource才生效，url與terrainSource.url相同時共用地形來源(encoding、tileSize、maxzoom以terrainSource為準)，不給則不顯示陰影，預設null
 * @vue-prop {Number} [opt.panelBaseMaps.terrainMap.hillshadeExaggeration=0.5] 輸入陰影強度數字，預設0.5
 * @vue-prop {Boolean} [opt.panelLabels.show=true] 輸入是否顯示地圖資訊區布林值，預設true
 * @vue-prop {String} [opt.panelLabels.position='topright'] 輸入地圖資訊區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'topright'
 * @vue-prop {String} [opt.panelLabels.title=''] 輸入地圖資訊區內標題字串，預設''
 * @vue-prop {String} [opt.panelLabels.lng='Longitude'] 輸入地圖資訊區內標注經度字串，預設'Longitude'
 * @vue-prop {String} [opt.panelLabels.lat='Latitude'] 輸入地圖資訊區內標注緯度字串，預設'Latitude'
 * @vue-prop {String} [opt.panelLabels.zoom='Zoom'] 輸入地圖資訊區內標注顯示層級字串，預設'Zoom'
 * @vue-prop {Array} [opt.panelLabels.useItems=['lng','lat','zoom']] 輸入地圖資訊區內呈現項目陣列，各元素給字串，'lng'代表經度，'lat'代表緯度，'zoom'代表顯示層級，預設['lng','lat','zoom']
 * @vue-prop {Number} [opt.panelLabels.width=null] 輸入地圖資訊區寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelLabels.maxWidth=null] 輸入地圖資訊區最大寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelLabels.height=null] 輸入地圖資訊區高度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelLabels.maxHeight=null] 輸入地圖資訊區最大高度數字，單位px，預設null
 * @vue-prop {Boolean} [opt.panelCompassRose.show=false] 輸入是否顯示玫瑰羅盤區布林值，預設false
 * @vue-prop {String} [opt.panelCompassRose.position='topright'] 輸入玫瑰羅盤區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'topright'
 * @vue-prop {Number} [opt.panelCompassRose.size=120] 輸入玫瑰羅盤區尺寸(長寬)數字，單位px，預設120
 * @vue-prop {Boolean} [opt.panelCompassRose.withPanel=false] 輸入是否顯示玫瑰羅盤區底部面板布林值，預設false
 * @vue-prop {String} [opt.panelCompassRose.iconSrcLight=詳見程式碼] 輸入淺色系玫瑰羅盤圖標來源字串，可使用base64格式或網址，預設值詳見程式碼
 * @vue-prop {String} [opt.panelCompassRose.iconSrcDark=詳見程式碼] 輸入深色系玫瑰羅盤圖標來源字串，可使用base64格式或網址，預設值詳見程式碼
 * @vue-prop {String} [opt.panelCompassRose.iconSrc=null] 輸入玫瑰羅盤圖標來源字串，若有則直接使用；若為null則withPanel為true時用iconSrcDark，否則自動依底圖colorShade決定(空或'light'用iconSrcDark，'dark'用iconSrcLight)，預設null
 * @vue-prop {Boolean} [opt.panelCompass3d.show=true] 輸入是否顯示3D指北針區布林值(可點擊重設正北/俯仰)，預設true
 * @vue-prop {String} [opt.panelCompass3d.position='topright'] 輸入3D指北針區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'topright'
 * @vue-prop {Number} [opt.panelCompass3d.size=44] 輸入3D指北針尺寸數字，單位px，預設44
 * @vue-prop {Boolean} [opt.panelZoom.show=true] 輸入是否顯示縮放按鈕區布林值，預設true
 * @vue-prop {String} [opt.panelZoom.position='bottomleft'] 輸入縮放按鈕區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'bottomleft'
 * @vue-prop {Boolean} [opt.panelScale.show=true] 輸入是否顯示比例尺區布林值，預設true
 * @vue-prop {String} [opt.panelScale.position='bottomright'] 輸入比例尺區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'bottomright'
 * @vue-prop {Boolean} [opt.panelItems.show=true] 輸入圖層顯隱切換區是否顯示布林值，預設true
 * @vue-prop {String} [opt.panelItems.position='topleft'] 輸入圖層顯隱切換區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'topleft'
 * @vue-prop {Number} [opt.panelItems.width=null] 輸入圖層顯隱切換區寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelItems.maxWidth=null] 輸入圖層顯隱切換區最大寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelItems.height=null] 輸入圖層顯隱切換區高度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelItems.maxHeight=null] 輸入圖層顯隱切換區最大高度數字，單位px，預設null
 * @vue-prop {Boolean} [opt.panelItems.stopWheel=false] 輸入圖層顯隱切換區當過高出現垂直捲軸時，是否可接收捲軸布林值，預設false
 * @vue-prop {Boolean} [opt.panelLegends.show=true] 輸入是否顯示圖例區布林值(僅有可見等值線時呈現)，預設true
 * @vue-prop {String} [opt.panelLegends.position='bottomright'] 輸入圖例區位置字串，可選'topleft'、'topright'、'bottomleft'、'bottomright'，預設'bottomright'
 * @vue-prop {Number} [opt.panelLegends.width=null] 輸入圖例區寬度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelLegends.maxWidth=300] 輸入圖例區最大寬度數字，單位px，預設300
 * @vue-prop {Number} [opt.panelLegends.height=null] 輸入圖例區高度數字，單位px，預設null
 * @vue-prop {Number} [opt.panelLegends.maxHeight=null] 輸入圖例區最大高度數字，單位px，預設null
 * @vue-prop {Array} [opt.pointSets=[]] 輸入點集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.pointSets[i].title=''] 輸入第i個點集合的標題字串，預設''
 * @vue-prop {String} [opt.pointSets[i].msg=''] 輸入第i個點集合的說明字串，預設''
 * @vue-prop {String} [opt.pointSets[i].key=null] 輸入第i個點集合的穩定識別鍵字串，需於陣列內唯一；提供後陣列插入或重排時該組身分不變(未變更組可增量跳過不重建)，未給則以陣列索引識別，預設null
 * @vue-prop {Number} [opt.pointSets[i].order=null] 輸入第i個點集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.pointSets[i].visible=true] 輸入是否顯示第i個點集合布林值，預設true
 * @vue-prop {String} [opt.pointSets[i].type='circle'] 輸入第i個點集合的預設呈現類型字串，可選'circle'(圓)、'icon'(圖標)，預設'circle'
 * @vue-prop {String} [opt.pointSets[i].lineColor='rgba(255,255,255,1)'] 輸入第i個點集合(circle)的框線顏色字串，預設'rgba(255,255,255,1)'
 * @vue-prop {Number} [opt.pointSets[i].lineWidth=1] 輸入第i個點集合(circle)的框線寬度數字，預設1
 * @vue-prop {String} [opt.pointSets[i].fillColor='rgba(0,150,255,0.65)'] 輸入第i個點集合(circle)的填充顏色字串，預設'rgba(0,150,255,0.65)'
 * @vue-prop {Number} [opt.pointSets[i].size=10] 輸入第i個點集合(circle)的圓半徑數字，預設10
 * @vue-prop {String} [opt.pointSets[i].iconSrc=詳見程式碼] 輸入第i個點集合(icon)的圖標來源字串，可使用base64格式或網址，預設為內建點圖標，詳見程式碼
 * @vue-prop {Array} [opt.pointSets[i].iconSize=[24,40]] 輸入第i個點集合(icon)的圖標尺寸陣列[寬,高]，單位px，預設[24,40]
 * @vue-prop {Array} [opt.pointSets[i].iconAnchor=[iconSize[0]/2,iconSize[1]]] 輸入第i個點集合(icon)的圖標定位位置陣列，由圖標左上角起算，往左為+x、往上為+y，單位px，預設[iconSize[0]/2,iconSize[1]]
 * @vue-prop {Array} [opt.pointSets[i].popupAnchor=[0,-iconSize[1]/1.0]] 輸入第i個點集合顯示popup時的指向偏移陣列[x,y]，由實際定位點起算，往右為+x、往下為+y，單位px，未給時自動依半徑或iconSize計算
 * @vue-prop {Array} [opt.pointSets[i].tooltipAnchor=[0,-iconSize[1]/1.0]] 輸入第i個點集合顯示tooltip時的指向偏移陣列[x,y]，未給時自動依半徑或iconSize計算
 * @vue-prop {Array} [opt.pointSets[i].points=[]] 輸入第i個點集合的各點數據陣列，各元素為物件或緯經度陣列(即[{p1},...]或[[lat,lng],...])，預設[]
 * @vue-prop {Array} [opt.pointSets[i].points[j].latLng=[]] 輸入第i個點集合第j個點的緯經度座標陣列[lat,lng]，預設[]
 * @vue-prop {String} [opt.pointSets[i].points[j].title=''] 輸入第i個點集合第j個點的標題字串，預設''
 * @vue-prop {String} [opt.pointSets[i].points[j].msg=''] 輸入第i個點集合第j個點的說明字串，預設''
 * @vue-prop {String} [opt.pointSets[i].points[j].type=繼承pointSet] 輸入第i個點集合第j個點的呈現類型字串，可選'circle'、'icon'，未給則繼承所屬點集合
 * @vue-prop {String} [opt.pointSets[i].points[j].lineColor=繼承pointSet] 輸入第i個點集合第j個點的框線顏色字串，未給則繼承所屬點集合
 * @vue-prop {Number} [opt.pointSets[i].points[j].lineWidth=繼承pointSet] 輸入第i個點集合第j個點的框線寬度數字，未給則繼承所屬點集合
 * @vue-prop {String} [opt.pointSets[i].points[j].fillColor=繼承pointSet] 輸入第i個點集合第j個點的填充顏色字串，未給則繼承所屬點集合
 * @vue-prop {Number} [opt.pointSets[i].points[j].size=繼承pointSet] 輸入第i個點集合第j個點的圓半徑數字，未給則繼承所屬點集合
 * @vue-prop {String} [opt.pointSets[i].points[j].iconSrc=繼承pointSet] 輸入第i個點集合第j個點的圖標來源字串，未給則繼承所屬點集合
 * @vue-prop {Array} [opt.pointSets[i].points[j].iconSize=繼承pointSet] 輸入第i個點集合第j個點的圖標尺寸陣列[寬,高]，未給則繼承所屬點集合
 * @vue-prop {Array} [opt.pointSets[i].points[j].iconAnchor=繼承pointSet] 輸入第i個點集合第j個點的圖標定位位置陣列，未給則繼承所屬點集合
 * @vue-prop {Array} [opt.pointSets[i].points[j].popupAnchor=null] 輸入第i個點集合第j個點顯示popup時的指向偏移陣列[x,y]，預設null
 * @vue-prop {Array} [opt.pointSets[i].points[j].tooltipAnchor=null] 輸入第i個點集合第j個點顯示tooltip時的指向偏移陣列[x,y]，預設null
 * @vue-prop {Function} [opt.pointSetsClick=function(){}] 輸入全域點集合的click呼叫函數，引數為{ point, pointSet, pointSets }，預設function(){}
 * @vue-prop {Array} [opt.polylineSets=[]] 輸入折線集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.polylineSets[i].title=''] 輸入第i個折線集合的標題字串，預設''
 * @vue-prop {String} [opt.polylineSets[i].msg=''] 輸入第i個折線集合的說明字串，預設''
 * @vue-prop {Number} [opt.polylineSets[i].order=null] 輸入第i個折線集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.polylineSets[i].visible=true] 輸入是否顯示第i個折線集合布林值，預設true
 * @vue-prop {String} [opt.polylineSets[i].lineColor='rgba(0,150,255,1)'] 輸入第i個折線集合的框線顏色字串，預設'rgba(0,150,255,1)'
 * @vue-prop {Number} [opt.polylineSets[i].lineWidth=3] 輸入第i個折線集合的框線寬度數字，預設3
 * @vue-prop {Array} [opt.polylineSets[i].latLngs=[]] 輸入第i個折線集合的數據陣列，可為polyline([[lat,lng],...])或multiPolyline，各點座標為緯經度，預設[]
 * @vue-prop {Function} [opt.polylineSetsClick=function(){}] 輸入全域折線集合的click呼叫函數，引數為{ ev, polylineSet, kpolylineSet, polylineSets }，預設function(){}
 * @vue-prop {Array} [opt.polygonSets=[]] 輸入多邊形集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.polygonSets[i].title=''] 輸入第i個多邊形集合的標題字串，預設''
 * @vue-prop {String} [opt.polygonSets[i].msg=''] 輸入第i個多邊形集合的說明字串，預設''
 * @vue-prop {Number} [opt.polygonSets[i].order=null] 輸入第i個多邊形集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.polygonSets[i].visible=true] 輸入是否顯示第i個多邊形集合布林值，預設true
 * @vue-prop {String} [opt.polygonSets[i].lineColor='rgba(0,150,255,1)'] 輸入第i個多邊形集合的框線顏色字串，預設'rgba(0,150,255,1)'
 * @vue-prop {Number} [opt.polygonSets[i].lineWidth=3] 輸入第i個多邊形集合的框線寬度數字，預設3
 * @vue-prop {String} [opt.polygonSets[i].fillColor='rgba(0,150,255,0.25)'] 輸入第i個多邊形集合的填充顏色字串，預設'rgba(0,150,255,0.25)'
 * @vue-prop {Array} [opt.polygonSets[i].latLngs=[]] 輸入第i個多邊形集合的數據陣列，各點座標為緯經度，預設[]。可為單一環([[lat,lng],...])、環陣列([[[lat,lng],...],...]，代表1個polygon，環間為XOR套疊可表示挖洞)、或polygon陣列([[[[lat,lng],...],...],...]，代表1個multiPolygon，各polygon之環各自XOR後合併)
 * @vue-prop {Function} [opt.polygonSetsClick=function(){}] 輸入全域多邊形集合的click呼叫函數，引數為{ ev, polygonSet, kpolygonSet, polygonSets }，預設function(){}
 * @vue-prop {Array} [opt.geojsonSets=[]] 輸入geojson集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.geojsonSets[i].title=''] 輸入第i個geojson集合的標題字串，預設''
 * @vue-prop {String} [opt.geojsonSets[i].msg=''] 輸入第i個geojson集合的說明字串，預設''
 * @vue-prop {Number} [opt.geojsonSets[i].order=null] 輸入第i個geojson集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.geojsonSets[i].visible=true] 輸入是否顯示第i個geojson集合布林值，預設true
 * @vue-prop {String} [opt.geojsonSets[i].lineColor='rgba(0,150,255,1)'] 輸入第i個geojson集合的框線顏色字串，預設'rgba(0,150,255,1)'
 * @vue-prop {Number} [opt.geojsonSets[i].lineWidth=3] 輸入第i個geojson集合的框線寬度數字，預設3
 * @vue-prop {String} [opt.geojsonSets[i].fillColor='rgba(0,150,255,0.25)'] 輸入第i個geojson集合的填充顏色字串，預設'rgba(0,150,255,0.25)'
 * @vue-prop {Object} [opt.geojsonSets[i].geojson={}] 輸入第i個geojson集合的GeoJSON物件(自動拆成點/線/面子圖層)，各點座標為緯經度，預設{}
 * @vue-prop {Function} [opt.geojsonSetsClick=function(){}] 輸入全域geojson集合的click呼叫函數，引數為{ ev, lat, lng, geojsonSet, kgeojsonSet, geojsonSets }，預設function(){}
 * @vue-prop {Array} [opt.contourSets=[]] 輸入等值線集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.contourSets[i].title=''] 輸入第i個等值線集合的標題字串(圖例與圖層清單顯示用)，預設''
 * @vue-prop {String} [opt.contourSets[i].msg=''] 輸入第i個等值線集合的說明字串，預設''
 * @vue-prop {String} [opt.contourSets[i].legendMsg=''] 輸入第i個等值線集合的圖例副標題字串，預設''
 * @vue-prop {Number} [opt.contourSets[i].order=null] 輸入第i個等值線集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.contourSets[i].visible=true] 輸入是否顯示第i個等值線集合布林值，預設true
 * @vue-prop {Array} [opt.contourSets[i].points=[]] 輸入第i個等值線集合的數據陣列，各點座標為緯經度，自動以三角網格技術計算等值線，預設[]
 * @vue-prop {Array} [opt.contourSets[i].thresholds=[]] 輸入第i個等值線集合的門檻值陣列，給予非有效陣列則自動計算各線門檻值，預設[]
 * @vue-prop {Object} [opt.contourSets[i].gradient=詳見程式碼] 輸入第i個等值線集合的色階(color map)設定物件，鍵範圍0至1、值為對應顏色，各鍵之間採內插取色，預設值詳見程式碼
 * @vue-prop {Function} [opt.contourSets[i].getColor=null] 輸入第i個等值線集合的顏色函數，引數為{ defaultColor, k, n, polygonSet }，預設null
 * @vue-prop {String} [opt.contourSets[i].lineColor=''] 輸入第i個等值線集合的框線顏色字串，''則用填充顏色，預設''
 * @vue-prop {Number} [opt.contourSets[i].lineWidth=1] 輸入第i個等值線集合的框線寬度數字，預設1
 * @vue-prop {Number} [opt.contourSets[i].fillOpacity=0.2] 輸入第i個等值線集合的填充透明度數字，預設0.2
 * @vue-prop {String} [opt.contourSets[i].lineColorHover=同lineColor] 輸入滑鼠移入時第i個等值線集合的框線顏色字串，預設同lineColor
 * @vue-prop {Number} [opt.contourSets[i].lineWidthHover=3] 輸入滑鼠移入時第i個等值線集合的框線寬度數字，預設3
 * @vue-prop {Number} [opt.contourSets[i].fillOpacityHover=0.5] 輸入滑鼠移入時第i個等值線集合的填充透明度數字，預設0.5
 * @vue-prop {Boolean} [opt.contourSets[i].changeStyleWhenHover=true] 輸入第i個等值線集合是否啟用滑鼠移入切換style效果布林值，預設true
 * @vue-prop {Number} [opt.contourSets[i].legendNumDig=null] 輸入第i個等值線集合對圖例內數字取的小數位數，null代表不取，預設null
 * @vue-prop {Function} [opt.contourSets[i].legendTextFormater=null] 輸入第i個等值線集合對圖例各色階產生顯示文字的函數，引數為{ low, up, legends, index }，預設null
 * @vue-prop {Function} [opt.contourSets[i].legendTextExtra=null] 輸入第i個等值線集合對圖例各色階附加額外文字的函數，引數為{ k, n, polygonSet }，預設null
 * @vue-prop {Array} [opt.contourSets[i].polygonClipOuter=null] 輸入第i個等值線集合剔除以外之多邊形(polygon)陣列，預設null
 * @vue-prop {Array} [opt.contourSets[i].polygonsClipInner=null] 輸入第i個等值線集合剔除以內之複數多邊形(multiPolygon)陣列，預設null
 * @vue-prop {Array} [opt.contourSets[i].polygonsContainInner=null] 輸入第i個等值線集合保留以內之複數多邊形(multiPolygon)陣列，預設null
 * @vue-prop {Function} [opt.contourSetsClick=function(){}] 輸入全域等值線集合的click呼叫函數，引數為{ ev, lat, lng, latLngs, polygonSet, kpolygonSet, contourSet, kcontourSet, contourSets }，預設function(){}
 * @vue-prop {Array} [opt.imageSets=[]] 輸入影像集合陣列，各元素為物件，預設[]
 * @vue-prop {String} [opt.imageSets[i].title=''] 輸入第i個影像集合的標題字串，預設''
 * @vue-prop {String} [opt.imageSets[i].msg=''] 輸入第i個影像集合的說明字串，預設''
 * @vue-prop {String} [opt.imageSets[i].key=null] 輸入第i個影像集合的穩定識別鍵字串，需於陣列內唯一；提供後陣列插入或重排時該組身分不變(未變更組不重載影像)，未給則以陣列索引識別，預設null
 * @vue-prop {Number} [opt.imageSets[i].order=null] 輸入第i個影像集合的排序用數字，預設null
 * @vue-prop {Boolean} [opt.imageSets[i].visible=false] 輸入是否顯示第i個影像集合布林值，預設false
 * @vue-prop {Object} [opt.imageSets[i].image={}] 輸入第i個影像集合的影像來源物件，含url(影像連結字串)與lngMin/lngMax/latMin/latMax(四至經緯度數字)，預設{}。四至以實際數值判定東西南北(較大緯度即為北邊)，不依欄位命名方向，故latMin填北緯之像素列慣例亦可正確貼合不致上下顛倒
 * @vue-prop {Number} [opt.imageSets[i].opacity=1] 輸入第i個影像集合的透明度數字，範圍0~1，超出範圍將夾限，預設1
 */
export default {
    directives: {
        domresize: domResize(),
    },
    components: {
        CmpPopupResizable,
    },
    props: {
        opt: {
            type: Object,
            default: () => ({}),
        },
    },
    data() {
        return {

            loading: true,

            map: null,
            corners: ['topleft', 'topright', 'bottomleft', 'bottomright'],

            // debounce
            dbcChangePointSets: debounce(),
            dbcChangePolylineSets: debounce(),
            dbcChangePolygonSets: debounce(),
            dbcChangeGeojsonSets: debounce(),
            dbcChangeContourSets: debounce(),
            dbcChangeImageSets: debounce(),
            dbcChangeItems: debounce(),

            wats: [],
            currentZoom: 7,
            currentCenter: [23.5, 121.1],
            currentPitch: 0,
            currentBearing: 0,
            zoomRange: null, //地圖現行縮放範圍 { minZoom, maxZoom }(建圖後由地圖讀取, 與 opt 比對以判斷是否需執行期變更)
            zoomWarnKey: '', //minZoom 被忽略(大於 maxZoom)之警告去重鍵(輸入組合), ''=無需警告
            holdWriteBack: false, //範圍變更期間護欄: zoomend/moveend 不回寫 opt(R12)
            panTarget: null, //元件發起、尚未結束之平移動畫目標([lat,lng]); 動畫中又要改 zoom 時連同落定, 否則 jumpTo/setZoom 之 stop() 會把動畫中途點寫回 opt.center(R12)
            mapLoaded: false,
            projection: '',
            panelsOrder: [...defPanelsOrder],
            terrainMap: null,
            terrainMapTemp: null,

            // 面板設定
            panelBackgroundColor: 'rgba(255,255,255,0.95)',
            panelBaseMaps: { show: true, position: 'topleft', baseMaps: [], style: {}, stopWheel: false },
            panelBaseMapsTemp: {},
            panelCompassRose: { show: false, position: 'topright', size: 120, withPanel: false, iconSrc: null, iconSrcLight: uiRes.iconCompassRoseLight, iconSrcDark: uiRes.iconCompassRoseDark },
            panelCompassRoseTemp: {},
            panelCompass3d: { show: true, position: 'topright', size: 44 },
            panelCompass3dTemp: {},
            panelLabels: { show: true, position: 'topright', useItems: ['lng', 'lat', 'zoom'], lng: 'Longitude', lat: 'Latitude', zoom: 'Zoom', title: '', style: {} },
            panelLabelsTemp: {},
            panelItems: { show: true, position: 'topleft', stopWheel: false, style: {} },
            panelItemsTemp: {},
            panelZoom: { show: true, position: 'bottomleft' },
            panelZoomTemp: {},
            panelScale: { show: true, position: 'bottomright' },
            panelScaleTemp: {},
            panelLegends: { show: true, position: 'bottomright', maxWidth: 300, stopWheel: false, style: {} },
            panelLegendsTemp: {},

            displayPopupOnlyone: true,
            popupPosition: 'top',
            tooltipPosition: 'left',
            showLoc: { lat: '', lng: '' },

            // 數據集
            imageSets: [],
            effImageSetsTemp: [],
            pointSets: [],
            effPointSetsTemp: [],
            polylineSets: [],
            effPolylineSetsTemp: [],
            polygonSets: [],
            effPolygonSetsTemp: [],
            geojsonSets: [],
            effGeojsonSetsTemp: [],
            contourSets: [],
            effContourSetsTemp: [],

            items: [],
            trackedSourceIds: [],
            trackedLayerIds: [],

            displayOrderByType: true, //圖徵依型別面積序堆疊(點>線>面類>影像), 點擊命中小面積圖徵; false=維持插入序
            raiseOrderPending: false, //圖層型別重排的 idle 補重排去抖旗標

            // 叢集化設定（統一物件，由 computeClusterOpts 產生）
            clusterOpts: {
                enabled: false,
                radius: 50,
                maxZoom: 14,
                levelNum: 3,
                levelValues: [10, 100],
                levelRadius: [10, 15, 20],
                levelFillColors: ['rgba(140, 40, 25, 0.75)', 'rgba(255, 125, 50, 0.75)', 'rgba(255, 50, 100, 0.75)'],
                levelLineColors: ['#fff', '#fff', '#fff'],
                levelLineWidths: [2, 2, 2],
                levelTextSizes: [12, 12, 12],
                levelTextColors: ['#fff', '#fff', '#fff'],
                key: '',
            },

            featurePopup: null,
            featurePopupOwner: '',
            featureTooltip: null,
            featureTooltipOwner: '',

            // 當前活躍的 feature（供 slot 使用的響應式資料）
            activePolylineSet: {},
            activePolygonSet: {},
            activeGeojsonSet: {},
            activeContourSet: {},
            activePoint: {},
            activePointSet: {},
            //tooltip 專屬 active 變數: 與 popup 分離, 避免 hover 圖徵時 tooltip setter 連帶重繪已開 popup 的活元素
            activePolylineSetTooltip: {},
            activePolygonSetTooltip: {},
            activeGeojsonSetTooltip: {},
            activeContourSetTooltip: {},
            activePointTooltip: {},
            activePointSetTooltip: {},

            baseMapsDataTemp: [],
            prevClusterKey: '',
        }
    },
    mounted() {
        let vo = this
        vo.initMap()
        let wo = { immediate: true, deep: true }
        each(['imageSets'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changeImageSetsDebounce, wo))
        })
        each(['pointSets', 'pointSetsClick'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changePointSetsDebounce, wo))
        })
        each(['polylineSets', 'polylineSetsClick'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changePolylineSetsDebounce, wo))
        })
        each(['polygonSets', 'polygonSetsClick'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changePolygonSetsDebounce, wo))
        })
        each(['geojsonSets', 'geojsonSetsClick'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changeGeojsonSetsDebounce, wo))
        })
        each(['contourSets', 'contourSetsClick'], (v) => {
            vo.wats.push(vo.$watch(`opt.${v}`, vo.changeContourSetsDebounce, wo))
        })
    },
    beforeDestroy() {
        each(this.wats, (w) => {
            w()
        })
        if (this.map) {
            this.map.remove(); this.map = null
        }
    },
    watch: {
        opt: {
            handler() {
                this.changeOpt()
            },
            immediate: true,
            deep: true
        },
    },
    computed: {

        /** 依底圖色調選擇羅盤圖標 */
        useIconCompassRose() {
            let p = this.panelCompassRose
            if (isestr(p.iconSrc)) return p.iconSrc
            if (p.withPanel) return p.iconSrcDark
            return this.baseMapColorShade === 'dark' ? p.iconSrcLight : p.iconSrcDark
        },

        /** 當前可見底圖的色調 */
        baseMapColorShade() {
            let shade = ''
            each(get(this, 'panelBaseMaps.baseMaps', []), (v) => {
                if (v.visible && isestr(v.colorShade)) {
                    shade = v.colorShade; return false
                }
            })
            return shade
        },

        /** 比例尺文字 */
        scaleText() {
            let lat = isNumber(this.currentCenter[0]) ? this.currentCenter[0] : 23.5 //緯度 0 為有效值, 不可用 || 回退
            //maplibre 世界為 512px(zoom 0 = 512px), 赤道每像素公尺 = 40075016.686 / 512 = 78271.51696(R15; 256px 世界之 156543.03392 會使文字為實際距離之 2 倍)
            let mpp = 78271.51696 * Math.cos(lat * Math.PI / 180) / Math.pow(2, this.currentZoom)
            let d = mpp * 80
            return d >= 1000 ? Math.round(d / 1000) + ' km' : Math.round(d) + ' m'
        },

        /** 3D指北針：模擬俯視角傾斜效果的 CSS transform */
        compass3dDiscStyle() {
            let tilt = Math.min(this.currentPitch * 0.72, 52)
            return {
                display: 'inline-block',
                transform: `perspective(160px) rotateX(${tilt}deg)`,
                transition: 'transform 0.08s linear',
                transformOrigin: 'center center',
            }
        },

        /** popup 可調大小設定(讀 opt.popupResize, 給預設) */
        popupResizeCfg() {
            let c = get(this.opt, 'popupResize', {})
            return {
                resizable: c.resizable === true,
                resizeModes: isearr(c.resizeModes) ? c.resizeModes : ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
                minWidth: isNumber(c.minWidth) ? c.minWidth : 200,
                minHeight: isNumber(c.minHeight) ? c.minHeight : 200,
                width: isNumber(c.width) ? c.width : 400,
                height: isNumber(c.height) ? c.height : 300,
            }
        },

    },
    methods: {

        // ===== 初始化 =====

        initMap() {
            let vo = this
            vo.loading = true
            vo.$emit('loading', true)
            vo.map = createMap(vo.$refs.panel, vo.opt)
            vo.currentZoom = vo.map.getZoom()
            vo.zoomRange = { minZoom: vo.map.getMinZoom(), maxZoom: vo.map.getMaxZoom() }
            //建圖後 opt.zoom(未給/非數值者為預設 6)與地圖實際層級不同(被地圖夾入範圍)時回寫實際層級, 使 opt.zoom 與地圖一致(R12-7);
            //與地圖一致者(含未給 opt.zoom 而預設 6 落在範圍內)不回寫, 不替使用端新增鍵; 不一致卻不回寫, 日後第一次無關之 opt 變更會以過期值 setZoom 而中斷使用者手勢
            let b0 = computeBasicOpt(vo.opt)
            if (Math.abs(b0.zoom - vo.currentZoom) > 1e-9) vo.opt.zoom = vo.currentZoom
            vo.zoomWarnKey = vo.getZoomWarnKey(b0) //minZoom 被忽略之警告已由 createMap 於建圖時發出一次

            vo.map.on('load', () => {
                vo.mapLoaded = true
                vo.applyProjection()
                vo.applyBaseMaps()
                vo.applyTerrain()
                vo.ensureDataProcessed()
                vo.applyAllDataLayers()
                vo.map.once('idle', () => {
                    vo.loading = false
                    vo.$emit('loading', false)
                })
            })
            vo.map.on('mousemove', (e) => {
                vo.showLoc = { lat: dig(e.lngLat.lat, 7), lng: dig(e.lngLat.lng, 7) }
            })
            vo.map.on('zoomend', () => {
                let z = vo.map.getZoom(); vo.currentZoom = z; if (!vo.holdWriteBack) vo.opt.zoom = z
                if (vo.projection === '') vo.applyProjection()
                vo.syncZoomFromMap() //切換投影時 maplibre 帶約束遷移 transform 且不發事件, 層級可能被改
            })
            vo.map.on('moveend', () => {
                let c = vo.map.getCenter(); let nc = [c.lat, c.lng]
                if (vo.holdWriteBack) return //範圍變更連帶之移動不回寫(尚未處理之 opt.center 不可被舊值蓋掉)
                vo.panTarget = null //平移動畫(或被中斷之動畫)已結束
                if (!isEqual(vo.opt.center, nc)) vo.opt.center = nc
                vo.currentCenter = nc
                vo.syncZoomFromMap() //resize 等不發 zoomend 之層級變更
            })
            //切換投影(含使用端經 getMapObject().setProjection、load 後自動投影、changeOpt 之 opt.projection): maplibre 帶約束遷移 transform 且不發 zoomend/moveend,
            //層級與中心可能被約束改動 → 事件於遷移後同步發出, 在此重讀(R12-6)
            vo.map.on('projectiontransition', () => {
                vo.syncZoomFromMap()
                vo.syncCenterFromMap()
            })
            vo.map.on('move', () => {
                vo.recheckPopupDirections()
            })
            vo.map.on('pitch', () => {
                vo.currentPitch = vo.map.getPitch()
            })
            vo.map.on('rotate', () => {
                vo.currentBearing = vo.map.getBearing()
            })
        },

        resize() {
            if (this.map) this.map.resize()
        },

        // 以地圖實際層級為準同步 currentZoom 與 opt.zoom(層級被不發 zoomend 之路徑改動時, 如切換投影、resize 後之世界高度適配; R12-6)
        syncZoomFromMap() {
            let vo = this
            if (!vo.map || vo.holdWriteBack) return
            let z = vo.map.getZoom()
            if (Math.abs(z - vo.currentZoom) > 1e-9) {
                vo.currentZoom = z; vo.opt.zoom = z
            }
        },

        // 以地圖實際中心為準同步 currentCenter 與 opt.center(切換投影帶約束遷移 transform 且不發事件, 中心可能被約束改動; R12-6)。
        // 動畫進行中不同步(中途點非最終值, 動畫結束之 moveend 會寫回)
        syncCenterFromMap() {
            let vo = this
            if (!vo.map || vo.holdWriteBack || vo.map.isMoving()) return
            let c = vo.map.getCenter(); let nc = [c.lat, c.lng]
            let cc = vo.currentCenter
            if (!isarr(cc) || Math.abs(cc[0] - nc[0]) > 1e-9 || Math.abs(cc[1] - nc[1]) > 1e-9) {
                vo.currentCenter = nc; vo.opt.center = nc
            }
        },

        // minZoom 被忽略(大於 maxZoom)時之警告去重鍵; 無需警告回 ''
        getZoomWarnKey(basic) {
            return basic.ignoredMin ? `${String(this.opt.minZoom)}|${String(this.opt.maxZoom)}` : ''
        },

        // ===== 面板排序 =====

        getPanelOrder(panelName, corner) {
            let order = this.panelsOrder
            let idx = order.indexOf(panelName)
            if (corner.startsWith('bottom')) return idx < 0 ? -1 : (order.length - idx)
            return idx < 0 ? order.length : idx
        },

        // ===== 投影 =====

        applyProjection() {
            _applyProjection(this.map, this.projection)
        },

        // ===== 底圖 =====

        applyBaseMaps() {
            let vo = this
            applyBaseMaps(vo.map, get(vo, 'panelBaseMaps.baseMaps', []))
            //style 型別底圖須先 fetch style JSON: 首次(或新增 url)載入完成後補套一次;
            //全部已快取或無 style 型別時回傳 0, 不補套(applyBaseMaps 為完整重建, 會重抓圖磚, 不可無謂觸發)
            preloadBaseMapStyles(get(vo, 'panelBaseMaps.baseMaps', []))
                .then((n) => {
                    if (n <= 0 || !vo.map || !vo.mapLoaded) return
                    applyBaseMaps(vo.map, get(vo, 'panelBaseMaps.baseMaps', []))
                    //applyBaseMaps 重加底圖(無 beforeId)會排在資料圖層之上: 將 hillshade 與資料圖層壓回頂端(同 processPanelBaseMaps 重建路徑)
                    if (vo.map.getLayer('terrain-hillshade')) vo.map.moveLayer('terrain-hillshade')
                    each(vo.trackedLayerIds, (lid) => {
                        if (vo.map.getLayer(lid)) vo.map.moveLayer(lid)
                    })
                    vo.raiseFeatureLayersByType()
                })
                .catch((err) => {
                    console.error('[WMaplibreglVue] applyBaseMaps preload error:', err)
                })
        },
        applyTerrain() {
            applyTerrain(this.map, this.terrainMap, this.trackedLayerIds)
        },

        // 將執行期底圖的顯隱/透明度寫回 opt。
        // opt 有給 baseMaps 時，computePanelBaseMaps 一律以原始 opt 的 baseMaps 為準；
        // 而元件自身於 moveend/zoomend 會改動 opt.center/opt.zoom，經 deep watcher 觸發重推，
        // 若未寫回，重推就會以原始 opt 的 visible/opacity 覆寫，使使用者的底圖選取被還原。
        syncBaseMapsToOpt() {
            let vo = this
            let optBaseMaps = get(vo, 'opt.panelBaseMaps.baseMaps', null)
            if (!isearr(optBaseMaps)) return //opt 未給 baseMaps 時 computePanelBaseMaps 本就沿用執行期狀態，無須寫回
            each(get(vo, 'panelBaseMaps.baseMaps', []), (bm, k) => {
                let obm = get(optBaseMaps, k, null); if (!isobj(obm)) return
                vo.$set(obm, 'visible', bm.visible)
                if (isNumber(bm.opacity)) vo.$set(obm, 'opacity', bm.opacity)
            })
        },

        switchBaseMap(idx) {
            _switchBaseMap(this.map, this.panelBaseMaps.baseMaps, idx)
            // 同步 baseMapsDataTemp，避免 processPanelBaseMaps 將此 visible 變動誤判為 baseMapsChanged
            // 而觸發 applyBaseMaps()，導致底圖圖層被重新堆疊在資料圖層上方
            this.baseMapsDataTemp = cloneDeep(this.panelBaseMaps.baseMaps)
            this.syncBaseMapsToOpt()
            this.$forceUpdate()
        },
        toggleOverlayVisible(idx) {
            _toggleOverlayVisible(this.map, this.panelBaseMaps.baseMaps, idx)
            // 同步 baseMapsDataTemp，避免 processPanelBaseMaps 將此 visible 變動誤判為 baseMapsChanged
            // 而觸發 applyBaseMaps()，導致底圖圖層被重新堆疊在資料圖層上方
            this.baseMapsDataTemp = cloneDeep(this.panelBaseMaps.baseMaps)
            this.syncBaseMapsToOpt()
            this.$forceUpdate()
        },
        // 面板顯示用之疊加層透明度(與實繪同一擁有者 getBaseMapOpacity; style 型不渲染滑桿故不會取到 null, 保底回 1)
        bmOpacity(bm) {
            let v = getBaseMapOpacity(bm)
            return v === null ? 1 : v
        },
        setOverlayOpacity(idx, val) {
            _setOverlayOpacity(this.map, this.panelBaseMaps.baseMaps, idx, val)
            this.baseMapsDataTemp = cloneDeep(this.panelBaseMaps.baseMaps)
            this.syncBaseMapsToOpt()
            this.$forceUpdate()
        },

        // ===== 自訂縮放 =====

        zoomIn() {
            if (this.map) this.map.zoomIn()
        },
        zoomOut() {
            if (this.map) this.map.zoomOut()
        },

        // ===== 滾輪攔截 =====

        handleWheel(e, panel) {
            if (panel && panel.stopWheel) e.stopPropagation()
        },

        // ===== opt 變更 =====

        changeOpt() {
            let vo = this

            let basic = computeBasicOpt(vo.opt, vo.currentZoom, vo.currentCenter)
            vo.panelBackgroundColor = basic.panelBackgroundColor
            //minZoom 被忽略(大於 maxZoom)之警告: 與是否改變有效範圍無關(例如只給 minZoom:23 而有效範圍仍為預設 0~22), 以輸入組合去重(同一組只警告一次)
            if (vo.map) {
                let wk = vo.getZoomWarnKey(basic)
                if (wk !== vo.zoomWarnKey) {
                    vo.zoomWarnKey = wk
                    if (wk !== '') console.warn(`[WMaplibreglVue] opt.minZoom 大於 opt.maxZoom(有效 maxZoom=${basic.maxZoom}), 忽略 minZoom`)
                }
            }
            let zoom0 = vo.currentZoom //範圍變更前之層級: 父層本輪明給之 zoom 是否與現行不同, 須以此判斷(範圍變更可能已把現行層級拉到恰等於目標)
            //範圍變更先套用(maplibre 會把範圍外之現行層級拉入); 期間 zoomend/moveend 不回寫 opt, 由下方以地圖實際值統一回寫(R11、R12-2)
            if (vo.map && vo.zoomRange && (vo.zoomRange.minZoom !== basic.minZoom || vo.zoomRange.maxZoom !== basic.maxZoom)) {
                vo.holdWriteBack = true
                try {
                    applyZoomRange(vo.map, basic)
                }
                finally {
                    vo.holdWriteBack = false
                }
                vo.zoomRange = { minZoom: vo.map.getMinZoom(), maxZoom: vo.map.getMaxZoom() } //以地圖實際值為準(套用失敗時不誤記為已套用)
                vo.currentZoom = vo.map.getZoom()
            }
            //浮點雜訊不視為變更(R12-4); 範圍變更前後任一與目標不同即視為父層要變更 zoom: 否則範圍把現行層級拉到恰等於目標時 needZoom 為假,
            //僅剩 center 時走 panTo, globe 下 maplibre 會依緯度差調整層級而丟掉父層明給之 zoom(R12-1)
            let needZoom = Math.abs(zoom0 - basic.zoom) > 1e-9 || Math.abs(vo.currentZoom - basic.zoom) > 1e-9
            let needCenter = !isEqual(vo.currentCenter, basic.center)
            if (!vo.map) {
                vo.currentZoom = basic.zoom; vo.currentCenter = basic.center
            }
            else if (needZoom && needCenter) {
                //同時變更: 單一 jumpTo, 避免 setZoom 同步觸發之 moveend 把尚未平移之舊 center 寫回 opt.center 而吞掉新 center(R12-1)
                vo.currentCenter = basic.center
                vo.panTarget = null
                vo.map.jumpTo({ center: [basic.center[1], basic.center[0]], zoom: basic.zoom })
            }
            else if (needZoom) {
                if (vo.panTarget && vo.map.isMoving()) {
                    //元件發起之平移動畫尚未結束又要改 zoom: setZoom 之 stop() 會中斷動畫並把中途點寫回 opt.center → 連同平移目標一併落定(R12-5)
                    vo.map.jumpTo({ center: [vo.panTarget[1], vo.panTarget[0]], zoom: basic.zoom })
                }
                else {
                    vo.map.setZoom(basic.zoom)
                }
            }
            else if (needCenter) {
                vo.currentCenter = basic.center
                vo.map.panTo([basic.center[1], basic.center[0]])
                //panTarget 須於 panTo 之後設: panTo 之 stop() 會同步補發被中斷動畫(如前一次 opt.center 變更之平移)之 moveend, 其 handler 會清除 panTarget;
                //平移即刻完成(無動畫)者不留 panTarget
                vo.panTarget = vo.map.isMoving() ? basic.center : null
            }
            if (vo.map && needZoom) {
                //以地圖實際層級為準: 超出範圍者被 maplibre 拉入; 若拉入後與原層級相同則不觸發 zoomend, 須在此補回寫, opt.zoom 方不與地圖脫節(R12-3);
                //opt.zoom 非數值者(含 NaN、Symbol 等, 不可對其強制轉型)一律回寫實際層級
                let z = vo.map.getZoom(); vo.currentZoom = z
                let oz = vo.opt.zoom
                if (!(isnum(oz) && Math.abs(Number(oz) - z) <= 1e-9)) vo.opt.zoom = z
            }
            vo.showLoc = { lat: dig(basic.center[0], 7), lng: dig(basic.center[1], 7) }
            vo.displayPopupOnlyone = basic.displayPopupOnlyone
            vo.displayOrderByType = basic.displayOrderByType
            if (basic.popupPosition) vo.popupPosition = basic.popupPosition
            if (basic.tooltipPosition) vo.tooltipPosition = basic.tooltipPosition

            vo.processPanelBaseMaps()
            vo.processPanelCompassRose()
            vo.processPanelCompass3d()
            vo.processPanelLabels()
            vo.processPanelItems()
            vo.processPanelZoom()
            vo.processPanelScale()
            vo.processPanelLegends()

            // 叢集化
            let newOpts = computeClusterOpts(vo.opt)
            let clusterChanged = vo.prevClusterKey !== '' && vo.prevClusterKey !== newOpts.key
            vo.clusterOpts = newOpts
            vo.prevClusterKey = newOpts.key
            if (clusterChanged && vo.map && vo.mapLoaded) {
                let t = clearTrackedByPrefix(vo.map, 'point-', vo.trackedLayerIds, vo.trackedSourceIds)
                vo.trackedLayerIds = t.layerIds; vo.trackedSourceIds = t.sourceIds
                vo.renderPointSets()
            }

            // panelsOrder
            let panelsOrder = get(vo, 'opt.panelsOrder', null)
            if (!isarr(panelsOrder) || panelsOrder.length === 0) panelsOrder = defPanelsOrder
            if (!isEqual(vo.panelsOrder, panelsOrder)) vo.panelsOrder = cloneDeep(panelsOrder)

            // projection
            let projection = basic.projection
            if (vo.projection !== projection) {
                vo.projection = projection
                if (vo.map && vo.mapLoaded) vo.applyProjection() //層級/中心被約束改動之同步由 projectiontransition 事件處理(R12-6)
            }

            vo.changeItemsDebounce()
        },

        processPanelBaseMaps() {
            let vo = this
            let result = computePanelBaseMaps(vo.opt, get(vo, 'panelBaseMaps.baseMaps', []), vo.terrainMapTemp, vo.baseMapsDataTemp, defBaseMaps, defTerrainMap)
            vo.terrainMapTemp = cloneDeep(result.terrainMap)
            vo.terrainMap = result.terrainMap
            vo.panelBaseMaps = result.panelBaseMaps
            vo.panelBaseMapsTemp = cloneDeep(result.panelBaseMaps)
            if (result.baseMapsChanged) {
                let prevBaseMaps = vo.baseMapsDataTemp //更新前的上次套用值, 供 paint-only 判斷
                let nextBaseMaps = result.panelBaseMaps.baseMaps
                vo.baseMapsDataTemp = cloneDeep(nextBaseMaps)
                if (vo.map && vo.mapLoaded) {
                    if (isBaseMapsPaintOnlyDiff(prevBaseMaps, nextBaseMaps)) {
                        //僅 paint(如 colorFillExtrusion/opacity)變更: 就地 setPaintProperty,
                        //不重建底圖 layer/source → 不重抓圖磚、不影響其他未變更圖層(無閃爍)
                        each(nextBaseMaps, (bm, k) => updateBaseMapPaint(vo.map, nextBaseMaps, k))
                    }
                    else if (!isBaseMapsStructuralDiff(prevBaseMaps, nextBaseMaps)) {
                        //僅順序/可見性(可含 paint)變更: 增量套用(setPaintProperty + setLayoutProperty + moveLayer),
                        //不重建 layer/source → 不重抓圖磚、不擾動資料圖層 z-order(無閃爍)
                        updateBaseMapsIncremental(vo.map, nextBaseMaps)
                    }
                    else {
                        vo.applyBaseMaps()
                        // applyBaseMaps 會移除後重新加入底圖圖層（無 beforeId），使底圖排在資料圖層之上；
                        // 因此需將所有已追蹤的資料圖層移回最頂層
                        //hillshade 不在 tracked 清單, 先單獨壓回(維持「底圖上、資料下」之疊序)
                        if (vo.map.getLayer('terrain-hillshade')) vo.map.moveLayer('terrain-hillshade')
                        each(vo.trackedLayerIds, (lid) => {
                            if (vo.map.getLayer(lid)) vo.map.moveLayer(lid)
                        })
                        //再依圖徵型別面積序重排(點>線>面), 使點擊命中小面積圖徵(displayOrderByType=false 則不重排)
                        vo.raiseFeatureLayersByType()
                    }
                }
            }
            if (result.terrainChanged && vo.map && vo.mapLoaded) vo.applyTerrain()
        },

        processPanelCompassRose() {
            let vo = this
            let p = computePanelCompassRose(vo.opt, uiRes)
            if (!isEqual(vo.panelCompassRoseTemp, p)) {
                vo.panelCompassRose = p; vo.panelCompassRoseTemp = cloneDeep(p)
            }
        },

        processPanelCompass3d() {
            let vo = this
            let p = computePanelCompass3d(vo.opt)
            if (!isEqual(vo.panelCompass3dTemp, p)) {
                vo.panelCompass3d = p; vo.panelCompass3dTemp = cloneDeep(p)
            }
        },

        resetTo2d() {
            if (this.map) this.map.easeTo({ pitch: 0, bearing: 0, duration: 400 })
        },

        processPanelLabels() {
            let vo = this
            let p = computePanelLabels(vo.opt)
            if (!isEqual(vo.panelLabelsTemp, p)) {
                vo.panelLabels = p; vo.panelLabelsTemp = cloneDeep(p)
            }
        },

        processPanelItems() {
            let vo = this
            let p = computePanelItems(vo.opt)
            if (!isEqual(vo.panelItemsTemp, p)) {
                vo.panelItems = p; vo.panelItemsTemp = cloneDeep(p)
            }
        },

        processPanelZoom() {
            let vo = this
            let p = computePanelZoom(vo.opt)
            if (!isEqual(vo.panelZoomTemp, p)) {
                vo.panelZoom = p; vo.panelZoomTemp = cloneDeep(p)
            }
        },

        processPanelScale() {
            let vo = this
            let p = computePanelScale(vo.opt)
            if (!isEqual(vo.panelScaleTemp, p)) {
                vo.panelScale = p; vo.panelScaleTemp = cloneDeep(p)
            }
        },

        processPanelLegends() {
            let vo = this
            let p = computePanelLegends(vo.opt)
            if (!isEqual(vo.panelLegendsTemp, p)) {
                vo.panelLegends = p; vo.panelLegendsTemp = cloneDeep(p)
            }
        },

        // ===== 資料圖層 =====

        ensureDataProcessed() {
            let vo = this
            if (!isearr(vo.pointSets) && isearr(get(vo, 'opt.pointSets', null))) vo.changePointSets()
            if (!isearr(vo.polylineSets) && isearr(get(vo, 'opt.polylineSets', null))) vo.changePolylineSets()
            if (!isearr(vo.polygonSets) && isearr(get(vo, 'opt.polygonSets', null))) vo.changePolygonSets()
            if (!isearr(vo.geojsonSets) && isearr(get(vo, 'opt.geojsonSets', null))) vo.changeGeojsonSets()
            if (!isearr(vo.contourSets) && isearr(get(vo, 'opt.contourSets', null))) vo.changeContourSets()
            if (!isearr(vo.imageSets) && isearr(get(vo, 'opt.imageSets', null))) vo.changeImageSets()
        },

        applyAllDataLayers() {
            this.renderPointSets(); this.renderPolylineSets(); this.renderPolygonSets()
            this.renderGeojsonSets(); this.renderContourSets(); this.renderImageSets()
        },

        //依「圖徵型別面積序」重新堆疊圖層: image(最底)→contour→polygon→geojson→polyline→point(最頂),
        //使面積小者在上(點>線>面), 點擊才命中小面積圖徵而非被大面積圖徵攔截; 同時讓資料圖層位於底圖之上.
        //直接掃描地圖實際圖層(不依賴 tracked: 點圖層非同步加入, tracked 常不同步). displayOrderByType=false 時不重排.
        raiseFeatureLayersByType() {
            let vo = this
            if (!vo.map || !vo.displayOrderByType) return
            let style = vo.map.getStyle()
            if (!style || !isarr(style.layers)) return
            let ids = style.layers.map((l) => l.id).filter((id) => isestr(id))
            //由下到上, 後 moveLayer 者疊在上層(moveLayer 無 beforeId = 移到最頂)
            let order = ['image-', 'contour-', 'polygon-', 'geojson-', 'polyline-', 'point-']
            each(order, (prefix) => {
                each(ids, (lid) => {
                    if (lid.indexOf(prefix) === 0 && vo.map.getLayer(lid)) vo.map.moveLayer(lid)
                })
            })
        },
        //圖層(尤其點)為非同步載入, 故先同步重排一次, 再掛一次性 idle 待延後圖層就位後重排;
        //raiseOrderPending 將連續 render 的多次重排合併為一次 idle 重排
        scheduleRaiseFeatureLayers() {
            let vo = this
            if (!vo.map || !vo.mapLoaded || !vo.displayOrderByType) return
            vo.raiseFeatureLayersByType()
            if (vo.raiseOrderPending) return
            vo.raiseOrderPending = true
            vo.map.once('idle', () => {
                vo.raiseOrderPending = false
                vo.raiseFeatureLayersByType()
            })
        },
        //點擊優先權: displayOrderByType 開啟時, 同一點若有「更高優先型別」(point>polyline>geojson>polygon>contour)的圖徵,
        //則目前型別讓位(該 click handler 直接 return, 不開 popup 也不觸發 funSetsClick), 使點擊確定命中視覺最上層型別,
        //與 z-order 一致. 因 maplibre 各圖層 click listener 皆會觸發、displayPopupOnlyone 為「最後者勝」, 故需此閘門.
        shouldDeferFeatureClick(screenPoint, myType) {
            let vo = this
            if (!vo.displayOrderByType || !vo.map || !screenPoint) return false
            let rank = { point: 5, polyline: 4, geojson: 3, polygon: 2, contour: 1 }
            let myRank = rank[myType] || 0
            let fs = []
            try {
                fs = vo.map.queryRenderedFeatures(screenPoint) || []
            }
            catch (e) {
                return false
            }
            let topRank = 0
            each(fs, (f) => {
                let lid = (f && f.layer && f.layer.id) || ''
                each(rank, (r, t) => {
                    if (r > topRank && lid.indexOf(t + '-') === 0) topRank = r
                })
            })
            return topRank > myRank //同點有更高優先型別 → 讓位
        },

        clearTrackedByPrefix(prefix) {
            let t = clearTrackedByPrefix(this.map, prefix, this.trackedLayerIds, this.trackedSourceIds)
            this.trackedLayerIds = t.layerIds; this.trackedSourceIds = t.sourceIds
        },

        // -- 點 --
        changePointSetsDebounce() {
            this.dbcChangePointSets(() => {
                this.changePointSets()
            })
        },
        //六型別 changeXxxSets 共用流程: cloneDeep → 結構 diff(omit visible) → 早退時僅同步 visible → normalize → 面板清單 + render。
        //o: { optKey, tempKey, setsKey, defVisible, clickKey, normalize(sets), render(), renderOnIdleIfNotLoaded }
        //注意: o.defVisible 須與該型別 normalize 內的 visible 預設值一致(point/polyline/polygon/geojson=true, image/contour=false),
        //兩處不一致會使「visible 同步早退」與「完整 normalize」對缺省 visible 的解讀不同
        processSetsChange(o) {
            let vo = this
            let sets = get(vo, `opt.${o.optKey}`, null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible'))
            //全域 click 函數(opt.xxxSetsClick)不在 eff 內(位於 sets 之外), 須另以參考比對偵測——
            //否則 runtime 只更換 click 函數時會被結構早退擋下, 新函數永不進正規化資料
            if (!vo._effClickFns) vo._effClickFns = {} //刻意不進 reactive data(僅存函式參考快照)
            let fcNow = o.clickKey ? get(vo, `opt.${o.clickKey}`, null) : null
            let clickChanged = o.clickKey ? vo._effClickFns[o.clickKey] !== fcNow : false
            if (!clickChanged && isEqual(vo[o.tempKey], eff)) {
                //結構未變: 僅同步 visible(涵蓋外部直接改 opt.xxxSets[k].visible 的路徑), 有差異才重新套用顯隱
                if (vo.syncSetsVisible(vo[o.setsKey], sets, o.defVisible)) {
                    vo.changeItemsDebounce(); if (vo.map && vo.mapLoaded) o.render()
                }
                return
            }
            vo[o.tempKey] = eff
            if (o.clickKey) vo._effClickFns[o.clickKey] = fcNow
            vo[o.setsKey] = o.normalize(sets)
            vo.changeItemsDebounce()
            if (vo.map) {
                if (vo.mapLoaded) o.render()
                else if (o.renderOnIdleIfNotLoaded) vo.map.once('idle', () => o.render())
            }
        },

        changePointSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'pointSets',
                tempKey: 'effPointSetsTemp',
                setsKey: 'pointSets',
                defVisible: true,
                clickKey: 'pointSetsClick',
                renderOnIdleIfNotLoaded: true, //點圖層允許 map 尚未 load 完就排程渲染(once idle)
                render: () => vo.renderPointSets(),
                normalize: (sets) => {
                    let fc = get(vo, 'opt.pointSetsClick', null)
                    let norm = map(sets, (ps, kps) => {
                        //穩定識別碼 kid: 使用者給 key(字串, 需於陣列內唯一)則陣列位移時組身分不變(可走逐組差異跳過);
                        //未給則退回索引字串(id/圖層命名與現行完全一致)
                        let kid = isestr(get(ps, 'key', null)) ? `k-${ps.key}` : String(kps)
                        if (!isestr(get(ps, 'title', null))) ps.title = ''; if (!isestr(get(ps, 'msg', null))) ps.msg = ''
                        if (!isNumber(get(ps, 'order', null))) ps.order = null; if (!isbol(get(ps, 'visible', null))) ps.visible = true
                        let sz = get(ps, 'size', 10); let fl = get(ps, 'fillColor', 'rgba(0,150,255,0.65)'); let lc = get(ps, 'lineColor', 'rgba(255,255,255,1)'); let lw = get(ps, 'lineWidth', 1)
                        ps.points = map(ps.points, (pt, kpt) => {
                            if (isearr(pt)) pt = { latLng: [get(pt, 0), get(pt, 1)] }
                            if (!isestr(get(pt, 'title', null))) pt.title = ''; if (!isestr(get(pt, 'msg', null))) pt.msg = ''
                            return { id: `pointSet-${kid}-point-${kpt}`, ...pt, radius: get(pt, 'size', null) || sz, fillColor: get(pt, 'fillColor', null) || fl, lineColor: get(pt, 'lineColor', null) || lc, lineWidth: get(pt, 'lineWidth', null) || lw, funSetsClick: fc }
                        })
                        freezeCoordField(ps.points) //萬點級: 免 Vue 深度 observe(渲染/事件反查/popup 皆唯讀取用)
                        return { id: `pointSet-${kid}`, ...ps, kid, funSetsClick: fc }
                    })
                    //kid 查找表(刻意不進 reactive data): 事件 handler 以 _kid 取「最新」資料。
                    //key 重複時後者覆蓋前者(同 Vue :key 約定)
                    let byKid = {}
                    each(norm, (ps) => {
                        if (byKid[ps.kid] !== undefined) console.warn(`[WMaplibreglVue] pointSets 有重複 key「${ps.kid}」: 各組將共用同一組圖層 id 互相覆蓋, 請保持 key 於陣列內唯一`)
                        byKid[ps.kid] = ps
                    })
                    vo.pointSetsByKid = byKid
                    return norm
                },
            })
        },

        renderPointSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //過期清理改於 impl 內以 kid 判斷(索引式 removeStaleSetLayers 會誤刪位移後的組)
            renderPointSetsImpl(vo.map, vo.pointSets, vo.clusterOpts, tracked, {
                registerIcon: (key, src, w, h) => registerIconImage(vo.map, key, src, w, h),
                //kid 可能含 . 與 -(來自使用者 key), 須用陣列路徑查找, 不可用字串路徑
                getPointData: (kid, kpt) => get(vo, ['pointSetsByKid', kid, 'points', kpt], null),
                getPointSetData: (kid) => get(vo, ['pointSetsByKid', kid], null),
                getDisplayOrderByType: () => vo.displayOrderByType,
                onPointClick: (ptData, psData, p, coords) => {
                    if (isfun(ptData.funSetsClick)) ptData.funSetsClick({ point: ptData, pointSet: psData, pointSets: vo.pointSets })
                    let popAnchor = get(ptData, 'popupAnchor', null) || get(psData, 'popupAnchor', null)
                    if (!isarr(popAnchor) || popAnchor.length < 2) {
                        if (p._ptype === 'circle') {
                            let r = p._radius || get(psData, 'size', 10); popAnchor = [0, -(r / 1.0)]
                        }
                        else {
                            popAnchor = isNumber(get(p, '_defPopupAnchorY', null)) ? [0, p._defPopupAnchorY] : null //預設 icon 錨點記於 feature props
                            if (!isarr(popAnchor)) {
                                let iSz = get(ptData, 'iconSize', null) || get(psData, 'iconSize', null) || [25, 41]
                                popAnchor = [0, -(iSz[1] / 1.0)]
                            }
                        }
                    }
                    vo.activePoint = ptData; vo.activePointSet = psData
                    vo.$nextTick(() => {
                        let refInner = vo.$refs.refPointPopupInner; if (!refInner || !refInner.innerHTML.trim()) return
                        vo.closeAllPopupsIfOnlyone()
                        vo.featurePopup = createDirectionalPopup(vo.map, coords, refInner, vo.popupPosition, 0, { maxWidth: 'none' }, popAnchor)
                        //owner 以組身分(kid)記錄: 索引會因 keyed 重排位移, 面板隱藏之關閉路徑由 closePopupByOwner 轉譯對應
                        vo.featurePopupOwner = `pointSets.k:${p._kid}`
                    })
                },
                onPointEnter: (ptData, psData, p, coords) => {
                    let tipAnchor = get(ptData, 'tooltipAnchor', null) || get(psData, 'tooltipAnchor', null)
                    if (!isarr(tipAnchor) || tipAnchor.length < 2) {
                        if (p._ptype === 'circle') {
                            tipAnchor = [0, 0]
                        }
                        else {
                            tipAnchor = isNumber(get(p, '_defTooltipAnchorY', null)) ? [0, p._defTooltipAnchorY] : null //預設 icon 錨點記於 feature props
                            if (!isarr(tipAnchor)) {
                                let iSz = get(ptData, 'iconSize', null) || get(psData, 'iconSize', null) || [25, 41]
                                tipAnchor = [0, -(iSz[1] / 1.0)]
                            }
                        }
                    }
                    vo.activePointTooltip = ptData; vo.activePointSetTooltip = psData
                    vo.$nextTick(() => {
                        let refEl = vo.$refs.refPointTooltip; if (!refEl) return
                        let html = refEl.innerHTML.trim(); if (!html) return
                        vo.hideFeatureTooltip()
                        let ct = document.createElement('div'); ct.innerHTML = html
                        vo.featureTooltip = createDirectionalPopup(vo.map, coords, ct, vo.tooltipPosition, 0, { closeButton: false, closeOnClick: false, maxWidth: 'none', className: 'wlv2-tooltip' }, tipAnchor)
                        vo.featureTooltipOwner = `pointSets.k:${p._kid}` //owner 以組身分(kid)記錄, 同 popup
                    })
                },
                onPointLeave: () => {
                    vo.hideFeatureTooltip()
                },
            }, {
                src: uiRes.iconPoint,
                size: [24, 40],
                key: 'point-icon-default',
            })
            vo.trackedSourceIds = tracked.sourceIds
            vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // -- 折線 --
        changePolylineSetsDebounce() {
            this.dbcChangePolylineSets(() => {
                this.changePolylineSets()
            })
        },
        changePolylineSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'polylineSets',
                tempKey: 'effPolylineSetsTemp',
                setsKey: 'polylineSets',
                defVisible: true,
                clickKey: 'polylineSetsClick',
                render: () => vo.renderPolylineSets(),
                normalize: (sets) => {
                    let fc = get(vo, 'opt.polylineSetsClick', null)
                    return map(sets, (pls, k) => {
                        if (!isestr(get(pls, 'title', null))) pls.title = ''; if (!isestr(get(pls, 'msg', null))) pls.msg = ''
                        if (!isNumber(get(pls, 'order', null))) pls.order = null; if (!isbol(get(pls, 'visible', null))) pls.visible = true
                        let lc = get(pls, 'lineColor', null); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                        let lw = get(pls, 'lineWidth', null); if (!isNumber(lw)) lw = 3
                        freezeCoordField(pls.latLngs) //大量座標: 免 Vue 深度 observe(渲染端唯讀取用)
                        return { id: `polylineSet-${k}`, ...pls, lineColor: lc, lineWidth: lw, funSetsClick: fc }
                    })
                },
            })
        },
        renderPolylineSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //聚合渲染(單 source + 1 層, id 無數字尾綴): 過期/無可見組之清理由 impl 內自行處理
            renderPolylineSetsImpl(vo.map, vo.polylineSets, tracked, {
                shouldDeferClick: (pt, type) => vo.shouldDeferFeatureClick(pt, type),
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // -- 多邊形 --
        changePolygonSetsDebounce() {
            this.dbcChangePolygonSets(() => {
                this.changePolygonSets()
            })
        },
        changePolygonSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'polygonSets',
                tempKey: 'effPolygonSetsTemp',
                setsKey: 'polygonSets',
                defVisible: true,
                clickKey: 'polygonSetsClick',
                render: () => vo.renderPolygonSets(),
                normalize: (sets) => {
                    let fc = get(vo, 'opt.polygonSetsClick', null)
                    return map(sets, (pg, k) => {
                        if (!isestr(get(pg, 'title', null))) pg.title = ''; if (!isestr(get(pg, 'msg', null))) pg.msg = ''
                        if (!isNumber(get(pg, 'order', null))) pg.order = null; if (!isbol(get(pg, 'visible', null))) pg.visible = true
                        let lc = get(pg, 'lineColor', 'rgba(0,150,255,1)'); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                        let lw = get(pg, 'lineWidth', 3); if (!isNumber(lw)) lw = 3
                        let fl = get(pg, 'fillColor', 'rgba(0,150,255,0.25)'); if (!isestr(fl)) fl = 'rgba(0,150,255,0.25)'
                        //註: polygonSets.latLngs 刻意不凍結——buildPolygonGeometry 回退之 w-gis 慢管線
                        //(fixCloseMultiPolygon)會就地 push 閉合點, 凍結會在該路徑丟 TypeError
                        return { id: `polygonSet-${k}`, ...pg, lineColor: lc, lineWidth: lw, fillColor: fl, funSetsClick: fc }
                    })
                },
            })
        },
        renderPolygonSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //聚合渲染(單 source + 2 層, id 無數字尾綴): 過期/無可見組之清理由 impl 內自行處理
            renderPolygonSetsImpl(vo.map, vo.polygonSets, tracked, {
                shouldDeferClick: (pt, type) => vo.shouldDeferFeatureClick(pt, type),
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // -- GeoJSON --
        changeGeojsonSetsDebounce() {
            this.dbcChangeGeojsonSets(() => {
                this.changeGeojsonSets()
            })
        },
        changeGeojsonSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'geojsonSets',
                tempKey: 'effGeojsonSetsTemp',
                setsKey: 'geojsonSets',
                defVisible: true,
                clickKey: 'geojsonSetsClick',
                render: () => vo.renderGeojsonSets(),
                normalize: (sets) => {
                    let fc = get(vo, 'opt.geojsonSetsClick', null)
                    return map(sets, (gj, k) => {
                        if (!isestr(get(gj, 'title', null))) gj.title = ''; if (!isestr(get(gj, 'msg', null))) gj.msg = ''
                        if (!isNumber(get(gj, 'order', null))) gj.order = null; if (!isbol(get(gj, 'visible', null))) gj.visible = true
                        let lc = get(gj, 'lineColor', 'rgba(0,150,255,1)'); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                        let lw = get(gj, 'lineWidth', 3); if (!isNumber(lw)) lw = 3
                        let fl = get(gj, 'fillColor', 'rgba(0,150,255,0.25)'); if (!isestr(fl)) fl = 'rgba(0,150,255,0.25)'
                        return { id: `geojsonSet-${k}`, ...gj, lineColor: lc, lineWidth: lw, fillColor: fl, funSetsClick: fc }
                    })
                },
            })
        },
        renderGeojsonSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //聚合渲染(3 source + 4 層, id 無數字尾綴): 過期/無可見組之清理由 impl 內自行處理
            renderGeojsonSetsImpl(vo.map, vo.geojsonSets, tracked, {
                shouldDeferClick: (pt, type) => vo.shouldDeferFeatureClick(pt, type),
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // -- 影像 --
        changeImageSetsDebounce() {
            this.dbcChangeImageSets(() => {
                this.changeImageSets()
            })
        },
        changeImageSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'imageSets',
                tempKey: 'effImageSetsTemp',
                setsKey: 'imageSets',
                defVisible: false,
                render: () => vo.renderImageSets(),
                normalize: (sets) => {
                    let seenKid = {}
                    return map(sets, (im, k) => {
                        //穩定識別碼 kid: 使用者給 key 則位移時身分不變(未變更組零觸碰, 不重載圖片); 未給退回索引
                        let kid = isestr(get(im, 'key', null)) ? `k-${im.key}` : String(k)
                        if (seenKid[kid]) console.warn(`[WMaplibreglVue] imageSets 有重複 key「${kid}」: 各組將共用同一組圖層 id 互相覆蓋, 請保持 key 於陣列內唯一`)
                        seenKid[kid] = true
                        if (!isestr(get(im, 'title', null))) im.title = ''; if (!isestr(get(im, 'msg', null))) im.msg = ''
                        if (!isNumber(get(im, 'order', null))) im.order = null; if (!isbol(get(im, 'visible', null))) im.visible = false
                        let op = get(im, 'opacity', null); if (!isNumber(op)) op = 1; if (op < 0) op = 0; if (op > 1) op = 1 //夾限至 0~1, 免無效值直入 paint
                        return { id: `imageSet-${kid}`, ...im, kid, opacity: op }
                    })
                },
            })
        },
        renderImageSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //kid 識別 + 逐組差異跳過: 過期/隱藏組之清理由 impl 內處理
            renderImageSetsImpl(vo.map, vo.imageSets, tracked, {
                getDisplayOrderByType: () => vo.displayOrderByType,
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // -- 等值線 --
        changeContourSetsDebounce() {
            this.dbcChangeContourSets(() => {
                this.changeContourSets()
            })
        },
        changeContourSets() {
            let vo = this
            vo.processSetsChange({
                optKey: 'contourSets',
                tempKey: 'effContourSetsTemp',
                setsKey: 'contourSets',
                defVisible: false,
                clickKey: 'contourSetsClick',
                render: () => vo.renderContourSets(),
                normalize: (sets) => vo.normalizeContourSets(sets),
            })
        },
        normalizeContourSets(contourSets) {
            let vo = this
            let funSetsClick = get(vo, 'opt.contourSetsClick', null)
            return map(contourSets, (contourSet, kcontourSet) => {
                let lineColor = get(contourSet, 'lineColor', null); if (!isestr(lineColor)) lineColor = ''
                let lineWidth = get(contourSet, 'lineWidth', null); if (!isNumber(lineWidth)) lineWidth = 1
                let fillOpacity = get(contourSet, 'fillOpacity', null); if (!isNumber(fillOpacity)) fillOpacity = 0.2
                let lineColorHover = get(contourSet, 'lineColorHover', null); if (!isestr(lineColorHover)) lineColorHover = lineColor
                let lineWidthHover = get(contourSet, 'lineWidthHover', null); if (!isNumber(lineWidthHover)) lineWidthHover = 3
                let fillOpacityHover = get(contourSet, 'fillOpacityHover', null); if (!isNumber(fillOpacityHover)) fillOpacityHover = 0.5
                let changeStyleWhenHover = get(contourSet, 'changeStyleWhenHover', null); if (!isbol(changeStyleWhenHover)) changeStyleWhenHover = true
                let legendNumDig = get(contourSet, 'legendNumDig', null); if (!isNumber(legendNumDig)) legendNumDig = null
                let legendTextFormater = get(contourSet, 'legendTextFormater', null); if (!isfun(legendTextFormater)) legendTextFormater = null
                let legendTextExtra = get(contourSet, 'legendTextExtra', null); if (!isfun(legendTextExtra)) legendTextExtra = null
                if (!isestr(get(contourSet, 'title', null))) contourSet.title = ''
                if (!isestr(get(contourSet, 'msg', null))) contourSet.msg = ''
                if (!isNumber(get(contourSet, 'order', null))) contourSet.order = null
                if (!isbol(get(contourSet, 'visible', null))) contourSet.visible = false
                return {
                    id: `contourSet-${kcontourSet}`,
                    ...contourSet,
                    lineColor,
                    lineWidth,
                    fillOpacity,
                    lineColorHover,
                    lineWidthHover,
                    fillOpacityHover,
                    changeStyleWhenHover,
                    legendNumDig,
                    legendTextFormater,
                    legendTextExtra,
                    legend: [],
                    funSetsClick,
                }
            })
        },
        renderContourSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            //聚合渲染(單 source + 2 層, id 無數字尾綴): 過期/無可見組之清理由 impl 內自行處理
            renderContourSetsImpl(vo.map, vo.contourSets, tracked, {
                shouldDeferClick: (pt, type) => vo.shouldDeferFeatureClick(pt, type),
                onContourClick: (e, ps, kps, cs, kcs, contourSets) => {
                    let msg = {
                        ev: e,
                        lat: e.lngLat.lat,
                        lng: e.lngLat.lng,
                        latLngs: ps.latLngs,
                        polygonSet: ps,
                        kpolygonSet: kps,
                        contourSet: cs,
                        kcontourSet: kcs,
                        contourSets,
                    }
                    if (isfun(cs.funSetsClick)) cs.funSetsClick(msg)
                    vo.activeContourSet = cs
                    vo.$nextTick(() => {
                        let el = vo.$refs.refContourPopupInner; if (!el || !el.innerHTML.trim()) return
                        vo.closeAllPopupsIfOnlyone()
                        vo.featurePopup = createDirectionalPopup(vo.map, e.lngLat, el, vo.popupPosition, 5, { maxWidth: 'none' })
                        vo.featurePopupOwner = `contourSets.${kcs}`
                    })
                },
                onContourEnter: (e, cs, kcs) => {
                    vo.activeContourSetTooltip = cs
                    vo.$nextTick(() => {
                        let el = vo.$refs.refContourTooltip; if (!el) return
                        let html = el.innerHTML.trim(); if (!html) return
                        vo.hideFeatureTooltip()
                        let container = document.createElement('div'); container.innerHTML = html
                        vo.featureTooltip = createDirectionalPopup(vo.map, e.lngLat, container, vo.tooltipPosition, 10, { closeButton: false, closeOnClick: false, maxWidth: 'none', className: 'wlv2-tooltip' })
                        vo.featureTooltipOwner = `contourSets.${kcs}`
                    })
                },
                onContourLeave: () => {
                    vo.hideFeatureTooltip()
                },
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.scheduleRaiseFeatureLayers()
        },

        // ===== 圖層顯隱 =====

        countVisible(arr) {
            return countVisible(arr)
        },

        changeItemsDebounce() {
            this.dbcChangeItems(() => {
                this.changeItems()
            })
        },
        changeItems() {
            this.items = buildItemsList(this.imageSets, this.pointSets, this.polylineSets, this.polygonSets, this.geojsonSets, this.contourSets)
        },

        //同步 opt 端 visible 到已正規化資料並回傳是否有變更。
        //各 changeXxxSets 的結構 diff 刻意 omit visible(避免面板寫回時雙重渲染),
        //外部「直接改 opt.xxxSets[k].visible」會走到 eff 相等的早退路徑, 故以此另行同步使其生效
        syncSetsVisible(normSets, rawSets, defVisible) {
            let changed = false
            each(normSets, (v, k) => {
                let b = get(rawSets, `${k}.visible`, null); if (!isbol(b)) b = defVisible
                if (v.visible !== b) {
                    v.visible = b; changed = true
                }
            })
            return changed
        },

        //將顯隱寫回 opt: 目標欄位可能原不存在(使用者未宣告 visible), 直接賦值不具響應性,
        //父層對 opt.xxxSets[i].visible 的 watcher/template 會收不到通知, 故用 $set(與 syncBaseMapsToOpt 同慣例)
        setOptVisibleReactive(updatePath, b) {
            let vo = this
            let owner = get(vo.opt, updatePath.replace(/\.visible$/, ''), null)
            if (isobj(owner)) vo.$set(owner, 'visible', b)
        },
        //僅重繪指定型別: 顯隱切換不需整批重跑六型別 renderer(重型別如 contour 之 calcContours
        //不應被無關切換觸發); 與「外部直改 opt.xxxSets[k].visible」路徑僅 render 自身型別的行為一致
        renderSetsByType(t) {
            let vo = this
            let m = {
                imageSets: () => vo.renderImageSets(),
                pointSets: () => vo.renderPointSets(),
                polylineSets: () => vo.renderPolylineSets(),
                polygonSets: () => vo.renderPolygonSets(),
                geojsonSets: () => vo.renderGeojsonSets(),
                contourSets: () => vo.renderContourSets(),
            }
            if (isfun(m[t])) m[t]()
        },

        toggleItemVisible(i) {
            let vo = this; let item = vo.items[i]; item.visible = !item.visible
            set(vo, item.updatePath, item.visible); vo.setOptVisibleReactive(item.updatePath, item.visible)
            if (!item.visible) {
                let setKey = item.updatePath.replace('.visible', '')
                vo.closePopupByOwner(setKey)
            }
            if (vo.map && vo.mapLoaded) vo.renderSetsByType(item.updatePath.split('.')[0])
        },

        // ===== Popup / Tooltip =====

        recheckPopupDirections() {
            let vo = this; if (!vo.map) return
            if (vo._popupResizing) return //拖曳 resize 中暫停翻轉, 避免重建摧毀拖曳 handler
            let fp = recheckSinglePopupDir(vo.map, vo.featurePopup); if (fp !== vo.featurePopup) vo.featurePopup = fp
            let ft = recheckSinglePopupDir(vo.map, vo.featureTooltip); if (ft !== vo.featureTooltip) vo.featureTooltip = ft
        },

        //resize 拖曳開始/結束: 暫停/恢復翻轉; 結束後補正一次方向
        onPopupResizingChange(v) {
            let vo = this
            vo._popupResizing = v
            if (!v && vo.map) vo.recheckPopupDirections()
        },

        showFeaturePopup(lngLat, featureData, type, setIndex) {
            let vo = this
            if (type === 'polyline') vo.activePolylineSet = featureData
            else if (type === 'polygon') vo.activePolygonSet = featureData
            else if (type === 'geojson') vo.activeGeojsonSet = featureData
            vo.$nextTick(() => {
                let refName = type === 'polyline' ? 'refPolylinePopupInner' : type === 'polygon' ? 'refPolygonPopupInner' : 'refGeojsonPopupInner'
                let el = vo.$refs[refName]; if (!el || !el.innerHTML.trim()) return
                vo.closeAllPopupsIfOnlyone()
                vo.featurePopup = createDirectionalPopup(vo.map, lngLat, el, vo.popupPosition, 5, { maxWidth: 'none' })
                vo.featurePopupOwner = `${type}Sets.${setIndex}`
            })
        },

        showFeatureTooltip(lngLat, featureData, type, setIndex) {
            let vo = this
            if (type === 'polyline') vo.activePolylineSetTooltip = featureData
            else if (type === 'polygon') vo.activePolygonSetTooltip = featureData
            else if (type === 'geojson') vo.activeGeojsonSetTooltip = featureData
            vo.$nextTick(() => {
                let refName = type === 'polyline' ? 'refPolylineTooltip' : type === 'polygon' ? 'refPolygonTooltip' : 'refGeojsonTooltip'
                let el = vo.$refs[refName]; if (!el) return
                let html = el.innerHTML.trim(); if (!html) return
                vo.hideFeatureTooltip()
                let container = document.createElement('div'); container.innerHTML = html
                vo.featureTooltip = createDirectionalPopup(vo.map, lngLat, container, vo.tooltipPosition, 10, { closeButton: false, closeOnClick: false, maxWidth: 'none', className: 'wlv2-tooltip' })
                vo.featureTooltipOwner = `${type}Sets.${setIndex}`
            })
        },

        hideFeatureTooltip() {
            if (this.featureTooltip) {
                this.featureTooltip.remove(); this.featureTooltip = null
            }
            this.featureTooltipOwner = ''
        },

        closePopup() {
            let vo = this
            if (vo.featurePopup) {
                vo.featurePopup.remove(); vo.featurePopup = null
            }
            vo.featurePopupOwner = ''
            vo.hideFeatureTooltip()
        },

        closePopupByOwner(setKey) {
            let vo = this
            //pointSets 之 owner 以 kid 記錄(索引因 keyed 重排會位移): 面板路徑傳入的「pointSets.<idx>」先轉譯為 kid 形式
            if (String(setKey).indexOf('pointSets.') === 0) {
                let idx = parseInt(String(setKey).slice('pointSets.'.length), 10)
                let kid = get(vo, ['pointSets', idx, 'kid'], null)
                if (isestr(kid)) setKey = `pointSets.k:${kid}`
            }
            if (vo.featurePopup && vo.featurePopupOwner === setKey) {
                vo.featurePopup.remove(); vo.featurePopup = null; vo.featurePopupOwner = ''
            }
            if (vo.featureTooltip && vo.featureTooltipOwner === setKey) {
                vo.featureTooltip.remove(); vo.featureTooltip = null; vo.featureTooltipOwner = ''
            }
        },

        closeAllPopupsIfOnlyone() {
            let vo = this
            // 任一時刻僅一個 featurePopup, 開新的前一律先關舊的(不受 displayPopupOnlyone 影響):
            // featurePopup 為單例變數, 若不關舊的就覆寫參考會造成舊 popup 殘留;
            // 且承載活 slot 元素時, 開新 popup 會把活元素自舊 popup 搬走 → 舊 popup 變空
            if (vo.featurePopup) {
                vo.featurePopup.remove(); vo.featurePopup = null
            }
            vo.featurePopupOwner = ''
        },

        // ===== 公開方法 =====

        getMapObject() {
            return _getMapObject(this.map)
        },

        panTo(latLng, opt = {}) {
            let vo = this
            let latLngNew = calcPanToCenter(vo.map, latLng, opt); if (!latLngNew) return
            vo.map.panTo([latLngNew[1], latLngNew[0]])
        },
        centerTo(ll) {
            this.panTo(ll)
        },

        popupPoint(obj) {
            let vo = this
            let point = get(obj, 'point', null); if (!isobj(point)) return null
            let ll = get(point, 'latLng', null); if (!isarr(ll)) return null
            let targetId = get(point, 'id', '')
            let { foundPt, foundPs, foundPsIndex } = findPointById(vo.pointSets, targetId)
            let ptData = foundPt || point; let psData = foundPs || {}
            let ptype = get(ptData, 'type', null) || get(psData, 'type', 'circle')
            vo.activePoint = ptData; vo.activePointSet = psData
            vo.$nextTick(() => {
                let refInner = vo.$refs.refPointPopupInner
                let hasLive = !!(refInner && refInner.innerHTML.trim())
                vo.closeAllPopupsIfOnlyone()
                let content
                if (hasLive) {
                    content = refInner // 有 slot: 用活元素(可互動)
                }
                else {
                    content = document.createElement('div') // 無 slot: 用靜態 fallback
                    content.innerHTML = `<div style="padding:8px"><b>${ptData.title || ''}</b><br/>${ptData.msg || ''}</div>`
                }
                let popGap = ptype === 'circle' ? (ptData.radius || get(psData, 'size', 10)) : 5
                vo.featurePopup = createDirectionalPopup(vo.map, [ll[1], ll[0]], content, vo.popupPosition, popGap, { maxWidth: 'none' })
                //owner 以組身分(kid)記錄(同 onPointClick): 索引因 keyed 重排會位移
                vo.featurePopupOwner = foundPsIndex >= 0 ? `pointSets.k:${get(vo, ['pointSets', foundPsIndex, 'kid'], foundPsIndex)}` : ''
            })
            return ll
        },

        popupFeatureById(id) {
            let vo = this
            let resolved = resolveFeatureById(id, vo.polylineSets, vo.polygonSets); if (!resolved) return null
            let { center, featureData, ownerPath, type } = resolved
            if (type === 'polyline') vo.activePolylineSet = featureData
            else if (type === 'polygon') vo.activePolygonSet = featureData
            vo.$nextTick(() => {
                let refName = type === 'polyline' ? 'refPolylinePopupInner' : 'refPolygonPopupInner'
                let el = vo.$refs[refName]
                let hasLive = !!(el && el.innerHTML.trim())
                vo.closeAllPopupsIfOnlyone()
                let content
                if (hasLive) {
                    content = el // 有 slot: 用活元素(可互動)
                }
                else {
                    content = document.createElement('div') // 無 slot: 用靜態 fallback
                    content.innerHTML = `<div style="padding:8px"><b>${featureData.title || ''}</b><br/>${featureData.msg || ''}</div>`
                }
                vo.featurePopup = createDirectionalPopup(vo.map, [center[1], center[0]], content, vo.popupPosition, 5, { maxWidth: 'none' })
                vo.featurePopupOwner = ownerPath
            })
            return center
        },

        modifyItemsVisible(fun) {
            let vo = this; if (!isfun(fun)) return
            let hiddenKeys = []
            let changedTypes = {} //僅重繪實際有顯隱變更的型別
            each(vo.items, (v, k) => {
                let b = fun(v, k)
                if (!b && v.visible) hiddenKeys.push(v.updatePath.replace('.visible', ''))
                if (v.visible !== b) changedTypes[v.updatePath.split('.')[0]] = true
                v.visible = b; set(vo, v.updatePath, b); vo.setOptVisibleReactive(v.updatePath, b)
            })
            each(hiddenKeys, (setKey) => {
                vo.closePopupByOwner(setKey)
            })
            if (vo.map && vo.mapLoaded) each(Object.keys(changedTypes), (t) => vo.renderSetsByType(t))
        },
    },
}
</script>

<style scoped>
/* 四角容器：flex column 自動堆疊，不重疊 */
.clsCorner { position:absolute; z-index:10; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
.clsCorner > * { pointer-events:auto; }
.clsCorner-topleft { top:10px; left:10px; align-items:flex-start; }
.clsCorner-topright { top:10px; right:10px; align-items:flex-end; }
.clsCorner-bottomleft { bottom:10px; left:10px; align-items:flex-start; }
.clsCorner-bottomright { bottom:10px; right:10px; align-items:flex-end; }

.clsPanel { display:flex; flex-direction:column; padding:3px 8px; box-shadow:0 0 15px rgba(0,0,0,0.2); border-radius:5px; font-size:0.8rem; font-family:'Microsoft JhengHei','Avenir','Helvetica'; }

/* 自訂縮放按鈕 */
.clsZoomBtn { width:30px; height:30px; border:none; background:rgba(255,255,255,0.95); cursor:pointer; font-size:1.2rem; font-weight:bold; display:flex; align-items:center; justify-content:center; }
.clsZoomBtn:hover { background:rgba(230,230,230,1); }

/* 比例尺 */
.clsScale { padding:2px 6px; font-size:0.7rem; border-radius:3px; }

::v-deep .maplibregl-popup-content { padding:0; border-radius:5px; }
/* 放大 popup 關閉按鈕（maplibre 預設過小不好點） */
::v-deep .maplibregl-popup-close-button {
    width:26px; height:26px; padding:0;
    font-size:22px; line-height:24px;
    border-radius:0 5px 0 5px;
}
::v-deep .maplibregl-popup-close-button:hover { background-color:rgba(0,0,0,0.08); }
/* tooltip 樣式：移除關閉按鈕 padding 並加上陰影，pointer-events:none 避免遮擋 canvas 事件造成閃爍 */
::v-deep .wlv2-tooltip { pointer-events: none; }
::v-deep .wlv2-tooltip .maplibregl-popup-content { padding:0; border-radius:5px; box-shadow:0 2px 8px rgba(0,0,0,0.25); }
/* 隱藏 maplibre 預設 control 容器 */
::v-deep .maplibregl-ctrl-top-left,
::v-deep .maplibregl-ctrl-top-right,
::v-deep .maplibregl-ctrl-bottom-left,
::v-deep .maplibregl-ctrl-bottom-right { display:none; }
</style>
