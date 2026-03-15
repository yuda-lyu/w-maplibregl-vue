<template>
    <div ref="root" style="display:inline-block; position:relative;" v-domresize @domresize="resize">
        <!-- 地圖容器 -->
        <div ref="mapContainer" style="width:100%; height:100%;"></div>

        <!-- 四角面板容器，面板依順序由上往下堆疊，不重疊 -->
        <div v-for="corner in corners" :key="corner" class="clsCorner" :class="'clsCorner-'+corner">

            <!-- 羅盤 -->
            <div v-if="panelCompassRose.show && panelCompassRose.position===corner"
                :style="{ order: getPanelOrder('panelCompassRose', corner), padding: panelCompassRose.withPanel ? '3px' : '0', background: panelCompassRose.withPanel ? panelBackgroundColor : 'transparent', borderRadius: '5px' }">
                <img :src="useIconCompassRose" :style="{ width: panelCompassRose.size+'px', height: panelCompassRose.size+'px', display:'block' }" />
            </div>

            <!-- 3D 指北針（含視角傾斜效果，點擊恢復 2D 正北） -->
            <div v-if="panelCompass3d.show && panelCompass3d.position===corner"
                @click="resetTo2d"
                :title="currentPitch > 0 ? 'Click to reset 2D north-up view' : 'Click to face north'"
                :style="{ order: getPanelOrder('panelCompass3d', corner), cursor:'pointer', display:'inline-block', lineHeight:'0' }">
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
            <div v-if="panelBaseMaps.show && panelBaseMaps.position===corner" class="clsPanel" :style="{ order: getPanelOrder('panelBaseMaps', corner), background: panelBackgroundColor }">
                <div :style="{ overflow:'auto', ...panelBaseMaps.style }" @wheel="handleWheel($event, panelBaseMaps)">
                    <div v-for="(bm, kbm) in panelBaseMaps.baseMaps" :key="'bm:'+kbm" style="padding:2px 0;">
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
                            <div style="display:flex; align-items:center; gap:4px; padding-left:20px; padding-top:2px; font-size:0.75rem;">
                                <input type="range" min="0" max="1" step="0.01" :value="bm.opacity != null ? bm.opacity : 1" :disabled="!bm.visible" @input="setOverlayOpacity(kbm, $event.target.value)" style="width:70px;" />
                                <span>{{ Math.round((bm.opacity != null ? bm.opacity : 1) * 100) }}%</span>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <!-- 圖層顯隱 -->
            <div v-if="panelItems.show && items.length>0 && panelItems.position===corner" class="clsPanel" :style="{ order: getPanelOrder('panelItems', corner), background: panelBackgroundColor }">
                <div :style="{ overflow:'auto', ...panelItems.style }" @wheel="handleWheel($event, panelItems)">
                    <div v-for="(item, ki) in items" :key="'item:'+ki" style="padding:2px 0;">
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
            <div v-if="panelLabels.show && panelLabels.position===corner" class="clsPanel" :style="{ order: getPanelOrder('panelLabels', corner), background: panelBackgroundColor }">
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
            <div v-if="panelZoom.show && panelZoom.position===corner" class="clsPanel" :style="{ order: getPanelOrder('panelZoom', corner), padding: '0' }">
                <button class="clsZoomBtn" @click="zoomIn" title="放大">+</button>
                <div style="border-top:1px solid #ccc;"></div>
                <button class="clsZoomBtn" @click="zoomOut" title="縮小">−</button>
            </div>

            <!-- 比例尺 -->
            <div v-if="panelScale.show && panelScale.position===corner" class="clsPanel clsScale" :style="{ order: getPanelOrder('panelScale', corner), background: 'rgba(0,0,0,0.6)', color:'#fff' }">
                <div style="display:flex; align-items:center; gap:4px;">
                    <div style="width:80px; height:3px; background:#fff; border:1px solid #fff;"></div>
                    <span>{{ scaleText }}</span>
                </div>
            </div>

            <!-- 圖例區（等值線用） -->
            <div v-if="panelLegends.show && countVisible(contourSets)>0 && panelLegends.position===corner" class="clsPanel" :style="{ order: getPanelOrder('panelLegends', corner), background: panelBackgroundColor }">
                <div :style="{ display:'flex', alignItems:'flex-start', overflow:'auto', ...panelLegends.style }" @wheel="handleWheel($event, panelLegends)">
                    <template v-for="(contourSet, kcontourSet) in contourSets">
                        <div style="white-space:nowrap;" :key="'contourSet:'+kcontourSet" v-if="contourSet.visible">
                            <div style="padding:4px 6px;">
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
                    </template>
                </div>
            </div>

        </div>

        <!-- 隱藏的 slot 容器：用來承載外部傳入的 popup/tooltip slot 內容 -->
        <div style="display:none;">
            <!-- point popup -->
            <div ref="refPointPopup">
                <slot name="point-popup"
                    :point="activePoint"
                    :pointSet="activePointSet"
                ></slot>
            </div>
            <!-- point tooltip -->
            <div ref="refPointTooltip">
                <slot name="point-tooltip"
                    :point="activePoint"
                    :pointSet="activePointSet"
                ></slot>
            </div>
            <!-- polyline popup -->
            <div ref="refPolylinePopup">
                <slot name="polyline-popup"
                    :polylineSet="activePolylineSet"
                    :polylineSets="polylineSets"
                ></slot>
            </div>
            <!-- polyline tooltip -->
            <div ref="refPolylineTooltip">
                <slot name="polyline-tooltip"
                    :polylineSet="activePolylineSet"
                    :polylineSets="polylineSets"
                ></slot>
            </div>
            <!-- polygon popup -->
            <div ref="refPolygonPopup">
                <slot name="polygon-popup"
                    :polygonSet="activePolygonSet"
                    :polygonSets="polygonSets"
                ></slot>
            </div>
            <!-- polygon tooltip -->
            <div ref="refPolygonTooltip">
                <slot name="polygon-tooltip"
                    :polygonSet="activePolygonSet"
                    :polygonSets="polygonSets"
                ></slot>
            </div>
            <!-- geojson popup -->
            <div ref="refGeojsonPopup">
                <slot name="geojson-popup"
                    :geojsonSet="activeGeojsonSet"
                    :geojsonSets="geojsonSets"
                ></slot>
            </div>
            <!-- geojson tooltip -->
            <div ref="refGeojsonTooltip">
                <slot name="geojson-tooltip"
                    :geojsonSet="activeGeojsonSet"
                    :geojsonSets="geojsonSets"
                ></slot>
            </div>
            <!-- contour popup -->
            <div ref="refContourPopup">
                <slot name="contour-popup"
                    :contourSet="activeContourSet"
                    :contourSets="contourSets"
                ></slot>
            </div>
            <!-- contour tooltip -->
            <div ref="refContourTooltip">
                <slot name="contour-tooltip"
                    :contourSet="activeContourSet"
                    :contourSets="contourSets"
                ></slot>
            </div>
        </div>

    </div>
