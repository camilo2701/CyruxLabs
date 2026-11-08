// Este archivo se encarga de la lógica de los criterios por "fragmentos" (trofeos de comando y proceso):
// normalizar, validar y comparar fragmentos de texto contra las líneas de evidencia.
// Fragment criteria for the "command" and "process" trophies.
// A trophy stores 1 to 4 fragments; a line of evidence matches when it contains ALL of them,
// in any order, ignoring extra spaces (case-sensitive, plain text, never a regex).

export const FRAGMENT_MIN_LENGTH = 2;
export const FRAGMENT_MAX_LENGTH = 50;
export const MAX_FRAGMENTS = 4;

// Esta función se encarga de normalizar un fragmento: colapsa espacios/tabs y recorta los extremos.
// Collapses runs of spaces/tabs and trims the ends
export function normalizeFragment(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// Esta función se encarga de obtener la lista de fragmentos desde un array o desde el JSON guardado.
// Accepts either an array or the JSON string stored in the database. null = not a list.
export function getFragments(criteria) {
    if (Array.isArray(criteria)) return criteria;

    try {
        const parsed = JSON.parse(criteria);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

// Esta función se encarga de validar la lista de fragmentos (cantidad, largo y caracteres de control).
// '' when fine, otherwise the error message
export function getFragmentsError(criteria) {
    const fragments = getFragments(criteria);

    if (!fragments || fragments.length === 0) return 'Indica al menos un fragmento';
    if (fragments.length > MAX_FRAGMENTS) return `Máximo ${MAX_FRAGMENTS} fragmentos`;

    for (const raw of fragments) {
        if (typeof raw !== 'string') return 'Fragmento inválido';

        const fragment = normalizeFragment(raw);
        if (fragment.length < FRAGMENT_MIN_LENGTH) {
            return `Cada fragmento necesita al menos ${FRAGMENT_MIN_LENGTH} caracteres`;
        }
        if (fragment.length > FRAGMENT_MAX_LENGTH) {
            return `Cada fragmento puede tener hasta ${FRAGMENT_MAX_LENGTH} caracteres`;
        }
        if (/[\u0000-\u001f\u007f]/.test(fragment)) {
            return 'Los fragmentos no pueden tener caracteres de control';
        }
    }

    return '';
}

// Esta función se encarga de dejar los fragmentos en su forma canónica: limpios, sin duplicados, ordenados y como JSON.
// Canonical form that gets stored: cleaned, no duplicates, sorted, as a JSON string
export function normalizeFragments(criteria) {
    const fragments = getFragments(criteria) ?? [];
    return JSON.stringify([...new Set(fragments.map(normalizeFragment))].sort());
}

// Esta función se encarga de comprobar si una línea contiene TODOS los fragmentos indicados.
export function lineMatchesFragments(line, fragments) {
    const normalizedLine = normalizeFragment(line);
    return fragments.every((fragment) => normalizedLine.includes(fragment));
}

// Esta función se encarga de verificar si alguna línea de la evidencia cumple con todos los fragmentos.
// True when at least one line of the evidence contains every fragment
export function evidenceMatches(evidenceText, criteria) {
    const fragments = (getFragments(criteria) ?? []).map(normalizeFragment);
    if (fragments.length === 0) return false;

    return String(evidenceText ?? '')
        .split('\n')
        .some((line) => lineMatchesFragments(line, fragments));
}