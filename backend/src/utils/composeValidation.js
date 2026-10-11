import path from 'path';
import { isAllowedImage } from './imagePolicy.js';

// Services that already exist in base-proxy.yaml. A lab must not redefine them.
const RESERVED_SERVICES = new Set(['labaccessproxy']);
const REQUIRED_NETWORK = 'labnet';
const MAX_SERVICES = 10;
const MAX_SHM_BYTES = 2 * 1024 ** 3; // 2 GB

// Allowlist: anything not listed here is rejected. To support a new Compose option, add it here.
const ALLOWED_TOP_LEVEL = new Set(['services', 'volumes']);
const ALLOWED_SERVICE_KEYS = new Set([
    'build', 'image', 'restart', 'depends_on', 'volumes', 'environment', 'command',
    'entrypoint', 'healthcheck', 'networks', 'shm_size', 'working_dir', 'user',
    'expose', 'hostname', 'init', 'read_only', 'tty', 'stdin_open',
]);
const ALLOWED_BUILD_KEYS = new Set(['context', 'dockerfile', 'args', 'target']);
const ALLOWED_NETWORK_KEYS = new Set(['aliases']);
const ALLOWED_VOLUME_OBJECT_KEYS = new Set(['type', 'source', 'target', 'read_only']);

const SERVICE_NAME = /^[a-z0-9][a-z0-9_-]*$/i;
const NAMED_VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// "./x" or "." that stays inside the lab folder after resolving any "..".
// Requiring the "./" prefix also rules out remote contexts like "github.com/user/repo".
function isSafeRelativePath(p) {
    if (typeof p !== 'string' || p.includes('\0') || p.includes('\\')) return false;
    if (p !== '.' && !p.startsWith('./')) return false;
    const normalized = path.posix.normalize(p);
    return normalized !== '..' && !normalized.startsWith('../');
}

// For "dockerfile:", which is relative to the build context (no "./" prefix required)
function isInsidePath(p) {
    if (typeof p !== 'string' || p === '' || p.includes('\0') || p.includes('\\')) return false;
    if (p.startsWith('/') || p.includes('://')) return false;
    const normalized = path.posix.normalize(p);
    return normalized !== '..' && !normalized.startsWith('../');
}

// Any "$" left after removing the escaped "$$" is a variable interpolation
function containsInterpolation(value) {
    if (typeof value === 'string') return value.replace(/\$\$/g, '').includes('$');
    if (Array.isArray(value)) return value.some(containsInterpolation);
    if (isPlainObject(value)) return Object.values(value).some(containsInterpolation);
    return false;
}

function parseSizeToBytes(value) {
    if (typeof value === 'number') return value;
    const match = /^(\d+)\s*(b|k|kb|m|mb|g|gb)?$/i.exec(String(value).trim());
    if (!match) return NaN;
    const units = { b: 1, k: 1024, kb: 1024, m: 1024 ** 2, mb: 1024 ** 2, g: 1024 ** 3, gb: 1024 ** 3 };
    return Number(match[1]) * units[(match[2] || 'b').toLowerCase()];
}

function getBuildError(build) {
    if (typeof build === 'string') {
        return isSafeRelativePath(build) ? '' : '"build" debe ser una ruta relativa que empiece con ./';
    }
    if (!isPlainObject(build)) return '"build" tiene un formato no válido';

    const badKey = Object.keys(build).find((key) => !ALLOWED_BUILD_KEYS.has(key));
    if (badKey) return `la opción de build "${badKey}" no está permitida`;

    if (!isSafeRelativePath(build.context)) return 'build.context debe ser una ruta relativa que empiece con ./';
    if (build.dockerfile !== undefined && !isInsidePath(build.dockerfile)) {
        return 'build.dockerfile debe ser una ruta dentro del laboratorio';
    }
    return '';
}

function getVolumeError(volume) {
    if (typeof volume === 'string') {
        const parts = volume.split(':');
        if (parts.length === 1) return ''; // anonymous volume: only names a path inside the container

        const source = parts[0];
        if (source.startsWith('.')) {
            return isSafeRelativePath(source) ? '' : `el volumen "${volume}" apunta fuera del laboratorio`;
        }
        return NAMED_VOLUME.test(source)
            ? ''
            : `el volumen "${volume}" no está permitido (solo rutas ./ o volúmenes con nombre)`;
    }

    if (isPlainObject(volume)) {
        const badKey = Object.keys(volume).find((key) => !ALLOWED_VOLUME_OBJECT_KEYS.has(key));
        if (badKey) return `la opción de volumen "${badKey}" no está permitida`;

        if (volume.type === 'bind') {
            return isSafeRelativePath(volume.source) ? '' : 'un volumen bind apunta fuera del laboratorio';
        }
        if (volume.type === 'volume') {
            return volume.source === undefined || NAMED_VOLUME.test(String(volume.source))
                ? ''
                : 'nombre de volumen no válido';
        }
        return volume.type === 'tmpfs' ? '' : 'tipo de volumen no permitido';
    }

    return 'formato de volumen no válido';
}

