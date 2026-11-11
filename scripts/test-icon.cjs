// 图标半边的最小自测：不依赖 jsdom，手搓一个够用的假 DOM。
// 用法：node scripts/test-icon.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");

const styleTags = [];
const all = [];
const rafQueue = [];

function attrs() {
  const map = new Map();
  return {
    getAttribute: (k) => (map.has(k) ? map.get(k) : null),
    setAttribute: (k, v) => map.set(k, v),
    hasAttribute: (k) => map.has(k),
    removeAttribute: (k) => map.delete(k),
  };
}

function findSvg(el) {
  const kids = el.children || [];
  for (let i = 0; i < kids.length; i += 1) {
    if (!kids[i]) continue;
    if (kids[i].tagName === "svg") return kids[i];
    const nested = findSvg(kids[i]);
    if (nested) return nested;
  }
  return null;
}

function mk(tagName, parent, extra) {
  const el = { tagName, parentElement: parent || null, children: [], textContent: "", ...attrs(), ...(extra || {}) };
  el.querySelector = (sel) => (sel === "svg" ? findSvg(el) : null);
  all.push(el);
  if (parent) parent.children.push(el);
  return el;
}

// 真实 DOM 的形状：容器里 图标 svg + 文字 span（+ 可选的下拉箭头 svg）
function seat(text, opts) {
  const el = mk("div", null);
  Object.keys(opts || {}).forEach((k) => el.setAttribute(k, opts[k]));
  el.textContent = text;
  el.icon = mk("svg", el);
  mk("span", el, { textContent: text });
  return el;
}

// 孙节点：宿主 -> span -> svg，外层靠 aria-label 才认得出
function nestedSeat(label) {
  const el = mk("div", null);
  el.setAttribute("aria-label", label);
  const wrap = mk("span", el);
  el.icon = mk("svg", wrap);
  return el;
}

const deep = seat("梁圣模式");
const withChevron = seat("梁圣模式");
const chevron = mk("svg", withChevron);
const standard = seat("标准模式");
// 真实头部的 aria-label 是「选择模式: 梁圣模式」，不是整串相等
const ariaOnly = seat("", { "aria-label": "选择模式: 梁圣模式" });
const nested = nestedSeat("选择模式: 梁圣模式");
// 图标前面被插了一个 badge：svg 不再是第一个元素子节点
const badgeBefore = mk("div", null);
badgeBefore.textContent = "梁圣模式";
mk("span", badgeBefore, { textContent: "NEW" });
badgeBefore.icon = mk("svg", badgeBefore);

const observers = [];
class FakeObserver {
  constructor(cb) {
    this.cb = cb;
    this.disconnected = false;
    observers.push(this);
  }
  observe(el, options) {
    this.options = options;
  }
  disconnect() {
    this.disconnected = true;
  }
}

const document = {
  body: mk("body", null),
  head: { appendChild: (t) => styleTags.push(t) },
  querySelectorAll(sel) {
    if (sel === "svg") return all.filter((e) => e.tagName === "svg");
    if (sel === "[data-ls-svg]") return all.filter((e) => e.hasAttribute("data-ls-svg"));
    if (sel === "[aria-label], [title]") return all.filter((e) => e.hasAttribute("aria-label") || e.hasAttribute("title"));
    if (sel === "style[data-ls-icon-style]") return styleTags.filter((t) => t.hasAttribute("data-ls-icon-style"));
    return [];
  },
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  },
  createElement() {
    const tag = mk("style", null);
    tag.remove = () => {
      const i = styleTags.indexOf(tag);
      if (i >= 0) styleTags.splice(i, 1);
    };
    return tag;
  },
  listeners: {},
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  },
  removeEventListener(name) {
    delete this.listeners[name];
  },
};

let loaded = null;
const window = {
  __ModuleLoader__: { load: (def) => { loaded = def; } },
  requestAnimationFrame: (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  },
};

vm.runInContext(code, vm.createContext({
  window,
  document,
  MutationObserver: FakeObserver,
  console,
  requestAnimationFrame: window.requestAnimationFrame,
}), { filename: "client.js" });

const mod = loaded.factory(() => { throw new Error("client 不该 require 任何东西"); });
mod.apply({});

