// Rules for lab data. Keep in sync with the frontend copy (src/utils/labRules.js).
export const TITLE_MIN = 3;
export const TITLE_MAX = 50;
export const DESC_MAX = 500;
export const BENEFIT_MAX = 100;
export const MIN_BENEFITS = 3;
export const MAX_BENEFITS = 8;
export const FLAG_MIN = 4;
export const FLAG_MAX = 100;
export const INSTRUCTIONS_MAX = 20000;

// % and _ are left out on purpose: they are wildcards in ilike searches
const TEXT_REGEX = /^[\p{L}\p{N} :.,()¿?¡!-]+$/u;
const TEXT_RULE_MESSAGE = 'Solo se permiten letras, números, espacios y . , : ( ) ¿ ? ¡ ! -';
const FLAG_REGEX = /^\S+$/;

// Every helper returns '' when the value is fine, or the error message
export function getTitleError(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'El título es obligatorio';
    const title = value.trim();
    if (title.length < TITLE_MIN) return `El título debe tener al menos ${TITLE_MIN} caracteres`;
    if (title.length > TITLE_MAX) return `El título no puede superar ${TITLE_MAX} caracteres`;
    if (!TEXT_REGEX.test(title)) return TEXT_RULE_MESSAGE;
    return '';
}

export function getDescriptionError(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'La descripción es un campo obligatorio';
    if (value.trim().length > DESC_MAX) return `La descripción no puede superar ${DESC_MAX} caracteres`;
    return '';
}

export function getBenefitError(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'El beneficio no puede estar vacío';
    const benefit = value.trim();
    if (benefit.length > BENEFIT_MAX) return `Cada beneficio puede tener hasta ${BENEFIT_MAX} caracteres`;
    if (!TEXT_REGEX.test(benefit)) return TEXT_RULE_MESSAGE;
    return '';
}

export function getBenefitsError(benefits) {
    if (!Array.isArray(benefits)) return 'Formato de beneficios inválido';
    if (benefits.length < MIN_BENEFITS) return `Debes indicar al menos ${MIN_BENEFITS} beneficios`;
    if (benefits.length > MAX_BENEFITS) return `Máximo ${MAX_BENEFITS} beneficios`;
    return benefits.map(getBenefitError).find(Boolean) || '';
}

export function getFlagError(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'La flag es obligatoria';
    const flag = value.trim();
    if (flag.length < FLAG_MIN) return `La flag debe tener al menos ${FLAG_MIN} caracteres`;
    if (flag.length > FLAG_MAX) return `La flag no puede superar ${FLAG_MAX} caracteres`;
    if (!FLAG_REGEX.test(flag)) return 'La flag no puede contener espacios';
    return '';
}

export function getInstructionsError(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'Las instrucciones son obligatorias';
    if (value.trim().length > INSTRUCTIONS_MAX) return `Las instrucciones no pueden superar ${INSTRUCTIONS_MAX} caracteres`;
    return '';
}

// ---------- Trophies ----------

export const TROPHY_NAME_MAX = 30;
export const TROPHY_DESC_MAX = 100;
export const MAX_CUSTOM_TROPHIES = 3;
export const TROPHY_TYPE_LABELS = { 0: 'Bronce', 1: 'Plata', 2: 'Oro' };

// Caps per type among the lab's own trophies (the automatic one is not counted)
export const MAX_TROPHIES_BY_TYPE = { 0: 3, 1: 2, 2: 1 };

export const TIME_MIN_SECONDS = 30;
export const TIME_MAX_SECONDS = 3 * 60 * 60;
export const FAILED_ATTEMPTS_MAX = 20;

// Criteria an instructor can pick. available: false means it is shown but not selectable yet,
// because the platform cannot evaluate it until evidence collection exists.
export const CRITERIA_TYPES = {
    time: { label: 'Tiempo', available: true },
    failed_attempts: { label: 'Intentos fallidos', available: true },
    command: { label: 'Comando', available: false },
    process: { label: 'Proceso', available: false },
};

const NUMERIC_CRITERIA = ['time', 'failed_attempts'];
export const COMPLETION_CRITERIA = 'completion';

// Created by the platform for every lab. Instructors never send or edit this one.
export const COMPLETION_TROPHY = {
    type: 0,
    name: 'Laboratorio completado',
    description: 'Resuelve el laboratorio y envía la flag correcta.',
    criteriatype: COMPLETION_CRITERIA,
    criteria: '',
};

