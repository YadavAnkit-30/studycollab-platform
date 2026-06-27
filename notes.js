import { db, supabase } from './config.js';
import { collection, addDoc, doc, getDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from './state.js';
import { callGeminiForJSON } from './utils.js';

async function extractTextFromPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        const maxPages = Math.min(pdf.numPages, 20); // Cap to 20 pages
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + "\n";
        }
        return fullText;
    } catch (e) {
        throw new Error("Could not extract text from PDF");
    }
}

window.handleNoteUpload = async (input) => {
    const file = input.files[0];
    if(!file) return;
    const fileInput = input;
    
    if (file.size > 10 * 1024 * 1024) { 
         window.showToast('File too large (max 10MB)', 'error');
         fileInput.value = '';
         return;
    }

    let content = null;
    let isStored = false;
    let analysisData = null;
    let publicURL = null;
    let storagePath = null;

    try {
        window.showToast("Uploading file to cloud...", "info");
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await supabase.storage
            .from('study-files')
            .upload(filePath, file);

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
            .from('study-files')
            .getPublicUrl(filePath);
        
        publicURL = publicUrlData.publicUrl;
        storagePath = filePath;

    } catch (uploadError) {
        console.error("Supabase Upload Error:", uploadError);
        window.showToast("File upload failed: " + uploadError.message, "error");
        fileInput.value = '';
        return; 
    }

    if (file.type.includes('text') || file.name.match(/\.(js|json|md|html|css)$/)) {
        try {
            content = await file.text();
            isStored = true;
        } catch(e) { console.warn("Read text error", e); }
    } else if (file.type === 'application/pdf') {
        try {
            window.showToast("Extracting & Analyzing PDF using AI...", "info");
            content = await extractTextFromPDF(file);
            isStored = true;
            if (content.length > 500000) content = content.substring(0, 500000) + "...(truncated)";
            
            const prompt = `Analyze this academic text. Return ONLY a valid JSON object strictly following this structure: {"summary": "2-3 sentences max.", "keyPoints": ["point 1", "point 2", "point 3"], "topics": ["Topic 1", "Topic 2"]}. Text: ${content.substring(0, 15000)}`;
            analysisData = await callGeminiForJSON(prompt);

        } catch(e) {
            console.warn("PDF process error", e);
            window.showToast("Upload completed, but AI analysis failed.", "error");
        }
    }

    try {
        const noteData = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "application/octet-stream",
            uploadedBy: state.userProfile?.displayName || "Anonymous",
            uploadedById: state.user.uid,
            createdAt: serverTimestamp(),
            isStored: isStored,
            content: content || null, 
            analysis: analysisData || null,
            downloadUrl: publicURL, 
            storagePath: storagePath 
        };

        await addDoc(collection(db, "groups", state.activeGroupId, "notes"), noteData);
        window.showToast('Note uploaded & analyzed successfully!', 'success');
    } catch(err) {
        console.error("Upload error:", err);
        window.showToast('Database save failed: ' + err.message, 'error');
    } finally {
        fileInput.value = ''; 
    }
};

window.toggleNotesDropdown = () => {
    const el = document.getElementById('notes-dropdown');
    const chev = document.getElementById('notes-chevron');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        chev.classList.add('rotate-180');
    } else {
        el.classList.add('hidden');
        chev.classList.remove('rotate-180');
    }
}

window.currentNoteView = null;

window.openNoteModal = async (noteId) => {
    try {
        window.showToast("Loading document details...", "info");
        const docRef = doc(db, "groups", state.activeGroupId, "notes", noteId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            window.showToast("Document not found.", "error");
            return;
        }

        const note = docSnap.data();
        window.currentNoteView = { id: noteId, content: note.content, fileName: note.fileName, storagePath: note.storagePath };

        const a = note.analysis || {
            summary: "No AI summary available for this file.",
            topics: ["Uncategorized"],
            keyPoints: ["Read full document to extract points."]
        };

        document.getElementById('nd-title').textContent = note.fileName;
        document.getElementById('nd-subtitle').textContent = `Uploaded by ${note.uploadedBy}`;
        document.getElementById('nd-summary').textContent = a.summary;
        document.getElementById('nd-topics').innerHTML = (a.topics || []).map(t => 
            `<span class="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs rounded-full font-medium border border-purple-100">${t}</span>`
        ).join('');
        document.getElementById('nd-keypoints').innerHTML = (a.keyPoints || []).map(k => 
            `<li>${k}</li>`
        ).join('');

        const fileUrl = note.downloadUrl || (note.storagePath ? `https://gubmsflwwxakwdwfxjss.supabase.co/storage/v1/object/public/study-files/${note.storagePath}` : null);

        const dlBtn = document.getElementById('nd-btn-download');
        if (fileUrl && dlBtn) {
            dlBtn.classList.remove('hidden');
            dlBtn.href = fileUrl;
        } else if (dlBtn) {
            dlBtn.classList.add('hidden');
        }
        
        const delBtn = document.getElementById('nd-btn-delete');
        if(delBtn) {
             delBtn.classList.remove('hidden');
             delBtn.onclick = () => window.deleteNote(noteId, note.storagePath);
        }

        const rawBtn = document.getElementById('nd-btn-raw');
        if (rawBtn) {
            rawBtn.onclick = () => {
                const win = window.open("", "_blank");
                win.document.write(`<pre style="padding:20px; font-family:monospace; white-space: pre-wrap;">${note.content || 'No text content available.'}</pre>`);
                win.document.title = note.fileName;
            };
            rawBtn.style.display = note.content ? 'inline-flex' : 'none';
        }

        const quizBtn = document.getElementById('nd-btn-quiz');
        if (quizBtn) {
            quizBtn.onclick = () => {
                window.toggleNoteDetailModal(false);
                window.handleQuizFromPDF(noteId, note.content);
            };
            quizBtn.style.display = note.content ? 'inline-flex' : 'none';
        }

        window.toggleNoteDetailModal(true);

    } catch (err) {
        window.showToast("Failed to open note: " + err.message, "error");
    }
};

window.toggleNoteDetailModal = (show) => {
    const el = document.getElementById('note-detail-modal');
    if(show) el.classList.remove('hidden'); else el.classList.add('hidden');
};

window.deleteNote = async (noteId, storagePath) => {
    if(!confirm("Are you sure you want to delete this note for everyone? This action cannot be undone.")) return;
    try {
        await deleteDoc(doc(db, "groups", state.activeGroupId, "notes", noteId));
        if(storagePath && storagePath !== 'null' && storagePath !== 'undefined') {
            const { error } = await supabase.storage.from('study-files').remove([storagePath]);
            if(error) console.error("Storage delete error:", error);
        }
        window.showToast("Note deleted successfully.", "success");
        if(window.currentNoteView?.id === noteId) window.toggleNoteDetailModal(false);
    } catch(e) {
        console.error(e);
        window.showToast("Error deleting note: " + e.message, "error");
    }
};