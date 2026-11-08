// Este archivo se encarga de ser el punto de entrada de la aplicación: monta el
// componente raíz de React dentro del elemento #root del HTML y lo envuelve con
// el proveedor de confirmaciones para que esté disponible en toda la app.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ConfirmProvider } from './components/ConfirmContext.jsx';

// Crea la raíz de React sobre #root y renderiza la app completa envuelta en
// ConfirmProvider, de modo que cualquier componente pueda pedir confirmaciones.
createRoot(document.getElementById('root')).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>,
)
