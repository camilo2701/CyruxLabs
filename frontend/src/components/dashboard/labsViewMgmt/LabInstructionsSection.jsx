// Este archivo se encarga de la pestaña "Instrucciones": un editor Markdown con
// modos escribir/vista previa e importación de archivos .md para las instrucciones
// que verán los estudiantes del laboratorio.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MarkdownView from '../../MarkdownView.jsx';
import { useConfirm } from '../../ConfirmContext.jsx';
import { INSTRUCTIONS_MAX } from '../../../utils/labRules.js';

// Esta constante se encarga de limitar el tamaño del .md que se puede importar.
const MAX_IMPORT_BYTES = 100 * 1024;

// Este componente se encarga de renderizar el editor de instrucciones del laboratorio.
// "Instrucciones" tab. Same editor as when creating a lab. A saved change is live right away,
// also for students who already have the lab open.
function LabInstructionsSection({ editor }) {
  const { instructions, setInstructions, validateInstructions, errors } = editor;

  const confirm = useConfirm();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('write'); // 'write' | 'preview'
  const [importError, setImportError] = useState('');

  // Esta función se encarga de validar y leer un .md en el navegador y volcar su
  // texto en el editor (no se sube nada al servidor).
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
      // Lee el contenido y normaliza los saltos de línea de Windows (\r\n) a \n.
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

    // Si ya hay texto escrito, pide confirmación antes de sobrescribirlo con el archivo.
    if (instructions.trim() !== '') {
      const ok = await confirm({
        title: '¿Reemplazar las instrucciones?',
        message: 'Lo que hay escrito ahora se reemplazará con el contenido del archivo.',
        confirmText: 'Sí, reemplazar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
    }

    setInstructions(text);
    validateInstructions(text);
    setMode('write');
  };

  // Esta función se encarga de procesar el archivo elegido desde el selector de archivos.
  const handlePick = (event) => {
    importFile(event.target.files[0]);
    // Clear the input so picking the same file again still fires onChange
    event.target.value = '';
  };

  // Esta función se encarga de procesar el archivo soltado sobre el editor (drag and drop).
  const handleDrop = (event) => {
    event.preventDefault();
    importFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="lvm-instructions">
      <div className="lvm-instructions-header">
        <span className="lvm-label lvm-instructions-title">Instrucciones para estudiantes (Markdown)</span>

        <div className="lvm-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className={`lvm-switch-option${mode === 'write' ? ' lvm-switch-option--active' : ''}`}
            onClick={() => setMode('write')}
          >
            Escribir
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            className={`lvm-switch-option${mode === 'preview' ? ' lvm-switch-option--active' : ''}`}
            onClick={() => setMode('preview')}
          >
            Vista previa
          </button>
        </div>

        <button
          type="button"
          className="lvm-button lvm-button--primary"
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

      {/* Según el modo activo, muestra el área de texto editable o la vista previa del Markdown */}
      {mode === 'write' ? (
        <textarea
          className={`lvm-instructions-box lvm-instructions-textarea${errors.instructions ? ' lvm-input--error' : ''}`}
          value={instructions}
          maxLength={INSTRUCTIONS_MAX}
          onChange={(event) => setInstructions(event.target.value)}
          onBlur={(event) => validateInstructions(event.target.value)}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        />
      ) : (
        <div className="lvm-instructions-box lvm-instructions-preview">
          {instructions.trim() === '' ? (
            <p className="lvm-hint">Todavía no hay nada que mostrar.</p>
          ) : (
            <MarkdownView markdown={instructions} />
          )}
        </div>
      )}

      <div className="lvm-field-footer">
        <span className="lvm-hint">
          Los cambios se ven apenas guardes, también para quien ya tiene el laboratorio abierto.{' '}
          <Link to="/docs#formato-markdown-disponible" target="_blank" rel="noopener noreferrer">
            Formato disponible
          </Link>
        </span>
        <span className="lvm-counter">{instructions.length}/{INSTRUCTIONS_MAX}</span>
      </div>

      {importError && <p className="lvm-error">{importError}</p>}
      {errors.instructions && <p className="lvm-error">{errors.instructions}</p>}
    </div>
  );
}

export default LabInstructionsSection;
