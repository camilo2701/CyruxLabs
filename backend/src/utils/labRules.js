// Rules for lab data. Keep in sync with the frontend copy (src/utils/labRules.js).
export const TITLE_MIN = 3;
export const TITLE_MAX = 50;
export const DESC_MAX = 500;
export const BENEFIT_MAX = 100;
export const MIN_BENEFITS = 3;
export const MAX_BENEFITS = 8;
export const FLAG_MIN = 4;
export const FLAG_MAX = 100;

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