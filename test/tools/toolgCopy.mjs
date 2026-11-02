// 測試輔助: 以「副本並指定 cwd」執行 toolg 腳本(發布與建置腳本依 cwd 取 ./src、./dist 等相對路徑, 測試不改寫 toolg, 也不另寫建置選項)
//   作法: 把腳本所需檔自套件根複製到 test/_tmp/<名>/(保持相對位置), 以 spawn 指定 cwd 為該夾執行 node <腳本>;
//   副本夾內不放 node_modules 連結: 腳本之裸 import(w-package-tools、rollup 等)由 node 往上層解析到套件根之 node_modules。
// 各測試於 after 自行刪除其副本夾(夾內只有複製檔, 無目錄連結)。
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

/**
 * 複製檔案或資料夾到副本夾(保持相對位置)
 * @param {String} root - 套件根之絕對路徑
 * @param {String} dirCopy - 副本夾之絕對路徑(須已存在或可建立)
 * @param {Array<String>} list - 相對於套件根之檔案或資料夾路徑
 */
export function copyToCopy(root, dirCopy, list) {
    for (let rel of list) {
        let from = path.join(root, rel)
        let to = path.join(dirCopy, rel)
        if (!fs.existsSync(from)) {
            throw new Error(`找不到要複製到副本之檔案: ${from}`)
        }
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.cpSync(from, to, { recursive: true })
    }
}

/**
 * 在副本夾以指定 cwd 執行 node 腳本
 * @param {String} dirCopy - 副本夾之絕對路徑(即 cwd)
 * @param {Array<String>} args - node 之參數, 例如 ['toolg/gDistRollupComps.mjs']
 * @param {Number} [timeoutMs=280000] - 逾時毫秒, 逾時即終止並以 code=null 回傳
 * @returns {Promise<{code:(Number|null),stdout:String,stderr:String}>} 離開碼與輸出
 */
export function runNodeInCopy(dirCopy, args, timeoutMs = 280000) {
    return new Promise((resolve, reject) => {
        let p = spawn(process.execPath, args, { cwd: dirCopy, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        p.stdout.on('data', (b) => {
            stdout += b.toString()
        })
        p.stderr.on('data', (b) => {
            stderr += b.toString()
        })
        let timer = setTimeout(() => {
            stderr += `\n[toolgCopy] 逾時 ${timeoutMs}ms, 終止`
            p.kill()
        }, timeoutMs)
        p.on('error', (err) => {
            clearTimeout(timer)
            reject(err)
        })
        p.on('close', (code) => {
            clearTimeout(timer)
            resolve({ code, stdout, stderr })
        })
    })
}
