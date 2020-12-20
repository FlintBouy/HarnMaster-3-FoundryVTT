import { HM3 } from './config.js';

/**
 * Determines whether the Skill Base Formula is valid. We perform that
 * validation here so even a skill not associated with a particular
 * actor can have its formula validated.
 * 
 * A valid SB formula looks like this:
 * 
 *   "@str, @int, @sta, hirin:2, ahnu, 5"
 * 
 * meaning
 *   average STR, INT, and STA
 *   add 2 if sunsign hirin (modifier after colon ":")
 *   add 1 if sunsign ahnu (1 since no modifier specified)
 *   add 5 to result
 * 
 * A valid formula must have exactly 3 abilities, everything else is optional.
 * 
 * The result of this function is to set the "isFormulaValid" value appropriately.
 * 
 * @param {Object} item
 */
export function calcSkillBase(item) {
    const sb = item.data.data.skillBase;

    sb.isFormulaValid = true;
    if (sb.formula === '') {
        // If the formula is blank, its valid,
        // don't touch the existing value.
        return;
    }

    let actorData = null;
    if (item.actor) {
        actorData = item.actor.data.data;
    }


    let numAbilities = 0;
    let sumAbilities = 0;
    let ssBonus = 0;
    let modifier = 0;
    let resultSB = 0;

    // All parts of the formula are separated by commas,
    // and we lowercase here since the string is processed
    // case-insensitive.
    const sbParts = sb.formula.toLowerCase().split(',');

    // Formula must have at least three abilities, and therefore
    // we must have at least three parts, otherwise it is invalid
    if (sbParts.length < 3) {
        sb.isFormulaValid = false;
        return;
    }

    sbParts.forEach(param => {
        if (!sb.isFormulaValid) return;

        param = param.trim();
        if (param != '') {
            if (param.startsWith('@')) {
                // This is a reference to an ability

                // Must have more than just the '@' sign
                if (param.length === 1) {
                    sb.isFormulaValid = false;
                    return;
                }

                // There may only be 3 abilities
                if (numAbilities >= 3) {
                    sb.isFormulaValid = false;
                    return;
                }

                if (actorData) {
                    const paramName = param.slice(1);
                    switch (paramName) {
                        case 'str':
                            sumAbilities += actorData.abilities.strength.base;
                            break;

                        case 'sta':
                            sumAbilities += actorData.abilities.stamina.base;
                            break;

                        case 'dex':
                            sumAbilities += actorData.abilities.dexterity.base;
                            break;

                        case 'agl':
                            sumAbilities += actorData.abilities.agility.base;
                            break;

                        case 'int':
                            sumAbilities += actorData.abilities.intelligence.base;
                            break;

                        case 'aur':
                            sumAbilities += actorData.abilities.aura.base;
                            break;

                        case 'wil':
                            sumAbilities += actorData.abilities.will.base;
                            break;

                        case 'eye':
                            sumAbilities += actorData.abilities.eyesight.base;
                            break;

                        case 'hrg':
                            sumAbilities += actorData.abilities.hearing.base;
                            break;

                        case 'sml':
                            sumAbilities += actorData.abilities.smell.base;
                            break;

                        case 'voi':
                            sumAbilities += actorData.abilities.voice.base;
                            break;

                        case 'cml':
                            sumAbilities += actorData.abilities.comliness.base;
                            break;

                        case 'mor':
                            sumAbilities += actorData.abilities.morality.base;
                            break;

                        default:
                            sb.isFormulaValid = false;
                            return;
                    }
                }

                numAbilities++;
                return;
            }

            if (param.match(/^[a-z]/)) {
                // This is a sunsign

                let ssParts = param.split(':');

                // if more than 2 parts, it's invalid
                if (ssParts.length > 2) {
                    sb.isFormulaValid = false;
                    return;
                }

                // if second part provided, must be a number
                if (ssParts.length === 2 && !ssParts[1].trim().match(/[-+]?\d+/)) {
                    sb.isFormulaValid = false;
                    return;
                }

                if (actorData) {
                    // we must get the actor's sunsign to see if it matches. Actors may
                    // specify the sunsign as a dual sunsign, in which case the two parts
                    // must be separated either by a dash or a forward slash
                    let actorSS = actorData.sunsign.trim().toLowerCase().split(/[-\/]/);

                    // Call 'trim' function on all strings in actorSS
                    actorSS.map(Function.prototype.call, String.prototype.trim);

                    // Now, check whether our sunsign matches any of the actor's sunsigns
                    if (actorSS.includes(ssParts[0])) {
                        // We matched a character's sunsign, apply modifier
                        // Character only gets the largest sunsign bonus
                        ssBonus = Math.max(ssParts.length === 2 ? Number(ssParts[1].trim()) : 1, ssBonus);
                    }
                }

                return;
            }

            // The only valid possibility left is a number.
            // If it's not a number, it's invalid.
            if (param.match(/^[-+]?\d+$/)) {
                modifier += Number(param);
            } else {
                sb.isFormulaValid = false;
                return;
            }
        }
    });

    if (numAbilities != 3) {
        sb.isFormulaValid = false;
    } else {
        if (actorData) {
            sb.value = Math.round((sumAbilities / 3) + Number.EPSILON) + ssBonus + modifier;
        }
    }
}

