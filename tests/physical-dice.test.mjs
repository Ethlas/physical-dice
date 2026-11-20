import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

// Minimal Foundry VTT globals required before importing runtime ESM modules
let renderHook = null;
let renderTemplateCalls = [];
let chatCreateCalls = [];
let currentEntryMethod = "dialog";

class MockApplicationV2 {
  static DEFAULT_OPTIONS = {};
  constructor() {}
  async _prepareContext() {
    return {};
  }
  async render(options) {
    if (typeof renderHook === "function") {
      await renderHook(this, options);
    }
    return this;
  }
  _onClose() {}
  close() {
    this._onClose({});
  }
}

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: MockApplicationV2,
      HandlebarsApplicationMixin: (base) => class extends base {}
    },
    sidebar: {
      tabs: { ChatLog: class {} }
    }
  },
  documents: {
    collections: { Actors: class {} }
  },
  utils: {
    escapeHTML: (s) => String(s ?? "")
  }
};

globalThis.CONFIG = { Dice: { rolls: [] } };
globalThis.Hooks = {
  once: () => {},
  on: () => {},
  off: () => {},
  callAll: () => {}
};
globalThis.Handlebars = { helpers: {}, registerHelper: () => {} };

const settingsMap = new Map([
  ["physical-dice.enabled", true],
  ["physical-dice.rollMode", "physical"],
  ["physical-dice.cleanupMode", "delete"],
  ["physical-dice.allowGmOverride", true],
  ["physical-dice.entryMethod", "dialog"]
]);

globalThis.game = {
  settings: {
    settings: settingsMap,
    get: (_mod, key) => {
      if (key === "entryMethod") return currentEntryMethod;
      if (key === "rollMode") return "physical";
      if (key === "enabled") return true;
      if (key === "cleanupMode") return "delete";
      if (key === "allowGmOverride") return true;
      return "publicroll";
    },
    set: async () => {}
  },
  user: { id: "user-1", isGM: true, name: "Tester", targets: { first: () => null } },
  users: [],
  messages: { get: () => null }
};

globalThis.ui = {
  notifications: { info: () => {}, warn: () => {}, error: () => {} },
  chat: { constructor: class {} }
};

globalThis.loadTemplates = async () => [];
globalThis.renderTemplate = async (templatePath, context) => {
  renderTemplateCalls.push({ templatePath, context });
  return "<div class='physical-dice-pending-card'></div>";
};

globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async (data) => {
    const msg = { id: `msg-${chatCreateCalls.length + 1}`, data };
    chatCreateCalls.push(msg);
    return msg;
  }
};

function evaluateDieTerm(term) {
  if (!Array.isArray(term.results) || term.results.length === 0) {
    const count = Math.max(1, Number(term.number) || 1);
    const faces = Math.max(1, Number(term.faces) || 6);
    term.results = Array.from({ length: count }, (_, i) => ({
      result: ((i % faces) + 1),
      active: true
    }));
  } else {
    term.results = term.results.map(r => ({ ...r, active: r.active !== false }));
  }

  const modifiers = Array.isArray(term.modifiers) ? term.modifiers : [];
  for (const mod of modifiers) {
    const activeEntries = term.results
      .map((r, idx) => ({ idx, result: r.result }))
      .filter((_, idx) => term.results[idx].active);

    const keepMatch = typeof mod === "string" && mod.match(/^k([hl])?(\d+)?$/i);
    if (keepMatch) {
      const mode = keepMatch[1]?.toLowerCase() === "l" ? "low" : "high";
      const keepN = keepMatch[2] ? parseInt(keepMatch[2], 10) : 1;
      const sorted = [...activeEntries].sort((a, b) =>
        mode === "low" ? a.result - b.result : b.result - a.result
      );
      const keepSet = new Set(sorted.slice(0, keepN).map(e => e.idx));
      term.results.forEach((r, idx) => {
        if (!keepSet.has(idx)) r.active = false;
      });
      continue;
    }

    const dropMatch = typeof mod === "string" && mod.match(/^d([hl])?(\d+)?$/i);
    if (dropMatch) {
      const mode = dropMatch[1]?.toLowerCase() === "h" ? "high" : "low";
      const dropN = dropMatch[2] ? parseInt(dropMatch[2], 10) : 1;
      const sorted = [...activeEntries].sort((a, b) =>
        mode === "high" ? b.result - a.result : a.result - b.result
      );
      const dropSet = new Set(sorted.slice(0, dropN).map(e => e.idx));
      term.results.forEach((r, idx) => {
        if (dropSet.has(idx)) r.active = false;
      });
    }
  }

  term._evaluated = true;
  term.total = term.results.reduce((sum, r) => sum + (r.active ? r.result : 0), 0);
  return term.total;
}

