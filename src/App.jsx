import { use, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

import Header from './components/Header'

import RegisterPage from './pages/RegisterPage'

import LoginModal from './components/LoginModal'

import Dashboard from './pages/Dashboard'

import LabsPage from './pages/LabsPage'

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <BrowserRouter>
      <Header onLoginClick={() => {setIsLoginOpen(true)}} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterPage onLoginClick={() => {setIsLoginOpen(true)}}/>}/>
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/dashboard" element={<Dashboard/>}/>
        
      </Routes>

      {isLoginOpen && (<LoginModal onClose={() => setIsLoginOpen(false)} />)}

    </BrowserRouter>
  );
}

export default App;

