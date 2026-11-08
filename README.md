# 梁圣模式 · dsh-preset-deep

[中文](README.md) | [English](README.en.md)

> 给 **DeepSeek Harness** 加第五个工作模式：**先证伪，再交付**。

Harness 自带的四个模式（standard / ptc / minimal / cordis）解决的是"能调哪些工具"。它们没有回答一个更常见的问题：**你什么时候才允许下结论。**

梁圣模式把这套标准写进 persona 与 plan-mode，而不是留给每次对话的口头约定。它不让你更快，它让你**不能糊弄**。

![模式图标](assets/screenshot.jpg)

## 核心能力

这八条是硬约束，不是建议。它们逐条对应一类最常见的失败：

| # | 能力 | 拦住的失败 |
|---|---|---|
| 1 | **开工四问** — 专家会做哪些没被要求的事、从什么一手材料入手、用什么具体方法、谁来判定对错 | 一上来就写代码，做完才发现方向错了 |
| 2 | **知止** — 开工先写完成条件（命令或断言），同一路径两次失败才停下报卡点 | 无限试错、假装完成 |
| 3 | **来源三分** — 每个事实标 `[文件]` / `[检索]` / `[记忆]`，`[记忆]` 不得进结论 | 把印象当证据 |
| 4 | **能算不算** — 数学、日期、边界、集合运算一律写代码验 | 心算造出的错误数字 |
| 5 | **允许不知道** — 拿不准标 `[未知]` 并写明缺什么 | 用"可能/大概"把不确定包装成结论 |
| 6 | **推理拆解** — 复杂推理拆成可独立判真假的小命题，逐个判再组装 | 一大段看起来严密、其实没有可检验环节的推断 |
| 7 | **交叉验证（按需）** — 拿不准的断言先自己换角度重查；只有你明确要求时，才派 2–3 个子代理独立作答，交付前也一样，只有要求才派**不带本次上下文的**复核者 | 自说自话的结论，没人从反面碰过 |
| 8 | **子代理：看得见，不主动用** — 能列出这台机器允许的路由（`list_subagent_models`，只读查询），但除非你明确要求，不会主动派活；真要派时按「当前可用 → 成本最低 → 能力足够」，同一条连失两次即换 | 为省 token 把判断外包，或该派时闷头硬扛 |

## 架构

```mermaid
flowchart TD
    subgraph bundle["dsh-preset-deep（一个 npm 包）"]
        P["cordis.patch.yml<br/>声明两个入口"]
        C["lib/client.js<br/>浏览器半边"]
    end

    P -->|insert| R["preset-deep · 梁圣模式"]
    P -->|insert| I["ls-icon<br/>图标宿主行"]

    R --> PS["persona<br/>八条交付契约"]
    R --> PM["plan-mode<br/>计划必须含证伪设计"]
    R --> DL["delegation<br/>subagent + modelSelection"]
    R --> PTC["tool-executor-ptc<br/>run_code"]

    DL --> SA["子代理<br/>可指定 provider / model / effort"]

    C -->|CSS mask| ICON["把模式图标画成剪影"]
    I -.->|挂载| C

    WS["profile 的 cordis.patch.yml"] -->|可选：白名单| SA
```

三件事值得注意：

1. **一个包，两个半边**：`cordis.patch.yml` 声明 preset 与图标宿主行；`lib/client.js` 是浏览器侧，不经过宿主。
2. **子代理要能换模型，还差一条白名单**：preset 只负责打开 `modelSelection`，真正授权来自 profile 层的 `subagent-model-selection-settings`（见下）。
3. **图标是客户端补丁，不是配置**：DSH 的 preset 没有 `icon` 字段，图标是写死的 svg，只能由客户端半边按文字定位后遮罩替换。

## 与 PTC 的差别

|  | PTC | 梁圣模式 |
|---|---|---|
| 计划 | 决策完整即可 | **必须含「证伪设计」**：至少两条能推翻自己的证据，并说明怎么取得 |
| 结论 | 无强制格式 | **必须标 `[实]` / `[推]` / `[未知]`**，标不出的不得进结论 |
| 计算 | 可以心算 | **能算的不许估** |
| 改动范围 | 按任务 | **只碰被点名的文件**，收尾贴 `git diff --stat` |

## 安装

**手动（从源码安装的备选路径）**

```bash
# 1. 复制到 profile 的 node_modules
cp -r dsh-preset-deep ~/.dsh/profiles/<profile>/node_modules/
# 2. profile 的 package.json 里，dsh.profile.bundles 末尾加 "dsh-preset-deep"
# 3. 重启 Harness
```

