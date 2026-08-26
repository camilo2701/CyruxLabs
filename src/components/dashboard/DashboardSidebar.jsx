import { mockUser } from '../../data/mockUser';
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
    allowedRoles: ['student', 'instructor'],
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
];

function DashboardSidebar({ activeSection, onSectionChange }) {
  const availableSections = dashboardSections.filter((section) =>
    section.allowedRoles.includes(mockUser.role)
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
          {mockUser.role}
        </span>

        <span className="dashboard-sidebar__user-name">
          {mockUser.name}
        </span>
      </div>
    </aside>
  );
}

export default DashboardSidebar;