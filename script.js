// Initialize global variables
let knowledgeBase = [];
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingMessage = document.getElementById('loading-message');

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

// Calculate similarity between two words
function calculateSimilarity(word1, word2) {
    const longer = word1.length > word2.length ? word1 : word2;
    const shorter = word1.length > word2.length ? word2 : word1;
    
    if (longer.length === 0) return 1.0;
    
    const costs = [];
    for (let i = 0; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= longer.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (shorter[i - 1] !== longer[j - 1]) {
                    newValue = Math.min(
                        Math.min(newValue, lastValue),
                        costs[j]
                    ) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[longer.length] = lastValue;
    }
    return (longer.length - costs[longer.length - 1]) / longer.length;
}

// Enhanced matching algorithm
function findBestMatch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Break down the query into keywords, removing common words
    const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 
        'will', 'with']);
    
    const queryWords = normalizedQuery
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 1);
    
    const matches = knowledgeBase.map(qa => {
        const question = qa.Question?.toLowerCase() || '';
        let score = 0;
        
        // 1. Exact match (highest priority)
        if (question.includes(normalizedQuery)) {
            score += 2;
        }
        
        // 2. Individual word matches
        const questionWords = question
            .split(/\s+/)
            .filter(word => !stopWords.has(word) && word.length > 1);
        
        queryWords.forEach(queryWord => {
            questionWords.forEach(questionWord => {
                if (queryWord === questionWord) {
                    score += 1;
                } else if (questionWord.includes(queryWord) || queryWord.includes(questionWord)) {
                    score += 0.5;
                } else if (calculateSimilarity(queryWord, questionWord) > 0.8) {
                    score += 0.3;
                }
            });
        });
        
        // 3. Context matching
        if (qa.Subject && normalizedQuery.includes(qa.Subject.toLowerCase())) {
            score += 0.5;
        }
        
        // 4. Normalize score based on query length
        score = score / (queryWords.length || 1);
        
        return { ...qa, score };
    });
    
    const sortedMatches = matches.sort((a, b) => b.score - a.score);
    const bestMatch = sortedMatches[0];
    
    const goodMatches = sortedMatches
        .filter(match => match.score > bestMatch.score * 0.7)
        .slice(0, 3);
    
    return {
        bestMatch: bestMatch.score > 0.3 ? bestMatch : null,
        suggestions: goodMatches.length > 1 ? goodMatches.slice(1) : []
    };
}

// Handle sending a message
function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    
    // Generate response
    const { bestMatch, suggestions } = findBestMatch(message);
    
    if (bestMatch) {
        addMessage(bestMatch.Answer, 'bot', bestMatch.Subject);
        
        // Add suggestions if available
        if (suggestions.length > 0) {
            const suggestionText = "You might also be interested in:\n" + 
                suggestions.map((match, index) => `${index + 1}. ${match.Question}`).join('\n');
            
            setTimeout(() => {
                addMessage(suggestionText, 'bot', 'Suggestions');
            }, 500);
        }
    } else {
        const noMatchResponse = "I apologize, but I couldn't find a specific answer to your question. " +
            "Could you please:\n" +
            "1. Rephrase your question\n" +
            "2. Use more specific terms\n" +
            "3. Break down your question if it's complex";
        
        addMessage(noMatchResponse, 'bot');
    }
    
    // Clear input
    userInput.value = '';
}

// Load the knowledge base
async function loadKnowledgeBase() {
    try {
        console.log('Starting to load knowledge base...');
        
        const fullUrl = window.location.origin + '/chatbot/data/ExportedReport.xlsx';
        console.log('Attempting to fetch from:', fullUrl);
        
        const response = await fetch(fullUrl);
        console.log('Fetch response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        console.log('Parsing Excel file...');
        const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true,
            cellNF: true,
            cellText: true
        });
        
        console.log('Available sheets:', workbook.SheetNames);
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        knowledgeBase = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('Knowledge base loaded:', knowledgeBase.length, 'entries');
        console.log('Sample entry:', knowledgeBase[0]);
        
        // Enable input once loaded
        userInput.disabled = false;
        sendButton.disabled = false;
        loadingMessage.style.display = 'none';
        
        addMessage(`Ready! ${knowledgeBase.length} answers loaded.`, 'bot');
        
    } catch (error) {
        console.error('Loading error:', error);
        loadingMessage.innerHTML = `
            <div style="color: #721c24; background: #f8d7da; padding: 15px; border-radius: 5px; text-align: left;">
                <strong>Error loading knowledge base</strong><br>
                Error details: ${error.message}<br><br>
                Please refresh the page to try again.
            </div>
        `;
    }
}

// Event listeners
sendButton.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

// Initialize
console.log('Script initialized');
loadKnowledgeBase();
