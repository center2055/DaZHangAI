import React, { useState, useEffect, useCallback } from 'react';
import './Hangman.css';
import { fetchWord, logGame, WordData, fetchHint } from '../api';

interface HangmanProps {
  level: string;
  onGameEnd: (word: string, incorrectLetters: string[]) => void;
  useModel: boolean;
}

const Hangman: React.FC<HangmanProps> = ({ level, onGameEnd, useModel }) => {
    const [wordData, setWordData] = useState<WordData | null>(null);
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [wrongGuesses, setWrongGuesses] = useState<number>(0);
    const [incorrectLetters, setIncorrectLetters] = useState<string[]>([]);
    const [gameHasEnded, setGameHasEnded] = useState(false);
    const [hint, setHint] = useState<string>('');

    const selectedWord = wordData ? wordData.word.toLowerCase() : '';
    const isGameOver = wrongGuesses >= 6;
    const isWinner = selectedWord !== '' && selectedWord.split('').every(letter => guessedLetters.includes(letter));

    const handleGameEnd = useCallback(() => {
        if (!gameHasEnded) {
            onGameEnd(selectedWord, incorrectLetters);
            logGame(selectedWord, wrongGuesses, isWinner);
            setGameHasEnded(true);
        }
    }, [gameHasEnded, incorrectLetters, onGameEnd, selectedWord, wrongGuesses, isWinner]);


    useEffect(() => {
        if (isGameOver || isWinner) {
            handleGameEnd();
        }
    }, [isGameOver, isWinner, handleGameEnd]);


    useEffect(() => {
        const getWord = async () => {
            const data = await fetchWord(level, useModel);
            setWordData(data);
            setGuessedLetters([]);
            setWrongGuesses(0);
            setIncorrectLetters([]);
            setGameHasEnded(false);
            setHint(''); // Hinweis zurücksetzen
        };
        getWord();
    }, [level, useModel]);

    const handleGuess = (letter: string) => {
        const normalizedLetter = letter.toLowerCase();
        if (!guessedLetters.includes(normalizedLetter)) {
            const isCorrect = selectedWord.includes(normalizedLetter);
            setGuessedLetters([...guessedLetters, normalizedLetter]);
            if (!isCorrect) {
                setWrongGuesses(wrongGuesses + 1);
                setIncorrectLetters([...incorrectLetters, normalizedLetter]);
            }
        }
    };

    const requestHint = async () => {
        if (!wordData) return;
        const fetchedHint = await fetchHint(wordData.word);
        setHint(fetchedHint);
    };

    const displayWord = selectedWord
        .split('')
        .map(letter => (guessedLetters.includes(letter) || letter === ' ' ? letter : '_'))
        .join(' ');

    const alphabet = 'abcdefghijklmnopqrstuvwxyzäöüß'.split('');

    return (
        <div className="hangman-container">
            <div className="word-display">{displayWord}</div>
            <div className="keyboard">
                {alphabet.map(letter => (
                    <button
                        key={letter}
                        onClick={() => handleGuess(letter)}
                        disabled={guessedLetters.includes(letter) || isGameOver || isWinner}
                    >
                        {letter}
                    </button>
                ))}
            </div>
            <div className="game-controls">
                <div className="wrong-guesses">Falsche Versuche: {wrongGuesses} / 6</div>
                <button className="hint-btn" onClick={requestHint} disabled={!!hint || isGameOver || isWinner}>
                    Tipp anfordern
                </button>
            </div>
            {hint && <div className="hint-display">{hint}</div>}
            {isGameOver && <div className="game-over game-over-lost">Verloren! Das Wort war: <strong>{selectedWord}</strong></div>}
            {isWinner && <div className="game-over game-over-won">Super! Du hast das Wort erraten!</div>}
        </div>
    );
};

export default Hangman; 