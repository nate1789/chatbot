// Initialize global variables
let knowledgeBase = [];
let conversationHistory = [];
let learnedPatterns = {};
let lastUserQuery = '';

const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingMessage = document.getElementById('loading-message');

// Extended synonym mappings with domain-specific terms
const synonyms = {
    'export': ['download', 'extract', 'output', 'save', 'get', 'retrieve', 'pull', 'excel', 'spreadsheet'],
    'activity': ['activities', 'program', 'event', 'session', 'class', 'camp activity', 'workshop'],
    'camper': ['campers', 'participant', 'participants', 'child', 'children', 'kid', 'kids', 'student', 'students'],
    'report': ['reports', 'document', 'documents', 'file', 'files', 'data', 'information', 'records'],
    'setup': ['configure', 'set up', 'setting', 'settings', 'configuration', 'establish', 'initialize', 'prepare'],
    'list': ['listing', 'view', 'display', 'show', 'see', 'find', 'get', 'fetch'],
    'create': ['make', 'generate', 'new', 'add', 'build', 'establish', 'setup'],
    'modify': ['change', 'edit', 'update', 'revise', 'alter', 'adjust', 'amend'],
    'remove': ['delete', 'clear', 'eliminate', 'erase', 'cancel', 'unlist'],
    'schedule': ['scheduling', 'timetable', 'calendar', 'plan', 'agenda', 'roster'],
    'allocation': ['assign', 'assignment', 'distribute', 'distribution', 'place', 'placement'],
    'before': ['prior', 'previous', 'ahead', 'pre'],
    'after': ['post', 'following', 'subsequent', 'later'],
    'master': ['main', 'primary', 'central', 'core', 'primary'],
    'help': ['assist', 'guide', 'support', 'instruction', 'documentation', 'info', 'information']
};

// Save conversation data
function saveConversationData() {
    localStorage.setItem('chatbotConversations', JSON.stringify(conversationHistory));
    localStorage.setItem('chatbotPatterns', JSON.stringify(learnedPatterns));
}

// Load conversation data
function loadConversationData() {
    try {
        const savedConversations = localStorage.getItem('chatbotConversations');
        const savedPatterns = localStorage.getItem('chatbotPatterns');
        
        if (savedConversations) {
            conversationHistory = JSON.parse(savedConversations);
        }
        if (savedPatterns) {
            learnedPatterns = JSON.parse(savedPatterns);
        }
        
        console.log('Loaded learned patterns:', Object.keys(learnedPatterns).length);
    } catch (error) {
        console.error('Error loading conversation data:', error);
    }
}

// Learn from conversations
function learnFromConversation(query, matchedAnswer, wasHelpful) {
    conversationHistory.push({
        query: query,
        answer: matchedAnswer,
        timestamp: new Date().toISOString(),
        helpful: wasHelpful
    });

    const queryWords = query.toLowerCase().split(/\s+/);
    queryWords.forEach(word => {
        if (!learnedPatterns[word]) {
            learnedPatterns[word] = {
                answers: {},
                totalUses: 0
            };
        }
        
        if (!learnedPatterns[word].answers[matchedAnswer]) {
            learnedPatterns[word].answers[matchedAnswer] = 0;
        }
        
        learnedPatterns[word].answers[matchedAnswer]++;
        learnedPatterns[word].totalUses++;
    });

    saveConversationData();
}

// Get learned suggestions
function getLearnedSuggestions(query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const suggestions = new Map();
    
    queryWords.forEach(word => {
        if (learnedPatterns[word]) {
            Object.entries(learnedPatterns[word].answers).forEach(([answer, count]) => {
                const score = count / learnedPatterns[word].totalUses;
                suggestions.set(answer, (suggestions.get(answer) || 0) + score);
            });
        }
    });
    
    return Array.from(suggestions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([answer]) => answer);
}

// Check report prefix
function checkReportPrefix(answer, prefix) {
    if (!answer || typeof answer !== 'string') return false;
    const reportName = answer.trim().split('\n')[0].split(' ').pop();
    return reportName.startsWith(prefix);
}

