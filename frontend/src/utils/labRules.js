// Rules shared by the lab forms. Keep in sync with the backend copy (backend/src/utils/labRules.js).
export const TITLE_MIN = 3;
export const TITLE_MAX = 50;
export const DESC_MAX = 500;
export const BENEFIT_MAX = 100;
export const MIN_BENEFITS = 3;
export const MAX_BENEFITS = 8;
export const FLAG_MIN = 4;
export const FLAG_MAX = 100;

// Letters of any language (with accents), numbers, spaces and a few punctuation marks.
// % and _ are left out on purpose: they are wildcards in the duplicate-title search.
const TEXT_REGEX = /^[\p{L}\p{N} :.,()¿?¡!-]+$/u;
const TEXT_RULE_MESSAGE = 'Solo se permiten letras, números, espacios y . , : ( ) ¿ ? ¡ ! -';
const FLAG_REGEX = /^\S+$/;

// Every helper returns '' when the value is fine, or the error message to show
export function getTitleError(value) {
    const title = value.trim();
    if (title === '') return 'El título es obligatorio';
    if (title.length < TITLE_MIN) return `El título debe tener al menos ${TITLE_MIN} caracteres`;
    if (title.length > TITLE_MAX) return `El título no puede superar ${TITLE_MAX} caracteres`;
    if (!TEXT_REGEX.test(title)) return TEXT_RULE_MESSAGE;
    return '';
}

export function getDescriptionError(value) {
    const description = value.trim();
    if (description === '') return 'La descripción es un campo obligatorio';
    if (description.length > DESC_MAX) return `La descripción no puede superar ${DESC_MAX} caracteres`;
    return '';
}

export function getBenefitError(value) {
    const benefit = value.trim();
    if (benefit === '') return 'El beneficio no puede estar vacío';
    if (benefit.length > BENEFIT_MAX) return `Cada beneficio puede tener hasta ${BENEFIT_MAX} caracteres`;
    if (!TEXT_REGEX.test(benefit)) return TEXT_RULE_MESSAGE;
    return '';
}

export function getFlagError(value) {
    const flag = value.trim();
    if (flag === '') return 'La flag es obligatoria';
    if (flag.length < FLAG_MIN) return `La flag debe tener al menos ${FLAG_MIN} caracteres`;
    if (flag.length > FLAG_MAX) return `La flag no puede superar ${FLAG_MAX} caracteres`;
    if (!FLAG_REGEX.test(flag)) return 'La flag no puede contener espacios';
    return '';
}

export function generateFlag() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `FLAG{${hex}}`;
}