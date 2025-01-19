let knowledgeBase = [];
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingMessage = document.getElementById('loading-message');

// Load the Excel file
async function loadKnowledgeBase() {
    try {
        const response = await fetch('data/ExportedReport.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        knowledgeBase = XLSX.utils.sheet_to_json(firstSheet);
        
        // Enable input once loaded
        userInput.disabled = false;
        sendButton.disabled = false;
        loadingMessage.style.display = 'none';
        
        console.log('Knowledge base loaded successfully');
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        loadingMessage.textContent = 'Error loading knowledge base. Please refresh the page to try again.';
    }
}

// Find the best matching response
function findBestMatch(query) {
    const normalizedQuery = query.toLowerCase();
    
    const matches = knowledgeBase.map(qa => {
        const question = qa.Question?.toLowerCase() || '';
        const words = normalizedQuery.split(' ');
        
        const wordMatchScore = words.reduce((score, word) => {
            return score + (question.includes(word) ? 1 : 0);
        }, 0) / words.length;
        
        const substringScore = question.includes(normalizedQuery) ? 0.5 : 0;
        
        return {
            ...qa,
            score: wordMatchScore + substringScore
        };
    });
    
    const bestMatch = matches.sort((a, b) => b.score - a.score)[0];
    return bestMatch.score > 0.3 ? bestMatch : null;
}

// Add a message to the chat
function addMessage(content, role, subject = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.textContent = content;
    
    if (subject) {
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-tag';
        subjectDiv.textContent = `Subject: ${subject}`;
        messageDiv.appendChild(subjectDiv);
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle sending a message
function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    
    // Generate response
    const match = findBestMatch(message);
    if (match) {
        addMessage(match.Answer, 'bot', match.Subject);
    } else {
        addMessage("I apologize, but I couldn't find a specific answer to your question. Could you please rephrase or ask something else?", 'bot');
    }
    
    // Clear input
    userInput.value = '';
}

// Event listeners
sendButton.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

// Load knowledge base when page loads
loadKnowledgeBase();