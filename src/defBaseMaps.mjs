let defBaseMaps = [
    {
        name: 'Mapbox',
        //api.mapbox.com/v4/mapbox.satellite
        //api.mapbox.com/v4/mapbox.mapbox-streets-v8
        //api.mapbox.com/v4/mapbox.terrain-rgb
        //api.mapbox.com/v4/mapbox.mapbox-traffic-v1
        url: '//api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2VtaXNwaGVyZSIsImEiOiJja2s1anBrZzMwN3NkMndsOGt6MHo5ajI5In0._vUKnQ57n7UcWsWgOPIEgQ',
        colorShade: 'dark',
        opacity: 1,
        visible: true,
    },
    {
        name: 'OpenStreetMap',
        // url: '//{s}.tile.osm.org/{z}/{x}/{y}.png', //同樣位址
        url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        colorShade: 'light',
        opacity: 1,
        visible: false,
    },
    {
        name: 'OpenTopoMap',
        url: '//{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        colorShade: 'light',
        opacity: 1,
        visible: false,
    },

    //使用google.cn圖資
    {
        name: 'GoogleStreets',
        url: '//www.google.cn/maps/vt?lyrs=m@189&gl=cn&x={x}&y={y}&z={z}',
        colorShade: 'light',
        opacity: 1,
        visible: false,
    },
    {
        name: 'GoogleSatellite',
        url: '//www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}',
        colorShade: 'dark',
        opacity: 1,
        visible: false,
    },
    {
        name: 'GoogleHybrid',
        url: '//www.google.cn/maps/vt?lyrs=s,h@189&gl=cn&x={x}&y={y}&z={z}',
        colorShade: 'dark',
        opacity: 1,
        visible: false,
    },

    // //測試geoserver的wms圖層
    // {
    //     name: '縣市邊界',
    //     type: 'wms',
    //     url: 'http://localhost:9041/geoserver/tw/wms?',
    //     layers: 'tw:COUNTY_MOI_1090820',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '鄉鎮邊界',
    //     type: 'wms',
    //     url: 'http://localhost:9041/geoserver/tw/wms?',
    //     layers: 'tw:TOWN_NLSC_1140825',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '村里邊界',
    //     type: 'wms',
    //     url: 'http://localhost:9041/geoserver/tw/wms?',
    //     layers: 'tw:VILLAGE_NLSC_1140825',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },

    // //google要申請tokne才能用
    // {
    //     name: 'googleStreets',
    //     url: 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    //     colorShade: 'light',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'googleHybrid',
    //     url: 'http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'googleSat',
    //     url: 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'googleTerrain',
    //     url: 'http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },

    // //TGOS要申請token才能用
    // {
    //     name: 'TGOS福衛二號影像',
    //     url: 'http://gis.sinica.edu.tw/tgos/file-exists.php?img=F2IMAGE_W-png-{z}-{x}-{y}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'TGOS福衛二號混合圖',
    //     url: 'http://gis.sinica.edu.tw/tgos/file-exists.php?img=ROADMAP_W-png-{z}-{x}-{y}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'TGOS電子地圖',
    //     url: 'http://gis.sinica.edu.tw/tgos/file-exists.php?img=TGOSMAP_W-png-{z}-{x}-{y}',
    //     colorShade: 'light',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'TGOS地形暈渲圖',
    //     url: 'http://gis.sinica.edu.tw/tgos/file-exists.php?img=HILLSHADE_W-png-{z}-{x}-{y}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: 'TGOS地形暈渲混合圖',
    //     url: 'http://gis.sinica.edu.tw/tgos/file-exists.php?img=HILLSHADEMIX_W-png-{z}-{x}-{y}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },

    // //經濟部地礦中心
    // //山崩雲API服務供應平台
    // //https://landslide.geologycloud.tw/map
    // //地質資料整合查詢平台
    // //https://geomap.gsmma.gov.tw/gwh/gsb97-1/sys8a/t3/index1.cfm
    // {
    //     name: '五萬分之一地質圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/gm50000/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '數值地形多向陰影圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/Shadw20/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '岩體強度分級',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/EVGM_a1/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '岩性組合分佈圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/EVGM_all/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '山崩與地滑地質敏感區',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/SensitiveArea/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '落石地質災害潛勢圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/EVGM_G01/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '岩屑崩滑地質災害潛勢圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/EVGM_G02/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '岩體滑動地質災害潛勢圖',
    //     url: 'https://landslide.geologycloud.tw/jlwmts/jetlink/EVGM_G04/GoogleMapsCompatible/{z}/{x}/{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '五十萬之一地體構造圖',
    //     url: 'https://geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=500K_TECTONIC_MAP_1978&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '五十萬之一變質相圖',
    //     url: 'https://geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=500K_METAMORPHIC_FACIES_MAP_1994&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '五十萬之一附近海域沉積物分佈圖',
    //     url: 'https://geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=500K_OFFSHORE_SEDIMENT_MAP_1995&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '五十萬之一陸上砂資源分佈與品質圖',
    //     url: 'https://geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=500K_LAND_GRAVEL_MAP_1998&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '五十萬之一能源礦產及地下水資源分佈圖',
    //     url: 'https://geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=500K_ENERGY_GROUNDWATER_REOUSRCE_2006&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },

    // //內政部國土測繪中心
    // //https://www.nlsc.gov.tw/cp.aspx?n=10702
    // {
    //     name: '臺灣通用電子地圖',
    //     url: 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/EPSG:3857/{z}/{y}/{x}',
    //     colorShade: 'light',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '臺灣通用正射影像',
    //     url: 'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/EPSG:3857/{z}/{y}/{x}',
    //     colorShade: 'dark',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '臺灣地形陰影圖',
    //     url: 'https://wmts.nlsc.gov.tw/wmts/MOI_HILLSHADE/default/EPSG:3857/{z}/{y}/{x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '國家級特定風景區',
    //     url: 'https://wmts.nlsc.gov.tw/wmts/Scenic/default/EPSG:3857/{z}/{y}/{x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '段籍圖',
    //     url: 'https://wmts.nlsc.gov.tw/wmts/LANDSECT/default/EPSG:3857/{z}/{y}/{x}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },

    // //中研院台灣百年歷史地圖
    // //https://gissrv4.sinica.edu.tw/gis/twhgis/
    // {
    //     name: '1987-臺灣地形圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=TM100K_1987-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1956-臺灣地形圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=TM50K_1956-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '美軍航照影像(1945/6/17攝影)',
    //     url: '//gis.sinica.edu.tw/taipei/file-exists.php?img=Taipei_aerialphoto_1945-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1945-美軍繪製臺灣城市地圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=AMCityPlan_1945-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1944-美軍地形圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=AM50K_1944-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1942-日治二萬五千分之一地形圖(昭和修正版)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM25K_1942-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1939-日治臺灣全圖(第五版)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM300K_1939-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1934-日治臺灣全圖(第三版)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM300K_1934-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1932-二十萬分一帝國圖(臺灣部份)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM200K_1932-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1924-日治地形圖(陸地測量部)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM50K_1924_new-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1921-日治臺灣堡圖(大正版)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM20K_1921-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1921-日治地形圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM25K_1921-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1920-日治地形圖(總督府土木局)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM50K_1920-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1916-日治蕃地地形圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM50K_1916-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1905-日治臺灣圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM100K_1905-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1904-日治臺灣堡圖(明治版)',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM20K_1904-jpg-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },
    // {
    //     name: '1899-日治臺灣全圖',
    //     url: '//gis.sinica.edu.tw/tileserver/file-exists.php?img=JM400K_1899-png-{z}-{x}-{y}',
    //     colorShade: '',
    //     opacity: 1,
    //     visible: false,
    // },

]

export default defBaseMaps
