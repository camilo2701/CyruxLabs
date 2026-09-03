import '../../styles/DashboardLabsFileModal.css';

function DashboardLabsFileModal({ files, onRemove, onClose }) {
  const splitFileName = (fileName) => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return { base: fileName, ext: '' };
    return {
      base: fileName.slice(0, lastDot),
      ext: fileName.slice(lastDot),
    };
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h3>Archivos agregados</h3>

        <ul className="modal-file-list">
          {files.map((file, index) => {
            const { base, ext } = splitFileName(file.name);
            return (
              <li key={index} className="modal-file-item">
                <span className="modal-file-name">
                  <span className="modal-file-base">{base}</span>
                  <span className="modal-file-ext">{ext}</span>
                </span>
                <button
                  type="button"
                  className="modal-trash-btn"
                  onClick={() => onRemove(index)}
                >
                  <svg
                    className="modal-trash-icon"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>

        <button type="button" className="modal-back-btn" onClick={onClose}>
          Volver
        </button>
      </div>
    </div>
  );
}

export default DashboardLabsFileModal;