// Enhanced matching algorithm
function findBestMatch(query) {
    lastUserQuery = query;
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check for report prefix requirements
    const prefixMatch = normalizedQuery.match(/\b(report|reports)?\s*(?:start(?:ing)?|begin(?:ning)?|with)?\s*([A-Za-z]{2})[- ]?\b/i);
    const prefixRequirement = prefixMatch ? prefixMatch[2].toUpperCase() : null;
    
    // Get learned suggestions
    const learnedAnswers = getLearnedSuggestions(normalizedQuery);
    
    const matches = knowledgeBase.map(qa => {
        const question = qa.Question?.toLowerCase() || '';
        const answer = qa.Answer || '';
        let score = 0;
        
        // Prefix matching
        if (prefixRequirement) {
            if (!checkReportPrefix(answer, prefixRequirement)) {
                return { ...qa, score: 0 };
            }
            score += 2;
        }
        
        // Report type matching
        const isReportQuery = normalizedQuery.includes('report') || 
                            normalizedQuery.includes('start') ||
                            normalizedQuery.includes('begin');
                            
        if (isReportQuery && !answer.includes('.rpt')) {
            score -= 1;
        }
        
        // Exact phrase matching
        if (question.includes(normalizedQuery)) {
            score += 1.5;
        }
        
        // Word matching
        const queryWords = normalizedQuery.split(/\s+/);
        queryWords.forEach(word => {
            if (question.includes(word)) {
                score += 0.5;
            }
            // Check synonyms
            Object.entries(synonyms).forEach(([key, values]) => {
                if (values.includes(word) && question.includes(key)) {
                    score += 0.3;
                }
            });
        });
        
        // Boost score for learned answers
        if (learnedAnswers.includes(answer)) {
            score += 0.5;
        }
        
        return { ...qa, score };
    });

    const sortedMatches = matches
        .sort((a, b) => b.score - a.score)
        .filter(match => match.score > 0.3);
        
    const validMatches = prefixRequirement
        ? sortedMatches.filter(match => checkReportPrefix(match.Answer, prefixRequirement))
        : sortedMatches;

    return {
        bestMatch: validMatches.length > 0 ? validMatches[0] : null,
        suggestions: validMatches.slice(1, 3),
        debug: {
            prefixRequirement,
            learnedAnswers,
            totalMatches: validMatches.length
        }
    };
}

// Add message with feedback buttons
function addMessageWithFeedback(content, role, subject = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.style.whiteSpace = 'pre-wrap';
    messageDiv.textContent = content;
    
    if (subject) {
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-tag';
        subjectDiv.textContent = `Subject: ${subject}`;
        messageDiv.appendChild(subjectDiv);
    }

    if (role === 'bot' && content !== 'Loading knowledge base...') {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'feedback-buttons';
        
        const helpfulBtn = document.createElement('button');
        helpfulBtn.textContent = '👍 Helpful';
        helpfulBtn.onclick = () => {
            learnFromConversation(lastUserQuery, content, true);
            feedbackDiv.textContent = 'Thanks for your feedback! ✓';
        };
        
        const unhelpfulBtn = document.createElement('button');
        unhelpfulBtn.textContent = '👎 Not Helpful';
        unhelpfulBtn.onclick = () => {
            learnFromConversation(lastUserQuery, content, false);
            feedbackDiv.textContent = 'Thanks for your feedback! ✓';
        };
        
        feedbackDiv.appendChild(helpfulBtn);
        feedbackDiv.appendChild(unhelpfulBtn);
        messageDiv.appendChild(feedbackDiv);
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle sending messages
function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;
    
    addMessageWithFeedback(message, 'user');
    
    const { bestMatch, suggestions, debug } = findBestMatch(message);
    
    if (bestMatch) {
        if (bestMatch.Answer.includes('.rpt')) {
            const response = `Report Name: ${bestMatch.Answer}\n\n${bestMatch.Question}`;
            addMessageWithFeedback(response, 'bot', bestMatch.Subject);
        } else {
            addMessageWithFeedback(bestMatch.Answer, 'bot', bestMatch.Subject);
        }
        
        if (suggestions.length > 0) {
            setTimeout(() => {
                const suggestionText = "Related reports:\n" + 
                    suggestions.map((match, index) => 
                        `${index + 1}. ${match.Answer} - ${match.Question}`
                    ).join('\n');
                addMessageWithFeedback(suggestionText, 'bot', 'Related Reports');
            }, 500);
        }
    } else {
        if (debug.prefixRequirement) {
            addMessageWithFeedback(
                `I couldn't find any reports starting with '${debug.prefixRequirement}'. \n\n` +
                `Please verify the prefix or try a different report prefix.`,
                'bot',
                'No Matches Found'
            );
        } else {
            addMessageWithFeedback(
                "I couldn't find a matching answer. Please try:\n" +
                "1. Using different keywords\n" +
                "2. Being more specific about what you're looking for\n" +
                "3. Checking if you're using the correct report prefix",
                'bot',
                'Help'
            );
        }
    }
    
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
        
        userInput.disabled = false;
        sendButton.disabled = false;
        loadingMessage.style.display = 'none';
        
        addMessageWithFeedback('I\'m ready to help! You can ask me questions about:\n' +
                  '• Activities and Programs\n' +
                  '• Camper Information\n' +
                  '• Reports and Exports\n' +
                  '• System Setup and Configuration', 'bot');
        
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

// Add CSS styles for feedback buttons
const style = document.createElement('style');
style.textContent = `
    .feedback-buttons {
        display: flex;
        gap: 10px;
        margin-top: 5px;
    }
    
    .feedback-buttons button {
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 12px;
    }
    
    .feedback-buttons button:hover {
        background: #f0f0f0;
    }
`;
document.head.appendChild(style);

// Event listeners
sendButton.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

// Initialize
window.addEventListener('load', () => {
    loadConversationData();
    loadKnowledgeBase();
});
