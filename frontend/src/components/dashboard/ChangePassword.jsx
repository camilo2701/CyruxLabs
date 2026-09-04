import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/ChangePassword.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function ChangePassword({ onBack }) {
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    repeatPassword: '',
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRequirements = {
    length: formData.newPassword.length >= 7,
    uppercase: /[A-Z]/.test(formData.newPassword),
    special: /[^A-Za-z0-9]/.test(formData.newPassword),
    match:
      formData.newPassword !== '' &&
      formData.newPassword === formData.repeatPassword,
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.currentPassword) {
      setMessage('Debes ingresar tu contraseña actual.');
      return;
    }

    if (
      !passwordRequirements.length ||
      !passwordRequirements.uppercase ||
      !passwordRequirements.special
    ) {
      setMessage('La nueva contraseña no cumple los requisitos.');
      return;
    }

    if (!passwordRequirements.match) {
      setMessage('Las contraseñas nuevas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'No se pudo cambiar la contraseña.');
        return;
      }

      setMessage('Contraseña cambiada correctamente.');
      setFormData({
        currentPassword: '',
        newPassword: '',
        repeatPassword: '',
      });
    } catch (err) {
      setMessage('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="change-password">

      <div className="dashboard-section-header">
        <button
          type="button"
          className="change-password__back"
          onClick={onBack}
        >
          ← Volver al perfil
        </button>

        <span className="dashboard-section-header__eyebrow">
          SEGURIDAD
        </span>

        <h1>Cambiar contraseña</h1>

        <p>
          Ingresa tu contraseña actual y establece una nueva contraseña.
        </p>
      </div>

      <form
        className="change-password__card"
        onSubmit={handleSubmit}
      >

        <label>
          Contraseña actual
          <input
            type="password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Nueva contraseña
          <input
            type="password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Repetir nueva contraseña
          <input
            type="password"
            name="repeatPassword"
            value={formData.repeatPassword}
            onChange={handleChange}
            required
          />
        </label>

        <div className="change-password__requirements">

          <p>La contraseña debe contener:</p>

          <span className={passwordRequirements.length ? 'valid' : ''}>
            {passwordRequirements.length ? '✓' : '○'}
            Al menos 7 caracteres
          </span>

          <span className={passwordRequirements.uppercase ? 'valid' : ''}>
            {passwordRequirements.uppercase ? '✓' : '○'}
            Al menos una mayúscula
          </span>

          <span className={passwordRequirements.special ? 'valid' : ''}>
            {passwordRequirements.special ? '✓' : '○'}
            Al menos un carácter especial
          </span>

          <span className={passwordRequirements.match ? 'valid' : ''}>
            {passwordRequirements.match ? '✓' : '○'}
            Las contraseñas coinciden
          </span>

        </div>

        {message && (
          <p className="change-password__message">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="dashboard-button dashboard-button--primary"
          disabled={loading}
        >
          {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
        </button>

      </form>
    </section>
  );
}

export default ChangePassword;