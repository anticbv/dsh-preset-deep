# 梁圣模式 · dsh-preset-deep

给 **DeepSeek Harness** 加第五个工作模式：**先证伪，再交付**。

Harness 自带的四个模式（standard / ptc / minimal / cordis）解决的是"能调哪些工具"。它们没有回答一个更常见的问题：**你什么时候才允许下结论。** 梁圣模式把这套标准直接写进 persona 和 plan-mode，而不是留给每次对话的口头约定。

## 它和 PTC 差在哪

PTC 给了 `run_code` 和子代理；梁圣模式在此之上规定了"怎么算做完"：

|  | PTC | 梁圣模式 |
|---|---|---|
| 计划 | 决策完整即可 | **必须含「证伪设计」**：至少两条能推翻自己的证据，并说明怎么取得 |
| 结论 | 无强制格式 | **必须标 `[实]` / `[推]` / `[未知]`**；标不出的不得进结论 |
| 计算 | 可以心算 | **能算的不许估**：数字、日期、边界、集合运算写代码验 |
| 改动范围 | 按任务 | **只碰被点名的文件**，收尾贴 `git diff --stat` |

一句话概括：它不让你更快，它让你**不能糊弄**。

## 安装

**npm**

```bash
dsh plugin add dsh-preset-deep
```

**手动**（没有 npm 或想改源码）

```bash
# 1. 把本目录整个复制到 profile 的 node_modules 下
cp -r dsh-preset-deep ~/.dsh/profiles/<你的 profile>/node_modules/
# 2. 在 profile 的 package.json 里，dsh.profile.bundles 数组末尾加上 "dsh-preset-deep"
# 3. 重启 Harness，模式选择器里会出现「梁圣模式」
```

> 如果你之前按教程手写过 `preset-deep`，**先把 profile 的 `cordis.patch.yml` 里那一段删掉**，否则两个同名 preset 会冲突。

## 让子代理跑在别的模型上（本模式的重点）

模式里的 `subagent` 行已经开了 `modelSelection` 与 `modelDiscovery`，所以子代理**可以**指定 `provider` / `model` / `reasoning_effort`——机械活丢给免费模型、判断活自己做，这是它比前四个模式强的地方。

但 Harness 有一条安全约束：**没有会话级白名单时，子代理只能使用父会话同一条路由**（`child LLM route "<p>/<m>" is not allowed for this Session`）。官方 preset 虽然也开了 `modelSelection`，却从来没有配过白名单——这就是"别的模式派不动别的模型"的真实原因。

在 profile 的 `cordis.patch.yml` 追加（按你自己的 provider 改）：

```yaml
- id: subagent-model-selection-settings
  name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings'
  config:
    enabled: true
    allowedModels:
      - { provider: deepseek-account, model: deepseek-flash }
      - { provider: <你的 free provider>, model: <模型 id> }
```

配好后，子代理失败会自然换车道；`list_subagent_models` 可以现场查有哪些授权路由。

## 图标

模式图标**不需要配置**——DSH 的 preset 没有 icon 字段，图标是客户端里写死的 svg。本包用客户端半边把它换成 `assets/icon.png` 这张剪影：

- 定位靠**文字**（`LABEL`），不是类名（类名是构建哈希，升级就变）
- 遮罩用 `currentColor`，深浅主题自动跟随
- 想换图：替换 `assets/icon.png` 并重新编码进 `lib/client.js`；想改名字/大小：改 `lib/client.js` 顶部的 `LABEL` / `ICON_SIZE`

## 已知限制

- **改名要同步**：`LABEL` 与 preset 的 `config.name` 必须一致，否则图标不出现。
- **图标会溢出**：34px 图标放在 22px 高的标签里，靠 `[data-ls-icon]{overflow:visible}` 接住；如果挡住相邻元素，把 `ICON_SIZE` 降到 28px。
- **装了 billion-context 的话**：在 preset 行后补一条顺序栅栏，让它等压缩策略就位：
  ```yaml
  - id: preset-deep
    inject: [biliBasicCompactionPolicy]
  ```
- 测试环境：Harness 运行时 `0.2.1-rc.5`（桌面版 `0.2.2-rc.1`）。

## License

MIT。preset 结构派生自 Harness 官方 `ptc` preset（同样 MIT）。
