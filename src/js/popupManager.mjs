/**
 * popupManager.mjs
 * 方向性 Popup/Tooltip 建立、動態翻轉偵測、Icon 圖片註冊
 */
import isNumber from 'lodash-es/isNumber.js'
import isarr from 'wsemi/src/isarr.mjs'
import maplibregl from 'maplibre-gl'


/**
 * 建立方向性彈窗（支援 top/bottom/left/right + 二階段自動翻轉）
 * @param {Object} map - MapLibre 地圖實例
 * @param {Array} lngLat - [lng, lat]
 * @param {HTMLElement} content - DOM 內容元素
 * @param {String} position - 'top'|'bottom'|'left'|'right'
 * @param {Number} gap - 與錨點的間距（px）
 * @param {Object} extraOpts - 其他 Popup 選項
 * @param {Array} [anchorOffset=[0,0]] - 額外偏移 [dx, dy]（正x=右移，正y=下移）
 * @returns {maplibregl.Popup|null}
 */
export function createDirectionalPopup(map, lngLat, content, position, gap, extraOpts, anchorOffset) {
    if (!map) return null
    gap = isNumber(gap) ? Math.abs(gap) : 5
    let aoX = 0; let aoY = 0
    if (isarr(anchorOffset) && anchorOffset.length >= 2) {
        aoX = anchorOffset[0] || 0; aoY = anchorOffset[1] || 0
    }
    let posMap = {
        'top': { anchor: 'bottom', offset: [aoX, -gap + aoY] },
        'bottom': { anchor: 'top', offset: [aoX, gap + aoY] },
        'left': { anchor: 'right', offset: [-gap + aoX, aoY] },
        'right': { anchor: 'left', offset: [gap + aoX, aoY] },
    }
    let flipMap = { 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left' }

    let checkOverflow = (dir, projPt, cw, ch, elW, elH) => {
        if (dir === 'top') return projPt.y - gap - elH < 0
        if (dir === 'bottom') return projPt.y + gap + elH > ch
        if (dir === 'left') return projPt.x - gap - elW < 0
        if (dir === 'right') return projPt.x + gap + elW > cw
        return false
    }

    // 第一階段：以預估尺寸決定初始方向
    let chosenPos = position
    try {
        let proj = map.project(lngLat)
        let ct = map.getContainer(); let cw = ct.clientWidth; let ch = ct.clientHeight
        let estW = 220; let estH = 160
        if (checkOverflow(position, proj, cw, ch, estW, estH)) {
            chosenPos = flipMap[position] || position
        }
    }
    catch (e) { /* 投影失敗時使用原始方向 */ }

    let pos = posMap[chosenPos] || posMap['top']
    let popup = new maplibregl.Popup({ ...extraOpts, anchor: pos.anchor, offset: pos.offset })
        .setLngLat(lngLat).setDOMContent(content).addTo(map)

    // 第二階段：渲染後以實際 DOM 尺寸做二次校正
    try {
        let popupEl = popup.getElement()
        if (popupEl) {
            let rect = popupEl.getBoundingClientRect()
            let realW = rect.width; let realH = rect.height
            let proj = map.project(lngLat)
            let ct = map.getContainer(); let cw = ct.clientWidth; let ch = ct.clientHeight
            if (checkOverflow(chosenPos, proj, cw, ch, realW, realH)) {
                let flipped = flipMap[chosenPos] || chosenPos
                if (!checkOverflow(flipped, proj, cw, ch, realW, realH)) {
                    chosenPos = flipped
                    let newPos = posMap[flipped]
                    popup.remove()
                    popup = new maplibregl.Popup({ ...extraOpts, anchor: newPos.anchor, offset: newPos.offset })
                        .setLngLat(lngLat).setDOMContent(content).addTo(map)
                }
            }
        }
    }
    catch (e) { /* 二次校正失敗時維持當前方向 */ }

    popup._dirMeta = {
        lngLat, position, chosenDir: chosenPos,
        gap, extraOpts, anchorOffset: anchorOffset || null,
        contentHtml: content.innerHTML,
    }
    return popup
}


/**
 * 偵測單一 popup/tooltip 的方向是否需要翻轉，若需要則重建
 * @param {Object} map - MapLibre 地圖實例
 * @param {maplibregl.Popup} popup - 目前的 popup 物件
 * @returns {maplibregl.Popup} - 原 popup 或翻轉後的新 popup
 */
export function recheckSinglePopupDir(map, popup) {
    if (!popup || !popup._dirMeta) return popup
    let meta = popup._dirMeta
    let { lngLat, position, chosenDir, gap, extraOpts, anchorOffset } = meta

    let aoX = 0; let aoY = 0
    if (isarr(anchorOffset) && anchorOffset.length >= 2) {
        aoX = anchorOffset[0] || 0; aoY = anchorOffset[1] || 0
    }
    let posMap = {
        'top': { anchor: 'bottom', offset: [aoX, -gap + aoY] },
        'bottom': { anchor: 'top', offset: [aoX, gap + aoY] },
        'left': { anchor: 'right', offset: [-gap + aoX, aoY] },
        'right': { anchor: 'left', offset: [gap + aoX, aoY] },
    }
    let flipMap = { 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left' }

    try {
        let popupEl = popup.getElement(); if (!popupEl) return popup
        let rect = popupEl.getBoundingClientRect()
        let elW = rect.width; let elH = rect.height
        let proj = map.project(lngLat)
        let ct = map.getContainer(); let cw = ct.clientWidth; let ch = ct.clientHeight

        let checkOverflow = (dir) => {
            if (dir === 'top') return proj.y - gap - elH < 0
            if (dir === 'bottom') return proj.y + gap + elH > ch
            if (dir === 'left') return proj.x - gap - elW < 0
            if (dir === 'right') return proj.x + gap + elW > cw
            return false
        }

        let overflow = checkOverflow(chosenDir)
        let newDir = chosenDir
        if (overflow) {
            let flipped = flipMap[chosenDir]
            if (!checkOverflow(flipped)) newDir = flipped
        }
        else if (chosenDir !== position) {
            if (!checkOverflow(position)) newDir = position
        }

        if (newDir === chosenDir) return popup

        let newPos = posMap[newDir]
        let newContent = document.createElement('div'); newContent.innerHTML = meta.contentHtml
        popup.remove()
        let newPopup = new maplibregl.Popup({ ...extraOpts, anchor: newPos.anchor, offset: newPos.offset })
            .setLngLat(lngLat).setDOMContent(newContent).addTo(map)
        newPopup._dirMeta = { ...meta, chosenDir: newDir, contentHtml: newContent.innerHTML }
        return newPopup
    }
    catch (e) { return popup }
}


/**
 * 將 base64/URL 圖片載入並以指定大小註冊到地圖 sprite atlas
 * @param {Object} map - MapLibre 地圖實例
 * @param {String} key - sprite key
 * @param {String} src - 圖片來源（URL 或 base64）
 * @param {Number} tw - 目標寬度
 * @param {Number} th - 目標高度
 * @returns {Promise}
 */
export function registerIconImage(map, key, src, tw, th) {
    if (!map || map.hasImage(key)) return Promise.resolve()
    return new Promise((resolve) => {
        let img = new Image()
        img.onload = () => {
            if (!map || map.hasImage(key)) { resolve(); return }
            let c = document.createElement('canvas'); c.width = tw; c.height = th
            let ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, tw, th)
            let d = ctx.getImageData(0, 0, tw, th)
            map.addImage(key, { width: tw, height: th, data: new Uint8Array(d.data.buffer) })
            resolve()
        }
        img.onerror = () => resolve()
        img.src = src
    })
}
