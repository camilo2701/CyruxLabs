import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/DashboardHistory.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const ITEMS_PER_PAGE = 10;

// Misma traducción número -> string que ya usan DashboardSidebar y Home.
const ROLE_NAMES = {
  0: 'student',
  1: 'instructor',
  2: 'admin',
};

function DashboardHistory() {
  const { user, token } = useAuth();
  const role = ROLE_NAMES[user.role] || 'student';

  const [studentSearch, setStudentSearch] = useState('');
  const [searchedStudents, setSearchedStudents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const formatTime = (date) => {
    if (!date) return 'En ejecución';

    return new Date(date).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const calculateDuration = (start, end) => {
    if (!end) return 'En curso';

    const difference = new Date(end) - new Date(start);

    const totalSeconds = Math.floor(difference / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':');
  };

  // Estudiante: carga su propio historial una sola vez al entrar.
  useEffect(() => {
    if (role !== 'student') return;

    setIsLoadingHistory(true);
    setHistoryError('');

    fetch(`${API_URL}/sessions/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.sessions || []);
      })
      .catch(() => {
        setHistoryError('No se pudo cargar tu historial.');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [role, token]);

  // Instructor/admin: carga el historial del estudiante seleccionado.
  useEffect(() => {
    if (role === 'student' || !selectedStudent) return;

    setIsLoadingHistory(true);
    setHistoryError('');

    fetch(`${API_URL}/sessions/user/${selectedStudent.userid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.sessions || []);
      })
      .catch(() => {
        setHistoryError('No se pudo cargar el historial de este estudiante.');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [role, selectedStudent, token]);

  const handleSearchInputChange = (event) => {
    setStudentSearch(event.target.value);
    setHasSearched(false);
  };

  const handleStudentSearch = async (event) => {
    event.preventDefault();

    const search = studentSearch.trim();

    if (!search) return;

    try {
      const response = await fetch(
        `${API_URL}/users/students?search=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();

      setSearchedStudents(response.ok ? data.students || [] : []);
      setSelectedStudent(null);
      setSearchPage(1);
      setCurrentPage(1);
      setHasSearched(true);
    } catch (err) {
      setSearchedStudents([]);
      setHasSearched(true);
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setCurrentPage(1);
  };

  // El historial ya viene filtrado desde el backend (propio, o del
  // estudiante seleccionado), así que aquí solo se pagina.
  const visibleHistory = useMemo(() => history, [history]);

  const totalPages = Math.ceil(
    visibleHistory.length / ITEMS_PER_PAGE
  );

  const paginatedHistory = visibleHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalSearchPages = Math.ceil(
    searchedStudents.length / ITEMS_PER_PAGE
  );

  const paginatedStudents = searchedStudents.slice(
    (searchPage - 1) * ITEMS_PER_PAGE,
    searchPage * ITEMS_PER_PAGE
  );

  const handleDownload = () => {
    alert('La descarga del reporte PDF estará disponible próximamente.');
  };

  // A quién le pertenece el historial que se está mostrando ahora mismo.
  const historyOwnerUsername =
    role === 'student' ? user.username : selectedStudent?.username;

  return (
    <section className="dashboard-section">

      <div className="dashboard-section-header">
        <span className="dashboard-section-header__eyebrow">
          ACTIVIDAD
        </span>

        <h1>Historial de actividad</h1>

        <p>
          Consulta el historial de los laboratorios realizados y el
          progreso de las prácticas.
        </p>
      </div>


      {role !== 'student' && (
        <div className="dashboard-history-search">

          <form onSubmit={handleStudentSearch}>
            <label htmlFor="student-search">
              Buscar estudiante
            </label>

            <div className="dashboard-search-row">
              <input
                id="student-search"
                type="text"
                value={studentSearch}
                maxLength={50}
                placeholder="Buscar por usuario, nombre o apellido..."
                onChange={handleSearchInputChange}
              />

              <button
                type="submit"
                disabled={!studentSearch.trim()}
              >
                Buscar
              </button>
            </div>
          </form>

          {hasSearched && searchedStudents.length > 0 && !selectedStudent && (
            <>
              <div className="dashboard-student-results">

                <div className="dashboard-student-results-header">
                  <h2>Resultados de búsqueda</h2>

                  <span>
                    {searchedStudents.length} resultado(s)
                  </span>
                </div>

                {paginatedStudents.map((student) => (
                  <div
                    key={student.userid}
                    className="dashboard-student-result"
                  >
                    <div>
                      <strong>@{student.username}</strong>

                      <span>
                        {student.firstname} {student.lastname}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                    >
                      Ver historial
                    </button>
                  </div>
                ))}

              </div>

              {totalSearchPages > 1 && (
                <div className="dashboard-pagination">

                  <button
                    type="button"
                    disabled={searchPage === 1}
                    onClick={() =>
                      setSearchPage((page) => page - 1)
                    }
                  >
                    Anterior
                  </button>

                  <span>
                    Página {searchPage} de {totalSearchPages}
                  </span>

                  <button
                    type="button"
                    disabled={searchPage === totalSearchPages}
                    onClick={() =>
                      setSearchPage((page) => page + 1)
                    }
                  >
                    Siguiente
                  </button>

                </div>
              )}

            </>
          )}

          {hasSearched &&
            searchedStudents.length === 0 &&
            studentSearch.trim() !== '' && (
              <div className="dashboard-student-results">

                <div className="dashboard-student-results-header">
                  <h2>Resultados de búsqueda</h2>
                
                  <span>
                    {searchedStudents.length} resultado(s)
                  </span>
                </div>

                <div className="dashboard-history-empty">
                  No se encontraron usuarios que coincidan con la búsqueda.
                </div>

              </div>
            )}

        </div>
      )}

      {role !== 'student' && selectedStudent && (
        <div className="dashboard-selected-student">

          <div>
            <span>Historial de</span>

            <strong>
              @{selectedStudent.username}
            </strong>

            <p>
              {selectedStudent.firstname} {selectedStudent.lastname}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedStudent(null);
              setCurrentPage(1);
              setHistory([]);
            }}
          >
            Cambiar estudiante
          </button>
        </div>
      )}

      {(role === 'student' || selectedStudent) && (
        <>
          {isLoadingHistory && (
            <p className="dashboard-history-empty">Cargando historial...</p>
          )}

          {!isLoadingHistory && historyError && (
            <p className="dashboard-history-empty">{historyError}</p>
          )}

          {!isLoadingHistory && !historyError && (
            <div className="dashboard-history-list">

              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((activity) => (
                  <article
                    key={activity.id}
                    className="dashboard-history-card"
                  >

                    <div className="dashboard-history-main">

                      <div>
                        <span className="dashboard-history-label">
                          Laboratorio
                        </span>

                        <h3>{activity.laboratory}</h3>
                      </div>


                      <span
                        className={`dashboard-history-status ${
                          activity.status === 'running'
                            ? 'dashboard-history-status--running'
                            : 'dashboard-history-status--finished'
                        }`}
                      >
                        {activity.status === 'running'
                          ? '● En ejecución'
                          : '● Finalizado'}
                      </span>
                    </div>

                    <div className="dashboard-history-info">

                      <div>
                        <span>Usuario</span>
                        <strong>@{historyOwnerUsername}</strong>
                      </div>

                      <div>
                        <span>Inicio</span>
                        <strong>
                          {formatTime(activity.startTime)}
                        </strong>
                      </div>

                      <div>
                        <span>Término</span>
                        <strong>
                          {formatTime(activity.endTime)}
                        </strong>
                      </div>

                      <div>
                        <span>Tiempo empleado</span>
                        <strong>
                          {calculateDuration(
                            activity.startTime,
                            activity.endTime
                          )}
                        </strong>
                      </div>

                    </div>

                    <button
                      type="button"
                      className="dashboard-history-report"
                      onClick={handleDownload}
                    >
                      Descargar reporte PDF
                    </button>

                  </article>
                ))
              ) : (
                <p className="dashboard-history-empty">
                  No hay registros de actividad para mostrar.
                </p>
              )}

            </div>
          )}

          {totalPages > 1 && (
            <div className="dashboard-pagination">

              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) => page - 1)
                }
              >
                Anterior
              </button>

              <span>
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => page + 1)
                }
              >
                Siguiente
              </button>

            </div>
          )}
        </>
      )}

    </section>
  );
}

export default DashboardHistory;