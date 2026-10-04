import { RollPrompt } from "../roll-prompt.js";
import { getStoredRollMode, isModuleEnabled } from "../settings.js";

/**
 * Custom error thrown when a user cancels the physical dice entry.
 */
export class PhysicalRollCancelledError extends Error {
  constructor(message = "Physical roll cancelled by user.") {
    super(message);
    this.name = "PhysicalRollCancelledError";
    this.isPhysicalRollCancelled = true;
  }
}

/**
 * Capitalizes or formats a damage type slug.
 * @param {string} type
 * @returns {string}
 */
export function formatDamageType(type) {
  if (!type) return "Untyped";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Partitions a total numeric sum across an arbitrary number of dice
 * ensuring that each individual die result is an integer between 1 and faces
 * and the sum of all dice strictly equals the total.
 * we do this because foundry requires each dirce individually
 *
 * @param {number} total Total sum to distribute
 * @param {number} count Number of dice
 * @param {number} faces Die faces
 * @returns {number[]} Array of die results
 */
export function partitionTotal(total, count, faces) {
  if (count <= 1) return [total];

  // Clamp total between min possible (count * 1) and max possible (count * faces)
  const minPossible = count * 1;
  const maxPossible = count * faces;
  const safeTotal = Math.min(Math.max(total, minPossible), maxPossible);

  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal % count;
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(base + (i < remainder ? 1 : 0));
  }

  return results;
}

/**
 * Manages physical dice interception and resolution for Foundry VTT and PF2e roll executions.
 */
export class PhysicalDiceManager {
  /**
   * Active context for the currently executing physical roll.
   * @type {{ title?: string, subtitle?: string, target?: object, actor?: object, isPhysical?: boolean } | null}
   */
  static activeContext = null;

  /**
   * Concurrency lock to prevent multiple prompts opening at the same time.
   * @type {boolean}
   */
  static isPrompting = false;

  /**
   * Checks whether Physical Dice mode is currently active for this client.
   * @returns {boolean}
   */
  static isPhysicalModeActive() {
    if (!isModuleEnabled()) return false;
    if (this.activeContext?.isPhysical === false) return false;
    if (this.activeContext?.isPhysical === true) return true;

    return getStoredRollMode() === "physical";
  }

  /**
   * Evaluates a callback within a physical roll interception context.
   *
   * @param {object} context Context details (title, subtitle, target, actor)
   * @param {Function} fn Async function that executes the roll
   * @param {boolean} [isPhysical=true]
   * @returns {Promise<any>}
   */
  static async withPhysicalMode(context, fn, isPhysical = true) {
    const prevContext = this.activeContext;
    try {
      this.activeContext = { ...context, isPhysical: !!isPhysical };
      return await fn();
    } catch (err) {
      if (err?.isPhysicalRollCancelled) {
        console.log("Physical Dice | Physical roll cancelled by user.");
        return null;
      }
      throw err;
    } finally {
      this.activeContext = prevContext;
    }
  }

  /**
   * Recursively extracts all unevaluated DiceTerm objects within a DamageInstance or Roll.
   * @param {object} inst
   * @returns {Array<object>}
   */
  static extractDiceFromInstance(inst) {
    if (!inst) return [];
    if (Array.isArray(inst.dice) && inst.dice.length > 0) {
      return inst.dice;
    }

    const results = [];
    const activeStack = new Set(); //prevents infinite loops caused by circular references
    const findDice = (term, depth = 0) => {
      if (!term || typeof term !== "object" || activeStack.has(term) || depth > 25) return;
      activeStack.add(term);

      try {
        if (typeof term.faces === "number" && typeof term.number === "number") {
          results.push(term);
          return;
        }
        if (Array.isArray(term.dice)) {
          for (const d of term.dice) findDice(d, depth + 1);
        }
        if (Array.isArray(term.terms)) {
          for (const t of term.terms) findDice(t, depth + 1);
        }
        if (term.term) findDice(term.term, depth + 1);
        if (Array.isArray(term.operands)) {
          for (const op of term.operands) findDice(op, depth + 1);
        }
        if (Array.isArray(term.rolls)) {
          for (const r of term.rolls) {
            if (r && Array.isArray(r.terms)) {
              for (const t of r.terms) findDice(t, depth + 1);
            }
          }
        }
      } finally {
        activeStack.delete(term);
      }
    };

    if (Array.isArray(inst.terms)) {
      for (const t of inst.terms) findDice(t);
    }
    return results;
  }

