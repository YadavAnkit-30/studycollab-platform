import { apiKey } from './config.js';

window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-slate-800' };
    el.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transform transition-all translate-x-10 opacity-0`;
    el.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>${msg}`;
    container.appendChild(el);
    
    requestAnimationFrame(() => { el.classList.remove('translate-x-10', 'opacity-0'); });
    setTimeout(() => {
        el.classList.add('translate-x-10', 'opacity-0');
        setTimeout(() => el.remove(), 300);
    }, 3000);
};

export async function callGemini(prompt, titleOverride = null, inputEl = null) {
    const box = document.getElementById('ai-response-area');
    const userQ = document.createElement('div');
    userQ.className = "mb-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-right ml-8 shadow-sm";
    userQ.innerHTML = `<span class="text-[10px] text-indigo-400 font-bold uppercase block mb-1">You Asked</span><span class="text-slate-700 text-sm">${titleOverride || "Asking AI..."}</span>`;
    box.appendChild(userQ);
    
    if(inputEl) {
        inputEl.value = '';
        inputEl.disabled = true;
    }

    const loader = document.createElement('div');
    loader.className = "text-xs text-slate-400 p-2 flex items-center gap-2";
    loader.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Study Assistant is thinking...';
    box.appendChild(loader);
    box.scrollTop = box.scrollHeight;

    try {
        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "user", content: prompt }
            ]
        };
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            }, 
            body: JSON.stringify(payload) 
        });
        
        const rawText = await response.text();
        loader.remove();

        let data;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            throw new Error(`Server returned non-JSON response. Status: ${response.status}. Msg: ${rawText.substring(0,50)}`);
        }

        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.status}`);
        }

        const answer = data.choices?.[0]?.message?.content || "I couldn't understand that.";
        
        const formattedAnswer = answer
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
            .replace(/^\* /gm, '• ') 
            .replace(/\n\* /g, '<br>• ') 
            .replace(/\n/g, '<br>'); 

        const aiMsg = document.createElement('div');
        aiMsg.className = "mb-4 p-3 text-slate-700 bg-white border border-slate-200 rounded-lg mr-8 shadow-sm ai-content text-sm";
        aiMsg.innerHTML = `<strong class="text-purple-600 block text-xs mb-2 flex items-center gap-1"><i class="fas fa-sparkles"></i> Your Study Assistant</strong>${formattedAnswer}`;
        box.appendChild(aiMsg);

    } catch(err) {
        if(loader && loader.parentNode) loader.remove();
        box.innerHTML += `<div class="mb-4 text-red-500 bg-red-50 border border-red-100 rounded-lg p-3 text-xs shadow-sm"><strong>API Error:</strong> ${err.message}</div>`;
    } finally {
        if(inputEl) {
            inputEl.disabled = false;
            inputEl.focus();
        }
        box.scrollTop = box.scrollHeight;
    }
}

export async function callGeminiForJSON(prompt) {
    try {
        const payload = {
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You are a helpful API that returns strictly valid JSON." },
                { role: "user", content: prompt }
            ]
        };
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            }, 
            body: JSON.stringify(payload) 
        });
        
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            throw new Error(`Server returned non-JSON response. Status: ${response.status}. Msg: ${rawText.substring(0,50)}`);
        }

        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.status}`);
        }

        let text = data.choices?.[0]?.message?.content;
        if (!text) return null;

        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch(err) {
        console.error("JSON Parse Error", err);
        return null;
    }
}