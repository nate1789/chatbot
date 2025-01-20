// Initialize global variables
let knowledgeBase = [];
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

// Enhanced subject categories with weighted terms and related concepts
const categories = {
    'Activities': {
        terms: ['activity', 'program', 'session', 'schedule', 'event'],
        weight: 1.5,
        related: ['scheduling', 'registration', 'assignment', 'allocation'],
        context: ['before allocation', 'after allocation', 'master list', 'export']
    },
    'Camp Activities': {
        terms: ['activity', 'program', 'schedule', 'registration', 'camp'],
        weight: 1.3,
        related: ['export', 'report', 'list', 'setup'],
        context: ['selection', 'assignment', 'schedule']
    },
    'Master Setup': {
        terms: ['setup', 'configuration', 'settings', 'master', 'system'],
        weight: 1.4,
        related: ['initialize', 'configure', 'establish'],
        context: ['activities', 'program', 'system']
    },
    'Scheduling': {
        terms: ['schedule', 'time', 'date', 'period', 'slot', 'calendar'],
        weight: 1.2,
        related: ['activities', 'sessions', 'periods'],
        context: ['conflicts', 'availability', 'assignments']
    },
    'Registration': {
        terms: ['register', 'sign up', 'enroll', 'join', 'registration'],
        weight: 1.3,
        related: ['camper', 'activities', 'program'],
        context: ['process', 'status', 'confirmation']
    },
    'Reports': {
        terms: ['report', 'export', 'document', 'print', 'list'],
        weight: 1.6,
        related: ['excel', 'data', 'information'],
        context: ['before', 'after', 'master']
    }
};

// Natural language processing helper functions
function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1);
}

function expandTerms(words) {
    const expanded = new Set(words);
    
    // Add synonyms
    words.forEach(word => {
        Object.entries(synonyms).forEach(([key, values]) => {
            if (values.includes(word) || word === key) {
                expanded.add(key);
                values.forEach(synonym => expanded.add(synonym));
            }
        });
    });
    
    // Add category-related terms
    Object.values(categories).forEach(category => {
        const hasRelatedTerm = [...expanded].some(term => 
            category.terms.includes(term) || 
            category.related.includes(term)
        );
        
        if (hasRelatedTerm) {
            category.terms.forEach(term => expanded.add(term));
            category.related.forEach(term => expanded.add(term));
        }
    });
    
    return Array.from(expanded);
}

// Advanced matching algorithm
function findBestMatch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = tokenize(normalizedQuery);
    const expandedQueryWords = expandTerms(queryWords);
    
    const contextualMatches = knowledgeBase.map(qa => {
        const question = qa.Question?.toLowerCase() || '';
        const subject = qa.Subject?.toLowerCase() || '';
        let score = 0;
        let matchReason = [];

        // 1. Exact phrase matches (highest priority)
        if (question.includes(normalizedQuery)) {
            score += 4;
            matchReason.push('Exact phrase match');
        }

        // 2. Subject and category matching
        if (qa.Subject && categories[qa.Subject]) {
            const category = categories[qa.Subject];
            
            // Check if query matches category terms
            const categoryMatch = category.terms.some(term => expandedQueryWords.includes(term));
            if (categoryMatch) {
                score += category.weight;
                matchReason.push(`Category match: ${qa.Subject}`);
            }
            
            // Check context relevance
            const contextMatch = category.context.some(ctx => normalizedQuery.includes(ctx));
            if (contextMatch) {
                score += 0.8;
                matchReason.push('Context match');
            }
        }

        // 3. Word-by-word matching with expanded terms
        const questionWords = tokenize(question);
        let wordMatchCount = 0;
        
        expandedQueryWords.forEach(queryWord => {
            questionWords.forEach(questionWord => {
                if (queryWord === questionWord) {
                    score += 1;
                    wordMatchCount++;
                } else if (questionWord.includes(queryWord) || queryWord.includes(questionWord)) {
                    score += 0.5;
                    wordMatchCount++;
                }
            });
        });
        
        if (wordMatchCount > 0) {
            matchReason.push(`${wordMatchCount} word matches`);
        }

        // 4. Context analysis
        const questionContext = question.split(/[.!?]/).map(s => s.trim());
        const contextRelevance = questionContext.some(ctx => 
            expandedQueryWords.some(word => ctx.toLowerCase().includes(word))
        );
        
        if (contextRelevance) {
            score += 0.7;
            matchReason.push('Contextually relevant');
        }

        // 5. Score normalization and complexity adjustment
        const normalizedScore = score / (Math.log2(queryWords.length + 2));

        return {
            ...qa,
            score: normalizedScore,
            matchReason,
            debugInfo: {
                originalScore: score,
                normalizedScore,
                expandedTerms: expandedQueryWords,
                matchReasons: matchReason
            }
        };
    });

    // Enhanced result selection
    const sortedMatches = contextualMatches
        .sort((a, b) => b.score - a.score)
        .filter(match => match.score > 0.5);

    const bestMatch = sortedMatches[0];
    
    // Intelligent suggestion selection
    const suggestions = sortedMatches
        .filter(match => 
            match !== bestMatch && 
            match.score > bestMatch.score * 0.7 &&
            (match.Subject === bestMatch.Subject || 
             match.Question.toLowerCase().includes(normalizedQuery))
        )
        .slice(0, 2);

    return {
        bestMatch: bestMatch?.score > 0.5 ? bestMatch : null,
        suggestions,
        debug: bestMatch?.debugInfo
    };
}

