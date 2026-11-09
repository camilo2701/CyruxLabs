// Este archivo se encarga de exponer la URL del runner de laboratorios (la VM Linux que
// construye y ejecuta los labs), tomándola del .env o usando un valor por defecto.
import dotenv from 'dotenv';

dotenv.config();

// Where the lab runner (the Linux VM that builds and runs the labs) listens.
// Set RUNNER_URL in the backend .env to change it; the default is the address used so far.
// Esta constante se encarga de guardar la dirección donde escucha el runner de laboratorios.
export const RUNNER_URL = process.env.RUNNER_URL || 'http://10.10.0.12:4000';
