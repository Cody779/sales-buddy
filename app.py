from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os
from dotenv import load_dotenv
import base64
from flask_cors import CORS
import time

load_dotenv()

app = Flask(__name__)
CORS(app)
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
app.debug = True

# Create or get assistant
def get_or_create_assistant():
    # First, try to get existing assistant from environment variable
    assistant_id = os.getenv('OPENAI_ASSISTANT_ID')
    if assistant_id:
        try:
            return client.beta.assistants.retrieve(assistant_id)
        except:
            pass
    
    # Create new assistant if none exists
    assistant = client.beta.assistants.create(
        name="Sales Buddy Assistant",
        instructions="""You are a specialized assistant for processing sales and business-related transcriptions. Your role is to make the content more organized and actionable.

For summaries:
- Focus on key business points, decisions, and action items
- Maintain a professional tone
- Highlight any monetary values, dates, or deadlines mentioned
- Keep the summary concise but comprehensive
- Include any specific numbers or metrics mentioned

For bullet points:
- Start with the most important information
- Group related points together
- Use consistent formatting
- Highlight key stakeholders and their responsibilities
- Include specific details like numbers, dates, and deadlines
- Separate facts from action items

For task extraction:
- Begin each task with an action verb
- Include deadlines if mentioned
- Assign responsibilities if specified
- Prioritize tasks if priority is indicated
- Include any relevant context with each task
- Format as an actionable to-do list
- Add due dates in [brackets] if mentioned

Always maintain accuracy and context while making the content more structured and actionable.""",
        model="gpt-4-1106-preview"
    )
    return assistant

assistant = get_or_create_assistant()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process-audio', methods=['POST'])
def process_audio():
    print("Process audio endpoint called")  # Debug log
    try:
        data = request.json
        print("Received request data:", bool(data))  # Debug log
        
        audio_data = data['audio']
        print("Got audio data, length:", len(audio_data))  # Debug log
        
        # Convert base64 audio to bytes
        audio_bytes = base64.b64decode(audio_data.split(',')[1])
        print("Decoded base64 data, size:", len(audio_bytes))  # Debug log
        
        # Create a BytesIO object instead of writing to disk
        from io import BytesIO
        audio_file = BytesIO(audio_bytes)
        audio_file.name = 'audio.mp3'  # Whisper needs a filename
        print("Created BytesIO object")  # Debug log
        
        # Transcribe audio using OpenAI
        print("Starting OpenAI transcription...")  # Debug log
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
        print("Transcription completed:", bool(transcript))  # Debug log
        
        return jsonify({
            'success': True, 
            'transcription': transcript.text
        })
    
    except Exception as e:
        print(f"Error in process_audio: {str(e)}")  # Add logging
        import traceback
        print("Full error:", traceback.format_exc())  # Print full stack trace
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/process-text', methods=['POST'])
def process_text():
    try:
        data = request.json
        text = data['text']
        process_type = data['type']  # 'summary', 'bullets', or 'tasks'
        
        # Create a thread
        thread = client.beta.threads.create()
        
        # Add the message to the thread with specific instructions
        instructions = {
            'summary': """Create a concise but comprehensive summary focusing on:
                - Key business decisions and outcomes
                - Important numbers and metrics
                - Action items and next steps
                - Deadlines and timelines
                Format the summary in clear paragraphs.""",
            'bullets': """Convert this text into clear, organized bullet points:
                - Group related points together
                - Start with key decisions
                - Follow with supporting details
                - End with next steps
                Use consistent bullet formatting.""",
            'tasks': """Extract and list all actionable items:
                - Start each task with an action verb
                - Include [deadlines] in brackets
                - Note responsible parties in (parentheses)
                - Prioritize tasks if indicated
                Format as a clear to-do list."""
        }.get(process_type)
        
        message = client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Process this text as {process_type} with these instructions: {instructions}\n\nText: {text}"
        )
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant.id,
            instructions=instructions
        )
        
        # Wait for completion
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            if run_status.status == 'completed':
                break
            elif run_status.status == 'failed':
                raise Exception("Processing failed")
            time.sleep(1)
        
        # Get the assistant's response
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        assistant_message = next(msg for msg in messages if msg.role == "assistant")
        processed_text = assistant_message.content[0].text.value
        
        return jsonify({
            'success': True,
            'processed_text': processed_text
        })
        
    except Exception as e:
        print(f"Error in process_text: {str(e)}")  # Add logging
        import traceback
        print("Full error:", traceback.format_exc())  # Print full stack trace
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/send-email', methods=['POST'])
def send_email():
    try:
        data = request.json
        email = data['email']
        content = data['content']
        
        # Send email using SendGrid
        message = Mail(
            from_email=os.getenv('SENDGRID_FROM_EMAIL'),
            to_emails=email,
            subject='Your Processed Voice Memo',
            plain_text_content=content)
        
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        
        return jsonify({'success': True, 'message': 'Content sent to your email!'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8080)))
