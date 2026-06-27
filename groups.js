import { db } from './config.js';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';

window.handleCreateGroup = async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-group-name').value;
    const subject = document.getElementById('new-group-subject').value;
    const classYear = document.getElementById('new-group-class').value;
    
    try {
        await addDoc(collection(db, "groups"), {
            name, subject, class: classYear,
            createdBy: state.user.uid,
            members: [state.user.uid],
            studyingUsers: [],
            createdAt: serverTimestamp(),
            description: `Study group for ${subject}`
        });
        window.toggleCreateGroupModal(false);
        window.showToast('Group created!', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    }
};

window.joinGroup = async (groupId) => {
    try {
        await updateDoc(doc(db, "groups", groupId), {
            members: arrayUnion(state.user.uid)
        });
        window.showToast('Joined group!', 'success');
        window.openGroup(groupId); 
    } catch (err) {
        window.showToast(err.message, 'error');
    }
};

window.leaveGroup = async (groupId) => {
    if(!confirm("Are you sure you want to leave?")) return;
    try {
        await updateDoc(doc(db, "groups", groupId), {
            members: arrayRemove(state.user.uid),
            studyingUsers: arrayRemove(state.user.uid) // Remove from studying if active
        });
        window.showToast('Left group', 'info');
        if(state.activeGroupId === groupId) window.navigate('groups');
    } catch (err) {
        window.showToast(err.message, 'error');
    }
};

window.openGroup = (groupId) => {
    state.activeGroupId = groupId;
    state.view = 'groupDetail';
    state.messages = []; // Clear previous group's messages while loading
    window.render();
    window.setupGroupListeners(groupId);
};

window.filterGroups = () => {
    const search = document.getElementById('group-search')?.value.toLowerCase() || '';
    const filter = document.getElementById('group-filter')?.value || 'all';
    const grid = document.getElementById('groups-grid');
    if(!grid) return;

    let filtered = state.groups.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(search) || g.subject.toLowerCase().includes(search);
        const isMember = g.members?.includes(state.user.uid);
        
        if (filter === 'my') return matchesSearch && isMember;
        if (filter === 'new') return matchesSearch && !isMember;
        return matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400">No groups found</div>`;
        return;
    }

    grid.innerHTML = filtered.map(g => {
        const isMember = g.members?.includes(state.user.uid);
        const isAdminOrOwner = (state.userProfile?.role === 'admin' || g.createdBy === state.user.uid);
        return `
        <div class="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all group-card relative overflow-hidden">
            ${g.createdBy === state.user.uid ? '<div class="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold z-0">ADMIN</div>' : ''}
            
            ${isAdminOrOwner ? `
                <button onclick="openGroupSettings('${g.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-blue-600 bg-white/80 rounded-full p-1 transition-colors z-10" title="Group Settings">
                    <i class="fas fa-cog"></i>
                </button>
            ` : ''}

            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
                    ${g.subject[0]}
                </div>
                ${isMember ? 
                    `<span class="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium">Joined</span>` : 
                    `<span class="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded-full">New</span>`
                }
            </div>
            <h3 class="font-bold text-slate-800 text-lg mb-1 truncate pr-8">${g.name}</h3>
            <p class="text-sm text-slate-500 mb-4">${g.subject} • ${g.class}</p>
            <div class="flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 pt-3">
                <span><i class="fas fa-users mr-1"></i> ${g.members?.length || 0} Members</span>
                <button onclick="${isMember ? `openGroup('${g.id}')` : `joinGroup('${g.id}')`}" class="${isMember ? 'text-blue-600 hover:underline' : 'bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors'}">
                    ${isMember ? 'Open' : 'Join'}
                </button>
            </div>
        </div>
        `;
    }).join('');
};

window.toggleGroupSettingsModal = (show) => {
    const el = document.getElementById('group-settings-modal');
    el.classList.toggle('hidden', !show);
};

window.openGroupSettings = (groupId) => {
    const group = state.groups.find(g => g.id === groupId);
    if(!group) return;
    const isAuthorized = group.createdBy === state.user.uid || state.userProfile?.role === 'admin' || !group.createdBy;
    
    if (!isAuthorized) {
        window.showToast("Only the group creator or admins can edit settings.", "error");
        return;
    }

    state.activeGroupId = groupId;
    document.getElementById('edit-group-id').value = groupId;
    document.getElementById('edit-group-name').value = group.name;
    document.getElementById('edit-group-subject').value = group.subject;
    window.toggleGroupSettingsModal(true);
};

