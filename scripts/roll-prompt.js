/**
 * Physical Dice - Unified Roll Prompt
 * Consolidates modal popup dialog (ApplicationV2) and in-chat card prompts
 * into a single unified prompt architecture with shared evaluation and stepper logic.
 */

import { PhysicalRollCancelledError } from "./rolls/physical-dice-interceptor.js";
import { MODULE_ID, getEntryMethod, getCleanupMode, canGmOverride } from "./settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * ApplicationV2 modal dialog for physical dice entry.
 */
class RollPromptDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "physical-dice-dialog",
    tag: "div",
    classes: ["physical-dice-app", "physical-dice-dialog-app"],
    window: {
      title: "Physical Dice Entry",
      resizable: false,
      controls: []
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      cancel: RollPromptDialog._onCancel,
      submit: RollPromptDialog._onSubmit,
      step: RollPromptDialog._onStep,
      "pool-step": RollPromptDialog._onPoolStep,
      preset: RollPromptDialog._onPreset
    }
  };

  static PARTS = {
    content: {
      template: "modules/physical-dice/templates/physical-dice-dialog.hbs"
    }
  };

  /** @type {RollPromptDialog|null} */
  static activeApp = null;

  constructor(params, options = {}) {
    super(options);
    this._mode = params.mode;
    this._title = params.title;
    this._subtitle = params.subtitle ?? "";
    this._target = params.target ?? null;
    this._modifier = params.modifier ?? 0;
    this._faces = params.faces ?? 20;
    this._count = params.count ?? 1;
    this._isFortune = !!params.isFortune;
    this._isMisfortune = !!params.isMisfortune;
    this._pools = params.pools ?? [];
    this._resolve = params.resolve;
    this._reject = params.reject;
    this._settled = false;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isCheck = this._mode === "check";
    context.title = this._title;
    context.subtitle = this._subtitle;
    context.target = this._target;
    context.modifier = this._modifier;
    context.pools = this._pools;
    context.faces = this._faces;
    context.count = this._count;
    context.isFortune = this._isFortune;
    context.isMisfortune = this._isMisfortune;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    const errorEl = this.element?.querySelector(".physical-error-msg");
    const clearError = () => {
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      }
    };

    // Auto-focus and select first input field
    const firstInput = this.element?.querySelector("input[type='number']");
    if (firstInput) {
      setTimeout(() => {
        try {
          firstInput.focus();
          firstInput.select();
        } catch {}
      }, 50);
    }

    // Clear error message in real-time on input
    const inputs = this.element?.querySelectorAll("input[type='number']");
    for (const input of inputs ?? []) {
      input.addEventListener("input", clearError);
    }

    // Enter key submits form
    const form = this.element?.querySelector("form.physical-roll-form");
    if (form && !form._enterListenerBound) {
      form.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          RollPromptDialog._onSubmit.call(this, event, form);
        }
      });
      form._enterListenerBound = true;
    }
  }

  /** @override */
  _onClose(options) {
    if (RollPromptDialog.activeApp === this) {
      RollPromptDialog.activeApp = null;
    }
    if (!this._settled) {
      this._settled = true;
      this._reject?.(new PhysicalRollCancelledError("Physical roll cancelled by user."));
    }
    super._onClose(options);
  }

  /**
   * Adjusts the d20 check die value by the step amount (-1 or +1).
   */
  static _onStep(event, target) {
    event.preventDefault();
    const step = parseInt(target.dataset.step, 10) || 1;
    const input = this.element?.querySelector("input[name='d20-val']");
    if (!input) return;

    input.value = RollPrompt.stepValue(input.value, step, 1, this._faces || 20);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  /**
   * Adjusts a specific damage pool's value by the step amount (-1 or +1).
   */
  static _onPoolStep(event, target) {
    event.preventDefault();
    const step = parseInt(target.dataset.step, 10) || 1;
    const poolId = target.dataset.poolId;
    const input = this.element?.querySelector(`input[data-pool-id='${poolId}']`);
    if (!input) return;

    const min = parseInt(input.dataset.min ?? input.min, 10) || 1;
    const max = parseInt(input.dataset.max ?? input.max, 10) || 100;
    input.value = RollPrompt.stepValue(input.value, step, min, max);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  /**
   * Sets the check die to a preset value (e.g. Nat 1, Nat 20).
   */
  static _onPreset(event, target) {
    event.preventDefault();
    const val = target.dataset.val;
    const input = this.element?.querySelector("input[name='d20-val']");
    if (input && val) {
      input.value = val;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }

  /**
   * User cancels the dialog.
   */
  static _onCancel(event, target) {
    if (!this._settled) {
      this._settled = true;
      this._reject?.(new PhysicalRollCancelledError("Physical roll cancelled by user."));
    }
    this.close();
  }

  /**
   * User submits the dialog.
   */
  static _onSubmit(event, target) {
    const errorEl = this.element?.querySelector(".physical-error-msg");
    const showError = (msg) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove("hidden");
      } else {
        ui.notifications?.warn?.(msg);
      }
    };

    if (this._mode === "check") {
      const input = this.element?.querySelector("input[name='d20-val']");
      const outcome = RollPrompt.evaluateCheckSubmission(input?.value, this._faces || 20);

      if (outcome.error) {
        showError(outcome.error);
        input?.focus();
        return;
      }

      this._settled = true;
      this._resolve?.(outcome.automated ? { automated: true } : outcome.value);
      this.close();
      return;
    }

    // Damage Mode
    const inputsMap = {};
    for (const pool of this._pools) {
      const input = this.element?.querySelector(`input[data-pool-id='${pool.id}']`);
      inputsMap[pool.id] = input?.value ?? "";
    }

    const outcome = RollPrompt.evaluateDamageSubmission(inputsMap, this._pools);
    if (outcome.error) {
      showError(outcome.error);
      const errPoolId = outcome.errorPoolId;
      if (errPoolId) {
        this.element?.querySelector(`input[data-pool-id='${errPoolId}']`)?.focus();
      }
      return;
    }

    this._settled = true;
    this._resolve?.(outcome.automated ? { automated: true } : outcome.results);
    this.close();
  }
}

