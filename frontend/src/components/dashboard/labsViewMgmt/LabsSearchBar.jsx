// Search box of the labs list. Enter or the button runs the search (the text is only used then).
function LabsSearchBar({ value, onChange, onSearch }) {
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
