// Este archivo se encarga de definir la ruta de documentación que devuelve la guía de creación de
// laboratorios en formato Markdown.
import { Router } from 'express';
import { getCreationGuideMarkdown } from '../controllers/docsController.js';

const router = Router();

// Ruta que entrega la guía de creación de laboratorios en Markdown
router.get('/creation-guide', getCreationGuideMarkdown);

export default router;