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
