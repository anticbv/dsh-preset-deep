# Liangsheng Mode 路 dsh-preset-deep

[涓枃](README.md) | [English](README.en.md)

> A fifth work mode for **DeepSeek Harness**: **falsify first, deliver second.**

The four built-in modes (standard / ptc / minimal / cordis) answer "which tools may I call". None of them answers the more common question: **when are you allowed to conclude anything?**

Liangsheng Mode writes that standard into the persona and plan-mode instead of leaving it to per-conversation negotiation. It does not make you faster 鈥?it makes you **unable to bluff**.

![Mode icon](assets/screenshot.jpg)

## Core capabilities

Eight hard constraints, each aimed at one recurring failure:

| # | Capability | Failure it blocks |
|---|---|---|
| 1 | **Four opening questions** 鈥?what would an expert in this line do that wasn't asked, what primary material would they start from, what concrete method would they use, what external evidence decides correctness | Coding first, discovering the direction was wrong later |
| 2 | **Know when to stop** 鈥?write the completion condition (a command or an assertion) before starting; stop and report the blocker after two failures on the same path | Endless retries, pretending to be done |
| 3 | **Three-way sourcing** 鈥?tag every fact `[file]` / `[search]` / `[memory]`; `[memory]` never enters a conclusion | Treating impressions as evidence |
| 4 | **Compute, don't estimate** 鈥?math, dates, boundaries and set operations are verified by running code | Numbers invented by mental arithmetic |
| 5 | **Allowed to not know** 鈥?mark `[unknown]` and state what is missing | Wrapping uncertainty in "maybe / probably" |
| 6 | **Decompose reasoning** 鈥?split complex inference into independently decidable propositions, judge each, then assemble | A long, plausible-looking chain with nothing testable in it |
| 7 | **Cross-validation** 鈥?send uncertain claims to 2鈥? subagents; before delivering an important conclusion, send a reviewer subagent that never saw this context | Self-confirmation, echo chambers |
| 8 | **Spend compute by difficulty** 鈥?mechanical work goes to free-model subagents, judgement stays with you; effort follows difficulty | Paying top-tier rates to copy a file |

## Architecture

```mermaid
flowchart TD
    subgraph bundle["dsh-preset-deep (one npm package)"]
        P["cordis.patch.yml<br/>declares two entries"]
        C["lib/client.js<br/>browser half"]
    end

    P -->|insert| R["preset-deep 路 Liangsheng"]
    P -->|insert| I["ls-icon<br/>icon host row"]

    R --> PS["persona<br/>eight delivery contracts"]
    R --> PM["plan-mode<br/>plan must contain a falsification section"]
    R --> DL["delegation<br/>subagent + modelSelection"]
    R --> PTC["tool-executor-ptc<br/>run_code"]

    DL --> SA["subagent<br/>takes provider / model / effort"]

    C -->|CSS mask| ICON["redraws the mode icon as a silhouette"]
    I -.->|mounts| C

    WS["profile cordis.patch.yml"] -->|optional: allow-list| SA
```

Three things worth noticing:

1. **One package, two halves**: `cordis.patch.yml` declares the preset and the icon host row; `lib/client.js` runs in the browser and never touches the host.
2. **Switching subagent models needs one more thing**: the preset only turns on `modelSelection`; the authorization comes from `subagent-model-selection-settings` in the profile layer (below).
3. **The icon is a client patch, not configuration**: DSH presets have no `icon` field 鈥?the glyph is a hard-coded svg, so the client half locates it by label text and masks it.

## Difference from PTC

|  | PTC | Liangsheng |
|---|---|---|
| Plan | Decision-complete | **Must include a falsification section**: at least two pieces of evidence that could disprove it, and how to obtain them |
| Conclusion | No required format | **Must be tagged `[verified]` / `[inferred]` / `[unknown]`**; untagged claims are not conclusions |
| Arithmetic | Mental math allowed | **Verify by running code** |
| Blast radius | Task-scoped | **Touch only the named files**, end with `git diff --stat` |

## Install

