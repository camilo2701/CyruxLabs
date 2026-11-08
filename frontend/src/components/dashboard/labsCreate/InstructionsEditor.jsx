// Este archivo se encarga del editor de instrucciones (en Markdown) al crear un laboratorio:
// permite escribir, previsualizar e importar un archivo .md con validaciones de formato y tamaño.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MarkdownView from '../../MarkdownView.jsx';
import { useConfirm } from '../../ConfirmContext.jsx';
import { INSTRUCTIONS_MAX } from '../../../utils/labRules.js';

// Esta constante se encarga de fijar el tamaño máximo (en bytes) permitido para el archivo .md importado.
const MAX_IMPORT_BYTES = 100 * 1024;

// Esta constante se encarga de definir el texto de ejemplo (placeholder) mostrado en el área de escritura.
const PLACEHOLDER = `Escribe los pasos que seguirá el estudiante, por ejemplo:

1. **Abre una terminal:** ve a *Applications → Terminal*.
2. **Explora el sitio:** ejecuta \`curl http://mitienda.com\`.

Puedes usar títulos (##), listas, negritas y bloques de código.`;

// Este componente se encarga de renderizar el editor de instrucciones con pestañas de escritura
// y vista previa, además del botón e importación de archivos .md.
function InstructionsEditor({ value, onChange, onBlur, error }) {
    const confirm = useConfirm();
    const fileInputRef = useRef(null);
    const [tab, setTab] = useState('write'); // 'write' | 'preview'
    const [importError, setImportError] = useState('');

    // Esta función se encarga de leer y validar un archivo .md en el navegador y volcar su texto al editor
    // (comprueba extensión, tamaño, que no esté vacío y el límite de caracteres, pidiendo confirmación si hay texto previo).
    // Reads an .md file in the browser and puts its text in the editor (nothing is uploaded)
    const importFile = async (file) => {
        setImportError('');
        if (!file) return;

        const name = file.name.toLowerCase();
        if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
            setImportError('Formato inválido, debes subir un archivo .md');
            return;
        }

        if (file.size > MAX_IMPORT_BYTES) {
            setImportError('El archivo es demasiado grande (máximo 100 KB)');
            return;
        }

        let text;
        try {
            text = (await file.text()).replace(/\r\n/g, '\n');
        } catch {
            setImportError('No se pudo leer el archivo');
            return;
        }

        if (text.trim() === '') {
            setImportError('El archivo está vacío');
            return;
        }

        if (text.length > INSTRUCTIONS_MAX) {
            setImportError(`El archivo supera los ${INSTRUCTIONS_MAX} caracteres permitidos`);
            return;
        }

        if (value.trim() !== '') {
            const ok = await confirm({
                title: '¿Reemplazar las instrucciones?',
                message: 'Lo que ya escribiste se reemplazará con el contenido del archivo.',
                confirmText: 'Sí, reemplazar',
                cancelText: 'Cancelar',
            });
            if (!ok) return;
        }

        onChange(text);
        onBlur(text);
        setTab('write');
    };

    // Esta función se encarga de procesar el archivo elegido desde el selector de archivos.
    const handlePick = (e) => {
        importFile(e.target.files[0]);
        // Clear the input so picking the same file again still fires onChange
        e.target.value = '';
    };

    // Esta función se encarga de procesar el archivo soltado (drag & drop) sobre el editor.
    const handleDrop = (e) => {
        e.preventDefault();
        importFile(e.dataTransfer.files[0]);
    };

    // Esta función se encarga de permitir el arrastre evitando el comportamiento por defecto del navegador.
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div className="instructions-editor">
            <div className="instructions-header">
                <span className="instructions-title">Instrucciones para estudiantes (Markdown)</span>

                <div className="instructions-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'write'}
                        className={`instructions-tab ${tab === 'write' ? 'instructions-tab--active' : ''}`}
                        onClick={() => setTab('write')}
                    >
                        Escribir
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'preview'}
                        className={`instructions-tab ${tab === 'preview' ? 'instructions-tab--active' : ''}`}
                        onClick={() => setTab('preview')}
                    >
                        Vista previa
                    </button>
                </div>

                <button
                    type="button"
                    className="instructions-import-btn"
                    onClick={() => fileInputRef.current.click()}
                >
                    Importar .md
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown"
                    onChange={handlePick}
                    hidden
                />
            </div>

            {tab === 'write' ? (
                <textarea
                    className="instructions-textarea"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={(e) => onBlur(e.target.value)}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    maxLength={INSTRUCTIONS_MAX}
                    placeholder={PLACEHOLDER}
                />
            ) : (
                <div className="instructions-preview">
                    {value.trim() === '' ? (
                        <p className="instructions-empty">Todavía no hay nada que mostrar.</p>
                    ) : (
                        <MarkdownView markdown={value} />
                    )}
                </div>
            )}

            <div className="instructions-footer">
                <span>
                    Arrastra un archivo .md sobre el cuadro o usa Importar.{' '}
                    <Link to="/docs#formato-markdown-disponible" target="_blank" rel="noopener noreferrer">
                        Formato disponible
                    </Link>
                </span>
                <span className="instructions-counter">{value.length}/{INSTRUCTIONS_MAX}</span>
            </div>

            {importError && <p className="nebula-error">{importError}</p>}
            <p className="nebula-error">{error}</p>
        </div>
    );
}

export default InstructionsEditor;