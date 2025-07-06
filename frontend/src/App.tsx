import React, { useState } from 'react';
import './App.css';
import Hangman from './components/Hangman';

function App() {
  const [level, setLevel] = useState<string>('a1');
  const [gameId, setGameId] = useState<number>(1);
  const [userProfile, setUserProfile] = useState<{ incorrectLetters: string[] }>({ incorrectLetters: [] });
  const [problemLetters, setProblemLetters] = useState<string[]>([]);

  const startNewGame = (newLevel: string, useProblemLetters = false) => {
    setLevel(newLevel);
    if (useProblemLetters) {
      // Finde die häufigsten Problembuchstaben für die Anfrage
      const frequencies = userProfile.incorrectLetters.reduce((acc, letter) => {
        acc[letter] = (acc[letter] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const sortedLetters = Object.keys(frequencies).sort((a, b) => frequencies[b] - frequencies[a]);
      setProblemLetters(sortedLetters.slice(0, 3)); // Nimm die Top 3
    } else {
      setProblemLetters([]); // Setze zurück für normale Spiele
    }
    setGameId(prevId => prevId + 1);
  }

  const handleGameEnd = (word: string, incorrectLetters: string[]) => {
    const newIncorrectLetters = [...userProfile.incorrectLetters, ...incorrectLetters];
    setUserProfile({ incorrectLetters: newIncorrectLetters });
    console.log("Spiel beendet! Wort:", word, "Falsche Buchstaben:", incorrectLetters);
    console.log("Neues Profil:", { incorrectLetters: newIncorrectLetters });
  };

  return (
    <div className="App">
      <h2>Wähle ein Level</h2>
      <div className="level-selection">
        <button onClick={() => startNewGame('a1')}>A1</button>
        <button onClick={() => startNewGame('a2')}>A2</button>
        <button onClick={() => startNewGame('b1')}>B1</button>
        {userProfile.incorrectLetters.length > 0 && (
          <button className="personal-btn" onClick={() => startNewGame(level, true)}>
            Schwachstelle trainieren
          </button>
        )}
      </div>
      <Hangman key={gameId} level={level} onGameEnd={handleGameEnd} problemLetters={problemLetters} />
      <div className="user-profile">
        <h3>Fehler-Profil:</h3>
        <p>Bisher falsch geratene Buchstaben: {userProfile.incorrectLetters.join(', ')}</p>
      </div>
    </div>
  );
}

export default App; 