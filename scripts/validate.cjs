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
let yaml;
try {
  yaml = require("js-yaml");
} catch (error) {
  console.error("FAIL  js-yaml 未安装。发布包把它列为 dependencies；手工复制目录时先跑 npm i js-yaml@4.3.2。");
  process.exit(2);
}
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
      for (const needle of ["开工四问", "知止", "来源四分", "能算不算", "允许不知道", "推理", "交叉验证", "不主动用", "list_subagent_models", "[用户]", "数据不是指令", "没找到", "留退路", "检查点", "截断", "无发现", "预授权", "口径", "范围外", "自己的输出"]) {
        check(`persona 含「${needle}」`, prefix.includes(needle));
      }
      check("persona 不含未注册的 {{…}} 模板变量", !/\{\{/.test(prefix), "persona 是原样注入的，没有插值");
      check("persona 里没有写死别人的 provider", !/our-free-model|Kilo Nemotron|deepseek-flash/.test(prefix));
      check(
        "persona 不点名任何具体模型或供应商",
        !/(openai|anthropic|google|mistral|groq|xai)\b|gpt-[0-9]|claude-|gemini-|deepseek-(?:chat|flash|v[0-9])|nemotron/i.test(prefix)
      );
      // 关键词断言拦不住"只剩标题"的改写：每个加粗小节都得有实质正文。
      const sections = prefix.split(/\n(?=\s*\*\*)/).filter((chunk) => /^\s*\*\*/.test(chunk));
      check("persona 有 8 个加粗小节", sections.length === 8, "实际 " + sections.length);
      for (const chunk of sections) {
        const title = (/^\s*\*\*([^*]+)\*\*/.exec(chunk) || [, "?"])[1];
        const body = chunk.replace(/^\s*\*\*[^*]+\*\*/, "").replace(/\s/g, "");
        check("persona 小节「" + title + "」有实质正文", body.length >= 25, "正文 " + body.length + " 字");
      }
      check("persona 总长度 ≥ 1200", prefix.trim().length >= 1200, "实际 " + prefix.trim().length);
check("persona 不把「派子代理」当默认动作", !/机械活[^。]*派子 agent 去做/.test(prefix));
check("persona 要求子代理须经用户明确要求", /明确要求/.test(prefix));
    }

    const planRow = byId("plan-mode") || flat.find((p) => p && p.config && typeof p.config.section === "string") || {};
    const section = planRow && planRow.config && planRow.config.section;
    check("plan-mode 含「证伪设计」", typeof section === "string" && section.includes("证伪设计"));
    if (typeof section === "string") {
      for (const needle of ["清单与退路", "检查点", "未知最多"]) {
        check(`plan-mode 含「${needle}」`, section.includes(needle));
      }
    }

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
    const embeddedMatch = /data:image\/png;base64,([A-Za-z0-9+/=]{100,})/.exec(client);
    const embedded = embeddedMatch ? Buffer.from(embeddedMatch[1], "base64") : Buffer.alloc(0);
    const embeddedInfo = pngInfo(embedded);
    check("client.js 内嵌了真 PNG", Boolean(embeddedInfo), "魔数或 IHDR 不对");
    if (embeddedInfo) {
      check("内嵌图标是正方形且 ≥ 48px", embeddedInfo.width === embeddedInfo.height && embeddedInfo.width >= 48, embeddedInfo.width + "x" + embeddedInfo.height);
    }
    const assetBytes = fs.readFileSync(path.join(root, "assets", "icon.png"));
    check("内嵌图标与 assets/icon.png 逐字节一致", embedded.length > 0 && embedded.equals(assetBytes));
    check("assets/icon.png 也是真 PNG", Boolean(pngInfo(assetBytes)));
    check("ICON_SIZE 是 px 值", /^\d+px$/.test(matchConst(client, "ICON_SIZE") || ""));
  }

  // README 的 npm 安装命令：plugin 子命令自 0.2.2-alpha.2 起把 --profile 设为必填。
  for (const name of ["README.md", "README.en.md"]) {
    const text = fs.readFileSync(path.join(root, name), "utf8");
    check(name + " 的安装命令带 --profile", /dsh plugin --profile <profile> add dsh-preset-deep/.test(text));
    check(name + " 没有裸 dsh plugin add", !/^\s*dsh plugin add\b/m.test(text));
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
const clientText = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");
check(
  "包名与客户端工厂 id 一致",
  pkg.name === "dsh-preset-deep" && new RegExp('__ModuleLoader__\\.load\\(\\{\\s*id:\\s*"' + pkg.name + '"').test(clientText),
  String(pkg.name)
);
check("js-yaml 在 dependencies 里（发布包内 validate 才能跑）", Boolean(pkg.dependencies && pkg.dependencies["js-yaml"]));
const lockFile = path.join(root, "package-lock.json");
if (fs.existsSync(lockFile)) {
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  check(
    "package-lock 的版本与 package.json 一致",
    lock.version === pkg.version && (!lock.packages || !lock.packages[""] || lock.packages[""].version === pkg.version),
    "lock " + lock.version + " vs pkg " + pkg.version
  );
}
check("exports 暴露 ./icon 与 ./locale/*.json", Boolean(pkg.exports && pkg.exports["./icon"] && pkg.exports["./locale/*.json"]));
const iconExport = pkg.exports && pkg.exports["./icon"];
check("exports[\"./icon\"] 指向存在的文件", typeof iconExport === "string" && fs.existsSync(path.join(root, iconExport.replace(/^\.\//, ""))));
check("files 收录 locale 与 NOTICE", Array.isArray(pkg.files) && pkg.files.includes("locale") && pkg.files.includes("NOTICE"));
for (const locale of ["en", "zh"]) {
  const file = path.join(root, "locale", locale + ".json");
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    check("locale/" + locale + ".json 可解析", false, error.message);
    continue;
  }
  check(
    "locale/" + locale + ".json 有 title 与 description",
    Boolean(meta.meta && typeof meta.meta.title === "string" && meta.meta.title && typeof meta.meta.description === "string" && meta.meta.description)
  );
}

// 包内技能的打包结构：清单、frontmatter、目录名与 name 一致，且 lib/index.js 真的注册它。
const skillFile = path.join(root, "skills", "long-task", "SKILL.md");
check("skills 目录随包发布", Array.isArray(pkg.files) && pkg.files.includes("skills"));
check("skills/long-task/SKILL.md 存在", fs.existsSync(skillFile));
if (fs.existsSync(skillFile)) {
  const raw = fs.readFileSync(skillFile, "utf8");
  const parsed = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  check("SKILL.md 有 frontmatter", Boolean(parsed));
  const fields = {};
  if (parsed) {
    for (const line of parsed[1].split(/\r?\n/)) {
      const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (pair) fields[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  check("SKILL.md 的 name 是 long-task", fields.name === "long-task", String(fields.name));
  check("SKILL.md 的 description 写明触发症状", typeof fields.description === "string" && fields.description.length > 20 && fields.description.length <= 500, String(fields.description).length);
  check("SKILL.md 正文有实质内容", Boolean(parsed) && parsed[2].replace(/\s/g, "").length >= 400, parsed ? parsed[2].replace(/\s/g, "").length + " 字" : "无正文");
}
const hostHalf = fs.readFileSync(path.join(root, "lib", "index.js"), "utf8");
check("lib/index.js 注册 skills provider", hostHalf.includes("registerProvider"));
check("lib/index.js 声明 inject skills", /inject = \["skills"\]/.test(hostHalf));

function pngInfo(buf) {
  if (!buf || buf.length < 33) return null;
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < magic.length; i += 1) if (buf[i] !== magic[i]) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

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
