import os
import base64
import csv
import sqlite3
import threading
from datetime import datetime, date

import cv2
import numpy as np
import face_recognition
from flask import Flask, request, jsonify, send_from_directory, send_file

# ---------------------------------------------------------------------------
# Path configuration
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(PROJECT_DIR, 'frontend')
DATASET_DIR = os.path.join(PROJECT_DIR, 'dataset')
DB_PATH = os.path.join(PROJECT_DIR, 'attendance.db')
CSV_PATH = os.path.join(PROJECT_DIR, 'attendance.csv')

# Ensure dataset directory exists
os.makedirs(DATASET_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

# ---------------------------------------------------------------------------
# Thread-safe face data
# ---------------------------------------------------------------------------
known_face_encodings = []
known_face_names = []
face_data_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    """Return a new SQLite connection with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the attendance table if it does not exist."""
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# Dataset / encoding helpers
# ---------------------------------------------------------------------------

def load_dataset():
    """Scan dataset/ for jpg/png images, compute face encodings."""
    global known_face_encodings, known_face_names

    encodings = []
    names = []

    for filename in os.listdir(DATASET_DIR):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            filepath = os.path.join(DATASET_DIR, filename)
            image = face_recognition.load_image_file(filepath)
            face_encs = face_recognition.face_encodings(image)
            if face_encs:
                encodings.append(face_encs[0])
                name = os.path.splitext(filename)[0]
                names.append(name)

    with face_data_lock:
        known_face_encodings = encodings
        known_face_names = names

    print(f"[INFO] Loaded {len(names)} face(s) from dataset.")

# ---------------------------------------------------------------------------
# Image decoding helper
# ---------------------------------------------------------------------------

def decode_base64_image(data_url):
    """Decode a base64 data-URL (or raw base64) string into a NumPy image."""
    if ',' in data_url:
        # data:image/...;base64,<payload>
        data_url = data_url.split(',', 1)[1]

    img_bytes = base64.b64decode(data_url)
    np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return image

# ---------------------------------------------------------------------------
# Attendance helpers
# ---------------------------------------------------------------------------

def mark_attendance(name):
    """Insert attendance record if not already marked today. Also append to CSV."""
    today = date.today().isoformat()
    now = datetime.now().strftime('%H:%M:%S')

    conn = get_db()
    # Check for duplicate
    existing = conn.execute(
        'SELECT id FROM attendance WHERE name = ? AND date = ?',
        (name, today)
    ).fetchone()

    if existing:
        conn.close()
        return False  # already marked

    conn.execute(
        'INSERT INTO attendance (name, date, time) VALUES (?, ?, ?)',
        (name, today, now)
    )
    conn.commit()
    conn.close()

    # Append to CSV
    file_exists = os.path.isfile(CSV_PATH)
    with open(CSV_PATH, 'a', newline='') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['Name', 'Date', 'Time'])
        writer.writerow([name, today, now])

    return True

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    """Serve the frontend index.html."""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/api/register', methods=['POST'])
def register():
    """Register a new face in the dataset."""
    data = request.get_json(force=True)
    name = data.get('name', '').strip()
    image_data = data.get('image', '')

    if not name:
        return jsonify(success=False, message='Name is required.'), 400
    if not image_data:
        return jsonify(success=False, message='Image is required.'), 400

    # Decode image
    image = decode_base64_image(image_data)
    if image is None:
        return jsonify(success=False, message='Invalid image data.'), 400

    # Convert BGR → RGB for face_recognition
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_image)

    if len(face_locations) == 0:
        return jsonify(success=False, message='No face detected in the image.'), 400
    if len(face_locations) > 1:
        return jsonify(success=False, message='Multiple faces detected. Please provide an image with a single face.'), 400

    # Save image
    save_path = os.path.join(DATASET_DIR, f'{name}.jpg')
    cv2.imwrite(save_path, image)

    # Reload dataset
    load_dataset()

    return jsonify(success=True, message=f'Face registered successfully for {name}.')


@app.route('/api/recognize', methods=['POST'])
def recognize():
    """Recognize faces in a frame and mark attendance."""
    data = request.get_json(force=True)
    image_data = data.get('image', '')

    if not image_data:
        return jsonify(faces=[])

    image = decode_base64_image(image_data)
    if image is None:
        return jsonify(faces=[])

    # Resize to 0.25x for speed
    small_image = cv2.resize(image, (0, 0), fx=0.25, fy=0.25)
    rgb_small = cv2.cvtColor(small_image, cv2.COLOR_BGR2RGB)

    face_locations = face_recognition.face_locations(rgb_small)
    face_encodings = face_recognition.face_encodings(rgb_small, face_locations)

    results = []

    with face_data_lock:
        current_encodings = list(known_face_encodings)
        current_names = list(known_face_names)

    for encoding, (top, right, bottom, left) in zip(face_encodings, face_locations):
        name = 'Unknown'

        if current_encodings:
            matches = face_recognition.compare_faces(current_encodings, encoding, tolerance=0.45)
            face_distances = face_recognition.face_distance(current_encodings, encoding)

            if len(face_distances) > 0:
                best_match_idx = np.argmin(face_distances)
                if matches[best_match_idx]:
                    name = current_names[best_match_idx]

        # Mark attendance for recognized faces
        if name != 'Unknown':
            mark_attendance(name)

        # Scale coordinates back to original size (multiply by 4)
        results.append({
            'name': name,
            'top': top * 4,
            'right': right * 4,
            'bottom': bottom * 4,
            'left': left * 4
        })

    return jsonify(faces=results)


@app.route('/api/attendance', methods=['GET'])
def attendance():
    """Return attendance records, optionally filtered by date."""
    query_date = request.args.get('date', None)

    conn = get_db()
    if query_date:
        rows = conn.execute(
            'SELECT id, name, date, time FROM attendance WHERE date = ? ORDER BY id DESC',
            (query_date,)
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT id, name, date, time FROM attendance ORDER BY id DESC'
        ).fetchall()
    conn.close()

    records = [dict(row) for row in rows]
    return jsonify(records=records)


@app.route('/api/attendance/download', methods=['GET'])
def download_attendance():
    """Download the attendance CSV file."""
    if not os.path.isfile(CSV_PATH):
        return jsonify(success=False, message='No attendance data available.'), 404
    return send_file(CSV_PATH, as_attachment=True, download_name='attendance.csv')


@app.route('/api/stats', methods=['GET'])
def stats():
    """Return dashboard statistics."""
    today = date.today().isoformat()

    with face_data_lock:
        registered = len(known_face_names)

    conn = get_db()
    today_count = conn.execute(
        'SELECT COUNT(*) FROM attendance WHERE date = ?', (today,)
    ).fetchone()[0]
    total_count = conn.execute(
        'SELECT COUNT(*) FROM attendance'
    ).fetchone()[0]
    conn.close()

    return jsonify(
        registered_faces=registered,
        today_attendance=today_count,
        total_records=total_count
    )

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    init_db()
    load_dataset()
    app.run(host='0.0.0.0', port=5000, debug=False)
