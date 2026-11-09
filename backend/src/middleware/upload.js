// Este archivo se encarga de configurar la subida del archivo .zip del laboratorio con Multer:
// lo mantiene en memoria, limita su tamaño y cantidad, y traduce los errores de Multer en
// respuestas JSON limpias para el frontend.

import multer from 'multer';

export const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB, el mismo límite del plan gratuito de Supabase

// Configura Multer: guarda el archivo en memoria y limita a un solo archivo, 10 campos y el tamaño máximo
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ZIP_SIZE, files: 1, fields: 10 },
});

// Este middleware se encarga de recibir el .zip ('zipfile') y convertir los errores de Multer en
// una respuesta JSON clara, en vez de la página HTML de error por defecto de Express.
export const uploadLabZip = (req, res, next) => {
    upload.single('zipfile')(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            // Caso típico: el archivo supera el límite de tamaño permitido
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'El archivo supera el límite de 50 MB' });
            }
            return res.status(400).json({ message: 'No se pudo procesar el archivo subido' });
        }
        next(err);
    });
};

export default upload;
