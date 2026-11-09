// Este archivo se encarga de validar el zip que sube un instructor con su laboratorio: tamaño, estructura,
// nombres, límites de descompresión y la correcta presencia y contenido del compose.yaml y sus Dockerfiles.
import yauzl from 'yauzl';
import { parse as parseYaml } from 'yaml';
import { getComposeError, getDockerfilePaths } from './composeValidation.js';
import { getDockerfileError } from './dockerfileValidation.js';

// Estas constantes se encargan de reunir en un solo lugar todos los límites del zip para ajustarlos fácilmente.
// All limits in one place so they are easy to tune
export const MAX_ZIP_SIZE = 50 * 1024 * 1024;       // same as the Supabase free plan limit
const MAX_ENTRIES = 2000;                            // files + folders inside the zip
const MAX_TOTAL_UNCOMPRESSED = 300 * 1024 * 1024;    // everything, once extracted
const MAX_COMPOSE_BYTES = 64 * 1024;
const MAX_DOCKERFILE_BYTES = 64 * 1024;
const MAX_NAME_LENGTH = 255;
const ALLOWED_METHODS = new Set([0, 8]);             // 0 = stored, 8 = deflate
const IGNORED_ROOTS = new Set(['__MACOSX']);         // junk folder created by zipping on macOS
// Esta constante se encarga de reconocer los distintos nombres válidos de un archivo compose.
const COMPOSE_NAME = /^(docker-)?compose(\.[^/]+)?\.ya?ml$/i;

// Esta constante se encarga de representar un error de regla del zip (su mensaje se muestra al usuario).
// Thrown for "this zip breaks a rule" (message is shown to the user), as opposed to unexpected errors
class ZipRuleError extends Error {}
// Esta constante se encarga de lanzar de forma breve un error de regla del zip.
const fail = (message) => { throw new ZipRuleError(message); };

// Esta constante se encarga de comprobar que el buffer empiece con la firma mágica de un zip.
const hasZipSignature = (buffer) =>
    buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

// Esta constante se encarga de abrir el zip desde el buffer en memoria y devolver una promesa.
const openZip = (buffer) => new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (err, zipfile) => {
        if (err) reject(err); else resolve(zipfile);
    });
});

// Esta constante se encarga de leer el índice del zip (la lista de entradas) sin descomprimir nada todavía.
// Reads the zip's index (the list of entries). Nothing is decompressed yet.
const readEntries = (zipfile) => new Promise((resolve, reject) => {
    const entries = [];
    zipfile.on('error', reject);
    zipfile.on('end', () => resolve(entries));
    zipfile.on('entry', (entry) => {
        if (entries.length >= MAX_ENTRIES) {
            return reject(new ZipRuleError(`El zip tiene demasiados archivos (máximo ${MAX_ENTRIES})`));
        }
        entries.push(entry);
        zipfile.readEntry();
    });
    zipfile.readEntry();
});

// Esta constante se encarga de descomprimir por completo una entrada; sirve para confirmar que el tamaño
// real coincide con el declarado y, con keep=true, devolver su contenido.
// Fully decompresses one entry. yauzl errors out if the real size differs from the declared size,
// which is what stops headers that lie. With keep=true the content is returned, otherwise discarded.
const readEntryData = (zipfile, entry, keep) => new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
        if (err) return reject(err);
        const chunks = [];
        stream.on('data', (chunk) => { if (keep) chunks.push(chunk); });
        stream.on('end', () => resolve(keep ? Buffer.concat(chunks) : null));
        stream.on('error', reject);
    });
});

// Esta función se encarga de validar una entrada del zip: cifrado, método de compresión, nombre y tipo de archivo.
function checkEntry(entry) {
    const name = entry.fileName;

    // Validaciones: rechaza zips cifrados, métodos no soportados y nombres inválidos.
    if (entry.isEncrypted()) fail('El zip está protegido con contraseña; súbelo sin cifrar');
    if (!ALLOWED_METHODS.has(entry.compressionMethod)) fail('El zip usa un método de compresión no soportado');
    if (name.length > MAX_NAME_LENGTH || /[\x00-\x1f]/.test(name)) fail('El zip contiene nombres de archivo no válidos');

    // En zips hechos en Unix, revisa los bits del tipo de archivo para rechazar enlaces simbólicos o especiales.
    // Zips made on Unix store the file type in the top bits of externalFileAttributes
    const isUnix = (entry.versionMadeBy >> 8) === 3;
    if (isUnix) {
        const type = (entry.externalFileAttributes >>> 16) & 0o170000;
        const isNormal = type === 0 || type === 0o100000 || type === 0o040000; // none, file, folder
        if (!isNormal) fail('El zip contiene enlaces simbólicos o archivos especiales');
    }
}