  /**
   * Computes the flat modifier for a DamageInstance.
   * Uses PF2e's native minimumValue difference when available, or walks numeric AST terms.
   * @param {object} inst
   * @param {Array<object>} [diceTerms=[]]
   * @returns {number}
   */
  static extractNumericModifier(inst, diceTerms = []) {
    if (!inst) return 0;

    // In PF2e, inst.minimumValue is a getter on DamageInstance
    if (typeof inst.minimumValue === "number" && Number.isFinite(inst.minimumValue)) {
      const diceMin = diceTerms.reduce((sum, d) => sum + (d.number ?? 1), 0);
      return inst.minimumValue - diceMin;
    }

    let mod = 0;
    const findNumbers = (term, sign = 1) => {
      if (!term) return;
      if (typeof term.number === "number" && typeof term.faces !== "number") {
        mod += term.number * sign;
        return;
      }
      if (Array.isArray(term.terms)) {
        let currentSign = 1;
        for (const t of term.terms) {
          if (t.operator === "-") currentSign = -1;
          else if (t.operator === "+") currentSign = 1;
          else findNumbers(t, currentSign);
        }
      }
      if (term.operands) {
        const op = term.operator;
        findNumbers(term.operands[0], sign);
        findNumbers(term.operands[1], op === "-" ? -sign : sign);
      }
      if (term.term) findNumbers(term.term, sign);
    };

    if (Array.isArray(inst.terms)) {
      for (const t of inst.terms) findNumbers(t);
    }
    return mod;
  }

  /**
   * Determines if a given Roll should be intercepted for physical dice entry.
   * @param {Roll} roll
   * @returns {boolean}
   */
  static shouldIntercept(roll) {
    if (!this.isPhysicalModeActive()) return false;
    if (this.isPrompting) return false;
    if (roll._evaluated || roll._isPhysicalIntercepted || roll._isPhysicalCancelled || roll._isPhysicalPrompting) return false;

    // Check for unevaluated dice in DamageRoll instances
    if (Array.isArray(roll.instances) && roll.instances.length > 0) {
      return roll.instances.some(inst => {
        if (inst._evaluated || inst._isPhysicalIntercepted) return false;
        const dice = this.extractDiceFromInstance(inst);
        return dice.some(d => !d._evaluated && (!Array.isArray(d.results) || d.results.length === 0));
      });
    }

    // Check if roll has dice (DamageRoll.dice, CheckRoll.dice, Roll.dice)
    const dice = roll.dice;
    if (Array.isArray(dice) && dice.length > 0) {
      return dice.some(d => !d._evaluated && (!Array.isArray(d.results) || d.results.length === 0));
    }

    // Check roll.terms directly
    if (Array.isArray(roll.terms)) {
      return roll.terms.some(t => {
        if (t._evaluated || t._isPhysicalIntercepted) return false;
        if (typeof t.faces === "number" && typeof t.number === "number") {
          return !t._evaluated && (!Array.isArray(t.results) || t.results.length === 0);
        }
        if (Array.isArray(t.dice)) {
          return t.dice.some(d => !d._evaluated && (!Array.isArray(d.results) || d.results.length === 0));
        }
        return false;
      });
    }

    return false;
  }

