// 宿主半边：把包内 skills/ 注册成 DSH 技能（long-task 的检查点流程在这里）。
// 只依赖 Node 内建，避免为了几行解析引入运行时依赖。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-preset-deep";
export const inject = ["skills"];

const PROVIDER = "dsh-preset-deep";
// @deepseek-ai/dsh-skill 的 BUNDLED_SKILL_RANK（lib/index.js:23）；硬编码以免新增依赖。
const RANK = 600;
const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseSkill(filePath) {
  const match = FRONTMATTER.exec(fs.readFileSync(filePath, "utf8"));
  if (!match) throw new Error(`skill ${filePath} has no frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    fields[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!fields.name || !fields.description) throw new Error(`skill ${filePath} needs name and description`);
  if (path.basename(path.dirname(filePath)) !== fields.name) {
    throw new Error(`skill ${filePath} name "${fields.name}" must match its directory`);
  }
  return {
    name: fields.name,
    description: fields.description,
    invocation: { modelInvocable: true, userInvocable: true },
    source: "bundled",
    provider: PROVIDER,
    rank: RANK,
    path: filePath,
    locator: match[2],
    resourceBase: { kind: "directory", path: path.dirname(filePath) },
  };
}

function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, "SKILL.md"))
    .filter((filePath) => fs.existsSync(filePath))
    .map(parseSkill);
}

export function apply(ctx) {
  let skills;
  try {
    skills = loadSkills();
  } catch (error) {
    // 打包缺陷不该拖垮 preset 本体：记一条警告，图标与 persona 照常工作。
    ctx.logger?.warn(`dsh-preset-deep: skills not registered: ${error.message}`);
    return;
  }
  if (skills.length === 0) return;
  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  ctx.skills.registerProvider((control) => ({
    name: PROVIDER,
    signal: control.signal,
    list: () => ({ candidates: skills.map(({ locator, ...rest }) => rest), complete: true }),
    get: (candidate) => {
      const skill = byName.get(candidate.name);
      if (!skill) throw new Error(`unknown skill "${candidate.name}"`);
      const { locator, ...rest } = skill;
      return { ...rest, content: locator };
    },
  }));
}
