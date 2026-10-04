/**
 * Physical Dice - Settings & Configuration
 * Manages module settings, roll modes, and client preferences.
 */

export const MODULE_ID = "physical-dice";

/**
 * Registers all module settings with Foundry VTT.
 */
export function registerSettings() {
  // Master module enable switch
  game.settings.register(MODULE_ID, "enabled", {
    name: "PHYSICAL_DICE.Settings.Enabled.Name",
    hint: "PHYSICAL_DICE.Settings.Enabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      Hooks.callAll("physicalDiceSettingsChanged");
    }
  });

  // Roll Mode: Physical vs Digital
  game.settings.register(MODULE_ID, "rollMode", {
    name: "PHYSICAL_DICE.Settings.RollMode.Name",
    hint: "PHYSICAL_DICE.Settings.RollMode.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      physical: "PHYSICAL_DICE.Settings.RollMode.Physical",
      digital: "PHYSICAL_DICE.Settings.RollMode.Digital"
    },
    default: "physical",
    onChange: (value) => {
      Hooks.callAll("physicalDiceRollModeChanged", value);
    }
  });

  // Cleanup Mode: Delete vs Minimize completed pending roll cards
  game.settings.register(MODULE_ID, "cleanupMode", {
    name: "PHYSICAL_DICE.Settings.CleanupMode.Name",
    hint: "PHYSICAL_DICE.Settings.CleanupMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      delete: "PHYSICAL_DICE.Settings.CleanupMode.Delete",
      minimize: "PHYSICAL_DICE.Settings.CleanupMode.Minimize"
    },
    default: "delete"
  });

  // Allow GM to enter physical dice results on behalf of players
  game.settings.register(MODULE_ID, "allowGmOverride", {
    name: "PHYSICAL_DICE.Settings.AllowGmOverride.Name",
    hint: "PHYSICAL_DICE.Settings.AllowGmOverride.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Entry Method: Popup Dialog vs In Chat
  game.settings.register(MODULE_ID, "entryMethod", {
    name: "PHYSICAL_DICE.Settings.EntryMethod.Name",
    hint: "PHYSICAL_DICE.Settings.EntryMethod.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      dialog: "PHYSICAL_DICE.Settings.EntryMethod.Dialog",
      chat: "PHYSICAL_DICE.Settings.EntryMethod.Chat"
    },
    default: "dialog"
  });

  console.log("Physical Dice | Settings registered successfully.");
}

/**
 * Checks whether Physical Dice module is globally enabled.
 * @returns {boolean}
 */
export function isModuleEnabled() {
  try {
    return game.settings.get(MODULE_ID, "enabled");
  } catch {
    return true;
  }
}

/**
 * Gets the current roll mode ("physical" or "digital").
 * Checks this module's setting first, falling back to pf2e-mobile-compact if active.
 * @returns {"physical" | "digital"}
 */
export function getStoredRollMode() {
  if (!isModuleEnabled()) return "digital";

  try {
    if (game.settings.settings.has(`${MODULE_ID}.rollMode`)) {
      return game.settings.get(MODULE_ID, "rollMode");
    }
  } catch {}

  // Fallback / sync with pf2e-mobile-compact if installed
  try {
    if (game.settings.settings.has("pf2e-mobile-compact.rollMode")) {
      return game.settings.get("pf2e-mobile-compact", "rollMode") === "physical" ? "physical" : "digital";
    }
  } catch {}

  return "physical";
}

/**
 * Sets the current roll mode and persists to settings.
 * @param {"physical" | "digital"} mode
 * @returns {Promise<void>}
 */
export async function setStoredRollMode(mode) {
  try {
    if (game.settings.settings.has(`${MODULE_ID}.rollMode`)) {
      await game.settings.set(MODULE_ID, "rollMode", mode);
    }
  } catch {}

  // Keep pf2e-mobile-compact in sync if installed
  try {
    if (game.settings.settings.has("pf2e-mobile-compact.rollMode")) {
      await game.settings.set("pf2e-mobile-compact", "rollMode", mode);
    }
  } catch {}
}

/**
 * Returns the card cleanup mode ("delete" or "minimize").
 * @returns {"delete" | "minimize"}
 */
export function getCleanupMode() {
  try {
    return game.settings.get(MODULE_ID, "cleanupMode");
  } catch {
    return "delete";
  }
}

/**
 * Checks if GM override is permitted.
 * @returns {boolean}
 */
export function canGmOverride() {
  try {
    return game.settings.get(MODULE_ID, "allowGmOverride");
  } catch {
    return true;
  }
}

/**
 * Returns the prompt entry method ("dialog" or "chat").
 * @returns {"dialog" | "chat"}
 */
export function getEntryMethod() {
  try {
    return game.settings.get(MODULE_ID, "entryMethod");
  } catch {
    return "dialog";
  }
}

