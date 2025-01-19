console.log('app.js loaded');

// Wrap everything in a function that runs after DOM is loaded
function initializeApp() {
    console.log('Initializing app');
    
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let isRecording = false;

    // DOM Elements
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const contentArea = document.getElementById('contentArea');
    const transcriptionText = document.getElementById('transcriptionText');
    const processedText = document.getElementById('processedText');
    const emailInput = document.getElementById('email');
    const status = document.getElementById('status');
    const summarizeButton = document.getElementById('summarizeButton');
    const bulletButton = document.getElementById('bulletButton');
    const tasksButton = document.getElementById('tasksButton');
    const emailTranscription = document.getElementById('emailTranscription');
    const emailProcessed = document.getElementById('emailProcessed');

    // Debug logging for element initialization
    console.log('Elements initialized:', {
        recordButton: !!recordButton,
        stopButton: !!stopButton,
        audioPreview: !!audioPreview,
        contentArea: !!contentArea
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

    // Email buttons
    if (emailTranscription) {
        emailTranscription.addEventListener('click', () => sendEmail(transcriptionText.value));
    }
    if (emailProcessed) {
        emailProcessed.addEventListener('click', () => sendEmail(processedText.value));
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
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            transcriptionText.value = data.text;
            contentArea.style.display = 'flex';
            updateStatus('Transcription complete');
        } catch (error) {
            console.error('Error transcribing audio:', error);
            updateStatus('Error transcribing audio: ' + error.message);
        }
    }

    async function processText(type) {
        if (!transcriptionText.value) {
            updateStatus('No text to process');
            return;
        }

        updateStatus(`Processing text as ${type}...`);
        setLoading(true, `Processing ${type}...`);

        try {
            const response = await fetch('/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: transcriptionText.value,
                    type: type
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            processedText.value = data.result;
            updateStatus('Processing complete');
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
            const response = await fetch('/send_email', {
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
