import React, { useState } from 'react';
import { login } from '../authApi';
import { User } from '../types';
import './Login.css';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login(username, password);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Ein unerwarteter Fehler ist aufgetreten.');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Anmelden</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="username">Benutzername</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Passwort</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-btn">Anmelden</button>
        <div className="info-box">
          <h3>Für BWKI 2025</h3>
          <p>
            Demo-Zugang zum Lehrerbereich:<br/>
            <strong>Benutzer:</strong> Lehrer<br/>
            <strong>Passwort:</strong> BWKI2025!
          </p>
          <p>
            Dieser Zugang ist ausschließlich für Jury-Demos gedacht. Das Konto
            <strong> kann nicht spielen</strong> und dient nur zur Ansicht des
            Lehrer-Dashboards. Beim Veröffentlichen auf GitHub bleibt nur der
            Benutzer <strong>"Lehrer"</strong> bestehen.
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login; 