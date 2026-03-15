<template>
    <div>


        <template v-if="!isNarrow">
            <a href="https://github.com/yuda-lyu/w-maplibregl-vue" class="github-corner" style="position:fixed; top:0; right:0; border:0; z-index:10000;" aria-label="View source on GitHub" target="_blank">
                <svg width="80" height="80" viewBox="0 0 250 250" style="fill:rgba(0,0,0,0.25); color:#fff; position: absolute; top: 0; border: 0; right: 0;" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg>
            </a>
        </template>


        <div style="">

            <div style="padding:0px 80px 0px 10px; border-bottom:1px solid #ddd;">
                <template v-for="(m,km) in mainCmps">

                    <div
                        :key="km"
                        style="display:inline-block; margin:10px 0px 0px 0px;"
                    >
                        <div
                            :class="`clsBtn clsMainMenu-basic ${km===showMainCmp?'clsMainMenu-active':'clsMainMenu'}`"
                            @click="showMainCmp=km"
                        >
                            {{km}}
                        </div>
                    </div>

                </template>
            </div>

            <div style="padding:0px 80px 10px 0px; border-bottom:1px solid #ddd;">
                <template v-for="(s,ks) in nowSubCmps">
                    <div
                        :key="ks"
                        style="display:inline-block; margin:10px 0px 0px 10px;"
                    >
                        <div
                            :class="`clsBtn clsSubMenu-basic ${s===showSubCmp?'clsSubMenu-active':'clsSubMenu'}`"
                            @click="showSubCmp=s"
                        >
                            {{s}}
                        </div>
                    </div>
                </template>
            </div>

        </div>


        <div class="bkh">

            <AppBSCSize v-if="showSubCmp==='size'"></AppBSCSize>

            <AppBSCCenter v-if="showSubCmp==='center'"></AppBSCCenter>

            <AppBSCZoom v-if="showSubCmp==='zoom'"></AppBSCZoom>

            <AppBSCPanelBackgroundColor v-if="showSubCmp==='panelBackgroundColor'"></AppBSCPanelBackgroundColor>

            <AppPBMShow v-if="showSubCmp==='panelBaseMaps.show'"></AppPBMShow>

            <AppPBMBaseMaps v-if="showSubCmp==='panelBaseMaps.baseMaps'"></AppPBMBaseMaps>

            <AppPBMPosition v-if="showSubCmp==='panelBaseMaps.position'"></AppPBMPosition>

            <AppPBMWidth v-if="showSubCmp==='panelBaseMaps.width'"></AppPBMWidth>

            <AppPBMMaxWidth v-if="showSubCmp==='panelBaseMaps.maxWidth'"></AppPBMMaxWidth>

            <AppPBMMaxHeight v-if="showSubCmp==='panelBaseMaps.maxHeight'"></AppPBMMaxHeight>

            <AppPSCShow v-if="showSubCmp==='panelScale.show'"></AppPSCShow>

            <AppPSCPosition v-if="showSubCmp==='panelScale.position'"></AppPSCPosition>

            <AppPCRShow v-if="showSubCmp==='panelCompassRose.show'"></AppPCRShow>

            <AppPCRPosition v-if="showSubCmp==='panelCompassRose.position'"></AppPCRPosition>

            <AppPCRSize v-if="showSubCmp==='panelCompassRose.size'"></AppPCRSize>

            <AppPCRWithPanel v-if="showSubCmp==='panelCompassRose.withPanel'"></AppPCRWithPanel>

            <AppPCRIconSrcDarkLight v-if="showSubCmp==='panelCompassRose.iconSrcDark,iconSrcLight'"></AppPCRIconSrcDarkLight>

            <AppPC3Show v-if="showSubCmp==='panelCompass3d.show'"></AppPC3Show>

            <AppPC3Position v-if="showSubCmp==='panelCompass3d.position'"></AppPC3Position>

            <AppPLBShow v-if="showSubCmp==='panelLabels.show'"></AppPLBShow>

            <AppPLBPosition v-if="showSubCmp==='panelLabels.position'"></AppPLBPosition>

            <AppPLBTitle v-if="showSubCmp==='panelLabels.title'"></AppPLBTitle>

            <AppPLBLng v-if="showSubCmp==='panelLabels.lng'"></AppPLBLng>

            <AppPLBLat v-if="showSubCmp==='panelLabels.lat'"></AppPLBLat>

            <AppPLBZoom v-if="showSubCmp==='panelLabels.zoom'"></AppPLBZoom>

            <AppPLBUseItems v-if="showSubCmp==='panelLabels.useItems'"></AppPLBUseItems>

            <AppPZMShow v-if="showSubCmp==='panelZoom.show'"></AppPZMShow>

            <AppPZMPosition v-if="showSubCmp==='panelZoom.position'"></AppPZMPosition>

            <AppPNTPointSets v-if="showSubCmp==='pointSets'"></AppPNTPointSets>

            <AppPNTPointSetPointByArray v-if="showSubCmp==='pointSet-pointByArray'"></AppPNTPointSetPointByArray>

            <AppPNTPointSetChangeData v-if="showSubCmp==='pointSet-changeData'"></AppPNTPointSetChangeData>

            <AppPNTPointSetOrder v-if="showSubCmp==='pointSet.order'"></AppPNTPointSetOrder>

            <AppPNTPointSetLineColor v-if="showSubCmp==='pointSet.lineColor'"></AppPNTPointSetLineColor>

            <AppPNTPointSetLineWidth v-if="showSubCmp==='pointSet.lineWidth'"></AppPNTPointSetLineWidth>

            <AppPNTPointSetFillColor v-if="showSubCmp==='pointSet.fillColor'"></AppPNTPointSetFillColor>

            <AppPNTPointSetSize v-if="showSubCmp==='pointSet.size'"></AppPNTPointSetSize>

            <AppPNTPointSetIconSrcSizeAnchor v-if="showSubCmp==='pointSet.iconSrc,iconSize,iconAnchor,popupAnchor,tooltipAnchor'"></AppPNTPointSetIconSrcSizeAnchor>

            <AppPNTPointSetPointIconSrcSizeAnchor v-if="showSubCmp==='pointSet.point.iconSrc,iconSize,iconAnchor,popupAnchor,tooltipAnchor'"></AppPNTPointSetPointIconSrcSizeAnchor>

            <AppPNTPointSetsClick v-if="showSubCmp==='pointSetsClick'"></AppPNTPointSetsClick>

            <AppPNTPointSetsPopup v-if="showSubCmp==='pointSetsPopup'"></AppPNTPointSetsPopup>

            <AppPNTPointSetsTooltip v-if="showSubCmp==='pointSetsTooltip'"></AppPNTPointSetsTooltip>

            <AppPNTPointSetLargeSet v-if="showSubCmp==='pointSet.largeSet'"></AppPNTPointSetLargeSet>

            <AppPLNPolylineSets v-if="showSubCmp==='polylineSets'"></AppPLNPolylineSets>

            <AppPLNPolylineSetChangeData v-if="showSubCmp==='polylineSet-changeData'"></AppPLNPolylineSetChangeData>

            <AppPLNPolylineSetOrder v-if="showSubCmp==='polylineSet.order'"></AppPLNPolylineSetOrder>

            <AppPLNPolylineSetLineColor v-if="showSubCmp==='polylineSet.lineColor'"></AppPLNPolylineSetLineColor>

            <AppPLNPolylineSetLineWidth v-if="showSubCmp==='polylineSet.lineWidth'"></AppPLNPolylineSetLineWidth>

            <AppPLNPolylineSetsClick v-if="showSubCmp==='polylineSetsClick'"></AppPLNPolylineSetsClick>

            <AppPLNPolylineSetsPopup v-if="showSubCmp==='polylineSetsPopup'"></AppPLNPolylineSetsPopup>

            <AppPLNPolylineSetsTooltip v-if="showSubCmp==='polylineSetsTooltip'"></AppPLNPolylineSetsTooltip>

            <AppPGNPolygonSets v-if="showSubCmp==='polygonSets'"></AppPGNPolygonSets>

            <AppPGNPolygonSetChangeData v-if="showSubCmp==='polygonSet-changeData'"></AppPGNPolygonSetChangeData>

            <AppPGNPolygonSetOrder v-if="showSubCmp==='polygonSet.order'"></AppPGNPolygonSetOrder>

            <AppPGNPolygonSetLineColor v-if="showSubCmp==='polygonSet.lineColor'"></AppPGNPolygonSetLineColor>

            <AppPGNPolygonSetLineWidth v-if="showSubCmp==='polygonSet.lineWidth'"></AppPGNPolygonSetLineWidth>

            <AppPGNPolygonSetFillColor v-if="showSubCmp==='polygonSet.fillColor'"></AppPGNPolygonSetFillColor>

            <AppPGNPolygonSetsClick v-if="showSubCmp==='polygonSetsClick'"></AppPGNPolygonSetsClick>

            <AppPGNPolygonSetsPopup v-if="showSubCmp==='polygonSetsPopup'"></AppPGNPolygonSetsPopup>

            <AppPGNPolygonSetsTooltip v-if="showSubCmp==='polygonSetsTooltip'"></AppPGNPolygonSetsTooltip>

            <AppGJNGeojsonSets v-if="showSubCmp==='geojsonSets'"></AppGJNGeojsonSets>

            <AppGJNGeojsonSetChangeData v-if="showSubCmp==='geojsonSet-changeData'"></AppGJNGeojsonSetChangeData>

            <AppGJNGeojsonSetUpload v-if="showSubCmp==='geojsonSet-upload'"></AppGJNGeojsonSetUpload>

            <AppGJNGeojsonSetOrder v-if="showSubCmp==='geojsonSet.order'"></AppGJNGeojsonSetOrder>

            <AppGJNGeojsonSetLineColor v-if="showSubCmp==='geojsonSet.lineColor'"></AppGJNGeojsonSetLineColor>

            <AppGJNGeojsonSetLineWidth v-if="showSubCmp==='geojsonSet.lineWidth'"></AppGJNGeojsonSetLineWidth>

            <AppGJNGeojsonSetFillColor v-if="showSubCmp==='geojsonSet.fillColor'"></AppGJNGeojsonSetFillColor>

            <AppGJNGeojsonSetsClick v-if="showSubCmp==='geojsonSetsClick'"></AppGJNGeojsonSetsClick>

            <AppGJNGeojsonSetsPopup v-if="showSubCmp==='geojsonSetsPopup'"></AppGJNGeojsonSetsPopup>

            <AppGJNGeojsonSetsTooltip v-if="showSubCmp==='geojsonSetsTooltip'"></AppGJNGeojsonSetsTooltip>

            <AppCTRContourSets v-if="showSubCmp==='contourSets'"></AppCTRContourSets>

            <AppCTRContourSetChangeData v-if="showSubCmp==='contourSet-changeData'"></AppCTRContourSetChangeData>

            <AppCTRContourSetThresholds v-if="showSubCmp==='contourSet.thresholds'"></AppCTRContourSetThresholds>

            <AppCTRContourSetGetColor v-if="showSubCmp==='contourSet.getColor'"></AppCTRContourSetGetColor>

            <AppCTRContourSetOrder v-if="showSubCmp==='contourSet.order'"></AppCTRContourSetOrder>

            <AppCTRContourSetGradient v-if="showSubCmp==='contourSet.gradient'"></AppCTRContourSetGradient>

            <AppCTRContourSetLineColor v-if="showSubCmp==='contourSet.lineColor'"></AppCTRContourSetLineColor>

            <AppCTRContourSetLineColorHover v-if="showSubCmp==='contourSet.lineColorHover'"></AppCTRContourSetLineColorHover>

            <AppCTRContourSetLineWidth v-if="showSubCmp==='contourSet.lineWidth'"></AppCTRContourSetLineWidth>

            <AppCTRContourSetLineWidthHover v-if="showSubCmp==='contourSet.lineWidthHover'"></AppCTRContourSetLineWidthHover>

            <AppCTRContourSetFillOpacity v-if="showSubCmp==='contourSet.fillOpacity'"></AppCTRContourSetFillOpacity>

            <AppCTRContourSetFillOpacityHover v-if="showSubCmp==='contourSet.fillOpacityHover'"></AppCTRContourSetFillOpacityHover>

            <AppCTRContourSetChangeStyleWhenHover v-if="showSubCmp==='contourSet.changeStyleWhenHover'"></AppCTRContourSetChangeStyleWhenHover>

            <AppCTRContourSetLegendNumDig v-if="showSubCmp==='contourSet.legendNumDig'"></AppCTRContourSetLegendNumDig>

            <AppCTRContourSetLegendTextFormater v-if="showSubCmp==='contourSet.legendTextFormater'"></AppCTRContourSetLegendTextFormater>

            <AppCTRContourSetLegendTextExtra v-if="showSubCmp==='contourSet.legendTextExtra'"></AppCTRContourSetLegendTextExtra>

            <AppCTRContourSetPolygonClipOuter v-if="showSubCmp==='contourSet.polygonClipOuter'"></AppCTRContourSetPolygonClipOuter>

            <AppCTRContourSetPolygonsClipInner v-if="showSubCmp==='contourSet.polygonsClipInner'"></AppCTRContourSetPolygonsClipInner>

            <AppCTRContourSetPolygonsContainInner v-if="showSubCmp==='contourSet.polygonsContainInner'"></AppCTRContourSetPolygonsContainInner>

            <AppCTRContourSetsClick v-if="showSubCmp==='contourSetsClick'"></AppCTRContourSetsClick>

            <AppCTRContourSetsPopup v-if="showSubCmp==='contourSetsPopup'"></AppCTRContourSetsPopup>

            <AppCTRContourSetsTooltip v-if="showSubCmp==='contourSetsTooltip'"></AppCTRContourSetsTooltip>

            <AppCTRContourSetLargeSet v-if="showSubCmp==='contourSet.largeSet'"></AppCTRContourSetLargeSet>

            <AppCTRContourSetInterp2 v-if="showSubCmp==='contourSet.interp2'"></AppCTRContourSetInterp2>

            <AppIMGImageSets v-if="showSubCmp==='imageSets'"></AppIMGImageSets>

            <AppIMGImageSetUpload v-if="showSubCmp==='imageSet-upload'"></AppIMGImageSetUpload>

            <AppPIMShow v-if="showSubCmp==='panelItems.show'"></AppPIMShow>

            <AppPIMPosition v-if="showSubCmp==='panelItems.position'"></AppPIMPosition>

            <AppPIMWidth v-if="showSubCmp==='panelItems.width'"></AppPIMWidth>

            <AppPIMMaxWidth v-if="showSubCmp==='panelItems.maxWidth'"></AppPIMMaxWidth>

            <AppPIMMaxHeight v-if="showSubCmp==='panelItems.maxHeight'"></AppPIMMaxHeight>

            <AppLGDShow v-if="showSubCmp==='panelLegends.show'"></AppLGDShow>

            <AppLGDPosition v-if="showSubCmp==='panelLegends.position'"></AppLGDPosition>

            <AppLGDWidth v-if="showSubCmp==='panelLegends.width'"></AppLGDWidth>

            <AppLGDMaxWidth v-if="showSubCmp==='panelLegends.maxWidth'"></AppLGDMaxWidth>

            <AppLGDMaxHeight v-if="showSubCmp==='panelLegends.maxHeight'"></AppLGDMaxHeight>

            <AppFunGetMapObject v-if="showSubCmp==='function-getMapObject'"></AppFunGetMapObject>

            <AppFunCenterTo v-if="showSubCmp==='function-centerTo'"></AppFunCenterTo>

            <AppFunPanTo v-if="showSubCmp==='function-panTo'"></AppFunPanTo>

            <AppFunPopupPointPolylinePolygon v-if="showSubCmp==='function-popupPoint,popupPolyline,popupPolygon'"></AppFunPopupPointPolylinePolygon>

            <AppFunModifyItemsVisible v-if="showSubCmp==='function-modifyItemsVisible'"></AppFunModifyItemsVisible>

        </div>


    </div>
