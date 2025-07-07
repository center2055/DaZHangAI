import React from 'react';
import { Link } from 'react-router-dom';
import './WelcomePage.css';

const WelcomePage: React.FC = () => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1 className="welcome-title">Willkommen bei DaZHang!</h1>
        <p className="welcome-subtitle">Verbessere dein Deutsch spielerisch.</p>
        <div className="welcome-actions">
          <Link to="/login" className="btn btn-primary">Anmelden</Link>
          <Link to="/register" className="btn btn-secondary">Registrieren</Link>
        </div>
      </div>
      <div className="welcome-graphic">
        {/* Placeholder for a future graphic or animation */}
        <span role="img" aria-label="Book and pencil" style={{fontSize: '8rem'}}>📚✏️</span>
      </div>
    </div>
  );
};

export default WelcomePage; 