export function createUniqueName(prefix, itemTypes) {
    let incr = 0;
    itemTypes.forEach(it => {
        if (prefix === it.data.name) {
            // Name was found, so minimum next increment will be 1
            incr = Math.max(1, incr);
        } else {
            const match = it.data.name.match(`${prefix}-(\\d+)`);
            if (match) {
                // Found an existing increment, so increase it by 1
                // as the new candidate; keep it only if it is greater than
                // the max increment we have found so far.
                const newIncr = Number(match[1]) + 1;
                incr = Math.max(newIncr, incr);
            }
        }
    });

    return incr ? `${prefix}-${incr}` : prefix;
}
/**
 * Returns the path to the appropriate image name for the specified
 * item name
 * 
 * @param {String} name 
 */
export function getImagePath(name) {
    if (!name) return DEFAULT_TOKEN;

    const lcName = name.toLowerCase();
    const re = /\(([^\)]+)\)/;

    for (let key of HM3.defaultItemIcons.keys()) {
        // if there is a direct match, this is best and return match
        if (lcName === key) {
            return HM3.defaultItemIcons.get(key);
        }

        // If there is a value in parenthesis, and there is a match,
        // then use that (this is for detailed-skills); e.g.
        //           Broadsword (Sword)     <== will match sword
        //           Keltan (Dagger)        <== will match dagger
        const match = re.exec(lcName);
        if (match) {
            if (key === match[1]) {
                return HM3.defaultItemIcons.get(key);
            }
        }

        // If all else fails, if the name starts with an existing key,
        // use that.  For example:
        //       Language: Harnic     <== will match "language"
        if (lcName.startsWith(key)) {
            return HM3.defaultItemIcons.get(key);
        }
    }

    return DEFAULT_TOKEN;
}

export function getAssocSkill(name, skillsItemArray, defaultSkill) {
    if (!name || !skillsItemArray || !skillsItemArray.length) return defaultSkill;

    const skills = skillsItemArray.map(s => s.data.name);

    const lcName = name.toLowerCase();
    const re = /\[([^\)]+)\]/i;

    // Exact Match
    let skillMatch = skills.find(s => s.toLowerCase() === lcName);
    if (skillMatch) return skillMatch;

    // Sub-skill match (sub-skill is in square brackets)
    let subSkillMatch = re.exec(name);
    if (subSkillMatch) {
        const lcSubSkill = subSkillMatch[1].toLowerCase();
        skillMatch = skills.find(s => s.toLowerCase() === lcSubSkill)
        if (skillMatch) return skillMatch;
    }

    return defaultSkill;
}

/**
 * Returns whether or not a icon path is one of the standard icons.
 * 
 * @param {String} iconPath Icon path to test
 * @param {Array} iconArray Array of standard icons
 */
export function isStdIcon(iconPath, iconArray) {
    if (!iconPath || !iconArray) return false;

    if (iconPath === CONST.DEFAULT_TOKEN) return true;

    let result = false;
    iconArray.forEach(i => {
        if (!result && i[1] === iconPath) result = true;
    });

    return result;
}

/**
 * String replacer function that applies the `text` string replacement
 * mechansim to an arbitrary string (named "template" here)
 * @param {String} template String containing ${} replacements
 * @param {Object} values An object containing replacement key/value pairs
 */
