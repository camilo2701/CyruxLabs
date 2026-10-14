import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/DashboardLogs.module.css';

const API_URL = 'http://localhost:4000/api/logs';

const FACILITY_LABELS = {
    auth: 'Autenticación',
    user: 'Usuario',
    lab: 'Laboratorio',
    session: 'Sesión',
};

// What "targetid" points at, per module
const TARGET_LABELS = {
    auth: 'Usuario',
    user: 'Usuario',
    lab: 'Laboratorio',
    session: 'Sesión',
};

const SEVERITY_LABELS = { info: 'Info', warning: 'Advertencia', error: 'Error' };

const ACTION_CLASS = {
    CREATE: styles.actionCreate,
    READ: styles.actionRead,
    UPDATE: styles.actionUpdate,
    DELETE: styles.actionDelete,
};

const ROW_CLASS = { info: '', warning: styles.rowWarning, error: styles.rowError };
const SEVERITY_TEXT_CLASS = { info: styles.sevInfo, warning: styles.sevWarning, error: styles.sevError };

const FILTERS = [
    {
        name: 'facility',
        label: 'Módulo',
        options: Object.entries(FACILITY_LABELS),
    },
    {
        name: 'action',
        label: 'Operación',
        options: [['CREATE', 'CREATE'], ['READ', 'READ'], ['UPDATE', 'UPDATE'], ['DELETE', 'DELETE']],
    },
    {
        name: 'severity',
        label: 'Severidad',
        options: Object.entries(SEVERITY_LABELS),
    },
];

const COLUMN_COUNT = 7;

const formatDate = (iso) =>
    new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'medium' });

const formatFullDate = (iso) =>
    new Date(iso).toLocaleString('es', { dateStyle: 'full', timeStyle: 'medium' });

const displayUser = (log) => log.username ?? (log.userid ? `#${log.userid}` : 'Anónimo');

const displayUserDetail = (log) =>
    log.username && log.userid ? `${log.username} (#${log.userid})` : displayUser(log);

function LogDetail({ log }) {
    return (
        <dl className={styles.detail}>
            <div className={styles.detailWide}>
                <dt>Descripción</dt>
                <dd>{log.description}</dd>
            </div>
            <div>
                <dt>Fecha y hora</dt>
                <dd>{formatFullDate(log.createdat)}</dd>
            </div>
            <div>
                <dt>Usuario</dt>
                <dd>{displayUserDetail(log)}</dd>
            </div>
            <div>
                <dt>Evento</dt>
                <dd className={styles.mono}>{log.event}</dd>
            </div>
            <div>
                <dt>Severidad</dt>
                <dd>
                    <span className={SEVERITY_TEXT_CLASS[log.severity]}>
                        {SEVERITY_LABELS[log.severity] ?? log.severity}
                    </span>
                </dd>
            </div>
            <div>
                <dt>Objeto afectado</dt>
                <dd>{log.targetid ? `${TARGET_LABELS[log.facility]} #${log.targetid}` : '—'}</dd>
            </div>
            <div>
                <dt>Dirección IP</dt>
                <dd className={styles.mono}>{log.ip ?? '—'}</dd>
            </div>
        </dl>
    );
}

