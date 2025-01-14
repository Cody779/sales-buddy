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
        
        // Try different MIME types
        const mimeTypes = [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/ogg',
            ''  // empty string lets browser choose best format
        ];
        
        let options = {};
        
        // Find the first supported MIME type
        for (let type of mimeTypes) {
            if (type && MediaRecorder.isTypeSupported(type)) {
                options.mimeType = type;
                break;
            }
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioPlayer = document.getElementById('audioPlayer');
            audioPlayer.src = audioUrl;
            audioPlayer.onerror = function() {
                document.getElementById('status').textContent = 'Audio preview not available on this device, but recording was successful.';
            };
            document.getElementById('audioPreview').style.display = 'block';
        };
        
        mediaRecorder.start();
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

async function sendAudioData() {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    
    document.getElementById('status').textContent = 'Processing...';
    document.getElementById('sendButton').disabled = true;
    
    const audioBlob = new Blob(audioChunks);
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
        } finally {
            document.getElementById('sendButton').disabled = false;
        }
    };
    
    reader.readAsDataURL(audioBlob);
}
