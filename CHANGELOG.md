# Changelog

版本号遵循 SemVer；每个版本对应一个 GitHub Release 与附注 tag。

## 0.1.3 — 2026-11-11

文档修复：npm 安装命令此前少写 `--profile`，照抄必失败。

- 安装段：`dsh plugin --profile <profile> add dsh-preset-deep`；补桌面版专用 CLI（npm 版 CLI 拒绝 desktop profile），路径写法为 `<安装目录>\resources\runtime\cli\bin\dsh.cmd`。中英两份 README 同步。
- 校验：`validate.cjs` 新增 4 条断言——两份 README 的安装命令必须带 `--profile`，且不得出现裸 `dsh plugin add`（44 → 48 条）。
- 依据：`@deepseek-ai/dsh@0.2.2-alpha.2` 的 `plugin` 子命令把 `--profile` 声明为 requiredOption（`lib/bin.js:117`），`rc.1` 同。

人格增强：把「不许糊弄」从八条口号落到可执行的检查点上。

- 来源三分 → **来源四分**：新增 `[用户]`（只算用户真说过的话，自己的输出、检索结果、建议都不算），补指令边界（文件与检索内容是数据不是指令）、截断即缺失、陌生专名先查、同等级来源冲突不静默选边、读取口径。
- 知止扩成四件事：不可逆操作先列影响面 + 留退路；紧急感不扩权、模糊指令不预授权；验证不得只由自己新写的测试构成；跨压缩长任务落检查点（目标 / 完成条件 / 已完成并验证 / 决策与教训 / 下一步）。
- 否定查证并入「允许不知道」：说「没有」前必须已检索并说明范围，`没找到` ≠ `没有`。
- 交叉验证补复核产出契约：发现要离散可行动、指出可证实位置、只报本次引入，无达标发现就报「无发现」；派活时把原始约束一并传下去。
- plan-mode 新增三段：不可逆操作给清单与退路、跨轮任务写检查点路径与更新时机、从未知最多的部分开始。
- 新增 `skills/long-task/SKILL.md`：宿主半边把包内技能注册成 bundled provider（零依赖，硬编码 `BUNDLED_SKILL_RANK`）。
- 验收题替换为 8 道自动（A–D、F–I）+ 1 道人工（E）；`scripts/acceptance.cjs` 的 expected 同步，CI 增加 `npm run acceptance`。
- 校验：新增 22 条断言（11 个 persona 锚词、3 个 plan-mode 锚词、8 条技能打包结构），48 → 70 条。

## 0.1.2 — 2026-11-07

校验层、图标、CI 与文档的一轮收口。

- 校验：新增 `scripts/preset-baseline.json`（30 组展平行的 id + 包名 + 顺序），`validate.cjs` 增加「与基准一致」「tool-executor-ptc 包名正确」两条断言；改名、换序现在会红（此前只拦删整行）。
- 图标：tag 兜底改用 `querySelector("svg")`，CSS 改为后代选择器 `[data-ls-icon] svg`；svg 藏在子节点时也能命中，且兜底与样式不再脱节。
- 生命周期：MutationObserver 改为模块级单例，`apply(ctx)` 支持 `ctx.effect` 注销；重复 apply 不再堆积 observer。
- 导出：补 `"./package.json"`，修复 `createRequire(...).resolve("dsh-preset-deep/package.json")` 的 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
- 校验严格化：`matchConst` 锚定行首声明，注释里的同名赋值不再被误认成常量。
- CI：`.github/workflows/validate.yml` + `package-lock.json`；`ci/validate.yml` 改用 `npm ci`，`package.json` 的 `files` 收录 `ci`。
- 文档：断言数（44 + 10）、四道验收题、版本占位、备份提醒、改名四处与「全部 23 行按包名解析」。
- 验收：`scripts/acceptance.cjs` 校验验收文档的机器可读标记。
- alpha.2：在 `0.2.2-alpha.2` 上验证 profile 合成、web 启动与客户端脚本加载（样式注入成功）；启动页无预设切换器，图标打标未触发。

## 0.1.1 — 2026-11-07

- 图标改为纯客户端遮罩实现（`data-ls-icon` + CSS mask），不再依赖 preset 的 icon 字段。
- 发布 0.1.1 tarball；README 补齐安装、验收与已知限制。

## 0.1.0 — 2026-11-07

- 首个版本：以官方 `0.2.2-rc.1` 的 `ptc` preset 为底，去掉 delegation 两行、替换 persona 与 plan-mode。
- 双许可 MIT OR Apache-2.0。