window.handleUpdateGroup = async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('edit-group-id').value;
    const name = document.getElementById('edit-group-name').value;
    const subject = document.getElementById('edit-group-subject').value;

    try {
        await updateDoc(doc(db, "groups", groupId), { name, subject });
        window.showToast('Group updated successfully', 'success');
        window.toggleGroupSettingsModal(false);
    } catch (error) {
        window.showToast('Error updating group: ' + error.message, 'error');
    }
};

window.handleDeleteGroup = async () => {
    const groupId = document.getElementById('edit-group-id').value;
    if(!confirm("Are you sure you want to delete this group?")) return;

    try {
        await deleteDoc(doc(db, "groups", groupId));
        window.showToast('Group deleted', 'success');
        window.toggleGroupSettingsModal(false);
        window.navigate('groups');
    } catch (error) {
        window.showToast('Error deleting group: ' + error.message, 'error');
    }
};

window.removeMember = async (groupId, memberId) => {
    if(!confirm("Remove this member from the group?")) return;
    
    try {
        await updateDoc(doc(db, "groups", groupId), {
            members: arrayRemove(memberId),
            studyingUsers: arrayRemove(memberId)
        });
        window.showToast('Member removed', 'success');
        window.toggleMembersModal(false);
    } catch (error) {
        window.showToast('Error removing member: ' + error.message, 'error');
    }
};

window.toggleCreateGroupModal = (show) => {
    const el = document.getElementById('create-group-modal');
    if(show) el.classList.remove('hidden'); else el.classList.add('hidden');
};

window.toggleMembersModal = async (show) => {
    const el = document.getElementById('members-modal');
    
    if(show) { 
        el.classList.remove('hidden'); 
        let groupId = state.activeGroupId;
        if (!groupId) groupId = document.getElementById('edit-group-id').value;
        if (groupId) await window.refreshMembersList(groupId);
    } else { 
        el.classList.add('hidden'); 
    }
};

window.refreshMembersList = async (groupId) => {
    const content = document.getElementById('members-list-content');
    if(!content) return;
    
    content.innerHTML = '<div class="flex justify-center p-4"><div class="loader w-6 h-6 border-slate-200 border-t-blue-500"></div></div>';
    
    const subtitle = document.getElementById('members-modal-subtitle');
    if(subtitle) subtitle.textContent = "Loading...";

    const group = state.groups.find(g => g.id === groupId);
    const isGroupAdmin = group && (group.createdBy === state.user.uid || state.userProfile?.role === 'admin' || !group.createdBy);
    
    if(subtitle) subtitle.textContent = isGroupAdmin ? "Admin Access: You can manage members." : "Group Members";

    if(group && group.members && group.members.length > 0) {
        const membersHTML = [];
        const memberPromises = group.members.map(uid => getDoc(doc(db, "users", uid)).then(snap => ({uid, snap})));
        const results = await Promise.all(memberPromises);

        for(const {uid, snap} of results) {
            try {
                let u = { displayName: 'Unknown User', role: 'student', uid: uid };
                if(snap.exists()) u = snap.data();
                const isMemberSelf = u.uid === state.user.uid;

                membersHTML.push(`
                    <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group border border-transparent hover:border-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                ${u.displayName ? u.displayName[0] : 'U'}
                            </div>
                            <div>
                                <div class="text-sm font-medium text-slate-800">${u.displayName}</div>
                                <div class="text-xs text-slate-400 capitalize">${u.role || 'Student'}</div>
                            </div>
                        </div>
                        ${isGroupAdmin && !isMemberSelf ? `
                            <button onclick="removeMember('${group.id}', '${uid}')" class="ml-2 px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors shadow-sm" title="Remove from group">
                                Remove
                            </button>
                        ` : ''}
                    </div>
                `);
            } catch(e) { console.error(e); }
        }
        content.innerHTML = membersHTML.join('');
    } else {
        content.innerHTML = '<div class="text-center p-4 text-slate-400 text-sm">No members found.</div>';
    }
};