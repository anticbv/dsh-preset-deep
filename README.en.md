# Liangsheng Mode 路 dsh-preset-deep

[涓枃](README.md) | [English](README.en.md)

> A fifth work mode for **DeepSeek Harness**: **falsify first, deliver second.**

The four built-in modes (standard / ptc / minimal / cordis) answer "which tools may I call". None of them answers the more common question: **when are you allowed to conclude anything?**

Liangsheng Mode writes that standard into the persona and plan-mode instead of leaving it to per-conversation negotiation. It does not make you faster — it makes you **unable to bluff**.

![Mode icon](assets/screenshot.jpg)

## Core capabilities

Eight hard constraints, each aimed at one recurring failure:

| # | Capability | Failure it blocks |
|---|---|---|
| 1 | **Four opening questions** — what would an expert in this line do that wasn't asked, what primary material would they start from, what concrete method would they use, what external evidence decides correctness | Coding first, discovering the direction was wrong later |
| 2 | **Know when to stop** — write the completion condition (a command or an assertion) before starting; stop and report the blocker after two failures on the same path | Endless retries, pretending to be done |
| 3 | **Three-way sourcing** — tag every fact `[file]` / `[search]` / `[memory]`; `[memory]` never enters a conclusion | Treating impressions as evidence |
| 4 | **Compute, don't estimate** — math, dates, boundaries and set operations are verified by running code | Numbers invented by mental arithmetic |
| 5 | **Allowed to not know** — mark `[unknown]` and state what is missing | Wrapping uncertainty in "maybe / probably" |
| 6 | **Decompose reasoning** — split complex inference into independently decidable propositions, judge each, then assemble | A long, plausible-looking chain with nothing testable in it |
| 7 | **Cross-validation (on request)** — subagents are sent to answer independently only when you ask; the same holds for the context-free reviewer before an important delivery | Self-confirmation, echo chambers |
| 8 | **Subagents: visible, never proactive** — it can list the routes this machine allows, but never hands work off on its own; judgement stays local, effort follows difficulty | Outsourcing judgement to save tokens, or grinding alone when delegation was asked for |

### Subagents: visible, but never proactive

The preset enables subagent model routing (`modelSelection` + `modelDiscovery`), so `list_subagent_models` can always show which routes this machine allows — **visible**.

The persona is explicit: **it never spawns a subagent unless you ask for one.** It will not outsource judgement to save tokens, and it will not fan out subagents for cross-validation on its own.

