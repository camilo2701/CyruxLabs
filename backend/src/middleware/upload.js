import multer from 'multer';

export const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB, same as the Supabase free plan limit

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ZIP_SIZE, files: 1, fields: 10 },
});

// Wrapper so Multer's errors become a clean JSON response instead of Express's default HTML page
export const uploadLabZip = (req, res, next) => {
    upload.single('zipfile')(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'El archivo supera el límite de 50 MB' });
            }
            return res.status(400).json({ message: 'No se pudo procesar el archivo subido' });
        }
        next(err);
    });
};

export default upload;