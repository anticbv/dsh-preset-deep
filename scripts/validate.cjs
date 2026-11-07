// 结构校验：不需要 Harness 运行时，只要能解析 YAML 就能发现问题。
// 用法：npm i && node scripts/validate.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const fail = [];
const ok = [];

function check(name, cond, detail) {
  if (cond) ok.push(name);
  else fail.push(detail ? `${name} — ${detail}` : name);
}

// Harness 的 Loader 用 js-yaml，并把 !!js 当作自定义标量类型（见 @deepseek-ai/dsh-app-boot）。
const yaml = require("js-yaml");
const JsTag = new yaml.Type("tag:yaml.org,2002:js", {
  kind: "scalar",
  resolve: (data) => typeof data === "string",
  construct: (data) => ({ __jsExpr: data }),
  represent: (data) => data.__jsExpr,
});
const schema = yaml.JSON_SCHEMA.extend(JsTag);

const patchFile = path.join(root, "cordis.patch.yml");
let doc;
try {
  doc = yaml.load(fs.readFileSync(patchFile, "utf8"), { schema });
  ok.push("cordis.patch.yml 可被 Harness 的 YAML 方言解析");
} catch (err) {
  fail.push(`cordis.patch.yml 解析失败 — ${err.message}`);
}

if (doc) {
  check("patch 只有一条 insert 列表", Array.isArray(doc) && doc.length === 1, `实际 ${doc.length} 条`);
  const insert = doc[0] && doc[0].insert;
  check("insert 是数组且有两行", Array.isArray(insert) && insert.length === 2, `实际 ${insert && insert.length}`);

  const rows = Array.isArray(insert) ? insert : [];
  const presetRow = rows.find((r) => r && r.name === "@deepseek-ai/dsh-agent-preset");
  const iconRow = rows.find((r) => r && r.name === "dsh-preset-deep");

  check("找到 preset 行", Boolean(presetRow));
  check("找到图标宿主行", Boolean(iconRow));
  check("每一行都带 id", rows.every((r) => r && typeof r.id === "string" && r.id), "Loader 要按 id 回写运行时改动");

  const cfg = presetRow && presetRow.config;
  check("preset 有 config", Boolean(cfg));
  if (cfg) {
    check("config.id = deep", cfg.id === "deep", String(cfg.id));
    check("config.order = 5", cfg.order === 5, String(cfg.order));
    check("config.name 非空", typeof cfg.name === "string" && cfg.name.length > 0);
    check("plugins 是数组", Array.isArray(cfg.plugins));
    check("plugins 行数 = 23", Array.isArray(cfg.plugins) && cfg.plugins.length === 23, `实际 ${cfg.plugins && cfg.plugins.length}`);

    const plugins = Array.isArray(cfg.plugins) ? cfg.plugins : [];
    // preset 里 planning / compaction / delegation 是 group，真正的行在它们的 config 里。
    const flat = [];
    (function walk(list) {
      for (const p of list) {
        if (!p || typeof p !== "object") continue;
        flat.push(p);
        if (p.group && Array.isArray(p.config)) walk(p.config);
      }
    })(plugins);
    const byId = (id) => flat.find((p) => p && p.id === id);

    // 行数只能发现"删了一行"；改名、换序要靠这份基准（scripts/preset-baseline.json）。
    const baselineFile = path.join(__dirname, "preset-baseline.json");
    let baseline = null;
    try {
      baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
    } catch (err) {
      check("读到 preset 基准文件", false, err.message);
    }
    if (baseline) {
      const rowsNow = flat.map((p) => [p.id, typeof p.name === "string" ? p.name : null]);
      check(
        "展平行 id+name 顺序与基准一致",
        JSON.stringify(rowsNow) === JSON.stringify(baseline.rows),
        firstDiff(rowsNow, baseline.rows)
      );
      const executor = byId("tool-executor-ptc");
      check("tool-executor-ptc 包名正确", Boolean(executor) && executor.name === "@deepseek-ai/dsh-tool-executor-ptc", executor && executor.name);
    }

    const persona = byId("persona");
    const prefix = persona && persona.config && persona.config.prefix;
    check("找到 persona", Boolean(prefixed(prefix)));
    if (typeof prefix === "string") {
      for (const needle of ["开工四问", "知止", "来源三分", "能算不算", "允许不知道", "推理", "交叉验证", "不主动用", "list_subagent_models"]) {
        check(`persona 含「${needle}」`, prefix.includes(needle));
      }
      check("persona 不含未注册的 {{…}} 模板变量", !/\{\{/.test(prefix), "persona 是原样注入的，没有插值");
      check("persona 里没有写死别人的 provider", !/our-free-model|Kilo Nemotron|deepseek-flash/.test(prefix));
check("persona 不把「派子代理」当默认动作", !/机械活[^。]*派子 agent 去做/.test(prefix));
check("persona 要求子代理须经用户明确要求", /明确要求/.test(prefix));
    }

    const planRow = byId("plan-mode") || flat.find((p) => p && p.config && typeof p.config.section === "string") || {};
    const section = planRow && planRow.config && planRow.config.section;
    check("plan-mode 含「证伪设计」", typeof section === "string" && section.includes("证伪设计"));

    const sub = byId("tool-subagent");
    check("找到 tool-subagent 行", Boolean(sub));
    if (sub && sub.config) {
      check("tool-subagent 开了 modelSelection", sub.config.modelSelection === true);
      check("tool-subagent 开了 modelDiscovery", sub.config.modelDiscovery === true);
    }
    check("没有遗留 subagent-router（改 id 没有必要）", !flat.some((p) => p && p.id === "subagent-router"));
  }

  if (cfg && iconRow) {
    const clientFile = path.join(root, "lib", "client.js");
    const client = fs.readFileSync(clientFile, "utf8");
    const label = matchConst(client, "LABEL");
    check("client.js 有 LABEL 常量", typeof label === "string");
    check("LABEL 与 preset 的 config.name 一致", label === cfg.name, `LABEL=${label} name=${cfg.name}`);
    check("client.js 内嵌了图标（base64 PNG）", /data:image\/png;base64,[A-Za-z0-9+/=]{100,}/.test(client));
    check("ICON_SIZE 是 px 值", /^\d+px$/.test(matchConst(client, "ICON_SIZE") || ""));
  }
}

// 语法检查：两个半边都要能被 Node 解析。
for (const rel of ["lib/index.js", "lib/client.js", "scripts/validate.cjs"]) {
  const file = path.join(root, rel);
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  check(`${rel} 语法通过`, r.status === 0, (r.stderr || "").split("\n")[0]);
}

// package.json 自洽
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
check("package.json 声明了 dsh.bundle.patch", Boolean(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch));
check("package.json 声明了 dsh.client", Boolean(pkg.dsh && pkg.dsh.client));
check("没有版本门（刻意）", !(pkg.engines && pkg.engines.dsh), "engines.dsh 会让不满足的版本整条跳过");
check("license 为双许可", pkg.license === "MIT OR Apache-2.0", String(pkg.license));

function prefixed(v) {
  return typeof v === "string" ? v : undefined;
}

function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return "第一处差异 #" + i + "：" + JSON.stringify(a[i]) + " ≠ " + JSON.stringify(b[i]);
    }
  }
  return "长度相同但内容不同";
}

function matchConst(src, name) {
  // 只认行首声明，注释里出现的同名赋值不算（锚定可防伪造）。
  const m = src.match(new RegExp("^\\s*(?:var|const|let)\\s+" + name + "\\s*=\\s*[\"']([^\"']*)[\"']", "m"));
  return m ? m[1] : undefined;
}

for (const line of ok) console.log(`  ok  ${line}`);
for (const line of fail) console.log(`FAIL  ${line}`);
console.log(`\n${ok.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
