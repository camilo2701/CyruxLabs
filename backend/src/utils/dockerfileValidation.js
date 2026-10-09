import { isAllowedImage } from './imagePolicy.js';

const ALLOWED_INSTRUCTIONS = new Set([
    'FROM', 'RUN', 'COPY', 'ADD', 'ENV', 'ARG', 'WORKDIR', 'USER', 'CMD', 'ENTRYPOINT',
    'EXPOSE', 'LABEL', 'VOLUME', 'HEALTHCHECK', 'SHELL', 'STOPSIGNAL', 'MAINTAINER',
]);
const HEREDOC = /<<-?\s*["']?[A-Za-z_]/;

// "# syntax=..." style lines at the very top of the file. Docker only reads them there.
function getDirectiveError(lines) {
    for (const line of lines) {
        const match = /^\s*#\s*([a-z][a-z0-9_-]*)\s*=\s*(.*)$/i.exec(line);
        if (!match) break; // first blank line, plain comment or instruction ends the directives

        const key = match[1].toLowerCase();
        const value = match[2].trim();
        if (key === 'escape') return 'la directiva "# escape" no está permitida';
        if (key === 'syntax' && !value.startsWith('docker/dockerfile:')) {
            return 'la directiva "# syntax" solo puede usar docker/dockerfile:<versión>';
        }
    }
    return '';
}

// Turns the file into a list of full instructions: joins lines ending in "\" and drops comments
function toInstructions(lines) {
    const instructions = [];
    let current = '';

    for (const raw of lines) {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) continue;

        if (line.endsWith('\\')) {
            current += `${line.slice(0, -1)} `;
        } else {
            instructions.push(current + line);
            current = '';
        }
    }
    if (current !== '') instructions.push(current);
    return instructions;
}

function getImageError(image, stages) {
    const lower = image.toLowerCase();
    if (image.includes('$')) return `la imagen "${image}" usa variables; escribe el nombre completo`;
    if (lower === 'scratch' || stages.has(lower)) return ''; // empty base, or an earlier build stage
    return isAllowedImage(image) ? '' : `la imagen "${image}" no está en la lista de imágenes permitidas`;
}

function getFromError(args, stages) {
    const tokens = args.split(/\s+/).filter((token) => !token.startsWith('--')); // skip --platform=...
    const [image, as, alias] = tokens;
    if (!image) return 'FROM sin imagen';

    const problem = getImageError(image, stages);
    if (problem) return problem;

    if (as && as.toUpperCase() === 'AS' && alias) stages.add(alias.toLowerCase());
    return '';
}

function getCopyError(name, args, stages) {
    const from = /(?:^|\s)--from=(\S+)/.exec(args);
    if (from && !/^\d+$/.test(from[1])) {
        const problem = getImageError(from[1], stages);
        if (problem) return problem;
    }
    if (name === 'ADD' && (args.includes('://') || args.includes('git@'))) {
        return 'ADD no puede descargar desde una URL; incluye el archivo en el zip y usa COPY';
    }
    return '';
}

function getRunError(args, stages) {
    // Only the flags before the actual command ("RUN --mount=... apk add --no-cache x")
    const flags = [];
    for (const token of args.split(/\s+/)) {
        if (!token.startsWith('--')) break;
        flags.push(token);
    }

    for (const flag of flags) {
        if (flag.startsWith('--security')) return 'RUN --security no está permitido';
        if (flag === '--network=host') return 'RUN --network=host no está permitido';

        if (flag.startsWith('--mount')) {
            const from = /(?:^|[=,])from=([^,\s]+)/.exec(flag);
            if (from && !/^\d+$/.test(from[1])) {
                const problem = getImageError(from[1], stages);
                if (problem) return problem;
            }
        }
    }
    return '';
}

// Returns '' when the Dockerfile is fine, otherwise a message
export function getDockerfileError(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');

    const directiveProblem = getDirectiveError(lines);
    if (directiveProblem) return directiveProblem;

    const stages = new Set(); // names given with "FROM x AS name"

    for (const instruction of toInstructions(lines)) {
        if (HEREDOC.test(instruction)) {
            return 'los heredocs (<<EOF) no están soportados; usa COPY o una línea RUN';
        }

        const [, rawName, args] = /^(\S+)\s*([\s\S]*)$/.exec(instruction);
        const name = rawName.toUpperCase();

        if (!ALLOWED_INSTRUCTIONS.has(name)) return `la instrucción "${rawName}" no está permitida`;

        let problem = '';
        if (name === 'FROM') problem = getFromError(args, stages);
        else if (name === 'COPY' || name === 'ADD') problem = getCopyError(name, args, stages);
        else if (name === 'RUN') problem = getRunError(args, stages);

        if (problem) return problem;
    }

    return '';
}