import { auth, db } from './config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.showToast('Welcome back!', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    }
};

window.handleSignup = async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;
    const role = document.getElementById('signup-role').value;

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            email: email,
            displayName: name,
            role: role,
            createdAt: serverTimestamp(),
            photoURL: null
        });
        window.showToast('Account created successfully!', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    }
};

window.handleLogout = () => {
    if (state.listeners.groups) state.listeners.groups();
    if (state.listeners.chat) state.listeners.chat();
    if (state.listeners.notes) state.listeners.notes();
    
    // Stop any active timer
    if(state.studyTimer.isStudying && state.activeGroupId) {
        window.toggleStudySession(state.activeGroupId, true); // force stop
    }

    signOut(auth).then(() => {
        state.user = null;
        state.userProfile = null;
        state.view = 'login';
        window.render();
        window.showToast('Logged out successfully', 'success');
    });
};

window.handleUpdateProfile = async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-name').value;
    try {
        await updateDoc(doc(db, "users", state.user.uid), {
            displayName: newName
        });
        state.userProfile.displayName = newName;
        window.showToast('Profile updated!', 'success');
        window.render(); 
    } catch(err) {
        window.showToast('Error updating profile', 'error');
    }
};