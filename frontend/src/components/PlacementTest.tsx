import React, { useState, useEffect, useCallback } from 'react';
import { getPlacementTestQuestions, submitPlacementTestResultsWithAuth } from '../gameApi';
import Hangman from './Hangman';
import { User, Word } from '../types';
import './PlacementTest.css';

interface PlacementTestProps {
    user: User;
    onTestComplete: (level: string) => void;
    token: string;
}

const PlacementTest: React.FC<PlacementTestProps> = ({ user, onTestComplete, token }) => {
    const [questions, setQuestions] = useState<Word[]>([]);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
        const savedIndex = localStorage.getItem(`placementTestIndex_${user.username}`);
        return savedIndex ? parseInt(savedIndex, 10) : 0;
    });
    const [correctAnswers, setCorrectAnswers] = useState(() => {
        const savedAnswers = localStorage.getItem(`placementTestCorrect_${user.username}`);
        return savedAnswers ? parseInt(savedAnswers, 10) : 0;
    });
    const [answeredSet, setAnsweredSet] = useState<Set<string>>(() => {
        const raw = localStorage.getItem(`placementTestAnswered_${user.username}`);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    });

    useEffect(() => {
        localStorage.setItem(`placementTestIndex_${user.username}`, currentQuestionIndex.toString());
        localStorage.setItem(`placementTestCorrect_${user.username}`, correctAnswers.toString());
        localStorage.setItem(`placementTestAnswered_${user.username}`, JSON.stringify(Array.from(answeredSet)));
    }, [currentQuestionIndex, correctAnswers, answeredSet, user.username]);

    useEffect(() => {
        const savedIndex = localStorage.getItem(`placementTestIndex_${user.username}`);
        const savedAnswers = localStorage.getItem(`placementTestCorrect_${user.username}`);
        const savedAnswered = localStorage.getItem(`placementTestAnswered_${user.username}`);

        setCurrentQuestionIndex(savedIndex ? parseInt(savedIndex, 10) : 0);
        setCorrectAnswers(savedAnswers ? parseInt(savedAnswers, 10) : 0);
        setAnsweredSet(new Set(savedAnswered ? JSON.parse(savedAnswered) : []));
        setError(null);
        setIsSubmitting(false);

        localStorage.removeItem('placementTestIndex');
        localStorage.removeItem('placementTestCorrect');
    }, [user.username]);

    const submitResults = useCallback(async (totalOverride?: number, correctOverride?: number) => {
        const total = totalOverride ?? totalQuestions ?? questions.length;
        const correct = correctOverride ?? correctAnswers;
        if (total <= 0) {
            onTestComplete('a1');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await submitPlacementTestResultsWithAuth(
                user.username,
                correct,
                total,
                token
            );
            localStorage.removeItem(`placementTestIndex_${user.username}`);
            localStorage.removeItem(`placementTestCorrect_${user.username}`);
            localStorage.removeItem(`placementTestAnswered_${user.username}`);
            onTestComplete(result.level);
        } catch (err) {
            setError('Fehler beim Übermitteln der Ergebnisse.');
            console.error(err);
        }
    }, [user.username, token, onTestComplete, correctAnswers, totalQuestions, questions.length]);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                setLoading(true);
                const fetchedQuestions = await getPlacementTestQuestions();
                const mappedQuestions = fetchedQuestions.map(q => ({
                    word: q.word,
                    wordType: q.type,
                    category: q.category,
                    pre_revealed_letters: q.pre_revealed_letters,
                    excluded_letters: q.excluded_letters
                }));
                setTotalQuestions(mappedQuestions.length);
                const filtered = mappedQuestions.filter(q => !answeredSet.has(q.word));
                if (filtered.length === 0) {
                    setQuestions(filtered);
                    if (mappedQuestions.length > 0) {
                        await submitResults(mappedQuestions.length, correctAnswers);
                    }
                    return;
                }
                setQuestions(filtered);
                setCurrentQuestionIndex(0);
            } catch (err) {
                setError('Fehler beim Laden des Einstufungstests.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuestions();
    }, [answeredSet, correctAnswers, submitResults]);

    const handleNextQuestion = useCallback((gameWon: boolean) => {
        const current = questions[currentQuestionIndex];
        if (!current) {
            return;
        }
        if (gameWon) {
            setCorrectAnswers(prev => prev + 1);
        }
        setAnsweredSet(prev => {
            const next = new Set(prev);
            next.add(current.word);
            return next;
        });
        setCurrentQuestionIndex(prev => Math.min(prev + 1, questions.length));
    }, [questions, currentQuestionIndex]);

    if (loading) return <p>Einstufungstest wird geladen...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (isSubmitting) return <p>Ergebnisse werden übermittelt und dein Level wird berechnet...</p>;
    if (questions.length === 0) {
        return totalQuestions > 0
            ? <p>Alle Fragen beantwortet. Ergebnisse werden ausgewertet...</p>
            : <p>Keine Fragen für den Test gefunden.</p>;
    }

    if (currentQuestionIndex >= questions.length) {
        return <p>Nächste Frage wird geladen...</p>;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const answeredCount = Math.min(totalQuestions, answeredSet.size);
    const questionNumber = Math.min(totalQuestions || questions.length, answeredCount + 1);
    const progressPercentage = totalQuestions > 0
        ? (answeredCount / totalQuestions) * 100
        : (currentQuestionIndex / Math.max(questions.length, 1)) * 100;

    return (
        <div className="placement-test-container">
            <h2>Einstufungstest</h2>
            <p>Finde das richtige Wort, um dein Sprachniveau zu ermitteln.</p>

            <div className="progress-container">
                <p>Frage {questionNumber} von {totalQuestions || questions.length}</p>
                <div className="progress-bar-background">
                    <div className="progress-bar-foreground" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </div>

            <Hangman
                key={currentQuestion.word}
                user={user}
                token={token}
                initialWord={currentQuestion}
                onGameEnd={handleNextQuestion}
                isPlacementTest={true}
            />
        </div>
    );
};

export default PlacementTest;
