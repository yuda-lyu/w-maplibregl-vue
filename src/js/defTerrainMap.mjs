/**
 * defTerrainMap.mjs
 * 預設3D地形資料源設定, 供組件預設值使用, 亦可由外部直接引用或作為自訂設定之基礎
 */
let defTerrainMap = {
    terrainSource: {
        url: '//s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        layerType: 'raster-dem',
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 13,
    },
    // hillshadeSource: {
    //     url: '//s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    //     layerType: 'raster-dem',
    //     encoding: 'terrarium',
    //     tileSize: 256,
    //     maxzoom: 13,
    // },
}


export default defTerrainMap
