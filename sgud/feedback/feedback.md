# 回饋(feedback)

任務中發現之自有套件、全域技能、全域設定之調整與抽提提案.一條一列,只增不改;處置結果(已通報、已修、不採納)另記一列並寫明承接哪一列.回饋是紀錄與提案,實際修改走全域設定 §5.2、§13 之通報管道.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 全域技能 | role-coder-for-test-e2e(§3 契約 C1「`launchBrowser()` 全專案唯一 `chromium.launch` 出口」、§8.4、§10〈提示框／hover 殘留〉之 `ignoreDefaultArgs` 說明、references/e2e-setup-contract.md 對 w-package-tools-e2e `launchChromium` 之描述) | 排程第 442 項起 Chromium 系啟動一律經自有套件 w-playwright(合併出恰一串含守門功能之 `--disable-features`),w-package-tools-e2e 之 `launchChromium`／`launchChromiumCore` 將移除;技能之 C1 與 §8.4 仍以「專案自有 wrapper 內呼叫 `chromium.launch`、旗標組由 wrapper 供給」為準,與「不直接依賴 playwright、`wpw.launchChromium` 為唯一啟動出口(原選項照傳、`autoInstall: true`)」不一致;§8.4 提到之「移除預設之 `--disable-features=…` 整串」之判別作法亦須改述為經 w-playwright 之 `getChromiumLaunchOptions` 檢視合併結果.建議:C1 改寫為「經 w-playwright 啟動之單一站點(如 `test/tools/e2eLaunch.mjs`)」,並補「接線測試以 `setBrowserTypeForTest` 斷言每個啟動點、至少一案以 `next()` 走真路徑、真 Chrome／Edge／完整 Chromium 每檔最多啟動一次」 | `~/.claude/skills/role-coder-for-test-e2e/SKILL.md` §3 C1、§8.4;`test/tools/e2eLaunch.mjs`、`test/unit-e2eLaunch.test.mjs`(本套件之落地);w-playwright 帳本 R-PW-WIRING |
| 2026-11-13 | 全域設定 | 派工提示詞(主控 `dispatch.mjs` 所附共通守則第 13 條與本次〈決策〉段)之 `decision-log.mjs` 呼叫範例 | 範例之任務資料夾寫成反斜線路徑(`C:\opensrcOper\dnow\…`);在 Git Bash 下反斜線被 shell 吞掉,工具回 `任務資料夾不存在: <當前目錄>\opensrcOperdnow…`(4 筆決策全數未寫入,須以正斜線重打).建議:範例改正斜線(`C:/opensrcOper/dnow/…`),或工具於路徑不存在時一併印出收到之原始字串,使「被吞反斜線」一眼可辨 | 本輪第一次 `decision-log.mjs` 呼叫輸出(4 行 FAILED);改正斜線後 `LOGGED … rows=144~147` |
