// e2e: 僅 name 變更、僅地形倍率變更時不整組重建(不重抓圖磚/DEM), 其餘欄位變更仍走原路徑
//
// 規格句(src/components/WMaplibreglVue.vue 之 @vue-prop 與 src/js/basemapManager.mjs 之函式說明, 以下代稱):
//   J-name  baseMaps[i].name: JSDoc 原文「輸入第i個底圖的名稱字串，供面板清單顯示」; 推得(圖層 id 由 baseMapKey 衍生、不含 name):
//           僅 name 變更時面板名稱更新、底圖不重建(不移除/新增 source、不重抓圖磚)
//   J-diff  isBaseMapsStructuralDiff 函式說明(現行原文): 「false → 僅順序/可見性/paint/名稱差異, 可走增量…不重建、不重抓圖磚; true → 有結構性變更(新增/刪除/url/type/layer/layerType/colorShade 等), 需完整重套 applyBaseMaps」
//   J-exag  terrainMap.exaggeration: 「輸入地形高度誇張倍率數字，預設1.5」
//           → 僅倍率變更: 同來源就地 setTerrain(不移除/重建 DEM 來源、不重抓 DEM、hillshade 不動), 倍率確實生效;
//             其餘地形欄位(來源 url、hillshadeExaggeration 等)變更仍整組重套
//   J-prev  previewOverlayOpacity(name, val): 以名稱定位疊加層 → 改名後須以新名稱定位
//
// 真實 user path(使用端): 使用端改 opt.panelBaseMaps.baseMaps[i].name / opt.panelBaseMaps.terrainMap.exaggeration(響應式賦值),
//   觀察面板文字、地圖圖層與網路請求。第二個元件實例以 Vue 父層持有響應式 opt 掛載(同使用端用法); 圖磚與 DEM 以 page.route 回應並計數(永不連外)。
//
// 標準圖政策: 無標準圖(語意斷言與請求計數)。無 i18n, 單一變體。每個 it() 各自 new browser。
//
// 重要流程(spec bullets):
//   - E2E-D1 僅改疊加層 name: 面板顯示新名稱; applyBaseMaps 0 次、無 add/removeSource、圖磚請求 0; 圖層 id 不變; previewOverlayOpacity 以新名稱可用、舊名稱回 false
//   - E2E-D2 負向: url 變更 → 整組重建且重抓圖磚; name 與 maxzoom 同改 → 仍整組重建
//   - E2E-D3 僅改地形 exaggeration: applyTerrain 0 次、無 add/removeSource、無 setTerrain(null)、DEM 請求 0、hillshade 仍在原疊序; 倍率生效(getTerrain)
//   - E2E-D4 負向: 地形來源 url 變更、hillshadeExaggeration 變更 → 仍整組重套(applyTerrain 與 DEM 重抓); 與倍率同改亦然
//   - E2E-D5 未啟用地形(terrainMap 無來源)時改 exaggeration: 不就地更新、不報錯(就地失敗改走整組重套, 結果無地形)
import assert from 'assert'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import launchChromium from 'w-package-tools-e2e/src/launchChromium.mjs'
import { baseUrl, startServer, waitUntilExist } from './tools/e2e-setup.mjs'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64')
const DEM = fs.readFileSync(fileURLToPath(new URL('../public/e2e-dem.png', import.meta.url)))
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'image/png' }