const status = window.__LS_ICON_STATUS__ || {};
const css = styleTags[0] ? styleTags[0].textContent : "";
const checks = [
  ["工厂 id 正确", loaded.id === "dsh-preset-deep"],
  ["exports 有 apply / inject", typeof mod.apply === "function" && Array.isArray(mod.inject)],
  ["样式只注入一次", styleTags.length === 1],
  ["样式含遮罩图", css.includes("data:image/png;base64,")],
  ["命中目标模式", deep.hasAttribute("data-ls-icon")],
  ["命中的 svg 自己带标记", deep.icon.hasAttribute("data-ls-svg")],
  ["其他模式没被改", !standard.hasAttribute("data-ls-icon") && !standard.icon.hasAttribute("data-ls-svg")],
  ["aria-label 前缀兜底生效", ariaOnly.hasAttribute("data-ls-icon") && ariaOnly.icon.hasAttribute("data-ls-svg")],
  ["孙节点兜底生效", nested.hasAttribute("data-ls-icon") && nested.icon.hasAttribute("data-ls-svg")],
  ["svg 前插 badge 仍能命中", badgeBefore.hasAttribute("data-ls-icon") && badgeBefore.icon.hasAttribute("data-ls-svg")],
  ["CSS 不再依赖结构选择器", css.includes("[data-ls-svg] {") && !css.includes("svg:first-child")],
  ["隐藏原内容只作用于被标记的 svg", css.includes("[data-ls-svg] > * { visibility: hidden; }")],
  ["带箭头的容器照样打标", withChevron.hasAttribute("data-ls-icon")],
  ["箭头 svg 不被遮罩", !chevron.hasAttribute("data-ls-svg")],
  ["探针记录命中数", status.tagged === 5],
  ["observer 监听参数已收窄", Boolean(observers[0]) && observers[0].options.childList === true && observers[0].options.characterData !== true],
];

// 注销：把自己留下的 style / 标记 / 探针全部带走
let cleanup = null;
mod.apply({ effect(fn) { cleanup = fn(); } });
const disconnectedBefore = observers[0].disconnected;
if (typeof cleanup === "function") cleanup();
checks.push(
  ["ctx.effect 注册了注销函数", typeof cleanup === "function"],
  ["注销时断开 observer", disconnectedBefore === false && observers[0].disconnected === true],
  ["注销时移除 style 标签", styleTags.length === 0],
  ["注销时清掉容器标记", !deep.hasAttribute("data-ls-icon")],
  ["注销时清掉 svg 标记", !deep.icon.hasAttribute("data-ls-svg")],
  ["注销时清掉探针", window.__LS_ICON_STATUS__ === undefined]
);

// 注销后再次 apply 应当自愈
mod.apply({});
const status2 = window.__LS_ICON_STATUS__ || {};
checks.push(
  ["再次 apply 会重新注入样式", styleTags.length === 1],
  ["再次 apply 会重新打标", status2.tagged === 5]
);

// 注销后仍在路上的工作（挂起 rAF / 迟到的 DOMContentLoaded）不得复活
let rafCleanup = null;
mod.apply({ effect(fn) { rafCleanup = fn(); } });
const lastObserver = observers[observers.length - 1];
if (lastObserver && typeof lastObserver.cb === "function") lastObserver.cb();
if (typeof rafCleanup === "function") rafCleanup();
while (rafQueue.length) rafQueue.shift()();
checks.push([
  "注销后挂起的 rAF 不会复活样式/标记/探针",
  styleTags.length === 0 && window.__LS_ICON_STATUS__ === undefined && !deep.hasAttribute("data-ls-icon"),
]);

let lateCleanup = null;
document.body = null;
mod.apply({ effect(fn) { lateCleanup = fn(); } });
const readyHandler = document.listeners.DOMContentLoaded;
if (typeof lateCleanup === "function") lateCleanup();
if (typeof readyHandler === "function") readyHandler();
checks.push([
  "注销后迟到的 DOMContentLoaded 不会重启",
  styleTags.length === 0 && window.__LS_ICON_STATUS__ === undefined && !deep.hasAttribute("data-ls-icon") && document.listeners.DOMContentLoaded === undefined,
]);

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? "  ok  " : "FAIL  ") + name);
  if (!pass) failed += 1;
}
console.log("\n" + (checks.length - failed) + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
