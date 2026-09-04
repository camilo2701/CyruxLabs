import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AvatarSelector, { avatarMap } from './AvatarSelector';
import '../../styles/DashboardProfile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function DashboardProfile({ onChangePassword }) {
  const { user, token, login, updateUser } = useAuth();
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

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage('');
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!formData.currentPassword) {
      setMessage('Debes ingresar tu contraseña actual.');
      return;
    }

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

      </div>
    </section>
  );
}

export default DashboardProfile;