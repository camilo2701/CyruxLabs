import { useState } from 'react';
import '../../styles/DeleteAccountModal.css';

function DeleteAccountModal({ onConfirm, onCancel, loading, error }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onConfirm(password);
  };

  return (
    <div className="delete-account-modal__overlay" onClick={onCancel}>
      <div
        className="delete-account-modal__card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>¿Estás seguro?</h2>

        <p>
          Esta acción eliminará tu cuenta de forma permanente, junto con tus
          labs, sesiones e insignias. No se puede deshacer.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Ingresa tu contraseña para confirmar
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
          </label>

          {error && <p className="delete-account-modal__error">{error}</p>}

          <div className="delete-account-modal__actions">
            <button
              type="button"
              className="dashboard-button dashboard-button--secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="dashboard-button dashboard-button--danger"
              disabled={loading || !password}
            >
              {loading ? 'Eliminando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeleteAccountModal;