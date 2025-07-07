import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Hangman from './components/Hangman';
import Login from './components/Login';
import Register from './components/Register';
import TeacherDashboard from './components/TeacherDashboard';
import { User } from './types';
import { logout } from './authApi';
import WelcomePage from './components/WelcomePage';

// A new component to contain the logic that needs access to routing hooks
const AppContent = () => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const savedMode = localStorage.getItem('darkMode');
        return savedMode === 'true';
    });
    const location = useLocation(); // Hook to get location

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    useEffect(() => {
        document.body.className = isDarkMode ? 'dark-mode' : '';
        localStorage.setItem('darkMode', isDarkMode.toString());
    }, [isDarkMode]);

    const handleLogout = async () => {
        if (user) {
            await logout(user.username);
            setUser(null);
        }
    };

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    return (
        <div className="App">
            <header className="App-header">
                {location.pathname !== '/' && <Link to="/" className="header-title"><h1>DaZHang</h1></Link>}
                <div className="header-spacer"></div>
                <nav className="header-nav">
                    {user ? (
                        <>
                            {user.role === 'teacher' && <Link to="/dashboard" className="nav-button">Lehrer-Dashboard</Link>}
                            <button onClick={handleLogout} className="nav-button">Abmelden</button>
                        </>
                    ) : (
                        // Only show login/register in header if not on the welcome page
                        location.pathname !== '/' && (
                            <>
                                <Link to="/login" className="nav-button">Anmelden</Link>
                                <Link to="/register" className="nav-button secondary">Registrieren</Link>
                            </>
                        )
                    )}
                    <button onClick={toggleDarkMode} className="dark-mode-toggle">
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                </nav>
            </header>
            <main>
                <Routes>
                    <Route path="/" element={user ? <Hangman user={user} /> : <WelcomePage />} />
                    <Route path="/login" element={!user ? <Login onLoginSuccess={setUser} /> : <Navigate to="/" />} />
                    <Route path="/register" element={!user ? <Register onRegisterSuccess={() => { /* maybe redirect or show message */ }} /> : <Navigate to="/" />} />
                    <Route path="/dashboard" element={user && user.role === 'teacher' ? <TeacherDashboard /> : <Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}


function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App; 