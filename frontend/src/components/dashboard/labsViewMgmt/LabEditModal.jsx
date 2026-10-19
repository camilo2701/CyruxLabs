import { useConfirm } from '../../ConfirmContext.jsx';
import { useLabEditor, TABS } from './useLabEditor.js';
import { useLabFileUpdate } from './useLabFileUpdate.js';
import LabGeneralSection from './LabGeneralSection.jsx';
import LabInstructionsSection from './LabInstructionsSection.jsx';
import LabTrophiesSection from './LabTrophiesSection.jsx';
import LabFileUpdateSection from './LabFileUpdateSection.jsx';

// The window to manage one lab. It is wide and has tabs because it holds as much as the create form.
// While the bug reports window is open this one is only hidden (hidden), not removed, so nothing
// that was typed and not saved is lost when the person comes back.
function LabEditModal({ lab, token, isAdmin, bugCount, hidden, onClose, onOpenBugReports, onChanged, onDeleted }) {
  const confirm = useConfirm();
  const editor = useLabEditor({ lab, token, onSaved: onChanged, onDeleted });
  const fileUpdate = useLabFileUpdate({
    labid: lab.labid,
    token,
    isAdmin,
    detail: editor.detail,
    refreshMeta: editor.refreshMeta,
  });

  const busy = editor.isSaving || editor.isDeleting;
  const ready = editor.loadState === 'ready';

  const requestClose = async () => {
    if (editor.hasChanges) {
      const discard = await confirm({
        title: '¿Descartar los cambios?',
        message: 'Hay cambios sin guardar en este laboratorio. Si cierras, se perderán.',
        confirmText: 'Sí, descartar',
        cancelText: 'Seguir editando',
      });
      if (!discard) return;
    }
    onClose();
  };

  // A tab is marked when it holds unsaved changes (or, for the file tab, a pending update)
  const tabMark = (id) => {
    if (id === 'file') return editor.detail?.pendingUpdate ? 'pendiente' : null;
    return editor.dirty[id] ? 'sin guardar' : null;
  };

  const panel = (id) => ({ hidden: editor.activeTab !== id, role: 'tabpanel' });

  return (
    <div
      className="lvm-overlay"
      style={hidden ? { display: 'none' } : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="lvm-modal" role="dialog" aria-modal="true" aria-label={`Administrar laboratorio ${lab.labid}`}>

        <button type="button" className="lvm-close" onClick={requestClose} aria-label="Cerrar">×</button>

        <div className="lvm-header">
          <span className="lvm-eyebrow">LABORATORIO #{lab.labid}</span>
          <h2 className="lvm-title">{editor.detail?.title ?? lab.title}</h2>
        </div>

        <div className="lvm-tabs" role="tablist">
          {TABS.map((tab) => {
            const mark = tabMark(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={editor.activeTab === tab.id}
                className={`lvm-tab${editor.activeTab === tab.id ? ' lvm-tab--active' : ''}`}
                onClick={() => editor.setActiveTab(tab.id)}
                disabled={!ready}
              >
                {tab.label}
                {mark && <span className="lvm-tab-mark">{mark}</span>}
              </button>
            );
          })}
        </div>

        <div className="lvm-body">
          {editor.loadState === 'loading' && <div className="lvm-state">Cargando laboratorio...</div>}

          {editor.loadState === 'error' && (
            <div className="lvm-state">
              <p className="lvm-error">{editor.loadError}</p>
              <button type="button" className="lvm-button" onClick={() => editor.reload()}>
                Reintentar
              </button>
            </div>
          )}

          {ready && (
            <>
              {/* Every tab stays mounted and the inactive ones are only hidden, so what was typed in one is not lost when switching */}
              <div {...panel('general')}><LabGeneralSection editor={editor} /></div>
              <div {...panel('instructions')}><LabInstructionsSection editor={editor} /></div>
              <div {...panel('trophies')}><LabTrophiesSection editor={editor} /></div>
              <div {...panel('file')}><LabFileUpdateSection fileUpdate={fileUpdate} /></div>
            </>
          )}
        </div>

        <div className="lvm-footer">
          <div className="lvm-footer-message">
            {editor.message && (
              <span
                className={
                  editor.message.type === 'success' ? 'lvm-success' : editor.message.type === 'error' ? 'lvm-error' : 'lvm-hint'
                }
              >
                {editor.message.text}
              </span>
            )}
            {!editor.message && editor.activeTab === 'file' && (
              <span className="lvm-hint">
                Esta pestaña tiene su propio botón. «Guardar cambios» guarda las demás pestañas.
              </span>
            )}
          </div>

          <div className="lvm-footer-actions">
            <button type="button" className="lvm-button" onClick={onOpenBugReports} disabled={busy}>
              Reportes de bugs
              {bugCount > 0 && <span className="lab-bug-badge lab-bug-badge--inline">{bugCount}</span>}
            </button>

            <button type="button" className="lvm-button lvm-button--danger" onClick={editor.deleteLab} disabled={busy || !ready}>
              {editor.isDeleting ? 'Eliminando...' : 'Eliminar laboratorio'}
            </button>

            <button
              type="button"
              className="lvm-button lvm-button--primary"
              onClick={editor.save}
              disabled={busy || !ready || !editor.hasChanges}
            >
              {editor.isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LabEditModal;