  /**
   * Intercepts a roll evaluation, posting an interactive prompt in the chat log,
   * populating term results with entered values, and delegating natively
   * to Foundry / PF2e evaluate() without performing custom arithmetic.
   *
   * @param {Roll} roll
   * @param {object} [options={}]
   * @param {Function} [origEvaluate=null] Original evaluate method
   * @returns {Promise<boolean>} True if handled, false if bypassed
   */
  static async interceptRoll(roll, options = {}, origEvaluate = null) {
    if (this.isPrompting || roll._isPhysicalCancelled) return false;
    this.isPrompting = true;
    roll._isPhysicalPrompting = true;

    try {
      const evaluateFn = origEvaluate ?? roll.constructor?.prototype?.evaluate ?? globalThis.Roll?.prototype?.evaluate;
      const context = this.activeContext ?? {};

      // Target information extraction
      let target = context.target ?? null;
      if (!target) {
        const userTarget = game.user?.targets?.first();
        if (userTarget) {
          target = { name: userTarget.name ?? userTarget.document?.name ?? "Target" };
        }
      }
      const targetInfo = target ? { name: target.name ?? "Target" } : null;

      const isDamage = (Array.isArray(roll.instances) && roll.instances.length > 0) || roll.constructor?.name === "DamageRoll";

      const title = context.title
        ?? roll.options?.title
        ?? roll.options?.flavor
        ?? (isDamage ? "Damage Roll" : "Roll");
      const subtitle = context.subtitle
        ?? roll.options?.action
        ?? (isDamage ? "Damage" : "");
      const actor = context.actor ?? null;

      // -------------------------------------------------------------
      // Scenario A: DamageRoll (with multiple damage instances or pools)
      // -------------------------------------------------------------
      if (isDamage) {
        const pools = [];
        let poolCounter = 0;

        const instances = Array.isArray(roll.instances) && roll.instances.length > 0
          ? roll.instances
          : [roll];

        for (let i = 0; i < instances.length; i++) {
          const inst = instances[i];
          const diceTerms = this.extractDiceFromInstance(inst);
          const instanceMod = this.extractNumericModifier(inst, diceTerms);

          for (const term of diceTerms) {
            const count = term.number ?? 1;
            const faces = term.faces ?? 6;
            pools.push({
              id: `pool_${poolCounter++}`,
              instance: inst,
              term: term,
              type: inst.type ?? "untyped",
              typeLabel: formatDamageType(inst.type),
              persistent: !!inst.persistent,
              materials: Array.from(inst.materials ?? []).join(", "),
              formula: `${count}d${faces}`,
              number: count,
              faces: faces,
              min: count * 1,
              max: count * faces,
              mod: instanceMod
            });
          }
        }

        // If no dice were found (e.g. flat damage only), allow normal evaluation
        if (pools.length === 0) {
          return false;
        }

        // Prompt user for damage totals for each pool (unified RollPrompt automatically handles dialog vs chat)
        let enteredTotals;
        try {
          enteredTotals = await RollPrompt.promptDamage({
            title,
            subtitle,
            target: targetInfo,
            pools,
            roll,
            actor
          });
        } catch (err) {
          if (err?.isPhysicalRollCancelled) throw err;
          enteredTotals = null;
        }

        if (!enteredTotals) {
          throw new PhysicalRollCancelledError();
        }

        // If user accepted without entering any dice, automate entire damage roll digitally
        if (enteredTotals.automated || (typeof enteredTotals === "object" && Object.keys(enteredTotals).length === 0)) {
          roll._isPhysicalIntercepted = true;
          for (const inst of instances) {
            inst._isPhysicalIntercepted = true;
          }
          await evaluateFn.call(roll, options);
          return true;
        }

        // Assign manual outcomes to dice terms; un-entered pools remain untouched for native digital evaluation
        for (const pool of pools) {
          const totalVal = enteredTotals[pool.id];
          if (typeof totalVal === "number" && !isNaN(totalVal)) {
            const diceResults = partitionTotal(totalVal, pool.number, pool.faces);
            pool.term.results = diceResults.map(r => ({ result: r, active: true }));
            pool.term._isPhysicalIntercepted = true;
          }
        }

        // Mark parent and instances so child evaluations don't re-prompt
        roll._isPhysicalIntercepted = true;
        for (const inst of instances) {
          inst._isPhysicalIntercepted = true;
        }

        // Delegate entirely to native PF2e / Foundry evaluate
        await evaluateFn.call(roll, { ...options, allowInteractive: false });
        return true;
      }

      // -------------------------------------------------------------
      // Scenario B: CheckRoll or Standard Roll (e.g. 1d20 + mod)
      // -------------------------------------------------------------
      const terms = roll.terms ?? [];
      let diceTerms = roll.dice ?? [];
      if (!diceTerms.length) {
        diceTerms = terms.filter(t => typeof t.faces === "number" && typeof t.number === "number");
      }

      if (diceTerms.length === 0) {
        return false;
      }

      // Find d20 or primary die term
      const d20Term = diceTerms.find(t => t.faces === 20) ?? diceTerms[0];
      const modTerms = terms.filter(t => typeof t.number === "number" && typeof t.faces !== "number");
      const totalMod = modTerms.reduce((sum, t) => sum + (t.number ?? 0), 0);

      const faces = d20Term.faces ?? 20;
      const count = d20Term.number ?? 1;
      const isFortune = d20Term.modifiers?.some(m => m.startsWith("kh")) || !!roll.options?.fortune;
      const isMisfortune = d20Term.modifiers?.some(m => m.startsWith("kl")) || !!roll.options?.misfortune;

      let d20Result;
      try {
        d20Result = await RollPrompt.promptCheck({
          title,
          subtitle,
          target: targetInfo,
          modifier: totalMod,
          faces,
          count,
          isFortune,
          isMisfortune,
          term: d20Term,
          roll,
          actor
        });
      } catch (err) {
        if (err?.isPhysicalRollCancelled) throw err;
        d20Result = null;
      }

      if (!d20Result) {
        throw new PhysicalRollCancelledError();
      }

      // If user accepted without entering dice, automate check roll digitally
      if (d20Result.automated || d20Result === "auto") {
        roll._isPhysicalIntercepted = true;
        await evaluateFn.call(roll, options);
        return true;
      }

      if (typeof d20Result !== "number" || isNaN(d20Result)) {
        throw new PhysicalRollCancelledError();
      }

      // Populate d20 term results
      const resultCount = Math.max(1, count);
      d20Term.results = Array.from({ length: resultCount }, () => ({ result: d20Result, active: true }));
      d20Term._isPhysicalIntercepted = true;
      roll._isPhysicalIntercepted = true;

      // Delegate entirely to native PF2e / Foundry evaluate
      await evaluateFn.call(roll, { ...options, allowInteractive: false });
      return true;
    } finally {
      this.isPrompting = false;
      roll._isPhysicalPrompting = false;
    }
  }
}

