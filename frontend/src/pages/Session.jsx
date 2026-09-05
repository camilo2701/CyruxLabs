import { useLocation } from 'react-router-dom';
import '../styles/Session.css'

import Footer from '../components/Footer.jsx'
import SessionDragNDrop from '../components/session/SessionDragNDrop.jsx'

function Session() {
    const location = useLocation();
    const { sessionid, port, protocol, labTitle } = location.state || {};
    const iframeUrl = port ? `${protocol}://10.10.0.11:${port}/` : null;

    const handleStopLab = () => {
        fetch('http://localhost:3001/api/sessions/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionid }),
        }).catch((err) => console.error('Failed to stop lab:', err));
    };

    return (
        <>
            <div className="page">

                <section className="sidebar">

                    <div className="sidebar-labels">
                        <h1>Lab Title</h1>

                        <div className="sidebar-instructions">
                            <h2>Instructions</h2>

                            <ul>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                                <li>ins 1</li>
                            </ul>
                        </div>
                    </div>

                    <div className="sidebar-controls">

                        <div className="sidebar-controls-buttons">
                            <button>
                                Reiniciar Lab
                            </button>

                            <button onClick={handleStopLab}>
                                Terminar Lab
                            </button>
                        </div>

                        <div className="sidebar-controls-ctfpocket">
                            <SessionDragNDrop />
                        </div>

                    </div>

                    <div className="sidebar-timer">
                        <h1>Timer: 00:00</h1>
                    </div>

                </section>

                <section className="desktop">
                    {iframeUrl && <iframe src={iframeUrl} />}
                </section>

            </div>
        </>
    )
}

export default Session