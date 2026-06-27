import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDO14fLKWwVyLDxomOp2NKeQxlZsaiCFrg", 
    authDomain: "studentcollab-70ab7.firebaseapp.com",
    projectId: "studentcollab-70ab7",
    storageBucket: "studentcollab-70ab7.firebasestorage.app",
    messagingSenderId: "477001340227",
    appId: "1:477001340227:web:daaf87e75006cb9f368bf6",
    measurementId: "G-7Y4NY8M9VD"
};

export const apiKey = "YOUR_GROQ_API_KEY"; 

const supabaseUrl = 'https://gubmsflwwxakwdwfxjss.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Ym1zZmx3d3hha3dkd2Z4anNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTg1MjEsImV4cCI6MjA4NjUzNDUyMX0.orgmD5c69MHlwpPnDgPvVlA5RPiS4SfVQrC7hTysvQc';
export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);