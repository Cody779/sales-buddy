from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os
from dotenv import load_dotenv
import base64

load_dotenv()

app = Flask(__name__)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        audio_data = data['audio']
        email = data['email']
        
        # Convert base64 audio to file
        audio_bytes = base64.b64decode(audio_data.split(',')[1])
        with open('temp_audio.webm', 'wb') as f:
            f.write(audio_bytes)
        
        # Transcribe audio using OpenAI
        with open('temp_audio.webm', 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        # Send email using SendGrid
        message = Mail(
            from_email='codyjgander@gmail.com',  # Replace with your verified SendGrid sender
            to_emails=email,
            subject='Your Voice Memo Transcription',
            plain_text_content=transcript.text)
        
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        
        # Clean up temporary file
        os.remove('temp_audio.webm')
        
        return jsonify({'success': True, 'message': 'Transcription sent to your email!'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