// Esta función se encarga de validar de principio a fin el zip del laboratorio y devolver '' si todo está bien
// o un mensaje de error para mostrar al usuario.
// Returns '' when the zip is fine, otherwise a message to show the user
export async function getZipError(buffer) {
    // Todo el proceso va dentro de un try/catch: los errores de regla se convierten en mensaje y el resto se registra.
    try {
        // Validaciones rápidas previas: archivo no vacío, dentro del límite de tamaño y con firma de zip.
        if (!buffer || buffer.length === 0) return 'El archivo está vacío';
        if (buffer.length > MAX_ZIP_SIZE) return 'El archivo supera el límite de 50 MB';
        if (!hasZipSignature(buffer)) return 'El archivo no es un zip válido';

        const zipfile = await openZip(buffer);
        const entries = await readEntries(zipfile);

        // Paso 1: valida solo con el índice del zip (sin descomprimir).
        // Pass 1: rules that only need the index
        let totalSize = 0;
        const seenNames = new Set();
        const roots = new Set();

        for (const entry of entries) {
            checkEntry(entry);

            // Rechaza nombres duplicados (ignorando mayúsculas/minúsculas).
            const key = entry.fileName.toLowerCase();
            if (seenNames.has(key)) fail('El zip contiene archivos duplicados');
            seenNames.add(key);

            // Suma los tamaños declarados para no superar el máximo descomprimido.
            totalSize += entry.uncompressedSize;
            if (totalSize > MAX_TOTAL_UNCOMPRESSED) fail('El contenido del zip descomprimido es demasiado grande');

            // Recoge la carpeta raíz de cada entrada (ignorando basura como __MACOSX).
            const root = entry.fileName.split('/')[0];
            if (!IGNORED_ROOTS.has(root)) roots.add(root);
        }

        // Exige que todo cuelgue de una única carpeta raíz.
        if (roots.size !== 1) fail('El zip debe contener una única carpeta raíz con todo el laboratorio dentro');
        const [root] = roots;
        const composeName = `${root}/compose.yaml`;

        // Recorre las entradas para asegurar que solo exista un compose (con el nombre correcto) y ningún .env en la raíz.
        for (const entry of entries) {
            const name = entry.fileName;
            if (name.endsWith('/')) continue;

            const baseName = name.split('/').pop();
            if (COMPOSE_NAME.test(baseName) && name !== composeName) {
                fail('Solo puede haber un archivo compose, y debe llamarse compose.yaml dentro de la carpeta raíz');
            }
            if (name === `${root}/.env`) fail('No se permite un archivo .env en la carpeta raíz');
        }

        // Localiza el compose.yaml y comprueba que exista y no sea demasiado grande.
        const composeEntry = entries.find((entry) => entry.fileName === composeName);
        if (!composeEntry) fail('No se encontró compose.yaml dentro de la carpeta raíz');
        if (composeEntry.uncompressedSize > MAX_COMPOSE_BYTES) fail('compose.yaml es demasiado grande');

        // Paso 2: descomprime todo una vez para confirmar que los tamaños declarados son reales
        // y, de paso, guarda el texto del compose.yaml.
        // Pass 2: decompress everything once to confirm the declared sizes are real
        let composeText = '';
        for (const entry of entries) {
            if (entry.fileName.endsWith('/')) continue;
            const isCompose = entry === composeEntry;
            const data = await readEntryData(zipfile, entry, isCompose);
            if (isCompose) composeText = data.toString('utf8');
        }

        // Intenta parsear el compose.yaml rechazando alias/anclas YAML (fail closed) dentro de un try/catch.
        // Parse compose.yaml. maxAliasCount: 0 rejects YAML anchors/aliases (fail closed),
        // and "<<" merge keys are not supported by this parser, so they end up rejected by the allowlist.
        let compose;
        try {
            compose = parseYaml(composeText, { maxAliasCount: 0 });
        } catch {
            fail('compose.yaml no es un YAML válido (los alias y anclas YAML no están permitidos)');
        }

        // Valida el contenido del compose con las reglas de composeValidation.
        const composeProblem = getComposeError(compose);
        if (composeProblem) fail(composeProblem);

        // Revisa cada Dockerfile referenciado por el compose: que exista, no sea enorme y pase su propia validación.
        // Check every Dockerfile that compose.yaml builds from
        for (const relativePath of getDockerfilePaths(compose)) {
            const entry = entries.find((e) => e.fileName === `${root}/${relativePath}`);
            if (!entry) fail(`No se encontró el Dockerfile "${relativePath}" que usa compose.yaml`);
            if (entry.uncompressedSize > MAX_DOCKERFILE_BYTES) fail(`El Dockerfile "${relativePath}" es demasiado grande`);

            const data = await readEntryData(zipfile, entry, true);
            const dockerfileProblem = getDockerfileError(data.toString('utf8'));
            if (dockerfileProblem) fail(`Dockerfile "${relativePath}": ${dockerfileProblem}`);
        }

        return '';
    } catch (err) {
        if (err instanceof ZipRuleError) return err.message;
        console.error('Zip validation error:', err);
        return 'El archivo no es un zip válido o está dañado';
    }
}