import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login } from '../authApi';
import { User } from '../types';
import './Login.css'; // Wir können die gleichen Stile wiederverwenden

interface RegisterProps {
  onRegisterSuccess: (user: User, token: string) => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [otherMotherTongue, setOtherMotherTongue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    
    const finalMotherTongue = motherTongue === 'Sonstige' ? otherMotherTongue : motherTongue;

    const result = await register(username, password, age, finalMotherTongue);

    if (result.success) {
      try {
        const loginData = await login(username, password);
        onRegisterSuccess(loginData.user, loginData.token);
        navigate('/');
      } catch (loginError) {
        console.error('Auto-login after registration failed:', loginError);
        setError('Registrierung erfolgreich, aber automatischer Login fehlgeschlagen. Bitte manuell anmelden.');
      }
    } else {
      setError(result.message || 'Registrierung fehlgeschlagen.');
    }
  };

  const commonLanguages = [
    "Arabisch", "Bulgarisch", "Chinesisch (Mandarin)", "Englisch", "Farsi (Persisch)", "Französisch", 
    "Griechisch", "Hindi", "Italienisch", "Kroatisch", "Niederländisch", "Polnisch", "Portugiesisch", 
    "Rumänisch", "Russisch", "Serbisch", "Spanisch", "Tschechisch", "Türkisch", "Ukrainisch", "Ungarisch"
  ];

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Neues Konto erstellen</h2>
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
        <div className="form-group">
          <label htmlFor="confirm-password">Passwort bestätigen</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="age">Alter</label>
          <input
            type="number"
            id="age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="motherTongue">Muttersprache</label>
          <select
            id="motherTongue"
            value={motherTongue}
            onChange={(e) => setMotherTongue(e.target.value)}
            required
          >
            <option value="">Bitte auswählen</option>
            {commonLanguages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            <option value="Sonstige">Sonstige</option>
          </select>
        </div>
        {motherTongue === 'Sonstige' && (
          <div className="form-group">
            <label htmlFor="otherMotherTongue">Bitte angeben:</label>
            <input
              type="text"
              id="otherMotherTongue"
              value={otherMotherTongue}
              onChange={(e) => setOtherMotherTongue(e.target.value)}
              required
            />
          </div>
        )}
        <button type="submit" className="login-btn">Registrieren</button>
      </form>
    </div>
  );
};

export default Register; 

