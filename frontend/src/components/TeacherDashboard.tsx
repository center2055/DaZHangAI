import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchStudentsData, deleteStudent } from '../authApi';
import './TeacherDashboard.css';
import { User } from '../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface StudentData {
    username: string;
    age: number;
    motherTongue: string;
    progress: {
        failed_words: number;
        problem_letters: string[];
        failed_word_types: Record<string, number>;
        difficulty_modifier: number;
    };
}

interface TeacherDashboardProps {
    user: User;
    token: string;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, token }) => {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStudentUsername, setSelectedStudentUsername] = useState<string | null>(null);

    const selectedStudent = useMemo(() => {
        if (!selectedStudentUsername) {
            return null;
        }
        return students.find((student) => student.username === selectedStudentUsername) ?? null;
    }, [students, selectedStudentUsername]);

    const chartData = useMemo(() => {
        const dataSource = selectedStudentUsername
            ? students.filter((student) => student.username === selectedStudentUsername)
            : students;

        if (!dataSource.length) {
            return { barData: null, pieData: null };
        }

        const barData = {
            labels: dataSource.map((student) => student.username),
            datasets: [
                {
                    label: 'Anzahl falscher Wörter',
                    data: dataSource.map((student) => student.progress.failed_words),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                },
            ],
        };

        const allProblemTypes: Record<string, number> = {};
        dataSource.forEach((student) => {
            Object.entries(student.progress.failed_word_types).forEach(([type, count]) => {
                allProblemTypes[type] = (allProblemTypes[type] || 0) + count;
            });
        });

        const pieData = {
            labels: Object.keys(allProblemTypes),
            datasets: [
                {
                    label: 'Häufigkeit',
                    data: Object.values(allProblemTypes),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)',
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                    ],
                    borderWidth: 1,
                },
            ],
        };

        return { barData, pieData };
    }, [students, selectedStudentUsername]);

    const loadData = useCallback(async () => {
        if (!token) {
            setError('Authentifizierungstoken nicht gefunden.');
            setLoading(false);
            return;
        }
        try {
            const data = await fetchStudentsData(token);
            setStudents(data);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Daten konnten nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (selectedStudentUsername && !students.some((student) => student.username === selectedStudentUsername)) {
            setSelectedStudentUsername(null);
        }
    }, [students, selectedStudentUsername]);

    useEffect(() => {
        setSelectedStudentUsername(null);
    }, [user?.username]);

    const handleSelectStudent = (username: string) => {
        setSelectedStudentUsername(username);
        setError('');
    };

    const handleBackToSelection = () => {
        setSelectedStudentUsername(null);
    };

    const handleDifficultyChange = useCallback(async (username: string, newModifier: number) => {
        if (!token) {
            setError('Authentifizierungstoken nicht gefunden.');
            return;
        }
        try {
            setStudents((prev) => prev.map((student) =>
                student.username === username
                    ? { ...student, progress: { ...student.progress, difficulty_modifier: newModifier } }
                    : student
            ));

            const response = await fetch(`/api/v2/student/${username}/difficulty`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ difficulty_modifier: newModifier }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Aktualisieren der Schwierigkeit.');
            }

            console.log(`Schwierigkeit für ${username} erfolgreich aktualisiert.`);
        } catch (err: any) {
            setError(err.message || 'Fehler beim Aktualisieren der Schwierigkeit.');
            loadData();
        }
    }, [token, loadData]);

    const handleDeleteStudent = async (username: string) => {
        if (window.confirm(`Möchten Sie den Schüler "${username}" wirklich endgültig löschen?`)) {
            if (!token) {
                setError('Authentifizierungstoken nicht gefunden.');
                return;
            }
            const result = await deleteStudent(username, token);
            if (result.success) {
                setStudents((prevStudents) => prevStudents.filter((student) => student.username !== username));
                if (selectedStudentUsername === username) {
                    setSelectedStudentUsername(null);
                }
            } else {
                setError(result.message || 'Ein Fehler ist aufgetreten.');
            }
        }
    };

    if (loading) {
        return <p>Lade Schülerdaten...</p>;
    }

    if (error) {
        return <p className="error-message">{error}</p>;
    }

    return (
        <div className="dashboard-container">
            {!selectedStudent ? (
                <>
                    <h2>Schüler auswählen</h2>
                    {students.length ? (
                        <>
                            <p className="selector-intro">Bitte wählen Sie den Schüler, den Sie sich ansehen möchten, um die größten Lernfortschritte zu vergleichen.</p>
                            <div className="student-selector-grid">
                                {students.map((student) => (
                                    <div
                                        key={student.username}
                                        className="student-card"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSelectStudent(student.username)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handleSelectStudent(student.username);
                                            }
                                        }}
                                    >
                                        <h3>{student.username}</h3>
                                        <p><strong>Alter:</strong> {student.age ?? 'k.A.'}</p>
                                        <p><strong>Muttersprache:</strong> {student.motherTongue ?? 'k.A.'}</p>
                                        <p><strong>Letzte Schwierigkeit:</strong> {student.progress.difficulty_modifier.toFixed(1)}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="selector-intro">Es sind derzeit keine Schüler verknüpft.</p>
                    )}
                </>
            ) : (
                <>
                    <h2>Lehrer-Dashboard</h2>
                    <div className="dashboard-header-row">
                        <button className="back-button" onClick={handleBackToSelection}>
                            Zur Schülerauswahl
                        </button>
                        <div className="selected-student-pill">
                            <span>Ausgewählter Schüler:</span>
                            <span className="pill-name">{selectedStudent.username}</span>
                        </div>
                    </div>

                    <div className="charts-container">
                        {chartData.barData && (
                            <div className="chart-wrapper">
                                <h3>Fehlversuche</h3>
                                <Bar data={chartData.barData} />
                            </div>
                        )}
                        {chartData.pieData && chartData.pieData.labels.length > 0 && (
                            <div className="chart-wrapper">
                                <h3>Größte Problem-Wortarten</h3>
                                <Pie data={chartData.pieData} />
                            </div>
                        )}
                    </div>

                    {selectedStudent && (
                        <table className="students-table">
                            <thead>
                                <tr>
                                    <th>Schüler</th>
                                    <th>Alter</th>
                                    <th>Muttersprache</th>
                                    <th>Anzahl Fehler</th>
                                    <th>Problembuchstaben</th>
                                    <th>Problem-Wortarten</th>
                                    <th>Schwierigkeit (Maß leichter/schwerer)</th>
                                    <th>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr key={selectedStudent.username}>
                                    <td>{selectedStudent.username}</td>
                                    <td>{selectedStudent.age ?? 'k.A.'}</td>
                                    <td>{selectedStudent.motherTongue ?? 'k.A.'}</td>
                                    <td>{selectedStudent.progress.failed_words ?? 0}</td>
                                    <td>{selectedStudent.progress.problem_letters?.join(', ') || 'Keine'}</td>
                                    <td>
                                        {Object.entries(selectedStudent.progress.failed_word_types || {})
                                            .map(([type, count]) => `${type}: ${count}`)
                                            .join(', ') || 'Keine'}
                                    </td>
                                    <td>
                                        <div className="difficulty-slider">
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={selectedStudent.progress.difficulty_modifier}
                                                onChange={(event) => handleDifficultyChange(selectedStudent.username, parseFloat(event.target.value))}
                                            />
                                            <span>{selectedStudent.progress.difficulty_modifier.toFixed(1)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleDeleteStudent(selectedStudent.username)}
                                            className="delete-button"
                                        >
                                            Löschen
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default TeacherDashboard;
