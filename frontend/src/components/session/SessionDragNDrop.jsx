// Este archivo se encarga de la zona de arrastrar y soltar (drag & drop) para subir un archivo .zip,
// validando que se suba exactamente un archivo y que tenga el formato correcto.
import { useState } from "react";
import { useRef } from "react";
import '../../styles/SessionDragNDrop.css'

// Este componente se encarga de renderizar el área de subida de archivos y gestionar su selección/validación.
function SessionDragNDrop(){

    const [showFilesModal, setShowFilesModal] = useState(false);

    /*** FILE MANAGEMENT ***/
    // Esta función se encarga de comprobar si un archivo tiene extensión .zip.
    const isZipFile = (file) => file.name.toLowerCase().endsWith('.zip');
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

    // Esta función se encarga de gestionar el archivo soltado: valida que sea un único .zip y lo guarda.
    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);

        if (droppedFiles.length !== 1) {
            setFileError(true);
            setFileErrorMessage('Debes subir un archivo');
            return;
        }
        else if (!isZipFile(droppedFiles[0])) {
            setFileError(true);
            setFileErrorMessage('Formato inválido, debes subir un archivo comprimido .zip');
            return;
        }

        setFiles([droppedFiles[0]]);
        setFileError(false);
    };

    // Esta función se encarga de permitir el arrastre evitando el comportamiento por defecto del navegador.
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Esta función se encarga de gestionar el archivo elegido desde el selector: valida que sea un único .zip.
    const handleFileInputChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        if (selectedFiles.length !== 1) {
            setFileError(true);
            setFileErrorMessage('Debes subir al menos un archivo');
            return;
        }
        else if (!isZipFile(selectedFiles[0])){
            setFileError(true);
            setFileErrorMessage('Formato inválido, debes subir un archivo comprimido .zip');
            return;
        }

        setFiles([selectedFiles[0]]);
        setFileError(false);
    };

    // Esta función se encarga de quitar el archivo subido y volver a marcar el error de "falta archivo".
    const handleRemoveFile = () => {
        setFiles([]);
        setFileError(true);
        setFileErrorMessage('Debes subir un archivo');
    };

    return (
        <div className="container-create-lab-files"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <span>
                <p>Arrastra o has click para subir tu flag (Max. 1 archivo .txt)</p>
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
            <input ref={fileInputRef} 
                    type="file" accept=".zip,application/zip" 
                    onChange={handleFileInputChange}/>
            
            {files.length > 0 && (
                <span className="files-count-row">
                    <p>Archivos subidos: {files.length}</p>
                    <button
                        type="button"
                        className="view-files-btn"
                        onClick={() => setShowFilesModal(true)}
                    >
                        Ver archivos
                    </button>
                </span>
            )}
        </div>
    )
}

export default SessionDragNDrop