// Este archivo se encarga de centralizar todas las llamadas al backend de la pantalla de gestión de laboratorios.
// Every request the labs management screen makes lives here, so the components only deal with
// results. Each helper returns { ok, status, data } and throws only when the server cannot be reached.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Esta función se encarga de hacer la petición con el token de autenticación y devolver siempre { ok, status, data }.
async function request(token, path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    // Si la respuesta no es JSON válido, se usa un objeto vacío para no romper a quien la consume
    const data = await response.json().catch(() => ({}));

    return { ok: response.ok, status: response.status, data };
}

// Esta función se encarga de armar las opciones de fetch para enviar un cuerpo en formato JSON.
const jsonRequest = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// ---- List ----

// Esta función se encarga de pedir la lista paginada de laboratorios gestionables, con búsqueda opcional.
// /labs/manage: el admin recibe todos los labs; el instructor solo los suyos.
export function listManagedLabs(token, search, page) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));

    return request(token, `/labs/manage?${params.toString()}`);
}

// Esta función se encarga de traer cuántos reportes de bugs tiene cada laboratorio de la lista indicada.
export function getBugCounts(token, labIds) {
    return request(token, `/bugreports/counts?labids=${labIds.join(',')}`);
}

// ---- One lab ----

// Everything the edit screen shows: instructions, trophies (with how many students earned each),
// the current flag and the pending zip + flag update, if any
// Esta función se encarga de obtener el detalle completo de un laboratorio para la pantalla de edición.
export function getLabDetail(token, labid) {
    return request(token, `/labs/${labid}/manage`);
}

// Only the fields that changed: { title, description, instructions, addBenefits, removeBenefitIds, trophyChanges }
// Esta función se encarga de guardar los cambios de un laboratorio (solo los campos que se modificaron).
export function saveLab(token, labid, changes) {
    return request(token, `/labs/${labid}`, jsonRequest('PUT', changes));
}

// Esta función se encarga de eliminar un laboratorio.
export function removeLab(token, labid) {
    return request(token, `/labs/${labid}`, { method: 'DELETE' });
}

// ---- Zip + flag update (always a pair, applied when the lab has no open session) ----

// Esta función se encarga de solicitar la actualización del zip y la flag del laboratorio (enviados juntos).
export function requestFileUpdate(token, labid, { flag, file }) {
    const formData = new FormData();
    formData.append('flag', flag);
    formData.append('zipfile', file);

    // No Content-Type here: the browser sets it (with the boundary) for FormData
    return request(token, `/labs/${labid}/update-request`, { method: 'POST', body: formData });
}

// Esta función se encarga de cancelar una actualización de archivo pendiente.
export function cancelFileUpdate(token, labid) {
    return request(token, `/labs/${labid}/update-request`, { method: 'DELETE' });
}

// Admin only: closes the lab's open sessions and applies the update right now
// Esta función se encarga de aplicar la actualización de inmediato (solo admin), cerrando las sesiones abiertas.
export function applyFileUpdateNow(token, labid) {
    return request(token, `/labs/${labid}/update-request/apply-now`, { method: 'POST' });
}
