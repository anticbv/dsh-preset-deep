# Contributing

## 提交前

```bash
npm install        # 安装 js-yaml（devDependency）
npm test           # 44 项结构断言 + 12 项图标断言
npm run acceptance # 验收文档标记完整性（4 行 PASS/FAIL）
```

改了 `cordis.patch.yml` 的行（增删、改名、换序）时，同步更新 `scripts/preset-baseline.json`：它保存展平后的 `[id, name]` 顺序，校验按它逐项比对。只改 persona / plan-mode 文本不需要动基准。

## 提交邮箱

本仓库的提交一律使用 GitHub noreply 地址（`<id>+<user>@users.noreply.github.com`）。v0.1.0 / v0.1.1 的历史里有个人邮箱，历史不重写（会改 tag 指向）；新提交请沿用 noreply。

## 版本与发布

- 版本号写进 `package.json` 与 `CHANGELOG.md`，tag 用附注 tag（`git tag -a`）。
- 发布物用 `npm pack` 生成的 tarball，附到对应 Release。
