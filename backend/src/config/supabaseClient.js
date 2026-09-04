import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el archivo .env'
    );
}

// service_role key: se usa SOLO en el backend, nunca en el frontend.
// Se salta las políticas de Row Level Security, así que el propio
// backend es responsable de validar todo antes de leer/escribir.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);