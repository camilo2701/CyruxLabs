// Which images a lab may use.
// Trust is decided by WHO publishes an image, not by which registry hosts it.
// To allow another publisher, add one line here.
const ALLOWED_IMAGES = [
    // Docker Official Images (python, nginx, redis, ubuntu...): the "library" namespace on Docker Hub
    { registries: ['docker.io'], repo: /^library\/[^/]+$/ },
    // linuxserver.io publishes the same images on Docker Hub, its own lscr.io alias and GitHub
    { registries: ['docker.io', 'lscr.io', 'ghcr.io'], repo: /^linuxserver\/[^/]+$/ },
];

// "lscr.io/linuxserver/webtop:ubuntu-xfce" -> { registry: 'lscr.io', repo: 'linuxserver/webtop' }
// "python:3.12-alpine"                      -> { registry: 'docker.io', repo: 'library/python' }
function parseImageReference(ref) {
    let name = ref.split('@')[0];                       // drop @sha256:... digest
    if (name.lastIndexOf(':') > name.lastIndexOf('/')) {
        name = name.slice(0, name.lastIndexOf(':'));    // drop :tag (but not a registry port)
    }

    const parts = name.split('/');
    let registry = 'docker.io';
    const first = parts[0];
    if (parts.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost')) {
        registry = parts.shift();
    }
    if (registry === 'index.docker.io' || registry === 'registry-1.docker.io') registry = 'docker.io';

    let repo = parts.join('/');
    if (registry === 'docker.io' && !repo.includes('/')) repo = `library/${repo}`;

    return { registry, repo };
}

export function isAllowedImage(ref) {
    if (typeof ref !== 'string' || !/^[a-z0-9][a-z0-9._:/@-]*$/i.test(ref)) return false;

    const { registry, repo } = parseImageReference(ref.toLowerCase());
    return ALLOWED_IMAGES.some((rule) => rule.registries.includes(registry) && rule.repo.test(repo));
}