/**
 * @typedef {object} PendingChatRoll
 * @property {string} id Unique identifier for the roll prompt
 * @property {Function} resolve Callback invoked when the user confirms the roll
 * @property {Function} reject Callback invoked when the user cancels the roll
 * @property {object} roll The Foundry Roll instance
 * @property {"check"|"damage"} mode Roll prompt mode
 * @property {object} params Original parameters passed to the prompt
 * @property {object} message The ChatMessage document displaying the pending card
 * @property {number} createdAt Creation timestamp in milliseconds
 */

/**
 * Unified Roll Prompt Manager.
 * Orchestrates physical dice roll entry through either popup dialog or chat log cards.
 */
export class RollPrompt {
  /**
   * Active pending rolls in chat, keyed by ChatMessage ID.
   * @type {Map<string, PendingChatRoll>}
   */
  static pendingChatRolls = new Map();

  /* -------------------------------------------------------------
     Shared Calculation & Evaluation Utilities
  ------------------------------------------------------------- */

  /**
   * Steps an integer value within min and max bounds.
   * @param {string|number} currentVal
   * @param {number} step
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static stepValue(currentVal, step, min, max) {
    const rawStr = String(currentVal ?? "").trim();
    let num = parseInt(rawStr, 10);
    if (isNaN(num)) {
      return step > 0 ? min : max;
    }
    return Math.min(Math.max(num + step, min), max);
  }

  /**
   * Evaluates check die input.
   * Returns { automated: true }, { value: number }, or { error: string }.
   * @param {string} rawVal
   * @param {number} faces
   * @returns {{ automated?: boolean, value?: number, error?: string }}
   */
  static evaluateCheckSubmission(rawVal, faces = 20) {
    const trimmed = (rawVal ?? "").trim();
    if (trimmed === "") {
      return { automated: true };
    }
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 1 || val > faces) {
      return { error: `Please enter a valid roll between 1 and ${faces}.` };
    }
    return { value: val };
  }

  /**
   * Evaluates damage pool inputs.
   * Returns { automated: true }, { results: Record<string, number> }, or { error: string, errorPoolId?: string }.
   * @param {Record<string, string>} inputsMap
   * @param {Array<object>} pools
   * @returns {{ automated?: boolean, results?: Record<string, number>, error?: string, errorPoolId?: string }}
   */
  static evaluateDamageSubmission(inputsMap, pools) {
    const allEmpty = pools.every(p => (inputsMap[p.id] ?? "").trim() === "");
    if (allEmpty) {
      return { automated: true };
    }

    const results = {};
    for (const pool of pools) {
      const rawVal = (inputsMap[pool.id] ?? "").trim();
      if (rawVal === "") continue;

      const val = parseInt(rawVal, 10);
      if (isNaN(val) || val < pool.min || val > pool.max) {
        return {
          error: `Please enter a valid total between ${pool.min} and ${pool.max} for ${pool.typeLabel} (${pool.formula}).`,
          errorPoolId: pool.id
        };
      }
      results[pool.id] = val;
    }

    return { results };
  }

  /* -------------------------------------------------------------
     Unified Prompt Dispatchers
  ------------------------------------------------------------- */

  /**
   * Prompts user for a physical check outcome (d20).
   * Automatically branches between Popup Dialog and Chat Log based on entryMethod setting.
   * @param {object} params
   * @returns {Promise<number|object>}
   */
  static async promptCheck(params) {
    const isDialog = getEntryMethod() === "dialog";

    if (isDialog) {
      return this._promptDialogCheck(params);
    } else {
      return this._promptChatCheck(params);
    }
  }

  /**
   * Prompts user for physical damage dice totals across damage pools.
   * Automatically branches between Popup Dialog and Chat Log based on entryMethod setting.
   * @param {object} params
   * @returns {Promise<Record<string, number>|object>}
   */
  static async promptDamage(params) {
    const isDialog = getEntryMethod() === "dialog";

    if (isDialog) {
      return this._promptDialogDamage(params);
    } else {
      return this._promptChatDamage(params);
    }
  }

  /* -------------------------------------------------------------
     Dialog Mode Internal Handlers
  ------------------------------------------------------------- */

  static _promptDialogCheck(params) {
    if (RollPromptDialog.activeApp) {
      try {
        RollPromptDialog.activeApp.close();
      } catch {}
    }

    return new Promise((resolve, reject) => {
      const app = new RollPromptDialog({
        mode: "check",
        ...params,
        resolve: (val) => {
          if (RollPromptDialog.activeApp === app) RollPromptDialog.activeApp = null;
          resolve(val);
        },
        reject: (err) => {
          if (RollPromptDialog.activeApp === app) RollPromptDialog.activeApp = null;
          reject(err);
        }
      });
      RollPromptDialog.activeApp = app;
      app.render({ force: true });
    });
  }

  static _promptDialogDamage(params) {
    if (RollPromptDialog.activeApp) {
      try {
        RollPromptDialog.activeApp.close();
      } catch {}
    }

    return new Promise((resolve, reject) => {
      const app = new RollPromptDialog({
        mode: "damage",
        ...params,
        resolve: (val) => {
          if (RollPromptDialog.activeApp === app) RollPromptDialog.activeApp = null;
          resolve(val);
        },
        reject: (err) => {
          if (RollPromptDialog.activeApp === app) RollPromptDialog.activeApp = null;
          reject(err);
        }
      });
      RollPromptDialog.activeApp = app;
      app.render({ force: true });
    });
  }

  /* -------------------------------------------------------------
     Chat Mode Internal Handlers & Lifecycle
  ------------------------------------------------------------- */

  static getWhisperRecipients(options = {}) {
    const rollMode = options.rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll";
    if (rollMode === "gmroll" || rollMode === "blindroll") {
      return ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    }
    if (rollMode === "selfroll") {
      return [game.user.id];
    }
    return [];
  }

  static isBlindRoll(options = {}) {
    const rollMode = options.rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll";
    return rollMode === "blindroll";
  }

  static async _promptChatCheck(params) {
    const title = params.title || "Check Roll";
    const subtitle = params.subtitle || "";
    const faces = params.faces || 20;
    const count = params.count || 1;
    const isFortune = !!params.isFortune;
    const isMisfortune = !!params.isMisfortune;
    const target = params.target || null;
    const actor = params.actor || null;
    const rollerName = game.user.name || "Player";

    const context = {
      isCheck: true,
      mode: "check",
      title,
      subtitle,
      target,
      faces,
      count,
      isFortune,
      isMisfortune,
      rollerName
    };

    const content = await renderTemplate("modules/physical-dice/templates/chat-pending-roll.hbs", context);

    const messageData = {
      user: game.user.id,
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
      content,
      whisper: this.getWhisperRecipients(params.roll?.options),
      blind: this.isBlindRoll(params.roll?.options),
      flags: {
        [MODULE_ID]: {
          isPending: true,
          mode: "check",
          title,
          faces,
          count,
          createdAt: Date.now()
        }
      }
    };

    const message = await ChatMessage.create(messageData);
    if (params.roll) {
      params.roll._physicalPendingMessageId = message.id;
    }

    return new Promise((resolve, reject) => {
      this.pendingChatRolls.set(message.id, {
        id: message.id,
        resolve,
        reject,
        roll: params.roll,
        mode: "check",
        params,
        message,
        createdAt: Date.now()
      });
    });
  }

  static async _promptChatDamage(params) {
    const title = params.title || "Damage Roll";
    const subtitle = params.subtitle || "";
    const pools = params.pools || [];
    const target = params.target || null;
    const actor = params.actor || null;
    const rollerName = game.user.name || "Player";

    const context = {
      isCheck: false,
      mode: "damage",
      title,
      subtitle,
      target,
      pools,
      rollerName
    };

    const content = await renderTemplate("modules/physical-dice/templates/chat-pending-roll.hbs", context);

    const messageData = {
      user: game.user.id,
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
      content,
      whisper: this.getWhisperRecipients(params.roll?.options),
      blind: this.isBlindRoll(params.roll?.options),
      flags: {
        [MODULE_ID]: {
          isPending: true,
          mode: "damage",
          title,
          createdAt: Date.now()
        }
      }
    };

    const message = await ChatMessage.create(messageData);
    if (params.roll) {
      params.roll._physicalPendingMessageId = message.id;
    }

    return new Promise((resolve, reject) => {
      this.pendingChatRolls.set(message.id, {
        id: message.id,
        resolve,
        reject,
        roll: params.roll,
        mode: "damage",
        params,
        message,
        createdAt: Date.now()
      });
    });
  }

  /**
   * Handles renderChatMessage hook to bind touch/click events to pending cards in chat log.
   */
  static onRenderChatMessage(message, html, data) {
    const flags = message.flags?.[MODULE_ID];
    if (!flags?.isPending) return;

    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const card = root.querySelector(".physical-dice-pending-card");
    if (!card) return;

    const isAuthor = (message.author?.id ?? message.user?.id) === game.user.id;
    const isAuthorized = isAuthor || (game.user.isGM && canGmOverride());

    const waitingEl = card.querySelector(".physical-waiting-message");
    const actionsEl = card.querySelector(".physical-card-actions");
    const inputs = card.querySelectorAll("input.physical-number-input");
    const steppers = card.querySelectorAll(".btn-stepper");
    const quickPresets = card.querySelectorAll(".btn-quick-preset");
    const errorBanner = card.querySelector(".physical-error-banner");

    if (!isAuthorized) {
      if (waitingEl) waitingEl.classList.remove("hidden");
      if (actionsEl) actionsEl.style.display = "none";
      for (const input of inputs) input.disabled = true;
      for (const btn of steppers) btn.disabled = true;
      for (const btn of quickPresets) btn.disabled = true;
      return;
    }

    if (waitingEl) waitingEl.classList.add("hidden");
    if (actionsEl) actionsEl.style.display = "";

    const entry = this.pendingChatRolls.get(message.id);
    if (!entry) {
      card.classList.add("physical-settled");
      const submitBtn = card.querySelector(".btn-submit");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const showError = (msg) => {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.classList.remove("hidden");
      }
    };
    const clearError = () => {
      if (errorBanner) {
        errorBanner.textContent = "";
        errorBanner.classList.add("hidden");
      }
    };

    const firstInput = inputs[0];
    if (firstInput && !firstInput._focused) {
      firstInput._focused = true;
      setTimeout(() => {
        try {
          firstInput.focus();
          firstInput.select();
        } catch {}
      }, 50);
    }

    for (const input of inputs) {
      input.addEventListener("input", clearError);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this._submitChatRoll(message.id, card);
        }
      });
    }

    for (const btn of steppers) {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const step = parseInt(btn.dataset.step, 10) || 1;
        const poolId = btn.dataset.poolId;

        const targetInput = poolId
          ? card.querySelector(`input[data-pool-id="${poolId}"]`)
          : card.querySelector("input[name='check-val']");

        if (!targetInput) return;

        const min = parseInt(targetInput.dataset.min ?? targetInput.min, 10) || 1;
        const max = parseInt(targetInput.dataset.max ?? targetInput.max, 10) || 20;
        targetInput.value = RollPrompt.stepValue(targetInput.value, step, min, max);
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        targetInput.focus();
      });
    }

    for (const btn of quickPresets) {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const val = btn.dataset.val;
        if (firstInput && val) {
          firstInput.value = val;
          firstInput.dispatchEvent(new Event("input", { bubbles: true }));
          firstInput.focus();
        }
      });
    }

    const submitBtn = card.querySelector(".btn-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", (event) => {
        event.preventDefault();
        this._submitChatRoll(message.id, card);
      });
    }

    const cancelBtn = card.querySelector(".btn-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        await this._cancelChatRoll(message.id);
      });
    }
  }

  static async _submitChatRoll(messageId, card) {
    const entry = this.pendingChatRolls.get(messageId);
    if (!entry) return;

    const errorBanner = card.querySelector(".physical-error-banner");
    const showError = (msg) => {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.classList.remove("hidden");
      } else {
        ui.notifications?.warn?.(msg);
      }
    };

    if (entry.mode === "check") {
      const input = card.querySelector("input[name='check-val']");
      const outcome = RollPrompt.evaluateCheckSubmission(input?.value, entry.params?.faces || 20);

      if (outcome.error) {
        showError(outcome.error);
        input?.focus();
        return;
      }

      this.pendingChatRolls.delete(messageId);
      entry.resolve(outcome.automated ? { automated: true } : outcome.value);
      this._markCardSubmitting(card);
      return;
    }

    // Damage Mode
    const pools = entry.params?.pools || [];
    const inputsMap = {};
    for (const pool of pools) {
      const input = card.querySelector(`input[data-pool-id="${pool.id}"]`);
      inputsMap[pool.id] = input?.value ?? "";
    }

    const outcome = RollPrompt.evaluateDamageSubmission(inputsMap, pools);
    if (outcome.error) {
      showError(outcome.error);
      const errPoolId = outcome.errorPoolId;
      if (errPoolId) {
        card.querySelector(`input[data-pool-id="${errPoolId}"]`)?.focus();
      }
      return;
    }

    this.pendingChatRolls.delete(messageId);
    entry.resolve(outcome.automated ? { automated: true } : outcome.results);
    this._markCardSubmitting(card);
  }

  static _markCardSubmitting(card) {
    card.classList.add("physical-submitting");
    const buttons = card.querySelectorAll("button, input");
    for (const b of buttons) b.disabled = true;
  }

  static async _cancelChatRoll(messageId) {
    const entry = this.pendingChatRolls.get(messageId);
    if (entry) {
      this.pendingChatRolls.delete(messageId);
      entry.reject(new PhysicalRollCancelledError("Physical roll cancelled by user."));
    }
    await this.cleanupPendingMessage(messageId);
  }

  static onPreCreateChatMessage(messageDoc, messageData, options, userId) {
    const rolls = messageDoc.rolls ?? [];
    for (const roll of rolls) {
      const pendingId = roll._physicalPendingMessageId;
      if (pendingId) {
        this.cleanupPendingMessage(pendingId);
      }
    }
  }

  static async cleanupPendingMessage(messageId) {
    this.pendingChatRolls.delete(messageId);
    const message = game.messages?.get(messageId);
    if (!message) return;

    const cleanupMode = getCleanupMode();
    if (cleanupMode === "delete") {
      try {
        if (message.canUserModify(game.user, "delete")) {
          await message.delete();
          return;
        }
      } catch (err) {
        console.warn("Physical Dice | Error deleting pending message:", err);
      }
    }

    try {
      if (message.isOwner || game.user.isGM) {
        await message.update({
          [`flags.${MODULE_ID}.isPending`]: false,
          [`flags.${MODULE_ID}.isCompleted`]: true
        });
      }
    } catch {}
  }
}
