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
    let recordingStartTime;
    let recordingDuration = 0;
    let recordingTimer;

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
        // Remove any existing placeholder messages
        const existingPlaceholders = chatBox.querySelectorAll('.message.placeholder');
        existingPlaceholders.forEach(placeholder => placeholder.remove());

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
                        // Show audio preview and recording controls
                        audioPreview.style.display = 'block';
                        document.querySelector('.recording-controls').style.display = 'flex';
                        
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
            existingMessage.remove();
        }
        
        // Remove any existing placeholder messages first
        const existingPlaceholders = chatBox.querySelectorAll('.message.placeholder');
        existingPlaceholders.forEach(placeholder => placeholder.remove());
        
        // Add new placeholder message
        const placeholder = document.createElement('div');
        placeholder.id = 'placeholderMessage';
        placeholder.className = 'message placeholder';
        placeholder.textContent = 'Your recorded transcription will appear here';
        chatBox.appendChild(placeholder);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            // Reset and start recording timer
            recordingStartTime = Date.now();
            recordingDuration = 0;
            
            // Create or update recording duration display
            audioPreview.innerHTML = `
                <div class="custom-audio-player recording-duration">
                    <div class="audio-controls">
                        <div class="time-display">
                            <span class="current-time">0:00</span>
                        </div>
                    </div>
                </div>
            `;
            audioPreview.style.display = 'block';
            
            // Update duration display every second
            const durationDisplay = audioPreview.querySelector('.current-time');
            recordingTimer = setInterval(() => {
                recordingDuration = (Date.now() - recordingStartTime) / 1000;
                const minutes = Math.floor(recordingDuration / 60);
                const seconds = Math.floor(recordingDuration % 60);
                durationDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }, 100);

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', async () => {
                console.log('Recording stopped, processing audio...');
                clearInterval(recordingTimer);
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                try {
                    // Create custom player with known duration
                    const minutes = Math.floor(recordingDuration / 60);
                    const seconds = Math.floor(recordingDuration % 60);
                    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    const customPlayer = document.createElement('div');
                    customPlayer.className = 'custom-audio-player';
                    customPlayer.innerHTML = `
                        <div class="audio-controls">
                            <button class="play-button">
                                <i class="fas fa-play"></i>
                            </button>
                            <div class="time-display">
                                <span class="current-time">0:00</span>
                                <span>/</span>
                                <span class="duration">${formattedDuration}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress"></div>
                            </div>
                        </div>
                        <audio style="display: none;"></audio>
                    `;
                    
                    audioPreview.innerHTML = '';
                    audioPreview.appendChild(customPlayer);
                    
                    const audioElement = customPlayer.querySelector('audio');
                    const playButton = customPlayer.querySelector('.play-button');
                    const currentTimeDisplay = customPlayer.querySelector('.current-time');
                    const progressBar = customPlayer.querySelector('.progress-bar');
                    const progress = customPlayer.querySelector('.progress');
                    
                    audioElement.src = audioUrl;
                    
                    playButton.addEventListener('click', () => {
                        if (audioElement.paused) {
                            audioElement.play();
                            playButton.innerHTML = '<i class="fas fa-pause"></i>';
                        } else {
                            audioElement.pause();
                            playButton.innerHTML = '<i class="fas fa-play"></i>';
                        }
                    });
                    
                    audioElement.addEventListener('timeupdate', () => {
                        const currentTime = audioElement.currentTime;
                        const minutes = Math.floor(currentTime / 60);
                        const seconds = Math.floor(currentTime % 60);
                        currentTimeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        
                        const progressPercent = (currentTime / recordingDuration) * 100;
                        progress.style.width = `${progressPercent}%`;
                    });
                    
                    progressBar.addEventListener('click', (e) => {
                        const rect = progressBar.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        audioElement.currentTime = percent * recordingDuration;
                    });

                    console.log('Audio player setup complete');
                } catch (error) {
                    console.error('Error setting up audio player:', error);
                    updateStatus('Error setting up audio player: ' + error.message);
                }
                
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
            clearInterval(recordingTimer);
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
                // Hide audio preview and recording controls
                audioPreview.style.display = 'none';
                document.querySelector('.recording-controls').style.display = 'none';
                
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
