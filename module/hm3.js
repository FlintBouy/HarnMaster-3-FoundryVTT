// Import Modules
import { HarnMasterActor } from "./actor/actor.js";
import { HarnMasterCharacterSheet } from "./actor/character-sheet.js";
import { HarnMasterCreatureSheet } from "./actor/creature-sheet.js"
import { HarnMasterContainerSheet } from "./actor/container-sheet.js"
import { HarnMasterCombat } from "./hm3-combat.js";
import { HarnMasterItem } from "./item/item.js";
import { HarnMasterItemSheet } from "./item/item-sheet.js";
import { HM3ActiveEffectConfig } from "./hm3-active-effect-config.js";
import { HM3 } from "./config.js";
import { registerSystemSettings } from "./settings.js";
import * as migrations from "./migrations.js";
import * as macros from "./macros.js";
import * as combat from "./combat.js";
import * as effect from "./effect.js";
import { DiceHM3 } from "./dice-hm3.js";

Hooks.once('init', async function () {

    console.log(`HM3 | Initializing the HM3 Game System\n${HM3.ASCII}`);

    game.hm3 = {
        HarnMasterActor,
        HarnMasterItem,
        DiceHM3,
        config: HM3,
        macros: macros,
        migrations: migrations
    };

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "@initiative",
        decimals: 2
    };

    // Set Combat Time Length
    CONFIG.time.roundTime = 10;
    CONFIG.time.turnTime = 0;

    // Set System Globals
    CONFIG.HM3 = HM3;

    // Register system settings
    registerSystemSettings();

    // Define custom ActiveEffect class
    CONFIG.ActiveEffect.sheetClass = HM3ActiveEffectConfig;

    // Define custom Entity classes
    CONFIG.Actor.documentClass = HarnMasterActor;
    CONFIG.Item.documentClass = HarnMasterItem;
    CONFIG.Combat.documentClass = HarnMasterCombat;
    CONFIG.TinyMCE.style_formats[0].items.push({
        title: 'Highlight',
        block: 'section',
        classes: 'highlight',
        wrapper: true
    })

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("hm3", HarnMasterCharacterSheet, {
        types: ["character"],
        makeDefault: true,
        label: "Default HarnMaster Character Sheet"
    });
    Actors.registerSheet("hm3", HarnMasterCreatureSheet, {
        types: ["creature"],
        makeDefault: true,
        label: "Default HarnMaster Creature Sheet"
    });
    Actors.registerSheet("hm3", HarnMasterContainerSheet, {
        types: ["container"],
        makeDefault: true,
        label: "Default HarnMaster Container Sheet"
    });

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("hm3", HarnMasterItemSheet, { makeDefault: true });

    // If you need to add Handlebars helpers, here are a few useful examples:
    Handlebars.registerHelper('concat', function () {
        var outStr = '';
        for (var arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });

    Handlebars.registerHelper('toLowerCase', function (str) {
        return str.toLowerCase();
    });
});

Hooks.on("renderChatMessage", (app, html, data) => {
    // Display action buttons
    combat.displayChatActionButtons(app, html, data);
});
Hooks.on('renderChatLog', (app, html, data) => HarnMasterActor.chatListeners(html));
Hooks.on('renderChatPopout', (app, html, data) => HarnMasterActor.chatListeners(html));

/**
 * Active Effects need to expire at certain times, so keep track of that here
 */
Hooks.on('updateWorldTime', async (currentTime, change) => {
    // Disable any expired active effects (WorldTime-based durations).
    await effect.checkExpiredActiveEffects();
});

Hooks.on('updateCombat', async (combat, updateData) => {
    // Called when the combat object is updated.  Possibly because of a change in round
    // or turn. updateData will have specifics of what changed.
    await effect.checkExpiredActiveEffects();
});

/**
 * Once the entire VTT framework is initialized, check to see if
 * we should perform a data migration.
 */
Hooks.once("ready", function () {
    // Determine whether a system migration is required
    const currentVersion = game.settings.get("hm3", "systemMigrationVersion");
    const NEEDS_MIGRATION_VERSION = "1.2.19";  // Anything older than this must be migrated

    let needMigration = currentVersion === null || (isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion));
    if (needMigration && game.user.isGM) {
        migrations.migrateWorld();
    }

    Hooks.on("hotbarDrop", (bar, data, slot) => macros.createHM3Macro(data, slot));
    HM3.ready = true;
    if (game.settings.get("hm3", "showWelcomeDialog")) {
        welcomeDialog().then(showAgain => {
            game.settings.set("hm3", "showWelcomeDialog", showAgain);
        });
    }

    if (!game.user.can("MACRO_SCRIPT")) {
        ui.notifications.warn('You do not have permission to run JavaScript macros, so all skill and esoterics macros have been disabled.');
    }
});

// Since HM3 does not have the concept of rolling for initiative,
// this hook simply prepopulates the initiative value. This ensures
// that no die roll is needed.
Hooks.on('preCreateCombatant', (combat, combatant, options, id) => {
    if (!combatant.initiative) {
        let token = canvas.tokens.get(combatant.tokenId);
        combatant.initiative = token.actor.data.data.initiative;
    }
});

Hooks.on('renderSceneConfig', (app, html, data) => {
    const scene = app.object;
    if (app.renderTOTMScene) return;
    app.renderTOTMScene = true;
    
    let isTotm = scene.getFlag('hm3', 'isTotm');
    if (typeof isTotm === 'undefined') {
        if (scene.compendium === null) {
            scene.setFlag('hm3', 'isTotm', false);
        }
        isTotm = false;
    }

    const totmHtml = `
    <div class="form-group">
        <label>Theatre of the Mind</label>
        <input id="hm3-totm" type="checkbox" name="hm3Totm" data-dtype="Boolean" ${isTotm ? 'checked' : ''}>
        <p class="notes">Configure scene for Theatre of the Mind (e.g., no range calcs).</p>
    </div>
    `;

    const totmFind = html.find("input[name = 'gridAlpha']");
    const formGroup = totmFind.closest(".form-group");
    formGroup.after(totmHtml);
});

Hooks.on('closeSceneConfig', (app, html, data) => {
    const scene = app.object;
    app.renderTOTMScene = false;
    if (scene.compendium === null) {
        scene.setFlag('hm3', 'isTotm', html.find("input[name='hm3Totm']").is(":checked"));
    }
});

async function welcomeDialog() {
    const dlgTemplate = 'systems/hm3/templates/dialog/welcome.html';
    const html = await renderTemplate(dlgTemplate, {});

    // Create the dialog window
    return Dialog.prompt({
        title: 'Welcome!',
        content: html,
        label: 'OK',
        callback: html => {
            const form = html.querySelector("#welcome");
            const fd = new FormDataExtended(form);
            const data = fd.toObject();
            return data.showOnStartup;
        },
        options: { jQuery: false }
    });
}

/*-------------------------------------------------------*/
/*            Handlebars FUNCTIONS                       */
/*-------------------------------------------------------*/
Handlebars.registerHelper("multiply", function (op1, op2) {
    return op1 * op2;
});

Handlebars.registerHelper("endswith", function (op1, op2) {
    return op1.endsWith(op2);
});
