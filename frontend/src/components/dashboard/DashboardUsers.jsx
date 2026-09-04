import { useState } from 'react';
import { mockUsers } from '../../data/mockUser';
import '../../styles/DashboardUsers.css';

function ManageUsers() {
  const [users, setUsers] = useState(mockUsers);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);

  const USERS_PER_PAGE = 10;

  const handleSearch = () => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      setSearchResults(null);
      setCurrentPage(1);
      return;
    }

    const results = users.filter((user) => {
      const username = user.username.toLowerCase();
      const firstName = user.firstName.toLowerCase();
      const lastName = user.lastName.toLowerCase();

      return (
        username.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query)
      );
    });

    setSearchResults(results);
    setCurrentPage(1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && searchText.trim()) {
      handleSearch();
    }
  };

  const displayedUsers = searchResults ?? users.slice(0, 5);

  const totalPages = Math.ceil(displayedUsers.length / USERS_PER_PAGE);

  const paginatedUsers =
    searchResults !== null
      ? displayedUsers.slice(
          (currentPage - 1) * USERS_PER_PAGE,
          currentPage * USERS_PER_PAGE
        )
      : displayedUsers;

  const handleDeleteUser = (id) => {
    const confirmed = window.confirm(
      '¿Estás seguro de que deseas eliminar este usuario?'
    );

    if (!confirmed) return;

    const updatedUsers = users.filter((user) => user.id !== id);

    setUsers(updatedUsers);
    setSelectedUser(null);

    if (searchResults !== null) {
      setSearchResults(
        updatedUsers.filter((user) => {
          const query = searchText.trim().toLowerCase();

          return (
            user.username.toLowerCase().includes(query) ||
            user.firstName.toLowerCase().includes(query) ||
            user.lastName.toLowerCase().includes(query)
          );
        })
      );
    }
  };

  return (
    <section className="dashboard-section-header">

      <div className="manage-users__header">
        <span className="manage-users__eyebrow">
          ADMINISTRACIÓN
        </span>

        <h1>Gestionar usuarios</h1>

        <p>
          Administra los usuarios registrados en CyruxLabs. Puedes buscar
          usuarios y acceder a las opciones disponibles para cada perfil.
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

        <button
          type="button"
          onClick={handleSearch}
          disabled={!searchText.trim()}
        >
          Buscar
        </button>

      </div>

      <div className="manage-users__list">

        <div className="manage-users__list-header">
          <h2>
            {searchResults !== null
              ? 'Resultados de búsqueda'
              : 'Usuarios registrados recientemente'}
          </h2>

          {searchResults !== null && (
            <span>
              {searchResults.length} resultado(s)
            </span>
          )}
        </div>

        {paginatedUsers.length > 0 ? (
          <div className="manage-users__table">

            <div className="manage-users__table-header">
              <span>ID</span>
              <span>Usuario</span>
              <span>Nombre completo</span>
              <span>Administrar</span>
            </div>

            {paginatedUsers.map((user) => (
              <div className="manage-users__row" key={user.id}>

                <span className="manage-users__id">
                  #{user.id}
                </span>

                <span>
                  {user.username}
                </span>

                <span>
                  {user.firstName} {user.lastName}
                </span>

                <button
                  type="button"
                  className="manage-users__admin-button"
                  onClick={() => setSelectedUser(user)}
                >
                  Administrar
                </button>

              </div>
            ))}

          </div>
        ) : (
          <div className="manage-users__empty">
            No se encontraron usuarios que coincidan con la búsqueda.
          </div>
        )}

      </div>

      {searchResults !== null && totalPages > 1 && (
        <div className="manage-users__pagination">

          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => page - 1)}
          >
            Anterior
          </button>

          <span>
            Página {currentPage} de {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
          >
            Siguiente
          </button>

        </div>
      )}

      {selectedUser && (
        <div
          className="manage-users__modal-overlay"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="manage-users__modal"
            onClick={(event) => event.stopPropagation()}
          >

            <button
              type="button"
              className="manage-users__modal-close"
              onClick={() => setSelectedUser(null)}
              aria-label="Cerrar"
            >
              ×
            </button>

            <span className="manage-users__eyebrow">
              USUARIO #{selectedUser.id}
            </span>

            <h2>{selectedUser.username}</h2>

            <p>
              {selectedUser.firstName} {selectedUser.lastName}
            </p>

            <div className="manage-users__modal-actions">

              <button type="button">
                Modificar perfil
              </button>

              <button type="button">
                Ver perfil
              </button>

              <button
                type="button"
                className="manage-users__delete-button"
                onClick={() => handleDeleteUser(selectedUser.id)}
              >
                Eliminar usuario
              </button>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}

export default ManageUsers;