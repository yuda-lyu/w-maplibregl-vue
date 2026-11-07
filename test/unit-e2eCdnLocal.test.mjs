// unit: e2e 外部 script 本機副本之對照與檢查(test/tools/e2eCdnLocal.mjs, 規則帳本 R5〈e2e 外部 script 本機副本〉, 排程第 329 項)
//
// 規格句(主控 2026-11-07 裁定, mv329b):
//   C1 e2e 進場不依賴外部 CDN: public/index.html 之每個外部 script/stylesheet 皆有本機副本對應(新增外部資源而未對應即紅, 不靜默回退外網)
//   C2 副本優先取 node_modules 內對應套件之產物; 無對應套件者放 test/fixtures/cdn/, 不新增 >= 1MB 之檔
//   C3 對照表不留已不在首頁之網址(與首頁同步)
//   C4 檢查失敗即拋錯: 未對應之外部資源、副本檔不存在
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { CDN_LOCAL, findExternalResources, findUnmapped, loadCdnLocal } from './tools/e2eCdnLocal.mjs'

let fdTmp = path.resolve('./test/_tmp/unit-e2eCdnLocal')

describe('unit-e2eCdnLocal', function() {

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    it('CL1 C1/C3 實際 public/index.html 之外部資源皆有本機副本, 且對照表之網址皆仍在首頁', function() {
        let html = fs.readFileSync('./public/index.html', 'utf8')
        let ext = findExternalResources(html)
        assert.ok(ext.length >= 1, '前提: 首頁有外部 script(否則本輔助無對象)')
        assert.deepStrictEqual(findUnmapped(html), [], 'C1: 首頁之外部資源皆須有本機副本')
        let stale = CDN_LOCAL.map((x) => x.url).filter((u) => !ext.includes(u))
        assert.deepStrictEqual(stale, [], 'C3: 對照表不得有已不在首頁之網址')
    })

    it('CL2 C2 副本檔皆存在; node_modules 以外之副本放 test/fixtures/cdn/ 且各 < 1MB', function() {
        let items = loadCdnLocal({ force: true })
        assert.strictEqual(items.length, CDN_LOCAL.length)
        for (let it of items) {
            assert.ok(it.body.length > 0, `${it.file} 不得為空`)
            assert.ok(it.file.startsWith('node_modules/') || it.file.startsWith('test/fixtures/cdn/'), `C2: 副本位置 ${it.file}`)
            if (!it.file.startsWith('node_modules/')) assert.ok(it.body.length < 1024 * 1024, `C2: 入 repo 之副本須 < 1MB: ${it.file} ${it.body.length}`)
        }
    })

    it('CL3 C1 外部資源之辨識: http/https/協定相對之 script 與 stylesheet 計入, 本機路徑與非 stylesheet 之 link 不計', function() {
        let html = [
            '<link rel="icon" href="https://x.example/favicon.ico">',
            '<link rel="stylesheet" href="https://x.example/a.css">',
            '<script src="./local.js"></script>',
            '<script src="/abs/local.js"></script>',
            '<script src="https://x.example/b.js"></script>',
            '<script defer src=\'//x.example/c.js\'></script>',
            '<script src="http://x.example/d.js" async></script>',
        ].join('\n')
        assert.deepStrictEqual(findExternalResources(html), ['https://x.example/a.css', 'https://x.example/b.js', '//x.example/c.js', 'http://x.example/d.js'])
        assert.deepStrictEqual(findUnmapped(html, [{ url: 'https://x.example/b.js', file: 'x' }]), ['https://x.example/a.css', '//x.example/c.js', 'http://x.example/d.js'])
    })

    it('CL4 C4 首頁有未對應之外部資源即拋錯; 副本檔不存在即拋錯', function() {
        //未對應: 首頁多一支外部 script
        let r1 = path.join(fdTmp, 'r1')
        fs.mkdirSync(path.join(r1, 'public'), { recursive: true })
        let html = fs.readFileSync('./public/index.html', 'utf8').replace('</head>', '<script src="https://x.example/new.js"></script></head>')
        assert.ok(html.includes('https://x.example/new.js'), '前提: 已插入新外部 script')
        fs.writeFileSync(path.join(r1, 'public', 'index.html'), html)
        assert.throws(() => loadCdnLocal({ root: r1, force: true }), /未對應本機副本之外部資源.*https:\/\/x\.example\/new\.js/)
        //副本不存在: 首頁與對照表一致, 但 root 下無副本檔
        let r2 = path.join(fdTmp, 'r2')
        fs.mkdirSync(path.join(r2, 'public'), { recursive: true })
        fs.copyFileSync('./public/index.html', path.join(r2, 'public', 'index.html'))
        assert.throws(() => loadCdnLocal({ root: r2, force: true }), /本機副本不存在/)
        //還原快取為專案根(其後之呼叫取用正式副本)
        assert.strictEqual(loadCdnLocal({ force: true }).length, CDN_LOCAL.length)
    })

})
