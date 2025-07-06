import React, { useState, useEffect } from 'react';
import './Hangman.css';

interface HangmanProps {
  level: string;
  onGameEnd: (word: string, incorrectLetters: string[]) => void;
  problemLetters: string[];
}

const Hangman: React.FC<HangmanProps> = ({ level, onGameEnd, problemLetters }) => {
    const [selectedWord, setSelectedWord] = useState<string>('');
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [wrongGuesses, setWrongGuesses] = useState<number>(0);
    const [incorrectLetters, setIncorrectLetters] = useState<string[]>([]);
    const [gameHasEnded, setGameHasEnded] = useState(false);

    const isGameOver = wrongGuesses >= 6;
    const isWinner = selectedWord !== '' && selectedWord.split('').every(letter => guessedLetters.includes(letter));

    useEffect(() => {
        if ((isGameOver || isWinner) && !gameHasEnded) {
            onGameEnd(selectedWord, incorrectLetters);
            setGameHasEnded(true);
        }
    }, [isGameOver, isWinner, selectedWord, incorrectLetters, onGameEnd, gameHasEnded]);


    useEffect(() => {
        const fetchWord = async () => {
            try {
                let url = `http://localhost:5000/api/word?level=${level}`;
                if (problemLetters.length > 0) {
                  url += `&problem_letters=${problemLetters.join(',')}`;
                }
                const response = await fetch(url);
                const data = await response.json();
                setSelectedWord(data.word.toLowerCase());
            } catch (error) {
                console.error('Error fetching word:', error);
                // Fallback word in case of an error
                setSelectedWord('fehler');
            }
        };

        fetchWord();
    }, [level, problemLetters]);

    const handleGuess = (letter: string) => {
        if (!guessedLetters.includes(letter)) {
            setGuessedLetters([...guessedLetters, letter]);
            if (!selectedWord.includes(letter)) {
                setWrongGuesses(wrongGuesses + 1);
                setIncorrectLetters([...incorrectLetters, letter]);
            }
        }
    };

    const displayWord = selectedWord.split('').map(letter => (guessedLetters.includes(letter) ? letter : '_')).join(' ');

    return (
        <div className="hangman-container">
            <h1>Hangman</h1>
            <div className="word-display">{displayWord}</div>
            <div className="keyboard">
                {'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => (
                    <button
                        key={letter}
                        onClick={() => handleGuess(letter)}
                        disabled={!!(guessedLetters.includes(letter) || isGameOver || isWinner)}
                    >
                        {letter}
                    </button>
                ))}
            </div>
            {isGameOver && <div className="game-over">Verloren! Das Wort war: {selectedWord}</div>}
            {isWinner && <div className="game-over">Gewonnen!</div>}
            <div className="wrong-guesses">Falsche Versuche: {wrongGuesses} / 6</div>
        </div>
    );
};

export default Hangman; 