function getNetworksError(networks) {
    const names = Array.isArray(networks)
        ? networks
        : isPlainObject(networks) ? Object.keys(networks) : null;

    if (!names || names.length !== 1 || names[0] !== REQUIRED_NETWORK) {
        return `debe estar conectado únicamente a la red "${REQUIRED_NETWORK}"`;
    }

    if (isPlainObject(networks)) {
        const config = networks[REQUIRED_NETWORK];
        if (config === null || config === undefined) return '';
        if (!isPlainObject(config)) return 'configuración de red no válida';

        const badKey = Object.keys(config).find((key) => !ALLOWED_NETWORK_KEYS.has(key));
        if (badKey) return `la opción de red "${badKey}" no está permitida`;

        const aliases = config.aliases ?? [];
        if (!Array.isArray(aliases) || aliases.some((a) => typeof a !== 'string' || RESERVED_SERVICES.has(a))) {
            return 'aliases de red no válidos';
        }
    }
    return '';
}

function getServiceError(service) {
    if (!isPlainObject(service)) return 'definición no válida';

    const badKey = Object.keys(service).find((key) => !ALLOWED_SERVICE_KEYS.has(key));
    if (badKey) return `la opción "${badKey}" no está permitida`;

    // With both, the built image gets tagged with that name on the VM, which could replace
    // an image other labs (or the base proxy) rely on
    if (service.build !== undefined && service.image !== undefined) {
        return 'no combines "build" con "image": la imagen construida se nombra automáticamente';
    }
    if (service.image !== undefined && !isAllowedImage(service.image)) {
        return `la imagen "${service.image}" no está en la lista de imágenes permitidas`;
    }

    if (!service.image && !service.build) return 'necesita "image" o "build"';
    if (service.build !== undefined) {
        const buildProblem = getBuildError(service.build);
        if (buildProblem) return buildProblem;
    }

    if (service.networks === undefined) return `debe declarar la red "${REQUIRED_NETWORK}"`;
    const networkProblem = getNetworksError(service.networks);
    if (networkProblem) return networkProblem;

    if (service.volumes !== undefined) {
        if (!Array.isArray(service.volumes)) return '"volumes" debe ser una lista';
        for (const volume of service.volumes) {
            const volumeProblem = getVolumeError(volume);
            if (volumeProblem) return volumeProblem;
        }
    }

    if (service.shm_size !== undefined && !(parseSizeToBytes(service.shm_size) <= MAX_SHM_BYTES)) {
        return 'shm_size supera el máximo permitido (2gb)';
    }

    return '';
}

// Receives the parsed compose.yaml (a JS object). Returns '' when it is fine, otherwise a message.
export function getComposeError(compose) {
    if (!isPlainObject(compose)) return 'compose.yaml debe contener servicios';
    if (containsInterpolation(compose)) return 'compose.yaml: no se permiten variables ($VAR o ${VAR})';

    const badTopLevel = Object.keys(compose).find((key) => !ALLOWED_TOP_LEVEL.has(key));
    if (badTopLevel) return `compose.yaml: la sección "${badTopLevel}" no está permitida`;

    // Named volumes can only be plain declarations (no driver_opts that bind a host path)
    if (compose.volumes !== undefined) {
        if (!isPlainObject(compose.volumes)) return 'compose.yaml: "volumes" no es válido';
        for (const [name, definition] of Object.entries(compose.volumes)) {
            const isEmpty = definition === null || (isPlainObject(definition) && Object.keys(definition).length === 0);
            if (!isEmpty) return `compose.yaml: el volumen "${name}" no puede tener opciones`;
        }
    }

    if (!isPlainObject(compose.services)) return 'compose.yaml debe definir "services"';

    const names = Object.keys(compose.services);
    if (names.length === 0 || names.length > MAX_SERVICES) {
        return `compose.yaml debe tener entre 1 y ${MAX_SERVICES} servicios`;
    }

    for (const name of names) {
        if (!SERVICE_NAME.test(name) || RESERVED_SERVICES.has(name)) {
            return `compose.yaml: el nombre de servicio "${name}" no es válido o está reservado`;
        }
        const problem = getServiceError(compose.services[name]);
        if (problem) return `compose.yaml, servicio "${name}": ${problem}`;
    }

    return '';
}

// Where each build's Dockerfile lives, relative to the lab folder (e.g. "webtop/Dockerfile").
// Only call this after getComposeError returned ''.
export function getDockerfilePaths(compose) {
    const paths = new Set();

    for (const service of Object.values(compose.services)) {
        if (service.build === undefined) continue;

        const isShort = typeof service.build === 'string';
        const context = isShort ? service.build : service.build.context;
        const dockerfile = (!isShort && service.build.dockerfile) || 'Dockerfile';

        paths.add(path.posix.join(context, dockerfile));
    }
    return [...paths];
}