console.log('app.js loaded');

// Wrap everything in a function that runs after DOM is loaded
function initializeApp() {
    console.log('Initializing app');
    
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let isRecording = false;
    let currentTranscription = '';
    let currentProcessed = '';

    // DOM Elements
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const chatBox = document.getElementById('chatBox');
    const placeholderMessage = document.getElementById('placeholderMessage');
    const emailInput = document.getElementById('email');
    const status = document.getElementById('status');
    const processingControls = document.getElementById('processingControls');
    const navigationControls = document.getElementById('navigationControls');
    const viewTranscription = document.getElementById('viewTranscription');
    const viewProcessed = document.getElementById('viewProcessed');
    const summarizeButton = document.getElementById('summarizeButton');
    const bulletButton = document.getElementById('bulletButton');
    const tasksButton = document.getElementById('tasksButton');
    const emailTranscription = document.getElementById('emailTranscription');

    // Debug logging for element initialization
    console.log('Elements initialized:', {
        recordButton: !!recordButton,
        stopButton: !!stopButton,
        audioPreview: !!audioPreview,
        chatBox: !!chatBox
    });

    // Event Listeners
    if (recordButton) {
        console.log('Setting up record button');
        recordButton.addEventListener('click', startRecording);
    }
    if (stopButton) {
        console.log('Setting up stop button');
        stopButton.addEventListener('click', stopRecording);
    }

    // Processing buttons
    if (summarizeButton) {
        summarizeButton.addEventListener('click', () => processText('summary'));
    }
    if (bulletButton) {
        bulletButton.addEventListener('click', () => processText('bullets'));
    }
    if (tasksButton) {
        tasksButton.addEventListener('click', () => processText('tasks'));
    }

    // Navigation buttons
    if (viewTranscription) {
        viewTranscription.addEventListener('click', showTranscription);
    }
    if (viewProcessed) {
        viewProcessed.addEventListener('click', showProcessed);
    }

    // Email button
    if (emailTranscription) {
        emailTranscription.addEventListener('click', () => sendEmail(currentTranscription));
    }

    function createProcessingButtons() {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        const buttons = [
            {
                id: 'summarizeButton',
                icon: 'fa-compress-alt',
                text: 'Summarize',
                action: () => processText('summary')
            },
            {
                id: 'bulletButton',
                icon: 'fa-list',
                text: 'Bullet Points',
                action: () => processText('bullets')
            },
            {
                id: 'tasksButton',
                icon: 'fa-tasks',
                text: 'Extract Tasks',
                action: () => processText('tasks')
            },
            {
                id: 'emailTranscription',
                icon: 'fa-paper-plane',
                text: 'Email Transcription',
                action: () => sendEmail(currentTranscription)
            }
        ];
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.id = button.id;
            btn.className = 'btn-process';
            btn.innerHTML = `
                <i class="fas ${button.icon}"></i>
                <span>${button.text}</span>
            `;
            btn.addEventListener('click', button.action);
            actionsDiv.appendChild(btn);
        });
        
        return actionsDiv;
    }

    function addMessage(content, type, header) {
        // Remove placeholder if it exists
        if (placeholderMessage) {
            placeholderMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (header) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';
            headerDiv.textContent = header;
            messageDiv.appendChild(headerDiv);
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        messageDiv.appendChild(contentDiv);

        // Add processing buttons if this is a transcription message
        if (type === 'transcription') {
            const actionsDiv = createProcessingButtons();
            messageDiv.appendChild(actionsDiv);
        }
        
        chatBox.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
        return messageDiv;
    }

    async function startRecording() {
        console.log('Starting recording...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', async () => {
                console.log('Recording stopped, processing audio...');
                audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer.src = audioUrl;
                audioPreview.style.display = 'block';
                
                // Auto-transcribe after recording
                await transcribeAudio();
            });

            mediaRecorder.start();
            isRecording = true;
            recordButton.classList.add('recording');
            recordButton.disabled = true;
            stopButton.disabled = false;
            updateStatus('Recording...');
        } catch (error) {
            console.error('Error starting recording:', error);
            updateStatus('Error starting recording: ' + error.message);
        }
    }

    function stopRecording() {
        console.log('Stopping recording...');
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            recordButton.classList.remove('recording');
            recordButton.disabled = false;
            stopButton.disabled = true;
            updateStatus('Processing audio...');
        }
    }

    async function transcribeAudio() {
        if (!audioBlob) {
            console.error('No audio recorded');
            return;
        }

        updateStatus('Transcribing audio...');
        
        try {
            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
            });
            reader.readAsDataURL(audioBlob);
            const base64Audio = await base64Promise;

            const response = await fetch('/process-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audio: base64Audio
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                currentTranscription = data.transcription;
                addMessage(currentTranscription, 'transcription', 'Transcription');
                processingControls.style.display = 'block';
                updateStatus('Transcription complete');
            } else {
                throw new Error(data.message || 'Transcription failed');
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
            updateStatus('Error transcribing audio: ' + error.message);
        }
    }

    async function processText(type) {
        if (!currentTranscription) {
            updateStatus('No text to process');
            return;
        }

        updateStatus(`Processing text as ${type}...`);
        setLoading(true, `Processing ${type}...`);

        try {
            const response = await fetch('/process-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: currentTranscription,
                    type: type
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                currentProcessed = data.processed_text;
                addMessage(currentProcessed, 'processed', `${type.charAt(0).toUpperCase() + type.slice(1)} Result`);
                navigationControls.style.display = 'flex';
                updateStatus('Processing complete');
            } else {
                throw new Error(data.message || 'Processing failed');
            }
        } catch (error) {
            console.error('Error processing text:', error);
            updateStatus('Error processing text: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function showTranscription() {
        const transcriptionMessages = chatBox.querySelectorAll('.message.transcription');
        const processedMessages = chatBox.querySelectorAll('.message.processed');
        
        transcriptionMessages.forEach(msg => msg.style.display = 'block');
        processedMessages.forEach(msg => msg.style.display = 'none');
    }

    function showProcessed() {
        const transcriptionMessages = chatBox.querySelectorAll('.message.transcription');
        const processedMessages = chatBox.querySelectorAll('.message.processed');
        
        transcriptionMessages.forEach(msg => msg.style.display = 'none');
        processedMessages.forEach(msg => msg.style.display = 'block');
    }

    async function sendEmail(content) {
        const email = emailInput.value;
        if (!email) {
            updateStatus('Please enter an email address');
            return;
        }
        if (!content) {
            updateStatus('No content to send');
            return;
        }

        updateStatus('Sending email...');
        setLoading(true, 'Sending email...');

        try {
            const response = await fetch('/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    content: content
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            updateStatus('Email sent successfully');
        } catch (error) {
            console.error('Error sending email:', error);
            updateStatus('Error sending email: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function updateStatus(message) {
        console.log('Status:', message);
        if (status) {
            status.textContent = message;
        }
    }

    function setLoading(isLoading, loadingText = '') {
        document.body.classList.toggle('loading', isLoading);
        if (isLoading) {
            document.body.setAttribute('data-loading-text', loadingText);
        } else {
            document.body.removeAttribute('data-loading-text');
        }
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => button.disabled = isLoading);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
