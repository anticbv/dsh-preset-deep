# Changelog

版本号遵循 SemVer；每个版本对应一个 GitHub Release 与附注 tag。

## 0.1.5 — 2026-11-11

补掉 0.1.4 复核里的三处问题：断言没咬住、生命周期没收干净、探针自证。

- **config 缺失不再放行**（validate）：`tool-subagent` 的 `config` 块整块被删时，原先两条断言被 `if (sub && sub.config)` 一起跳过（实测 90 passed、exit 0）。现在先断言 config 存在，再断言两个布尔；`mutation.cjs` 增加 M10 复现这一刀。（92 → **93 条**）
- **注销后不再复活**（client）：`stop()` 置 `disposed`，`sync()`/`start()` 早退，`DOMContentLoaded` 改用具名 `onReady` 并在注销时移除监听。此前 apply 后立刻注销、再触发该事件会重建 style 与探针；挂起的 rAF 帧也会重新打标。
- **删掉自证的 `cssHit`**：它数的是 sync 刚写的 `[data-ls-svg]`，与 `tagged` 恒等，无法证明样式生效。探针改为 `{plugin, label, size, tagged, at}`；判断样式请直接看 `getComputedStyle(svg).maskImage`。
- `test-icon.cjs` 的假 rAF 改为队列，新增「注销后挂起的 rAF」与「注销后迟到的 DOMContentLoaded」两条断言（25 → **26 条**）；变异自检 10 → **11 passed**。

## 0.1.4 — 2026-11-11

按外部审核的 N1–N11 逐条收口。没有新增功能，全部是「让声称和证据对上」。

- **图标命中判据**（N1/N2）：真实头部是 `aria-label="选择模式: 梁圣模式"`，整串相等永远不中。现在两个信号任一命中：容器文字整串等于 `LABEL`，或 `aria-label`/`title` **以** `LABEL` **结尾**。命中的 svg 自己打 `data-ls-svg`，CSS 只认这个属性——svg 前插 badge、或 svg 包在 span 里都不再影响遮罩，兄弟 svg（下拉箭头）也不会被误伤。
- **生命周期**（N5）：`stop()` 现在断开 observer、摘掉两类属性、删掉注入的 `style`、清掉 `__LS_ICON_STATUS__`；`observer` 收窄为 `{childList, subtree}`（去掉 `characterData` 这个必然误触发的选项）。
- **探针**（N5）：`__LS_ICON_STATUS__` 增 `cssHit`，用来区分「属性打上了」和「样式生效了」。
- **发布包可跑校验**（N3）：`js-yaml` 从 `devDependencies` 移到 `dependencies`（`^4.3.2`）；`validate.cjs` 缺包时打印安装提示并以 2 退出，不再是裸 `Cannot find module`。
- **不依赖用户侧 AGENTS.md**（N4）：persona 里三处外部引用改为自包含——哈希规则、检查点字段、`[未知]` 等级都在 preset 内写明；用户侧的 AGENTS.md 只作补充。
- **许可证归属**（N7）：新增 `NOTICE`，收录上游 `@deepseek-ai/dsh-web-app` `0.2.2-rc.1` 的 MIT 全文与版权行；README 与 CHANGELOG 同步指认派生来源。
- **插件元数据**（N8）：`exports` 暴露 `./icon`（即 `assets/icon.png`）与 `./locale/{zh,en}.json`，插件管理器可直接取标题、描述与图标；`files` 收录 `locale` 与 `NOTICE`。
- **宿主防御**（N10）：`apply(ctx)` 在 `ctx.skills.registerProvider` 缺席时记一条 warn 后返回，不再抛 `TypeError` 把整条插件行带崩。
- **卸载说明**（N11）：安装段补「卸载前先删掉本地手写的 `inject: [biliBasicCompactionPolicy]` 栅栏」，并更正「DSH 整体替换两个文件」的说法（`package.json` 不合并；`cordis.patch.yml` 是逐条叠加层）。
- **验收脚本**（N9④）：`acceptance.cjs` 的 `passed` 计数改为真实累加，出现未预期 id 时不再打印负数。
- **文档口径**（N9①/②/⑥/⑦）：`cordis.patch.yml` 与官方 ptc 的差异改述为「去掉 delegation 两个条目（共 7 行）+ 顶层加 `ls-icon`」；`npm run acceptance` 注明只校验题面标记；0.1.2 条的 CSS 写法改为当时的实际值。
- **校验**（N1 的执行面）：`validate.cjs` 从 70 条扩到 **92 条**——persona 8 个小节、每节 ≥25 字、总长 ≥1200；通用 provider 黑名单（`openai`/`anthropic`/`gpt-`/`claude-`/`gemini-`/`deepseek-chat`/`nemotron` 等）；内嵌图标与 `assets/icon.png` 逐字节一致（PNG 魔数、IHDR、正方形 ≥48px）；包名与客户端工厂 id 一致；`package-lock` 版本同步；`exports`/`files`/`locale` 自洽。
- **变异自检**：新增 `scripts/mutation.cjs`，把九类真实回归（persona 只剩关键词、写死 `openai/gpt-4o`、内嵌图标被换、`icon.png` 被截断、技能正文被掏空、包名漂移、persona 插 `{{model}}`、CSS 退回 `:first-child`、删掉 `tool-executor-ptc` 两行）逐个植进临时副本，确认 `validate` 或 `test-icon` 真的会红 → **10 passed**（含正对照）。
- **图标测试**：`test-icon.cjs` 重写为 25 条断言，覆盖「箭头 svg 不被遮罩」「svg 包在 span 里」「aria-label 以 LABEL 结尾」「注销时清理干净」「再 apply 能自愈」。
- CI 增加 `npm run mutation`。

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
- 图标：tag 兜底改用 `querySelector("svg")`，CSS 改为 `[data-ls-icon] svg:first-child`（后代选择器 + `:first-child`，0.1.4 起由 `[data-ls-svg]` 取代）。
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

- 首个版本：以官方 `0.2.2-rc.1` 的 `ptc` preset 为底，去掉 delegation 的两个条目（共 7 行）、替换 persona 与 plan-mode。
- 双许可 MIT OR Apache-2.0。
