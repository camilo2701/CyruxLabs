import { useState } from 'react';
import { mockUser } from '../../data/mockUser';
import AvatarSelector from './AvatarSelector';
import '../../styles/DashboardProfile.css';

function DashboardProfile({ onChangePassword }) {
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    username: mockUser.username,
    name: mockUser.name,
    lastName: mockUser.lastName,
    email: mockUser.email,
    currentPassword: '',
  });

  const [avatar, setAvatar] = useState(mockUser.avatar);

  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage('');
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!formData.currentPassword) {
      setMessage('Debes ingresar tu contraseña actual.');
      return;
    }

    const hasChanges =
      formData.username !== mockUser.username ||
      formData.name !== mockUser.name ||
      formData.lastName !== mockUser.lastName ||
      formData.email !== mockUser.email;

    if (!hasChanges) {
      setMessage('Debes modificar al menos un dato personal.');
      return;
    }

    // mockdata
    mockUser.username = formData.username;
    mockUser.name = formData.name;
    mockUser.lastName = formData.lastName;
    mockUser.email = formData.email;

    setIsEditing(false);
    setMessage('Datos personales actualizados correctamente.');
  };

  const handleAvatarChange = (newAvatar) => {
    setAvatar(newAvatar);
    mockUser.avatar = newAvatar;
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
            src={avatar}
            alt="Avatar seleccionado"
            className="dashboard-profile__avatar"
          />

          <AvatarSelector
            selectedAvatar={avatar}
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
                <strong>{formData.name}</strong>
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
                    name="name"
                    value={formData.name}
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
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="dashboard-button dashboard-button--primary"
                >
                  Realizar Cambios
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