</template>

<script>
import get from 'lodash-es/get.js'
import AppBSCSize from './AppBSCSize.vue'
import AppBSCCenter from './AppBSCCenter.vue'
import AppBSCZoom from './AppBSCZoom.vue'
import AppBSCPanelBackgroundColor from './AppBSCPanelBackgroundColor.vue'
import AppPBMShow from './AppPBMShow.vue'
import AppPBMBaseMaps from './AppPBMBaseMaps.vue'
import AppPBMPosition from './AppPBMPosition.vue'
import AppPBMWidth from './AppPBMWidth.vue'
import AppPBMMaxWidth from './AppPBMMaxWidth.vue'
import AppPBMMaxHeight from './AppPBMMaxHeight.vue'
import AppPSCShow from './AppPSCShow.vue'
import AppPSCPosition from './AppPSCPosition.vue'
import AppPCRShow from './AppPCRShow.vue'
import AppPCRPosition from './AppPCRPosition.vue'
import AppPCRSize from './AppPCRSize.vue'
import AppPCRWithPanel from './AppPCRWithPanel.vue'
import AppPCRIconSrcDarkLight from './AppPCRIconSrcDarkLight.vue'
import AppPC3Show from './AppPC3Show.vue'
import AppPC3Position from './AppPC3Position.vue'
import AppPLBShow from './AppPLBShow.vue'
import AppPLBPosition from './AppPLBPosition.vue'
import AppPLBTitle from './AppPLBTitle.vue'
import AppPLBLng from './AppPLBLng.vue'
import AppPLBLat from './AppPLBLat.vue'
import AppPLBZoom from './AppPLBZoom.vue'
import AppPLBUseItems from './AppPLBUseItems.vue'
import AppPZMShow from './AppPZMShow.vue'
import AppPZMPosition from './AppPZMPosition.vue'
import AppPNTPointSets from './AppPNTPointSets.vue'
import AppPNTPointSetPointByArray from './AppPNTPointSetPointByArray.vue'
import AppPNTPointSetChangeData from './AppPNTPointSetChangeData.vue'
import AppPNTPointSetOrder from './AppPNTPointSetOrder.vue'
import AppPNTPointSetLineColor from './AppPNTPointSetLineColor.vue'
import AppPNTPointSetLineWidth from './AppPNTPointSetLineWidth.vue'
import AppPNTPointSetFillColor from './AppPNTPointSetFillColor.vue'
import AppPNTPointSetSize from './AppPNTPointSetSize.vue'
import AppPNTPointSetIconSrcSizeAnchor from './AppPNTPointSetIconSrcSizeAnchor.vue'
import AppPNTPointSetPointIconSrcSizeAnchor from './AppPNTPointSetPointIconSrcSizeAnchor.vue'
import AppPNTPointSetsClick from './AppPNTPointSetsClick.vue'
import AppPNTPointSetsPopup from './AppPNTPointSetsPopup.vue'
import AppPNTPointSetsTooltip from './AppPNTPointSetsTooltip.vue'
import AppPNTPointSetLargeSet from './AppPNTPointSetLargeSet.vue'
import AppPLNPolylineSets from './AppPLNPolylineSets.vue'
import AppPLNPolylineSetChangeData from './AppPLNPolylineSetChangeData.vue'
import AppPLNPolylineSetOrder from './AppPLNPolylineSetOrder.vue'
import AppPLNPolylineSetLineColor from './AppPLNPolylineSetLineColor.vue'
import AppPLNPolylineSetLineWidth from './AppPLNPolylineSetLineWidth.vue'
import AppPLNPolylineSetsClick from './AppPLNPolylineSetsClick.vue'
import AppPLNPolylineSetsPopup from './AppPLNPolylineSetsPopup.vue'
import AppPLNPolylineSetsTooltip from './AppPLNPolylineSetsTooltip.vue'
import AppPGNPolygonSets from './AppPGNPolygonSets.vue'
import AppPGNPolygonSetChangeData from './AppPGNPolygonSetChangeData.vue'
import AppPGNPolygonSetOrder from './AppPGNPolygonSetOrder.vue'
import AppPGNPolygonSetLineColor from './AppPGNPolygonSetLineColor.vue'
import AppPGNPolygonSetLineWidth from './AppPGNPolygonSetLineWidth.vue'
import AppPGNPolygonSetFillColor from './AppPGNPolygonSetFillColor.vue'
import AppPGNPolygonSetsClick from './AppPGNPolygonSetsClick.vue'
import AppPGNPolygonSetsPopup from './AppPGNPolygonSetsPopup.vue'
import AppPGNPolygonSetsTooltip from './AppPGNPolygonSetsTooltip.vue'
import AppGJNGeojsonSets from './AppGJNGeojsonSets.vue'
import AppGJNGeojsonSetChangeData from './AppGJNGeojsonSetChangeData.vue'
import AppGJNGeojsonSetUpload from './AppGJNGeojsonSetUpload.vue'
import AppGJNGeojsonSetOrder from './AppGJNGeojsonSetOrder.vue'
import AppGJNGeojsonSetLineColor from './AppGJNGeojsonSetLineColor.vue'
import AppGJNGeojsonSetLineWidth from './AppGJNGeojsonSetLineWidth.vue'
import AppGJNGeojsonSetFillColor from './AppGJNGeojsonSetFillColor.vue'
import AppGJNGeojsonSetsClick from './AppGJNGeojsonSetsClick.vue'
import AppGJNGeojsonSetsPopup from './AppGJNGeojsonSetsPopup.vue'
import AppGJNGeojsonSetsTooltip from './AppGJNGeojsonSetsTooltip.vue'
import AppCTRContourSets from './AppCTRContourSets.vue'
import AppCTRContourSetChangeData from './AppCTRContourSetChangeData.vue'
import AppCTRContourSetThresholds from './AppCTRContourSetThresholds.vue'
import AppCTRContourSetGetColor from './AppCTRContourSetGetColor.vue'
import AppCTRContourSetOrder from './AppCTRContourSetOrder.vue'
import AppCTRContourSetGradient from './AppCTRContourSetGradient.vue'
import AppCTRContourSetLineColor from './AppCTRContourSetLineColor.vue'
import AppCTRContourSetLineColorHover from './AppCTRContourSetLineColorHover.vue'
import AppCTRContourSetLineWidth from './AppCTRContourSetLineWidth.vue'
import AppCTRContourSetLineWidthHover from './AppCTRContourSetLineWidthHover.vue'
import AppCTRContourSetFillOpacity from './AppCTRContourSetFillOpacity.vue'
import AppCTRContourSetFillOpacityHover from './AppCTRContourSetFillOpacityHover.vue'
import AppCTRContourSetChangeStyleWhenHover from './AppCTRContourSetChangeStyleWhenHover.vue'
import AppCTRContourSetLegendNumDig from './AppCTRContourSetLegendNumDig.vue'
import AppCTRContourSetLegendTextFormater from './AppCTRContourSetLegendTextFormater.vue'
import AppCTRContourSetLegendTextExtra from './AppCTRContourSetLegendTextExtra.vue'
import AppCTRContourSetPolygonClipOuter from './AppCTRContourSetPolygonClipOuter.vue'
import AppCTRContourSetPolygonsClipInner from './AppCTRContourSetPolygonsClipInner.vue'
import AppCTRContourSetPolygonsContainInner from './AppCTRContourSetPolygonsContainInner.vue'
import AppCTRContourSetsClick from './AppCTRContourSetsClick.vue'
import AppCTRContourSetsPopup from './AppCTRContourSetsPopup.vue'
import AppCTRContourSetsTooltip from './AppCTRContourSetsTooltip.vue'
import AppCTRContourSetLargeSet from './AppCTRContourSetLargeSet.vue'
import AppCTRContourSetInterp2 from './AppCTRContourSetInterp2.vue'
import AppIMGImageSets from './AppIMGImageSets.vue'
import AppIMGImageSetUpload from './AppIMGImageSetUpload.vue'
import AppPIMShow from './AppPIMShow.vue'
import AppPIMPosition from './AppPIMPosition.vue'
import AppPIMWidth from './AppPIMWidth.vue'
import AppPIMMaxWidth from './AppPIMMaxWidth.vue'
import AppPIMMaxHeight from './AppPIMMaxHeight.vue'
import AppLGDShow from './AppLGDShow.vue'
import AppLGDPosition from './AppLGDPosition.vue'
import AppLGDWidth from './AppLGDWidth.vue'
import AppLGDMaxWidth from './AppLGDMaxWidth.vue'
import AppLGDMaxHeight from './AppLGDMaxHeight.vue'
import AppFunGetMapObject from './AppFunGetMapObject.vue'
import AppFunCenterTo from './AppFunCenterTo.vue'
import AppFunPanTo from './AppFunPanTo.vue'
import AppFunPopupPointPolylinePolygon from './AppFunPopupPointPolylinePolygon.vue'
import AppFunModifyItemsVisible from './AppFunModifyItemsVisible.vue'


