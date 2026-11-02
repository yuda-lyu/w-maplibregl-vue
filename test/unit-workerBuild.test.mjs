// unit: 內嵌 worker 產製腳本 toolg/gDistRollupWorkerFuncs.mjs 之建置行為(規則帳本 R1 守門①、R17; 發布與建置腳本依 dspec〈自有套件之發布與建置腳本〉)
//
// 不需瀏覽器; 腳本依 cwd 取 ./node_modules/maplibre-gl 與 ./package.json、寫 ./src/js/maplibreWorkerInline.mjs,
// 故測試不改寫 toolg, 把腳本與其輸入複製到 test/_tmp/unit-workerBuild/(副本)後以該夾為 cwd 執行(test/tools/toolgCopy.mjs)。
// 規格句(以下代稱 J-xxx):
//   J-build  在副本重跑產製腳本: 離開碼 0、產出 src/js/maplibreWorkerInline.mjs, 匯出恰為 maplibreVersion、classicLength、default,
//            maplibreVersion = 安裝版, classicLength = findClassicLength(default)
//   J-sync   重跑結果與入版控之產製物(src/js/maplibreWorkerInline.mjs)一致(忽略換行差異): 產製物不得與腳本、安裝版脫節(maplibre-gl 升版後須重跑)
//   J-pin    package.json 之 dependencies.maplibre-gl 非固定版號(^、~、未指定)或與安裝版不符, 腳本須非零離開並說明原因, 且不產出(R1 守門①)
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { findClassicLength } from '../toolg/gDistRollupWorkerFuncs.mjs'
import { copyToCopy, runNodeInCopy } from './tools/toolgCopy.mjs'

//以模組位置定位(不依執行目錄)
let ROOT = fileURLToPath(new URL('../', import.meta.url))
let DIR_TMP = path.join(ROOT, 'test', '_tmp', 'unit-workerBuild')
let FP_OUT = path.join(DIR_TMP, 'src', 'js', 'maplibreWorkerInline.mjs')
let FP_REPO_PRODUCT = path.join(ROOT, 'src', 'js', 'maplibreWorkerInline.mjs')

let VER_INSTALLED = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'maplibre-gl', 'package.json'), 'utf8')).version

let readLf = (fp) => fs.readFileSync(fp, 'utf8').replace(/\r\n/g, '\n')

describe('unit-workerBuild', function() {
    this.timeout(180000)

    before(function() {
        fs.rmSync(DIR_TMP, { recursive: true, force: true })
        fs.mkdirSync(DIR_TMP, { recursive: true })
        copyToCopy(ROOT, DIR_TMP, [
            'toolg/gDistRollupWorkerFuncs.mjs',
            'package.json',
            'node_modules/maplibre-gl/package.json',
            'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
        ])
    })
    beforeEach(function() {
        //每案自乾淨狀態起: 還原副本 package.json、移除上一案之產出, 並備妥輸出資料夾
        copyToCopy(ROOT, DIR_TMP, ['package.json'])
        fs.rmSync(path.join(DIR_TMP, 'src'), { recursive: true, force: true })
        fs.mkdirSync(path.join(DIR_TMP, 'src', 'js'), { recursive: true })
    })
    after(function() {
        fs.rmSync(DIR_TMP, { recursive: true, force: true })
        assert.ok(!fs.existsSync(DIR_TMP), '測試專用夾須已刪除')
        try {
            fs.rmdirSync(path.dirname(DIR_TMP)) //test/_tmp 若為本測試建立且已空則一併移除(非空則保留, 其他測試之臨時夾不動)
        }
        catch (err) { /* 非空或不存在 */ }
    })

    it('U54 重跑產製腳本(副本 cwd): 產出內嵌 worker 檔, 匯出、版本與切分長度正確, 且與入版控之產製物一致', async function() {
        let r = await runNodeInCopy(DIR_TMP, ['toolg/gDistRollupWorkerFuncs.mjs'])

        // J-build: 離開碼 0 且已產出
        assert.strictEqual(r.code, 0, `產製腳本須成功離開(實得 ${r.code}): ${(r.stdout + r.stderr).slice(-1500)}`)
        assert.ok(fs.existsSync(FP_OUT), `須產出 ${FP_OUT}`)

        // J-build: 匯出恰為三項, 版本 = 安裝版, classicLength = 切分規則對內嵌原始碼之結果
        let mod = await import(pathToFileURL(FP_OUT).href)
        assert.deepStrictEqual(Object.keys(mod).sort(), ['classicLength', 'default', 'maplibreVersion'], '匯出名')
        assert.strictEqual(mod.maplibreVersion, VER_INSTALLED, 'maplibreVersion 須等於安裝版')
        assert.strictEqual(typeof mod.default, 'string')
        assert.strictEqual(mod.classicLength, findClassicLength(mod.default), 'classicLength 須等於 findClassicLength(內嵌原始碼)')

        // J-sync: 與入版控之產製物一致(忽略換行差異)
        assert.strictEqual(readLf(FP_OUT), readLf(FP_REPO_PRODUCT), 'src/js/maplibreWorkerInline.mjs 與重跑結果不一致: 腳本或 maplibre-gl 版本已變, 須重跑 node toolg/gDistRollupWorkerFuncs.mjs 並入版控')
    })

    it('U55 dependencies.maplibre-gl 非固定版號或與安裝版不符: 產製腳本非零離開、說明原因、不產出', async function() {
        let [maj, min, pat] = VER_INSTALLED.split('.').map(Number)
        let verOther = `${maj}.${min}.${pat + 1}`
        let bads = [
            ['範圍版號 ^', `^${VER_INSTALLED}`, /須為固定版號/],
            ['範圍版號 ~', `~${VER_INSTALLED}`, /須為固定版號/],
            ['未指定', '', /須為固定版號/],
            ['固定版號但與安裝版不符', verOther, /實際安裝為/],
        ]
        for (let [name, spec, re] of bads) {
            // J-pin: 副本 package.json 只改 dependencies.maplibre-gl
            let dependencies = spec === '' ? {} : { 'maplibre-gl': spec }
            fs.writeFileSync(path.join(DIR_TMP, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0', dependencies }), 'utf8')
            fs.rmSync(FP_OUT, { force: true })

            let r = await runNodeInCopy(DIR_TMP, ['toolg/gDistRollupWorkerFuncs.mjs'])
            assert.notStrictEqual(r.code, 0, `${name}: 須非零離開`)
            assert.ok(re.test(r.stderr), `${name}: 須說明原因 ${re}, 實為: ${r.stderr.slice(-600)}`)
            assert.ok(!fs.existsSync(FP_OUT), `${name}: 不得產出`)
        }
    })

})