> 改 profile 的 `package.json` / `cordis.patch.yml` 前先备份这两个文件——DSH 对它们是整体替换，不是合并。

**从 release 的 tarball 安装**（不想 clone 的话）

```bash
# <version> 以 package.json / Release 页为准（当前 0.1.2）
tar -xzf dsh-preset-deep-<version>.tgz -C ~/.dsh/profiles/<profile>/node_modules/
mv ~/.dsh/profiles/<profile>/node_modules/package ~/.dsh/profiles/<profile>/node_modules/dsh-preset-deep
# 同样把 "dsh-preset-deep" 加进 dsh.profile.bundles，然后重启
```

**npm（推荐，0.1.2 起）**

```bash
dsh plugin add dsh-preset-deep
```

> 装完重启 Harness，新开会话选「梁圣模式」。在 DSH 0.2.2-alpha.2 上实测；`dsh plugin add` 会自动把这个包写进 profile 的 `dsh.profile.bundles`，不用手改。若报 workspace 错误，命令末尾加 `-w`。

> 装之前先删掉 profile 的 `cordis.patch.yml` 里手写的那段 `preset-deep`，否则同名冲突。只删整段 preset 定义；如果你按「已知限制」给 `- id: preset-deep` 加过 `inject:` 顺序栅栏，保留那一条。

## 按你的环境改写 persona

persona 在 `cordis.patch.yml` 的 `persona` 行里，发布版**不点名任何 provider 或模型**。想收紧就改那一行，例如把首选模型写死成你自己常用的那条、或让它在本机自动派免费模型；改完跑一次 `node scripts/validate.cjs`——它会拦住「persona 里写死了别人的 provider」这类回退。

## 示例

| 文件 | 干什么 |
|---|---|
| [`examples/allow-list.patch.yml`](examples/allow-list.patch.yml) | 子代理白名单的填空模板，复制进 profile 的 `cordis.patch.yml` |
| [`examples/acceptance.md`](examples/acceptance.md) | 五分钟验收清单：四道测试题 + 判据 + 四类失败签名 |

## 子代理

**看得见，但不主动用。**

- preset 的 `subagent` 行开着 `modelSelection` + `modelDiscovery`，所以 `list_subagent_models` 随时能列出这台机器允许的路由——这是只读查询，不算派活。
- persona 规定：**除非你明确要求，否则它不会派子代理**。不会为省 token 把判断活外包，也不会自己开几个子代理跑交叉验证。
- 要派活就直说：「派个子代理去做 X，用 `<provider>/<model>`」。它会按「当前可用 → 成本最低 → 能力足够」挑一条，同一条连失两次就换下一条，不重试同一条。
- 要交叉验证：「派 2–3 个子代理独立回答这个问题」；重要结论交付前加一句「派一个不带本次上下文的复核者看这份结论」。

### 白名单：换到非父路由的前提

> 没有会话级白名单时，子代理只能使用父会话同一条路由。

这就是「别的模式派不动别的模型」的真实原因——官方 preset 其实也写了 `modelSelection: true`，但从来没有配过白名单。在 profile 的 `cordis.patch.yml` 追加：

```yaml
- id: subagent-model-selection-settings
  name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings'
  config:
    enabled: true
    allowedModels:
      - { provider: deepseek-account, model: deepseek-flash }
      - { provider: <你的 free provider>, model: <模型 id> }
```

不配的话，显式指定别的路由会直接报 `child LLM route "<p>/<m>" is not allowed for this Session`。填空模板见 [`examples/allow-list.patch.yml`](examples/allow-list.patch.yml)。

## 图标

- 定位靠**文字**（`lib/client.js` 顶部的 `LABEL`），不是类名——DSH 的类名是构建哈希，升级就变。
- 主判据是"容器文字整串等于 `LABEL`"；万一 DSH 换了图标实现，还有 `aria-label` / `title` 兜底（svg 藏在子节点里也能命中）。
- 排查用：控制台执行 `window.__LS_ICON_STATUS__`，能看到 `{plugin, label, size, tagged, at}`。`tagged: 0` 就是没定位到。
- 遮罩用 `currentColor`，深浅主题自动跟随。
- 换图：替换 `assets/icon.png` 并重新编码进 `lib/client.js`；改大小：改 `ICON_SIZE`。

## 开发

```bash
npm install          # 只装 js-yaml（校验器解析 !!js 标签用）
npm test             # 44 项结构断言 + 12 项图标断言
```

