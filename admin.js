import { db, apiKey } from './config.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state, clearAdminCharts } from './state.js';

window.loadStudentDashboardStats = async () => {
    const container = document.getElementById('performance-dashboard-container');
    if(!container || !state.user) return;

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 mb-6">
             <div class="flex-1 flex flex-col justify-center items-center text-center">
                <div class="loader mb-2 border-t-blue-500"></div>
                <span class="text-slate-400 text-sm">Analyzing your performance...</span>
             </div>
        </div>
    `;

    try {
        const q = query(collection(db, "quiz_results"), where("userId", "==", state.user.uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-sm border border-blue-100 p-6 flex items-center justify-between mb-6">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg mb-1">Academic Performance</h3>
                        <p class="text-slate-600 text-sm">Take some quizzes to generate your AI analytics!</p>
                    </div>
                    <i class="fas fa-chart-line text-blue-300 text-5xl"></i>
                </div>
            `;
            return;
        }

        let totalScore = 0;
        let count = 0;
        let subjectScores = {};

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const sub = data.subject || "General";
            totalScore += data.score;
            count++;
            
            if(!subjectScores[sub]) subjectScores[sub] = { total: 0, count: 0 };
            subjectScores[sub].total += data.score;
            subjectScores[sub].count++;
        });

        const accuracy = Math.round(totalScore / count);
        
        const subjectAverages = Object.keys(subjectScores).map(sub => ({
            subject: sub,
            avg: Math.round(subjectScores[sub].total / subjectScores[sub].count)
        })).sort((a,b) => b.avg - a.avg);

        const strongest = subjectAverages[0];
        const weakest = subjectAverages[subjectAverages.length - 1];

        const prompt = `A student has an overall quiz accuracy of ${accuracy}%. Their strongest subject is ${strongest.subject} (${strongest.avg}%) and their weakest is ${weakest.subject} (${weakest.avg}%). Write a very brief, single-sentence encouraging recommendation addressing their weak spot. Keep it under 20 words. Format the subject name in **bold**.`;
        
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 flex flex-col md:flex-row">
                <div class="flex-1 p-6 grid grid-cols-3 divide-x divide-slate-100">
                    <div class="text-center px-2">
                        <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Overall Accuracy</div>
                        <div class="text-3xl font-bold ${accuracy > 70 ? 'text-emerald-500' : 'text-amber-500'}">${accuracy}%</div>
                        <div class="text-slate-400 text-[10px] mt-1">${count} quizzes taken</div>
                    </div>
                    <div class="text-center px-2">
                        <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-center gap-1"><i class="fas fa-arrow-up text-emerald-400"></i> Strongest</div>
                        <div class="text-sm font-bold text-slate-800 line-clamp-1" title="${strongest.subject}">${strongest.subject}</div>
                        <div class="text-emerald-500 font-bold text-lg">${strongest.avg}%</div>
                    </div>
                    <div class="text-center px-2">
                        <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-center gap-1"><i class="fas fa-arrow-down text-red-400"></i> Weakest</div>
                        <div class="text-sm font-bold text-slate-800 line-clamp-1" title="${weakest.subject}">${weakest.subject}</div>
                        <div class="text-red-500 font-bold text-lg">${weakest.avg}%</div>
                    </div>
                </div>
                
                <div class="md:w-1/3 bg-indigo-50 border-l border-indigo-100 p-6 flex flex-col justify-center relative">
                    <i class="fas fa-robot absolute top-4 right-4 text-indigo-200 text-3xl opacity-50"></i>
                    <h4 class="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">AI Recommendation</h4>
                    <p id="ai-dash-recommendation" class="text-sm text-indigo-900 leading-snug">
                        <i class="fas fa-circle-notch fa-spin text-indigo-400 mr-2"></i> Generating insight...
                    </p>
                </div>
            </div>
        `;

        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }]
        };
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            }, 
            body: JSON.stringify(payload) 
        });
        const rawText = await aiResponse.text();
        
        let aiData;
        try {
            aiData = JSON.parse(rawText);
        } catch(e) {
            throw new Error("Invalid response from server.");
        }

        if (!aiResponse.ok) throw new Error(aiData.error?.message || "API Error");
        
        const recText = aiData.choices?.[0]?.message?.content || "Keep practicing your weak areas!";
        const formattedRecText = recText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        const recEl = document.getElementById('ai-dash-recommendation');
        if(recEl) recEl.innerHTML = formattedRecText;

    } catch(e) {
        console.warn("Could not load stats", e);
        container.innerHTML = "";
    }
};

window.setPerformanceView = (viewType) => {
    state.currentPerfView = viewType;
    ['table', 'charts', 'insights'].forEach(t => {
        const btn = document.getElementById(`btn-perf-${t}`);
        if(btn) {
            if(t === viewType) {
                btn.className = "px-4 py-2 text-sm font-medium rounded-md transition-all bg-blue-50 text-blue-600 shadow-sm";
            } else {
                btn.className = "px-4 py-2 text-sm font-medium rounded-md transition-all text-slate-600 hover:bg-slate-50";
            }
        }
    });
    window.renderPerformanceContent();
};

window.getCircleSvg = (percent, colorClass, label) => {
    const r = 16;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    const strokeColor = percent > 70 ? '#10b981' : (percent > 40 ? '#f59e0b' : '#ef4444');
    return `
    <div class="flex items-center gap-3 group" title="${label}: ${percent}% Avg">
        <div class="relative w-10 h-10 flex items-center justify-center transform transition-transform group-hover:scale-110">
            <svg class="transform -rotate-90 w-10 h-10">
                <circle cx="20" cy="20" r="16" stroke="currentColor" stroke-width="4" fill="transparent" class="text-slate-100" />
                <circle cx="20" cy="20" r="16" stroke="${strokeColor}" stroke-width="4" fill="transparent" stroke-dasharray="${c}" stroke-dashoffset="${offset}" class="transition-all duration-1000 ease-out" stroke-linecap="round"/>
            </svg>
            <span class="absolute text-[10px] font-bold text-slate-700">${percent}%</span>
        </div>
        <div class="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors cursor-default">${label}</div>
    </div>`;
};

window.loadAdminPerformanceData = async () => {
    try {
        const q = query(collection(db, "quiz_results"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        
        const userStats = {};
        const globalSubjectStats = {};

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const uid = data.userId;
            const sub = data.subject || "General";

            if (!userStats[uid]) {
                userStats[uid] = { name: data.userName || 'Anonymous', totalScore: 0, count: 0, subjects: {} };
            }
            userStats[uid].totalScore += data.score;
            userStats[uid].count++;
            
            if (!userStats[uid].subjects[sub]) {
                userStats[uid].subjects[sub] = { total: 0, count: 0 };
            }
            userStats[uid].subjects[sub].total += data.score;
            userStats[uid].subjects[sub].count++;

            if (!globalSubjectStats[sub]) {
                globalSubjectStats[sub] = { total: 0, count: 0 };
            }
            globalSubjectStats[sub].total += data.score;
            globalSubjectStats[sub].count++;
        });

        state.performanceData = { userStats, globalSubjectStats, rawCount: querySnapshot.size };
        window.renderPerformanceContent();

    } catch(e) {
        console.warn("Could not load admin stats", e);
        const container = document.getElementById('admin-performance-content');
        if(container) container.innerHTML = `<div class="bg-red-50 p-6 rounded-xl text-center text-red-600">Failed to load performance data.</div>`;
    }
};

window.renderPerformanceContent = () => {
    const container = document.getElementById('admin-performance-content');
    if(!container || !state.performanceData) return;
    
    clearAdminCharts(); 
    
    const { userStats, globalSubjectStats, rawCount } = state.performanceData;

    if (Object.keys(userStats).length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <i class="fas fa-chart-bar text-slate-300 text-5xl mb-4"></i>
                <h3 class="text-lg font-bold text-slate-700">No Data Available</h3>
                <p class="text-slate-500">Students haven't taken any quizzes yet.</p>
            </div>
        `;
        return;
    }

    if (state.currentPerfView === 'table') {
        const rowsHtml = Object.keys(userStats).map(uid => {
            const stat = userStats[uid];
            const accuracy = Math.round(stat.totalScore / stat.count);
            const subAvgs = Object.keys(stat.subjects).map(sub => ({
                subject: sub,
                avg: Math.round(stat.subjects[sub].total / stat.subjects[sub].count)
            })).sort((a, b) => b.avg - a.avg);

            const strongest = subAvgs[0];
            const weakest = subAvgs[subAvgs.length - 1];
            const accuracyColor = accuracy > 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : (accuracy > 40 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200');

            return `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                ${stat.name[0].toUpperCase()}
                            </div>
                            <div>
                                <div class="font-semibold text-slate-800">${stat.name}</div>
                                <div class="text-xs text-slate-400">${stat.count} quizzes taken</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 rounded-full text-xs font-bold border ${accuracyColor} inline-flex items-center gap-1 shadow-sm">
                            <i class="fas fa-bullseye opacity-70"></i> ${accuracy}% Accuracy
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        ${window.getCircleSvg(strongest.avg, 'emerald', strongest.subject)}
                    </td>
                    <td class="px-6 py-4">
                        ${window.getCircleSvg(weakest.avg, 'red', weakest.subject)}
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="px-6 py-4">Student</th>
                                <th class="px-6 py-4">Performance</th>
                                <th class="px-6 py-4">Strongest Area</th>
                                <th class="px-6 py-4">Needs Improvement</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
        `;

    } else if (state.currentPerfView === 'charts') {
        const subjectList = Object.keys(globalSubjectStats).map(sub => ({
            name: sub,
            avg: Math.round(globalSubjectStats[sub].total / globalSubjectStats[sub].count),
            count: globalSubjectStats[sub].count
        })).sort((a,b) => b.avg - a.avg);

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col items-center">
                    <div class="w-full flex justify-between items-center mb-4">
                        <h3 class="font-bold text-slate-700 text-lg">Subject Average Scores</h3>
                        <i class="fas fa-chart-bar text-slate-300"></i>
                    </div>
                    <div class="w-full flex-1 relative min-h-[300px]">
                        <canvas id="subjectBarChart"></canvas>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col items-center">
                    <div class="w-full flex justify-between items-center mb-4">
                        <h3 class="font-bold text-slate-700 text-lg">Quiz Distribution</h3>
                        <i class="fas fa-chart-pie text-slate-300"></i>
                    </div>
                    <div class="w-full max-w-[300px] flex-1 relative min-h-[300px]">
                        <canvas id="subjectPieChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctxBar = document.getElementById('subjectBarChart');
            const ctxPie = document.getElementById('subjectPieChart');
            
            if (ctxBar) {
                window.adminCharts.push(new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: subjectList.map(s => s.name),
                        datasets: [{
                            label: 'Average Score (%)',
                            data: subjectList.map(s => s.avg),
                            backgroundColor: 'rgba(59, 130, 246, 0.7)',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 1,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, max: 100 } }
                    }
                }));
            }
            if (ctxPie) {
                window.adminCharts.push(new Chart(ctxPie, {
                    type: 'doughnut',
                    data: {
                        labels: subjectList.map(s => s.name),
                        datasets: [{
                            data: subjectList.map(s => s.count),
                            backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                            borderWidth: 2
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                }));
            }
        }, 50);

    } else if (state.currentPerfView === 'insights') {
        const sortedUsers = Object.keys(userStats).map(uid => ({
            name: userStats[uid].name,
            accuracy: Math.round(userStats[uid].totalScore / userStats[uid].count),
            count: userStats[uid].count
        })).sort((a,b) => b.accuracy - a.accuracy);

        const topPerformers = sortedUsers.slice(0, 3);
        const struggling = sortedUsers.filter(u => u.accuracy < 50);

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
                    <h3 class="font-bold text-slate-700 text-lg mb-2">Accuracy vs. Activity Mapping</h3>
                    <p class="text-xs text-slate-500 mb-4">* Hover over points to view individual student analytics. Top-Right indicates high accuracy & high activity.</p>
                    <div class="w-full flex-1 relative min-h-[300px]">
                        <canvas id="studentScatterChart"></canvas>
                    </div>
                </div>

                <div class="flex flex-col gap-6">
                    <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg flex-1">
                        <h3 class="text-lg font-bold mb-4 flex items-center"><i class="fas fa-trophy text-yellow-300 mr-2"></i> Top Performers</h3>
                        <div class="space-y-4">
                            ${topPerformers.map((u, i) => `
                                <div class="flex items-center justify-between bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/10 transition-transform hover:scale-105">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">#${i+1}</div>
                                        <span class="font-medium">${u.name}</span>
                                    </div>
                                    <span class="font-bold text-emerald-300">${u.accuracy}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex-1">
                        <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center"><i class="fas fa-exclamation-circle text-red-500 mr-2"></i> Needs Attention</h3>
                        ${struggling.length > 0 ? `
                            <div class="space-y-3">
                                ${struggling.map(u => `
                                    <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 transition-colors hover:bg-red-100 cursor-default" title="Only ${u.accuracy}% average across ${u.count} quizzes.">
                                        <span class="text-slate-700 font-medium">${u.name}</span>
                                        <span class="text-red-600 font-bold text-sm">${u.accuracy}% Avg</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="h-32 flex items-center justify-center text-slate-400 text-sm italic">
                                No students currently flagged as struggling.
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const ctxScatter = document.getElementById('studentScatterChart');
            if (ctxScatter) {
                const scatterData = sortedUsers.map(u => ({
                    x: u.count,
                    y: u.accuracy,
                    name: u.name
                }));
                window.adminCharts.push(new Chart(ctxScatter, {
                    type: 'scatter',
                    data: {
                        datasets: [{
                            label: 'Students',
                            data: scatterData,
                            backgroundColor: 'rgba(99, 102, 241, 0.7)',
                            borderColor: 'rgb(79, 70, 229)',
                            borderWidth: 1,
                            pointRadius: 6,
                            pointHoverRadius: 9
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const pt = ctx.raw;
                                        return `${pt.name}: ${pt.y}% accuracy (${pt.x} quizzes)`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: { title: { display: true, text: 'Number of Quizzes Taken' }, beginAtZero: true },
                            y: { title: { display: true, text: 'Average Accuracy (%)' }, min: 0, max: 100 }
                        }
                    }
                }));
            }
        }, 50);
    }
};