import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import DashboardProfile from '../components/dashboard/DashboardProfile';
import DashboardHistory from '../components/dashboard/DashboardHistory';
import DashboardUsers from '../components/dashboard/DashboardUsers';
import DashboardLabs from '../components/dashboard/DashboardLabs';
import ChangePassword from '../components/dashboard/ChangePassword';
import Footer from '../components/Footer';

import '../styles/Dashboard.css';

function Dashboard() {
  const { user, isLoading } = useAuth();

  const [activeSection, setActiveSection] = useState(() => {
    return window.location.hash === '#historial'
      ? 'history'
      : 'profile';
  });
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Mientras el AuthContext revisa localStorage (ej. justo después de un F5),
  // user todavía es null. Sin este freno, DashboardSidebar/DashboardProfile
  // intentarían leer datos de un usuario que aún no existe.
  if (isLoading) {
    return (
      <p style={{ textAlign: 'center', marginTop: '4rem', color: 'aliceblue' }}>
        Cargando...
      </p>
    );
  }

  // Ya terminó de cargar y no hay sesión activa.
  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setShowChangePassword(false);
  };

  const renderSection = () => {
    if (showChangePassword) {
      return (
        <ChangePassword
          onBack={() => setShowChangePassword(false)}
        />
      );
    }

    switch (activeSection) {
      case 'profile':
        return (
          <DashboardProfile
            onChangePassword={() => setShowChangePassword(true)}
          />
        );

      case 'history':
        return <DashboardHistory />;

      case 'users':
        return <DashboardUsers />;

      case 'labs':
        return <DashboardLabs />;

      default:
        return (
          <DashboardProfile
            onChangePassword={() => setShowChangePassword(true)}
          />
        );
    }
  };

  return (
    <>
      <div className="dashboard">

        <DashboardSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        <main className="dashboard__content">
          {renderSection()}
        </main>
      
      </div>

      <Footer />
    </>
    
  );
}

export default Dashboard;