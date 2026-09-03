import { useState } from 'react';

import DashboardLabsViewMgmt from './DashboardLabsViewMgmt.jsx';
import DashboardLabsCreate from './DashboardLabsCreate.jsx';
import '../../styles/DashboardLabs.css';

function DashboardLabs() {
  const [activeLabSection, setActiveLabSection] = useState('menu');

  const renderLabSection = () => {
    switch (activeLabSection) {
      case 'view':
        return <DashboardLabsViewMgmt onBack={() => setActiveLabSection('menu')} />;

      case 'create':
        return <DashboardLabsCreate onBack={() => setActiveLabSection('menu')} />;

      default:
        return (
          <div className="labmgmt-ui">
            <h2>Que deseas hacer?</h2>
            <div className="labmgmt-menu">
              <div
                className="labmgmt-menu-option"
                onClick={() => setActiveLabSection('view')}
              >
                <p>Revisar Laboratorios</p>
                <svg className="w-[48px] h-[48px] text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M7.111 20A3.111 3.111 0 0 1 4 16.889v-12C4 4.398 4.398 4 4.889 4h4.444a.89.89 0 0 1 .89.889v12A3.111 3.111 0 0 1 7.11 20Zm0 0h12a.889.889 0 0 0 .889-.889v-4.444a.889.889 0 0 0-.889-.89h-4.389a.889.889 0 0 0-.62.253l-3.767 3.665a.933.933 0 0 0-.146.185c-.868 1.433-1.581 1.858-3.078 2.12Zm0-3.556h.009m7.933-10.927 3.143 3.143a.889.889 0 0 1 0 1.257l-7.974 7.974v-8.8l3.574-3.574a.889.889 0 0 1 1.257 0Z"/>
                </svg>
              </div>

              <div
                className="labmgmt-menu-option"
                onClick={() => setActiveLabSection('create')}
              >
                <p>Crear un Laboratorio</p>
                <svg className="w-[48px] h-[48px] text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/>
                </svg>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <section className="dashboard-section-header">
        <span className="dashboard-section-header__eyebrow">LABORATORIOS</span>
        <h1>Gestionar laboratorios</h1>
      </section>

      {renderLabSection()}
    </>
  );
}

export default DashboardLabs;