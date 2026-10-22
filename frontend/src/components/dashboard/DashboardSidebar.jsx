import { useAuth } from '../../context/AuthContext';
import '../../styles/DashboardSidebar.css';

const dashboardSections = [
  {
    id: 'profile',
    label: 'Mi perfil',
    icon: <UserIcon />,
    allowedRoles: ['student', 'instructor', 'admin'],
  },
  {
    id: 'history',
    label: 'Historial de actividad',
    icon: <HistoryIcon />,
    allowedRoles: ['student', 'instructor', 'admin'],
  },
  {
    id: 'users',
    label: 'Gestionar usuarios',
    icon: <UsersIcon />,
    allowedRoles: ['instructor', 'admin'],
  },
  {
    id: 'labs',
    label: 'Gestionar laboratorios',
    icon: <FlaskIcon />,
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

// Íconos del menú basados en Lucide (https://lucide.dev, licencia ISC).
// Son declaraciones de función para poder usarlas en dashboardSections (definido más arriba).
function SidebarIcon({ children }) {
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
      {children}
    </svg>
  );
}

function UserIcon() {
  return (
    <SidebarIcon>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </SidebarIcon>
  );
}

function HistoryIcon() {
  return (
    <SidebarIcon>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </SidebarIcon>
  );
}

function UsersIcon() {
  return (
    <SidebarIcon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SidebarIcon>
  );
}

// Misma probeta que la insignia de "labs" en BadgeIcon.jsx
function FlaskIcon() {
  return (
    <SidebarIcon>
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </SidebarIcon>
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