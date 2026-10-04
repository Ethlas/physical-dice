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
   - Verify JSON and JavaScript syntax before committing or pushing changes.
2. **Approval & Documentation Integrity**:
   - **NEVER commit or push to Git/GitHub without explicit user approval.**
   - Never commit or store plaintext passwords or tokens in repository files.
   - For every feature milestone, bug fix, or breaking change, document the change in `CHANGELOG.md`.
   - Bump version in [`module.json`](file:///d:/Dnd/coding/physical-dice/module.json) when releasing new milestone versions.

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
