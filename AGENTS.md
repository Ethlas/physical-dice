# Physical Dice - Agent Guidelines & Repository Rules

Welcome to the **Physical Dice** repository (`physical-dice`). This is a Foundry Virtual Tabletop module enabling seamless mmanual physcal dice entry roll at the gaming table while preserving native system resolution.

---

## 1. Repository Overview & Tech Stack

- **Foundry VTT Compatibility**: Foundry v14 (`module.json`).
- **Core Entry Point**: [`scripts/physical-dice.js`](scripts/physical-dice.js)
- **UI Architecture**: Foundry `ApplicationV2` (`foundry.applications.api.ApplicationV2`).
- **Styles**: CSS in [`styles/physical-dice.css`](styles/physical-dice.css)
- **Localization**: Languages in [`lang/`](lang/) (e.g. [`lang/en.json`](lang/en.json))
- **Templates**: Handlebars templates in [`templates/`](templates/)

---

## 2. Core Architectural Principles

### A. Respect Foundry ApplicationV2 Lifecycles
- Subclass `HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)` for dialogs and configuration windows.
- Use `_prepareContext(options)` to curate clean, template-ready data.
- Use namespaced document collections (`foundry.documents.collections.Actors` or `getDocumentClass("Actor")`).

### B. System Integrity & Roll Interception
- **never re-implement game system math**: Always delegate modifier calculations, degree of success, and damage application to the active game system.
- Intercept dice terms and prompt users for raw physical totals, partitioning results across dice terms so the `Roll` instance remains structurally valid and evaluated. It might be better to do the interception directly in the chat. Use the native chat interface from the game system if possible.
- Handle dialog cancellation gracefully without emitting empty or broken chat messages.

### C. Modular Domain Modeling & File Size Discipline
- **Maintain Lean Orchestrator**: Keep entry scripts lean and focused on initialization and hook coordination.
- **Respect Domain Boundaries**: Separate dialog classes, dice partition utilities, and system adapters into dedicated files.
- Proactively refactor modules if they approach 600–800 lines or take on mixed responsibilities. This is not a hard rule so if it exceeds 800 lines that is ok, no need to refactor code that makes it harder to read.

---

## 3. Workflow & Deployment Rules

1. **Syntax & Quality Checks**:
   - Run `npm ci` once to install the dev tooling (`semver`, `yazl`; dev dependencies only, nothing ships in the module).
   - Run `node scripts/verify.mjs` before committing or pushing changes to verify JavaScript syntax, Handlebars template integrity, and CSS brace balance. CI runs the same check on every PR ([`.github/workflows/ci-verify.yml`](file:///.github/workflows/ci-verify.yml)), and `release.yml` runs it before packaging.
   - **Release tooling lives in `scripts/*.mjs`** and is never packaged (runtime code is `.js`): `release-check.mjs` (release gate in `release.yml`), `build.mjs` (stages `dist/package/`, writes `dist/module.json` and `dist/module.zip`; run it locally to test a package), and the shared `release-utils.mjs`.
2. **Semantic Versioning & Releases ([Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/))**:
   - Only a `fix` or `feat` prefix on the **PR title** (or, for a direct push without a PR, the commit subject) triggers module packaging in [`.github/workflows/release.yml`](file:///.github/workflows/release.yml) when merged into `main`. The prefixes of the commits inside a PR don't count. PR titles are not enforced by CI: a PR without one of these prefixes merges fine but does not release.
   - **The version is automatic**: the release takes the highest `vX.Y.Z` tag and raises it by the prefix (see the `version-manager` skill, [`.agents/skills/version-manager/SKILL.md`](file:///.agents/skills/version-manager/SKILL.md)). Never edit the version by hand: the `module.json` version in the repository is `0.0.0-dev`, for development checkouts only, and the release writes the computed version into the packaged manifest.
     - **`fix:` (Bug Fix / Patch)**: 3rd number (e.g. `1.0.0` -> `1.0.1`).
     - **`feat:` (Feature / Minor)**: middle number, 3rd number reset to 0 (e.g. `1.0.0` -> `1.1.0`).
     - **`feat!:` / `fix!:` (Breaking / Major)**: 1st number, middle and 3rd numbers reset to 0 (e.g. `1.0.0` -> `2.0.0`).
   - Document changes in [`CHANGELOG.md`](file:///CHANGELOG.md) under the `## [Unreleased]` heading; GitHub's generated release notes list the merged PRs per version.
   - **After a release**, rename `## [Unreleased]` to the released version and date (e.g. `## [1.0.1] - 2026-10-23`, from the release's `vX.Y.Z` tag) in a `docs(changelog):` PR, and start a new empty `## [Unreleased]` above it. The release workflow does not edit the changelog.
3. **Approval & Documentation Integrity**:
   - **NEVER commit or push to Git/GitHub without explicit user approval.**
   - Never commit or store plaintext passwords or tokens in repository files.
   - For every feature milestone, bug fix, or breaking change, document the change in `CHANGELOG.md`.
4. **Issue -> Branch -> PR Workflow (No Direct Commits/Merges to `main`)**:
   - Every change must trace to a tracked GitHub issue (`gh issue create`).
   - Create a dedicated branch (`fix/#<id>-<desc>` or `feat/#<id>-<desc>`) from clean `main`.
   - All changes must be merged via Pull Request (`gh pr create`).
   - **Direct commits or direct merges to `main` are strictly prohibited.**
   - Follow the [`issue-branch-pr-flow`](file:///.agents/skills/issue-branch-pr-flow/SKILL.md) skill.

---

## 4. Foundry VTT AI Content Policy Compliance ([Official Policy](https://foundryvtt.com/article/ai-policy/))

All code, templates, assets, and documentation in this repository MUST strictly adhere to the **Foundry VTT AI Content Policy (Revised March 18, 2026)** (detailed in [`.agents/rules/foundry-ai-policy.md`](file:///d:/Dnd/coding/physical-dice/.agents/rules/foundry-ai-policy.md)):

1. **Zero AI-Generated Prepared Media (Sections 3.1, 4.2, 4.3)**:
   - **Never** generate or bundle AI-created images, illustrations, tokens, icons, video, or audio files (`.png`, `.jpg`, `.webp`, `.gif`, `.mp3`, `.ogg`, `.wav`).
   - Use FontAwesome (`fa-solid`, `fas`), Foundry VTT built-in icons (`icons/...`), CSS styling, or clean geometric UI `<svg>` icons.
   - Any bundled raster/audio asset must be 100% human-created and listed in `ASSET_PROVENANCE.json` with creator attribution and license details.
2. **Zero AI-Generated Lore/Rules Text & No Third-Party Scraping (Sections 1.1, 4.1)**:
   - Never bundle AI-written lore or copied third-party rules text.
3. **Human Author Comprehension & Anti-"Vibe Coding" (Sections 4.4 & 7)**:
   - All AI-assisted code must be modular, clearly structured, and documented with JSDoc headers so the human author (`Ethlas`) can personally understand, explain, modify, and maintain 100% of the codebase.
4. **Runtime Code Safety & Honest Package Categorization (Sections 5, 4.5, 6.6)**:
   - Never use `eval()` or `new Function()` to execute unconfirmed dynamically generated code at runtime.
   - Never label the package as `"Zero AI"`, and ensure `module.json` descriptions and marketing copy are human-authored/approved.
