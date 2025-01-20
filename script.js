let knowledgeBase = [];
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingMessage = document.getElementById('loading-message');

async function loadKnowledgeBase() {
    try {
        console.log('1. Starting to load knowledge base...');
        loadingMessage.textContent = 'Starting to load...';
        
        // Log the full URL we're trying to access
        const fullUrl = window.location.origin + '/chatbot/data/ExportedReport.xlsx';
        console.log('2. Attempting to fetch from:', fullUrl);
        
        const response = await fetch(fullUrl);
        console.log('3. Fetch response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('4. Converting response to array buffer...');
        loadingMessage.textContent = 'Reading file data...';
        const arrayBuffer = await response.arrayBuffer();
        
        console.log('5. Converting to Uint8Array...');
        const data = new Uint8Array(arrayBuffer);
        console.log('6. Data length:', data.length);
        
        console.log('7. Parsing Excel file...');
        loadingMessage.textContent = 'Parsing Excel data...';
        const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true,
            cellNF: true,
            cellText: true
        });
        
        console.log('8. Available sheets:', workbook.SheetNames);
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        console.log('9. Converting sheet to JSON...');
        knowledgeBase = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('10. Knowledge base loaded:', knowledgeBase.length, 'entries');
        console.log('11. Sample entry:', knowledgeBase[0]);
        
        // Enable input once loaded
        userInput.disabled = false;
        sendButton.disabled = false;
        loadingMessage.style.display = 'none';
        
        addMessage(`Ready! ${knowledgeBase.length} answers loaded.`, 'bot');
        
    } catch (error) {
        console.error('Loading error:', error);
        console.error('Error stack:', error.stack);
        loadingMessage.innerHTML = `
            <div style="color: #721c24; background: #f8d7da; padding: 15px; border-radius: 5px; text-align: left;">
                <strong>Error loading knowledge base</strong><br>
                Error details: ${error.message}<br><br>
                Debug info:<br>
                - URL: ${window.location.href}<br>
                - Origin: ${window.location.origin}<br>
                - Path: ${window.location.pathname}<br><br>
                Please check the console (F12) and share the error details.
            </div>
        `;
    }
}

// Rest of your code remains the same...

// Initialize loading
console.log('0. Script initialized');
loadKnowledgeBase();
