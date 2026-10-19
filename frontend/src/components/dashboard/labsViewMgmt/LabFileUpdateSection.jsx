import { useRef, useState } from 'react';
import { FLAG_MAX } from '../../../utils/labRules.js';

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-CL') : '');

// "Archivo y flag" tab. The new zip and the flag are one change: the flag has to be the one the
// instructor hid inside the new zip. The change is queued and applied when the lab has no open session.
function LabFileUpdateSection({ fileUpdate }) {
  const {
    pending, currentFlag, file, chooseFile, fileError,
    newFlag, changeFlag, fillGeneratedFlag, validateFlag, flagError,
    message, isBusy, isAdmin, submit, cancelPending, applyNow,
  } = fileUpdate;

  const fileInputRef = useRef(null);
  const [showFlag, setShowFlag] = useState(false);

  const handlePick = (event) => {
    chooseFile(event.target.files[0]);
    // Clear the input so picking the same file again still fires onChange
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="lvm-file-update">

      <div className="lvm-callout">
        <strong>Cómo funciona</strong>
        <ul>
          <li>
            <b>La flag debe coincidir con la que escondiste dentro del archivo comprimido.</b> Si no
            coincide, nadie podrá resolver el laboratorio.
          </li>
          <li>
            El cambio no es inmediato: se aplica cuando el laboratorio no tenga sesiones activas, para
            que quien está jugando termine con el archivo y la flag con los que empezó.
          </li>
          <li>
            Mientras la actualización espera, nadie puede iniciar sesiones nuevas de este laboratorio
            (las que ya están abiertas siguen funcionando).
          </li>
          <li>Revisa que tus trofeos de comando o proceso sigan siendo posibles con el archivo nuevo.</li>
        </ul>
      </div>

      <div className="lvm-field">
        <span className="lvm-label">Flag actual</span>
        <div className="lvm-flag-current">
          <code>{showFlag ? currentFlag : '•'.repeat(Math.min(currentFlag.length || 12, 24))}</code>
          <button type="button" className="lvm-button" onClick={() => setShowFlag((visible) => !visible)}>
            {showFlag ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {pending && (
        <div className="lvm-pending">
          <div className="lvm-pending-title">Actualización pendiente</div>
          <p>
            Programada el {formatDateTime(pending.dateofcreation)}. Se aplicará cuando no haya sesiones
            activas ({pending.openSessions} activa{pending.openSessions === 1 ? '' : 's'} ahora).
            Mientras tanto, este laboratorio no acepta sesiones nuevas.
          </p>
          {pending.lasterror && <p className="lvm-error">{pending.lasterror}</p>}

          <div className="lvm-actions-row">
            <button type="button" className="lvm-button" onClick={cancelPending} disabled={isBusy}>
              Cancelar actualización
            </button>
            {isAdmin && (
              <button
                type="button"
                className="lvm-button lvm-button--danger"
                onClick={applyNow}
                disabled={isBusy || pending.openSessions === 0}
                title={pending.openSessions === 0 ? 'No hay sesiones que cerrar: se aplicará sola en un momento' : undefined}
              >
                Aplicar ahora (cierra las sesiones)
              </button>
            )}
          </div>
        </div>
      )}

      <div className="lvm-field">
        <span className="lvm-label">
          {pending ? 'Reemplazar la actualización pendiente' : 'Programar una actualización'}
        </span>

        <div
          className={`lvm-dropzone${fileError ? ' lvm-dropzone--error' : ''}`}
          onClick={() => fileInputRef.current.click()}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') fileInputRef.current.click();
          }}
        >
          {file ? (
            <span><b>{file.name}</b> · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
          ) : (
            <span>Arrastra el nuevo .zip aquí o haz clic para elegirlo (máx. 50 MB)</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={handlePick}
          hidden
        />
        {fileError && <p className="lvm-error">{fileError}</p>}
      </div>

      <div className="lvm-field">
        <label className="lvm-label" htmlFor="lvm-new-flag">Flag del archivo nuevo</label>
        <div className="lvm-flag-input">
          <input
            id="lvm-new-flag"
            type="text"
            className={`lvm-input lvm-input--mono${flagError ? ' lvm-input--error' : ''}`}
            maxLength={FLAG_MAX}
            autoComplete="off"
            spellCheck={false}
            value={newFlag}
            onChange={(event) => changeFlag(event.target.value)}
            onBlur={validateFlag}
          />
          <button type="button" className="lvm-button lvm-button--primary" onClick={fillGeneratedFlag}>
            Generar
          </button>
        </div>
        <p className="lvm-hint">
          Viene con la flag actual: déjala igual si solo cambia el archivo. Si la cambias, esa misma
          flag debe estar escondida dentro del zip nuevo.
        </p>
        {flagError && <p className="lvm-error">{flagError}</p>}
      </div>

      {message && (
        <p className={message.type === 'success' ? 'lvm-success' : 'lvm-error'}>{message.text}</p>
      )}

      <div className="lvm-actions-row">
        <button type="button" className="lvm-button lvm-button--primary" onClick={submit} disabled={isBusy}>
          {isBusy ? 'Procesando...' : 'Programar actualización'}
        </button>
      </div>

    </div>
  );
}

export default LabFileUpdateSection;
