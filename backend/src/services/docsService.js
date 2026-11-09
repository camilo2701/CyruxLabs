// Este archivo se encarga de leer desde disco la guía de creación de laboratorios
// (archivo Markdown) para que el backend pueda entregarla al frontend.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Esta constante se encarga de resolver la ruta absoluta del archivo de la guía,
// partiendo de la ubicación de este módulo (necesario en ESM, que no tiene __dirname).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.join(__dirname, '../content/creation-guide.md');

// Esta función se encarga de leer y devolver el contenido de la guía de creación.
// Read on every request so edits to the .md show up without restarting the server
export async function getCreationGuide() {
    return readFile(GUIDE_PATH, 'utf8');
}