class MockRoll {
  constructor(terms = [], options = {}) {
    this.terms = terms;
    this.options = options;
    this.dice = terms.filter(t => typeof t.faces === "number" && typeof t.number === "number");
    this._evaluated = false;
    this.total = 0;
  }

  async evaluate() {
    let total = 0;
    let sign = 1;
    for (const term of this.terms) {
      if (term?.operator === "-") {
        sign = -1;
      } else if (term?.operator === "+") {
        sign = 1;
      } else if (typeof term?.faces === "number" && typeof term?.number === "number") {
        total += evaluateDieTerm(term) * sign;
      } else if (typeof term?.number === "number") {
        total += term.number * sign;
      }
    }
    this.total = total;
    this._evaluated = true;
    return this;
  }

  async toMessage() {
    return {};
  }
}

globalThis.Roll = MockRoll;
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1024,
  innerHeight: 900
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: {}
};

const {
  PhysicalDiceManager,
  analyzeDiceTerm,
  buildTermResults,
  partitionTotal
} = await import("../scripts/rolls/physical-dice-interceptor.js");
const { RollPrompt } = await import("../scripts/roll-prompt.js");

function makeDie(number, faces, modifiers = [], options = {}) {
  return { number, faces, modifiers, options, results: [] };
}

function makeMockInput(value = "") {
  const attrs = new Map();
  return {
    value,
    focused: false,
    dataset: {},
    setAttribute(k, v) { attrs.set(k, String(v)); },
    getAttribute(k) { return attrs.get(k) ?? null; },
    removeAttribute(k) { attrs.delete(k); },
    focus() { this.focused = true; }
  };
}

function makeMockBanner() {
  const classes = new Set(["hidden"]);
  return {
    textContent: "",
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c)
    }
  };
}

describe("analyzeDiceTerm", () => {
  it("analyzes single and summed multi-die terms", () => {
    assert.deepEqual(analyzeDiceTerm(makeDie(1, 20)), {
      count: 1, faces: 20, keptCount: 1, keepMode: null,
      isFortune: false, isMisfortune: false, min: 1, max: 20, formula: "1d20"
    });
    assert.deepEqual(analyzeDiceTerm(makeDie(13, 4)), {
      count: 13, faces: 4, keptCount: 13, keepMode: null,
      isFortune: false, isMisfortune: false, min: 13, max: 52, formula: "13d4"
    });
    assert.deepEqual(analyzeDiceTerm(makeDie(4, 6)), {
      count: 4, faces: 6, keptCount: 4, keepMode: null,
      isFortune: false, isMisfortune: false, min: 4, max: 24, formula: "4d6"
    });
    assert.deepEqual(analyzeDiceTerm(makeDie(2, 20)), {
      count: 2, faces: 20, keptCount: 2, keepMode: null,
      isFortune: false, isMisfortune: false, min: 2, max: 40, formula: "2d20"
    });
  });

  it("identifies Fortune and Misfortune keep-1 terms via modifiers or roll options", () => {
    for (const mod of ["kh", "kh1", "dl1"]) {
      const res = analyzeDiceTerm(makeDie(2, 20, [mod]));
      assert.equal(res.isFortune, true);
      assert.equal(res.isMisfortune, false);
      assert.equal(res.keptCount, 1);
      assert.equal(res.min, 1);
      assert.equal(res.max, 20);
    }

    for (const mod of ["kl", "kl1", "dh1"]) {
      const res = analyzeDiceTerm(makeDie(2, 20, [mod]));
      assert.equal(res.isFortune, false);
      assert.equal(res.isMisfortune, true);
      assert.equal(res.keptCount, 1);
      assert.equal(res.min, 1);
      assert.equal(res.max, 20);
    }

    const optFortune = analyzeDiceTerm(makeDie(2, 20), { options: { fortune: true } });
    assert.equal(optFortune.isFortune, true);
    assert.equal(optFortune.min, 1);
    assert.equal(optFortune.max, 20);

    const optMisfortune = analyzeDiceTerm(makeDie(2, 20), { options: { misfortune: true } });
    assert.equal(optMisfortune.isMisfortune, true);
    assert.equal(optMisfortune.min, 1);
    assert.equal(optMisfortune.max, 20);
  });

  it("handles keep/drop modifiers keeping multiple dice (e.g. 4d6kh3, 4d6dl1, 4d6kl3, 4d6dh1)", () => {
    for (const mod of ["kh3", "dl1"]) {
      const res = analyzeDiceTerm(makeDie(4, 6, [mod]));
      assert.equal(res.keptCount, 3);
      assert.equal(res.keepMode, "high");
      assert.equal(res.isFortune, false);
      assert.equal(res.min, 3);
      assert.equal(res.max, 18);
    }

    for (const mod of ["kl3", "dh1"]) {
      const res = analyzeDiceTerm(makeDie(4, 6, [mod]));
      assert.equal(res.keptCount, 3);
      assert.equal(res.keepMode, "low");
      assert.equal(res.isMisfortune, false);
      assert.equal(res.min, 3);
      assert.equal(res.max, 18);
    }
  });
});

