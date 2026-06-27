import { db } from './config.js';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';
import { callGeminiForJSON } from './utils.js';

window.startQuiz = (quizData) => {
    state.currentQuiz = quizData;
    state.quizAnswers = {};
    window.navigate('quiz');
}

window.handleQuizFromPDF = async (noteId, cachedContent = null) => {
    const customPrompt = prompt("What should the quiz focus on? (Leave blank for a general quiz covering the whole document)", "");
    if(customPrompt === null) return;

    window.showToast("Generating custom quiz...", "info");
    try {
        let text = cachedContent;
        if (!text) {
            const docRef = doc(db, "groups", state.activeGroupId, "notes", noteId);
            const docSnap = await getDoc(docRef);
            text = docSnap.data()?.content;
        }
        
        if (!text) {
            window.showToast("Document text not available.", "error");
            return;
        }

        const focusDirective = customPrompt ? `Focus specifically on the topic: "${customPrompt}". Ensure the questions test understanding of this specific area.` : "Cover the general concepts equally across the document.";

        const aiPrompt = `Generate a quiz from the following text. ${focusDirective} Return ONLY a valid JSON object strictly following this format: { "title": "Custom Study Quiz", "questions": [ { "id": 1, "text": "Question text here?", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "type": "mcq" } ] }. Create 10 MCQs. Text: ${text.substring(0, 30000)}`;

        const jsonResponse = await callGeminiForJSON(aiPrompt);
        if (jsonResponse && jsonResponse.questions) {
            window.startQuiz(jsonResponse);
        } else {
            window.showToast("AI could not generate a valid quiz.", "error");
        }

    } catch (err) {
        window.showToast("Quiz generation failed: " + err.message, "error");
    }
};

window.handleGenerateSubjectQuiz = async (subject) => {
    if(!confirm(`Generate a new quiz for ${subject}?`)) return;
    window.showToast(`Generating ${subject} quiz...`, "info");
    
    const prompt = `Generate a moderate difficulty quiz for the subject "${subject}". Return ONLY a valid JSON object strictly following this structure: { "title": "${subject} Challenge", "questions": [{ "id": 1, "text": "Question?", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "type": "mcq" }] }. Include 10 MCQs and 3 Short Questions.`;

    const jsonResponse = await callGeminiForJSON(prompt);
    if (jsonResponse && jsonResponse.questions) {
        window.startQuiz(jsonResponse);
    } else {
        window.showToast("AI could not generate a valid quiz.", "error");
    }
};

window.selectQuizOption = (questionId, optionIdx) => {
    state.quizAnswers[questionId] = optionIdx;
    
    const options = document.querySelectorAll(`[id^='opt-${questionId}-']`);
    options.forEach(opt => opt.classList.remove('option-selected'));
    
    const selected = document.getElementById(`opt-${questionId}-${optionIdx}`);
    if(selected) selected.classList.add('option-selected');
};

window.submitQuiz = async () => {
    if(!confirm("Submit your answers?")) return;

    const questions = state.currentQuiz.questions;
    let score = 0;
    let totalMcqs = 0;

    questions.forEach(q => {
        if(q.type === 'mcq') {
            totalMcqs++;
            if (state.quizAnswers[q.id] === q.correctAnswer) {
                score++;
            }
        }
    });

    const finalScore = Math.round((score / totalMcqs) * 100);

    try {
        await addDoc(collection(db, "quiz_results"), {
            userId: state.user.uid,
            userName: state.userProfile.displayName,
            subject: state.currentQuiz.title,
            score: finalScore,
            date: serverTimestamp()
        });
        window.showToast(`Quiz Submitted! Score: ${finalScore}%`, 'success');
        window.navigate('leaderboard');
    } catch(err) {
        window.showToast("Error saving score", "error");
    }
};

window.loadLeaderboard = async () => {
    const container = document.getElementById('leaderboard-container');
    if(!container) return;

    try {
        const q = query(collection(db, "quiz_results"), orderBy("score", "desc"), limit(100));
        
        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="bg-white rounded-xl p-8 text-center border border-slate-200">
                        <i class="fas fa-trophy text-slate-300 text-4xl mb-3"></i>
                        <p class="text-slate-500">No quizzes taken yet. Be the first to top the leaderboard!</p>
                    </div>`;
                return;
            }

            const results = snapshot.docs.map(doc => doc.data());
            const grouped = {};

            results.forEach(r => {
                const subject = r.subject || "General";
                if (!grouped[subject]) grouped[subject] = [];
                grouped[subject].push(r);
            });

            const subjects = Object.keys(grouped).sort();
            let html = '';

            subjects.forEach(subject => {
                const scores = grouped[subject].sort((a, b) => b.score - a.score);
                
                html += `
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                    <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 class="font-bold text-slate-700 flex items-center gap-2">
                            <i class="fas fa-book text-blue-500"></i> ${subject}
                        </h3>
                        <span class="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                            ${scores.length} Entries
                        </span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-slate-600">
                            <thead class="bg-white text-slate-500 font-semibold border-b border-slate-100 text-xs uppercase tracking-wider">
                                <tr>
                                    <th class="px-6 py-3 w-20">Rank</th>
                                    <th class="px-6 py-3">Student</th>
                                    <th class="px-6 py-3 text-right">Score</th>
                                    <th class="px-6 py-3 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-50">
                                ${scores.map((r, i) => {
                                    const date = r.date ? new Date(r.date.toDate()).toLocaleDateString() : 'Recent';
                                    let rankBadge = `<span class="font-mono text-slate-500">#${i + 1}</span>`;
                                    let rowClass = "hover:bg-slate-50 transition-colors";
                                    
                                    if (i === 0) { 
                                        rankBadge = `<i class="fas fa-crown text-yellow-500"></i>`;
                                        rowClass += " bg-yellow-50/50";
                                    } else if (i === 1) {
                                        rankBadge = `<i class="fas fa-medal text-slate-400"></i>`;
                                    } else if (i === 2) {
                                        rankBadge = `<i class="fas fa-medal text-amber-600"></i>`;
                                    }

                                    return `
                                    <tr class="${rowClass}">
                                        <td class="px-6 py-3 font-bold text-center">${rankBadge}</td>
                                        <td class="px-6 py-3 font-medium text-slate-800">${r.userName || 'Anonymous'}</td>
                                        <td class="px-6 py-3 text-right font-bold text-blue-600">${r.score}%</td>
                                        <td class="px-6 py-3 text-right text-xs text-slate-400">${date}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                `;
            });

            container.innerHTML = html;
        });
    } catch (err) {
        container.innerHTML = `<div class="text-center py-8 text-red-400">Error loading leaderboard: ${err.message}</div>`;
    }
}