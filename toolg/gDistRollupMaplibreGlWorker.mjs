import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rollup } from 'rollup'


//產製 src/js/maplibreWorkerInline.mjs: 把 maplibre-gl 之 worker 打包成「自足單檔」後內嵌為字串,
//供執行期以 Blob + setWorkerUrl 載入, 使本套件於任何環境(umd script / webpack / vite / 下游 bundler)
//皆無須外部 worker 檔案。
//
//why 需要打包而非直接內嵌 maplibre-gl-worker.mjs 原檔:
//  該原檔會以相對路徑 import 同目錄之 maplibre-gl-shared.mjs(約 516KB), 內嵌成 Blob 後其相對 import
//  會以 blob: URL 為基準解析而必然失敗, 故須先以 rollup 將 shared 併入成無外部 import 之單檔。
//  maplibre v6 僅提供 setWorkerUrl(string), 未提供可傳入 Worker 類別或工廠之入口, 故只能走此路。
//
//why 以 JSON.stringify 內嵌而不轉 base64:
//  w-package-tools 之 rollupWorkerCore 係將程式碼內嵌於「模板字串」內再轉譯, 特殊符號(反引號、${}、$&)
//  會破壞模板, 故其自述「因有特殊符號轉譯困難, 故需先轉base64再使用」; 本腳本為直接產生檔案並以
//  JSON.stringify 輸出為字串字面值, 不經任何模板或字串替換, 故無該問題。
//  且 base64 會多出約 33% 體積與執行期解碼成本, 而 wsemi 之 b642u8arr 底層 crypto-js 亦自述
//  「沒有支援chunk或stream機制, 無法處理大量資料」, 不宜用於本處之資料量(約 500KB)。
//  沿用其做法之處為「Blob + createObjectURL 建立 worker」, 見 src/js/mapCore.mjs。
//
//此檔之產出物須入版控: dev(webpack)與 build(rollup)兩種情境皆於編譯期讀取它。
//maplibre-gl 升版後須重跑本腳本; 另於 gDistRollupComps.mjs 內會自動先行呼叫, 故 dist 永為最新。
//用法: node toolg/gDistRollupMaplibreGlWorker.mjs

let fpEntry = './node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'
let fpTar = './src/js/maplibreWorkerInline.mjs'
let fpPkg = './node_modules/maplibre-gl/package.json'


async function gDistRollupMaplibreGlWorker() {

    if (!fs.existsSync(fpEntry)) {
        throw new Error(`找不到 ${fpEntry}, maplibre-gl 之 worker 檔名或路徑可能已變更, 須同步修正本腳本`)
    }

    //maplibre-gl 版本: 內嵌供執行期比對, 避免內嵌 worker 與主程式版本不一致而靜默出錯
    let ver = JSON.parse(fs.readFileSync(fpPkg, 'utf8')).version

    //rollup: 入口為 worker, 其相對 import 之 shared 會被併入(shared 本身無 import, 故無須任何 plugin)
    let bundle = await rollup({
        input: fpEntry,
        onwarn: () => {}, //maplibre 產物之 circular/eval 類警告非本專案可處置, 不輸出以免淹沒
    })
    let { output } = await bundle.generate({ format: 'es' })
    await bundle.close()

    if (output.length !== 1) {
        throw new Error(`預期 worker 應打包為單一 chunk, 實得 ${output.length} 個, 內嵌後其相對 import 會失敗`)
    }
    let code = output[0].code

    //自足性檢查: 打包後不得殘留任何外部 import/export(殘留即代表 Blob 載入時會解析失敗)
    let mRest = code.match(/^\s*(import|export)\s+[^;]*from\s*['"][^'"]+['"]/m)
    if (mRest) {
        throw new Error(`打包後仍殘留外部 import: ${mRest[0].slice(0, 120)}`)
    }

    let c = ''
    c += `/**\n`
    c += ` * maplibreWorkerInline.mjs\n`
    c += ` * maplibre-gl 之 worker 自足打包內嵌字串(機器產製, 請勿手改)\n`
    c += ` *\n`
    c += ` * 來源: ${fpEntry}(含其相對 import 之 maplibre-gl-shared.mjs)\n`
    c += ` * 產製: node toolg/gDistRollupMaplibreGlWorker.mjs\n`
    c += ` * maplibre-gl 版本: ${ver}\n`
    c += ` *\n`
    c += ` * why: maplibre 6.x 起 worker 為外部檔案, 打包器無法代為處理; 本套件改以 Blob 於執行期載入,\n`
    c += ` *      使使用端無須另行部署 worker 檔案或設定 setWorkerUrl。詳見 toolg/gDistRollupMaplibreGlWorker.mjs\n`
    c += ` */\n`
    c += `\n`
    c += `export const maplibreVersion = ${JSON.stringify(ver)}\n`
    c += `\n`
    c += `export default ${JSON.stringify(code)}\n`

    fs.writeFileSync(fpTar, c, 'utf8')

    console.log(`generated: ${fpTar}`)
    console.log(`  maplibre-gl 版本: ${ver}`)
    console.log(`  worker 打包後: ${(code.length / 1024).toFixed(1)} KB`)
    console.log(`  內嵌檔總計:   ${(c.length / 1024).toFixed(1)} KB`)

}


//直接執行時才跑(被 import 時不跑)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    gDistRollupMaplibreGlWorker()
}


export default gDistRollupMaplibreGlWorker
