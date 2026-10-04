# Physical Dice Interception & System Integrity Rules

Guidelines for intercepting dice rolls and managing physical dice input in Foundry VTT:

## System Calculations & Integrity
- **Never re-implement system math**: Always delegate modifier calculations, degree of success, and damage application to the active game system (`statistic.roll`, `DamageRoll`, `CheckRoll`).
- Maintain valid `Roll` instances: Partition user-entered totals across underlying dice terms so that Foundry's roll evaluation lifecycle remains structurally complete.
- Let the system render its official chat cards and message attachments.

## Dialog & User Experience Lifecycle
- Ensure all dialogs and modals close cleanly without dangling event listeners or unhandled promise rejections.
- Gracefully handle user cancellation (e.g. throwing a dedicated `PhysicalRollCancelledError` or returning early) without emitting empty or broken chat messages.
- Provide auto-focus on input fields for fast keypad entry during physical table sessions.
