// Este archivo se encarga de crear y exportar el cliente de Supabase que usa todo el backend,
// leyendo sus credenciales del .env y validando que estén presentes.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

// Validación: sin URL o clave de servicio el backend no puede arrancar.
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el archivo .env'
    );
}

// service_role key: se usa SOLO en el backend, nunca en el frontend.
// Se salta las políticas de Row Level Security, así que el propio
// backend es responsable de validar todo antes de leer/escribir.
// Esta constante se encarga de exponer el cliente de Supabase ya configurado para el backend.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);