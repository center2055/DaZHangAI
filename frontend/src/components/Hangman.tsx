import React, { useState, useEffect, useCallback } from 'react';
import { User, Word } from '../types';
import { getWord, logGame, getFeedback } from '../gameApi'; // Korrigierte Imports
import './Hangman.css';

const MAX_WRONG_GUESSES = 6;

const HANGMAN_PICS = [
`
  +---+
  |   |
      |
      |
      |
      |
=========`,
`
  +---+
  |   |
  O   |
      |
      |
      |
=========`,
`
  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
`
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
`
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
`
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
`
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`
];


interface HangmanProps {
    user: User;
    token: string;
    initialWord?: Word;
    onGameEnd?: (gameWon: boolean) => void;
    isPlacementTest?: boolean;
}

const Hangman: React.FC<HangmanProps> = ({ user, token, initialWord, onGameEnd, isPlacementTest = false }) => {
    const [word, setWord] = useState<string>('');
    const [wordType, setWordType] = useState<string>('');
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
    const [loading, setLoading] = useState(!initialWord);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [useModel, setUseModel] = useState(false); // KI-Modus Steuerung

    const wrongLetters = guessedLetters.filter(letter => !word.includes(letter));
    const isWordGuessed = word && word.split('').every(letter => guessedLetters.includes(letter));

    const fetchNewWord = useCallback(async () => {
        setLoading(true);
        setError(null);
        setFeedback(null);
        try {
            if (!token) throw new Error("Kein Authentifizierungstoken gefunden.");
            const data = await getWord(user.level || 'a1', useModel, token);
            setWord(data.word.toLowerCase());
            setWordType(data.type); // 'type' statt 'wordType'
            setGuessedLetters([]);
            setGameStatus('playing');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Laden eines neuen Wortes.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user.level, useModel, token]);

    useEffect(() => {
        if (initialWord) {
            setWord(initialWord.word.toLowerCase());
            setWordType(initialWord.wordType);
            setGuessedLetters([]);
            setGameStatus('playing');
        } else {
            fetchNewWord();
        }
    }, [initialWord, fetchNewWord]);

    const handleGameEnd = useCallback(async (won: boolean) => {
        if (!token) return;
        try {
            await logGame(word, wordType, won, wrongLetters.length, token);
            const feedbackData = await getFeedback(token);
            setFeedback(feedbackData.feedback);
        } catch (error) {
            console.error("Fehler beim Loggen des Spiels oder beim Holen des Feedbacks:", error);
        }
        if (onGameEnd) onGameEnd(won);
    }, [word, wordType, wrongLetters.length, token, onGameEnd]);


    useEffect(() => {
        if (gameStatus === 'playing') {
             if (isWordGuessed) {
                setGameStatus('won');
                handleGameEnd(true);
            } else if (wrongLetters.length >= MAX_WRONG_GUESSES) {
                setGameStatus('lost');
                handleGameEnd(false);
            }
        }
    }, [guessedLetters, gameStatus, isWordGuessed, wrongLetters.length, handleGameEnd]);


    const handleGuess = useCallback((letter: string) => {
        if (gameStatus !== 'playing' || guessedLetters.includes(letter)) {
            return;
        }
        setGuessedLetters(prev => [...prev, letter]);
    }, [gameStatus, guessedLetters]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if (/^[a-zäöü]$/.test(key)) {
                handleGuess(key);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleGuess]);

    const displayWord = word.split('').map(letter => (guessedLetters.includes(letter) ? letter : '_')).join(' ');

    if (loading) return <p>Lade Spiel...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="hangman-container">
            {gameStatus === 'won' && <div className="game-feedback success">Super, du hast es geschafft! 🎉</div>}
            {gameStatus === 'lost' && (
                <div className="game-feedback error">
                    Nicht ganz! Das richtige Wort war: <strong>{word.toUpperCase()}</strong>. Nächstes Mal klappt's!
                </div>
            )}
            
            <div className="hangman-drawing">{HANGMAN_PICS[wrongLetters.length]}</div>

            {feedback && <div className="game-feedback info">{feedback}</div>}

            {!isPlacementTest && (
                <div className="game-controls">
                    <button onClick={fetchNewWord} className="next-word-btn">
                        Nächstes Wort
                    </button>
                    <div className="ki-toggle">
                        <label>
                            <input
                                type="checkbox"
                                checked={useModel}
                                onChange={() => setUseModel(!useModel)}
                            />
                            KI-Trainingsmodus
                        </label>
                    </div>
                </div>
            )}
            
            <div className="hangman-word">{displayWord}</div>
            <p>Kategorie: {wordType}</p>
            <p>Fehlversuche: {wrongLetters.length} / {MAX_WRONG_GUESSES}</p>

            <div className="keyboard">
                {'abcdefghijklmnopqrstuvwxyzäöü'.split('').map((letter) => {
                    const isGuessed = guessedLetters.includes(letter);
                    const isCorrect = isGuessed && word.includes(letter);
                    const isIncorrect = isGuessed && !word.includes(letter);

                    let buttonClass = '';
                    if (isCorrect) buttonClass = 'guessed correct';
                    if (isIncorrect) buttonClass = 'guessed incorrect';

                    return (
                        <button
                            key={letter}
                            onClick={() => handleGuess(letter)}
                            disabled={isGuessed || gameStatus !== 'playing'}
                            className={buttonClass}
                        >
                            {letter}
                        </button>
                    );
                })}
            </div>

            {!isPlacementTest && (gameStatus === 'won' || gameStatus === 'lost') && (
                <button onClick={fetchNewWord} className="next-word-btn">Nächstes Wort</button>
            )}
        </div>
    );
};

export default Hangman; 