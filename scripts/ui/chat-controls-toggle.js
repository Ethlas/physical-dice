import { getStoredRollMode, setStoredRollMode, isModuleEnabled } from "../settings.js";

/**
 * Injects and manages the Physical / Digital dice toggle button in Foundry's Chat Controls
 * (directly alongside the native roll mode dropdown for Public, Private GM, Blind GM, Self Roll),
 * using the design and badge styling established by Vincent Zorge in pf2e-mobile-compact.
 */
export class ChatControlsToggle {
  static _observer = null;

  /**
   * Injects the toggle button into the ChatLog controls area.
   * @param {Application} [app] ChatLog application
   * @param {HTMLElement|jQuery} [html] ChatLog DOM
   */
  static inject(app, html) {
    if (!isModuleEnabled()) return;

    let root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) {
      root = document.getElementById("chat") ?? document.body;
    }
    if (!root) return;

    // Locate the chat controls container where roll types are located
    const controls = root.querySelector("#chat-controls, .chat-controls")
      ?? document.getElementById("chat-controls")
      ?? document.querySelector(".chat-controls");

    if (!controls) return;

    // If button already exists in this controls container, just update its state
    let btn = controls.querySelector(".physical-dice-toggle-btn");
    if (btn) {
      this.updateButtonState(btn);
      return;
    }

    const mode = getStoredRollMode();
    const isPhysical = mode === "physical";

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "physical-dice-toggle-btn";
    btn.setAttribute("data-action", "togglePhysicalDice");
    btn.setAttribute("aria-label", "Toggle Physical Dice Mode");

    this.renderButtonContent(btn, isPhysical);

    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentMode = getStoredRollMode();
      const newMode = currentMode === "physical" ? "digital" : "physical";
      await setStoredRollMode(newMode);

      this.updateAllButtons();

      const msg = newMode === "physical"
        ? "Physical Dice mode: manual table rolls active"
        : "Digital Dice mode: automated rolls active";
      ui.notifications?.info?.(msg);
    });

    // Place directly adjacent to the rollMode select (Private, GM, Blind, Self)
    const rollModeSelect = controls.querySelector("select[name='rollMode'], .roll-type-select");
    if (rollModeSelect) {
      rollModeSelect.insertAdjacentElement("afterend", btn);
    } else {
      controls.appendChild(btn);
    }
  }

  /**
   * Renders the button inner icons (dice with corner hand/chip badge) and tooltip.
   * @param {HTMLElement} btn
   * @param {boolean} isPhysical
   */
  static renderButtonContent(btn, isPhysical) {
    btn.title = isPhysical
      ? "Manual dice: you roll and enter the result (click for digital)"
      : "Digital dice: automated rolls (click for manual)";

    btn.innerHTML = `
      <i class="fas fa-dice"></i>
      <span class="header-btn-badge">
        <i class="fas ${isPhysical ? "fa-hand" : "fa-microchip"}"></i>
      </span>
    `;
  }

  /**
   * Updates visual state of a toggle button according to current roll mode.
   * @param {HTMLElement} btn
   */
  static updateButtonState(btn) {
    if (!btn) return;
    const mode = getStoredRollMode();
    const isPhysical = mode === "physical";
    this.renderButtonContent(btn, isPhysical);
  }

  /**
   * Updates all toggle buttons in the DOM (chat log, popouts, sheets).
   */
  static updateAllButtons() {
    const buttons = document.querySelectorAll(".physical-dice-toggle-btn");
    for (const btn of buttons) {
      this.updateButtonState(btn);
    }
  }

  /**
   * Initializes observer to ensure the toggle button persists across sidebar tab switches
   * or dynamic chat re-renders.
   */
  static setupObserver() {
    if (this._observer || typeof MutationObserver === "undefined") return;

    const target = document.getElementById("sidebar") ?? document.getElementById("chat");
    if (!target) return;

    this._observer = new MutationObserver((mutations) => {
      const controls = document.getElementById("chat-controls") ?? document.querySelector(".chat-controls");
      if (controls && !controls.querySelector(".physical-dice-toggle-btn")) {
        this.inject();
      }
    });

    this._observer.observe(target, { childList: true, subtree: true });
  }
}
