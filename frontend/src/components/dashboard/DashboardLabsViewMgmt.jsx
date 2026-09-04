import { useState } from "react";
import '../../styles/DashboardLabsViewMgmt.css'

function DashboardLabsViewMgmt(){
    const [labSearch, setLabSearch] = useState('');

    const handleSearchInputChange = (event) => {
        setLabSearch(event.target.value);
        setHasSearched(false);
    };
    
    return(
        <>
        <div className="container">
            <span className="dashboard-section-header">
                <p>Consulta la lista de laboratorios actuales, sus autores y su información relacionada</p>
            </span>
            <div className="dashboard-search-row">
              <input
                id="student-search"
                type="text"
                value={labSearch}
                maxLength={50}
                placeholder="Buscar por usuario, nombre o apellido..."
                onChange={handleSearchInputChange}
              />

              <button
                type="submit"
                disabled={!labSearch.trim()}
              >
                Buscar
              </button>
            </div>
            <span className="container-subtitle">
                <h2>Últimos laboratorios creados</h2>
            </span>


        </div>
        </>
    )
}

export default DashboardLabsViewMgmt