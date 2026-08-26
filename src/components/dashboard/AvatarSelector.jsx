import { useState } from 'react';
import '../../styles/AvatarSelector.css';

import avatar01 from '../../assets/avatars/avatar-01.svg';
import avatar02 from '../../assets/avatars/avatar-02.svg';
import avatar03 from '../../assets/avatars/avatar-03.svg';
import avatar04 from '../../assets/avatars/avatar-04.svg';
import avatar05 from '../../assets/avatars/avatar-05.svg';

const avatars = [
  avatar01,
  avatar02,
  avatar03,
  avatar04,
  avatar05,
];

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
            {avatars.map((avatar, index) => (
              <button
                key={avatar}
                type="button"
                className={`avatar-selector__option ${
                  selectedAvatar === avatar
                    ? 'avatar-selector__option--selected'
                    : ''
                }`}
                onClick={() => {
                  onAvatarChange(avatar);
                  setIsOpen(false);
                }}
              >
                <img
                  src={avatar}
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