import { db } from './config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';
import { callGemini } from './utils.js';

window.handleSendMessage = async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if(!text) return;
    
    input.value = '';
    const isDoubt = document.getElementById('is-doubt-checkbox')?.checked;

    let payload = {
        text,
        senderId: state.user.uid,
        senderName: state.userProfile.displayName || 'Anonymous',
        createdAt: serverTimestamp()
    };

    // Structure message based on Doubt System
    if (state.replyingToDoubt) {
        payload.type = 'answer';
        payload.replyTo = state.replyingToDoubt;
        payload.upvotes = [];
    } else if (isDoubt) {
        payload.type = 'doubt';
        payload.isSolved = false;
    } else {
        payload.type = 'chat';
    }

    try {
        await addDoc(collection(db, "groups", state.activeGroupId, "messages"), payload);
        if (state.replyingToDoubt) {
            state.replyingToDoubt = null;
            window.render(); // clear banner
        } else if (isDoubt) {
            document.getElementById('is-doubt-checkbox').checked = false;
        }
    } catch (err) {
        console.error("Msg error", err);
        window.showToast("Failed to send", "error");
    }
};

window.toggleStudySession = async (groupId, forceStop = false) => {
    const docRef = doc(db, "groups", groupId);

    if (state.studyTimer.isStudying || forceStop) {
        // STOP SESSION
        clearInterval(state.studyTimer.intervalId);
        state.studyTimer.isStudying = false;
        
        try {
            await updateDoc(docRef, { studyingUsers: arrayRemove(state.user.uid) });
        } catch(e){} // Ignore if unmounted

        const td = document.getElementById('timer-display');
        const btn = document.getElementById('study-btn-text');
        if(td) {
            td.innerText = "25:00";
            td.classList.remove('text-red-500', 'border-red-200', 'timer-active');
            td.classList.add('text-slate-600', 'border-slate-200');
            td.parentElement.classList.remove('border-red-200');
            td.parentElement.classList.add('border-slate-200');
        }
        if(btn) {
            btn.innerHTML = '<i class="fas fa-play-circle text-green-500 mr-1"></i> Study Mode';
            btn.classList.remove('text-red-600');
            btn.classList.add('text-slate-700');
        }

    } else {
        // START SESSION
        state.studyTimer.isStudying = true;
        state.studyTimer.timeLeft = 25 * 60; // 25 mins
        
        try {
            await updateDoc(docRef, { studyingUsers: arrayUnion(state.user.uid) });
            window.showToast("Focus mode activated. 25 minutes on the clock!", "success");
        } catch(e) {
            window.showToast("Could not sync live status.", "error");
        }

        const td = document.getElementById('timer-display');
        const btn = document.getElementById('study-btn-text');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-stop-circle mr-1"></i> Stop';
            btn.classList.add('text-red-600');
            btn.classList.remove('text-slate-700');
        }
        if(td) {
            td.classList.add('text-red-500', 'border-red-200', 'timer-active');
            td.classList.remove('text-slate-600', 'border-slate-200');
            td.parentElement.classList.add('border-red-200');
            td.parentElement.classList.remove('border-slate-200');
        }

        state.studyTimer.intervalId = setInterval(() => {
            state.studyTimer.timeLeft--;
            const el = document.getElementById('timer-display');
            if(el) {
                const m = Math.floor(state.studyTimer.timeLeft/60).toString().padStart(2,'0');
                const s = (state.studyTimer.timeLeft%60).toString().padStart(2,'0');
                el.innerText = `${m}:${s}`;
            }

            if(state.studyTimer.timeLeft <= 0) {
                window.toggleStudySession(groupId, true); // auto stop
                window.showToast("Study session complete! Take a 5 min break.", "success");
            }
        }, 1000);
    }
};

window.setChatFilter = (filter) => {
    state.chatFilter = filter;
    window.render(); 
};

window.handleReplyDoubt = (doubtId) => {
    state.replyingToDoubt = doubtId;
    window.render();
    setTimeout(() => document.getElementById('message-input')?.focus(), 50);
};

window.cancelReply = () => {
    state.replyingToDoubt = null;
    window.render();
};

