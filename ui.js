import { state } from './state.js';

window.navigate = (view) => {
    state.view = view;
    window.render();
    if (view === 'groups') {
        window.filterGroups(); 
    }
    if (view === 'leaderboard') {
        window.loadLeaderboard();
    }
};

window.render = () => {
    const appDiv = document.getElementById('app');

    if (state.view !== 'groupDetail') {
        if (state.listeners.chat) { state.listeners.chat(); state.listeners.chat = null; }
        if (state.listeners.notes) { state.listeners.notes(); state.listeners.notes = null; }
    }

    switch (state.view) {
        case 'loading': appDiv.innerHTML = window.Views.Loading(); break;
        case 'login': appDiv.innerHTML = window.Views.Login(); break;
        case 'signup': appDiv.innerHTML = window.Views.Signup(); break;
        case 'adminPerformance':
            appDiv.innerHTML = window.Layout(state.view);
            window.loadAdminPerformanceData();
            break;
        default: 
            appDiv.innerHTML = window.Layout(state.view);
            if(state.view === 'groupDetail') { 
                window.initChatScroll(); 
                if (state.messages && state.messages.length > 0) window.renderChat();
            }
            if(state.view === 'dashboard' && state.userProfile?.role !== 'admin') { 
                window.loadStudentDashboardStats(); 
            }
            break;
    }
    if (window.attachGlobalListeners) window.attachGlobalListeners();
};

window.Views = {
    Loading: () => `
        <div class="flex items-center justify-center h-full bg-slate-50">
            <div class="text-center">
                <div class="loader mx-auto mb-4 border-t-blue-600 w-10 h-10 border-4"></div>
                <h2 class="text-xl font-semibold text-slate-700">StudyCollab</h2>
                <p class="text-slate-500 text-sm">Loading your workspace...</p>
            </div>
        </div>
    `,
    Login: () => `
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-900 p-4">
            <div class="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl bg-white">
                <div class="text-center mb-8">
                    <h1 class="text-3xl font-bold text-blue-900">StudyCollab</h1>
                    <p class="text-slate-500 mt-2">Welcome back! Please login to continue.</p>
                </div>
                <form onsubmit="handleLogin(event)" class="space-y-5">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input type="email" id="login-email" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input type="password" id="login-password" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                    </div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all transform hover:-translate-y-0.5">
                        Sign In
                    </button>
                </form>
                <div class="mt-6 text-center text-sm text-slate-600">
                    Don't have an account? <button onclick="navigate('signup')" class="text-blue-600 hover:text-blue-800 font-medium hover:underline">Create Account</button>
                </div>
            </div>
        </div>
    `,
    Signup: () => `
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-900 p-4">
            <div class="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl bg-white">
                <div class="text-center mb-8">
                    <h1 class="text-3xl font-bold text-blue-900">Create Account</h1>
                    <p class="text-slate-500 mt-2">Join the learning community today.</p>
                </div>
                <form onsubmit="handleSignup(event)" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" id="signup-name" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input type="email" id="signup-email" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select id="signup-role" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="student">Student</option>
                                <option value="admin">Teacher/Admin</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <input type="password" id="signup-password" class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" required>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all mt-2">
                        Sign Up
                    </button>
                </form>
                <div class="mt-6 text-center text-sm text-slate-600">
                    Already have an account? <button onclick="navigate('login')" class="text-blue-600 hover:text-blue-800 font-medium hover:underline">Log In</button>
                </div>
            </div>
        </div>
    `
};

