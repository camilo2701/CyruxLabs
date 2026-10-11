// Fragment criteria for the "command" and "process" trophies.
// A trophy stores 1 to 4 fragments; a line of evidence matches when it contains ALL of them,
// in any order, ignoring extra spaces (case-sensitive, plain text, never a regex).

export const FRAGMENT_MIN_LENGTH = 2;
export const FRAGMENT_MAX_LENGTH = 50;
export const MAX_FRAGMENTS = 4;

// Collapses runs of spaces/tabs and trims the ends
export function normalizeFragment(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

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

// Canonical form that gets stored: cleaned, no duplicates, sorted, as a JSON string
export function normalizeFragments(criteria) {
    const fragments = getFragments(criteria) ?? [];
    return JSON.stringify([...new Set(fragments.map(normalizeFragment))].sort());
}

export function lineMatchesFragments(line, fragments) {
    const normalizedLine = normalizeFragment(line);
    return fragments.every((fragment) => normalizedLine.includes(fragment));
}

// True when at least one line of the evidence contains every fragment
export function evidenceMatches(evidenceText, criteria) {
    const fragments = (getFragments(criteria) ?? []).map(normalizeFragment);
    if (fragments.length === 0) return false;

    return String(evidenceText ?? '')
        .split('\n')
        .some((line) => lineMatchesFragments(line, fragments));
}