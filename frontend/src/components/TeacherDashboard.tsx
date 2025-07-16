import React, { useState, useEffect, useMemo } from 'react';
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

    // Memoized chart data to prevent re-calculation on every render
    const chartData = useMemo(() => {
        if (!students.length) {
            return { barData: null, pieData: null };
        }

        // Bar Chart: Failed words per student
        const barData = {
            labels: students.map(s => s.username),
            datasets: [
                {
                    label: 'Anzahl falscher Wörter',
                    data: students.map(s => s.progress.failed_words),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                },
            ],
        };

        // Pie Chart: Common problem word types across all students
        const allProblemTypes: Record<string, number> = {};
        students.forEach(student => {
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
    }, [students]);

    useEffect(() => {
        const loadData = async () => {
            if (!token) {
                setError("Authentifizierungstoken nicht gefunden.");
                setLoading(false);
                return;
            }
            try {
                const data = await fetchStudentsData(token);
                setStudents(data);
            } catch (err: any) {
                setError(err.message || 'Daten konnten nicht geladen werden.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [token]);

    const handleDeleteStudent = async (username: string) => {
        if (window.confirm(`Möchten Sie den Schüler "${username}" wirklich endgültig löschen?`)) {
            if (!token) {
                setError("Authentifizierungstoken nicht gefunden.");
                return;
            }
            const result = await deleteStudent(username, token);
            if (result.success) {
                setStudents(prevStudents => prevStudents.filter(s => s.username !== username));
            } else {
                setError(result.message || 'Ein Fehler ist aufgetreten.');
                // Optional: error message could be cleared after a few seconds
            }
        }
    };

    if (loading) return <p>Lade Schülerdaten...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="dashboard-container">
            <h2>Lehrer-Dashboard</h2>

            <div className="charts-container">
                {chartData.barData && (
                    <div className="chart-wrapper">
                        <h3>Fehlversuche pro Schüler</h3>
                        <Bar data={chartData.barData} />
                    </div>
                )}
                {chartData.pieData && Object.keys(chartData.pieData.labels).length > 0 && (
                     <div className="chart-wrapper">
                        <h3>Häufigste Problem-Wortarten</h3>
                        <Pie data={chartData.pieData} />
                    </div>
                )}
            </div>

            <table className="students-table">
                <thead>
                    <tr>
                        <th>Schüler</th>
                        <th>Alter</th>
                        <th>Muttersprache</th>
                        <th>Anzahl Fehler</th>
                        <th>Problembuchstaben</th>
                        <th>Problem-Wortarten</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(student => (
                        <tr key={student.username}>
                            <td>{student.username}</td>
                            <td>{student.age || 'k.A.'}</td>
                            <td>{student.motherTongue || 'k.A.'}</td>
                            <td>{student.progress.failed_words || 0}</td>
                            <td>{student.progress.problem_letters?.join(', ') || 'Keine'}</td>
                            <td>
                                {Object.entries(student.progress.failed_word_types || {})
                                    .map(([type, count]) => `${type}: ${count}`)
                                    .join(', ') || 'Keine'}
                            </td>
                            <td>
                                <button
                                    onClick={() => handleDeleteStudent(student.username)}
                                    className="delete-button"
                                >
                                    Löschen
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TeacherDashboard; 