// Enhanced message handling with better context and formatting
function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    
    // Generate response with debug info
    const { bestMatch, suggestions, debug } = findBestMatch(message);
    
    if (bestMatch) {
        // Format and add the main answer
        let answer = bestMatch.Answer;
        
        // Check if it's a report name (common pattern in your data)
        if (answer.endsWith('.rpt')) {
            answer = `Report Name: ${answer}\n\nThis report can be accessed in CampWise.`;
        }
        
        addMessage(answer, 'bot', bestMatch.Subject);
        
        // Log debug information
        if (debug) {
            console.debug('Match details:', {
                score: debug.normalizedScore,
                reasons: debug.matchReasons,
                expandedTerms: debug.expandedTerms
            });
        }
        
        // Add relevant suggestions with context
        if (suggestions.length > 0) {
            setTimeout(() => {
                const suggestionText = "Related information you might find helpful:\n\n" + 
                    suggestions.map((match, index) => 
                        `${index + 1}. ${match.Question}\n` +
                        `   → ${match.Answer}`
                    ).join('\n\n');
                
                addMessage(suggestionText, 'bot', 'Related Information');
            }, 500);
        }
    } else {
        const noMatchResponse = 
            "I couldn't find a specific match for your question. To help you better:\n\n" +
            "1. Try rephrasing your question with more specific terms\n" +
            "2. Specify the type of information you're looking for:\n" +
            "   • Activity management\n" +
            "   • Camper registration\n" +
            "   • Reports and exports\n" +
            "   • System setup\n\n" +
            "3. Or describe the specific task you're trying to accomplish";
        
        addMessage(noMatchResponse, 'bot', 'Help');
    }
    
    // Clear input
    userInput.value = '';
}

// Message display function
function addMessage(content, role, subject = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    // Format the content with proper line breaks
    const formattedContent = content.split('\n').map(line => {
        // Add proper indentation for bullet points and numbered lists
        if (line.match(/^\d+\./)) {
            return '  ' + line;
        } else if (line.match(/^•/)) {
            return '    ' + line;
        }
        return line;
    }).join('\n');
    
    // Use pre-wrap to preserve formatting
    messageDiv.style.whiteSpace = 'pre-wrap';
    messageDiv.textContent = formattedContent;
    
    if (subject) {
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-tag';
        subjectDiv.textContent = `Subject: ${subject}`;
        messageDiv.appendChild(subjectDiv);
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
        
        // Process and enhance the knowledge base entries
        knowledgeBase = knowledgeBase.map(entry => ({
            ...entry,
            tokens: tokenize(entry.Question + ' ' + entry.Subject)
        }));
        
        console.log('Knowledge base loaded:', knowledgeBase.length, 'entries');
        console.log('Sample entry:', knowledgeBase[0]);
        
        // Enable input once loaded
        userInput.disabled = false;
        sendButton.disabled = false;
        loadingMessage.style.display = 'none';
        
        addMessage('I\'m ready to help! You can ask me questions about:\n' +
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
