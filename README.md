# Physical Dice

A streamlined, mobile- and desktop-friendly Foundry Virtual Tabletop module that allows players and GMs to roll physical dice at the gaming table while seamlessly recording and resolving the results inside Foundry VTT. For mobile, the module pf2e-mobile-compact should be used in conjunction with this module to ensure the best mobile experience.

---

## Features

- **Seamless Manual Dice Entry**: Intercepts or prompts for physical dice totals before rolls are evaluated.
- **System Integrity**: Preserves game system math, degree-of-success calculations, and official chat card styling.
- **Modern Foundry Architecture**: Built with modern ESModules and compatible with Foundry VTT v14.
- **Configurable Settings**: Toggle physical dice interception globally or on a per-client basis.

---

## Installation

### Via Foundry VTT Module Browser (currently not possible)
1. In Foundry VTT Setup, navigate to the **Add-on Modules** tab.
2. Click **Install Module**.
3. Search for **Physical Dice** and click **Install**.

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
│   └── physical-dice.js
├── styles/
│   └── physical-dice.css
├── templates/
│   └── .gitkeep
├── .gitignore
├── LICENSE
├── module.json
└── README.md
```

---

## Compatibility

- **Foundry VTT**: Minimum Version 14, Verified Version 14
- **License**: MIT
