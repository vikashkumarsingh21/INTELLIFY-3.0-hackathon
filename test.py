from ultralytics import YOLO
import pygame
import numpy as np
import threading
import time
import cv2
from flask import Flask, Response

pygame.mixer.init(frequency=44100, size=-16, channels=2)

def generate_siren(frequency=1000, duration_ms=500):
    sample_rate = 44100
    n_samples = int(sample_rate * duration_ms / 1000)
    t = np.linspace(0, duration_ms / 1000, n_samples, False)
    wave = 32767 * np.sin(2 * np.pi * frequency * t)
    stereo_wave = np.column_stack((wave, wave))
    return pygame.sndarray.make_sound(stereo_wave.astype(np.int16))

tone1 = generate_siren(800, 500)
tone2 = generate_siren(1200, 500)
tone1.set_volume(0.8)
tone2.set_volume(0.8)

alarm_playing = False
stop_siren = False

def siren_loop():
    global stop_siren
    while not stop_siren:
        tone1.play()
        time.sleep(0.5)
        tone1.stop()
        tone2.play()
        time.sleep(0.5)
        tone2.stop()

model = YOLO(r"testsoil\best (4).pt")
cap = cv2.VideoCapture(1)

app = Flask(__name__)

def generate_frames():
    global alarm_playing, stop_siren
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame)
        annotated_frame = results[0].plot()

        if len(results[0].boxes) > 0:
            if not alarm_playing:
                stop_siren = False
                threading.Thread(target=siren_loop, daemon=True).start()
                alarm_playing = True
        else:
            if alarm_playing:
                stop_siren = True
                alarm_playing = False
                tone1.stop()
                tone2.stop()

        _, buffer = cv2.imencode('.jpg', annotated_frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