export function stringReplacer(template, values) {
    var keys = Object.keys(values);
    var func = Function(...keys, "return `" + template + "`;");

    return func(...keys.map(k => values[k]));
}

/**
 * Convert an integer into a roman numeral.  Taken from:
 * http://blog.stevenlevithan.com/archives/javascript-roman-numeral-converter
 * 
 * @param {Integer} num 
 */
export function romanize(num) {
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
            "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

export function aeDuration(effect) {
    const d = effect.data.duration;

    // Time-based duration
    if (Number.isNumeric(d.seconds)) {
        const start = (d.startTime || game.time.worldTime);
        const elapsed = game.time.worldTime - start;
        const remaining = d.seconds - elapsed;
        //const normDuration = toNormTime(d.seconds);
        const normRemaining = toNormTime(remaining);
        return {
            type: "seconds",
            duration: d.seconds,
            remaining: remaining,
            label: normRemaining,
            //normDuration: normDuration,
            //normRemaining: normRemaining
        };
    }

    // Turn-based duration
    else if (d.rounds || d.turns) {

        // Determine the current combat duration
        const cbt = game.combat;
        const c = { round: cbt?.round ?? 0, turn: cbt?.turn ?? 0, nTurns: cbt?.turns.length ?? 1 };

        // Determine how many rounds and turns have elapsed
        let elapsedRounds = Math.max(c.round - (d.startRound || 0), 0);
        let elapsedTurns = c.turn - (d.startTurn || 0);
        if (elapsedTurns < 0) {
            elapsedRounds -= 1;
            elapsedTurns += c.nTurns;
        }

        // Compute the number of rounds and turns that are remaining
        let remainingRounds = (d.rounds || 0) - elapsedRounds;
        let remainingTurns = (d.turns || 0) - elapsedTurns;
        if (remainingTurns < 0) {
            remainingRounds -= 1;
            remainingTurns += c.nTurns;
        } else if (remainingTurns > c.nTurns) {
            remainingRounds += Math.floor(remainingTurns / c.nTurns);
            remainingTurns %= c.nTurns;
        }

        // Total remaining duration
        if (remainingRounds < 0) {
            remainingRounds = 0;
            remainingTurns = 0;
        }
        const duration = (c.rounds || 0) + ((c.turns || 0) / 100)
        const remaining = remainingRounds + (remainingTurns / 100);

        // Remaining label
        const label = [
            remainingRounds > 0 ? `${remainingRounds} Rounds` : null,
            remainingTurns > 0 ? `${remainingTurns} Turns` : null,
            (remainingRounds + remainingTurns) === 0 ? "None" : null
        ].filterJoin(", ");
        return {
            type: "turns",
            duration: duration,
            remaining: remaining,
            label: label
        }
    }

    // No duration
    else return {
        type: "none",
        duration: null,
        remaining: null,
        label: 'None'
    }
}

export function aeChanges(effect) {
    if (!effect.data.changes || !effect.data.changes.length) {
        return 'No Changes';
    }

    return effect.data.changes.map(ch => {
        const modes = CONST.ACTIVE_EFFECT_MODES;
        const key = ch.key;
        const val = ch.value;
        switch ( ch.mode ) {
            case modes.ADD:
                return `${HM3.activeEffectKey[key]} ${val<0?'-':'+'} ${Math.abs(val)}`;
            case modes.MULTIPLY:
                return `${HM3.activeEffectKey[key]} x ${val}`;
            case modes.OVERRIDE:
                return `${HM3.activeEffectKey[key]} = ${val}`;
            case modes.UPGRADE:
                return `${HM3.activeEffectKey[key]} >= ${val}`;
            case modes.DOWNGRADE:
                return `${HM3.activeEffectKey[key]} <= ${val}`;
            default:
                return `${HM3.activeEffectKey[key]} custom`;
        }     
    }).join(', ');
}

function toNormTime(seconds) {
    const normHours = Math.floor(seconds / 3600);
    const remSeconds = seconds % 3600;
    const normMinutes = Number(Math.floor(remSeconds / 60)).toString().padStart(2, '0');
    const normSeconds = Number(remSeconds % 60).toString().padStart(2, '0');
    return `${normHours}:${normMinutes}:${normSeconds}`;
}