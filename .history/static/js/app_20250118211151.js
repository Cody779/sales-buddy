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

        // Add email button (will be updated dynamically)
        const emailBtn = document.createElement('button');
        emailBtn.id = 'emailButton';
        emailBtn.className = 'btn-process';
        emailBtn.innerHTML = `
            <i class="fas fa-paper-plane"></i>
            <span>Email Transcription</span>
        `;
        emailBtn.addEventListener('click', () => {
            const messageDiv = chatBox.querySelector('.message.transcription');
            const isShowingTranscription = messageDiv?.classList.contains('show-transcription');
            const content = isShowingTranscription ? currentTranscription : currentProcessed;
            sendEmail(content);
        });
        actionsDiv.appendChild(emailBtn);
        
        return actionsDiv;
    }

    function addMessage(content, type, header) {
        // Remove placeholder if it exists
        if (placeholderMessage) {
            placeholderMessage.remove();
        }

        // If this is a processed result, add it to the existing message
        if (type === 'processed') {
            const existingMessage = chatBox.querySelector('.message.transcription');
            if (existingMessage) {
                existingMessage.classList.add('has-processed');
                // Remove the processing prompt if it exists
                const existingPrompt = existingMessage.querySelector('.processing-prompt');
                if (existingPrompt) {
                    existingPrompt.remove();
                }
                
                const processedContent = existingMessage.querySelector('.processed-content');
                if (processedContent) {
                    // Remove existing toggle button if present
                    const existingToggle = existingMessage.querySelector('.view-toggle');
                    if (existingToggle) {
                        existingToggle.remove();
                    }

                    // Update content
                    processedContent.textContent = content;
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'content-header';
                    headerDiv.textContent = header;
                    processedContent.insertBefore(headerDiv, processedContent.firstChild);

                    // Create button container
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'button-container';

                    // Create email button container and button
                    const emailContainer = document.createElement('div');
                    emailContainer.className = 'email-container';
                    const emailBtn = document.createElement('button');
                    emailBtn.className = 'btn-process';
                    emailBtn.innerHTML = `
                        <i class="fas fa-paper-plane"></i>
                        <span>Email ${header}</span>
                    `;
                    emailBtn.addEventListener('click', () => sendEmail(content));
                    emailContainer.appendChild(emailBtn);

                    // Create return button container and button
                    const returnContainer = document.createElement('div');
                    returnContainer.className = 'return-button-container';
                    const returnBtn = document.createElement('button');
                    returnBtn.className = 'return-button';
                    returnBtn.innerHTML = `
                        <i class="fas fa-undo"></i>
                        <span>Return to transcript</span>
                    `;
                    
                    // Add click handler for return button
                    returnBtn.addEventListener('click', () => {
                        // Remove show-transcription class first to reset state
                        existingMessage.classList.remove('show-transcription');
                        
                        // Remove button container
                        buttonContainer.remove();

                        // Remove existing actions div if present
                        const existingActionsDiv = existingMessage.querySelector('.message-actions');
                        if (existingActionsDiv) {
                            existingActionsDiv.remove();
                        }

                        // Remove has-processed class to reset the message state
                        existingMessage.classList.remove('has-processed');
                        
                        // Show the processing prompt first
                        const promptDiv = document.createElement('div');
                        promptDiv.className = 'processing-prompt';
                        promptDiv.innerHTML = '<i class="fas fa-magic"></i>How would you like your transcript processed?';
                        existingMessage.appendChild(promptDiv);

                        // Then create and add new processing buttons with fresh event listeners
                        const newActionsDiv = createProcessingButtons();
                        existingMessage.appendChild(newActionsDiv);
                    });
                    
                    returnContainer.appendChild(returnBtn);
                    
                    // Add both containers to the button container
                    buttonContainer.appendChild(emailContainer);
                    buttonContainer.appendChild(returnContainer);
                    
                    // Add button container to the message
                    existingMessage.appendChild(buttonContainer);

                    return existingMessage;
                }
            }
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (type === 'transcription') {
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'message-content-wrapper';

            // Transcription content
            const transcriptionContent = document.createElement('div');
            transcriptionContent.className = 'transcription-content';
            transcriptionContent.textContent = content;

            // Empty processed content (hidden initially)
            const processedContent = document.createElement('div');
            processedContent.className = 'processed-content';

            contentWrapper.appendChild(transcriptionContent);
            contentWrapper.appendChild(processedContent);
            messageDiv.appendChild(contentWrapper);

            // Add processing prompt
            const promptDiv = document.createElement('div');
            promptDiv.className = 'processing-prompt';
            promptDiv.innerHTML = '<i class="fas fa-magic"></i>How would you like your transcript processed?';
            messageDiv.appendChild(promptDiv);

            // Add processing buttons
            const actionsDiv = createProcessingButtons();
            messageDiv.appendChild(actionsDiv);
        } else {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);
        }
        
        chatBox.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
        return messageDiv;
    }

    async function startRecording() {
        console.log('Starting recording...');

        // Check if there's an existing transcription
        const existingMessage = chatBox.querySelector('.message.transcription');
        if (existingMessage) {
            const confirmNew = confirm('This will replace your existing transcription. Do you want to continue?');
            if (!confirmNew) {
                return;
            }
            // Remove existing transcription if user confirms
            existingMessage.remove();
        }

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
                
                // Create a temporary audio element to get duration
                const tempAudio = new Audio(audioUrl);
                tempAudio.addEventListener('loadedmetadata', () => {
                    // Format duration
                    const duration = tempAudio.duration;
                    const minutes = Math.floor(duration / 60);
                    const seconds = Math.floor(duration % 60);
                    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    // Set the audio source and show preview
                    audioPlayer.src = audioUrl;
                    audioPreview.style.display = 'block';
                    
                    // Force the time display to update
                    const timeDisplay = audioPlayer.parentElement.querySelector('time');
                    if (timeDisplay) {
                        timeDisplay.textContent = formattedTime;
                    }
                });
                
                // Auto-transcribe after recording
                await transcribeAudio();
            });

            mediaRecorder.start();
            isRecording = true;
            recordButton.classList.add('recording');
            recordButton.disabled = true;
            stopButton.disabled = false;
            updateStatus('Recording...');
            
            // Reset current transcription and processed text
            currentTranscription = '';
            currentProcessed = '';
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
            if (message) {
                status.textContent = message;
                status.style.display = 'block';
            } else {
                status.textContent = '';
                status.style.display = 'none';
            }
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
