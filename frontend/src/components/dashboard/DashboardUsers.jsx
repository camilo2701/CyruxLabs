import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ConfirmContext';
import '../../styles/DashboardUsers.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const ROLE_LABELS = {
  0: 'Estudiante',
  1: 'Instructor',
  2: 'Administrador',
};

const toEditForm = (user) => ({
  username: user.username,
  firstName: user.firstname,
  lastName: user.lastname,
  email: user.email,
  role: user.role,
});

function ManageUsers() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user: currentUser, token } = useAuth();
  const isAdmin = currentUser.role === 2;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [searchText, setSearchText] = useState('');
  // null = mostrando los últimos registrados; string = búsqueda activa
  const [activeSearch, setActiveSearch] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState('menu'); // 'menu' | 'edit'
  const [editForm, setEditForm] = useState(null);
  const [modalMessage, setModalMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(
    async (search, page) => {
      setLoading(true);
      setListError('');

      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
        params.set('page', String(page));
      }

      try {
        const response = await fetch(`${API_URL}/users/manage?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          setListError(data.error || 'No se pudieron cargar los usuarios');
          setUsers([]);
          return;
        }

        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotalResults(data.total);
      } catch (err) {
        setListError('No se pudo conectar con el servidor.');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchUsers(activeSearch, currentPage);
  }, [fetchUsers, activeSearch, currentPage]);

  const handleSearch = () => {
    const query = searchText.trim();
    setActiveSearch(query || null);
    setCurrentPage(1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') handleSearch();
  };

  const clearSearch = () => {
    setSearchText('');
    setActiveSearch(null);
    setCurrentPage(1);
  };

  // ── Modal ──

  const resetModal = () => {
    setSelectedUser(null);
    setModalMode('menu');
    setEditForm(null);
    setModalMessage({ type: '', text: '' });
  };

  const openModal = (user) => {
    setSelectedUser(user);
    setModalMode('menu');
    setEditForm(null);
    setModalMessage({ type: '', text: '' });
  };

  const closeModal = () => {
    if (!saving) resetModal();
  };

  const startEditing = () => {
    setEditForm(toEditForm(selectedUser));
    setModalMode('edit');
    setModalMessage({ type: '', text: '' });
  };

  const cancelEditing = () => {
    setModalMode('menu');
    setEditForm(null);
    setModalMessage({ type: '', text: '' });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((previous) => ({
      ...previous,
      [name]: name === 'role' ? Number(value) : value,
    }));
    setModalMessage({ type: '', text: '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const original = toEditForm(selectedUser);
    const hasChanges = Object.keys(original).some((key) => original[key] !== editForm[key]);
    if (!hasChanges) {
      setModalMessage({ type: 'error', text: 'No has modificado ningún dato.' });
      return;
    }

    if (isAdmin && editForm.role !== selectedUser.role) {
      const confirmed = await confirm({
        title: 'Cambiar rol',
        message: `¿Cambiar el rol de ${selectedUser.username} de ${ROLE_LABELS[selectedUser.role]} a ${ROLE_LABELS[editForm.role]}?`,
        confirmText: 'Cambiar rol',
        cancelText: 'Cancelar',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const body = {
        username: editForm.username.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
      };
      // Solo el admin envía el rol (el backend igual lo valida).
      if (isAdmin) body.role = editForm.role;

      const response = await fetch(`${API_URL}/users/manage/${selectedUser.userid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setModalMessage({ type: 'error', text: data.error || 'No se pudieron guardar los cambios' });
        return;
      }

      setUsers((previous) => previous.map((u) => (u.userid === data.user.userid ? data.user : u)));
      setSelectedUser(data.user);
      setModalMode('menu');
      setEditForm(null);
      setModalMessage({ type: 'success', text: 'Usuario actualizado correctamente.' });
    } catch (err) {
      setModalMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    const target = selectedUser;

    const confirmed = await confirm({
      title: 'Eliminar usuario',
      message: `¿Seguro que deseas eliminar a ${target.username}? Se borrarán también sus sesiones, reportes, insignias y laboratorios creados. Esta acción es irreversible.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/users/manage/${target.userid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setModalMessage({ type: 'error', text: data.error || 'No se pudo eliminar el usuario' });
        return;
      }

      resetModal();

      // recarga la lista para mantener los 5 recientes
      if (users.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        fetchUsers(activeSearch, currentPage);
      }
    } catch (err) {
      setModalMessage({ type: 'error', text: 'No se pudo conectar con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dashboard-section-header">
      <div className="manage-users__header">
        <span className="manage-users__eyebrow">ADMINISTRACIÓN</span>

        <h1>Gestionar usuarios</h1>

        <p>
          {isAdmin
            ? 'Administra los usuarios registrados en CyruxLabs. Puedes buscar usuarios y acceder a las opciones disponibles para cada perfil.'
            : 'Administra a los estudiantes registrados en CyruxLabs. Puedes buscarlos y acceder a las opciones disponibles para cada perfil.'}
        </p>
      </div>

      <div className="manage-users__search">
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value.slice(0, 100))}
          onKeyDown={handleKeyDown}
          maxLength={100}
          placeholder="Buscar por usuario, nombre o apellido..."
          aria-label="Buscar usuarios"
        />

        <button type="button" onClick={handleSearch} disabled={!searchText.trim()}>
          Buscar
        </button>

        {activeSearch !== null && (
          <button type="button" className="manage-users__clear-button" onClick={clearSearch}>
            Limpiar
          </button>
        )}
      </div>

      <div className="manage-users__list">
        <div className="manage-users__list-header">
          <h2>{activeSearch !== null ? 'Resultados de búsqueda' : 'Usuarios registrados recientemente'}</h2>

          {activeSearch !== null && !loading && <span>{totalResults} resultado(s)</span>}
        </div>

        {loading ? (
          <div className="manage-users__empty">Cargando usuarios...</div>
        ) : listError ? (
          <div className="manage-users__empty">{listError}</div>
        ) : users.length > 0 ? (
          <div className="manage-users__table">
            <div className="manage-users__table-header">
              <span>ID</span>
              <span>Usuario</span>
              <span>Nombre completo</span>
              <span>Rol</span>
              <span>Administrar</span>
            </div>

            {users.map((user) => (
              <div className="manage-users__row" key={user.userid}>
                <span className="manage-users__id">#{user.userid}</span>

                <span>{user.username}</span>

                <span>
                  {user.firstname} {user.lastname}
                </span>

                <span className={`manage-users__role manage-users__role--${user.role}`}>
                  {ROLE_LABELS[user.role] || 'Desconocido'}
                </span>

                <button type="button" className="manage-users__admin-button" onClick={() => openModal(user)}>
                  Administrar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="manage-users__empty">
            {activeSearch !== null
              ? 'No se encontraron usuarios que coincidan con la búsqueda.'
              : 'Aún no hay usuarios registrados.'}
          </div>
        )}
      </div>
      

      {activeSearch !== null && totalPages > 1 && (
        <div className="manage-users__pagination">
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((page) => page - 1)}
          >
            Anterior
          </button>

          <span>
            Página {currentPage} de {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage((page) => page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {selectedUser && (
        <div className="manage-users__modal-overlay" onClick={closeModal}>
          <div className="manage-users__modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="manage-users__modal-close" onClick={closeModal} aria-label="Cerrar">
              ×
            </button>

            <span className="manage-users__eyebrow">USUARIO #{selectedUser.userid}</span>

            <h2>{selectedUser.username}</h2>

            <p>
              {selectedUser.firstname} {selectedUser.lastname} · {ROLE_LABELS[selectedUser.role]}
              <br />
              <span className="manage-users__modal-email">{selectedUser.email}</span>
            </p>

            {modalMode === 'menu' ? (
              <div className="manage-users__modal-actions">
                <button type="button" onClick={startEditing} disabled={saving}>
                  Modificar perfil
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/perfil/${selectedUser.username}`)}
                  disabled={saving}
                >
                  Ver perfil
                </button>

                <button
                  type="button"
                  className="manage-users__delete-button"
                  onClick={handleDeleteUser}
                  disabled={saving}
                >
                  {saving ? 'Eliminando...' : 'Eliminar usuario'}
                </button>
              </div>
            ) : (
              <form className="manage-users__edit-form" onSubmit={handleSave}>
                <label>
                  Nombre de usuario
                  <input
                    type="text"
                    name="username"
                    value={editForm.username}
                    onChange={handleEditChange}
                    maxLength={12}
                    required
                  />
                </label>

                <label>
                  Nombre
                  <input type="text" name="firstName" value={editForm.firstName} onChange={handleEditChange} required />
                </label>

                <label>
                  Apellido
                  <input type="text" name="lastName" value={editForm.lastName} onChange={handleEditChange} required />
                </label>

                <label>
                  Correo electrónico
                  <input type="email" name="email" value={editForm.email} onChange={handleEditChange} required />
                </label>

                {isAdmin && (
                  <label>
                    Rol
                    <select name="role" value={editForm.role} onChange={handleEditChange}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="manage-users__edit-actions">
                  <button type="button" onClick={cancelEditing} disabled={saving}>
                    Cancelar
                  </button>

                  <button type="submit" className="manage-users__save-button" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}

            {modalMessage.text && (
              <p className={`manage-users__modal-message manage-users__modal-message--${modalMessage.type}`}>
                {modalMessage.text}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ManageUsers;
