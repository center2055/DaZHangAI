import React, { useState, useEffect, useCallback } from 'react';
import { User, Word } from '../types';
import { getWord, logGame, getUserStatistics, consumeHintCredit } from '../gameApi'; // Korrigierte Imports
import './Hangman.css';

const MAX_WRONG_GUESSES = 6;

const isEszett = (letter: string) => letter === 'ß';
const formatLetter = (letter: string) => (isEszett(letter) ? letter : letter.toUpperCase());
const formatWord = (word: string) => word.split('').map(formatLetter).join('');
interface HangmanIllustrationProps {
    wrongCount: number;
}

const HangmanIllustration: React.FC<HangmanIllustrationProps> = ({ wrongCount }) => {
    // Draw gallows always; reveal parts of the figure progressively based on wrongCount
    const showHead = wrongCount >= 1;
    const showBody = wrongCount >= 2;
    const showLeftArm = wrongCount >= 3;
    const showRightArm = wrongCount >= 4;
    const showLeftLeg = wrongCount >= 5;
    const showRightLeg = wrongCount >= 6;

    return (
        <div className="hangman-illustration">
            <svg className="hangman-svg" viewBox="0 0 200 200" role="img" aria-label={`Fehlversuche: ${wrongCount}`}>
                {/* Gallows */}
                <line x1="20" y1="180" x2="180" y2="180" className="gallow" />
                <line x1="40" y1="180" x2="40" y2="20" className="gallow" />
                <line x1="40" y1="20" x2="130" y2="20" className="gallow" />
                <line x1="130" y1="20" x2="130" y2="40" className="gallow rope" />

                {/* Figure parts */}
                <circle cx="130" cy="55" r="12" className={`hangman-part ${showHead ? 'visible' : ''}`} />
                <line x1="130" y1="67" x2="130" y2="105" className={`hangman-part ${showBody ? 'visible' : ''}`} />
                <line x1="130" y1="80" x2="110" y2="95" className={`hangman-part ${showLeftArm ? 'visible' : ''}`} />
                <line x1="130" y1="80" x2="150" y2="95" className={`hangman-part ${showRightArm ? 'visible' : ''}`} />
                <line x1="130" y1="105" x2="118" y2="135" className={`hangman-part ${showLeftLeg ? 'visible' : ''}`} />
                <line x1="130" y1="105" x2="142" y2="135" className={`hangman-part ${showRightLeg ? 'visible' : ''}`} />
            </svg>
        </div>
    );
};

