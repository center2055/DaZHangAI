import React, { useState, useEffect } from 'react';
import './Hangman.css';
import { getGameData, getHint as apiGetHint, postGameResult as apiPostGameResult } from '../gameApi';
import { User } from '../types';

interface HangmanProps {
    user: User;
}

const Hangman: React.FC<HangmanProps> = ({ user }) => {
    const [word, setWord] = useState<string>('');
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState<number>(0);
    const [message, setMessage] = useState<string>('');
    const [gameOver, setGameOver] = useState<boolean>(false);
    const [, setGameWon] = useState<boolean>(false);
    const [level, ] = useState<string>('a1');
    const [useModel, ] = useState<boolean>(true);
    const [hint, setHint] = useState<string | null>(null);
    const [proactiveFeedback, setProactiveFeedback] = useState<string>('');
    const [, setStartTime] = useState<Date | null>(null);

    const startNewGame = React.useCallback(async () => {
        try {
            const data = await getGameData(level, useModel, user.username);
            setWord(data.word);
            setGuessedLetters([]);
            setMistakes(0);
            setGameOver(false);
            setGameWon(false);
            setHint(null);
            setProactiveFeedback('');
            setMessage('');
            setStartTime(new Date());
        } catch (error) {
            console.error('Error starting new game:', error);
            setMessage('Fehler beim Starten des Spiels.');
        }
    }, [level, useModel, user.username]);

    const handleGuess = async (letter: string) => {
        if (gameOver || guessedLetters.includes(letter)) {
            return;
        }

        const normalizedLetter = letter.toLowerCase();
        const isCorrect = word.includes(normalizedLetter);

        setGuessedLetters(prev => [...prev, normalizedLetter]);

        if (!isCorrect) {
            setMistakes(prev => prev + 1);
            setProactiveFeedback('Leider falsch!');
        } else {
            setProactiveFeedback('Richtig!');
        }

        const newMistakes = isCorrect ? mistakes : mistakes + 1;
        const newGuessedLetters = [...guessedLetters, normalizedLetter];

        if (newMistakes >= 6) {
            setGameOver(true);
            setGameWon(false);
            setMessage('Verloren! Das Wort war: ' + word);
            const gameResult = await apiPostGameResult(user.username, word, newMistakes, false);
            setProactiveFeedback(gameResult.proactive_feedback);
        } else if (word.split('').every(l => newGuessedLetters.includes(l))) {
            setGameOver(true);
            setGameWon(true);
            setMessage('Gewonnen! Du hast das Wort erraten!');
            const gameResult = await apiPostGameResult(user.username, word, newMistakes, true);
            setProactiveFeedback(gameResult.proactive_feedback);
        }
    };

    const getHint = async () => {
        if (!word || gameOver) return;
        try {
            const response = await apiGetHint(word);
            setHint(response.hint);
        } catch (error) {
            console.error('Error getting hint:', error);
            setMessage('Hinweis konnte nicht geladen werden.');
        }
    };
    
    useEffect(() => {
        startNewGame();
    }, [startNewGame]);

    const maskedWord = word.split('').map(letter => (guessedLetters.includes(letter.toLowerCase()) || letter === ' ' ? letter : '_')).join(' ');

    const keyboard = [
        'QWERTYUIOP'.split(''),
        'ASDFGHJKLÖÄ'.split(''),
        'ZXCVBNMẞÜ'.split('')
    ];

    return (
        <div className="hangman-container">
            <div className="game-info">
                <p>Viel Erfolg, {user.username}!</p>
                <p>Fehler: {mistakes} / 6</p>
            </div>
            <div className="word-display">{maskedWord}</div>
            <div className="keyboard">
                {keyboard.map((row, rowIndex) => (
                    <div key={rowIndex} className="keyboard-row">
                        {row.map(char => (
                            <button
                                key={char}
                                onClick={() => handleGuess(char)}
                                disabled={gameOver || guessedLetters.includes(char.toLowerCase())}
                                className={guessedLetters.includes(char.toLowerCase()) ? 'guessed' : ''}
                            >
                                {char}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
            <div className="game-controls">
                <button onClick={startNewGame}>Neues Spiel</button>
                <button onClick={getHint} disabled={!word || gameOver || !!hint}>Hinweis</button>
            </div>
            {message && <p className="message">{message}</p>}
            {hint && <p className="hint">Hinweis: {hint}</p>}
            {proactiveFeedback && <p className="proactive-feedback">{proactiveFeedback}</p>}
        </div>
    );
};

export default Hangman; 