// Canonical form that gets stored: numbers as plain digit strings ("060" becomes "60")
export function normalizeCriteria(criteriatype, criteria) {
    const value = String(criteria ?? '').trim();
    return NUMERIC_CRITERIA.includes(criteriatype) ? String(Number(value)) : value;
}

function getCriteriaError(criteriatype, criteria) {
    if (criteriatype === COMPLETION_CRITERIA) return 'El trofeo de completitud se crea automáticamente';

    const rule = CRITERIA_TYPES[criteriatype];
    if (!rule) return 'Elige un tipo de criterio';
    if (!rule.available) return 'Este criterio todavía no está disponible';

    const value = String(criteria ?? '').trim();

    if (criteriatype === 'time') {
        if (!/^\d+$/.test(value)) return 'Indica el tiempo en minutos y segundos';
        const seconds = Number(value);
        if (seconds < TIME_MIN_SECONDS) return `El tiempo mínimo es ${TIME_MIN_SECONDS} segundos`;
        if (seconds > TIME_MAX_SECONDS) return 'El tiempo máximo es 3 horas';
        return '';
    }

    if (criteriatype === 'failed_attempts') {
        if (!/^\d+$/.test(value)) return 'Indica un número entero';
        if (Number(value) > FAILED_ATTEMPTS_MAX) return `El máximo es ${FAILED_ATTEMPTS_MAX} intentos fallidos`;
        return '';
    }

    return 'Criterio inválido';
}

// One entry per trophy: { type, name, description, criteria } with '' where the field is fine.
// Includes the "same criteria twice" check, which is why it needs the whole list.
export function getTrophyErrorList(trophies) {
    const seen = new Set();

    return trophies.map((trophy) => {
        const errors = { type: '', name: '', description: '', criteria: '' };

        if (!trophy || typeof trophy !== 'object') {
            errors.name = 'Trofeo inválido';
            return errors;
        }

        if (!Number.isInteger(trophy.type) || trophy.type < 0 || trophy.type > 2) {
            errors.type = 'Elige bronce, plata u oro';
        }

        const name = typeof trophy.name === 'string' ? trophy.name.trim() : '';
        if (name === '') errors.name = 'El nombre es obligatorio';
        else if (name.length > TROPHY_NAME_MAX) errors.name = `Máximo ${TROPHY_NAME_MAX} caracteres`;
        else if (!TEXT_REGEX.test(name)) errors.name = TEXT_RULE_MESSAGE;

        const description = typeof trophy.description === 'string' ? trophy.description.trim() : '';
        if (description === '') errors.description = 'La descripción es obligatoria';
        else if (description.length > TROPHY_DESC_MAX) errors.description = `Máximo ${TROPHY_DESC_MAX} caracteres`;
        else if (!TEXT_REGEX.test(description)) errors.description = TEXT_RULE_MESSAGE;

        errors.criteria = getCriteriaError(trophy.criteriatype, trophy.criteria);

        if (!errors.criteria) {
            const key = `${trophy.criteriatype}:${normalizeCriteria(trophy.criteriatype, trophy.criteria)}`;
            if (seen.has(key)) errors.criteria = 'Ya hay otro trofeo con este mismo criterio';
            seen.add(key);
        }

        return errors;
    });
}

// '' when everything is fine, otherwise the first problem found
export function getTrophiesError(trophies) {
    if (!Array.isArray(trophies)) return 'Formato de trofeos inválido';

    if (trophies.length > MAX_CUSTOM_TROPHIES) {
        return `Máximo ${MAX_CUSTOM_TROPHIES} trofeos propios`;
    }

    for (const type of Object.keys(MAX_TROPHIES_BY_TYPE)) {
        const count = trophies.filter((t) => t?.type === Number(type)).length;
        if (count > MAX_TROPHIES_BY_TYPE[type]) {
            return `Máximo ${MAX_TROPHIES_BY_TYPE[type]} trofeo(s) de ${TROPHY_TYPE_LABELS[type]}`;
        }
    }

    const errorList = getTrophyErrorList(trophies);
    for (let i = 0; i < errorList.length; i++) {
        const first = Object.values(errorList[i]).find(Boolean);
        if (first) return `Trofeo ${i + 1}: ${first}`;
    }

    return '';
}