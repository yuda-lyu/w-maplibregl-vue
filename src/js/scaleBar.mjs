/**
 * 取不超過 max 之最大整齊距離(1、2、3、5 × 10^e)
 *
 * 10 的次方以 Number('1e' + e) 取精確值; Math.log10 於 max 恰為 10 的次方時若偏小一位(V8 實測 1e-30~1e30 皆精確, 此為對其他引擎之防禦),
 * 以比較修正, 免整齊距離少一級(max 恰為 1000 卻得 500)。
 *
 * @param {Number} max 輸入上限距離, 須為大於 0 之有限數字
 * @returns {{meters: Number, exp: Number}} 回傳整齊距離(公尺)與其 10 的次方指數 e
 */
export function niceDistance(max) {
    let pow10 = (e) => Number('1e' + e)
    let e = Math.floor(Math.log10(max))
    if (pow10(e + 1) <= max) {
        e += 1
    }
    else if (pow10(e) > max) {
        e -= 1
    }
    //與 n × 10^e 直接比較(不用 max / 10^e 取首位: 3e-8 / 1e-8 = 2.9999999999999996 會少一級); 單一有效數字以字串轉換, 免 3 * 0.1 之浮點尾數
    let nice = [5, 3, 2].find((n) => Number(n + 'e' + e) <= max) || 1
    return { meters: Number(nice + 'e' + e), exp: e }
}

/**
 * 比例尺之距離與色條寬(規則帳本 R15)
 *
 * 取色條上限寬(80px)內最大之整齊距離(1、2、3、5 × 10^n 公尺), 色條寬依該距離換算, 故文字恆與色條相符;
 * 此為 maplibre-gl 內建 ScaleControl 之同一慣例(getRoundNum), 但保留本元件面板之位置與樣式。
 *
 * 每像素公尺: maplibre 世界為 512px(zoom 0 = 512px), 赤道每像素公尺 = 40075016.686 / 512 = 78271.51696,
 * mpp = 78271.51696 × cos(緯度) / 2^zoom(256px 世界之 156543.03392 會使距離為實際之 2 倍)。
 *
 * 色條寬恆落在 (40, 80] px: 相鄰整齊距離之比最大為 2(1→2、2→3、3→5、5→10)。
 *
 * @param {Number} lat 輸入地圖中心緯度, 緯度 0 為有效值, 非有限數字或超出 ±90 時回退預設緯度 23.5
 * @param {Number} zoom 輸入縮放層級, 非有限數字時回退預設層級 7
 * @returns {{meters: Number, width: Number, text: String}} 回傳距離(公尺)、色條寬(px, 含邊框)與顯示文字
 */
export function computeScaleBar(lat, zoom) {

    //預設值(同元件 data 預設 currentCenter[0]=23.5、currentZoom=7)
    let la = typeof lat === 'number' && isFinite(lat) && Math.abs(lat) <= 90 ? lat : 23.5
    //夾限層級: 地圖實際範圍為 0~24(globe 下限略低於 0), 夾在此範圍外僅為免 2^zoom 溢位成 0 或 Infinity
    let z = typeof zoom === 'number' && isFinite(zoom) ? Math.min(Math.max(zoom, -10), 40) : 7
    //緯度 ±90 時 cos 為 6e-17, 夾下限 1e-6(約 ±89.99994°)免每像素公尺趨近 0 而文字成為極小數字
    let c = Math.max(Math.cos(la * Math.PI / 180), 1e-6)

    let mpp = 78271.51696 * c / Math.pow(2, z)
    let max = mpp * 80 //色條上限寬 80px 對應之實際距離

    //整齊距離: 取不超過 max 之最大者(1、2、3、5 × 10^e)
    let { meters, exp: e } = niceDistance(max)

    //文字: 1000 m 以上以 km(整齊值此時必為整數), 其餘以 m; 小於 1 m 者以固定小數位表示, 免出現科學記號
    let text = ''
    if (meters >= 1000) {
        text = `${meters / 1000} km`
    }
    else if (e >= 0) {
        text = `${meters} m`
    }
    else {
        text = `${meters.toFixed(-e)} m`
    }

    return {
        meters,
        width: meters / mpp,
        text,
    }
}