export default {
    components: {
        AppBSCSize,
        AppBSCCenter,
        AppBSCZoom,
        AppBSCPanelBackgroundColor,
        AppPBMShow,
        AppPBMBaseMaps,
        AppPBMPosition,
        AppPBMWidth,
        AppPBMMaxWidth,
        AppPBMMaxHeight,
        AppPSCShow,
        AppPSCPosition,
        AppPCRShow,
        AppPCRPosition,
        AppPCRSize,
        AppPCRWithPanel,
        AppPCRIconSrcDarkLight,
        AppPC3Show,
        AppPC3Position,
        AppPLBShow,
        AppPLBPosition,
        AppPLBTitle,
        AppPLBLng,
        AppPLBLat,
        AppPLBZoom,
        AppPLBUseItems,
        AppPZMShow,
        AppPZMPosition,
        AppPNTPointSets,
        AppPNTPointSetPointByArray,
        AppPNTPointSetChangeData,
        AppPNTPointSetOrder,
        AppPNTPointSetLineColor,
        AppPNTPointSetLineWidth,
        AppPNTPointSetFillColor,
        AppPNTPointSetSize,
        AppPNTPointSetIconSrcSizeAnchor,
        AppPNTPointSetPointIconSrcSizeAnchor,
        AppPNTPointSetsClick,
        AppPNTPointSetsPopup,
        AppPNTPointSetsTooltip,
        AppPNTPointSetLargeSet,
        AppPLNPolylineSets,
        AppPLNPolylineSetChangeData,
        AppPLNPolylineSetOrder,
        AppPLNPolylineSetLineColor,
        AppPLNPolylineSetLineWidth,
        AppPLNPolylineSetsClick,
        AppPLNPolylineSetsPopup,
        AppPLNPolylineSetsTooltip,
        AppPGNPolygonSets,
        AppPGNPolygonSetChangeData,
        AppPGNPolygonSetOrder,
        AppPGNPolygonSetLineColor,
        AppPGNPolygonSetLineWidth,
        AppPGNPolygonSetFillColor,
        AppPGNPolygonSetsClick,
        AppPGNPolygonSetsPopup,
        AppPGNPolygonSetsTooltip,
        AppGJNGeojsonSets,
        AppGJNGeojsonSetChangeData,
        AppGJNGeojsonSetUpload,
        AppGJNGeojsonSetOrder,
        AppGJNGeojsonSetLineColor,
        AppGJNGeojsonSetLineWidth,
        AppGJNGeojsonSetFillColor,
        AppGJNGeojsonSetsClick,
        AppGJNGeojsonSetsPopup,
        AppGJNGeojsonSetsTooltip,
        AppCTRContourSets,
        AppCTRContourSetChangeData,
        AppCTRContourSetThresholds,
        AppCTRContourSetGetColor,
        AppCTRContourSetOrder,
        AppCTRContourSetGradient,
        AppCTRContourSetLineColor,
        AppCTRContourSetLineColorHover,
        AppCTRContourSetLineWidth,
        AppCTRContourSetLineWidthHover,
        AppCTRContourSetFillOpacity,
        AppCTRContourSetFillOpacityHover,
        AppCTRContourSetChangeStyleWhenHover,
        AppCTRContourSetLegendNumDig,
        AppCTRContourSetLegendTextFormater,
        AppCTRContourSetLegendTextExtra,
        AppCTRContourSetPolygonClipOuter,
        AppCTRContourSetPolygonsClipInner,
        AppCTRContourSetPolygonsContainInner,
        AppCTRContourSetsClick,
        AppCTRContourSetsPopup,
        AppCTRContourSetsTooltip,
        AppCTRContourSetLargeSet,
        AppCTRContourSetInterp2,
        AppIMGImageSets,
        AppIMGImageSetUpload,
        AppPIMShow,
        AppPIMPosition,
        AppPIMWidth,
        AppPIMMaxWidth,
        AppPIMMaxHeight,
        AppLGDShow,
        AppLGDPosition,
        AppLGDWidth,
        AppLGDMaxWidth,
        AppLGDMaxHeight,
        AppFunGetMapObject,
        AppFunCenterTo,
        AppFunPanTo,
        AppFunPopupPointPolylinePolygon,
        AppFunModifyItemsVisible,
    },
    data: function() {
        return {
            showMainCmp: 'basic',
            showSubCmp: 'size',
            mainCmps: {
                basic: [
                    'size',
                    'center',
                    'zoom',
                    'panelBackgroundColor',
                ],
                panelBaseMaps: [
                    'panelBaseMaps.show',
                    'panelBaseMaps.baseMaps',
                    'panelBaseMaps.position',
                    'panelBaseMaps.width',
                    'panelBaseMaps.maxWidth',
                    'panelBaseMaps.maxHeight',
                ],
                panelScale: [
                    'panelScale.show',
                    'panelScale.position',
                ],
                panelCompassRose: [
                    'panelCompassRose.show',
                    'panelCompassRose.position',
                    'panelCompassRose.size',
                    'panelCompassRose.withPanel',
                    'panelCompassRose.iconSrcDark,iconSrcLight',
                ],
                panelCompass3d: [
                    'panelCompass3d.show',
                    'panelCompass3d.position',
                ],
                panelLabels: [
                    'panelLabels.show',
                    'panelLabels.position',
                    'panelLabels.title',
                    'panelLabels.lng',
                    'panelLabels.lat',
                    'panelLabels.zoom',
                    'panelLabels.useItems',
                ],
                panelZoom: [
                    'panelZoom.show',
                    'panelZoom.position',
                ],
                panelItems: [
                    'panelItems.show',
                    'panelItems.position',
                    'panelItems.width',
                    'panelItems.maxWidth',
                    'panelItems.maxHeight',
                ],
                panelLegends: [
                    'panelLegends.show',
                    'panelLegends.position',
                    'panelLegends.width',
                    'panelLegends.maxWidth',
                    'panelLegends.maxHeight',
                ],
                point: [
                    'pointSets',
                    'pointSet-pointByArray',
                    'pointSet-changeData',
                    'pointSet.order',
                    'pointSet.lineColor',
                    'pointSet.lineWidth',
                    'pointSet.fillColor',
                    'pointSet.size',
                    'pointSet.iconSrc,iconSize,iconAnchor,popupAnchor,tooltipAnchor',
                    'pointSet.point.iconSrc,iconSize,iconAnchor,popupAnchor,tooltipAnchor',
                    'pointSetsClick',
                    'pointSetsPopup',
                    'pointSetsTooltip',
                    'pointSet.largeSet',
                ],
                polyline: [
                    'polylineSets',
                    'polylineSet-changeData',
                    'polylineSet.order',
                    'polylineSet.lineColor',
                    'polylineSet.lineWidth',
                    'polylineSetsClick',
                    'polylineSetsPopup',
                    'polylineSetsTooltip',
                ],
                polygon: [
                    'polygonSets',
                    'polygonSet-changeData',
                    'polygonSet.order',
                    'polygonSet.lineColor',
                    'polygonSet.lineWidth',
                    'polygonSet.fillColor',
                    'polygonSetsClick',
                    'polygonSetsPopup',
                    'polygonSetsTooltip',
                ],
                geojson: [
                    'geojsonSets',
                    'geojsonSet-upload',
                    'geojsonSet-changeData',
                    'geojsonSet.order',
                    'geojsonSet.lineColor',
                    'geojsonSet.lineWidth',
                    'geojsonSet.fillColor',
                    'geojsonSetsClick',
                    'geojsonSetsPopup',
                    'geojsonSetsTooltip',
                ],
                contour: [
                    'contourSets',
                    'contourSet-changeData',
                    'contourSet.thresholds',
                    'contourSet.getColor',
                    'contourSet.order',
                    'contourSet.gradient',
                    'contourSet.lineColor',
                    'contourSet.lineColorHover',
                    'contourSet.lineWidth',
                    'contourSet.lineWidthHover',
                    'contourSet.fillOpacity',
                    'contourSet.fillOpacityHover',
                    'contourSet.changeStyleWhenHover',
                    'contourSet.legendNumDig',
                    'contourSet.legendTextFormater',
                    'contourSet.legendTextExtra',
                    'contourSet.polygonClipOuter',
                    'contourSet.polygonsClipInner',
                    'contourSet.polygonsContainInner',
                    'contourSetsClick',
                    'contourSetsPopup',
                    'contourSetsTooltip',
                    'contourSet.largeSet',
                    'contourSet.interp2',
                ],
                image: [
                    'imageSets',
                    'imageSet-upload',
                ],
                function: [
                    'function-getMapObject',
                    'function-centerTo',
                    'function-panTo',
                    'function-popupPoint,popupPolyline,popupPolygon',
                    'function-modifyItemsVisible',
                ],
            },

        }
    },
    // mounted: function() {
    //     let vo = this
    // },
    computed: {

        isNarrow: function() {
            return window.innerWidth < 1000
        },

        nowSubCmps: function() {
            let vo = this
            let rs = get(vo.mainCmps, vo.showMainCmp, [])
            vo.showSubCmp = get(rs, 0, '')
            return rs
        },

    },
}
</script>

