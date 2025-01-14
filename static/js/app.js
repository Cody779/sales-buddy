let mediaRecorder;
let audioChunks = [];

document.getElementById('recordButton').addEventListener('click', startRecording);
document.getElementById('stopButton').addEventListener('click', stopRecording);
document.getElementById('sendButton').addEventListener('click', sendAudioData);
document.getElementById('recordAgainButton').addEventListener('click', resetRecording);
document.getElementById('email').addEventListener('change', saveEmail);

// Load email from localStorage if it exists
window.onload = function() {
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }
};

function saveEmail(e) {
    localStorage.setItem('userEmail', e.target.value);
}

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Specify the mime type explicitly for better mobile compatibility
    const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
    };
    
    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        // Fallback for iOS
        mediaRecorder = new MediaRecorder(stream);
    }
    
    mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = audioUrl;
        document.getElementById('audioPreview').style.display = 'block';
    };
    
    mediaRecorder.start();
    document.getElementById('recordButton').disabled = true;
    document.getElementById('recordButton').classList.add('recording');
    document.getElementById('stopButton').disabled = false;
    document.getElementById('status').textContent = 'Recording...';
    document.getElementById('audioPreview').style.display = 'none';
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
    
    // Create a new blob with explicit type
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
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
