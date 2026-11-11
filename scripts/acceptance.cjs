#!/usr/bin/env node
// 只校验验收文档的机器可读标记是否齐全；行为判定仍需人工照 examples/acceptance.md 执行。
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const doc = fs.readFileSync(path.join(root, "examples", "acceptance.md"), "utf8");
const cases = [];
const re = /<!--\s*case:\s*(\{[^]*?\})\s*-->/g;
let m;
while ((m = re.exec(doc))) {
  try {
    cases.push(JSON.parse(m[1]));
  } catch (error) {
    console.error("FAIL  无法解析 case 标记：" + m[1]);
    process.exitCode = 1;
  }
}

const expected = ["A", "B", "C", "D", "F", "G", "H", "I"];
const seen = new Set(cases.map((c) => c && c.id));
let failed = 0;
for (const id of expected) {
  const c = cases.find((x) => x && x.id === id);
  if (!c) {
    failed += 1;
    console.log(id + " FAIL  缺少 case 标记");
    continue;
  }
  const ok = typeof c.mode === "string" && c.mode.trim() && typeof c.pass === "string" && c.pass.trim();
  if (!ok) failed += 1;
  console.log(id + (ok ? " PASS  结构化（mode=" + c.mode + "）" : " FAIL  mode/pass 缺失"));
}
for (const id of seen) {
  if (!expected.includes(id)) {
    failed += 1;
    console.log(id + " FAIL  未预期的用例 id");
  }
}
console.log("\n" + (expected.length - failed) + " passed, " + failed + " failed（仅标记完整性；行为判定需人工）");
process.exitCode = failed ? 1 : 0;