describe("buildTermResults and partitionTotal", () => {
  it("partitions multi-die totals evenly within 1..faces", () => {
    for (const total of [13, 30, 52]) {
      const part = partitionTotal(total, 13, 4);
      assert.equal(part.length, 13);
      assert.equal(part.reduce((a, b) => a + b, 0), total);
      for (const d of part) {
        assert.ok(d >= 1 && d <= 4, `Die result ${d} out of 1..4`);
      }

      const results = buildTermResults(total, analyzeDiceTerm(makeDie(13, 4)));
      assert.equal(results.length, 13);
      assert.equal(results.reduce((a, r) => a + r.result, 0), total);
    }

    const r4d6 = buildTermResults(17, analyzeDiceTerm(makeDie(4, 6)));
    assert.equal(r4d6.length, 4);
    assert.equal(r4d6.reduce((a, r) => a + r.result, 0), 17);
    assert.ok(r4d6.every(r => r.result >= 1 && r.result <= 6));
  });

  it("repeats single value across Fortune/Misfortune dice", () => {
    assert.deepEqual(
      buildTermResults(18, analyzeDiceTerm(makeDie(2, 20, ["kh"]))),
      [{ result: 18, active: true }, { result: 18, active: true }]
    );
    assert.deepEqual(
      buildTermResults(4, analyzeDiceTerm(makeDie(2, 20, ["kl"]))),
      [{ result: 4, active: true }, { result: 4, active: true }]
    );
  });

  it("pads dropped dice cleanly for keep-multiple modifiers so native evaluation yields exact total", async () => {
    for (const total of [3, 15, 18]) {
      const term = makeDie(4, 6, ["kh3"]);
      term.results = buildTermResults(total, analyzeDiceTerm(term));
      assert.equal(term.results.length, 4);
      assert.equal(evaluateDieTerm(term), total);
    }

    for (const total of [7, 18]) {
      const term = makeDie(4, 6, ["kl3"]);
      term.results = buildTermResults(total, analyzeDiceTerm(term));
      assert.equal(term.results.length, 4);
      assert.equal(evaluateDieTerm(term), total);
    }
  });
});

