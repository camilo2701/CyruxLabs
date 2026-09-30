import { useState } from "react";
import { useRef } from "react";
import { useNavigate } from 'react-router-dom';
import '../../styles/DashboardLabsCreate.css'
import '../../styles/SuccessModal.module.css'

import DashboardLabsFileModal from './DashboardLabsFileModal';
import SuccessModal from '../SuccessModal.jsx';
import { useAuth } from '../../context/AuthContext';

function DashboardLabsCreate(){
    const [labTitle, setLabTitle] = useState('');
    const [labDesc, setLabDesc] = useState('');
    const [benefitInput, setBenefitInput] = useState(''); 
    const [benefitList, setBenefitList] = useState([]);
    const [benefitFocused, setBenefitFocused] = useState(false);
    const [showFilesModal, setShowFilesModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [submitError, setSubmitError] = useState('');
    const navigate = useNavigate();
    const { token } = useAuth();

    /* Tagging System for handling the benefit List */
    const handleBenefitKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = benefitInput.trim();
            if (trimmed === '') return;

            if (!titleRegex.test(trimmed)) {
                setBenefitError('No se permiten caracteres especiales');
                return;
            }

            setBenefitList((prevList) => [...prevList, trimmed]);
            setBenefitInput('');
            setBenefitError('');
        }
    };

    const handleRemoveBenefit = (indexToRemove) => {
        setBenefitList((prevList) => prevList.filter((_, i) => i !== indexToRemove));
    };

    /*** ERROR MANAGEMENT ***/
    const [fileError, setFileError] = useState(false);
    const [fileErrorMessage, setFileErrorMessage] = useState('');
    const [titleError, setTitleError] = useState("");
    const titleRegex = /^[A-Za-z0-9 ]+$/;
    const [descError, setDescError] = useState("");
    const [benefitError, setBenefitError] = useState("");

    const validateTitle = (value) => {
        if (value.trim() === '') {
            setTitleError('El título es obligatorio');
        }
        else if (!titleRegex.test(value)){
            setTitleError('No se permiten caracteres especiales');
        } 
        else {
            setTitleError('');
        }
    };

    const validateDesc = (value) => {
        if (value.trim() === ''){
            setDescError('La descripción es un campo obligatorio');
        }
        else {
            setDescError('');
        }
    }

    const validateBenefitCount = () => {
        if (benefitList.length < 3) {
            setBenefitError('Debes indicar al menos 3 beneficios que obtienes por desarrollar este laboratorio');
        } else {
            setBenefitError('');
        }
    };

    /*** FILE MANAGEMENT ***/
    const isZipFile = (file) => file.name.toLowerCase().endsWith('.zip');
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

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

    const handleDragOver = (e) => {
        e.preventDefault();
    };

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

    const handleRemoveFile = () => {
        setFiles([]);
        setFileError(true);
        setFileErrorMessage('Debes subir un archivo');
    };

    /*** HANDLE FORM SUBMISSION ***/
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (files.length === 0) {
            setFileError(true);
            setFileErrorMessage('Debes subir un archivo');
            return;
        }

        if (benefitList.length < 3) {
            setBenefitError('Debes indicar al menos 3 beneficios que obtienes por desarrollar este laboratorio');
            return;
        }

        setFileError(false);
        setSubmitError('');

        const formData = new FormData();
        const url = 'http://localhost:4000/api/labs'
        formData.append('title', labTitle);
        formData.append('description', labDesc);
        formData.append('benefits', JSON.stringify(benefitList));
        formData.append('zipfile', files[0]);

        try {
            const duplicateCheck = await fetch(
                `${url}/check-title?title=${encodeURIComponent(labTitle)}`
            );
            const duplicateResult = await duplicateCheck.json();

            if (duplicateResult.exists) {
                setTitleError('Ya existe un laboratorio con este título');
                return;
            }

            setSuccessMessage(''); // clear any old message before trying again

            // No Content-Type here: the browser sets it (with the boundary) for FormData
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error('Server error:', result);
                setSubmitError(
                    response.status < 500
                        ? (result.message || result.error || 'No se pudo crear el laboratorio.')
                        : 'No se pudo crear el laboratorio. Intenta de nuevo.'
                );
                return;
            }

            console.log('Lab created:', result);
            setSuccessMessage('Laboratorio creado exitosamente');
        } catch (err) {
            console.error('Network error:', err);
            setSubmitError('No se pudo conectar con el servidor.');
        }
    };

    const resetForm = () => {
        setLabTitle('');
        setLabDesc('');
        setBenefitInput('');
        setBenefitList([]);
        setBenefitFocused(false);
        setFiles([]);
        setFileError(false);
        setFileErrorMessage('');
        setTitleError('');
        setDescError('');
        setBenefitError('');
        setSubmitError('');
    };

    /*** PAGE ***/

    return(
        <>
        <div className="container">
            <span className="dashboard-section-header">
                <p>Crea tu propio laboratorio de pentesting y compártelo con la comunidad!</p>
            </span>
            <form className="container-create-lab" onSubmit={handleSubmit}>
                <div className="container-wrapper">
                    <div className="container-create-lab-info">
                        <div className="nebula-input">
                            <input
                                required
                                type="text"
                                name="username"
                                autoComplete="off"
                                className="input"
                                maxLength={50}
                                value={labTitle}
                                onChange={(e) => setLabTitle(e.target.value)}
                                onBlur={(e) => validateTitle(e.target.value)}
                            />
                            <label className='user-label'>Título del laboratorio</label>
                            <p className="nebula-error">{titleError}</p>
                        </div>
                        <div className="nebula-input--desc">
                            <textarea
                                required
                                name="username"
                                autoComplete="off"
                                className="input"
                                value={labDesc}
                                maxLength={500}
                                onChange={(e) => setLabDesc(e.target.value)}
                                onBlur={(e) => validateDesc(e.target.value)}
                            />
                            <label className='user-label'>Descripción del laboratorio</label>
                            <p className="nebula-error">{descError}</p>
                        </div>
                        <div className="nebula-input--bnf">
                            <input
                                type="text"
                                name="benefit"
                                autoComplete="off"
                                className="input"
                                value={benefitInput}
                                onChange={(e) => setBenefitInput(e.target.value)}
                                onKeyDown={handleBenefitKeyDown}
                                onFocus={() => setBenefitFocused(true)}
                                onBlur={(e) => {
                                    setBenefitFocused(false);
                                    validateBenefitCount();
                                }}
                            />
                            <label
                                className={`user-label ${
                                    benefitFocused || benefitInput.length > 0 ? 'user-label--float' : ''
                                }`}
                            >
                                Beneficios (presiona Enter para agregar)
                            </label>
                            <div className="benefit-tags">
                                {benefitList.map((benefit, index) => (
                                    <span key={index} className="benefit-tag">
                                        {benefit}
                                        <button type="button" onClick={() => handleRemoveBenefit(index)}>×</button>
                                    </span>
                                ))}
                            </div>

                            <p className="nebula-error">{benefitError}</p>
                        </div>
                    </div>

                    <div className="container-create-lab-files"
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
                </div> 
                {fileError && (
                    <p className="file-error-msg">{fileErrorMessage}</p>
                )}  
                {submitError && (
                    <p className="file-error-msg">{submitError}</p>
                )}
                <div className="container-create-lab-submit">
                    <button>
                        Crear Laboratorio
                    </button>
                    <p>No sabes cómo crear un laboratorio? Sigue esta guía</p>
                </div> 
                
            </form>
            {showFilesModal && (
            <DashboardLabsFileModal
                files={files}
                onRemove={handleRemoveFile}
                onClose={() => setShowFilesModal(false)}
            />
            )}
            {successMessage && (
                <SuccessModal message={successMessage} onClose={() => {setSuccessMessage(''); resetForm();}} />
            )}
        </div>
        </>
    )
}


export default DashboardLabsCreate