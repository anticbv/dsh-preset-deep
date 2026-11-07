// 图标半边的最小自测：不依赖 jsdom，手搓一个够用的假 DOM。
// 用法：node scripts/test-icon.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");

const styleTags = [];

function attrs() {
  const map = new Map();
  return {
    getAttribute: (k) => (map.has(k) ? map.get(k) : null),
    setAttribute: (k, v) => map.set(k, v),
    hasAttribute: (k) => map.has(k),
    removeAttribute: (k) => map.delete(k),
  };
}

function svg(parent) {
  return { tagName: "svg", parentElement: parent, children: [], ...attrs() };
}

function host(text, extra) {
  const el = { textContent: text, children: [], ...attrs(), ...(extra || {}) };
  const icon = svg(el);
  el.children.push(icon);
  el.icon = icon;
  return el;
}

// 三种情况：正常命中 / 不该命中 / 只有 aria-label（兜底路径）
const deep = host("梁圣模式");
const standard = host("标准模式");
const ariaOnly = host("", { "aria-label": "梁圣模式" });
ariaOnly.textContent = "";

const document = {
  body: {},
  head: { appendChild: (t) => styleTags.push(t) },
  querySelectorAll: (sel) => {
    if (sel === "svg") return [deep.icon, standard.icon, ariaOnly.icon];
    if (sel.includes("aria-label")) return [ariaOnly];
    return [];
  },
  querySelector: (sel) => (sel.includes("data-ls-icon-style") ? styleTags[0] || null : null),
  createElement: () => ({ tag: "style", textContent: "", ...attrs() }),
  addEventListener: () => {},
};

let loaded = null;
const window = {
  __ModuleLoader__: { load: (def) => { loaded = def; } },
  requestAnimationFrame: (fn) => fn && fn(),
};

vm.runInContext(code, vm.createContext({
  window,
  document,
  MutationObserver: class { observe() {} },
  console,
  requestAnimationFrame: window.requestAnimationFrame,
}), { filename: "client.js" });

const mod = loaded.factory(() => { throw new Error("client 不该 require 任何东西"); });
mod.apply({});

const status = window.__LS_ICON_STATUS__ || {};
const checks = [
  ["工厂 id 正确", loaded.id === "dsh-preset-deep"],
  ["exports 有 apply / inject", typeof mod.apply === "function" && Array.isArray(mod.inject)],
  ["样式只注入一次", styleTags.length === 1],
  ["样式含遮罩图", (styleTags[0] ? styleTags[0].textContent : "").includes("data:image/png;base64,")],
  ["命中目标模式", deep.hasAttribute("data-ls-icon")],
  ["其他模式没被改", !standard.hasAttribute("data-ls-icon")],
  ["aria-label 兜底生效", ariaOnly.hasAttribute("data-ls-icon")],
  ["探针记录命中数", status.tagged === 2],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? "  ok" : "FAIL"}  ${name}`);
  if (!pass) failed += 1;
}
console.log(`\n${checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
