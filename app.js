import { auth, db } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';

import './utils.js';
import './ui.js';
import './auth.js';
import './groups.js';
import './chat.js';
import './notes.js';
import './quiz.js';
import './admin.js';

window.attachGlobalListeners = () => {
    if (!state.listeners.groups && state.user) {
        const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
        
        const handleUpdate = (snapshot) => {
            state.groups = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            if (state.view === 'groups') window.filterGroups();
            if (state.view === 'dashboard') window.render();
            
            if (state.view === 'groupDetail' && state.activeGroupId) {
                const currentG = state.groups.find(g => g.id === state.activeGroupId);
                const countEl = document.getElementById('live-study-count');
                if (countEl && currentG) {
                    const count = currentG.studyingUsers ? currentG.studyingUsers.length : 0;
                    countEl.textContent = `${count} members studying now`;
                }
            }
        };

        state.listeners.groups = onSnapshot(q, handleUpdate, (error) => {
            if (error.code === 'failed-precondition' || error.code === 'permission-denied') {
                const fallbackQ = collection(db, "groups");
                state.listeners.groups = onSnapshot(fallbackQ, handleUpdate, () => {});
            } else {
                window.showToast("Error loading groups.", "error");
            }
        });
    }
}

window.setupGroupListeners = (groupId) => {
    if (state.listeners.chat) state.listeners.chat();
    if (state.listeners.notes) state.listeners.notes();

    const group = state.groups.find(g => g.id === groupId);
    if (!group || !group.members?.includes(state.user.uid)) return;

    const chatQ = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"));
    state.listeners.chat = onSnapshot(chatQ, (snapshot) => {
        state.messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.renderChat();
    });

    const notesQ = query(collection(db, "groups", groupId, "notes"), orderBy("createdAt", "desc"));
    state.listeners.notes = onSnapshot(notesQ, (snapshot) => {
        const list = document.getElementById('notes-list');
        if(!list) return;
        
        if(snapshot.empty) {
            list.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs">No notes shared yet</div>`;
            return;
        }

        list.innerHTML = snapshot.docs.map(doc => {
            const note = doc.data();
            const noteId = doc.id;
            const isPdf = note.fileType?.includes('pdf');
            const icon = isPdf ? 'fa-file-pdf text-red-500' : 
                         note.fileType?.includes('image') ? 'fa-file-image text-purple-500' : 'fa-file-alt text-blue-500';
            
            const fileUrl = note.downloadUrl || (note.storagePath ? `https://gubmsflwwxakwdwfxjss.supabase.co/storage/v1/object/public/study-files/${note.storagePath}` : null);

            return `
            <div class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 group">
                <div class="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-semibold text-slate-700 truncate" title="${note.fileName}">${note.fileName}</h4>
                    <p class="text-[10px] text-slate-400 truncate">By ${note.uploadedBy}</p>
                </div>
                <div class="flex gap-1 items-center">
                    <button onclick="openNoteModal('${noteId}')" class="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                        Details
                    </button>
                    ${fileUrl ? `
                        <a href="${fileUrl}" target="_blank" class="text-slate-400 hover:text-blue-600 p-1.5 rounded transition-colors" title="Download">
                            <i class="fas fa-download"></i>
                        </a>
                    ` : ''}
                    <button onclick="deleteNote('${noteId}', '${note.storagePath || ''}')" class="text-slate-400 hover:text-red-500 p-1.5 rounded transition-colors" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    });
}

onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            state.userProfile = snap.data();
            state.view = 'dashboard';
        } else {
            state.userProfile = { displayName: user.email.split('@')[0], role: 'student' };
            state.view = 'dashboard';
        }
        window.attachGlobalListeners();
    } else {
        state.view = 'login';
        state.userProfile = null;
        state.groups = [];
        if (state.listeners.groups) {
            state.listeners.groups();
            state.listeners.groups = null;
        }
    }
    window.render();
});