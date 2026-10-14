# Physical Dice

[![Foundry VTT Compatibility](https://img.shields.io/badge/Foundry%20VTT-v14-orange.svg)](https://foundryvtt.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/Ethlas/physical-dice?color=green&label=Latest%20Release)](https://github.com/Ethlas/physical-dice/releases/latest)

**Physical Dice** is a sleek, mobile-optimized Foundry Virtual Tabletop module designed for hybrid and in-person games. It empowers players and Game Masters to roll real physical dice at the gaming table while preserving native system math, degrees of success, multiple attack penalties, and automated damage resolution inside Foundry VTT.

Pair it seamlessly with [**PF2e Mobile Sheet (Compact)**](https://github.com/Ethlas/pf2e-mobile-compact) for the ultimate handheld tabletop gaming experience!

---

## Table of Contents

1. [Features & Capabilities](#features--capabilities)
2. [Mobile Experience & Touch Ergonomics](#mobile-experience--touch-ergonomics)
3. [User Interface & Visual Mockups](#user-interface--visual-mockups)
4. [How It Works (Step-by-Step)](#how-it-works-step-by-step)
5. [Module Settings & Configuration](#module-settings--configuration)
6. [Installation & Updates](#installation--updates)
7. [System Compatibility & Architecture](#system-compatibility--architecture)

---

## Features & Capabilities

- **Direct In-Chat Entry**: Prompt cards render directly within the native Foundry Chat Log, avoiding intrusive modal popups and keeping gameplay fast and fluid.
- **Dedicated ApplicationV2 Modal Dialog**: Prefer classic popups? Switch to the clean, touch-friendly ApplicationV2 dialog in module settings.
- **Check & Attack Roll Interception**:
  - Automatically identifies d20 rolls, flat checks, skill checks, saves, and arbitrary dice checks.
  - **Fortune & Misfortune Guidance**: Explicitly instructs players to roll 2 dice and take the higher (`kh` / Clover icon) or lower (`kl` / Skull icon) result.
  - Automatic modifier preservation: enter only the raw die roll; system modifiers and buffs are added automatically.
- **Multi-Pool Damage Partitioning**:
  - Automatically groups damage into distinct typed pools (e.g., Slashing, Fire, Precision, Persistent).
  - Displays valid minimum and maximum totals for each pool (`min–max`).
  - Distributes raw totals mathematically across underlying AST dice terms so system critical multiplication, resistances, weaknesses, and roll formatting remain 100% valid.
- **Chat Controls Mode Toggle**:
  - A responsive button with dynamic badge icons (`fa-dice` with `fa-hand` for Physical, or `fa-microchip` for Digital) placed directly in `#chat-controls` alongside Foundry's roll type selector.
  - Switch between Physical and Digital rolls with a single click or tap anytime.
- **Automated Digital Fallback**:
  - Don't have physical dice within reach? Leave the number input blank and click **Confirm** (or press `Enter`) to fall back immediately to native digital dice without re-triggering the roll.
- **Clean Roll Cancellation**:
  - Cancelling a roll aborts cleanly, preventing 0-total damage or phantom Critical Success messages from cluttering chat.
- **Privacy & Delegation**:
  - Pending roll cards are private to the roller and GM.
  - GMs can enter physical totals on behalf of players when enabled.

---

## Mobile Experience & Touch Ergonomics

Physical Dice was engineered from the ground up to excel on smartphones, tablets, and small touchscreen viewports:

1. **Touch Stepper Buttons (`-` and `+`)**:
   - Generous **38px – 44px touch targets** let players adjust roll values up or down with a quick thumb tap, eliminating the need to type small numbers manually.
2. **Quick Preset Chips (`Nat 1` and `Nat 20`)**:
   - Instant one-tap presets for natural critical failure and natural critical success on d20 checks.
3. **Native Numeric Keypad (`inputmode="numeric"`)**:
   - When tapping the input field on iOS Safari or Android Chrome, the mobile OS displays the large, dedicated number pad instead of the cumbersome full keyboard.
4. **Top-Anchored Dialog Positioning**:
   - On small screens (`< 768px`), the popup dialog anchors near the top of the viewport so the virtual software keyboard never covers the input fields or the Confirm button.
5. **Seamless Synergy with `pf2e-mobile-compact`**:
   - Both modules share identical surface color tokens, border hierarchies, and roll mode states. When used together, toggling physical dice in the mobile character sheet header automatically coordinates with Physical Dice prompts in chat.

---

## User Interface & Visual Mockups

### 1. Chat Controls Quick Toggle
Located right beside the Foundry roll type dropdown (Public, Private GM, Blind GM, Self Roll):

```text
┌─────────────────────────┬─────────┐
│ Public Roll          ▼  │ [🎲 ✋] │  <-- Physical Dice Active
└─────────────────────────┴─────────┘
┌─────────────────────────┬─────────┐
│ Public Roll          ▼  │ [🎲 💻] │  <-- Digital Dice Active
└─────────────────────────┴─────────┘
```

---

### 2. In-Chat Pending Check Card (d20 Roll)
When a check is initiated with Physical Dice enabled:

```text
┌────────────────────────────────────────────────────────┐
│ 🎲 Longsword Attack Check              🎯 Target: Orc   │
├────────────────────────────────────────────────────────┤
│ Roll 1d20 physically on the table:                     │
│ Leave blank and click Confirm to roll digitally.       │
│                                                        │
│       ┌───────┐  ┌───────────────────┐  ┌───────┐      │
│       │   -   │  │        17         │  │   +   │      │
│       └───────┘  └───────────────────┘  └───────┘      │
│                                                        │
│              [ Nat 1 ]        [ Nat 20 ]               │
├────────────────────────────────────────────────────────┤
│     [ ✔ Confirm ]                  [ ✖ Cancel ]        │
└────────────────────────────────────────────────────────┘
```

---

### 3. Multi-Pool Damage Prompt Card
When rolling damage with multiple types:

```text
┌────────────────────────────────────────────────────────┐
│ 🎲 Strike Damage                       🎯 Target: Troll │
├────────────────────────────────────────────────────────┤
│ Roll damage dice physically on the table:              │
│                                                        │
│  [Slashing] 2d8 (2–16)                                 │
│  ┌───────┐ ┌─────────────────────────┐ ┌───────┐       │
│  │   -   │ │           11            │ │   +   │       │
│  └───────┘ └─────────────────────────┘ └───────┘       │
│                                                        │
│  [Fire] 1d6 (1–6)                                      │
│  ┌───────┐ ┌─────────────────────────┐ ┌───────┐       │
│  │   -   │ │            5            │ │   +   │       │
│  └───────┘ └─────────────────────────┘ └───────┘       │
├────────────────────────────────────────────────────────┤
│     [ ✔ Confirm ]                  [ ✖ Cancel ]        │
└────────────────────────────────────────────────────────┘
```

---

### 4. Fortune / Misfortune Check Prompt
When Fortune or Misfortune applies to the roll:

```text
┌────────────────────────────────────────────────────────┐
│ 🎲 Recall Knowledge Check                             │
├────────────────────────────────────────────────────────┤
│ 🍀 Fortune: Roll 2d20 physically and enter the         │
│             HIGHER result:                             │
│                                                        │
│       ┌───────┐  ┌───────────────────┐  ┌───────┐      │
│       │   -   │  │        18         │  │   +   │      │
│       └───────┘  └───────────────────┘  └───────┘      │
│              [ Nat 1 ]        [ Nat 20 ]               │
├────────────────────────────────────────────────────────┤
│     [ ✔ Confirm ]                  [ ✖ Cancel ]        │
└────────────────────────────────────────────────────────┘
```

---

## How It Works (Step-by-Step)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Player Triggers │ ──> │ Physical Dice   │ ──> │ Player Rolls at │ ──> │ Native System   │
│ Check or Damage │     │ Intercepts Roll │     │ Table & Confirms│     │ Resolves Result │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Trigger Roll**: A player rolls a strike, skill, saving throw, or spell from their character sheet or chat macro.
2. **Interception**: If **Physical Dice Mode** is active, the module pauses the evaluation and renders an interactive prompt (in the Chat Log or modal dialog).
3. **Physical Roll**: The player casts their real dice on the physical table and enters the raw die total into the prompt (or adjusts with `-` / `+` steppers).
4. **Resolution**: Physical Dice distributes the results across the roll's dice terms, marks the roll evaluated, and passes it back to the active game system.
5. **Native Output**: The game system (PF2e, D&D5e, etc.) calculates critical success/failure, applies modifiers, and renders the official system chat card with all interactive buttons intact.

---

## Module Settings & Configuration

Configure module behavior under **Game Settings > Configure Settings > Physical Dice**:

| Setting | Scope | Default | Choices | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Enable Physical Dice** | Client | `Enabled` | Boolean | Master switch to enable or disable physical dice interception for your client. |
| **Default Roll Mode** | Client | `Physical` | `Physical` / `Digital` | Default mode when opening Foundry. Synchronizes automatically with `pf2e-mobile-compact`. |
| **Entry Method** | Client | `Popup Dialog` | `Popup Dialog` / `In Chat Log` | Choose between an explicit ApplicationV2 modal dialog or seamless interactive in-chat cards. |
| **Pending Card Cleanup** | World | `Delete` | `Delete` / `Minimize` | Whether in-chat prompt cards are removed or minimized after the final roll resolves. |
| **Allow GM Override** | World | `Enabled` | Boolean | Allows the Gamemaster to enter dice results on behalf of players. |

---

## Installation & Updates

### Installation via Manifest URL
1. Open Foundry Virtual Tabletop to the **Configuration and Setup** screen.
2. Navigate to the **Add-on Modules** tab and click **Install Module**.
3. Paste the following URL into the **Manifest URL** field at the bottom:
   ```text
   https://github.com/Ethlas/physical-dice/releases/latest/download/module.json
   ```
4. Click **Install**. Once downloaded, enable **Physical Dice** in your World's Module Management settings.

### Updating the Module
- When a new release is published, Foundry will notify you in the **Add-on Modules** tab. Click **Update** to install the latest version automatically.

---

## System Compatibility & Architecture

- **Foundry VTT Compatibility**: Minimum Version 14, Verified Version 14.
- **Game System Agnostic**: Designed to operate cleanly across any game system (optimized with deep support for Pathfinder Second Edition and Core d20 systems).
- **ApplicationV2 Architecture**: Employs modern Foundry VTT ApplicationV2 APIs (`foundry.applications.api.ApplicationV2`).
- **Foundry AI Content Policy Compliant**: 100% compliant with the official Foundry VTT AI Content Policy. Zero AI-generated raster/audio media, clean modular human-maintainable code with full JSDoc headers, and safe runtime execution (zero `eval`).

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