window.Layout = (viewName) => {
    const userInitials = state.userProfile?.displayName 
        ? state.userProfile.displayName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() 
        : 'U';

    return `
    <div class="flex h-screen bg-slate-50">
        <aside class="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 hidden md:flex">
            <div class="p-6 border-b border-slate-800 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold">SC</div>
                <span class="font-bold text-lg tracking-tight">StudyCollab</span>
            </div>
            
            <div class="p-4 border-b border-slate-800">
                <div class="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">
                        ${userInitials}
                    </div>
                    <div class="overflow-hidden">
                        <div class="font-medium text-sm truncate">${state.userProfile?.displayName || 'User'}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="text-xs text-slate-400 capitalize">${state.userProfile?.role || 'Student'}</div>
                            <div class="text-[10px] font-bold text-yellow-500 bg-yellow-500/20 px-1.5 py-0.5 rounded flex items-center gap-1" title="Experience Points">
                                <i class="fas fa-star"></i> ${state.userProfile?.xp || 0} XP
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
                <button onclick="navigate('dashboard')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewName === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <i class="fas fa-home w-5 text-center"></i>
                    <span>Dashboard</span>
                </button>
                <button onclick="navigate('groups')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewName === 'groups' || viewName === 'groupDetail' || viewName === 'quiz' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <i class="fas fa-users w-5 text-center"></i>
                    <span>Groups</span>
                </button>
                <button onclick="navigate('leaderboard')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewName === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <i class="fas fa-trophy w-5 text-center"></i>
                    <span>Leaderboard</span>
                </button>
                ${state.userProfile?.role === 'admin' ? `
                    <button onclick="navigate('adminPerformance')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewName === 'adminPerformance' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                        <i class="fas fa-chart-line w-5 text-center"></i>
                        <span>Performance</span>
                    </button>
                ` : ''}
                <button onclick="navigate('profile')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewName === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <i class="fas fa-user-cog w-5 text-center"></i>
                    <span>Profile</span>
                </button>
            </nav>

            <div class="p-4 border-t border-slate-800">
                <button onclick="handleLogout()" class="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-sm">
                    <i class="fas fa-sign-out-alt w-5 text-center"></i>
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>

        <div class="flex-1 flex flex-col h-screen overflow-hidden relative">
            <header class="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-30">
                <div class="font-bold">StudyCollab</div>
                <button onclick="document.querySelector('aside').classList.toggle('hidden'); document.querySelector('aside').classList.toggle('absolute'); document.querySelector('aside').classList.toggle('h-full');" class="text-slate-300 hover:text-white">
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </header>

            <main class="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 md:p-8">
                ${window.getContent(viewName)}
            </main>
        </div>
    </div>
    `;
};

window.getContent = (view) => {
    switch (view) {
        case 'dashboard': return window.Components.Dashboard();
        case 'groups': return window.Components.Groups();
        case 'groupDetail': return window.Components.GroupDetail();
        case 'profile': return window.Components.Profile();
        case 'quiz': return window.Components.Quiz();
        case 'leaderboard': return window.Components.Leaderboard();
        case 'adminPerformance': return window.Components.AdminPerformance();
        default: return window.Components.Dashboard();
    }
};

