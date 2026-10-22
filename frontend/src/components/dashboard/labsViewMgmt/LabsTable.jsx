const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) : '—';

// The table of labs, with the pending-bugs badge and the "Administrar" button of each row
function LabsTable({ labs, bugCounts, onManage }) {
  return (
    <div className="manage-users__table">

      <div className="manage-users__table-header manage-users__table-header--labs">
        <span>ID</span>
        <span>Laboratorio</span>
        <span>Autor</span>
        <span>Fecha de creación</span>
        <span>Fecha de actualización</span>
        <span>Completado por</span>
        <span>Administrar</span>
      </div>

      {labs.map((lab) => (
        <div className="manage-users__row manage-users__row--labs" key={lab.labid}>

          <span className="manage-users__id">#{lab.labid}</span>

          <span className="lab-title-cell">
            {lab.title}
            {bugCounts[lab.labid] > 0 && (
              <span
                className="lab-bug-badge"
                title={`${bugCounts[lab.labid]} bug(s) pendiente(s)`}
                aria-label={`${bugCounts[lab.labid]} bug(s) pendiente(s)`}
              >
                {bugCounts[lab.labid] > 99 ? '99+' : bugCounts[lab.labid]}
              </span>
            )}
          </span>

          <span>{lab.users?.username ?? 'Desconocido'}</span>

          <span>{formatDate(lab.dateofcreation)}</span>

          <span>{formatDate(lab.dateofupdate)}</span>

          <span>{lab.completedUserCount} usuario(s)</span>

          <button
            type="button"
            className="manage-users__admin-button"
            onClick={() => onManage(lab)}
          >
            Administrar
          </button>

        </div>
      ))}

    </div>
  );
}

export default LabsTable;
