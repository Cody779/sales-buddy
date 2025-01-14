let mediaRecorder;
let audioChunks = [];

// Load email from localStorage if it exists
window.onload = function() {
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }
};

document.getElementById('recordButton').addEventListener('click', startRecording);
document.getElementById('stopButton').addEventListener('click', stopRecording);
document.getElementById('sendButton').addEventListener('click', sendAudioData);
document.getElementById('recordAgainButton').addEventListener('click', resetRecording);
document.getElementById('email').addEventListener('change', saveEmail);

function saveEmail(e) {
    localStorage.setItem('userEmail', e.target.value);
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            try {
                // Create blob with specific audio type for mobile compatibility
                const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audioPlayer = document.getElementById('audioPlayer');
                
                // Add error handling for audio playback
                audioPlayer.onerror = (e) => {
                    console.log('Audio playback error:', e);
                    document.getElementById('status').textContent = 
                        'Audio preview not available, but recording was successful';
                };

                audioPlayer.onloadeddata = () => {
                    document.getElementById('status').textContent = 'Recording ready for preview';
                };

                audioPlayer.src = audioUrl;
                document.getElementById('audioPreview').style.display = 'block';
            } catch (error) {
                console.error('Preview error:', error);
                document.getElementById('status').textContent = 
                    'Preview not available, but recording was successful';
            }
        };
        
        mediaRecorder.start(200); // Record in 200ms chunks for better compatibility
        document.getElementById('recordButton').disabled = true;
        document.getElementById('recordButton').classList.add('recording');
        document.getElementById('stopButton').disabled = false;
        document.getElementById('status').textContent = 'Recording...';
        document.getElementById('audioPreview').style.display = 'none';
    } catch (error) {
        document.getElementById('status').textContent = 'Error accessing microphone: ' + error.message;
        console.error('Recording error:', error);
    }
}

function stopRecording() {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    document.getElementById('recordButton').disabled = false;
    document.getElementById('recordButton').classList.remove('recording');
    document.getElementById('stopButton').disabled = true;
    document.getElementById('status').textContent = 'Recording complete. Review your audio below.';
}

function resetRecording() {
    audioChunks = [];
    document.getElementById('audioPreview').style.display = 'none';
    document.getElementById('status').textContent = '';
}

async function convertToMp3(audioBlob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
    const samples = new Int16Array(audioBuffer.length);
    const channel = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < channel.length; i++) {
        samples[i] = channel[i] * 0x7FFF;
    }
    
    const mp3Data = mp3Encoder.encodeBuffer(samples);
    const mp3Blob = new Blob([new Uint8Array(mp3Data)], { type: 'audio/mp3' });
    return mp3Blob;
}

async function sendAudioData() {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    
    document.getElementById('status').textContent = 'Processing...';
    document.getElementById('sendButton').disabled = true;
    
    try {
        const audioBlob = new Blob(audioChunks);
        const mp3Blob = await convertToMp3(audioBlob);
        const reader = new FileReader();
        
        reader.onloadend = async () => {
            try {
                const response = await fetch('/process-audio', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        audio: reader.result,
                        email: email
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to process audio');
                }
                
                const data = await response.json();
                document.getElementById('status').textContent = data.message;
                if (data.success) {
                    document.getElementById('audioPreview').style.display = 'none';
                    audioChunks = [];
                }
            } catch (error) {
                document.getElementById('status').textContent = 'Error: ' + error.message;
            }
        };
        
        reader.readAsDataURL(mp3Blob);
    } catch (error) {
        document.getElementById('status').textContent = 'Error converting audio: ' + error.message;
    } finally {
        document.getElementById('sendButton').disabled = false;
    }
}