</template>

<script>
/**
 * WMaplibreglVue2 - 使用 MapLibre GL JS 重構的地圖組件（Vue 2）
 * 所有面板透過四角容器 (corner container) 自動堆疊，不重疊。
 *
 * 核心業務邏輯已提取至 src/js/ 模組，此元件僅保留：
 *   - 響應式狀態（data / computed / watch）
 *   - 薄委派方法（調用模組函式 + 同步 Vue 狀態）
 *   - Vue 特定操作（$nextTick / $refs / $forceUpdate）
 */
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
import isearr from 'wsemi/src/isearr.mjs'
import dig from 'wsemi/src/dig.mjs'
import debounce from 'wsemi/src/debounce.mjs'
import domResize from 'w-component-vue/src/js/domResize.mjs'
import 'maplibre-gl/dist/maplibre-gl.css'
import defBaseMaps from '../defBaseMaps.mjs'
import defTerrainMap from '../defTerrainMap.mjs'
import uiRes from '../uiRes.mjs'

// ===== 提取的功能模組 =====
import { createMap, applyProjection as _applyProjection } from '../js/mapCore.mjs'
import { applyBaseMaps, applyTerrain, switchBaseMap as _switchBaseMap, toggleOverlayVisible as _toggleOverlayVisible, setOverlayOpacity as _setOverlayOpacity } from '../js/basemapManager.mjs'
import { computeBasicOpt, computePanelBaseMaps, computePanelCompassRose, computePanelCompass3d, computePanelLabels, computePanelItems, computePanelZoom, computePanelScale, computePanelLegends, computeClusterOpts } from '../js/configProcessor.mjs'
import { clearTrackedByPrefix, clearTrackedMarkersByPrefix, buildItemsList, countVisible } from '../js/layerVisibility.mjs'
import { createDirectionalPopup, recheckSinglePopupDir, registerIconImage } from '../js/popupManager.mjs'
import { renderPointSets as renderPointSetsImpl, renderPolylineSets as renderPolylineSetsImpl, renderPolygonSets as renderPolygonSetsImpl, renderGeojsonSets as renderGeojsonSetsImpl, renderImageSets as renderImageSetsImpl, renderContourSets as renderContourSetsImpl } from '../js/layerRenderers.mjs'
import { getMapObject as _getMapObject, calcPanToCenter, findPointById, resolveFeatureById } from '../js/publicApi.mjs'


