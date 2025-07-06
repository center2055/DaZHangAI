import React, { useState, useEffect } from 'react';
import './App.css';
import Hangman from './components/Hangman';
import { fetchFeedback, logGame } from './api';

function App() {
  const [level, setLevel] = useState<string>('a1');
  const [gameId, setGameId] = useState<number>(1);
  const [userProfile, setUserProfile] = useState<{ incorrectLetters: string[], problemLetters: string[] }>({ 
    incorrectLetters: [],
    problemLetters: [] 
  });
  const [useModel, setUseModel] = useState<boolean>(false);
  const [activeButton, setActiveButton] = useState<string>('a1');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const getFeedback = async () => {
      if (gameId > 1) { // Nicht beim allerersten Laden
        const message = await fetchFeedback();
        setFeedback(message);
      }
    };
    getFeedback();
  }, [gameId]);


  const startNewGame = (newLevel: string, shouldUseModel = false) => {
    setLevel(newLevel);
    setUseModel(shouldUseModel);
    setGameId(prevId => prevId + 1);
    setActiveButton(shouldUseModel ? 'personal' : newLevel);
  }

  const handleGameEnd = async (word: string, incorrectLetters: string[]) => {
    // Vermeide Duplikate im Fehlerprofil
    const newIncorrectLetters = Array.from(new Set([...userProfile.incorrectLetters, ...incorrectLetters]));
    const gameResult = await logGame(word, incorrectLetters.length, incorrectLetters.length < 6);
    
    setUserProfile({ 
      incorrectLetters: newIncorrectLetters,
      problemLetters: gameResult.problem_letters 
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Deutsch-Lern-Galgenmännchen</h1>
        <p>Wähle ein Sprachniveau oder starte dein persönliches KI-Training, um gezielt an deinen Schwächen zu arbeiten.</p>
        <div className="level-selection">
          <button onClick={() => startNewGame('a1')} className={activeButton === 'a1' ? 'active' : ''}>A1</button>
          <button onClick={() => startNewGame('a2')} className={activeButton === 'a2' ? 'active' : ''}>A2</button>
          <button onClick={() => startNewGame('b1')} className={activeButton === 'b1' ? 'active' : ''}>B1</button>
          {userProfile.incorrectLetters.length > 0 && (
            <button className={`personal-btn ${activeButton === 'personal' ? 'active' : ''}`} onClick={() => startNewGame(level, true)}>
              KI-Training
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <div className="feedback-banner">
          <p>{feedback}</p>
        </div>
      )}
      
      <Hangman key={gameId} level={level} onGameEnd={handleGameEnd} useModel={useModel} />

      {userProfile.incorrectLetters.length > 0 && (
        <div className="user-profile">
          <h3>Dein Lern-Profil</h3>
          {userProfile.problemLetters.length > 0 && (
            <div className="profile-section">
              <h4>Top 5 Problembuchstaben:</h4>
              <div className="letter-tags">
                {userProfile.problemLetters.map(letter => <span key={letter} className="letter-tag">{letter}</span>)}
              </div>
            </div>
          )}
          <div className="profile-section">
            <h4>Alle bisher falsch geratenen Buchstaben:</h4>
            <p>{userProfile.incorrectLetters.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 