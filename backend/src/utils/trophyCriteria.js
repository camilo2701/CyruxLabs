// Este archivo se encarga de definir y validar los criterios de los trofeos de tipo
// "comando" y "proceso": cada trofeo guarda de 1 a 4 fragmentos de texto, y una línea
// de evidencia se considera acertada cuando contiene TODOS esos fragmentos, en cualquier
// orden, ignorando los espacios de más (se compara texto plano, sensible a mayúsculas, nunca como expresión regular).

export const FRAGMENT_MIN_LENGTH = 2;
export const FRAGMENT_MAX_LENGTH = 50;
export const MAX_FRAGMENTS = 4;

// Esta función se encarga de normalizar un fragmento: junta las secuencias de espacios/tabs
// en uno solo y recorta los extremos, para que las comparaciones no fallen por espacios de más.
export function normalizeFragment(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// Esta función se encarga de obtener la lista de fragmentos: acepta tanto un arreglo ya armado
// como el texto JSON que se guarda en la base de datos. Devuelve null cuando no es una lista válida.
export function getFragments(criteria) {
    if (Array.isArray(criteria)) return criteria;

    try {
        const parsed = JSON.parse(criteria);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        // Si el texto no es un JSON válido, lo tratamos como "no es una lista"
        return null;
    }
}

// Esta función se encarga de validar los fragmentos y devolver el mensaje de error
// correspondiente, o '' (cadena vacía) cuando todo está correcto.
export function getFragmentsError(criteria) {
    const fragments = getFragments(criteria);

    if (!fragments || fragments.length === 0) return 'Indica al menos un fragmento';
    if (fragments.length > MAX_FRAGMENTS) return `Máximo ${MAX_FRAGMENTS} fragmentos`;

    // Revisa fragmento por fragmento que sea texto, que respete el largo mínimo/máximo
    // y que no traiga caracteres de control raros
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

// Esta función se encarga de dejar los fragmentos en su forma canónica antes de guardarlos:
// limpios, sin duplicados, ordenados y convertidos a texto JSON.
export function normalizeFragments(criteria) {
    const fragments = getFragments(criteria) ?? [];
    return JSON.stringify([...new Set(fragments.map(normalizeFragment))].sort());
}

// Esta función se encarga de comprobar si una sola línea contiene todos los fragmentos pedidos.
export function lineMatchesFragments(line, fragments) {
    const normalizedLine = normalizeFragment(line);
    return fragments.every((fragment) => normalizedLine.includes(fragment));
}

// Esta función se encarga de decidir si la evidencia acierta el criterio: devuelve true cuando
// al menos una de sus líneas contiene todos los fragmentos.
export function evidenceMatches(evidenceText, criteria) {
    const fragments = (getFragments(criteria) ?? []).map(normalizeFragment);
    if (fragments.length === 0) return false;

    // Separa la evidencia en líneas y basta con que una de ellas cumpla con todos los fragmentos
    return String(evidenceText ?? '')
        .split('\n')
        .some((line) => lineMatchesFragments(line, fragments));
}