/**
 * Monkey-patches Roll prototypes across Foundry and PF2e to route
 * evaluations through PhysicalDiceManager when physical mode is active.
 */
export function setupPhysicalDiceInterceptor() {
  const rollClasses = new Set([
    globalThis.Roll,
    CONFIG.Dice?.rolls?.find(r => r.name === "DamageRoll"),
    CONFIG.Dice?.rolls?.find(r => r.name === "CheckRoll"),
    CONFIG.PF2E?.Dice?.DamageRoll,
    CONFIG.PF2E?.Dice?.CheckRoll,
    game.pf2e?.DamageRoll,
    game.pf2e?.CheckRoll
  ].filter(Boolean));

  for (const RollCls of rollClasses) {
    if (!RollCls?.prototype) continue;
    const isRootRoll = RollCls === globalThis.Roll;
    const hasOwnEvaluate = Object.prototype.hasOwnProperty.call(RollCls.prototype, "evaluate");

    if ((isRootRoll || hasOwnEvaluate) && !RollCls.prototype.hasOwnProperty("_physicalDicePatched")) {
      const origEvaluate = RollCls.prototype.evaluate;
      RollCls.prototype.evaluate = async function (options = {}) {
        if (this._evaluated || this._isPhysicalCancelled) return this;
        if (PhysicalDiceManager.shouldIntercept(this)) {
          try {
            const handled = await PhysicalDiceManager.interceptRoll(this, options, origEvaluate);
            if (handled) return this;
          } catch (err) {
            if (err?.isPhysicalRollCancelled) {
              console.log("Physical Dice | Roll cancelled by user.");
              this._isPhysicalCancelled = true;
              if (Array.isArray(this.instances)) {
                for (const inst of this.instances) {
                  inst._isPhysicalCancelled = true;
                }
              }
              ui.notifications?.info(game.i18n?.localize("PHYSICAL_DICE.RollCancelled") || "Roll cancelled.");
              throw err;
            }
            throw err;
          }
        }
        return origEvaluate.call(this, options);
      };
      Object.defineProperty(RollCls.prototype, "_physicalDicePatched", {
        value: true,
        writable: false,
        configurable: true
      });
    }
  }

  // Intercept Roll.prototype.toMessage to suppress chat output for cancelled rolls
  if (globalThis.Roll?.prototype && !globalThis.Roll.prototype.hasOwnProperty("_physicalToMessagePatched")) {
    const origToMessage = globalThis.Roll.prototype.toMessage;
    globalThis.Roll.prototype.toMessage = async function (messageData = {}, options = {}) {
      if (this._isPhysicalCancelled) {
        console.log("Physical Dice | Suppressing toMessage for cancelled physical roll.");
        return null;
      }
      return origToMessage.call(this, messageData, options);
    };
    Object.defineProperty(globalThis.Roll.prototype, "_physicalToMessagePatched", {
      value: true,
      writable: false,
      configurable: true
    });
  }

  // Intercept ChatLog.prototype.processMessage to cleanly abort chat slash commands (/r 1d20) when cancelled
  if (globalThis.ChatLog?.prototype && !globalThis.ChatLog.prototype.hasOwnProperty("_physicalChatLogPatched")) {
    const origProcessMessage = globalThis.ChatLog.prototype.processMessage;
    globalThis.ChatLog.prototype.processMessage = async function (message, options = {}) {
      try {
        return await origProcessMessage.call(this, message, options);
      } catch (err) {
        if (err?.isPhysicalRollCancelled) {
          return null;
        }
        throw err;
      }
    };
    Object.defineProperty(globalThis.ChatLog.prototype, "_physicalChatLogPatched", {
      value: true,
      writable: false,
      configurable: true
    });
  }

  console.log("Physical Dice | Roll evaluation interceptor active.");
}