describe('e2e-diffpath', function() {
    this.timeout(180000)

    before(async function() {
        this.timeout(150000)
        await startServer()
    })

    let browser = null
    let page = null
    let errs = null
    let counts = null //page.route 計數: base=底圖圖磚請求(依 tile.local 下第一層路徑分組)、dem=DEM 請求
    beforeEach(async function() {
        browser = await launchChromium({ headless: true })
        let ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } })
        counts = { base: {}, dem: 0 }
        await ctx.route('**/*', (route) => {
            let u = route.request().url()
            if (u.startsWith('http://tile.local/dem')) {
                counts.dem++
                return route.fulfill({ body: DEM, headers: CORS })
            }
            if (u.startsWith('http://tile.local/')) {
                let k = u.split('/')[3]
                counts.base[k] = (counts.base[k] || 0) + 1
                return route.fulfill({ body: PNG, headers: CORS })
            }
            if (u.startsWith(baseUrl) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue()
            return route.abort()
        })
        page = await ctx.newPage()
        errs = []
        page.on('pageerror', (e) => errs.push(String(e.message)))
    })
    afterEach(async function() {
        if (browser) await browser.close()
        browser = null
        page = null
    })

    let sumBase = () => Object.values(counts.base).reduce((a, b) => a + b, 0)
    let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    //請求數連續 600ms 不變視為圖磚/DEM 載入告一段落(事件式等待無法觀察「不再請求」, 此為否定觀察之穩定窗)
    let settleRequests = async () => {
        let last = JSON.stringify([counts.base, counts.dem])
        for (let t0 = Date.now(), stable = Date.now(); Date.now() - t0 < 15000;) {
            await sleep(100)
            let now = JSON.stringify([counts.base, counts.dem])
            if (now !== last) {
                last = now; stable = Date.now()
            }
            else if (Date.now() - stable >= 600) return
        }
        throw new Error('settleRequests 逾 15 秒請求數仍在變動, 前提不成立')
    }
    let ev = (fn, arg) => page.evaluate(fn, arg)

    //開首頁(取其元件建構子), 於頁內掛載第二個元件實例(父層持有響應式 opt, 同使用端用法), 等載入與圖磚穩定, 再安裝計數器
    let mount = async (opt) => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'), { timeout: 60000 })
        await ev((opt2) => {
            let el = document.querySelector('.maplibregl-canvas')
            while (el && !(el.__vue__ && el.__vue__.getMapObject)) el = el.parentElement
            let Ctor = el.__vue__.constructor
            let Vue = Ctor.super
            let host = document.createElement('div')
            host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:500px;z-index:99999;background:#fff'
            document.body.appendChild(host)
            let holder = document.createElement('div')
            host.appendChild(holder)
            let parent = new Vue({
                data: { opt: opt2 },
                render(h) {
                    return h('div', { style: 'width:800px;height:500px' }, [h(Ctor, { props: { opt: this.opt }, ref: 'wm' })])
                },
            }).$mount(holder)
            window.__d = { parent, vm: parent.$refs.wm }
        }, opt)
        await waitUntilExist(page, '第二個實例載入完成且靜止', () => window.__d.vm.mapLoaded === true && window.__d.vm.state === 'idle', { timeout: 60000 })
        await settleRequests()
        //計數器(僅包裝,行為不變): 元件之 applyBaseMaps/applyTerrain 與地圖之 addSource/removeSource/setTerrain
        await ev(() => {
            let { vm } = window.__d
            let map = vm.getMapObject()
            let c = window.__d.cnt = { applyBaseMaps: 0, applyTerrain: 0, addSource: 0, removeSource: 0, setTerrain: [] }
            let wrap = (obj, n, fn) => {
                let f = obj[n]
                obj[n] = function(...a) {
                    fn(a)
                    return f.apply(this, a)
                }
            }
            wrap(vm, 'applyBaseMaps', () => c.applyBaseMaps++)
            wrap(vm, 'applyTerrain', () => c.applyTerrain++)
            wrap(map, 'addSource', () => c.addSource++)
            wrap(map, 'removeSource', () => c.removeSource++)
            wrap(map, 'setTerrain', (a) => c.setTerrain.push(JSON.stringify(a[0])))
        })
    }
    let readCnt = () => ev(() => JSON.parse(JSON.stringify(window.__d.cnt)))
    let layerIds = () => ev(() => window.__d.vm.getMapObject().getStyle().layers.map((l) => l.id))

    let baseOpt = (extra = {}) => ({
        center: [23.5, 121.1],
        zoom: 7,
        projection: 'mercator',
        panelLabels: { show: false },
        panelBaseMaps: {
            show: true,
            terrainMap: {}, //不套用地形
            baseMaps: [
                { name: 'B0', url: 'http://tile.local/l0/{z}/{x}/{y}.png', colorShade: 'light', visible: true, opacity: 1 },
                { name: 'O1', url: 'http://tile.local/l1/{z}/{x}/{y}.png', colorShade: '', visible: true, opacity: 1 },
                { name: 'O2', url: 'http://tile.local/l2/{z}/{x}/{y}.png', colorShade: '', visible: true, opacity: 1 },
            ],
        },
        ...extra,
    })
    let terrainOpt = () => {
        let opt = baseOpt()
        opt.panelBaseMaps.terrainMap = {
            terrainSource: { url: 'http://tile.local/dem/{z}/{x}/{y}.png', encoding: 'terrarium', tileSize: 256, maxzoom: 0 },
            exaggeration: 1.5,
            hillshadeSource: { url: 'http://tile.local/dem/{z}/{x}/{y}.png', encoding: 'terrarium', tileSize: 256, maxzoom: 0 },
            hillshadeExaggeration: 0.5,
        }
        return opt
    }
    let panelHasName = (name) => ev((n) => [...document.querySelectorAll('.clsPanel label span')].some((s) => s.textContent.trim() === n), name)

    it('E2E-D1 僅改疊加層 name: 面板更新、不整組重建、不重抓圖磚', async function() {
        await mount(baseOpt())
        assert.ok(sumBase() > 0, '前置: 圖磚已載入(計數器有感)')
        let ids0 = await layerIds()
        let n0 = sumBase()
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.baseMaps[1].name = 'O1-renamed'
        })
        await waitUntilExist(page, '面板顯示新名稱', () => [...document.querySelectorAll('.clsPanel label span')].some((s) => s.textContent.trim() === 'O1-renamed'))
        await settleRequests()
        let c = await readCnt()
        assert.strictEqual(await panelHasName('O1-renamed'), true) //J-name: 面板名稱照常更新
        assert.strictEqual(await panelHasName('O1'), false) //J-name: 舊名稱不再顯示
        assert.strictEqual(c.applyBaseMaps, 0, '僅改名不應整組重套底圖') //J-name、J-diff
        assert.strictEqual(c.addSource + c.removeSource, 0, '僅改名不應新增/移除來源') //J-name
        assert.strictEqual(sumBase() - n0, 0, `僅改名不應重抓圖磚, 實際多 ${sumBase() - n0} 張`) //J-name
        assert.deepStrictEqual(await layerIds(), ids0, '圖層 id 與疊序不變') //J-name: 圖層 id 不含 name
        //J-prev: 改名後以新名稱定位疊加層, 舊名稱查無
        let pv = await ev(() => ({ neu: window.__d.vm.previewOverlayOpacity('O1-renamed', 0.3), old: window.__d.vm.previewOverlayOpacity('O1', 0.3) }))
        assert.strictEqual(pv.neu, true, '新名稱可預覽')
        assert.strictEqual(pv.old, false, '舊名稱查無')
        //名稱與可見性同改 → 仍走增量(不重建), 可見性生效
        await ev(() => {
            let bm = window.__d.parent.opt.panelBaseMaps.baseMaps[2]
            bm.name = 'O2-renamed'; bm.visible = false
        })
        await waitUntilExist(page, '面板顯示新名稱(O2)', () => [...document.querySelectorAll('.clsPanel label span')].some((s) => s.textContent.trim() === 'O2-renamed'))
        await settleRequests()
        let c2 = await readCnt()
        assert.strictEqual(c2.applyBaseMaps, 0, '名稱＋可見性同改走增量, 不整組重套') //J-diff
        let vis = await ev(() => {
            let m = window.__d.vm.getMapObject()
            let l = m.getStyle().layers.filter((x) => String(x.id).indexOf('basemap-layer-') === 0)
            return l.map((x) => (m.getLayoutProperty(x.id, 'visibility') || 'visible'))
        })
        assert.deepStrictEqual(vis, ['visible', 'visible', 'none'], '第三層(O2)已隱藏') //J-diff: 可見性就地更新
        //底圖(radio, colorShade 非空)改名: 同樣不整組重建、不重抓圖磚, 面板名稱更新
        let n1 = sumBase()
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.baseMaps[0].name = 'B0-renamed'
        })
        await waitUntilExist(page, '面板顯示新名稱(B0)', () => [...document.querySelectorAll('.clsPanel label span')].some((s) => s.textContent.trim() === 'B0-renamed'))
        await settleRequests()
        let c3 = await readCnt()
        assert.strictEqual(c3.applyBaseMaps, 0, '底圖改名不應整組重套') //J-name、J-diff
        assert.strictEqual(sumBase() - n1, 0, `底圖改名不應重抓圖磚, 實際多 ${sumBase() - n1} 張`) //J-name
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-D2 負向: url 變更與 name＋maxzoom 同改仍整組重建(重抓圖磚)', async function() {
        await mount(baseOpt())
        //url 變更(結構性): 新圖磚路徑 l2b 須被請求, 整組重套
        let n0 = sumBase()
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.baseMaps[2].url = 'http://tile.local/l2b/{z}/{x}/{y}.png'
        })
        await waitUntilExist(page, 'url 變更後已重套', () => window.__d.cnt.applyBaseMaps >= 1)
        await settleRequests()
        let c1 = await readCnt()
        assert.ok(c1.applyBaseMaps >= 1, 'url 變更應整組重套') //J-diff: url → 完整重建
        assert.ok((counts.base.l2b || 0) >= 1, '新 url 之圖磚應被請求') //J-diff
        assert.ok(sumBase() - n0 >= 1, '應重抓圖磚')
        //name 與 maxzoom 同改: 不被 name 之放行吞掉
        let a0 = c1.applyBaseMaps
        await ev(() => {
            let bm = window.__d.parent.opt.panelBaseMaps.baseMaps[1]
            bm.name = 'O1-renamed'
            window.__d.vm.$set(bm, 'maxzoom', 5)
        })
        await waitUntilExist(page, 'name＋maxzoom 同改後已重套', (a) => window.__d.cnt.applyBaseMaps > a, { arg: a0 })
        await settleRequests()
        let c2 = await readCnt()
        assert.ok(c2.applyBaseMaps > a0, 'name 與 maxzoom 同改應整組重套') //J-diff: maxzoom → 完整重建
        assert.strictEqual(await panelHasName('O1-renamed'), true, '面板名稱仍更新') //J-name
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-D3 僅改地形 exaggeration: 同來源就地更新, 不重抓 DEM, 倍率生效', async function() {
        await mount(terrainOpt())
        assert.ok(counts.dem > 0, '前置: DEM 已載入(計數器有感)')
        let st0 = await ev(() => {
            let m = window.__d.vm.getMapObject()
            let t = m.getTerrain()
            return { terrain: t && { source: t.source, exaggeration: t.exaggeration }, ids: m.getStyle().layers.map((l) => l.id) }
        })
        assert.deepStrictEqual(st0.terrain, { source: 'terrain-src', exaggeration: 1.5 }, '前置: 地形已啟用, 倍率 1.5')
        assert.ok(st0.ids.indexOf('terrain-hillshade') >= 0, '前置: hillshade 存在')
        let d0 = counts.dem
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.terrainMap.exaggeration = 3
        })
        await waitUntilExist(page, '倍率生效', () => {
            let t = window.__d.vm.getMapObject().getTerrain(); return !!t && t.exaggeration === 3
        })
        await settleRequests()
        let c = await readCnt()
        assert.strictEqual(c.applyTerrain, 0, '僅改倍率不應整組重套地形') //J-exag
        assert.strictEqual(c.addSource + c.removeSource, 0, '不應新增/移除 DEM 來源') //J-exag
        assert.deepStrictEqual(c.setTerrain.map((s) => JSON.parse(s)), [{ source: 'terrain-src', exaggeration: 3 }], '僅就地 setTerrain 一次(同來源, 無 setTerrain(null))') //J-exag
        assert.strictEqual(counts.dem - d0, 0, `不應重抓 DEM, 實際多 ${counts.dem - d0} 張`) //J-exag
        let st1 = await ev(() => {
            let m = window.__d.vm.getMapObject()
            let t = m.getTerrain()
            return { terrain: t && { source: t.source, exaggeration: t.exaggeration }, ids: m.getStyle().layers.map((l) => l.id) }
        })
        assert.deepStrictEqual(st1.terrain, { source: 'terrain-src', exaggeration: 3 }, '倍率確實生效') //J-exag
        assert.deepStrictEqual(st1.ids, st0.ids, 'hillshade 與其餘圖層疊序不變') //J-exag: hillshade 不動
        //再改一次(小數): 仍就地、仍不重抓
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.terrainMap.exaggeration = 2.2
        })
        await waitUntilExist(page, '倍率再次生效', () => {
            let t = window.__d.vm.getMapObject().getTerrain(); return !!t && t.exaggeration === 2.2
        })
        await settleRequests()
        let c2 = await readCnt()
        assert.strictEqual(c2.applyTerrain, 0, '再改倍率仍不整組重套') //J-exag
        assert.strictEqual(counts.dem - d0, 0, '再改倍率仍不重抓 DEM') //J-exag
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-D4 負向: 地形來源 url、hillshadeExaggeration 變更(含與倍率同改)仍整組重套', async function() {
        await mount(terrainOpt())
        //hillshadeExaggeration 變更(非僅倍率): 整組重套
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.terrainMap.hillshadeExaggeration = 0.9
        })
        await waitUntilExist(page, 'hillshadeExaggeration 變更後已重套', () => window.__d.cnt.applyTerrain >= 1)
        await settleRequests()
        let c1 = await readCnt()
        assert.strictEqual(c1.applyTerrain, 1, 'hillshadeExaggeration 變更仍整組重套') //J-exag: 其餘欄位 → 整組重套
        //地形來源 url 變更: 整組重套且重抓 DEM
        let d0 = counts.dem
        await ev(() => {
            window.__d.parent.opt.panelBaseMaps.terrainMap.terrainSource.url = 'http://tile.local/dem2/{z}/{x}/{y}.png'
        })
        await waitUntilExist(page, 'url 變更後已重套', () => window.__d.cnt.applyTerrain >= 2)
        await settleRequests()
        let c2 = await readCnt()
        assert.strictEqual(c2.applyTerrain, 2, '來源 url 變更整組重套') //J-exag
        assert.ok(counts.dem - d0 >= 1, '來源 url 變更應重抓 DEM') //J-exag
        //與倍率同改: 仍整組重套, 倍率亦生效
        await ev(() => {
            let tm = window.__d.parent.opt.panelBaseMaps.terrainMap
            tm.exaggeration = 4
            tm.hillshadeExaggeration = 0.3
        })
        await waitUntilExist(page, '倍率＋hillshadeExaggeration 同改後已重套', () => window.__d.cnt.applyTerrain >= 3)
        await settleRequests()
        let c3 = await readCnt()
        assert.strictEqual(c3.applyTerrain, 3, '倍率與其餘欄位同改整組重套') //J-exag
        let t = await ev(() => {
            let x = window.__d.vm.getMapObject().getTerrain(); return x && { source: x.source, exaggeration: x.exaggeration }
        })
        assert.deepStrictEqual(t, { source: 'terrain-src', exaggeration: 4 }, '整組重套後倍率生效')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-D5 未啟用地形時改 exaggeration: 就地更新不適用, 改走整組重套且不報錯', async function() {
        await mount(baseOpt())
        assert.strictEqual(await ev(() => window.__d.vm.getMapObject().getTerrain() || null), null, '前置: 未啟用地形')
        //terrainMap 由 {} 改為只給 exaggeration(「只給exaggeration則無地形」): 兩者皆無地形來源, 僅差倍率
        await ev(() => {
            window.__d.vm.$set(window.__d.parent.opt.panelBaseMaps, 'terrainMap', { exaggeration: 2 })
        })
        await waitUntilExist(page, '已走整組重套(就地不適用之後備)', () => window.__d.cnt.applyTerrain >= 1)
        await settleRequests()
        let c = await readCnt()
        assert.strictEqual(c.applyTerrain, 1, '無地形來源時就地更新不適用, 後備整組重套') //J-exag
        assert.strictEqual(c.setTerrain.filter((s) => s.indexOf('terrain-src') >= 0).length, 0, '不應設定不存在之來源')
        assert.strictEqual(await ev(() => window.__d.vm.getMapObject().getTerrain() || null), null, '結果仍無地形') //terrainMap 無有效來源 → 不套用
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })

    it('E2E-D6 範例頁 runtimeSync 之 #btnTerrainTune(e2e-runtime E2E-012 之前提): 同改倍率與 hillshadeExaggeration, 走整組重套且 hillshade 強度更新', async function() {
        //E2E-012 驗「重套 terrain 後 hillshade 疊序」; 其初始載入即成立, 故須另證該按鈕確實觸發整組重套(僅改倍率會走就地路徑而不重建 hillshade)
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
        await waitUntilExist(page, 'map canvas', () => !!document.querySelector('.maplibregl-canvas'), { timeout: 60000 })
        await page.locator('.clsSubMenu-basic', { hasText: 'runtimeSync' }).first().click()
        await waitUntilExist(page, 'runtimeSync 之地形與 hillshade 已就緒', () => {
            let m = window.__getMap && window.__getMap()
            return !!m && !!m.getTerrain() && !!m.getLayer('terrain-hillshade')
        }, { timeout: 60000 })
        await ev(() => {
            let m = window.__getMap()
            let el = m.getCanvas()
            while (el && !(el.__vue__ && el.__vue__.getMapObject)) {
                el = el.parentElement
            }
            let vm = el.__vue__
            window.__d = { vm, cnt: { applyTerrain: 0 } }
            let f = vm.applyTerrain
            vm.applyTerrain = function(...a) {
                window.__d.cnt.applyTerrain++
                return f.apply(this, a)
            }
        })
        let h0 = await ev(() => window.__getMap().getPaintProperty('terrain-hillshade', 'hillshade-exaggeration'))
        await page.locator('#btnTerrainTune').click()
        await waitUntilExist(page, 'hillshade 強度已更新(整組重套後)', () => window.__getMap().getPaintProperty('terrain-hillshade', 'hillshade-exaggeration') === 0.7)
        let r = await ev(() => ({
            n: window.__d.cnt.applyTerrain,
            ex: window.__getMap().getTerrain().exaggeration,
            hasHillshade: !!window.__getMap().getLayer('terrain-hillshade'),
        }))
        assert.notStrictEqual(h0, 0.7, '前置: 點擊前 hillshade 強度非 0.7')
        assert.strictEqual(r.n, 1, '按鈕應觸發一次整組重套(applyTerrain)') //J-exag: 與倍率同改其餘欄位 → 整組重套
        assert.strictEqual(r.ex, 2, '倍率生效')
        assert.strictEqual(r.hasHillshade, true, 'hillshade 圖層仍在')
        assert.strictEqual(errs.length, 0, `不應有頁面錯誤: ${errs.join(' | ')}`)
    })
})