- To delegate: say "spawn a subagent for X using `<provider>/<model>`".
- To inspect only: say "list the available subagent routes" — a read-only query, no delegation.
- Selecting a non-parent route also needs a session-level allow-list (see [below](#running-subagents-on-other-models)); without it only the parent route is allowed.

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
3. **The icon is a client patch, not configuration**: DSH presets have no `icon` field — the glyph is a hard-coded svg, so the client half locates it by label text and masks it.

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

**From the release tarball** (if you would rather not clone)

```bash
tar -xzf dsh-preset-deep-0.1.0.tgz -C ~/.dsh/profiles/<profile>/node_modules/
mv ~/.dsh/profiles/<profile>/node_modules/package ~/.dsh/profiles/<profile>/node_modules/dsh-preset-deep
# then add "dsh-preset-deep" to dsh.profile.bundles and restart
```

**npm (not published yet)**

> This package is not on npm yet, so `dsh plugin add dsh-preset-deep` will fail. This section takes effect once it is published.

> Remove any hand-written `preset-deep` block from the profile's `cordis.patch.yml` first, or the two collide.

## Adapt the persona to your machine

The "delegate mechanical work" rule in the persona is **deliberately neutral**: it names no provider and no model, and only says "call `list_subagent_models` first, then pick by available → cheapest → good enough". That way someone else installing this is never told to call a route that does not exist on their machine.

Want it tighter? Edit that one line of the persona in `cordis.patch.yml` and pin your preferred model. Then run `node scripts/validate.cjs` — it fails if the persona starts hard-coding someone else's provider.

## Examples

| File | What it is |
|---|---|
| [`examples/allow-list.patch.yml`](examples/allow-list.patch.yml) | Fill-in template for the subagent allow-list, paste into the profile's `cordis.patch.yml` |
| [`examples/acceptance.md`](examples/acceptance.md) | Five-minute acceptance run: three test prompts, the pass line, four failure signatures |

## Running subagents on other models

This is what separates it from the four built-in modes: **mechanical work can go to a cheap model while judgement stays with you.**

The preset's `subagent` row enables `modelSelection` and `modelDiscovery`, so a subagent may take `provider` / `model` / `reasoning_effort`. But the harness enforces one rule:

> Without a session-level allow-list, a subagent may only use the parent session's own route.

That is the real reason the other modes cannot fan out to other models — the official presets also set `modelSelection: true`, but never ship an allow-list. Append to the profile's `cordis.patch.yml`:

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

- Located by **label text** (`LABEL` at the top of `lib/client.js`), not by class name — DSH's class names are build hashes and change on upgrade.
- The primary match is "the container's trimmed text equals `LABEL`"; if DSH ever swaps the icon implementation, `aria-label` / `title` are the fallback.
- Debug with `window.__LS_ICON_STATUS__` in the console: `{plugin, label, size, tagged, at}`. `tagged: 0` means nothing matched.
- The mask paints with `currentColor`, so it follows light and dark themes.
- Replace the image by swapping `assets/icon.png` and re-encoding it into `lib/client.js`; resize with `ICON_SIZE`.

## Development

```bash
npm install          # js-yaml only — the validator needs it to parse the !!js tag
npm test             # 39 structural assertions + 8 icon assertions
```

`scripts/validate.cjs` catches the regressions that matter: the preset rows or their order changed, a promise disappeared from the persona, someone hard-coded a foreign provider, `modelSelection` got turned off, `LABEL` drifted from `config.name`, or `package.json` grew an `engines.dsh`. CI: copy `ci/validate.yml` to `.github/workflows/validate.yml` and the same two commands run on every push and PR. It lives in `ci/` here because this repo's push token has no `workflow` scope (GitHub refuses workflow files over the API).

## Known limitations

- **Renaming means syncing three places**: `config.name` in `cordis.patch.yml`, `LABEL` at the top of `lib/client.js`, and the screenshot caption in the README. If the first two disagree the icon silently does not appear (`validate.cjs` catches it).
- **The icon overflows**: a 34px icon inside a 22px-tall label, kept visible by `[data-ls-icon]{overflow:visible}`; drop `ICON_SIZE` to 28px if it collides.
- **With billion-context installed**, add an ordering fence after the preset row:
  ```yaml
  - id: preset-deep
    inject: [biliBasicCompactionPolicy]
  ```
- Tested on harness runtime `0.2.2-rc.1` (same desktop version).

## Version compatibility

**No version gate — deliberately.**

`package.json` declares neither `engines.dsh` nor `@deepseek-ai/dsh*` `peerDependencies`. DSH decides compatibility in this order: if `engines.dsh` exists it decides alone, otherwise every `dsh` peer is checked; with neither present there is nothing to evaluate, so the bundle is **never judged incompatible and never skipped wholesale**. That is the widest installable range.

**Functional floor: `0.2.2-alpha.2`.**

That is the first version whose `@deepseek-ai/dsh-web-app` `ptc` preset ships `tool-executor-ptc` and the new `modelSelection` / `modelDiscovery` keys; `0.2.1-rc.2` still used the old `modelSelectionSettings` key and had no PTC executor. Among the preset's 23 rows, `tool-executor-ptc` is the only hard dependency.

| Version | Result |
|---|---|
| `0.2.2-rc.1` (tested on desktop) | ✅ Everything passes: mount, icon, subagent routing |
| `0.2.2-alpha.2` — `0.2.2-rc.1` | ✅ Expected to work (rows and executor present) |
| `≤ 0.2.1` | ⚠️ The bundle still loads, but `tool-executor-ptc` cannot be resolved and the mode card may show as broken |

This repo's `cordis.patch.yml` is derived from the official `0.2.2-rc.1` `presets/ptc.patch.yml`: two delegation rows removed, persona and plan-mode replaced.

To force an install on another version, grant an **exact-version** exemption in the profile's `compatibility.json` — an unmet gate skips the whole bundle rather than degrading it.

## License

Dual-licensed under **MIT** or **Apache-2.0**, at your option.

The preset structure derives from the harness's own `ptc` preset (MIT).