`scripts/validate.cjs` 会拦住的回退包括：preset 行数/顺序变了、persona 少了承诺、persona 里写死别人的 provider、`modelSelection` 被关掉、`LABEL` 与 `config.name` 不一致、package.json 长出 `engines.dsh`。CI：`.github/workflows/validate.yml` 在每次 push / PR 上跑同样两条命令。推送账号若没有 `workflow` scope，GitHub 会拒绝通过 API 提交这个文件——换带 scope 的 token 重推；`ci/validate.yml` 保留同一份配置，便于本地或其它 CI 直接复用。

## 已知限制

- **改名要同步四处代码 + 一处文档**：`cordis.patch.yml` 的 `config.name`、`lib/client.js` 的 `LABEL`、`lib/client.js` 的 registration id（`__ModuleLoader__.load({ id: "dsh-preset-deep" })`）、`package.json` 的 `name`；README 里的截图说明也要跟着改。前两处不一致图标不出现（`validate.cjs` 会拦），后两处不一致客户端半边加载不上。
- **图标会溢出**：34px 图标放在 22px 高的标签里，靠 `[data-ls-icon]{overflow:visible}` 接住；挡住相邻元素就把 `ICON_SIZE` 降到 28px。
- **装了 billion-context 的话**：在 preset 行后补一条顺序栅栏：
  ```yaml
  - id: preset-deep
    inject: [biliBasicCompactionPolicy]
  ```
- 测试环境：Harness 运行时 `0.2.2-rc.1`（桌面版同版本）。

## 图标扫描开销

jsdom 合成 DOM（约 5000 个 svg）、Node `v26.12.1`、同一台机器实测：

| 指标 | 本次 | 说明 |
|---|---|---|
| 构建 DOM | 71.9 ms | 测试夹具成本，不算插件开销 |
| 单次 `sync()` 求值 | 0.061 ms | 选择器 + 文本比对 |
| 单次 `apply()` | 37.0 ms | 首次包含建 style 与全量打标 |
| 连续 10 轮 | 33.8 ms/轮 | MutationObserver 合并后的稳定值 |

墙钟测量，同机复跑允许 ±20–30%；真实页面数字请用 DevTools Performance 面板测 60 秒再引用。

## 版本兼容性

**没有版本门，这是刻意的。**

`package.json` 里既没有 `engines.dsh`，也没有 `@deepseek-ai/dsh*` 的 `peerDependencies`。DSH 的判定顺序是：有 `engines.dsh` 就只看它，否则逐个检查 `dsh` peer；两者都不存在时根本没有可判定项，于是**永远不会被判成不兼容，也就不会被整条跳过**。这给了最大的可装载范围。

**功能下限：`0.2.2-alpha.2`。**

从这一版起 `@deepseek-ai/dsh-web-app` 的 `ptc` preset 才带上 `tool-executor-ptc`，并把子代理的两个键改成 `modelSelection` / `modelDiscovery`；`0.2.1-rc.2` 用的还是旧键 `modelSelectionSettings`，且没有 PTC 执行器。preset 的 23 行都按包名解析，任何一处改名都会解析失败；`tool-executor-ptc` 决定功能下限——只有 0.2.2-alpha.2 起的官方 `ptc` preset 才带它。

| 版本 | 结果 |
|---|---|
| `0.2.2-rc.1`（桌面版实测） | ✅ 全部通过：模式挂载、图标、子代理切路由 |
| `0.2.2-alpha.2` ～ `0.2.2-rc.1` | ⚠️ 部分实测（alpha.2：profile 合成、web 启动、客户端脚本加载并注入样式均通过；启动页没有预设切换器，图标打标未触发。rc.1 为日常运行环境） |
| `≤ 0.2.1` | ⚠️ bundle 仍会装载，但 `tool-executor-ptc` 解析不到包，模式卡可能显示为异常/损坏 |

本仓库的 `cordis.patch.yml` 与官方 `0.2.2-rc.1` 的 `presets/ptc.patch.yml` 同源——去掉 delegation 里两行、替换 persona 与 plan-mode 之后的产物。

**与官方的一处有意差异**：persona 不做 `{{model}}` 插值（官方用 `{{model}}` 占位）。因此 `validate.cjs` 禁止 persona 出现 `{{`——这是选择，不是 bug；要改成模板写法，得同时放开断言。

要在别的版本上强制安装：在 profile 的 `compatibility.json` 里按**精确版本**给豁免（版本门不满足时是整条跳过，不是降级）。

## 许可证

双许可：**MIT** 或 **Apache-2.0**，任选其一。

preset 结构派生自 Harness 官方 `ptc` preset（MIT）。
