import { use, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

import Header from './components/Header'

import RegisterPage from './pages/RegisterPage'

import LoginModal from './components/LoginModal'

import Dashboard from './pages/Dashboard'

import LabsPage from './pages/LabsPage'

import Session from './pages/Session'

import CreationGuide from './pages/CreationGuide'

import ProfilePage from './pages/ProfilePage'

import LegalPolicy from './pages/LegalPolicy'

import TermsPage from './pages/TermsPage'

import { AuthProvider } from './context/AuthContext'

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // One function for everything that opens the login window (the header, the register page, the labs page)
  const openLogin = () => setIsLoginOpen(true);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Header onLoginClick={openLogin} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterPage onLoginClick={openLogin}/>}/>
          <Route path="/labs" element={<LabsPage onLoginClick={openLogin} />} />
          <Route path="/dashboard" element={<Dashboard/>}/>
          <Route path="/session/:sessionid" element={<Session/>}/>
          <Route path="/docs" element={<CreationGuide/>}/>
          <Route path="/perfil" element={<ProfilePage/>}/>
          <Route path="/perfil/:username" element={<ProfilePage/>}/>
          <Route path="/privacy-policy" element={<LegalPolicy/>}/>
          <Route path="/terms" element={<TermsPage/>}/>
          
        </Routes>

        {isLoginOpen && (<LoginModal onClose={() => setIsLoginOpen(false)} />)}

      </BrowserRouter>
    </AuthProvider>  
  );
}

export default App;