<style>
.clsBtn {
    transition:all 0.5s;
    cursor: pointer;
    user-select: none;
}
.clsMainMenu-basic {
    padding: 3px 9px;
}
.clsMainMenu {
    border-bottom:2px solid #fff;
}
.clsMainMenu:hover {
    border-bottom:2px solid #aaa;
}
.clsMainMenu-active {
    border-bottom:2px solid #f26;
    background:#efefef;
}
.clsSubMenu-basic {
    padding: 3px 12px;
    font-size:0.8rem;
    border-radius:30px;
}
.clsSubMenu {
    background:#efefef;
}
.clsSubMenu:hover {
    background:#ddd;
}
.clsSubMenu-active {
    background:#f26;
    color:#fff;
    box-shadow:0 0 15px rgb(0 0 0 / 20%);
}
.item-link {
    display: inline-block;
    margin: 10px 10px 0px 0px;
    padding: 5px 10px;
    font-size: 0.8rem;
    color: #fff;
    background-color: #443a65;
    cursor: pointer;
    text-decoration: none;
}
.bkh { /* 寬 */
    padding:20px;
}
@media screen and (max-width:800px){ /* 中 */
    .bkh {
        padding:10px;
    }
}
@media screen and (max-width:400px){ /* 窄 */
    .bkh {
        padding:5px;
    }
}
.bkp { /* 寬 */
    padding:0px 20px;
}
@media screen and (max-width:800px){ /* 中 */
    .bkp {
        padding:0px 10px;
    }
}
@media screen and (max-width:400px){ /* 窄 */
    .bkp {
        padding:0px 5px;
    }
}
</style>
