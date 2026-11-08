// Este archivo se encarga de la sección "Mi perfil" del dashboard: permite ver y
// editar los datos personales, cambiar el avatar y eliminar la cuenta del usuario.
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AvatarSelector, { avatarMap } from './AvatarSelector';
import DeleteAccountModal from './DeleteAccountModal';
import '../../styles/DashboardProfile.css';

// Esta constante se encarga de resolver la URL base de la API (variable de entorno o local).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Este componente se encarga de renderizar y manejar la vista del perfil del usuario.
function DashboardProfile({ onChangePassword }) {
  const { user, token, login, updateUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: user.username,
    firstName: user.firstname,
    lastName: user.lastname,
    email: user.email,
    currentPassword: '',
  });

  const [message, setMessage] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Esta función se encarga de actualizar el campo del formulario que cambió y
  // limpiar el mensaje previo.
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage('');
  };

  // Esta función se encarga de validar y guardar los cambios de los datos
  // personales, enviándolos al backend con la contraseña actual.
  const handleSave = async (event) => {
    event.preventDefault();

    if (!formData.currentPassword) {
      setMessage('Debes ingresar tu contraseña actual.');
      return;
    }

    // Comprueba si hubo algún cambio real respecto a los datos actuales del usuario.
    const hasChanges =
      formData.username !== user.username ||
      formData.firstName !== user.firstname ||
      formData.lastName !== user.lastname ||
      formData.email !== user.email;

    if (!hasChanges) {
      setMessage('Debes modificar al menos un dato personal.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: formData.username,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          currentPassword: formData.currentPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'No se pudieron guardar los cambios');
        return;
      }

      // El username va dentro del token, por eso login() reemplaza
      // token + user juntos (a diferencia del avatar, que usa updateUser).
      login({ token: data.token, user: data.user });
      setFormData((previous) => ({ ...previous, currentPassword: '' }));
      setIsEditing(false);
      setMessage('Datos personales actualizados correctamente.');
    } catch (err) {
      setMessage('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Esta función se encarga de enviar al backend el nuevo avatar elegido y
  // actualizar el usuario en el estado global.
  const handleAvatarChange = async (newAvatarFile) => {
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: newAvatarFile }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'No se pudo cambiar el avatar');
        return;
      }

      updateUser(data.user);
    } catch (err) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  // Esta función se encarga de eliminar la cuenta de forma permanente tras validar
  // la contraseña: muestra confirmación, cierra sesión y redirige al inicio.
  const handleDeleteAccount = async (password) => {
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || 'No se pudo eliminar la cuenta');
        return;
      }

      // Muestra la confirmación un instante antes de cerrar sesión
      // y redirigir, como pediste.
      setIsDeleteModalOpen(false);
      alert(data.message || 'Cuenta eliminada correctamente');
      logout();
      window.location.href = '/';
    } catch (err) {
      setDeleteError('No se pudo conectar con el servidor.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <section className="dashboard-profile">
      <div className="dashboard-section-header">
        <span className="dashboard-section-header__eyebrow">
          CUENTA
        </span>

        <h1>Mi perfil</h1>

        <p>
          Administra tu información personal y preferencias de cuenta.
        </p>
      </div>

      <div className="dashboard-profile__card">

        <div className="dashboard-profile__avatar-section">
          <img
            src={avatarMap[user.avatar]}
            alt="Avatar seleccionado"
            className="dashboard-profile__avatar"
          />

          <AvatarSelector
            selectedAvatar={user.avatar}
            onAvatarChange={handleAvatarChange}
          />
        </div>

        <div className="dashboard-profile__divider" />

        <div className="dashboard-profile__data">

          <div className="dashboard-profile__data-header">
            <div>
              <h2>Información personal</h2>
              <p>
                Estos son los datos asociados actualmente a tu cuenta.
              </p>
            </div>

            {!isEditing && (
              <button
                type="button"
                className="dashboard-profile__edit-button"
                onClick={() => setIsEditing(true)}
                aria-label="Editar datos personales"
              >
                ✎
              </button>
            )}
          </div>

          {/* Según isEditing, muestra los datos en modo lectura o el formulario de edición */}
          {!isEditing ? (
            <div className="dashboard-profile__fields">
              <div>
                <span>Nombre de usuario</span>
                <strong>{formData.username}</strong>
              </div>

              <div>
                <span>Nombre</span>
                <strong>{formData.firstName}</strong>
              </div>

              <div>
                <span>Apellidos</span>
                <strong>{formData.lastName}</strong>
              </div>

              <div>
                <span>Correo electrónico</span>
                <strong>{formData.email}</strong>
              </div>
            </div>
          ) : (
            <form
              className="dashboard-profile__form"
              onSubmit={handleSave}
            >
              <div className="dashboard-profile__form-grid">

                <label>
                  Nombre de usuario
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Nombre
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Apellidos
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Correo electrónico
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </label>

                <label className="dashboard-profile__password-field">
                  Contraseña actual
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    required
                  />
                </label>

              </div>

              <div className="dashboard-profile__form-actions">
                <button
                  type="button"
                  className="dashboard-button dashboard-button--secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setMessage('');
                    setFormData({
                      username: user.username,
                      firstName: user.firstname,
                      lastName: user.lastname,
                      email: user.email,
                      currentPassword: '',
                    });
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="dashboard-button dashboard-button--primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Realizar Cambios'}
                </button>
              </div>
            </form>
          )}

          {message && (
            <p className="dashboard-profile__message">
              {message}
            </p>
          )}
        </div>

        <div className="dashboard-profile__divider" />

        <div className="dashboard-profile__password">
          <div>
            <h2>Seguridad</h2>
            <p>
              Cambia tu contraseña para mantener protegida tu cuenta.
            </p>
          </div>

          <button
            type="button"
            className="dashboard-button dashboard-button--secondary"
            onClick={onChangePassword}
          >
            Cambiar contraseña
          </button>
        </div>

        <div className="dashboard-profile__divider" />

        <div className="dashboard-profile__password">
          <div>
            <h2>Eliminar cuenta</h2>
            <p>
              Elimina tu cuenta permanentemente (cambios irreversibles).
            </p>
          </div>

          <button
            type="button"
            className="dashboard-button dashboard-button--danger"
            onClick={() => {
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}
          >
            Eliminar cuenta
          </button>
        </div>

      </div>

      {isDeleteModalOpen && (
        <DeleteAccountModal
          loading={deleteLoading}
          error={deleteError}
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

    </section>
  );
}

export default DashboardProfile;