describe("RollPrompt validation, bounds, and steppers", () => {
  it("computes bounds accurately for single, multi-die, and keep-1 checks", () => {
    assert.deepEqual(RollPrompt.getCheckBounds({ faces: 20, count: 1 }), {
      faces: 20, count: 1, keptCount: 1, min: 1, max: 20
    });
    assert.deepEqual(RollPrompt.getCheckBounds({ faces: 4, count: 13 }), {
      faces: 4, count: 13, keptCount: 13, min: 13, max: 52
    });
    assert.deepEqual(RollPrompt.getCheckBounds({ faces: 20, count: 2, isFortune: true }), {
      faces: 20, count: 2, keptCount: 1, min: 1, max: 20
    });
  });

  it("validates single-die, multi-die, and invalid string inputs", () => {
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("", 20, 1, 20), { automated: true });
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("15", 20, 1, 20), { value: 15 });
    assert.ok(RollPrompt.evaluateCheckSubmission("21", 20, 1, 20).error);

    // 13d4 bounds: 13..52
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("", 4, 13, 52), { automated: true });
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("13", 4, 13, 52), { value: 13 });
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("30", 4, 13, 52), { value: 30 });
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("52", 4, 13, 52), { value: 52 });
    assert.equal(
      RollPrompt.evaluateCheckSubmission("4", 4, 13, 52).error,
      "Please enter a valid roll between 13 and 52."
    );
    assert.ok(RollPrompt.evaluateCheckSubmission("12", 4, 13, 52).error);
    assert.ok(RollPrompt.evaluateCheckSubmission("53", 4, 13, 52).error);
    assert.ok(RollPrompt.evaluateCheckSubmission("30.5", 4, 13, 52).error);
    assert.ok(RollPrompt.evaluateCheckSubmission("30abc", 4, 13, 52).error);

    // Fortune 2d20kh bounds: 1..20
    assert.deepEqual(RollPrompt.evaluateCheckSubmission("20", 20, 1, 20), { value: 20 });
  });

  it("clamps stepValue to multi-die bounds (13..52) and validates pools", () => {
    assert.equal(RollPrompt.stepValue("", 1, 13, 52), 13);
    assert.equal(RollPrompt.stepValue("", -1, 13, 52), 52);
    assert.equal(RollPrompt.stepValue("13", -1, 13, 52), 13);
    assert.equal(RollPrompt.stepValue("52", 1, 13, 52), 52);
    assert.equal(RollPrompt.stepValue("30", 1, 13, 52), 31);

    const pools = [
      { id: "pool_0", typeLabel: "Dice 1", formula: "2d6", min: 2, max: 12 },
      { id: "pool_1", typeLabel: "Dice 2", formula: "1d4", min: 1, max: 4 }
    ];
    assert.deepEqual(RollPrompt.evaluateDamageSubmission({ pool_0: "", pool_1: "" }, pools), { automated: true });
    assert.deepEqual(RollPrompt.evaluateDamageSubmission({ pool_0: "9", pool_1: "3" }, pools), {
      results: { pool_0: 9, pool_1: 3 }
    });
    assert.equal(RollPrompt.evaluateDamageSubmission({ pool_0: "1", pool_1: "3" }, pools).errorPoolId, "pool_0");
    assert.equal(RollPrompt.evaluateDamageSubmission({ pool_0: "9.5", pool_1: "3" }, pools).errorPoolId, "pool_0");
  });
});

