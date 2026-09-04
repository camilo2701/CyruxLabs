import { useMemo, useState } from 'react';
import { mockActivityHistory } from '../../data/mockActivityHistory';
import { mockUser, mockUsers } from '../../data/mockUser';
import '../../styles/DashboardHistory.css';

const ITEMS_PER_PAGE = 10;

function DashboardHistory() {
  const role = mockUser.role;

  const [studentSearch, setStudentSearch] = useState('');
  const [searchedStudents, setSearchedStudents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);

  const formatTime = (date) => {
    if (!date) return 'En ejecución';

    return new Date(date).toLocaleTimeString('es-CL', {
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

  const handleSearchInputChange = (event) => {
    setStudentSearch(event.target.value);
    setHasSearched(false);
  };

  const handleStudentSearch = (event) => {
    event.preventDefault();

    const search = studentSearch.trim().toLowerCase();

    if (!search) return;

    const results = mockUsers.filter((user) => {
      if (user.role !== 'student') return false;

      return (
        user.username.toLowerCase().includes(search) ||
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search)
      );
    });

    setSearchedStudents(results);
    setSelectedStudent(null);
    setSearchPage(1);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setCurrentPage(1);
  };

  const visibleHistory = useMemo(() => {

    if (role === 'student') {

        const currentStudent = mockUsers.find(
        (user) => user.username === mockUser.username
        );

        if (!currentStudent) {
        return [];
        }

        return mockActivityHistory.filter(
        (activity) => activity.studentId === currentStudent.id
        );
    }


    if (!selectedStudent) {
        return [];
    }

    return mockActivityHistory.filter(
        (activity) => activity.studentId === selectedStudent.id
    );

    }, [role, selectedStudent]);

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
                    key={student.id}
                    className="dashboard-student-result"
                  >
                    <div>
                      <strong>@{student.username}</strong>

                      <span>
                        {student.firstName} {student.lastName}
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
              {selectedStudent.firstName} {selectedStudent.lastName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedStudent(null);
              setCurrentPage(1);
            }}
          >
            Cambiar estudiante
          </button>
        </div>
      )}

      {(role === 'student' || selectedStudent) && (
        <>
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
                      <strong>@{activity.username}</strong>
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