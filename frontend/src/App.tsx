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
import PlacementTest from './components/PlacementTest'; // Import der neuen Komponente

interface AppState {
    user: User | null;
    token: string | null;
}

// A new component to contain the logic that needs access to routing hooks
const AppContent = () => {
    const [appState, setAppState] = useState<AppState>(() => {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');
        return {
            user: savedUser ? JSON.parse(savedUser) : null,
            token: savedToken ?? null
        };
    });
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const savedMode = localStorage.getItem('darkMode');
        return savedMode === 'true';
    });
    const location = useLocation(); // Hook to get location

    useEffect(() => {
        if (appState.user && appState.token) {
            localStorage.setItem('user', JSON.stringify(appState.user));
            localStorage.setItem('token', appState.token);
        } else {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
    }, [appState]);

    useEffect(() => {
        document.body.className = isDarkMode ? 'dark-mode' : '';
        localStorage.setItem('darkMode', isDarkMode.toString());
    }, [isDarkMode]);

    const handleLogout = async () => {
        if (appState.user) {
            await logout(appState.user.username);
            setAppState({ user: null, token: null });
        }
    };

    const handleLoginSuccess = (user: User, token: string) => {
        setAppState({ user, token });
    };

    const handleTestComplete = (level: string) => {
        if(appState.user) {
            const updatedUser = { ...appState.user, level };
            setAppState({ ...appState, user: updatedUser });
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
                    {appState.user ? (
                        <>
                            {appState.user.role === 'teacher' && <Link to="/dashboard" className="nav-button">Lehrer-Dashboard</Link>}
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
                    <Route path="/" element={
                        !appState.user || !appState.token ? <WelcomePage /> :
                        appState.user.role === 'teacher' ? <Navigate to="/dashboard" /> :
                        appState.user.level === null ? <Navigate to="/placement-test" /> :
                        <Hangman user={appState.user} token={appState.token} />
                    } />
                    <Route path="/login" element={!appState.user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />} />
                    <Route path="/register" element={!appState.user ? <Register onRegisterSuccess={(user) => handleLoginSuccess(user, '')} /> : <Navigate to="/" />} />
                    <Route path="/dashboard" element={appState.user && appState.user.role === 'teacher' && appState.token ? <TeacherDashboard user={appState.user} token={appState.token} /> : <Navigate to="/" />} />
                    <Route path="/placement-test" element={appState.user && appState.user.level === null ? <PlacementTest user={appState.user} onTestComplete={handleTestComplete} /> : <Navigate to="/" />} />
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