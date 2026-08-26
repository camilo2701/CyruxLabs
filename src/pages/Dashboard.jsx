import { useState } from 'react';

import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import DashboardProfile from '../components/dashboard/DashboardProfile';
import DashboardHistory from '../components/dashboard/DashboardHistory';
import DashboardUsers from '../components/dashboard/DashboardUsers';
import DashboardLabs from '../components/dashboard/DashboardLabs';
import ChangePassword from '../components/dashboard/ChangePassword';
import Footer from '../components/Footer';

import '../styles/Dashboard.css';

function Dashboard() {
  const [activeSection, setActiveSection] = useState(() => {
    return window.location.hash === '#historial'
      ? 'history'
      : 'profile';
  });
  const [showChangePassword, setShowChangePassword] = useState(false);

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