**Manual (the only working path today)**

```bash
# 1. copy into the profile's node_modules
cp -r dsh-preset-deep ~/.dsh/profiles/<profile>/node_modules/
# 2. append "dsh-preset-deep" to dsh.profile.bundles in the profile's package.json
# 3. restart the harness
```

**npm (not published yet)**

> This package is not on npm yet, so `dsh plugin add dsh-preset-deep` will fail. This section takes effect once it is published.

> Remove any hand-written `preset-deep` block from the profile's `cordis.patch.yml` first, or the two collide.

## Running subagents on other models

This is what separates it from the four built-in modes: **mechanical work can go to a cheap model while judgement stays with you.**

The preset's `subagent` row enables `modelSelection` and `modelDiscovery`, so a subagent may take `provider` / `model` / `reasoning_effort`. But the harness enforces one rule:

> Without a session-level allow-list, a subagent may only use the parent session's own route.

That is the real reason the other modes cannot fan out to other models 鈥?the official presets also set `modelSelection: true`, but never ship an allow-list. Append to the profile's `cordis.patch.yml`:

```yaml
- id: subagent-model-selection-settings
  name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings'
  config:
    enabled: true
    allowedModels:
      - { provider: deepseek-account, model: deepseek-flash }
      - { provider: <your free provider>, model: <model id> }
```

Without it, naming another route fails with `child LLM route "<p>/<m>" is not allowed for this Session`.

## Icon

- Located by **label text** (`LABEL` at the top of `lib/client.js`), not by class name 鈥?DSH's class names are build hashes and change on upgrade.
- The mask paints with `currentColor`, so it follows light and dark themes.
- Replace the image by swapping `assets/icon.png` and re-encoding it into `lib/client.js`; resize with `ICON_SIZE`.

## Known limitations

- **Renaming requires syncing**: `LABEL` must equal the preset's `config.name`.
- **The icon overflows**: a 34px icon inside a 22px-tall label, kept visible by `[data-ls-icon]{overflow:visible}`; drop `ICON_SIZE` to 28px if it collides.
- **With billion-context installed**, add an ordering fence after the preset row:
  ```yaml
  - id: preset-deep
    inject: [biliBasicCompactionPolicy]
  ```
- Tested on harness runtime `0.2.2-rc.1` (same desktop version).

## Version compatibility

**No version gate 鈥?deliberately.**

`package.json` declares neither `engines.dsh` nor `@deepseek-ai/dsh*` `peerDependencies`. DSH decides compatibility in this order: if `engines.dsh` exists it decides alone, otherwise every `dsh` peer is checked; with neither present there is nothing to evaluate, so the bundle is **never judged incompatible and never skipped wholesale**. That is the widest installable range.

**Functional floor: `0.2.2-alpha.2`.**

That is the first version whose `@deepseek-ai/dsh-web-app` `ptc` preset ships `tool-executor-ptc` and the new `modelSelection` / `modelDiscovery` keys; `0.2.1-rc.2` still used the old `modelSelectionSettings` key and had no PTC executor. Among the preset's 23 rows, `tool-executor-ptc` is the only hard dependency.

| Version | Result |
|---|---|
| `0.2.2-rc.1` (tested on desktop) | 鉁?Everything passes: mount, icon, subagent routing |
| `0.2.2-alpha.2` 鈥?`0.2.2-rc.1` | 鉁?Expected to work (rows and executor present) |
| `鈮?0.2.1` | 鈿狅笍 The bundle still loads, but `tool-executor-ptc` cannot be resolved and the mode card may show as broken |

This repo's `cordis.patch.yml` is derived from the official `0.2.2-rc.1` `presets/ptc.patch.yml`: two delegation rows removed, persona and plan-mode replaced.

To force an install on another version, grant an **exact-version** exemption in the profile's `compatibility.json` 鈥?an unmet gate skips the whole bundle rather than degrading it.

## License

Dual-licensed under **MIT** or **Apache-2.0**, at your option.

The preset structure derives from the harness's own `ptc` preset (MIT).
