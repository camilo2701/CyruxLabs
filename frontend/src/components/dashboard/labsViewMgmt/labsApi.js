// Every request the labs management screen makes lives here, so the components only deal with
// results. Each helper returns { ok, status, data } and throws only when the server cannot be reached.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(token, path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));

    return { ok: response.ok, status: response.status, data };
}

const jsonRequest = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// ---- List ----

// /labs/manage: el admin recibe todos los labs; el instructor solo los suyos.
export function listManagedLabs(token, search, page) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));

    return request(token, `/labs/manage?${params.toString()}`);
}

export function getBugCounts(token, labIds) {
    return request(token, `/bugreports/counts?labids=${labIds.join(',')}`);
}

// ---- One lab ----

// Everything the edit screen shows: instructions, trophies (with how many students earned each),
// the current flag and the pending zip + flag update, if any
export function getLabDetail(token, labid) {
    return request(token, `/labs/${labid}/manage`);
}

// Only the fields that changed: { title, description, instructions, addBenefits, removeBenefitIds, trophyChanges }
export function saveLab(token, labid, changes) {
    return request(token, `/labs/${labid}`, jsonRequest('PUT', changes));
}

export function removeLab(token, labid) {
    return request(token, `/labs/${labid}`, { method: 'DELETE' });
}

// ---- Zip + flag update (always a pair, applied when the lab has no open session) ----

export function requestFileUpdate(token, labid, { flag, file }) {
    const formData = new FormData();
    formData.append('flag', flag);
    formData.append('zipfile', file);

    // No Content-Type here: the browser sets it (with the boundary) for FormData
    return request(token, `/labs/${labid}/update-request`, { method: 'POST', body: formData });
}

export function cancelFileUpdate(token, labid) {
    return request(token, `/labs/${labid}/update-request`, { method: 'DELETE' });
}

// Admin only: closes the lab's open sessions and applies the update right now
export function applyFileUpdateNow(token, labid) {
    return request(token, `/labs/${labid}/update-request/apply-now`, { method: 'POST' });
}
