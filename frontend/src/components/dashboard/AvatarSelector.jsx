import { useState } from 'react';
import '../../styles/AvatarSelector.css';

import avatar01 from '../../assets/avatars/avatar-01.svg';
import avatar02 from '../../assets/avatars/avatar-02.svg';
import avatar03 from '../../assets/avatars/avatar-03.svg';
import avatar04 from '../../assets/avatars/avatar-04.svg';
import avatar05 from '../../assets/avatars/avatar-05.svg';

// El backend guarda solo el nombre del archivo (ej. "avatar-01.svg").
// Este mapa conecta ese nombre con la imagen ya importada por Vite,
// para poder mostrarla. Se exporta porque DashboardProfile también
// lo necesita para mostrar el avatar actual del usuario.
export const avatarMap = {
  'avatar-01.svg': avatar01,
  'avatar-02.svg': avatar02,
  'avatar-03.svg': avatar03,
  'avatar-04.svg': avatar04,
  'avatar-05.svg': avatar05,
};

const avatarFiles = Object.keys(avatarMap);

function AvatarSelector({ selectedAvatar, onAvatarChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="avatar-selector">
      <button
        type="button"
        className="dashboard-button dashboard-button--secondary"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        Cambiar Avatar
      </button>

      {isOpen && (
        <div className="avatar-selector__popover">

          <div className="avatar-selector__header">
            <span>Selecciona un avatar</span>
          </div>

          <div className="avatar-selector__grid">
            {avatarFiles.map((file, index) => (
              <button
                key={file}
                type="button"
                className={`avatar-selector__option ${
                  selectedAvatar === file
                    ? 'avatar-selector__option--selected'
                    : ''
                }`}
                onClick={() => {
                  onAvatarChange(file);
                  setIsOpen(false);
                }}
              >
                <img
                  src={avatarMap[file]}
                  alt={`Avatar ${index + 1}`}
                />
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

export default AvatarSelector;