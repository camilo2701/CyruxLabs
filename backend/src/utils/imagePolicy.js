// Este archivo se encarga de decidir qué imágenes de contenedor puede usar un laboratorio,
// según el publicador de la imagen (no según el registro que la aloja).
// Which images a lab may use.
// Trust is decided by WHO publishes an image, not by which registry hosts it.
// To allow another publisher, add one line here.
// Esta constante se encarga de listar las reglas de imágenes permitidas (publicador y registros).
const ALLOWED_IMAGES = [
    // Docker Official Images (python, nginx, redis, ubuntu...): the "library" namespace on Docker Hub
    { registries: ['docker.io'], repo: /^library\/[^/]+$/ },
    // linuxserver.io publishes the same images on Docker Hub, its own lscr.io alias and GitHub
    { registries: ['docker.io', 'lscr.io', 'ghcr.io'], repo: /^linuxserver\/[^/]+$/ },
];

// "lscr.io/linuxserver/webtop:ubuntu-xfce" -> { registry: 'lscr.io', repo: 'linuxserver/webtop' }
// "python:3.12-alpine"                      -> { registry: 'docker.io', repo: 'library/python' }
// Esta función se encarga de descomponer una referencia de imagen en { registry, repo },
// quitando el digest y el tag y normalizando los alias de Docker Hub.
function parseImageReference(ref) {
    let name = ref.split('@')[0];                       // drop @sha256:... digest
    if (name.lastIndexOf(':') > name.lastIndexOf('/')) {
        name = name.slice(0, name.lastIndexOf(':'));    // drop :tag (but not a registry port)
    }

    const parts = name.split('/');
    let registry = 'docker.io';
    const first = parts[0];
    // El primer segmento es un registro solo si parece un host (tiene punto, dos puntos o es localhost).
    if (parts.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost')) {
        registry = parts.shift();
    }
    if (registry === 'index.docker.io' || registry === 'registry-1.docker.io') registry = 'docker.io';

    let repo = parts.join('/');
    if (registry === 'docker.io' && !repo.includes('/')) repo = `library/${repo}`;

    return { registry, repo };
}

// Esta función se encarga de indicar si una referencia de imagen está permitida según las
// reglas de ALLOWED_IMAGES.
export function isAllowedImage(ref) {
    // Validación: rechaza lo que no sea una cadena con el formato esperado de referencia.
    if (typeof ref !== 'string' || !/^[a-z0-9][a-z0-9._:/@-]*$/i.test(ref)) return false;

    const { registry, repo } = parseImageReference(ref.toLowerCase());
    return ALLOWED_IMAGES.some((rule) => rule.registries.includes(registry) && rule.repo.test(repo));
}