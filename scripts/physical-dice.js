/**
 * Physical Dice - Core Module Script
 * Seamless manual dice roll entry directly in the Foundry VTT Chat Log.
 */

import { registerSettings } from "./settings.js";
import { setupPhysicalDiceInterceptor, PhysicalDiceManager, PhysicalRollCancelledError } from "./rolls/physical-dice-interceptor.js";
import { RollPrompt } from "./roll-prompt.js";
import { ChatControlsToggle } from "./ui/chat-controls-toggle.js";

Hooks.once("init", async function () {
  console.log("Physical Dice | Initializing Physical Dice module");

  // Register settings
  registerSettings();

  // Preload Handlebars templates
  await loadTemplates([
    "modules/physical-dice/templates/chat-pending-roll.hbs",
    "modules/physical-dice/templates/physical-dice-dialog.hbs"
  ]);

  // Expose public API for external modules / macros (like pf2e-mobile-compact)
  const module = game.modules.get("physical-dice");
  if (module) {
    module.api = {
      PhysicalDiceManager,
      RollPrompt,
      PhysicalRollCancelledError,
      ChatControlsToggle
    };
  }
});


Hooks.once("ready", function () {
  console.log("Physical Dice | Activating physical dice roll interceptor");
  setupPhysicalDiceInterceptor();

  // Inject toggle button into chat controls and setup DOM persistence observer
  ChatControlsToggle.inject();
  ChatControlsToggle.setupObserver();

  // Suppress unhandled promise rejection warnings when physical rolls are aborted by the user
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.isPhysicalRollCancelled) {
      event.preventDefault();
    }
  });
});

// Bind interactive UI listeners to pending physical roll cards in chat
Hooks.on("renderChatMessage", (message, html, data) => {
  RollPrompt.onRenderChatMessage(message, html, data);
});

// Clean up pending prompt card when the evaluated roll message is created, and suppress cancelled rolls
Hooks.on("preCreateChatMessage", (messageDoc, messageData, options, userId) => {
  const rolls = messageDoc.rolls ?? [];
  if (rolls.some(r => r._isPhysicalCancelled)) {
    return false;
  }
  RollPrompt.onPreCreateChatMessage(messageDoc, messageData, options, userId);
});

// Inject physical/digital toggle into chat controls whenever ChatLog renders
Hooks.on("renderChatLog", (app, html, data) => {
  ChatControlsToggle.inject(app, html);
});

// Inject toggle button when switching sidebar tabs to chat
Hooks.on("changeSidebarTab", (tab) => {
  if (tab?.id === "chat" || tab === "chat") {
    ChatControlsToggle.inject();
  }
});

// Synchronize toggle buttons across all instances when roll mode changes
Hooks.on("physicalDiceRollModeChanged", () => {
  ChatControlsToggle.updateAllButtons();
});
