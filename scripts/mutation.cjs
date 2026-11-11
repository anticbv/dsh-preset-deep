#!/usr/bin/env node
// 反向自检：把仓库复制到临时目录，逐个植入真实回归，确认校验脚本会红。
// 正对照（不改）必须全绿；每个变异必须至少被一个脚本拦下。npm test 会跑它。
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const parentNodeModules = path.join(root, "node_modules");
const SKIP = new Set(["node_modules", ".git"]);
const SCRIPTS = ["validate.cjs", "test-icon.cjs"];

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function run(dir, script) {
  const r = spawnSync(process.execPath, [path.join(dir, "scripts", script)], {
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: parentNodeModules },
  });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function edit(dir, rel, mutate) {
  const file = path.join(dir, rel);
  const before = fs.readFileSync(file, "utf8");
  const after = mutate(before);
  if (after === before) throw new Error("变异没有改动 " + rel);
  fs.writeFileSync(file, after, "utf8");
}

function stubPersona(dir) {
  edit(dir, "cordis.patch.yml", (text) => {
    const start = text.indexOf("              prefix: |\n");
    const end = text.indexOf("          - id: agent-instructions");
    if (start < 0 || end < 0) throw new Error("找不到 persona 块");
    return text.slice(0, start) + "              prefix: |\n                开工四问 知止 来源四分 能算不算 允许不知道 推理 交叉验证 子代理\n" + text.slice(end);
  });
}

function insertInPersona(dir, line) {
  edit(dir, "cordis.patch.yml", (text) => text.replace("              prefix: |\n", "              prefix: |\n                " + line + "\n"));
}

const mutations = [
  ["M1", "persona 只剩关键词（正文被掏空）", stubPersona],
  ["M2", "persona 写死别人的 provider/model", (dir) => insertInPersona(dir, "所有任务一律使用 provider openai/gpt-4o。")],
  ["M3", "内嵌图标换成假 base64", (dir) => edit(dir, "lib/client.js", (text) => text.replace(/data:image\/png;base64,[A-Za-z0-9+/=]{100,}/, "data:image/png;base64," + "A".repeat(600)))],
  ["M4", "assets/icon.png 被截成 1 字节", (dir) => fs.writeFileSync(path.join(dir, "assets", "icon.png"), Buffer.from([0x89]))],
  ["M5", "技能正文被掏空", (dir) => edit(dir, "skills/long-task/SKILL.md", (text) => text.replace(/^(---[\s\S]*?---\r?\n)[\s\S]*$/, "$1随便做做就好。\n"))],
  ["M6", "包名被改", (dir) => edit(dir, "package.json", (text) => text.replace('"name": "dsh-preset-deep"', '"name": "dsh-preset-deep-x"'))],
  ["M7", "persona 引入未注册模板变量", (dir) => insertInPersona(dir, "模板 {{model}} 会被原样注入。")],
  ["M8", "图标 CSS 退回结构选择器", (dir) => edit(dir, "lib/client.js", (text) => text.replace('"[data-ls-svg] {",', '"[data-ls-icon] svg:first-child {",'))],
  ["M9", "删掉一行插件（行数变了）", (dir) => edit(dir, "cordis.patch.yml", (text) => text.replace("          - id: tool-executor-ptc\n            name: '@deepseek-ai/dsh-tool-executor-ptc'\n", ""))],
  [
    "M10",
    "tool-subagent 的 config 块被整块删掉",
    (dir) =>
      edit(dir, "cordis.patch.yml", (text) => {
        const block =
          "                config:\n" +
          "                  provider: spawn\n" +
          "                  toolName: subagent\n" +
          "                  modelSelection: true\n" +
          "                  modelDiscovery: true\n";
        if (!text.includes(block)) throw new Error("找不到 tool-subagent 的 config 块");
        return text.replace(block, "");
      }),
  ],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-preset-deep-mutation-"));
let failed = 0;
try {
  // 正对照：未变异的副本必须全绿，否则下面的"红"没有意义
  const control = path.join(tmp, "control");
  copyTree(root, control);
  const controlResults = SCRIPTS.map((script) => run(control, script));
  const controlGreen = controlResults.every((r) => r.status === 0);
  console.log((controlGreen ? "  ok  " : "FAIL  ") + "正对照（未变异）全绿");
  if (!controlGreen) {
    failed += 1;
    controlResults.forEach((r, i) => {
      if (r.status !== 0) console.log("      " + SCRIPTS[i] + " exit " + r.status + "\n" + r.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n"));
    });
  }

  for (const [id, desc, mutate] of mutations) {
    const dir = path.join(tmp, id.toLowerCase());
    copyTree(root, dir);
    mutate(dir);
    const caught = SCRIPTS.filter((script) => run(dir, script).status !== 0);
    const ok = caught.length > 0;
    if (!ok) failed += 1;
    console.log((ok ? "  ok  " : "FAIL  ") + id + " " + desc + (ok ? "（被 " + caught.join(" / ") + " 拦下）" : "（没有任何脚本报错）"));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const total = mutations.length + 1;
console.log("\n" + (total - failed) + " passed, " + failed + " failed（变异全部要求被拦下）");
process.exit(failed ? 1 : 0);
