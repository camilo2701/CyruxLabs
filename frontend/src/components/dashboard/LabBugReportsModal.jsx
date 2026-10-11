import { useEffect, useState } from 'react';
import '../../styles/LabBugReportsModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const STATUS = {
  PENDING: 0,
  RESOLVED: 1,
};

function formatDate(dateString) {
  if (!dateString) return '—';
  // dateofcreation viene como "YYYY-MM-DD": se arma como fecha local
  // para que no se corra un día por la zona horaria.
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Modal de revisión de reportes de un laboratorio.
// - onBack: vuelve al modal de "Administrar" del mismo lab.
// - onClose: cierra todo.
// - onPendingCountChange(labid, cantidad): para actualizar el globo rojo de la tabla.
function LabBugReportsModal({ lab, token, onBack, onClose, onPendingCountChange }) {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState(STATUS.PENDING);
  const [selectedId, setSelectedId] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/bugreports/lab/${lab.labid}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.message || 'No se pudieron cargar los reportes.');
          return;
        }
        setReports(data.reports || []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoadError('No se pudo conectar con el servidor.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [lab.labid, token]);

  const pendingReports = reports.filter((r) => r.status === STATUS.PENDING);
  const resolvedReports = reports.filter((r) => r.status === STATUS.RESOLVED);
  const visibleReports = activeTab === STATUS.PENDING ? pendingReports : resolvedReports;
  const selectedReport = reports.find((r) => r.bugreportid === selectedId) || null;

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSelectedId(null);
    setMessage({ type: '', text: '' });
  };

  const selectReport = (id) => {
    setSelectedId(id);
    setMessage({ type: '', text: '' });
  };

  const handleToggleStatus = async () => {
    if (!selectedReport) return;

    const newStatus = selectedReport.status === STATUS.PENDING ? STATUS.RESOLVED : STATUS.PENDING;

    setIsUpdating(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_URL}/bugreports/${selectedReport.bugreportid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.message || 'No se pudo actualizar el reporte.' });
        return;
      }

      const updatedReports = reports.map((r) =>
        r.bugreportid === selectedReport.bugreportid ? { ...r, status: newStatus } : r
      );
      setReports(updatedReports);
      onPendingCountChange?.(
        lab.labid,
        updatedReports.filter((r) => r.status === STATUS.PENDING).length
      );

      // El reporte pasa a la otra pestaña; se mantiene el detalle a la vista.
      setMessage({
        type: 'success',
        text:
          newStatus === STATUS.RESOLVED
            ? 'Reporte marcado como resuelto. Lo encontrarás en la pestaña "Resueltos".'
            : 'Reporte marcado como pendiente. Lo encontrarás en la pestaña "Pendientes".',
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="manage-users__modal-overlay" onClick={onClose}>
      <div className="bug-reports__modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="manage-users__modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="bug-reports__header">
          <span className="manage-users__eyebrow">LABORATORIO #{lab.labid} · REPORTES</span>
          <h2>{lab.title}</h2>
        </div>

        <div className="bug-reports__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === STATUS.PENDING}
            className={`bug-reports__tab ${activeTab === STATUS.PENDING ? 'bug-reports__tab--active' : ''}`}
            onClick={() => changeTab(STATUS.PENDING)}
          >
            Pendientes
            <span className="bug-reports__tab-count">{pendingReports.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === STATUS.RESOLVED}
            className={`bug-reports__tab ${activeTab === STATUS.RESOLVED ? 'bug-reports__tab--active' : ''}`}
            onClick={() => changeTab(STATUS.RESOLVED)}
          >
            Resueltos
            <span className="bug-reports__tab-count">{resolvedReports.length}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="bug-reports__empty">Cargando reportes...</div>
        ) : loadError ? (
          <div className="bug-reports__empty">{loadError}</div>
        ) : (
          <div className="bug-reports__body">
            {/* Lista */}
            <ul className="bug-reports__list">
              {visibleReports.length === 0 && (
                <li className="bug-reports__list-empty">
                  {activeTab === STATUS.PENDING
                    ? 'No hay reportes pendientes.'
                    : 'No hay reportes resueltos.'}
                </li>
              )}

              {visibleReports.map((report) => (
                <li key={report.bugreportid}>
                  <button
                    type="button"
                    className={`bug-reports__item ${
                      report.bugreportid === selectedId ? 'bug-reports__item--selected' : ''
                    }`}
                    onClick={() => selectReport(report.bugreportid)}
                  >
                    <span className="bug-reports__item-title">{report.title}</span>
                    <span className="bug-reports__item-meta">
                      {report.username} · {formatDate(report.dateofcreation)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Detalle */}
            <div className="bug-reports__detail">
              {!selectedReport ? (
                <div className="bug-reports__detail-empty">
                  Selecciona un reporte de la lista para ver su detalle.
                </div>
              ) : (
                <>
                  <div className="bug-reports__detail-header">
                    <h3>{selectedReport.title}</h3>
                    <span
                      className={`bug-reports__status ${
                        selectedReport.status === STATUS.PENDING
                          ? 'bug-reports__status--pending'
                          : 'bug-reports__status--resolved'
                      }`}
                    >
                      {selectedReport.status === STATUS.PENDING ? 'Pendiente' : 'Resuelto'}
                    </span>
                  </div>

                  <dl className="bug-reports__meta">
                    <div>
                      <dt>Reportado por</dt>
                      <dd>{selectedReport.username}</dd>
                    </div>
                    <div>
                      <dt>Fecha de creación</dt>
                      <dd>{formatDate(selectedReport.dateofcreation)}</dd>
                    </div>
                    <div>
                      <dt>ID del reporte</dt>
                      <dd>#{selectedReport.bugreportid}</dd>
                    </div>
                  </dl>

                  <div className="bug-reports__description">
                    <span>Descripción</span>
                    <p>{selectedReport.description}</p>
                  </div>

                  <button
                    type="button"
                    className={`bug-reports__status-button ${
                      selectedReport.status === STATUS.PENDING
                        ? 'bug-reports__status-button--resolve'
                        : ''
                    }`}
                    onClick={handleToggleStatus}
                    disabled={isUpdating}
                  >
                    {isUpdating
                      ? 'Guardando...'
                      : selectedReport.status === STATUS.PENDING
                        ? '✓ Marcar como resuelto'
                        : '↺ Marcar como pendiente'}
                  </button>

                  {message.text && (
                    <p className={`bug-reports__message bug-reports__message--${message.type}`}>
                      {message.text}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="bug-reports__footer">
          <button type="button" className="bug-reports__back-button" onClick={onBack}>
            ← Volver a administrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default LabBugReportsModal;