describe("PhysicalDiceManager.interceptRoll end-to-end", () => {
  const origPromptCheck = RollPrompt.promptCheck;
  const origPromptDamage = RollPrompt.promptDamage;

  afterEach(() => {
    RollPrompt.promptCheck = origPromptCheck;
    RollPrompt.promptDamage = origPromptDamage;
  });

  it("handles 13d4 multi-die standard roll without repeating entered value across dice", async () => {
    let capturedParams = null;
    RollPrompt.promptCheck = async (params) => {
      capturedParams = params;
      return 30;
    };

    const die = makeDie(13, 4);
    const roll = new MockRoll([die]);
    const handled = await PhysicalDiceManager.interceptRoll(roll, {}, MockRoll.prototype.evaluate);

    assert.equal(handled, true);
    assert.equal(capturedParams.min, 13);
    assert.equal(capturedParams.max, 52);
    assert.equal(capturedParams.count, 13);
    assert.equal(capturedParams.faces, 4);
    assert.equal(capturedParams.isFortune, false);
    assert.equal(die.results.length, 13);
    assert.ok(die.results.every(r => r.result >= 1 && r.result <= 4));
    assert.equal(roll.total, 30);
  });

  it("handles 4d6 and summed 2d20 standard rolls", async () => {
    RollPrompt.promptCheck = async () => 17;
    const roll4d6 = new MockRoll([makeDie(4, 6)]);
    await PhysicalDiceManager.interceptRoll(roll4d6, {}, MockRoll.prototype.evaluate);
    assert.equal(roll4d6.total, 17);
    assert.equal(roll4d6.dice[0].results.length, 4);

    let captured2d20 = null;
    RollPrompt.promptCheck = async (params) => {
      captured2d20 = params;
      return 25;
    };
    const roll2d20 = new MockRoll([makeDie(2, 20)]);
    await PhysicalDiceManager.interceptRoll(roll2d20, {}, MockRoll.prototype.evaluate);
    assert.equal(captured2d20.min, 2);
    assert.equal(captured2d20.max, 40);
    assert.equal(captured2d20.isFortune, false);
    assert.equal(roll2d20.total, 25);
  });

  it("preserves Fortune 2d20kh + 5 and Misfortune 2d20kl + 5 behavior", async () => {
    let fortuneParams = null;
    RollPrompt.promptCheck = async (params) => {
      fortuneParams = params;
      return 18;
    };
    const fortuneRoll = new MockRoll([makeDie(2, 20, ["kh"]), { operator: "+" }, { number: 5 }]);
    await PhysicalDiceManager.interceptRoll(fortuneRoll, {}, MockRoll.prototype.evaluate);
    assert.equal(fortuneParams.min, 1);
    assert.equal(fortuneParams.max, 20);
    assert.equal(fortuneParams.isFortune, true);
    assert.equal(fortuneParams.modifier, 5);
    assert.deepEqual(
      fortuneRoll.dice[0].results.map(r => r.result),
      [18, 18]
    );
    assert.equal(fortuneRoll.total, 23);

    let misParams = null;
    RollPrompt.promptCheck = async (params) => {
      misParams = params;
      return 4;
    };
    const misRoll = new MockRoll([makeDie(2, 20, ["kl"]), { operator: "+" }, { number: 5 }]);
    await PhysicalDiceManager.interceptRoll(misRoll, {}, MockRoll.prototype.evaluate);
    assert.equal(misParams.min, 1);
    assert.equal(misParams.max, 20);
    assert.equal(misParams.isMisfortune, true);
    assert.equal(misParams.modifier, 5);
    assert.equal(misRoll.total, 9);
  });

  it("handles 4d6kh3 and negative modifiers (1d20 - 2)", async () => {
    let kh3Params = null;
    RollPrompt.promptCheck = async (params) => {
      kh3Params = params;
      return 15;
    };
    const rollKh3 = new MockRoll([makeDie(4, 6, ["kh3"])]);
    await PhysicalDiceManager.interceptRoll(rollKh3, {}, MockRoll.prototype.evaluate);
    assert.equal(kh3Params.min, 3);
    assert.equal(kh3Params.max, 18);
    assert.equal(kh3Params.keptCount, 3);
    assert.equal(kh3Params.isFortune, false);
    assert.deepEqual(rollKh3.dice[0].results.map(r => r.result), [5, 5, 5, 1]);
    assert.equal(rollKh3.total, 15);

    let negModParams = null;
    RollPrompt.promptCheck = async (params) => {
      negModParams = params;
      return 14;
    };
    const rollNeg = new MockRoll([makeDie(1, 20), { operator: "-" }, { number: 2 }]);
    await PhysicalDiceManager.interceptRoll(rollNeg, {}, MockRoll.prototype.evaluate);
    assert.equal(negModParams.modifier, -2);
    assert.equal(rollNeg.total, 12);
  });

  it("routes multi-term standard rolls (2d6 + 1d4 and 2d20kh + 1d4 + 5) through multi-pool entry", async () => {
    let multiParams = null;
    RollPrompt.promptDamage = async (params) => {
      multiParams = params;
      return { pool_0: 9, pool_1: 3 };
    };
    const roll = new MockRoll([makeDie(2, 6), { operator: "+" }, makeDie(1, 4)]);
    await PhysicalDiceManager.interceptRoll(roll, {}, MockRoll.prototype.evaluate);
    assert.equal(multiParams.isDamage, false);
    assert.equal(multiParams.pools.length, 2);
    assert.equal(multiParams.pools[0].min, 2);
    assert.equal(multiParams.pools[0].max, 12);
    assert.equal(multiParams.pools[1].min, 1);
    assert.equal(multiParams.pools[1].max, 4);
    assert.deepEqual(roll.dice[0].results.map(r => r.result), [5, 4]);
    assert.deepEqual(roll.dice[1].results.map(r => r.result), [3]);
    assert.equal(roll.total, 12);

    // 2d20kh + 1d4 + 5
    let fortuneMultiParams = null;
    RollPrompt.promptDamage = async (params) => {
      fortuneMultiParams = params;
      return { pool_0: 17, pool_1: 3 };
    };
    const fortuneMulti = new MockRoll([
      makeDie(2, 20, ["kh"]),
      { operator: "+" },
      makeDie(1, 4),
      { operator: "+" },
      { number: 5 }
    ]);
    await PhysicalDiceManager.interceptRoll(fortuneMulti, {}, MockRoll.prototype.evaluate);
    assert.equal(fortuneMultiParams.isDamage, false);
    assert.equal(fortuneMultiParams.modifier, 5);
    assert.equal(fortuneMultiParams.pools[0].min, 1);
    assert.equal(fortuneMultiParams.pools[0].max, 20);
    assert.equal(fortuneMultiParams.pools[0].isFortune, true);
    assert.deepEqual(fortuneMulti.dice[0].results.map(r => r.result), [17, 17]);
    assert.deepEqual(fortuneMulti.dice[1].results.map(r => r.result), [3]);
    assert.equal(fortuneMulti.total, 25);
  });

  it("supports partial blank pools and automated fallback", async () => {
    RollPrompt.promptDamage = async () => ({ pool_0: 9 });
    const d6 = makeDie(2, 6);
    const d4 = makeDie(1, 4);
    const partialRoll = new MockRoll([d6, { operator: "+" }, d4]);
    await PhysicalDiceManager.interceptRoll(partialRoll, {}, MockRoll.prototype.evaluate);
    assert.deepEqual(d6.results.map(r => r.result), [5, 4]);
    assert.equal(d4._isPhysicalIntercepted, undefined);
    assert.equal(partialRoll.total, 10); // 9 + 1 (mock digital roll for 1d4)

    RollPrompt.promptCheck = async () => ({ automated: true });
    const autoDie = makeDie(13, 4);
    const autoRoll = new MockRoll([autoDie]);
    await PhysicalDiceManager.interceptRoll(autoRoll, {}, MockRoll.prototype.evaluate);
    assert.equal(autoDie._isPhysicalIntercepted, undefined);
    assert.equal(autoRoll._evaluated, true);

    RollPrompt.promptDamage = async () => ({ automated: true });
    const autoMulti = new MockRoll([makeDie(2, 6), { operator: "+" }, makeDie(1, 4)]);
    await PhysicalDiceManager.interceptRoll(autoMulti, {}, MockRoll.prototype.evaluate);
    assert.equal(autoMulti._evaluated, true);
  });
});