window.handleUpvote = async (answerId) => {
    try {
        const answerRef = doc(db, "groups", state.activeGroupId, "messages", answerId);
        const ansObj = state.messages.find(m => m.id === answerId);
        if (!ansObj) return;

        if (ansObj.upvotes?.includes(state.user.uid)) {
            await updateDoc(answerRef, { upvotes: arrayRemove(state.user.uid) });
        } else {
            await updateDoc(answerRef, { upvotes: arrayUnion(state.user.uid) });
        }
    } catch(e) {
        console.error("Upvote failed", e);
    }
};

window.handleMarkSolved = async (doubtId, answerId, answerSenderId) => {
    if (!confirm("Mark this as the Best Answer? This will close the doubt and reward the user.")) return;
    try {
        await updateDoc(doc(db, "groups", state.activeGroupId, "messages", doubtId), {
            isSolved: true,
            bestAnswerId: answerId
        });
        
        if (answerSenderId !== state.user.uid) { 
            await updateDoc(doc(db, "users", answerSenderId), {
                xp: increment(50),
                badges: arrayUnion("Doubt Solver")
            });
        }
        window.showToast("Doubt marked as Solved! Reward sent.", "success");
    } catch(e) {
        window.showToast("Failed to mark as solved.", "error");
    }
};

window.handleDeleteMessage = async (msgId) => {
     if(!confirm("Are you sure you want to delete this message?")) return;
     try {
         await deleteDoc(doc(db, "groups", state.activeGroupId, "messages", msgId));
         window.showToast("Message deleted", "success");
     } catch(err) {
         console.error(err);
         window.showToast("Could not delete message", "error");
     }
};