const defPanelsOrder = ['panelBaseMaps', 'panelLabels', 'panelScale', 'panelCompassRose', 'panelCompass3d', 'panelZoom', 'panelItems', 'panelLegends']


export default {
    directives: { domresize: domResize() },
    props: {
        opt: {
            type: Object,
            default: () => ({})
        }
    },
    data() {
        return {
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
            trackedMarkers: [],

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

            baseMapsDataTemp: [],
            contourSubCounts: {}, // { [kcs]: Number } 等值線子層數量追蹤
            featureIdCounter: 0,
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
            let lat = this.currentCenter[0] || 23.5
            let mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, this.currentZoom)
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
    },
    methods: {

        // ===== 初始化 =====

        initMap() {
            let vo = this
            vo.map = createMap(vo.$refs.mapContainer, vo.opt)
            vo.currentZoom = vo.map.getZoom()

            vo.map.on('load', () => {
                vo.mapLoaded = true
                vo.applyProjection()
                vo.applyBaseMaps()
                vo.applyTerrain()
                vo.ensureDataProcessed()
                vo.applyAllDataLayers()
            })
            vo.map.on('mousemove', (e) => {
                vo.showLoc = { lat: dig(e.lngLat.lat, 7), lng: dig(e.lngLat.lng, 7) }
            })
            vo.map.on('zoomend', () => {
                let z = vo.map.getZoom(); vo.opt.zoom = z; vo.currentZoom = z
                if (vo.projection === '') vo.applyProjection()
            })
            vo.map.on('moveend', () => {
                let c = vo.map.getCenter(); let nc = [c.lat, c.lng]
                if (!isEqual(vo.opt.center, nc)) vo.opt.center = nc
                vo.currentCenter = nc
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
            applyBaseMaps(this.map, get(this, 'panelBaseMaps.baseMaps', []))
        },
        applyTerrain() {
            applyTerrain(this.map, this.terrainMap, this.trackedLayerIds)
        },

        switchBaseMap(idx) {
            _switchBaseMap(this.map, this.panelBaseMaps.baseMaps, idx)
            this.$forceUpdate()
        },
        toggleOverlayVisible(idx) {
            _toggleOverlayVisible(this.map, this.panelBaseMaps.baseMaps, idx)
            this.$forceUpdate()
        },
        setOverlayOpacity(idx, val) {
            _setOverlayOpacity(this.map, this.panelBaseMaps.baseMaps, idx, val)
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
            if (vo.currentZoom !== basic.zoom) {
                vo.currentZoom = basic.zoom; if (vo.map) vo.map.setZoom(basic.zoom)
            }
            if (!isEqual(vo.currentCenter, basic.center)) {
                vo.currentCenter = basic.center
                if (vo.map) vo.map.panTo([basic.center[1], basic.center[0]])
            }
            vo.showLoc = { lat: dig(basic.center[0], 7), lng: dig(basic.center[1], 7) }
            vo.displayPopupOnlyone = basic.displayPopupOnlyone
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
                vo.trackedMarkers = clearTrackedMarkersByPrefix('point', vo.trackedMarkers)
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
                if (vo.map && vo.mapLoaded) vo.applyProjection()
            }

            vo.changeItemsDebounce('changeOpt')
        },

        processPanelBaseMaps() {
            let vo = this
            let result = computePanelBaseMaps(vo.opt, get(vo, 'panelBaseMaps.baseMaps', []), vo.terrainMapTemp, vo.baseMapsDataTemp, defBaseMaps, defTerrainMap)
            vo.terrainMapTemp = cloneDeep(result.terrainMap)
            vo.terrainMap = result.terrainMap
            vo.panelBaseMaps = result.panelBaseMaps
            vo.panelBaseMapsTemp = cloneDeep(result.panelBaseMaps)
            if (result.baseMapsChanged) {
                vo.baseMapsDataTemp = cloneDeep(result.panelBaseMaps.baseMaps)
                if (vo.map && vo.mapLoaded) vo.applyBaseMaps()
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

        clearTrackedByPrefix(prefix) {
            let t = clearTrackedByPrefix(this.map, prefix, this.trackedLayerIds, this.trackedSourceIds)
            this.trackedLayerIds = t.layerIds; this.trackedSourceIds = t.sourceIds
        },

        clearTrackedMarkersByPrefix(prefix) {
            this.trackedMarkers = clearTrackedMarkersByPrefix(prefix, this.trackedMarkers)
        },

        // -- 點 --
        changePointSetsDebounce() {
            this.dbcChangePointSets(() => {
                this.changePointSets()
            })
        },
        changePointSets() {
            let vo = this
            let sets = get(vo, 'opt.pointSets', null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible')); if (isEqual(vo.effPointSetsTemp, eff)) return; vo.effPointSetsTemp = eff
            let fc = get(vo, 'opt.pointSetsClick', null)
            vo.pointSets = map(sets, (ps, kps) => {
                if (!isestr(get(ps, 'title', null))) ps.title = ''; if (!isestr(get(ps, 'msg', null))) ps.msg = ''
                if (!isNumber(get(ps, 'order', null))) ps.order = null; if (!isbol(get(ps, 'visible', null))) ps.visible = true
                let sz = get(ps, 'size', 10); let fl = get(ps, 'fillColor', 'rgba(0,150,255,0.65)'); let lc = get(ps, 'lineColor', 'rgba(255,255,255,1)'); let lw = get(ps, 'lineWidth', 1)
                ps.points = map(ps.points, (pt, kpt) => {
                    if (isearr(pt)) pt = { latLng: [get(pt, 0), get(pt, 1)] }
                    if (!isestr(get(pt, 'title', null))) pt.title = ''; if (!isestr(get(pt, 'msg', null))) pt.msg = ''
                    return { id: `pointSet-${kps}-point-${kpt}`, ...pt, radius: get(pt, 'size', null) || sz, fillColor: get(pt, 'fillColor', null) || fl, lineColor: get(pt, 'lineColor', null) || lc, lineWidth: get(pt, 'lineWidth', null) || lw, funSetsClick: fc }
                })
                return { id: `pointSet-${kps}`, ...ps, funSetsClick: fc }
            })
            vo.changeItemsDebounce('changePointSets')
            if (vo.map) {
                if (vo.mapLoaded) {
                    vo.renderPointSets()
                }
                else {
                    vo.map.once('idle', () => {
                        vo.renderPointSets()
                    })
                }
            }
        },

        renderPointSets() {
            let vo = this
            // 過渡期清理：移除舊的 DOM markers
            vo.trackedMarkers = clearTrackedMarkersByPrefix('point', vo.trackedMarkers)
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds, markers: vo.trackedMarkers }
            let fCtr = { value: vo.featureIdCounter || 0 }
            renderPointSetsImpl(vo.map, vo.pointSets, vo.clusterOpts, tracked, {
                registerIcon: (key, src, w, h) => registerIconImage(vo.map, key, src, w, h),
                getPointData: (kps, kpt) => get(vo, `pointSets.${kps}.points.${kpt}`, null),
                getPointSetData: (kps) => get(vo, `pointSets.${kps}`, null),
                onPointClick: (ptData, psData, p, coords) => {
                    if (isfun(ptData.funSetsClick)) ptData.funSetsClick({ point: ptData, pointSet: psData, pointSets: vo.pointSets })
                    let popAnchor = get(ptData, 'popupAnchor', null) || get(psData, 'popupAnchor', null)
                    if (!isarr(popAnchor) || popAnchor.length < 2) {
                        if (p._ptype === 'circle') {
                            let r = p._radius || get(psData, 'size', 10); popAnchor = [0, -(r / 1.0)]
                        }
                        else {
                            popAnchor = get(ptData, '_defPopupAnchor', null)
                            if (!isarr(popAnchor)) {
                                let iSz = get(ptData, 'iconSize', null) || get(psData, 'iconSize', null) || [25, 41]
                                popAnchor = [0, -(iSz[1] / 1.0)]
                            }
                        }
                    }
                    vo.activePoint = ptData; vo.activePointSet = psData
                    vo.$nextTick(() => {
                        let refEl = vo.$refs.refPointPopup; if (!refEl) return
                        let html = refEl.innerHTML.trim(); if (!html) return
                        vo.closeAllPopupsIfOnlyone()
                        let ct = document.createElement('div'); ct.innerHTML = html
                        vo.featurePopup = createDirectionalPopup(vo.map, coords, ct, vo.popupPosition, 0, { maxWidth: 'none' }, popAnchor)
                        vo.featurePopupOwner = `pointSets.${p._kps}`
                    })
                },
                onPointEnter: (ptData, psData, p, coords) => {
                    let tipAnchor = get(ptData, 'tooltipAnchor', null) || get(psData, 'tooltipAnchor', null)
                    if (!isarr(tipAnchor) || tipAnchor.length < 2) {
                        if (p._ptype === 'circle') {
                            tipAnchor = [0, 0]
                        }
                        else {
                            tipAnchor = get(ptData, '_defTooltipAnchor', null)
                            if (!isarr(tipAnchor)) {
                                let iSz = get(ptData, 'iconSize', null) || get(psData, 'iconSize', null) || [25, 41]
                                tipAnchor = [0, -(iSz[1] / 1.0)]
                            }
                        }
                    }
                    vo.activePoint = ptData; vo.activePointSet = psData
                    vo.$nextTick(() => {
                        let refEl = vo.$refs.refPointTooltip; if (!refEl) return
                        let html = refEl.innerHTML.trim(); if (!html) return
                        vo.hideFeatureTooltip()
                        let ct = document.createElement('div'); ct.innerHTML = html
                        vo.featureTooltip = createDirectionalPopup(vo.map, coords, ct, vo.tooltipPosition, 0, { closeButton: false, closeOnClick: false, maxWidth: 'none', className: 'wlv2-tooltip' }, tipAnchor)
                        vo.featureTooltipOwner = `pointSets.${p._kps}`
                    })
                },
                onPointLeave: () => {
                    vo.hideFeatureTooltip()
                },
            }, {
                src: uiRes.iconPoint,
                size: [24, 40],
                key: 'point-icon-default',
            }, fCtr)
            vo.trackedSourceIds = tracked.sourceIds
            vo.trackedLayerIds = tracked.layerIds
            vo.trackedMarkers = tracked.markers
            vo.featureIdCounter = fCtr.value
        },

        // -- 折線 --
        changePolylineSetsDebounce() {
            this.dbcChangePolylineSets(() => {
                this.changePolylineSets()
            })
        },
        changePolylineSets() {
            let vo = this; let sets = get(vo, 'opt.polylineSets', null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible')); if (isEqual(vo.effPolylineSetsTemp, eff)) return; vo.effPolylineSetsTemp = eff
            let fc = get(vo, 'opt.polylineSetsClick', null)
            vo.polylineSets = map(sets, (pls, k) => {
                if (!isestr(get(pls, 'title', null))) pls.title = ''; if (!isestr(get(pls, 'msg', null))) pls.msg = ''
                if (!isNumber(get(pls, 'order', null))) pls.order = null; if (!isbol(get(pls, 'visible', null))) pls.visible = true
                let lc = get(pls, 'lineColor', null); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                let lw = get(pls, 'lineWidth', null); if (!isNumber(lw)) lw = 3
                return { id: `polylineSet-${k}`, ...pls, lineColor: lc, lineWidth: lw, funSetsClick: fc }
            })
            vo.changeItemsDebounce('changePolylineSets'); if (vo.map && vo.mapLoaded) vo.renderPolylineSets()
        },
        renderPolylineSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            let fCtr = { value: vo.featureIdCounter || 0 }
            renderPolylineSetsImpl(vo.map, vo.polylineSets, tracked, {
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            }, fCtr)
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.featureIdCounter = fCtr.value
        },

        // -- 多邊形 --
        changePolygonSetsDebounce() {
            this.dbcChangePolygonSets(() => {
                this.changePolygonSets()
            })
        },
        changePolygonSets() {
            let vo = this; let sets = get(vo, 'opt.polygonSets', null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible')); if (isEqual(vo.effPolygonSetsTemp, eff)) return; vo.effPolygonSetsTemp = eff
            let fc = get(vo, 'opt.polygonSetsClick', null)
            vo.polygonSets = map(sets, (pg, k) => {
                if (!isestr(get(pg, 'title', null))) pg.title = ''; if (!isestr(get(pg, 'msg', null))) pg.msg = ''
                if (!isNumber(get(pg, 'order', null))) pg.order = null; if (!isbol(get(pg, 'visible', null))) pg.visible = true
                let lc = get(pg, 'lineColor', 'rgba(0,150,255,1)'); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                let lw = get(pg, 'lineWidth', 3); if (!isNumber(lw)) lw = 3
                let fl = get(pg, 'fillColor', 'rgba(0,150,255,0.25)'); if (!isestr(fl)) fl = 'rgba(0,150,255,0.25)'
                return { id: `polygonSet-${k}`, ...pg, lineColor: lc, lineWidth: lw, fillColor: fl, funSetsClick: fc }
            })
            vo.changeItemsDebounce('changePolygonSets'); if (vo.map && vo.mapLoaded) vo.renderPolygonSets()
        },
        renderPolygonSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            let fCtr = { value: vo.featureIdCounter || 0 }
            renderPolygonSetsImpl(vo.map, vo.polygonSets, tracked, {
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            }, fCtr)
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.featureIdCounter = fCtr.value
        },

        // -- GeoJSON --
        changeGeojsonSetsDebounce() {
            this.dbcChangeGeojsonSets(() => {
                this.changeGeojsonSets()
            })
        },
        changeGeojsonSets() {
            let vo = this; let sets = get(vo, 'opt.geojsonSets', null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible')); if (isEqual(vo.effGeojsonSetsTemp, eff)) return; vo.effGeojsonSetsTemp = eff
            let fc = get(vo, 'opt.geojsonSetsClick', null)
            vo.geojsonSets = map(sets, (gj, k) => {
                if (!isestr(get(gj, 'title', null))) gj.title = ''; if (!isestr(get(gj, 'msg', null))) gj.msg = ''
                if (!isNumber(get(gj, 'order', null))) gj.order = null; if (!isbol(get(gj, 'visible', null))) gj.visible = true
                let lc = get(gj, 'lineColor', 'rgba(0,150,255,1)'); if (!isestr(lc)) lc = 'rgba(0,150,255,1)'
                let lw = get(gj, 'lineWidth', 3); if (!isNumber(lw)) lw = 3
                let fl = get(gj, 'fillColor', 'rgba(0,150,255,0.25)'); if (!isestr(fl)) fl = 'rgba(0,150,255,0.25)'
                return { id: `geojsonSet-${k}`, ...gj, lineColor: lc, lineWidth: lw, fillColor: fl, funSetsClick: fc }
            })
            vo.changeItemsDebounce('changeGeojsonSets'); if (vo.map && vo.mapLoaded) vo.renderGeojsonSets()
        },
        renderGeojsonSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            renderGeojsonSetsImpl(vo.map, vo.geojsonSets, tracked, {
                onPopupClick: (lngLat, fd, type, idx) => vo.showFeaturePopup(lngLat, fd, type, idx),
                onTooltipEnter: (lngLat, fd, type, idx) => vo.showFeatureTooltip(lngLat, fd, type, idx),
                onTooltipLeave: () => vo.hideFeatureTooltip(),
            })
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
        },

        // -- 影像 --
        changeImageSetsDebounce() {
            this.dbcChangeImageSets(() => {
                this.changeImageSets()
            })
        },
        changeImageSets() {
            let vo = this; let sets = get(vo, 'opt.imageSets', null); if (!isarr(sets)) sets = []; sets = cloneDeep(sets)
            let eff = map(sets, (v) => omit(v, 'visible')); if (isEqual(vo.effImageSetsTemp, eff)) return; vo.effImageSetsTemp = eff
            vo.imageSets = map(sets, (im, k) => {
                if (!isestr(get(im, 'title', null))) im.title = ''; if (!isestr(get(im, 'msg', null))) im.msg = ''
                if (!isNumber(get(im, 'order', null))) im.order = null; if (!isbol(get(im, 'visible', null))) im.visible = false
                return { id: `imageSet-${k}`, ...im }
            })
            vo.changeItemsDebounce('changeImageSets'); if (vo.map && vo.mapLoaded) vo.renderImageSets()
        },
        renderImageSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            renderImageSetsImpl(vo.map, vo.imageSets, tracked)
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
        },

        // -- 等值線 --
        changeContourSetsDebounce() {
            this.dbcChangeContourSets(() => {
                this.changeContourSets()
            })
        },
        changeContourSets() {
            let vo = this
            let contourSets = get(vo, 'opt.contourSets', null); if (!isarr(contourSets)) contourSets = []
            contourSets = cloneDeep(contourSets)
            let effContourSets = map(contourSets, (v) => omit(v, 'visible'))
            if (isEqual(vo.effContourSetsTemp, effContourSets)) return
            vo.effContourSetsTemp = effContourSets
            let funSetsClick = get(vo, 'opt.contourSetsClick', null)
            vo.contourSets = map(contourSets, (contourSet, kcontourSet) => {
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
            vo.changeItemsDebounce('changeContourSets')
            if (vo.map && vo.mapLoaded) vo.renderContourSets()
        },
        renderContourSets() {
            let vo = this
            let tracked = { sourceIds: vo.trackedSourceIds, layerIds: vo.trackedLayerIds }
            let fCtr = { value: vo.featureIdCounter || 0 }
            renderContourSetsImpl(vo.map, vo.contourSets, tracked, vo.contourSubCounts, {
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
                        let el = vo.$refs.refContourPopup; if (!el) return
                        let html = el.innerHTML.trim(); if (!html) return
                        vo.closeAllPopupsIfOnlyone()
                        let container = document.createElement('div'); container.innerHTML = html
                        vo.featurePopup = createDirectionalPopup(vo.map, e.lngLat, container, vo.popupPosition, 5, { maxWidth: 'none' })
                        vo.featurePopupOwner = `contourSets.${kcs}`
                    })
                },
                onContourEnter: (e, cs, kcs) => {
                    vo.activeContourSet = cs
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
            }, fCtr)
            vo.trackedSourceIds = tracked.sourceIds; vo.trackedLayerIds = tracked.layerIds
            vo.featureIdCounter = fCtr.value
        },

        // ===== 圖層顯隱 =====

        countVisible(arr) {
            return countVisible(arr)
        },

        changeItemsDebounce(from) {
            this.dbcChangeItems(() => {
                this.changeItems(from)
            })
        },
        changeItems() {
            this.items = buildItemsList(this.imageSets, this.pointSets, this.polylineSets, this.polygonSets, this.geojsonSets, this.contourSets)
        },

        toggleItemVisible(i) {
            let vo = this; let item = vo.items[i]; item.visible = !item.visible
            set(vo, item.updatePath, item.visible); set(vo.opt, item.updatePath, item.visible)
            if (!item.visible) {
                let setKey = item.updatePath.replace('.visible', '')
                vo.closePopupByOwner(setKey)
            }
            if (vo.map && vo.mapLoaded) vo.applyAllDataLayers()
        },

        // ===== Popup / Tooltip =====

        recheckPopupDirections() {
            let vo = this; if (!vo.map) return
            let fp = recheckSinglePopupDir(vo.map, vo.featurePopup); if (fp !== vo.featurePopup) vo.featurePopup = fp
            let ft = recheckSinglePopupDir(vo.map, vo.featureTooltip); if (ft !== vo.featureTooltip) vo.featureTooltip = ft
        },

        showFeaturePopup(lngLat, featureData, type, setIndex) {
            let vo = this
            if (type === 'polyline') vo.activePolylineSet = featureData
            else if (type === 'polygon') vo.activePolygonSet = featureData
            else if (type === 'geojson') vo.activeGeojsonSet = featureData
            vo.$nextTick(() => {
                let refName = type === 'polyline' ? 'refPolylinePopup' : type === 'polygon' ? 'refPolygonPopup' : 'refGeojsonPopup'
                let el = vo.$refs[refName]; if (!el) return
                let html = el.innerHTML.trim(); if (!html) return
                vo.closeAllPopupsIfOnlyone()
                let container = document.createElement('div'); container.innerHTML = html
                vo.featurePopup = createDirectionalPopup(vo.map, lngLat, container, vo.popupPosition, 5, { maxWidth: 'none' })
                vo.featurePopupOwner = `${type}Sets.${setIndex}`
            })
        },

        showFeatureTooltip(lngLat, featureData, type, setIndex) {
            let vo = this
            if (type === 'polyline') vo.activePolylineSet = featureData
            else if (type === 'polygon') vo.activePolygonSet = featureData
            else if (type === 'geojson') vo.activeGeojsonSet = featureData
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
            each(vo.trackedMarkers, (m) => {
                let p = m.getPopup(); if (p && p.isOpen()) p.remove()
            })
            if (vo.featurePopup) {
                vo.featurePopup.remove(); vo.featurePopup = null
            }
            vo.featurePopupOwner = ''
            vo.hideFeatureTooltip()
        },

        closePopupByOwner(setKey) {
            let vo = this
            if (vo.featurePopup && vo.featurePopupOwner === setKey) {
                vo.featurePopup.remove(); vo.featurePopup = null; vo.featurePopupOwner = ''
            }
            if (vo.featureTooltip && vo.featureTooltipOwner === setKey) {
                vo.featureTooltip.remove(); vo.featureTooltip = null; vo.featureTooltipOwner = ''
            }
        },

        closeAllPopupsIfOnlyone() {
            let vo = this
            if (!vo.displayPopupOnlyone) return
            each(vo.trackedMarkers, (m) => {
                let p = m.getPopup(); if (p && p.isOpen()) p.remove()
            })
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
                let refEl = vo.$refs.refPointPopup
                let html = refEl ? refEl.innerHTML.trim() : ''
                if (!html) html = `<div style="padding:8px"><b>${ptData.title || ''}</b><br/>${ptData.msg || ''}</div>`
                vo.closeAllPopupsIfOnlyone()
                let ct = document.createElement('div'); ct.innerHTML = html
                let popGap = ptype === 'circle' ? (ptData.radius || get(psData, 'size', 10)) : 5
                vo.featurePopup = createDirectionalPopup(vo.map, [ll[1], ll[0]], ct, vo.popupPosition, popGap, { maxWidth: 'none' })
                vo.featurePopupOwner = foundPsIndex >= 0 ? `pointSets.${foundPsIndex}` : ''
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
                let refName = type === 'polyline' ? 'refPolylinePopup' : 'refPolygonPopup'
                let el = vo.$refs[refName]
                let html = el ? el.innerHTML.trim() : ''
                if (!html) html = `<div style="padding:8px"><b>${featureData.title || ''}</b><br/>${featureData.msg || ''}</div>`
                vo.closeAllPopupsIfOnlyone()
                let ct = document.createElement('div'); ct.innerHTML = html
                vo.featurePopup = createDirectionalPopup(vo.map, [center[1], center[0]], ct, vo.popupPosition, 5, { maxWidth: 'none' })
                vo.featurePopupOwner = ownerPath
            })
            return center
        },

        modifyItemsVisible(fun) {
            let vo = this; if (!isfun(fun)) return
            let hiddenKeys = []
            each(vo.items, (v, k) => {
                let b = fun(v, k)
                if (!b && v.visible) hiddenKeys.push(v.updatePath.replace('.visible', ''))
                v.visible = b; set(vo, v.updatePath, b); set(vo.opt, v.updatePath, b)
            })
            each(hiddenKeys, (setKey) => {
                vo.closePopupByOwner(setKey)
            })
            if (vo.map && vo.mapLoaded) vo.applyAllDataLayers()
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
/* tooltip 樣式：移除關閉按鈕 padding 並加上陰影，pointer-events:none 避免遮擋 canvas 事件造成閃爍 */
::v-deep .wlv2-tooltip { pointer-events: none; }
::v-deep .wlv2-tooltip .maplibregl-popup-content { padding:0; border-radius:5px; box-shadow:0 2px 8px rgba(0,0,0,0.25); }
/* 隱藏 maplibre 預設 control 容器 */
::v-deep .maplibregl-ctrl-top-left,
::v-deep .maplibregl-ctrl-top-right,
::v-deep .maplibregl-ctrl-bottom-left,
::v-deep .maplibregl-ctrl-bottom-right { display:none; }
</style>
