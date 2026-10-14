import fs from "fs";
import path from "path";

const rootDir = process.cwd();
let errorCount = 0;
let warningCount = 0;

function logPass(msg) {
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${msg}`);
  errorCount++;
}

function logWarn(msg) {
  console.warn(`\x1b[33m▲ [WARN]\x1b[0m ${msg}`);
  warningCount++;
}

console.log("\n🔍 Running Physical Dice Static Verifications...\n");

// 1. Mock Foundry Global Environment for ESM Module Tree Verification
console.log("--- 1. JavaScript Syntax & ESM Module Tree Verification ---");

global.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (base) => class extends base {},
      DialogV2: class {}
    },
    sidebar: {
      tabs: {
        ChatLog: class {}
      }
    }
  },
  documents: {
    collections: {
      Actors: class {}
    }
  },
  utils: {
    escapeHTML: (s) => String(s ?? "")
  }
};

global.CONFIG = {
  ChatMessage: { documentClass: class {} },
  Actor: { documentClass: class {} },
  User: { documentClass: class {} }
};

global.Hooks = {
  once: () => {},
  on: () => {},
  off: () => {},
  callAll: () => {}
};

global.Handlebars = {
  helpers: {},
  registerHelper: () => {}
};

global.game = {
  settings: {
    register: () => {},
    get: () => true,
    set: async () => {},
    settings: new Map()
  },
  user: {
    id: "test-user",
    isGM: true,
    name: "Gamemaster"
  },
  modules: new Map([
    ["physical-dice", { id: "physical-dice", active: true, api: {} }],
    ["pf2e-mobile-compact", { id: "pf2e-mobile-compact", active: false }]
  ]),
  actors: {
    get: () => null
  }
};

global.ui = {
  notifications: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  chat: {
    constructor: class {}
  }
};

global.loadTemplates = async () => [];
global.renderTemplate = async () => "<div></div>";

global.ChatMessage = {
  getSpeaker: () => ({}),
  create: async () => ({})
};

global.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
    this.terms = [];
    this._evaluated = false;
  }
  async evaluate() {
    this._evaluated = true;
    return this;
  }
  async toMessage() {
    return {};
  }
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1024
};

globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    type: "",
    className: "",
    setAttribute: () => {},
    addEventListener: () => {},
    appendChild: () => {},
    innerHTML: ""
  }),
  body: {}
};

globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

async function checkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await checkJsFiles(fullPath);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      if (entry.name === "verify.mjs") continue;
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      try {
        await import(`../${relPath}`);
        logPass(`Syntax & ESM valid: ${relPath}`);
      } catch (err) {
        logFail(`Syntax/ESM error in ${relPath}:\n${err.stack || err.message}`);
      }
    }
  }
}
await checkJsFiles(path.join(rootDir, "scripts"));

// 2. Check Module JSON Integrity
console.log("\n--- 2. module.json Verification ---");
const moduleJsonPath = path.join(rootDir, "module.json");
if (fs.existsSync(moduleJsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(moduleJsonPath, "utf-8"));
    if (!data.id) logFail("module.json is missing 'id' field.");
    else if (data.id !== "physical-dice") logFail(`Expected module id 'physical-dice', got '${data.id}'.`);
    else if (!data.version) logFail("module.json is missing 'version' field.");
    else if (!data.compatibility) logWarn("module.json is missing 'compatibility' section.");
    else logPass(`module.json valid (id: ${data.id}, version: ${data.version})`);

    // Verify declared files exist
    const declaredFiles = [
      ...(data.esmodules || []),
      ...(data.styles || []),
      ...(data.languages || []).map((l) => l.path),
      data.readme,
      data.license
    ].filter(Boolean);

    for (const rel of declaredFiles) {
      if (!fs.existsSync(path.join(rootDir, rel))) {
        logFail(`Declared file not found: ${rel}`);
      } else {
        logPass(`Declared file exists: ${rel}`);
      }
    }
  } catch (err) {
    logFail(`module.json contains invalid JSON: ${err.message}`);
  }
} else {
  logFail("module.json not found.");
}

// 3. Check Handlebars Templates
console.log("\n--- 3. Handlebars Template Verification ---");
function checkHbsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkHbsFiles(fullPath);
    } else if (entry.name.endsWith(".hbs")) {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      const content = fs.readFileSync(fullPath, "utf-8");

      // Check balanced block helpers
      const blocks = ["if", "each", "unless", "with"];
      for (const block of blocks) {
        const openMatches = content.match(new RegExp(`{{#${block}\\b`, "g")) || [];
        const closeMatches = content.match(new RegExp(`{{/${block}}}`, "g")) || [];
        if (openMatches.length !== closeMatches.length) {
          logFail(`Unbalanced {{#${block}}} in ${relPath}: ${openMatches.length} opened vs ${closeMatches.length} closed.`);
        }
      }

      // Check balanced structural tags
      const htmlTags = ["div", "section", "button", "form", "header", "footer", "p", "label"];
      for (const tag of htmlTags) {
        const tagOpen = (content.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
        const tagClose = (content.match(new RegExp(`<\\/${tag}>`, "gi")) || []).length;
        if (tagOpen !== tagClose) {
          logFail(`HTML tag mismatch in ${relPath}: ${tagOpen} <${tag}> opened vs ${tagClose} </${tag}> closed.`);
        }
      }

      logPass(`Template integrity valid: ${relPath}`);
    }
  }
}
checkHbsFiles(path.join(rootDir, "templates"));

// 4. CSS Syntax Check
console.log("\n--- 4. CSS Syntax Verification ---");
const stylesDir = path.join(rootDir, "styles");
if (fs.existsSync(stylesDir)) {
  const cssFiles = fs.readdirSync(stylesDir).filter((f) => f.endsWith(".css"));
  for (const cssFile of cssFiles) {
    const relPath = `styles/${cssFile}`;
    const cssContent = fs.readFileSync(path.join(stylesDir, cssFile), "utf-8");
    const stripped = cssContent.replace(/\/\*[\s\S]*?\*\//g, "");
    const openBraces = (stripped.match(/{/g) || []).length;
    const closeBraces = (stripped.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      logFail(`Unbalanced CSS braces in ${relPath}: ${openBraces} '{' vs ${closeBraces} '}'.`);
    } else {
      logPass(`CSS braces balanced (${openBraces} rules): ${relPath}`);
    }
  }
}

// 5. Localization Integrity
console.log("\n--- 5. Localization Verification ---");
const langDir = path.join(rootDir, "lang");
if (fs.existsSync(langDir)) {
  const langFiles = fs.readdirSync(langDir).filter((f) => f.endsWith(".json"));
  for (const langFile of langFiles) {
    const relPath = `lang/${langFile}`;
    try {
      JSON.parse(fs.readFileSync(path.join(langDir, langFile), "utf-8"));
      logPass(`Localization JSON valid: ${relPath}`);
    } catch (err) {
      logFail(`Invalid JSON in ${relPath}: ${err.message}`);
    }
  }
}

// Summary
console.log("\n==========================================");
if (errorCount === 0) {
  console.log(`\x1b[32m✔ All verifications passed with 0 errors (${warningCount} warnings)!\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31m✖ Verifications failed with ${errorCount} error(s) and ${warningCount} warning(s).\x1b[0m\n`);
  process.exit(1);
}
