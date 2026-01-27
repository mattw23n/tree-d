from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from dotenv import load_dotenv
import os

load_dotenv()
client = ElevenLabs(
    api_key=os.getenv("eleven_api_key")
)

print("Waiting for ElevenLabs TTS response...", flush=True)

audio = client.text_to_speech.convert(
    text="The first move is what sets everything in motion.",
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_flash_v2_5", # This is for faster generation
    # model_id="eleven_multilingual_v2", # This guy sounds better but long to generate
    output_format="mp3_44100_128",
)

print("Got audio from ElevenLabs. So listen you fuck", flush=True)

play(audio) # This is not streaming it, but elevenlabs has a streaming api for that

print("Done. Your dumb ass should have heard the message.", flush=True)