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

// Event Listeners
recordButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
transcribeButton.addEventListener('click', transcribeAudio);
recordAgainButton.addEventListener('click', resetRecording);
summarizeButton.addEventListener('click', () => processText('summary'));
bulletButton.addEventListener('click', () => processText('bullets'));
tasksButton.addEventListener('click', () => processText('tasks'));
sendButton.addEventListener('click', sendEmail);
startOverButton.addEventListener('click', startOver);

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            try {
                audioPlayer.src = audioUrl;
                audioPreview.style.display = 'block';
                previewMessage.style.display = 'none';
            } catch (e) {
                previewMessage.style.display = 'block';
            }
        };
        
        audioChunks = [];
        mediaRecorder.start();
        recordButton.classList.add('recording');
        updateButtonStates(true);
        updateStatus('Recording...');
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
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
    console.log('audioBlob:', audioBlob);
    
    if (!audioBlob) {
        updateStatus('No recording available to transcribe.');
        return;
    }

    updateStatus('Transcribing audio...');
    setLoading(true);

    try {
        // Convert audio blob to base64
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
        console.log('Audio converted to base64');
        
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
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
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

async function processText(type) {
    if (!transcriptionText.value) {
        updateStatus('No text to process.');
        return;
    }

    updateStatus(`Processing text as ${type}...`);
    setLoading(true);

    try {
        const response = await fetch('/process-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: transcriptionText.value,
                type: type
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
    statusDiv.textContent = message;
}

function setLoading(isLoading) {
    document.body.classList.toggle('loading', isLoading);
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => button.disabled = isLoading);
}