window.Components = {
    Dashboard: () => {
        const isAdmin = state.userProfile?.role === 'admin';
        const myJoinedCount = state.groups.filter(g => g.members?.includes(state.user.uid)).length;
        const myCreatedCount = state.groups.filter(g => g.createdBy === state.user.uid).length;

        let dashboardGroups = state.groups;
        let dashboardTitle = "Newest Groups";
        
        if (isAdmin) {
            dashboardGroups = state.groups.filter(g => g.createdBy === state.user.uid);
            dashboardTitle = "Your Created Groups";
        }

        return `
        <div class="max-w-6xl mx-auto space-y-6">
            <header class="mb-8 flex justify-between items-end">
                <div>
                    <h1 class="text-3xl font-bold text-slate-800">Hello, ${state.userProfile?.displayName?.split(' ')[0] || 'User'}</h1>
                    <p class="text-slate-500">Here's what's happening in your study platform today.</p>
                </div>
            </header>

            ${!isAdmin ? `<div id="student-dashboard-stats"></div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-semibold text-lg">${isAdmin ? 'Managed Groups' : 'My Groups'}</h3>
                        <i class="fas fa-layer-group opacity-50 text-2xl"></i>
                    </div>
                    <div class="text-4xl font-bold mb-1">${isAdmin ? myCreatedCount : myJoinedCount}</div>
                    <div class="text-blue-100 text-sm">${isAdmin ? 'Groups created by you' : 'Active memberships'}</div>
                </div>
                
                <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-semibold text-slate-700">${isAdmin ? 'Total System Groups' : 'Available to Join'}</h3>
                        <i class="fas fa-globe opacity-50 text-2xl text-slate-400"></i>
                    </div>
                    <div class="text-4xl font-bold mb-1 text-slate-800">${isAdmin ? state.groups.length : (state.groups.length - myJoinedCount)}</div>
                    <div class="text-slate-500 text-sm">${isAdmin ? 'Groups across platform' : 'Groups you can join'}</div>
                </div>

                <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center">
                    <h3 class="font-semibold text-slate-700 mb-4">Quick Actions</h3>
                    <div class="flex flex-col gap-2">
                        <button onclick="navigate('groups')" class="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors text-center">
                            Browse Groups
                        </button>
                        ${isAdmin ? `
                        <button onclick="toggleCreateGroupModal(true)" class="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors text-center">
                            Create New Group
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">${dashboardTitle}</h3>
                    <button onclick="navigate('groups')" class="text-blue-600 text-sm hover:underline">View All</button>
                </div>
                <div class="p-6">
                    ${dashboardGroups.length > 0 ? `
                        <div class="space-y-4">
                            ${dashboardGroups.slice(0, 5).map(g => `
                                <div class="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100" onclick="openGroup('${g.id}')">
                                    <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                        ${g.subject ? g.subject[0] : 'G'}
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="font-medium text-slate-800">${g.name}</h4>
                                        <p class="text-xs text-slate-500">${g.subject} • ${g.members?.length || 0} members</p>
                                    </div>
                                    ${(isAdmin || g.createdBy === state.user.uid) ? `
                                        <button onclick="event.stopPropagation(); openGroupSettings('${g.id}')" class="p-2 text-slate-400 hover:text-blue-600 transition-colors z-10" title="Edit Group">
                                            <i class="fas fa-cog"></i>
                                        </button>
                                    ` : ''}
                                    <i class="fas fa-chevron-right text-slate-300"></i>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center py-8 text-slate-400">
                            <i class="fas fa-wind text-3xl mb-3"></i>
                            <p>${isAdmin ? 'You haven\'t created any groups yet.' : 'No groups found.'}</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
        `;
    },

    AdminPerformance: () => `
        <div class="max-w-7xl mx-auto space-y-6">
            <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Student Performance Analytics</h1>
                    <p class="text-slate-500 text-sm">Comprehensive review of student progress across all subjects.</p>
                </div>
                <div class="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm self-start md:self-auto">
                    <button onclick="window.setPerformanceView('table')" id="btn-perf-table" class="px-4 py-2 text-sm font-medium rounded-md transition-all ${state.currentPerfView === 'table' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}">
                        <i class="fas fa-table mr-1"></i> Overview
                    </button>
                    <button onclick="window.setPerformanceView('charts')" id="btn-perf-charts" class="px-4 py-2 text-sm font-medium rounded-md transition-all ${state.currentPerfView === 'charts' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}">
                        <i class="fas fa-chart-pie mr-1"></i> Subject Analysis
                    </button>
                    <button onclick="window.setPerformanceView('insights')" id="btn-perf-insights" class="px-4 py-2 text-sm font-medium rounded-md transition-all ${state.currentPerfView === 'insights' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}">
                        <i class="fas fa-lightbulb mr-1"></i> Insights
                    </button>
                </div>
            </header>

            <div id="admin-performance-content" class="min-h-[400px]">
                <div class="flex justify-center items-center h-64">
                    <div class="loader w-8 h-8 border-t-blue-600"></div>
                </div>
            </div>
        </div>
    `,

    Groups: () => `
        <div class="max-w-6xl mx-auto space-y-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Study Groups</h1>
                    <p class="text-slate-500 text-sm">Join a group or create your own.</p>
                </div>
                ${state.userProfile?.role === 'admin' ? `
                    <button onclick="toggleCreateGroupModal(true)" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium flex items-center gap-2 transition-colors">
                        <i class="fas fa-plus"></i> New Group
                    </button>
                ` : ''}
            </div>

            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div class="flex-1 relative">
                    <i class="fas fa-search absolute left-3 top-3 text-slate-400"></i>
                    <input type="text" id="group-search" onkeyup="filterGroups()" placeholder="Search groups by name or subject..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                </div>
                <select id="group-filter" onchange="filterGroups()" class="px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                    <option value="all">All Groups</option>
                    <option value="my">My Groups (Joined)</option>
                    <option value="new">Available to Join</option>
                    ${state.userProfile?.role === 'admin' ? '<option value="created">Created by Me</option>' : ''}
                </select>
            </div>

            <div id="groups-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                </div>
        </div>
    `,

    GroupDetail: () => {
        const group = state.groups.find(g => g.id === state.activeGroupId);
        if (!group) return `<div class="p-8 text-center">Group not found. <button onclick="navigate('groups')" class="text-blue-500">Go back</button></div>`;
        
        const isMember = group.members?.includes(state.user.uid);
        const canSeeSettings = isMember; 
        const activeStudyingCount = group.studyingUsers ? group.studyingUsers.length : 0;
        const iAmStudying = group.studyingUsers?.includes(state.user.uid) || state.studyTimer.isStudying;

        return `
        <div class="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
            <div class="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                
                <div class="p-4 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center bg-slate-50">
                    <div>
                        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <button onclick="navigate('groups')" class="text-slate-400 hover:text-blue-600 mr-1"><i class="fas fa-arrow-left"></i></button>
                            ${group.name}
                        </h2>
                        <p class="text-xs text-slate-500 ml-7">${group.subject} • ${group.members?.length || 0} members</p>
                        <div class="ml-7 mt-1 text-[10px] font-medium text-emerald-600 flex items-center gap-1 bg-emerald-50 inline-block px-2 py-0.5 rounded-full border border-emerald-100" id="live-study-indicator">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span id="live-study-count">${activeStudyingCount} members studying now</span>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 shrink-0 items-center">
                        ${isMember ? `
                            <div class="flex items-center bg-white border ${iAmStudying ? 'border-red-200' : 'border-slate-200'} rounded-lg overflow-hidden mr-2 shadow-sm">
                                <div class="px-3 py-1.5 bg-slate-50 border-r ${iAmStudying ? 'border-red-200 text-red-500 timer-active' : 'border-slate-200 text-slate-600'} text-xs font-mono font-bold" id="timer-display">
                                    ${iAmStudying && state.studyTimer.timeLeft > 0 ? 
                                        Math.floor(state.studyTimer.timeLeft/60).toString().padStart(2,'0') + ':' + (state.studyTimer.timeLeft%60).toString().padStart(2,'0') : 
                                        '25:00'}
                                </div>
                                <button onclick="toggleStudySession('${group.id}')" class="px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 transition-colors ${iAmStudying ? 'text-red-600' : 'text-slate-700'}" id="study-btn-text">
                                    ${iAmStudying ? '<i class="fas fa-stop-circle mr-1"></i> Stop' : '<i class="fas fa-play-circle text-green-500 mr-1"></i> Study Mode'}
                                </button>
                            </div>
                            <button onclick="handleGenerateSubjectQuiz('${group.subject}')" class="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Generate Quiz">
                                <i class="fas fa-brain"></i>
                            </button>
                        ` : ''}
                        ${canSeeSettings ? `
                            <button onclick="openGroupSettings('${group.id}')" class="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Settings">
                                <i class="fas fa-cog"></i>
                            </button>
                        ` : ''}
                        <button onclick="toggleMembersModal(true)" class="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Members">
                            <i class="fas fa-users"></i>
                        </button>
                        ${!isMember ? `
                            <button onclick="joinGroup('${group.id}')" class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm">Join Group</button>
                        ` : `
                            <button onclick="leaveGroup('${group.id}')" class="px-3 py-1 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 rounded-lg transition-colors text-sm font-medium shadow-sm flex items-center ml-2" title="Leave Group">
                                <i class="fas fa-sign-out-alt mr-1.5"></i> Leave
                            </button>
                        `}
                    </div>
                </div>

                <div class="flex gap-2 p-2 border-b border-slate-200 bg-white text-xs font-medium sticky top-0 z-10 shadow-sm shrink-0 overflow-x-auto">
                    <button onclick="window.setChatFilter('all')" class="${state.chatFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'} px-3 py-1.5 rounded-full transition-all whitespace-nowrap">All Discussion</button>
                    <button onclick="window.setChatFilter('doubts')" class="${state.chatFilter === 'doubts' ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'} px-3 py-1.5 rounded-full transition-all whitespace-nowrap"><i class="fas fa-question-circle mr-1"></i> Active Doubts</button>
                    <button onclick="window.setChatFilter('solved')" class="${state.chatFilter === 'solved' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'} px-3 py-1.5 rounded-full transition-all whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> Solved</button>
                </div>

                <div id="chat-container" class="flex-1 overflow-y-auto p-4 bg-slate-50 scroll-smooth relative">
                    <div class="text-center py-8 text-slate-400 text-sm">Loading chat history...</div>
                </div>

                <div class="bg-white border-t border-slate-200 flex flex-col shrink-0">
                    ${isMember ? `
                        ${state.replyingToDoubt ? `
                            <div class="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-xs flex justify-between items-center text-indigo-700">
                                <span><i class="fas fa-reply mr-1"></i> Replying to a doubt with an Answer...</span>
                                <button type="button" onclick="window.cancelReply()" class="hover:text-indigo-900 font-bold p-1"><i class="fas fa-times"></i></button>
                            </div>
                        ` : ''}
                        <form onsubmit="handleSendMessage(event)" class="p-3">
                            ${!state.replyingToDoubt ? `
                                <div class="flex items-center gap-2 mb-2 px-1">
                                    <label class="flex items-center gap-1.5 text-xs font-bold text-yellow-600 cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded transition-colors">
                                        <input type="checkbox" id="is-doubt-checkbox" class="rounded text-yellow-500 focus:ring-yellow-500 w-3.5 h-3.5 border-slate-300">
                                        <i class="fas fa-question-circle"></i> Ask as Doubt
                                    </label>
                                </div>
                            ` : ''}
                            <div class="flex gap-2">
                                <input id="message-input" type="text" autocomplete="off" class="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" placeholder="${state.replyingToDoubt ? 'Type your answer here...' : 'Type a message...'}">
                                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg shadow-sm transition-colors font-medium">
                                    Send
                                </button>
                            </div>
                        </form>
                    ` : `
                        <div class="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100 m-4">
                            Join this group to participate in the chat.
                        </div>
                    `}
                </div>
            </div>

            <div class="w-full md:w-80 flex flex-col gap-4 h-full relative">
                
                <div class="relative z-20">
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onclick="toggleNotesDropdown()">
                        <div class="flex items-center gap-2 font-bold text-slate-800">
                            <i class="fas fa-file-alt text-yellow-500"></i>
                            <span>Shared Notes</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-slate-400" id="notes-count-badge">View</span>
                            <i class="fas fa-chevron-down text-slate-400 transition-transform" id="notes-chevron"></i>
                        </div>
                    </div>

                    <div id="notes-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 max-h-80 overflow-y-auto transform origin-top transition-all">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Files</h4>
                            ${isMember ? `
                                <button onclick="event.stopPropagation(); document.getElementById('note-upload').click()" class="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                                    <i class="fas fa-upload mr-1"></i> Upload
                                </button>
                                <input type="file" id="note-upload" class="hidden" accept=".pdf,.txt,.md" onchange="handleNoteUpload(this)">
                            ` : ''}
                        </div>
                        <div id="notes-list" class="space-y-2">
                            <div class="text-center py-4 text-slate-400 text-xs">No notes yet</div>
                        </div>
                    </div>
                </div>

                <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col min-h-0">
                    <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 shrink-0">
                        <i class="fas fa-robot text-purple-500"></i> Your Study Assistant
                    </h3>
                    <div id="ai-response-area" class="flex-1 bg-slate-50 rounded-lg p-3 overflow-y-auto text-sm text-slate-700 border border-slate-100 mb-3 scroll-smooth">
                        <p class="text-slate-400 italic">Ask me anything about ${group.subject}...</p>
                    </div>
                    <form onsubmit="handleAskAI(event)" class="relative shrink-0">
                        <input id="ai-input" class="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Explain..." required>
                        <button type="submit" class="absolute right-2 top-2 text-purple-500 hover:text-purple-700">
                            <i class="fas fa-magic"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
        `;
    },

    Profile: () => `
        <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-700 h-32 relative"></div>
            <div class="px-8 pb-8">
                <div class="relative -top-10 mb-4">
                    <div class="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                        <div class="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
                            ${state.userProfile?.displayName ? state.userProfile.displayName[0].toUpperCase() : 'U'}
                        </div>
                    </div>
                </div>
                
                <h2 class="text-2xl font-bold text-slate-800 mb-1">${state.userProfile?.displayName || 'User'}</h2>
                <p class="text-slate-500 mb-6 bg-slate-100 inline-block px-3 py-1 rounded-full text-sm capitalize">${state.userProfile?.role || 'student'}</p>

                <form onsubmit="handleUpdateProfile(event)" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                        <input id="profile-name" value="${state.userProfile?.displayName || ''}" class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input value="${state.userProfile?.email || ''}" class="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" disabled>
                    </div>
                    <div class="pt-4">
                        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-sm font-medium transition-colors">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `,

    Quiz: () => {
        if(!state.currentQuiz) return `<div class="p-8 text-center">No quiz data loaded. <button onclick="navigate('groups')" class="text-blue-500">Go back</button></div>`;
        
        const questions = state.currentQuiz.questions || [];
        
        return `
        <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden my-6">
            <div class="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-bold">${state.currentQuiz.title || 'Study Quiz'}</h2>
                    <p class="text-indigo-100 text-sm">Test your knowledge</p>
                </div>
                <button onclick="navigate('groupDetail')" class="text-white/80 hover:text-white"><i class="fas fa-times"></i></button>
            </div>
            
            <div class="p-8 space-y-8">
                ${questions.map((q, idx) => `
                    <div class="border-b border-slate-100 pb-6 last:border-0">
                        <p class="font-semibold text-slate-800 text-lg mb-4">
                            <span class="text-indigo-500 mr-2">${idx + 1}.</span>${q.text || q.question || q.Question || "Question text missing"}
                        </p>
                        
                        ${q.type === 'short' ? `
                            <textarea placeholder="Type your answer here..." class="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" rows="3" disabled></textarea>
                            <p class="text-xs text-slate-400 mt-2 italic">Short answer questions are for self-reflection in this mode.</p>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                ${q.options.map((opt, optIdx) => `
                                    <div onclick="selectQuizOption('${q.id}', ${optIdx})" 
                                         id="opt-${q.id}-${optIdx}"
                                         class="option-card cursor-pointer p-3 rounded-lg border border-slate-200 text-sm text-slate-600 transition-all flex items-center gap-3">
                                        <div class="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-400 option-circle">${String.fromCharCode(65 + optIdx)}</div>
                                        ${opt}
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                `).join('')}
            </div>

            <div class="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button onclick="submitQuiz()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transform transition-transform hover:-translate-y-1">
                    Submit Quiz
                </button>
            </div>
        </div>
        `;
    },

    Leaderboard: () => {
        return `
        <div class="max-w-4xl mx-auto space-y-6">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Leaderboard</h1>
                    <p class="text-slate-500 text-sm">Top performers grouped by subject.</p>
                </div>
            </header>

            <div id="leaderboard-container" class="space-y-8">
                <div class="text-center py-12">
                    <div class="loader mx-auto mb-4 border-slate-200 border-t-blue-600 w-8 h-8"></div>
                    <p class="text-slate-400 text-sm">Loading scores...</p>
                </div>
            </div>
        </div>
        `;
    }
};

window.initChatScroll = () => {
    const c = document.getElementById('chat-container');
    if(c) c.scrollTop = c.scrollHeight;
};