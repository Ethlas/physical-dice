# Physical Dice

A streamlined, mobile- and desktop-friendly Foundry Virtual Tabletop module that allows players and GMs to roll physical dice at the gaming table while seamlessly recording and resolving the results inside Foundry VTT. For mobile, the module `pf2e-mobile-compact` can be used in conjunction with this module for the best mobile experience.

---

## Features

- **Direct In-Chat Entry**: Prompts appear directly in Foundry's Chat Log with native interactive cards instead of interrupting gameplay with modal popups.
- **Full Check & Damage Support**:
  - **Check Rolls**: Supports d20 and arbitrary check rolls with automatic Fortune (`kh`) and Misfortune (`kl`) instructions.
  - **Damage Rolls**: Multi-type grouped damage pools (e.g. Slashing, Fire, Precision) with total range calculation and automated mathematical partitioning across individual dice terms.
- **Touch & Desktop Ergonomics**:
  - Touch-friendly stepper buttons (`-` and `+`) with ergonomic touch targets.
  - Quick-preset chips (`Nat 1`, `Nat 20`).
  - Native numeric mobile keyboard support (`inputmode="numeric"`).
  - Real-time range validation with visual indicators and keyboard `Enter` submission.
- **Chat Controls Quick Toggle**: A dedicated toggle button in the chat controls bar lets players and GMs switch between **Physical** and **Digital** dice instantly.
- **Configurable Prompt Location**: Choose between Popup Dialog or In-Chat Log entry in module settings.
- **System Integrity**: Preserves game system math, degree-of-success calculations, and official chat card styling without re-implementing rules.

---

## Installation

### Via Manifest URL
In Foundry VTT Setup, paste the following URL into the **Manifest URL** field:
```text
https://github.com/Ethlas/physical-dice/releases/latest/download/module.json
```

---

## Directory Structure

Following the official [Foundry VTT Module Development Guide](https://foundryvtt.com/article/module-development/):

```text
physical-dice/
├── .github/
│   └── workflows/
│       └── release.yml
├── lang/
│   └── en.json
├── scripts/
│   ├── rolls/
│   │   └── physical-dice-interceptor.js
│   ├── ui/
│   │   └── chat-controls-toggle.js
│   ├── physical-dice.js
│   ├── roll-prompt.js
│   └── settings.js
├── styles/
│   └── physical-dice.css
├── templates/
│   ├── chat-pending-roll.hbs
│   └── physical-dice-dialog.hbs
├── CHANGELOG.md
├── LICENSE
├── module.json
└── README.md
```

---

## Compatibility

- **Foundry VTT**: Minimum Version 14, Verified Version 14
- **Game Systems**: System agnostic (optimized for PF2e and Core Foundry rolls)
- **License**: MIT
