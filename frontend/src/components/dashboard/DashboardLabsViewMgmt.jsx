import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import LabBugReportsModal from './LabBugReportsModal';
import { useLabsList } from './labsViewMgmt/useLabsList';
import LabsSearchBar from './labsViewMgmt/LabsSearchBar';
import LabsTable from './labsViewMgmt/LabsTable';
import LabsPagination from './labsViewMgmt/LabsPagination';
import LabEditModal from './labsViewMgmt/LabEditModal';
import '../../styles/DashboardLabsViewMgmt.css';
import '../../styles/DashboardUsers.css';
// Kept because LabBugReportsModal may still use classes from this file
import '../../styles/DashboardLabsCreate.css';
import '../../styles/LabEditModal.css';

// Gestionar laboratorios: the list, the search and the two windows (edit and bug reports).
// Everything else lives in ./labsViewMgmt (the list pieces, the edit window and its tabs).
function DashboardLabsViewMgmt() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 2;

  const list = useLabsList(token);

  const [selectedLab, setSelectedLab] = useState(null);
  const [reportsLab, setReportsLab] = useState(null);

  const closeLabModal = () => setSelectedLab(null);

  return (
    <section className="dashboard-section-header">

      <div className="manage-users__header">
        <p>
          {isAdmin
            ? 'Consulta la lista de laboratorios actuales, sus autores y su información relacionada.'
            : 'Consulta y administra los laboratorios que has creado.'}
        </p>
      </div>

      <LabsSearchBar
        value={list.labSearch}
        onChange={list.changeSearchText}
        onSearch={list.runSearch}
      />

      <div className="manage-users__list">

        <div className="manage-users__list-header">
          <h2>
            {list.isSearchMode ? 'Resultados de búsqueda' : 'Últimos laboratorios creados'}
          </h2>
        </div>

        {list.isLoading && (
          <div className="manage-users__empty">Cargando laboratorios...</div>
        )}

        {!list.isLoading && list.listError && (
          <div className="manage-users__empty">{list.listError}</div>
        )}

        {!list.isLoading && !list.listError && (
          list.labs.length > 0 ? (
            <LabsTable
              labs={list.labs}
              bugCounts={list.bugCounts}
              onManage={setSelectedLab}
            />
          ) : (
            <div className="manage-users__empty">
              No se encontraron laboratorios que coincidan con la búsqueda.
            </div>
          )
        )}

      </div>

      {list.isSearchMode && list.totalPages > 1 && (
        <LabsPagination
          currentPage={list.currentPage}
          totalPages={list.totalPages}
          onPageChange={list.goToPage}
        />
      )}

      {/* While the bug reports window is open the edit window is hidden, not removed: "Volver" brings it back with the unsaved changes */}
      {selectedLab && (
        <LabEditModal
          key={selectedLab.labid}
          lab={selectedLab}
          token={token}
          isAdmin={isAdmin}
          bugCount={list.bugCounts[selectedLab.labid] ?? 0}
          hidden={!!reportsLab}
          onClose={closeLabModal}
          onOpenBugReports={() => setReportsLab(selectedLab)}
          onChanged={list.reload}
          onDeleted={() => {
            closeLabModal();
            list.reload();
          }}
        />
      )}

      {reportsLab && (
        <LabBugReportsModal
          lab={reportsLab}
          token={token}
          onBack={() => setReportsLab(null)}
          onClose={() => {
            setReportsLab(null);
            closeLabModal();
          }}
          onPendingCountChange={list.setBugCount}
        />
      )}

    </section>
  );
}

export default DashboardLabsViewMgmt;
