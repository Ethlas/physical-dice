# Foundry VTT Rules (v14)

Guidelines for developing within Foundry Virtual Tabletop v14:

## ApplicationV2 Architecture
- Subclass `foundry.applications.api.ApplicationV2` (or `HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)`) for dialogs and configuration sheets.
- Use `DEFAULT_OPTIONS` static getter to configure ID, tag, window controls, and template paths.
- Prepare data within `_prepareContext(options)`. Always return an object containing data needed by Handlebars templates.
- Avoid calling `render()` synchronously in tight loops; allow Foundry's reactive rendering queue to handle batch updates.

## Document Collections & Namespaces
- Do not use global `Actors` or `Items` directly. Use namespaced accessors:
  - `foundry.documents.collections.Actors` or `getDocumentClass("Actor")`.
- When accessing documents from canvas, handle situations where canvas might not be rendered or no tokens are selected.

## Hooks & Cleanup
- When registering global hooks (`Hooks.on` / `Hooks.once`), store registration IDs or ensure hooks don't register duplicates.
- Ensure all dialogs and modals close cleanly without dangling event listeners or hanging promises.

## Modular Architecture & Separation of Concerns
- Keep the main entry script (`scripts/physical-dice.js`) as a lean coordinator.
- Factor out dialogs into dedicated `ApplicationV2` classes.
- Factor out roll interception and calculation helpers into separate utility modules.