// Legacy ASCII art removed (replaced with SVG illustration)


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
    const [excludedLetters, setExcludedLetters] = useState<string[]>([]); // Letters to cross out initially
    const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
    const [loading, setLoading] = useState(!initialWord);
    const [error, setError] = useState<string | null>(null);
    const [serverHint, setServerHint] = useState<string | null>(null);
    const [category, setCategory] = useState<string | undefined>(undefined);
    const [useModel, setUseModel] = useState(false); // KI-Modus Steuerung
    const [hintCredits, setHintCredits] = useState<number>(0);
    // Add state for progress
    const [progress, setProgress] = useState({ wins: 0, losses: 0 });

    const wrongLetters = guessedLetters.filter(letter => !word.includes(letter));
    const isWordGuessed = word && word.split('').every(letter => guessedLetters.includes(letter));

    const fetchNewWord = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!token) throw new Error("Kein Authentifizierungstoken gefunden.");
            const data = await getWord(user.level || 'a1', useModel, token);
            setWord(data.word.toLowerCase());
            setWordType(data.type); // 'type' statt 'wordType'
            setCategory(data.category);
            
            // Handle initial hints from backend
            const preRevealedLetters = data.pre_revealed_letters || [];
            const excludedLettersFromServer = data.excluded_letters || [];
            
            // Start with pre-revealed letters already guessed
            setGuessedLetters([...preRevealedLetters]);
            setExcludedLetters([...excludedLettersFromServer]);
            setGameStatus('playing');
            setServerHint(null);
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
            const preRevealedLetters = initialWord.pre_revealed_letters || [];
            const excludedLettersFromServer = initialWord.excluded_letters || [];
            setGuessedLetters([...preRevealedLetters]);
            setExcludedLetters([...excludedLettersFromServer]);
            setGameStatus('playing');
            setServerHint(null);
            setCategory(initialWord.category);
        } else {
            fetchNewWord();
        }
    }, [initialWord, fetchNewWord]);

    // Fetch progress on mount
    useEffect(() => {
        const fetchProgress = async () => {
            if (!token) {
                console.log('No token available for fetching statistics');
                return;
            }
            try {
                console.log('Fetching user statistics...');
                const stats = await getUserStatistics(token);
                console.log('Received statistics:', stats);
                const newProgress = { wins: stats.wins, losses: stats.losses };
                console.log('Setting progress to:', newProgress);
                setProgress(newProgress);
                if (typeof (stats as any).hint_credits === 'number') {
                    setHintCredits((stats as any).hint_credits);
                }
            } catch (error) {
                console.error('Failed to fetch user statistics:', error);
                // Keep default values if fetch fails
            }
        };
        fetchProgress();
    }, [token]);

    const handleGameEnd = useCallback(async (won: boolean) => {
        if (!token) return;
        try {
            await logGame(word, wordType, won, wrongLetters.length, token, wrongLetters);
            // Update progress after game ends
            const stats = await getUserStatistics(token);
            setProgress({ wins: stats.wins, losses: stats.losses });
        } catch (error) {
            console.error("Fehler beim Loggen des Spiels oder beim Aktualisieren der Statistiken:", error);
        }
        // Only call onGameEnd automatically if NOT in placement test mode
        // In placement test mode, the user must click the "Weiter" button
        if (onGameEnd && !isPlacementTest) {
            onGameEnd(won);
        }
    }, [word, wordType, wrongLetters, token, onGameEnd, isPlacementTest]);


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
        if (gameStatus !== 'playing' || guessedLetters.includes(letter) || excludedLetters.includes(letter)) {
            return;
        }
        setGuessedLetters(prev => [...prev, letter]);
    }, [gameStatus, guessedLetters, excludedLetters]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if (/^[a-zäöüß]$/.test(key)) {
                handleGuess(key);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleGuess]);

    const displayWordLetters = word.split('').map((letter, idx) => {
        const revealed = guessedLetters.includes(letter);
        const displayChar = formatLetter(letter);
        return (
            <span key={idx} className={`letter${revealed ? ' revealed' : ''}`}>
                {revealed ? displayChar : '_'}
            </span>
        );
    });
    const handleGetHint = async () => {
        if (!token || !word) return;
        try {
            if (hintCredits <= 0) {
                setServerHint('Kein Tippguthaben verfügbar. Gewinne 3 Runden für 1 Tipp.');
                return;
            }
            const { revealed_letter, hint_credits } = await consumeHintCredit(word, guessedLetters, token);
            setHintCredits(hint_credits);
            if (!guessedLetters.includes(revealed_letter)) {
                setGuessedLetters(prev => [...prev, revealed_letter]);
            }
            setServerHint(`Buchstabe aufgedeckt: ${formatLetter(revealed_letter)}`);
        } catch (e) {
            setServerHint('Kein Tipp verfügbar.');
        }
    };

    if (loading) return <p>Lade Spiel...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="hangman-container">
            {gameStatus === 'won' && <div className="game-feedback success">Super, du hast es geschafft! 🎉</div>}
            {gameStatus === 'lost' && (
                <div className="game-feedback error">
                    Nicht ganz! Das richtige Wort war: <strong>{formatWord(word)}</strong>. Nächstes Mal klappt's!
                </div>
            )}
            
            <HangmanIllustration wrongCount={wrongLetters.length} />


            {!isPlacementTest && (
                <div className="game-controls">
                    <button onClick={fetchNewWord} className="next-word-btn">
                        Nächstes Wort
                    </button>
                    <div className="ki-toggle">
                        <label className={`toggle ${useModel ? 'active' : ''}`}>
                            <input
                                type="checkbox"
                                checked={useModel}
                                onChange={() => setUseModel(!useModel)}
                            />
                            <span className="toggle-track" aria-hidden="true">
                                <span className="toggle-thumb"></span>
                            </span>
                            <span className="toggle-text">KI-Trainingsmodus</span>
                        </label>
                    </div>
                </div>
            )}
            
            <div className="word-and-hint-row">
                <div className="hangman-word">{displayWordLetters}</div>
                <div className="hint-controls">
                    <button onClick={handleGetHint} disabled={!word || gameStatus !== 'playing' || hintCredits <= 0} className="hint-btn">Tipp holen {`(${hintCredits})`}</button>
                    {serverHint && <small className="server-hint">{serverHint}</small>}
                </div>
            </div>
            <div className="meta-row">
                <div className="meta-item"><span className="meta-label">Wortart:</span> <span className="meta-value">{wordType || '—'}</span></div>
                {category && <div className="meta-item"><span className="meta-label">Kategorie:</span> <span className="meta-value">{category}</span></div>}
                <div className="meta-item"><span className="meta-label">Fehlversuche:</span> <span className="meta-value">{wrongLetters.length} / {MAX_WRONG_GUESSES}</span></div>
            </div>
            
            {excludedLetters.length > 0 && (
                <div className="game-hints">
                    <small>
                        💡 Zum Start wurden {guessedLetters.filter(letter => word.includes(letter)).length} Buchstabe(n) aufgedeckt 
                        und {excludedLetters.length} nicht passende Buchstaben durchgestrichen.
                    </small>
                </div>
            )}

            

            <div className="keyboard">
                {'abcdefghijklmnopqrstuvwxyzäöüß'.split('').map((letter) => {
                    const isGuessed = guessedLetters.includes(letter);
                    const isExcluded = excludedLetters.includes(letter);
                    const isCorrect = isGuessed && word.includes(letter);
                    const isIncorrect = (isGuessed && !word.includes(letter)) || isExcluded;

                    let buttonClass = '';
                    if (isCorrect) buttonClass = 'guessed correct';
                    if (isIncorrect) buttonClass = 'guessed incorrect';
                    if (isExcluded) buttonClass += ' excluded';

                    return (
                        <button
                            key={letter}
                            data-letter={letter}
                            onClick={() => handleGuess(letter)}
                            disabled={isGuessed || isExcluded || gameStatus !== 'playing'}
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
            
            {isPlacementTest && (gameStatus === 'won' || gameStatus === 'lost') && (
                <button onClick={() => onGameEnd && onGameEnd(gameStatus === 'won')} className="next-word-btn">
                    Weiter
                </button>
            )}

            {/* Progress display with real data */}
            <div className="progress-indicator">
                {progress.wins + progress.losses > 0 ? (
                    <>
                        Fortschritt: {progress.wins} Siege / {progress.losses} Niederlagen
                        ({Math.round((progress.wins / (progress.wins + progress.losses)) * 100)}% Gewinnrate)
                    </>
                ) : (
                    "Noch keine Spiele gespielt. Starte dein erstes Spiel!"
                )}
            </div>
        </div>
    );
};

export default Hangman;