window.renderChat = () => {
    const container = document.getElementById('chat-container');
    if(!container) return;

    const group = state.groups.find(g => g.id === state.activeGroupId);
    const isGroupAdmin = group && (group.createdBy === state.user.uid || state.userProfile?.role === 'admin');

    if (state.messages.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">No messages yet. Say hello or ask a doubt! 👋</div>`;
        return;
    }

    let topLevel = state.messages.filter(m => !m.replyTo);
    let answers = state.messages.filter(m => m.replyTo);

    if (state.chatFilter === 'doubts') topLevel = topLevel.filter(m => m.type === 'doubt' && !m.isSolved);
    if (state.chatFilter === 'solved') topLevel = topLevel.filter(m => m.type === 'doubt' && m.isSolved);

    let html = '';
    topLevel.forEach(msg => {
        const isMe = msg.senderId === state.user.uid;
        const canDelete = isMe || isGroupAdmin;
        const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';

        if (msg.type === 'doubt') {
            const doubtAnswers = answers.filter(a => a.replyTo === msg.id).sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            
            html += `
            <div class="mb-6 w-full message-enter">
                <div class="${isMe ? 'bg-yellow-100' : 'bg-yellow-50'} border ${msg.isSolved ? 'border-emerald-300' : 'border-yellow-300'} rounded-xl p-4 shadow-sm w-full relative group">
                    ${msg.isSolved ? '<div class="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center"><i class="fas fa-check-circle mr-1"></i>Solved</div>' : ''}
                    
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-yellow-700 uppercase tracking-wider flex items-center gap-1">
                            <i class="fas fa-question-circle"></i> Doubt by ${isMe ? 'You' : msg.senderName}
                        </span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-yellow-600/70 font-semibold">${time}</span>
                            ${canDelete ? `<button onclick="handleDeleteMessage('${msg.id}')" class="text-slate-400 hover:text-black bg-white/50 hover:bg-white rounded-full p-1 w-6 h-6 flex items-center justify-center transition-all shadow-sm" title="Delete"><i class="fas fa-trash text-xs"></i></button>` : ''}
                        </div>
                    </div>
                    
                    <p class="text-sm text-slate-800 font-medium mb-3">${msg.text}</p>
                    
                    <div class="flex justify-between items-center border-t border-yellow-200/50 pt-2 mt-2">
                        <button onclick="window.handleReplyDoubt('${msg.id}')" class="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                            <i class="fas fa-reply mr-1"></i> Provide Answer
                        </button>
                        <span class="text-xs text-yellow-600 font-medium"><i class="fas fa-comments mr-1"></i> ${doubtAnswers.length} Answers</span>
                    </div>
                </div>
                
                ${doubtAnswers.length > 0 ? `
                    <div class="ml-4 md:ml-8 mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
                        ${doubtAnswers.map(ans => {
                            const isAnsMe = ans.senderId === state.user.uid;
                            const canDeleteAns = isAnsMe || isGroupAdmin;
                            const isBest = msg.bestAnswerId === ans.id;
                            const upvotes = ans.upvotes || [];
                            const iUpvoted = upvotes.includes(state.user.uid);
                            
                            return `
                            <div class="bg-white border ${isBest ? 'border-emerald-400 bg-emerald-50 shadow-md' : 'border-slate-200'} rounded-lg p-3 relative shadow-sm group">
                                ${isBest ? '<div class="absolute -top-2.5 -left-2.5 bg-emerald-500 text-white text-[10px] px-2 py-0.5 font-bold flex items-center justify-center rounded-full shadow-md" title="Best Answer"><i class="fas fa-medal mr-1"></i> Best Answer</div>' : ''}
                                <div class="flex justify-between items-start mb-1 ${isBest ? 'ml-20' : ''}">
                                    <span class="text-[10px] font-bold ${isAnsMe ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-wider">${isAnsMe ? 'You' : ans.senderName}</span>
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] text-slate-400">${ans.createdAt ? new Date(ans.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}</span>
                                        ${canDeleteAns ? `<button onclick="handleDeleteMessage('${ans.id}')" class="text-slate-400 hover:text-black bg-slate-50 hover:bg-slate-200 rounded-full p-1 w-5 h-5 flex items-center justify-center transition-colors" title="Delete"><i class="fas fa-trash text-[10px]"></i></button>` : ''}
                                    </div>
                                </div>
                                <p class="text-sm text-slate-700 mb-2 mt-1">${ans.text}</p>
                                
                                <div class="flex items-center gap-3 pt-2 border-t border-slate-100">
                                    <button onclick="window.handleUpvote('${ans.id}')" class="text-xs font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors ${iUpvoted ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-100'}">
                                        <i class="fas fa-thumbs-up"></i> ${upvotes.length}
                                    </button>
                                    ${isMe && !msg.isSolved ? `
                                        <button onclick="window.handleMarkSolved('${msg.id}', '${ans.id}', '${ans.senderId}')" class="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded transition-colors ml-auto">
                                            <i class="fas fa-check-circle mr-1"></i> Mark as Best
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
            `;
        } else {
            html += `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 message-enter group">
                <div class="max-w-[80%] ${isMe ? 'bg-blue-600 text-white rounded-l-2xl rounded-tr-2xl' : 'bg-white border border-slate-200 text-slate-800 rounded-r-2xl rounded-tl-2xl'} px-4 py-2 shadow-sm text-sm relative">
                    <div class="flex justify-between items-center mb-1 gap-4 border-b ${isMe ? 'border-blue-500' : 'border-slate-100'} pb-1">
                        ${isMe ? `<span class="text-[10px] text-blue-100 font-bold uppercase tracking-wider">You</span>` : `<span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${msg.senderName}</span>`}
                        ${canDelete ? `<button onclick="handleDeleteMessage('${msg.id}')" class="${isMe ? 'text-blue-200 hover:text-black hover:bg-white' : 'text-slate-400 hover:text-black bg-slate-100 hover:bg-slate-200'} w-5 h-5 rounded-full flex items-center justify-center transition-all" title="Delete"><i class="fas fa-trash text-[10px]"></i></button>` : ''}
                    </div>
                    <div class="mt-1">${msg.text}</div>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 mx-1">${time}</span>
            </div>
            `;
        }
    });

    if (!html) html = '<div class="text-center py-8 text-slate-400">No messages match this filter.</div>';
    
    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
    container.innerHTML = html;
    if (isScrolledToBottom || state.chatFilter !== 'all') {
        container.scrollTop = container.scrollHeight;
    }
};

window.handleAskAI = async (e) => {
    e.preventDefault();
    const input = document.getElementById('ai-input');
    const question = input.value.trim();
    if(!question) return;

    const currentGroup = state.groups.find(g => g.id === state.activeGroupId);
    const subject = currentGroup ? currentGroup.subject : "general studies";
    const groupName = currentGroup ? currentGroup.name : "this group";

    const prompt = `You are a helpful and encouraging study tutor for a group called "${groupName}" studying "${subject}". 
    Keep your answers highly concise, clear, and student-friendly. 
    Format key terms and important concepts in **bold**. 
    Use bullet points for lists where appropriate.
    If the question is unrelated to the subject, politely pivot back or answer briefly.\n\nStudent Question: ${question}`;

    await callGemini(prompt, question, input);
};