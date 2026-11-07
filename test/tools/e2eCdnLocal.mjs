// e2e 進場不依賴外部 CDN(排程第 329 項, 2026-11-07 mv329b; 規則帳本 R5〈e2e 外部 script 本機副本〉)
//
// 範例頁 public/index.html 有同步外部 script(jsdelivr、yuda-lyu.github.io), page.goto(domcontentloaded/networkidle)須等其下載完;
// 外部來源慢時(2026-11-07 實測 github.io 一度 60 秒未下載完)e2e 於進場即逾時, 與被測功能無關。
// 本輔助以 context.route 改由本機之同版副本回應(只影響 e2e 之瀏覽器情境, 範例頁對一般使用者之載入方式不變):
//   - 優先取 node_modules 內對應套件之產物(與 CDN 現行檔逐位元組相同, 2026-11-07 以 sha256 比對: lodash 4.18.1、wsemi 1.9.51、w-gis 1.1.19)
//   - 無對應套件者(w-demores 之兩支資料檔, 本套件未安裝 w-demores)放 test/fixtures/cdn/<套件>-<版本>/(1.0.36, 兩檔合計約 90 KB)
// 失敗即拋(不靜默回退外網): ①public/index.html 有未列於 CDN_LOCAL 之外部 script/stylesheet ②副本檔不存在
// 用法: let ctx = await browser.newContext(...); await routeCdnLocal(ctx)
// 套用: 經 dev server 首頁進場之 e2e(basemapzoom、displayorder、hover、movestate、opacity、runtime、zoomrange)。
//   e2e-diffpath 不套用: 其後另掛 ctx.route('**/*') 把非本機請求一律 abort(後註冊者優先), 原本即不連外; e2e-fileprotocol 用自己的測試頁, 無外部 script。
import fs from 'fs'
import path from 'path'

//外部網址 → 本機副本(相對專案根; 測試一律以專案根為 cwd 執行)
export const CDN_LOCAL = [
    { url: 'https://cdn.jsdelivr.net/npm/lodash/lodash.min.js', file: 'node_modules/lodash/lodash.min.js' },
    { url: 'https://yuda-lyu.github.io/wsemi/dist/wsemi.umd.js', file: 'node_modules/wsemi/dist/wsemi.umd.js' },
    { url: 'https://yuda-lyu.github.io/w-gis/dist/interp2.wk.umd.js', file: 'node_modules/w-gis/dist/interp2.wk.umd.js' },
    { url: 'https://cdn.jsdelivr.net/npm/w-demores/res/data/dataRain.js', file: 'test/fixtures/cdn/w-demores-1.0.36/dataRain.js' },
    { url: 'https://cdn.jsdelivr.net/npm/w-demores/res/data/dataRainClip.js', file: 'test/fixtures/cdn/w-demores-1.0.36/dataRainClip.js' },
]

//html 內之外部(http/https/協定相對)script src 與 stylesheet href, 依出現順序
export function findExternalResources(html) {
    let r = []
    let re = /<(script|link)\b[^>]*?\b(src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)["'][^>]*>/gi
    let m
    while ((m = re.exec(String(html))) !== null) {
        let tag = m[1].toLowerCase()
        if (tag === 'link' && !/\brel\s*=\s*["']?stylesheet/i.test(m[0])) continue
        r.push(m[3])
    }
    return r
}

//html 內未列於 map 之外部資源
export function findUnmapped(html, map = CDN_LOCAL) {
    let known = new Set(map.map((x) => x.url))
    return findExternalResources(html).filter((u) => !known.has(u))
}

let cache = null
//載入並檢查(首次呼叫時做一次): 首頁之外部資源皆有對應、副本檔皆存在
export function loadCdnLocal(opt = {}) {
    if (cache && !opt.force) return cache
    let root = path.resolve(opt.root || '.')
    let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
    let un = findUnmapped(html)
    if (un.length > 0) {
        throw new Error(`[e2eCdnLocal] public/index.html 有未對應本機副本之外部資源(請加入 test/tools/e2eCdnLocal.mjs 之 CDN_LOCAL): ${un.join(', ')}`)
    }
    cache = CDN_LOCAL.map((x) => {
        let fp = path.join(root, x.file)
        if (!fs.existsSync(fp)) throw new Error(`[e2eCdnLocal] 本機副本不存在: ${x.file}(對應 ${x.url})`)
        return { url: x.url, file: x.file, body: fs.readFileSync(fp) }
    })
    return cache
}

//於瀏覽器情境攔截外部 script, 以本機副本回應; 回傳各網址之回應次數(供探測核對, 一般呼叫不需使用)
export async function routeCdnLocal(ctx) {
    let items = loadCdnLocal()
    let served = {}
    for (let it of items) {
        served[it.url] = 0
        await ctx.route(it.url, (route) => {
            served[it.url]++
            return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: it.body })
        })
    }
    return served
}
