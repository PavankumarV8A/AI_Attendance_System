# AI Attendance System Using Face Recognition

## Project Overview

The AI Attendance System Using Face Recognition is an automated attendance management application developed using Artificial Intelligence, Machine Learning, and Computer Vision technologies. The system captures facial images through a webcam, recognizes registered students in real time, and automatically marks attendance with date and time.

The project is designed to reduce manual effort, prevent proxy attendance, improve attendance accuracy, and provide a secure contactless attendance solution for educational institutions.

---

# Features

* Real-time face detection and recognition
* Automatic attendance marking
* Contactless attendance system
* Unknown person detection
* Duplicate attendance prevention
* Attendance report generation
* SQLite database storage
* CSV attendance export
* Fast and accurate recognition

---

# Technologies Used

## Programming Language

* Python

## Libraries

* OpenCV
* face_recognition
* NumPy
* Pandas

## Database

* SQLite
* CSV File Storage

## Development Tools

* VS Code / Jupyter Notebook

---

# System Requirements

## Hardware Requirements

| Component | Requirement            |
| --------- | ---------------------- |
| Processor | Intel Core i5 or above |
| RAM       | 8 GB or above          |
| Storage   | 10 GB free space       |
| Camera    | HD Webcam              |
| Monitor   | 15” Monitor or above   |

---

## Software Requirements

| Software         | Version             |
| ---------------- | ------------------- |
| Python           | 3.10 or above       |
| Windows          | Windows 10 or above |
| OpenCV           | Latest              |
| face_recognition | Latest              |

---

# Project Structure

```text
AI_Attendance_System/
│
├── main.py
├── requirements.txt
├── attendance.db
├── attendance.csv
└── dataset/
```

---

# Installation Steps

## Step 1 — Install Python

Download and install Python:

https://www.python.org/downloads/

---

## Step 2 — Install Required Libraries

Open terminal or command prompt and run:

```bash
pip install -r requirements.txt
```

---

# Requirements File

## requirements.txt

```txt
opencv-python
face-recognition
numpy
pandas
```

---

# Running the Project

Run the following command:

```bash
python main.py
```

---

# Working Process

## 1. Register Face

* Select option 1
* Enter student name
* Webcam opens
* Press 'S' to save image
* Image stored inside dataset folder

---

## 2. Start Attendance

* Select option 2
* Webcam starts
* Face detected and recognized
* Attendance marked automatically
* Records stored in database and CSV

---

# Database Structure

## Attendance Table

| Field | Description     |
| ----- | --------------- |
| id    | Attendance ID   |
| name  | Student Name    |
| date  | Attendance Date |
| time  | Attendance Time |

---

# Output Files

## attendance.db

Stores attendance records using SQLite database.

## attendance.csv

Stores attendance records in CSV format.

Example:

```csv
Name,Date,Time
Pavan,2026-05-23,09:30:12
Rahul,2026-05-23,09:31:10
```

---

# Accuracy Improvements Used

* Dlib-based face recognition model
* Lower tolerance value (0.45)
* Face distance matching
* Real-time image processing
* Optimized face encoding comparison

---

# Advantages

* Prevents proxy attendance
* Reduces manual work
* Improves attendance accuracy
* Contactless attendance system
* Easy attendance management
* Real-time processing

---

# Limitations

* Accuracy depends on lighting conditions
* Requires clear face visibility
* Camera quality affects performance
* Recognition accuracy may reduce with blurred images

---

# Future Enhancements

* Cloud database integration
* Mobile application support
* Anti-spoofing detection
* Live dashboard monitoring
* Multi-face registration per student

---

# Developed By

Pavankumar V
MCA – 4th Semester

Project Title:
AI Attendance System Using Face Recognition

---

# Conclusion

The AI Attendance System Using Face Recognition successfully automates the attendance management process using Artificial Intelligence and Computer Vision technologies. The system improves accuracy, reduces manual effort, prevents proxy attendance, and provides a secure and efficient attendance solution for educational institutions.