function DashboardLogs() {
    const { token } = useAuth();

    const [filters, setFilters] = useState({ facility: '', action: '', severity: '' });
    // One cursor per visited page ("logs older than this id"); the last one is the current page
    const [cursors, setCursors] = useState([null]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedId, setExpandedId] = useState(null);
    const [logs, setLogs] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const currentCursor = cursors[cursors.length - 1];
    const pageNumber = cursors.length;

    // Only the page on screen is requested; moving to another page fetches that one
    useEffect(() => {
        const controller = new AbortController();

        async function loadPage() {
            setLoading(true);
            setError('');

            try {
                const params = new URLSearchParams();
                if (currentCursor) params.set('before', currentCursor);
                Object.entries(filters).forEach(([name, value]) => {
                    if (value) params.set(name, value);
                });

                const response = await fetch(`${API_URL}?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                const result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(result.message || result.error || 'No se pudieron cargar los registros');
                }

                setLogs(result.logs);
                setHasMore(result.hasMore);
            } catch (err) {
                if (err.name === 'AbortError') return;
                setError(err.message || 'No se pudo conectar con el servidor.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        loadPage();
        return () => controller.abort();
    }, [token, filters, currentCursor, refreshKey]);

    const toggleRow = (logid) => setExpandedId((current) => (current === logid ? null : logid));

    const handleFilterChange = (name, value) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
        setCursors([null]);
        setExpandedId(null);
    };

    const goNext = () => {
        setCursors((prev) => [...prev, logs[logs.length - 1].logid]);
        setExpandedId(null);
    };

    const goPrevious = () => {
        setCursors((prev) => prev.slice(0, -1));
        setExpandedId(null);
    };

    // New logs are added at the top, so refreshing goes back to the first page
    const refresh = () => {
        setCursors([null]);
        setExpandedId(null);
        setRefreshKey((key) => key + 1);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <p className={styles.eyebrow}>Sistema</p>
                <h2 className={styles.title}>Registro del sistema</h2>
            </header>

            <div className={styles.card}>
                <div className={styles.toolbar}>
                    {FILTERS.map((filter) => (
                        <label key={filter.name} className={styles.filter}>
                            <span className={styles.filterLabel}>{filter.label}</span>
                            <select
                                className={styles.select}
                                value={filters[filter.name]}
                                onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                            >
                                <option value="">Todos</option>
                                {filter.options.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                    ))}

                    <button type="button" className={styles.refresh} onClick={refresh} disabled={loading}>
                        Actualizar
                    </button>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${loading ? styles.loading : ''}`}>
                        <colgroup>
                            <col className={styles.colToggle} />
                            <col className={styles.colId} />
                            <col className={styles.colDate} />
                            <col className={styles.colUser} />
                            <col className={styles.colAction} />
                            <col className={styles.colFacility} />
                            <col />
                        </colgroup>
                        <thead>
                            <tr>
                                <th aria-label="Detalle" />
                                <th>ID</th>
                                <th>Fecha y hora</th>
                                <th>Usuario</th>
                                <th>Operación</th>
                                <th>Módulo</th>
                                <th>Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                const isOpen = expandedId === log.logid;

                                return (
                                    <Fragment key={log.logid}>
                                        <tr
                                            className={`${styles.row} ${ROW_CLASS[log.severity]} ${
                                                isOpen ? styles.rowOpen : ''
                                            }`}
                                            onClick={() => toggleRow(log.logid)}
                                        >
                                            <td>
                                                {/* The row handles the click; the button gives keyboard users a way in */}
                                                <button
                                                    type="button"
                                                    className={styles.toggle}
                                                    aria-expanded={isOpen}
                                                    aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                                                >
                                                    {isOpen ? '▾' : '▸'}
                                                </button>
                                            </td>
                                            <td className={styles.mono}>{log.logid}</td>
                                            <td className={styles.mono}>{formatDate(log.createdat)}</td>
                                            <td>{displayUser(log)}</td>
                                            <td>
                                                <span className={`${styles.badge} ${ACTION_CLASS[log.action]}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td>{FACILITY_LABELS[log.facility] ?? log.facility}</td>
                                            <td>{log.description}</td>
                                        </tr>
                                        {isOpen && (
                                            <tr className={styles.detailRow}>
                                                <td colSpan={COLUMN_COUNT}>
                                                    <LogDetail log={log} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {loading && logs.length === 0 && <p className={styles.state}>Cargando registros...</p>}
                    {!loading && !error && logs.length === 0 && (
                        <p className={styles.state}>No hay registros con estos filtros.</p>
                    )}
                </div>

                <div className={styles.pagination}>
                    <button
                        type="button"
                        className={styles.pageButton}
                        onClick={goPrevious}
                        disabled={loading || pageNumber === 1}
                    >
                        Anterior
                    </button>
                    <span className={styles.pageInfo}>Página {pageNumber}</span>
                    <button
                        type="button"
                        className={styles.pageButton}
                        onClick={goNext}
                        disabled={loading || !hasMore}
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardLogs;