import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = path.join(__dirname, '../content/creation-guide.md');

// Read on every request so edits to the .md show up without restarting the server
export async function getCreationGuide() {
    return readFile(GUIDE_PATH, 'utf8');
}