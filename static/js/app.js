console.log('app.js loaded');

// Wrap everything in a function that runs after DOM is loaded
function initializeApp() {
    console.log('Initializing app');
    
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;

    // DOM Elements
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const previewMessage = document.querySelector('.preview-message');
    const transcribeButton = document.getElementById('transcribeButton');
    const recordAgainButton = document.getElementById('recordAgainButton');
    const emailInput = document.getElementById('email');
    const statusDiv = document.getElementById('status');
    const textProcessing = document.getElementById('textProcessing');
    const transcriptionText = document.getElementById('transcriptionText');
    const processedText = document.getElementById('processedText');
    const summarizeButton = document.getElementById('summarizeButton');
    const bulletButton = document.getElementById('bulletButton');
    const tasksButton = document.getElementById('tasksButton');
    const sendButton = document.getElementById('sendButton');
    const startOverButton = document.getElementById('startOverButton');

    // Debug logging for element initialization
    console.log('Elements initialized:', {
        recordButton: !!recordButton,
        stopButton: !!stopButton,
        transcribeButton: !!transcribeButton,
        audioPreview: !!audioPreview
    });

    // Test click handler
    if (transcribeButton) {
        console.log('Setting up transcribe button click handler');
        transcribeButton.addEventListener('click', function(e) {
            console.log('Transcribe button clicked');
            e.preventDefault();
            e.stopPropagation();
            transcribeAudio();
        });
    } else {
        console.error('Transcribe button not found');
    }

    // Event Listeners
    if (recordButton) {
        console.log('Setting up record button');
        recordButton.addEventListener('click', startRecording);
    }
    if (stopButton) {
        console.log('Setting up stop button');
        stopButton.addEventListener('click', stopRecording);
    }
    if (recordAgainButton) recordAgainButton.addEventListener('click', resetRecording);
    if (summarizeButton) summarizeButton.addEventListener('click', () => {
        hideAllStyleSelects();
        summaryStyle.style.display = 'block';
        processText('summary', summaryStyle.value);
    });
    if (bulletButton) bulletButton.addEventListener('click', () => {
        hideAllStyleSelects();
        bulletStyle.style.display = 'block';
        processText('bullets', bulletStyle.value);
    });
    if (tasksButton) tasksButton.addEventListener('click', () => {
        hideAllStyleSelects();
        taskStyle.style.display = 'block';
        processText('tasks', taskStyle.value);
    });
    if (sendButton) sendButton.addEventListener('click', sendEmail);
    if (startOverButton) startOverButton.addEventListener('click', startOver);

    // Initialize button states
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM Content Loaded');
        updateButtonStates(false);
    });

    async function startRecording() {
        try {
            console.log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            console.log('Microphone access granted');
            
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
                audioBitsPerSecond: 128000
            });
            
            console.log('MediaRecorder initialized with settings:', {
                mimeType: mediaRecorder.mimeType,
                state: mediaRecorder.state
            });
            
            mediaRecorder.ondataavailable = (event) => {
                console.log('Data available from MediaRecorder, size:', event.data.size);
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                console.log('MediaRecorder stopped, creating blob...');
                const mimeType = mediaRecorder.mimeType;
                audioBlob = new Blob(audioChunks, { type: mimeType });
                console.log('Audio blob created:', {
                    type: audioBlob.type,
                    size: audioBlob.size
                });
                
                const audioUrl = URL.createObjectURL(audioBlob);
                try {
                    // Create a temporary audio element to get duration
                    const tempAudio = new Audio();
                    
                    // Wait for metadata to load before setting the player source
                    await new Promise((resolve, reject) => {
                        tempAudio.addEventListener('loadedmetadata', () => {
                            console.log('Audio duration:', tempAudio.duration);
                            resolve();
                        });
                        tempAudio.addEventListener('error', (e) => {
                            console.error('Error loading audio metadata:', e);
                            reject(e);
                        });
                        tempAudio.src = audioUrl;
                    });
                    
                    // Now set the actual player source
                    audioPlayer.src = audioUrl;
                    
                    // Force a reload and wait for metadata
                    await new Promise((resolve) => {
                        audioPlayer.addEventListener('loadedmetadata', () => {
                            console.log('Player duration:', audioPlayer.duration);
                            resolve();
                        }, { once: true });
                        audioPlayer.load();
                    });
                    
                    audioPreview.style.display = 'block';
                    previewMessage.style.display = 'none';
                    
                    // Update time display
                    const duration = audioPlayer.duration;
                    console.log('Final duration:', duration);
                    
                    // Add timeupdate listener for progress
                    audioPlayer.addEventListener('timeupdate', () => {
                        const currentTime = audioPlayer.currentTime;
                        const progress = (currentTime / duration) * 100;
                        console.log('Progress:', progress + '%');
                    });
                    
                } catch (e) {
                    console.error('Error setting up audio player:', e);
                    previewMessage.style.display = 'block';
                }
            };
            
            audioChunks = [];
            mediaRecorder.start(1000); // Collect data every second
            console.log('MediaRecorder started');
            recordButton.classList.add('recording');
            updateButtonStates(true);
            updateStatus('Recording...');
            
        } catch (err) {
            console.error('Detailed error accessing microphone:', err);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            updateStatus('Error accessing microphone. Please ensure you have granted permission.');
        }
    }

    function stopRecording() {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        recordButton.classList.remove('recording');
        updateButtonStates(false);
        updateStatus('Recording stopped. Ready to transcribe.');
        setTimeout(() => {
            transcribeButton.disabled = false;
        }, 500);
    }

    function resetRecording() {
        audioChunks = [];
        audioBlob = null;
        audioPreview.style.display = 'none';
        textProcessing.style.display = 'none';
        updateButtonStates(false);
        transcribeButton.disabled = true;
        updateStatus('');
    }

    function startOver() {
        resetRecording();
        transcriptionText.value = '';
        processedText.value = '';
        emailInput.value = '';
    }

    async function transcribeAudio() {
        console.log('transcribeAudio function called');
        console.log('audioBlob:', audioBlob ? {
            type: audioBlob.type,
            size: audioBlob.size
        } : 'No audio blob');
        
        if (!audioBlob) {
            console.log('No audio blob available');
            updateStatus('No recording available to transcribe.');
            return;
        }

        updateStatus('Transcribing audio...');
        setLoading(true);

        try {
            const reader = new FileReader();
            console.log('Created FileReader');
            
            const readerPromise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    console.log('FileReader loadend event fired');
                    resolve(reader.result);
                };
                reader.onerror = () => {
                    console.error('FileReader error:', reader.error);
                    reject(reader.error);
                };
            });
            
            console.log('Starting to read audio blob');
            reader.readAsDataURL(audioBlob);
            const base64Audio = await readerPromise;
            console.log('Audio converted to base64, length:', base64Audio.length);
            
            const apiUrl = window.location.origin + '/process-audio';
            console.log('Sending request to:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio: base64Audio
                })
            });

            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                transcriptionText.value = data.transcription;
                textProcessing.style.display = 'block';
                updateStatus('Audio transcribed successfully! You can now process the text.');
            } else {
                throw new Error(data.message || 'Transcription failed');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            updateStatus('Error transcribing audio: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    async function processText(type, style) {
        if (!transcriptionText.value) {
            updateStatus('No text to process.');
            return;
        }

        const loadingMessages = {
            summary: [
                "Analyzing content...",
                "Identifying key points...",
                "Crafting concise summary...",
                "Finalizing your summary..."
            ],
            bullets: [
                "Analyzing content...",
                "Organizing information...",
                "Creating bullet points...",
                "Structuring your points..."
            ],
            tasks: [
                "Analyzing content...",
                "Identifying action items...",
                "Extracting tasks...",
                "Organizing your task list..."
            ]
        };

        const messages = loadingMessages[type] || loadingMessages.summary;
        let messageIndex = 0;

        updateStatus(`Processing text as ${type}...`);
        setLoading(true, messages[0]);

        // Start message rotation
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingText(messages[messageIndex]);
        }, 2000);

        try {
            const response = await fetch('/process-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: transcriptionText.value,
                    type: type,
                    style: style
                })
            });

            const data = await response.json();
            
            if (data.success) {
                processedText.value = data.processed_text;
                updateStatus('Text processed successfully!');
            } else {
                updateStatus('Error processing text: ' + data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            updateStatus('Error processing text. Please try again.');
        } finally {
            clearInterval(messageInterval);
            setLoading(false);
        }
    }

    async function sendEmail() {
        const email = emailInput.value;
        const content = processedText.value || transcriptionText.value;

        if (!email) {
            updateStatus('Please enter an email address.');
            return;
        }

        if (!content) {
            updateStatus('No content to send.');
            return;
        }

        updateStatus('Sending email...');
        setLoading(true);

        try {
            const response = await fetch('/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    content: content
                })
            });

            const data = await response.json();
            
            if (data.success) {
                updateStatus('Email sent successfully!');
                setTimeout(startOver, 3000);
            } else {
                updateStatus('Error sending email: ' + data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            updateStatus('Error sending email. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function updateButtonStates(isRecording) {
        recordButton.disabled = isRecording;
        stopButton.disabled = !isRecording;
        transcribeButton.disabled = isRecording;
        
        if (!isRecording && audioBlob) {
            transcribeButton.disabled = false;
        } else {
            transcribeButton.disabled = true;
        }
    }

    function updateStatus(message) {
        if (statusDiv) {
            statusDiv.textContent = message;
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

    function setLoadingText(text) {
        if (document.body.classList.contains('loading')) {
            document.body.setAttribute('data-loading-text', text);
        }
    }

    // Add style select elements
    const summaryStyle = document.getElementById('summaryStyle');
    const bulletStyle = document.getElementById('bulletStyle');
    const taskStyle = document.getElementById('taskStyle');

    // Show/hide appropriate style select when buttons are clicked
    summarizeButton.addEventListener('click', () => {
        hideAllStyleSelects();
        summaryStyle.style.display = 'block';
        processText('summary', summaryStyle.value);
    });

    bulletButton.addEventListener('click', () => {
        hideAllStyleSelects();
        bulletStyle.style.display = 'block';
        processText('bullets', bulletStyle.value);
    });

    tasksButton.addEventListener('click', () => {
        hideAllStyleSelects();
        taskStyle.style.display = 'block';
        processText('tasks', taskStyle.value);
    });

    function hideAllStyleSelects() {
        summaryStyle.style.display = 'none';
        bulletStyle.style.display = 'none';
        taskStyle.style.display = 'none';
    }
}

// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
