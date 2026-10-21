import { useAuth } from '../../context/AuthContext';
import '../../styles/DashboardSidebar.css';

const dashboardSections = [
  {
    id: 'profile',
    label: 'Mi perfil',
    icon: '♙',
    allowedRoles: ['student', 'instructor', 'admin'],
  },
  {
    id: 'history',
    label: 'Historial de actividad',
    icon: '◷',
    allowedRoles: ['student', 'instructor', 'admin'],
  },
  {
    id: 'users',
    label: 'Gestionar usuarios',
    icon: '⌘',
    allowedRoles: ['instructor', 'admin'],
  },
  {
    id: 'labs',
    label: 'Gestionar laboratorios',
    icon: '⌘',
    allowedRoles: ['instructor', 'admin'],
  },
    {
    id: 'logs',
    label: 'Registro del sistema',
    icon: <LogsIcon />,
    allowedRoles: ['admin'],
  },
];

// La tabla guarda role como número; esto lo traduce al string
// que ya usan allowedRoles más abajo.
const ROLE_NAMES = {
  0: 'student',
  1: 'instructor',
  2: 'admin',
};

function LogsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <polyline points="14 9 17 12 14 15" />
      <line x1="17" y1="12" x2="3" y2="12" />
      <path d="M10,8V5a1,1,0,0,1,1-1h9a1,1,0,0,1,1,1V19a1,1,0,0,1-1,1H11a1,1,0,0,1-1-1V16" />
    </svg>
  );
}

function DashboardSidebar({ activeSection, onSectionChange }) {
  const { user } = useAuth();
  const roleName = ROLE_NAMES[user.role] || 'student';

  const availableSections = dashboardSections.filter((section) =>
    section.allowedRoles.includes(roleName)
  );

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__header">
        <span className="dashboard-sidebar__brand">CyruxLabs</span>
        <span className="dashboard-sidebar__label">DASHBOARD</span>
      </div>

      <nav className="dashboard-sidebar__nav">
        {availableSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`dashboard-sidebar__item ${
              activeSection === section.id
                ? 'dashboard-sidebar__item--active'
                : ''
            }`}
            onClick={() => onSectionChange(section.id)}
          >
            <span className="dashboard-sidebar__icon">
              {section.icon}
            </span>

            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      <div className="dashboard-sidebar__user">
        <span className="dashboard-sidebar__user-role">
          {roleName}
        </span>

        <span className="dashboard-sidebar__user-name">
          {user.username}
        </span>
      </div>
    </aside>
  );
}

export default DashboardSidebar;