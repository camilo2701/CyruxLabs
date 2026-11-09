// Este archivo se encarga de levantar el servidor: crea la aplicación de Express, aplica
// la seguridad y la configuración general (helmet, CORS, JSON), monta todas las rutas de la API
// y pone el servidor a escuchar, arrancando además la tarea que aplica las actualizaciones pendientes.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import labsRoutes from './routes/labsRoutes.js';
import bugReportRoutes from './routes/bugReportRoutes.js';
import docsRoutes from './routes/docsRoutes.js';
import logRoutes from './routes/logRoutes.js';
import { startPendingUpdateSweeper } from './services/labUpdateService.js';

// Carga las variables de entorno (.env) para poder usarlas en toda la aplicación
dotenv.config();

const app = express();

// Middlewares globales: helmet agrega cabeceras de seguridad, CORS permite que el frontend
// hable con la API (enviando credenciales) y express.json deja leer el cuerpo JSON de las peticiones
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Monta cada grupo de rutas bajo su prefijo correspondiente
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/labs', labsRoutes);
app.use('/api/bugreports', bugReportRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/logs', logRoutes);

// Ruta raíz de prueba para comprobar rápidamente que el backend está vivo
app.get('/', (req, res) => {
    res.json({ status: 'cyrux backend funcionando' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);

    // Aplica las actualizaciones de zip + flag que estaban esperando a que el lab quedara libre
    startPendingUpdateSweeper();
});
