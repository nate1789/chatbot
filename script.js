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
