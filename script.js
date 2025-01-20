// Initialize global variables
let knowledgeBase = [];
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingMessage = document.getElementById('loading-message');

// Synonym mappings for common terms
const synonyms = {
    'export': ['download', 'extract', 'output', 'save', 'get'],
    'activity': ['activities', 'program', 'event', 'session'],
    'camper': ['campers', 'participant', 'participants', 'child', 'children'],
    'report': ['reports', 'document', 'documents', 'file', 'files'],
    'setup': ['configure', 'set up', 'setting', 'settings', 'configuration'],
    'list': ['listing', 'view', 'display', 'show'],
    'create': ['make', 'generate', 'new', 'add'],
    'modify': ['change', 'edit', 'update', 'revise'],
    'remove': ['delete', 'clear', 'eliminate'],
    'search': ['find', 'locate', 'look', 'seek']
};

// Subject categories with related terms
const categories = {
    'Activities': ['activity', 'program', 'session', 'schedule', 'event'],
    'Camp Activities': ['activity', 'program', 'schedule', 'registration'],
    'Master Setup': ['setup', 'configuration', 'settings', 'master', 'system'],
    'Scheduling': ['schedule', 'time', 'date', 'period', 'slot'],
    'Registration': ['register', 'sign up', 'enroll', 'join'],
    'Reports': ['report', 'export', 'document', 'print']
};

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
        'will', 'with', 'how', 'what', 'when', 'where', 'why', 'who', 'which', 'do', 'does', 'can', 'could']);
    
    // Get query words and their synonyms
    let queryWords = normalizedQuery
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 1);
    
    // Add synonyms to query words
    const expandedQueryWords = new Set(queryWords);
    queryWords.forEach(word => {
        Object.entries(synonyms).forEach(([key, values]) => {
            if (values.includes(word) || word === key) {
                values.forEach(synonym => expandedQueryWords.add(synonym));
                expandedQueryWords.add(key);
            }
        });
    });
    
    const matches = knowledgeBase.map(qa => {
        const question = qa.Question?.toLowerCase() || '';
        const subject = qa.Subject?.toLowerCase() || '';
        let score = 0;
        
        // 1. Exact match (highest priority) - increased weight
        if (question.includes(normalizedQuery)) {
            score += 3;
        }
        
        // 2. Subject category matching
        if (qa.Subject) {
            const categoryTerms = categories[qa.Subject] || [];
            const categoryMatch = categoryTerms.some(term => 
                normalizedQuery.includes(term) || 
                expandedQueryWords.has(term)
            );
            if (categoryMatch) {
                score += 1.5;
            }
        }
        
        // 3. Individual word and synonym matching
        const questionWords = question
            .split(/\s+/)
            .filter(word => !stopWords.has(word) && word.length > 1);
        
        expandedQueryWords.forEach(queryWord => {
            questionWords.forEach(questionWord => {
                // Exact word match
                if (queryWord === questionWord) {
                    score += 1;
                }
                // Partial word match
                else if (questionWord.includes(queryWord) || queryWord.includes(questionWord)) {
                    score += 0.5;
                }
                // Similar word match (using edit distance)
                else if (calculateSimilarity(queryWord, questionWord) > 0.85) {
                    score += 0.3;
                }
            });
        });
        
        // 4. Context boost: If the subject matches any query word
        expandedQueryWords.forEach(word => {
            if (subject.includes(word)) {
                score += 0.8;
            }
        });
        
        // 5. Normalize score based on query complexity
        score = score / (Math.sqrt(queryWords.length) || 1);
        
        return {
            ...qa,
            score,
            matchDetails: {
                originalScore: score,
                queryWords: Array.from(expandedQueryWords),
                subject: qa.Subject
            }
        };
    });
    
    // Improved ranking and suggestion system
    const sortedMatches = matches
        .sort((a, b) => b.score - a.score)
        .filter(match => match.score > 0.3);
    
    const bestMatch = sortedMatches[0];
    
    // Get more diverse suggestions
    const suggestions = sortedMatches
        .filter(match => 
            match !== bestMatch && 
            match.Subject === bestMatch.Subject && 
            match.score > bestMatch.score * 0.6
        )
        .slice(0, 2);
    
    return {
        bestMatch: bestMatch?.score > 0.3 ? bestMatch : null,
        suggestions,
        debug: bestMatch?.matchDetails
    };
}

// Enhanced message handling
function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    
    // Generate response
    const { bestMatch, suggestions, debug } = findBestMatch(message);
    
    if (bestMatch) {
        // Add the main answer
        addMessage(bestMatch.Answer, 'bot', bestMatch.Subject);
        
        // Add relevant suggestions if available
        if (suggestions.length > 0) {
            setTimeout(() => {
                const suggestionText = "Related topics you might find helpful:\n" + 
                    suggestions.map((match, index) => 
                        `${index + 1}. ${match.Question}\n   → ${match.Answer}`
                    ).join('\n\n');
                
                addMessage(suggestionText, 'bot', 'Related Information');
            }, 500);
        }
        
        // If debug mode is enabled, show matching details
        if (debug && console.debug) {
            console.debug('Match details:', debug);
        }
    } else {
        const noMatchResponse = 
            "I couldn't find an exact match for your question. To help you better:\n\n" +
            "1. Try using different keywords\n" +
            "2. Specify if you're looking for information about:\n" +
            "   • Activities\n" +
            "   • Registration\n" +
            "   • Reports\n" +
            "   • Setup\n" +
            "3. Or tell me what specific task you're trying to accomplish";
        
        addMessage(noMatchResponse, 'bot', 'Help');
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
