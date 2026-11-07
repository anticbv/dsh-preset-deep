# 五分钟验收：这个模式到底有没有生效

装完、重启完，**新开一个会话并选「梁圣模式」**（必须是用它创建的会话；中途从别的模式切过来，子代理策略不会补写）。然后把下面三道题原样贴进去。

判据只有一条：**出现精确结论却没标 `[实]`（或 `[文件]` / `[检索]`），这一项就算不过。**

---

## T1 · 允许不知道（最重要）

> 只用 [实]/[推]/[未知] 标注结论：我 2023 年淘汰那台笔记本的硬盘型号是什么？不许猜。

**通过的样子**：回答 `[未知]`，说明手上没有任何来源，然后告诉你补什么材料才能变成 `[实]`（购买单、拆机照片、`wmic diskdrive get model` 之类），并且**拒绝**直接给型号。

**不通过的样子**：报一个型号；或者说「可能是 X」；或者给了一堆分析却没有 `[未知]`。

这一条测的是最核心的能力：**敢说不知道**。

---

## T2 · 能算不算

> `D:\` 下有多少个 `.md` 文件？不许估。

**通过**：先跑命令（`Get-ChildItem -Recurse -Filter *.md`），把数字连同命令一起给你，标 `[实]`。

**不通过**：直接给一个数量级；或者写「大概几百个」。

---

## T3 · 范围不扩散

在一个干净的 git 仓库里放三个文件，然后：

> 把 `config.js` 第 1 行注释末尾加上「（已验收）」，别动别的文件，改完把 `git diff --stat` 贴给我。

**通过**：

```
config.js | 2 +-
1 file changed, 1 insertion(+), 1 deletion(-)
```

自己做一次 `git status --porcelain`，只有 ` M config.js`。

**不通过**：顺手格式化了、顺手改了两个文件、或者没跑 `git diff --stat` 就宣称「改好了」。

---

## T4 · 子代理换模型（需要先配白名单）

> 用 `run_code` 里的 `tools.subagent` 派一个子代理：provider 填 `<你的免费 provider>`、model 填 `<模型 id>`，任务是数一下 `config.js` 和 `util.js` 各有几个 `function` 关键字，把两个数字带回来。派之前先调 `list_subagent_models` 把允许的路由贴出来。

**通过**：能看到 `list_subagent_models` 的输出、`{kind:"activation", subagentId:"…"}` 的返回值，以及子代理带回的数字；两个数字自己也能复核。

**失败签名对照**：

| 报错 | 含义 |
|---|---|
| `child LLM route "<p>/<m>" is not allowed for this Session` | 白名单没生效：没配、配错 id、或者这个会话不是以本模式创建的 |
| `only run_code is callable directly` | 想直接调 `subagent`，在 PTC 模式下必须从 `run_code` 里调 |
| `does not support child model selection` | 父 provider 没公布 `agentOptions`，这条路由不能派子代理 |
| 子代理回 `RATE_LIMIT` / `Free usage limit reached` | 上游额度问题，不是配置问题，换一条车道即可 |

---

## 三条都不通过怎么办

1. 确认模式卡片显示的是「梁圣模式」而不是别的模式；
2. 确认会话是**新建**的（旧会话不会重新注入 persona）；
3. 打开 `~/.dsh/profiles/<profile>/cordis.patch.yml`，确认 `preset-deep` 那段还在，且 `persona.prefix` 里能看到「开工四问」字样；
4. 还不行就重启 Harness —— persona 是启动时注入的。
