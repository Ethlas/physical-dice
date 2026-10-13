# Changelog

All notable changes to the **Physical Dice** module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Issue -> Branch -> PR Workflow Skill**: Added repository skill (`issue-branch-pr-flow`) and guidelines in `AGENTS.md` enforcing that every change follows an Issue -> Branch -> PR lifecycle with no direct merges to `main` (#2).

### Fixed
- **Foundry v13/v14 ChatLog Deprecation**: Resolved compatibility warning by referencing namespaced `foundry.applications.sidebar.tabs.ChatLog` (falling back to `ui.chat.constructor`) instead of accessing deprecated global `ChatLog` (#2).

## [0.1.4] - 2026-10-04

### Fixed
- **Clean Roll Cancellation**: Properly aborts roll execution on cancellation, re-throwing `PhysicalRollCancelledError` through `withPhysicalMode` and suppressing `toMessage` output to prevent false Critical Success chat messages with 0 total.
- **Cancelled Chat Card State**: Updated in-chat pending roll cards to show a "Roll cancelled" badge and disable action buttons upon cancellation.
- **Localized Cancel Toast**: Emits a localized `"Roll cancelled."` info toast when the user aborts a physical roll.
- **Mobile Dialog Top-Anchoring**: Positioned the physical dice modal dialog near the top of the viewport on mobile devices to prevent virtual keyboard occlusion.

## [0.1.3] - 2026-10-04

### Added
- **Private Chat Prompt Cards**: Restricted in-chat pending prompt cards so they are visible only to the rolling player and GM (or GM-only when the GM rolls), eliminating chat log clutter and preventing intermediate input cards from broadcasting to unauthorized players.
- **Cycle & Recursion Guard**: Added `activeStack` tracking and depth ceiling (`depth > 25`) to `extractDiceFromInstance` to prevent infinite loops from circular term references while supporting shared term instances across separate branches.

### Changed
- **Unified Design Token System**: Refactored `styles/physical-dice.css` to adopt the layered surface hierarchy (`--m-surface-0` through `--m-surface-5`), structured borders (`--m-border-*`), and core-linked typography tokens (`--m-text-*`) modeled after `pf2e-mobile-compact`.
- **Streamlined Quick Presets**: Refined d20 check presets to `Nat 1` and `Nat 20` across both dialog and chat card templates.
- **Architectural Consolidation**: Merged `PhysicalDiceDialog` and `ChatRollPrompt` into a single, unified `RollPrompt` (`scripts/roll-prompt.js`) that shares evaluation, validation, and stepper logic across both entry methods.

### Fixed
- **Double-Close Dialog Bug**: Resolved an issue where cancelling the popup dialog required clicking close twice by properly marking rolls as evaluated and checking `_isPhysicalCancelled` before secondary evaluation hooks.

## [0.1.2] - 2026-10-04

### Changed
- **Default Entry Method**: Changed the default prompt location from `"chat"` to `"dialog"` (Popup Dialog), focusing manual dice input into an explicit modal while preserving the client-level setting so GMs or players can switch to `"In Chat Log"` anytime.
- **Enhanced ApplicationV2 Dialog**:
  - Added `-` and `+` steppers for both d20 checks and multi-type damage pools.
  - Added quick preset buttons for d20 rolls (`Nat 1`, `10`, `15`, `Nat 20`).
  - Added Fortune and Misfortune iconography (`fa-clover` and `fa-skull`).
  - Added real-time dynamic error clearing on input change.
- **Automated Digital Fallback**: Submitting or pressing `Enter` without entering any dice in the prompt (in either Popup Dialog or Chat Log) automatically delegates to native digital dice evaluation instead of throwing a validation error, enabling seamless fallback when physical dice aren't handy.

## [0.1.1] - 2026-10-04

### Fixed
- **Cancel Button Clipping**: Balanced action button flex allocation (`flex: 1 1 0`), padding, and text-overflow ellipsis handling so the Cancel button is never squeezed or clipped in narrow chat log viewports.
- **Chat Controls Toggle Integration**: Positioned the roll mode toggle directly in `#chat-controls` alongside the roll type selector (Public, Private GM, Blind GM, Self) styled after Vincent Zorge's die + corner badge design from `pf2e-mobile-compact`.

## [0.1.0] - 2026-10-04

### Added
- **In-Chat Physical Dice Entry**: Implemented native interactive chat cards (`ChatRollPrompt`) that allow players to input raw table roll numbers directly in the Foundry Chat Log instead of relying on modal popup dialogs.
- **Roll Evaluation Interceptor**: Ported and adapted the mathematical partitioning and roll evaluation interceptor from `pf2e-mobile-compact` into `PhysicalDiceManager`.
  - Supports Check rolls (`1d20` or arbitrary dice terms) with Fortune/Misfortune detection (`kh`/`kl`).
  - Supports Damage rolls across multiple typed damage pools, partitioning totals evenly across dice terms to preserve Foundry and PF2e AST term validity.
- **Touch & Desktop Friendly UI**:
  - Direct numeric inputs with stepper buttons (`-` and `+`).
  - Quick-preset chips for d20 checks (`Nat 1`, `10`, `15`, `Nat 20`).
  - Real-time range validation with clear visual feedback.
  - Keyboard `Enter` submission support.
- **Chat Controls Toggle Button**: Added a responsive toggle button in `#chat-controls` allowing instant switching between Physical and Digital dice modes.
- **Client & World Settings**:
  - `enabled`: Global module toggle.
  - `rollMode`: Client-level preference between "physical" and "digital" dice modes (with automatic sync with `pf2e-mobile-compact` if active).
  - `cleanupMode`: Configurable cleanup behavior (delete or minimize pending cards upon resolution).
  - `allowGmOverride`: Allows GMs to input physical results on behalf of players.
- **Foundry AI Content Policy Compliance**: 100% compliant with zero AI-generated media, zero AI-written lore text, clean JSDoc documentation, and safe runtime execution.
