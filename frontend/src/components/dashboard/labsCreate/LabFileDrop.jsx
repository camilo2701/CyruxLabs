// Este archivo se encarga de la zona para subir el archivo comprimido del
// laboratorio al crearlo: admite arrastrar y soltar o hacer clic para elegirlo.
import { useRef } from 'react';

// Este componente se encarga de renderizar el área de carga del zip del laboratorio.
function LabFileDrop({ files, onFilesPicked, onViewFiles }) {
    const fileInputRef = useRef(null);

    // Esta función se encarga de recibir el archivo soltado (drag and drop) y entregarlo al padre.
    const handleDrop = (e) => {
        e.preventDefault();
        onFilesPicked(Array.from(e.dataTransfer.files));
    };

    // Esta función se encarga de permitir soltar archivos evitando el comportamiento por defecto.
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Esta función se encarga de procesar el archivo elegido desde el selector de archivos.
    const handleInputChange = (e) => {
        onFilesPicked(Array.from(e.target.files));
        // Clear the input so picking the same file again (after removing it) still fires onChange
        e.target.value = '';
    };

    return (
        <div
            className="container-create-lab-files"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <span>
                <p>Arrastra o has click para subir el archivo comprimido de tu laboratorio (Max. 1 archivo)</p>
            </span>
            <svg
                className="upload-icon"
                onClick={() => fileInputRef.current.click()}
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 5v9m-5 0H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2M8 9l4-5 4 5m1 8h.01"/>
            </svg>
            <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleInputChange}
            />

            {/* Solo si ya hay archivos cargados, muestra el conteo y el botón para verlos */}
            {files.length > 0 && (
                <span className="files-count-row">
                    <p>Archivos subidos: {files.length}</p>
                    <button
                        type="button"
                        className="view-files-btn"
                        onClick={onViewFiles}
                    >
                        Ver archivos
                    </button>
                </span>
            )}
        </div>
    );
}

export default LabFileDrop;