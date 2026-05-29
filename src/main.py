import cv2
import face_recognition
import numpy as np
import os
import sqlite3
from datetime import datetime
import pandas as pd

# =========================
# CREATE DATASET FOLDER
# =========================
if not os.path.exists("dataset"):
    os.makedirs("dataset")

# =========================
# DATABASE SETUP
# =========================
conn = sqlite3.connect("attendance.db")
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT,
    time TEXT
)
''')

conn.commit()

# =========================
# LOAD DATASET
# =========================
known_face_encodings = []
known_face_names = []

print("Loading dataset...")

for file in os.listdir("dataset"):
    if file.endswith(".jpg") or file.endswith(".png"):
        image_path = os.path.join("dataset", file)

        image = face_recognition.load_image_file(image_path)

        encodings = face_recognition.face_encodings(image)

        if len(encodings) > 0:
            encoding = encodings[0]
            known_face_encodings.append(encoding)

            name = os.path.splitext(file)[0]
            known_face_names.append(name)

print("Dataset Loaded Successfully")

# =========================
# ATTENDANCE FUNCTION
# =========================
def mark_attendance(name):

    today = datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now().strftime("%H:%M:%S")

    cursor.execute(
        "SELECT * FROM attendance WHERE name=? AND date=?",
        (name, today)
    )

    data = cursor.fetchone()

    # Prevent duplicate attendance
    if data is None:
        cursor.execute(
            "INSERT INTO attendance(name, date, time) VALUES(?,?,?)",
            (name, today, current_time)
        )

        conn.commit()

        # Save to CSV also
        csv_file = "attendance.csv"

        row = {
            "Name": name,
            "Date": today,
            "Time": current_time
        }

        df = pd.DataFrame([row])

        if not os.path.exists(csv_file):
            df.to_csv(csv_file, index=False)
        else:
            df.to_csv(csv_file, mode='a', header=False, index=False)

        print(f"Attendance Marked for {name}")

# =========================
# FACE REGISTRATION
# =========================
def register_face():

    name = input("Enter Student Name: ")

    cap = cv2.VideoCapture(0)

    print("Press 's' to save image")

    while True:
        ret, frame = cap.read()

        if not ret:
            continue

        cv2.imshow("Register Face", frame)

        key = cv2.waitKey(1)

        if key == ord('s'):
            image_path = f"dataset/{name}.jpg"
            cv2.imwrite(image_path, frame)
            print("Image Saved Successfully")
            break

        elif key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

# =========================
# REAL-TIME ATTENDANCE
# =========================
def start_attendance():

    cap = cv2.VideoCapture(0)

    print("Starting Attendance System...")

    while True:

        ret, frame = cap.read()

        if not ret:
            continue

        # Resize for faster processing
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)

        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(rgb_small_frame)

        face_encodings = face_recognition.face_encodings(
            rgb_small_frame,
            face_locations
        )

        for face_encoding, face_location in zip(face_encodings, face_locations):

            matches = face_recognition.compare_faces(
                known_face_encodings,
                face_encoding,
                tolerance=0.45
            )

            face_distances = face_recognition.face_distance(
                known_face_encodings,
                face_encoding
            )

            best_match_index = np.argmin(face_distances)

            name = "Unknown"

            if matches[best_match_index]:
                name = known_face_names[best_match_index]
                mark_attendance(name)

            # Scale back locations
            top, right, bottom, left = face_location
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            # Draw Rectangle
            cv2.rectangle(frame, (left, top), (right, bottom), (0,255,0), 2)

            # Draw Name
            cv2.rectangle(frame, (left, bottom-35), (right, bottom), (0,255,0), cv2.FILLED)
            cv2.putText(
                frame,
                name,
                (left+6, bottom-6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255,255,255),
                2
            )

        cv2.imshow("AI Attendance System", frame)

        key = cv2.waitKey(1)

        if key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

# =========================
# MAIN MENU
# =========================
while True:

    print("\n===== AI ATTENDANCE SYSTEM =====")
    print("1. Register New Face")
    print("2. Start Attendance")
    print("3. Exit")

    choice = input("Enter Choice: ")

    if choice == '1':
        register_face()

        # Reload dataset automatically
        known_face_encodings.clear()
        known_face_names.clear()

        for file in os.listdir("dataset"):
            if file.endswith(".jpg") or file.endswith(".png"):
                image_path = os.path.join("dataset", file)

                image = face_recognition.load_image_file(image_path)

                encodings = face_recognition.face_encodings(image)

                if len(encodings) > 0:
                    encoding = encodings[0]
                    known_face_encodings.append(encoding)

                    name = os.path.splitext(file)[0]
                    known_face_names.append(name)

        print("Dataset Reloaded")

    elif choice == '2':
        start_attendance()

    elif choice == '3':
        print("Exiting...")
        break

    else:
        print("Invalid Choice")

conn.close()