describe("Dialog and Chat Prompt context and submission", () => {
  beforeEach(() => {
    renderTemplateCalls = [];
    chatCreateCalls = [];
    renderHook = null;
  });

  afterEach(() => {
    renderHook = null;
    RollPrompt.pendingChatRolls.clear();
  });

  it("prepares accurate dialog contexts for 13d4, 1d20, 2d20kh, and 2d20", async () => {
    currentEntryMethod = "dialog";
    const contexts = [];

    for (const [params, resolveVal] of [
      [{ title: "Resource", faces: 4, count: 13, min: 13, max: 52, keptCount: 13, formula: "13d4" }, 30],
      [{ title: "Check", faces: 20, count: 1, min: 1, max: 20, keptCount: 1, formula: "1d20" }, 15],
      [{ title: "Fortune", faces: 20, count: 2, min: 1, max: 20, keptCount: 1, isFortune: true, formula: "2d20kh" }, 19],
      [{ title: "Summed", faces: 20, count: 2, min: 2, max: 40, keptCount: 2, formula: "2d20" }, 25]
    ]) {
      renderHook = async (app) => {
        contexts.push(await app._prepareContext({}));
        app._settled = true;
        app._resolve(resolveVal);
      };
      const val = await RollPrompt.promptCheck(params);
      assert.equal(val, resolveVal);
    }

    assert.equal(contexts[0].min, 13);
    assert.equal(contexts[0].max, 52);
    assert.equal(contexts[0].isMultiDie, true);
    assert.equal(contexts[0].showD20Presets, false);

    assert.equal(contexts[1].min, 1);
    assert.equal(contexts[1].max, 20);
    assert.equal(contexts[1].isMultiDie, false);
    assert.equal(contexts[1].showD20Presets, true);

    assert.equal(contexts[2].min, 1);
    assert.equal(contexts[2].max, 20);
    assert.equal(contexts[2].isFortune, true);
    assert.equal(contexts[2].showD20Presets, true);

    assert.equal(contexts[3].min, 2);
    assert.equal(contexts[3].max, 40);
    assert.equal(contexts[3].isMultiDie, true);
    assert.equal(contexts[3].showD20Presets, false);
  });

  it("handles chat prompt rendering, range errors, aria-invalid, and multi-term pools", async () => {
    currentEntryMethod = "chat";

    const promise = RollPrompt.promptCheck({
      title: "Kingdom Resource",
      faces: 4,
      count: 13,
      keptCount: 13,
      min: 13,
      max: 52,
      formula: "13d4"
    });

    await new Promise(r => setTimeout(r, 0));
    assert.equal(renderTemplateCalls.length, 1);
    const tplCtx = renderTemplateCalls[0].context;
    assert.equal(tplCtx.min, 13);
    assert.equal(tplCtx.max, 52);
    assert.equal(tplCtx.isMultiDie, true);
    assert.equal(tplCtx.showD20Presets, false);

    const msgId = chatCreateCalls[0].id;
    const input = makeMockInput("4");
    const banner = makeMockBanner();
    const card = {
      classList: { add: () => {} },
      querySelector: (sel) => {
        if (sel === "input[name='check-val']") return input;
        if (sel === ".physical-error-banner") return banner;
        return null;
      },
      querySelectorAll: () => []
    };

    await RollPrompt._submitChatRoll(msgId, card);
    assert.equal(banner.textContent, "Please enter a valid roll between 13 and 52.");
    assert.equal(banner.classList.contains("hidden"), false);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(input.focused, true);

    input.value = "30";
    await RollPrompt._submitChatRoll(msgId, card);
    assert.equal(input.getAttribute("aria-invalid"), null);
    assert.equal(await promise, 30);

    // Multi-term standard pool in chat mode
    const multiPromise = RollPrompt.promptDamage({
      title: "Mixed Roll",
      isDamage: false,
      modifier: 5,
      pools: [
        { id: "pool_0", typeLabel: "Dice 1", formula: "2d6", min: 2, max: 12 },
        { id: "pool_1", typeLabel: "Dice 2", formula: "1d4", min: 1, max: 4 }
      ]
    });
    await new Promise(r => setTimeout(r, 0));
    const multiCtx = renderTemplateCalls[1].context;
    assert.equal(multiCtx.isDamage, false);
    assert.equal(multiCtx.hasModifier, true);
    assert.equal(multiCtx.modifier, 5);

    const msgId2 = chatCreateCalls[1].id;
    const pool0Input = makeMockInput("9");
    const pool1Input = makeMockInput("3");
    const multiCard = {
      classList: { add: () => {} },
      querySelector: (sel) => {
        if (sel === 'input[data-pool-id="pool_0"]') return pool0Input;
        if (sel === 'input[data-pool-id="pool_1"]') return pool1Input;
        return null;
      },
      querySelectorAll: () => []
    };
    await RollPrompt._submitChatRoll(msgId2, multiCard);
    assert.deepEqual(await multiPromise, { pool_0: 9, pool_1: 3 });
  });
});
