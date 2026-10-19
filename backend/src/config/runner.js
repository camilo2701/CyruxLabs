import dotenv from 'dotenv';

dotenv.config();

// Where the lab runner (the Linux VM that builds and runs the labs) listens.
// Set RUNNER_URL in the backend .env to change it; the default is the address used so far.
export const RUNNER_URL = process.env.RUNNER_URL || 'http://10.10.0.12:4000';
