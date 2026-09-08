import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/DashboardLabsViewMgmt.css';
import '../../styles/DashboardUsers.css';
import '../../styles/DashboardLabsCreate.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const titleRegex = /^[A-Za-z0-9 ]+$/;

function DashboardLabsViewMgmt() {
  const { token } = useAuth();

  const [labSearch, setLabSearch] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [labs, setLabs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [selectedLab, setSelectedLab] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [existingBenefits, setExistingBenefits] = useState([]); // [{benefitid, description}]
  const [removedBenefitIds, setRemovedBenefitIds] = useState([]);
  const [newBenefits, setNewBenefits] = useState([]); // strings pendientes de guardar
  const [newBenefitInput, setNewBenefitInput] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLabs = async (search, page) => {
    setIsLoading(true);
    setListError('');

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));

      const response = await fetch(`${API_URL}/labs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setListError(data.message || 'No se pudieron cargar los laboratorios.');
        setLabs([]);
        return;
      }

      setLabs(data.labs || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setListError('No se pudo conectar con el servidor.');
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Carga inicial: los 5 laboratorios más recientes.
  useEffect(() => {
    fetchLabs('', 1);
  }, []);

  const handleSearchInputChange = (event) => {
    setLabSearch(event.target.value.slice(0, 100));
  };

  const runSearch = () => {
    const query = labSearch.trim();
    if (!query) return;

    setIsSearchMode(true);
    setCurrentPage(1);
    fetchLabs(query, 1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && labSearch.trim()) {
      runSearch();
    }
  };

  const goToPage = (page) => {
    setCurrentPage(page);
    fetchLabs(labSearch.trim(), page);
  };

  const openLabModal = (lab) => {
    setSelectedLab(lab);
    setEditTitle(lab.title);
    setEditDescription(lab.description);
    setExistingBenefits(lab.benefit || []);
    setRemovedBenefitIds([]);
    setNewBenefits([]);
    setNewBenefitInput('');
    setModalMessage('');
  };

  const closeLabModal = () => {
    setSelectedLab(null);
  };

  const handleRemoveExistingBenefit = (benefitid) => {
    setExistingBenefits((prev) => prev.filter((b) => b.benefitid !== benefitid));
    setRemovedBenefitIds((prev) => [...prev, benefitid]);
  };

  const handleRemoveNewBenefit = (indexToRemove) => {
    setNewBenefits((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleNewBenefitKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const trimmed = newBenefitInput.trim();
      if (trimmed === '') return;

      if (!titleRegex.test(trimmed)) {
        setModalMessage('No se permiten caracteres especiales en los beneficios.');
        return;
      }

      setNewBenefits((prev) => [...prev, trimmed]);
      setNewBenefitInput('');
      setModalMessage('');
    }
  };

  const handleSaveChanges = async () => {
    if (!editTitle.trim() || !editDescription.trim()) {
      setModalMessage('El título y la descripción no pueden quedar vacíos.');
      return;
    }

    setIsSaving(true);
    setModalMessage('');

    try {
      const response = await fetch(`${API_URL}/labs/${selectedLab.labid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          addBenefits: newBenefits,
          removeBenefitIds: removedBenefitIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setModalMessage(data.message || 'No se pudieron guardar los cambios.');
        return;
      }

      setModalMessage('Laboratorio actualizado correctamente.');
      closeLabModal();
      fetchLabs(labSearch.trim(), currentPage);
    } catch (err) {
      setModalMessage('No se pudo conectar con el servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLab = async () => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el laboratorio "${selectedLab.title}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setModalMessage('');

    try {
      const response = await fetch(`${API_URL}/labs/${selectedLab.labid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setModalMessage(data.message || 'No se pudo eliminar el laboratorio.');
        return;
      }

      closeLabModal();
      fetchLabs(labSearch.trim(), currentPage);
    } catch (err) {
      setModalMessage('No se pudo conectar con el servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="dashboard-section-header">

      <div className="manage-users__header">
        <p>
          Consulta la lista de laboratorios actuales, sus autores y su información relacionada.
        </p>
      </div>

      <div className="manage-users__search">
        <input
          id="lab-search"
          type="text"
          value={labSearch}
          maxLength={100}
          placeholder="Buscar por nombre, descripción o autor..."
          onChange={handleSearchInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Buscar laboratorios"
        />

        <button
          type="button"
          onClick={runSearch}
          disabled={!labSearch.trim()}
        >
          Buscar
        </button>
      </div>

      <div className="manage-users__list">

        <div className="manage-users__list-header">
          <h2>
            {isSearchMode ? 'Resultados de búsqueda' : 'Últimos laboratorios creados'}
          </h2>
        </div>

        {isLoading && (
          <div className="manage-users__empty">Cargando laboratorios...</div>
        )}

        {!isLoading && listError && (
          <div className="manage-users__empty">{listError}</div>
        )}

        {!isLoading && !listError && (
          labs.length > 0 ? (
            <div className="manage-users__table">

              <div className="manage-users__table-header manage-users__table-header--labs">
                <span>ID</span>
                <span>Laboratorio</span>
                <span>Autor</span>
                <span>Fecha de creación</span>
                <span>Completado por</span>
                <span>Administrar</span>
              </div>

              {labs.map((lab) => (
                <div className="manage-users__row manage-users__row--labs" key={lab.labid}>

                  <span className="manage-users__id">
                    #{lab.labid}
                  </span>

                  <span>{lab.title}</span>

                  <span>{lab.users?.username ?? 'Desconocido'}</span>

                  <span>
                    {/* TODO: mostrar lab.dateofcreation cuando la tabla 'lab'
                        tenga esa columna. Por ahora no existe en la BD. */}
                    —
                  </span>

                  <span>{lab.completedUserCount} usuario(s)</span>

                  <button
                    type="button"
                    className="manage-users__admin-button"
                    onClick={() => openLabModal(lab)}
                  >
                    Administrar
                  </button>

                </div>
              ))}

            </div>
          ) : (
            <div className="manage-users__empty">
              No se encontraron laboratorios que coincidan con la búsqueda.
            </div>
          )
        )}

      </div>

      {isSearchMode && totalPages > 1 && (
        <div className="manage-users__pagination">

          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Anterior
          </button>

          <span>
            Página {currentPage} de {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Siguiente
          </button>

        </div>
      )}

      {selectedLab && (
        <div
          className="manage-users__modal-overlay"
          onClick={closeLabModal}
        >
          <div
            className="manage-users__modal"
            onClick={(event) => event.stopPropagation()}
          >

            <button
              type="button"
              className="manage-users__modal-close"
              onClick={closeLabModal}
              aria-label="Cerrar"
            >
              ×
            </button>

            <span className="manage-users__eyebrow">
              LABORATORIO #{selectedLab.labid}
            </span>

            <div className="lab-edit-fields">

              <div className="nebula-input">
              <input
                type="text"
                className="input"
                maxLength={50}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <label className="user-label user-label--float">Título</label>
            </div>

            <div className="nebula-input--desc">
              <textarea
                className="input"
                maxLength={500}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <label className="user-label user-label--float">Descripción</label>
            </div>

            <div className="nebula-input--bnf">
              <input
                type="text"
                className="input"
                value={newBenefitInput}
                onChange={(e) => setNewBenefitInput(e.target.value)}
                onKeyDown={handleNewBenefitKeyDown}
              />
              <label className="user-label user-label--float">
                Beneficios (presiona Enter para agregar)
              </label>

              <div className="benefit-tags">
                {existingBenefits.map((benefit) => (
                  <span key={benefit.benefitid} className="benefit-tag">
                    {benefit.description}
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingBenefit(benefit.benefitid)}
                    >
                      ×
                    </button>
                  </span>
                ))}

                {newBenefits.map((benefit, index) => (
                  <span key={`new-${index}`} className="benefit-tag">
                    {benefit}
                    <button
                      type="button"
                      onClick={() => handleRemoveNewBenefit(index)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            </div>

            {modalMessage && (
              <p className="nebula-error">{modalMessage}</p>
            )}

            <div className="manage-users__modal-actions">

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving || isDeleting}
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              <button
                type="button"
                className="manage-users__delete-button"
                onClick={handleDeleteLab}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar laboratorio'}
              </button>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}

export default DashboardLabsViewMgmt;