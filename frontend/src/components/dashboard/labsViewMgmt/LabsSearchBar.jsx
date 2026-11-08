// Este archivo se encarga de la barra de búsqueda de laboratorios del panel de gestión:
// la búsqueda se dispara con Enter o con el botón (el texto solo se usa en ese momento).
// Search box of the labs list. Enter or the button runs the search (the text is only used then).
// Este componente se encarga de renderizar el campo de búsqueda y su botón, y de disparar la búsqueda.
function LabsSearchBar({ value, onChange, onSearch }) {
  // Esta función se encarga de ejecutar la búsqueda al pulsar Enter si hay texto no vacío.
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && value.trim()) {
      onSearch();
    }
  };

  return (
    <div className="manage-users__search">
      <input
        id="lab-search"
        type="text"
        value={value}
        maxLength={100}
        placeholder="Buscar por nombre, descripción o autor..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Buscar laboratorios"
      />

      <button type="button" onClick={onSearch} disabled={!value.trim()}>
        Buscar
      </button>
    </div>
  );
}

export default LabsSearchBar;
