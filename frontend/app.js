/* ============================================================
   AttendAI — Frontend Application Logic
   SPA Routing · Webcam Management · API Integration
   ============================================================ */

(function () {
    'use strict';

    // ── DOM References ──────────────────────────────────────────
    const navItems      = document.querySelectorAll('.nav-item[data-view]');
    const views         = document.querySelectorAll('.view');
    const mainContent   = document.getElementById('mainContent');

    // Dashboard
    const statFacesVal  = document.getElementById('stat-faces-value');
    const statTodayVal  = document.getElementById('stat-today-value');
    const statTotalVal  = document.getElementById('stat-total-value');
    const activityList  = document.getElementById('activity-list');
    const activityCount = document.getElementById('activity-count');
    const dashboardEmpty = document.getElementById('dashboard-empty');

    // Register
    const registerVideo     = document.getElementById('register-video');
    const registerCanvas    = document.getElementById('register-canvas');
    const registerPlaceholder = document.getElementById('register-placeholder');
    const studentNameInput  = document.getElementById('student-name');
    const btnCapture        = document.getElementById('btn-capture');
    const registerStatus    = document.getElementById('register-status');

    // Attendance
    const attendanceVideo       = document.getElementById('attendance-video');
    const attendanceCanvas      = document.getElementById('attendance-canvas');
    const attendanceCaptureCanvas = document.getElementById('attendance-capture-canvas');
    const attendancePlaceholder = document.getElementById('attendance-placeholder');
    const btnStartRecognition   = document.getElementById('btn-start-recognition');
    const btnStopRecognition    = document.getElementById('btn-stop-recognition');
    const recognitionStatusEl   = document.getElementById('recognition-status');
    const recognizedList        = document.getElementById('recognized-list');
    const recognizedCount       = document.getElementById('recognized-count');

    // Records
    const recordsDate    = document.getElementById('records-date');
    const btnFilter      = document.getElementById('btn-filter-records');
    const btnClear       = document.getElementById('btn-clear-filter');
    const btnDownloadCSV = document.getElementById('btn-download-csv');
    const recordsTbody   = document.getElementById('records-tbody');
    const recordsEmpty   = document.getElementById('records-empty');
    const recordsTable   = document.getElementById('records-table');

    // ── State ───────────────────────────────────────────────────
    let currentView      = 'dashboard';
    let registerStream   = null;
    let attendanceStream = null;
    let recognitionLoop  = null;
    let isRecognizing    = false;
    const recognizedNames = new Set();

    // ── Toast Container ─────────────────────────────────────────
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // ============================================================
    //  UTILITIES
    // ============================================================

    /**
     * Show a toast notification.
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /**
     * Animate a number counter from 0 to target.
     */
    function animateCounter(el, target) {
        const duration = 800;
        const start = parseInt(el.textContent, 10) || 0;
        const diff = target - start;
        if (diff === 0) return;
        const startTime = performance.now();

        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            el.textContent = Math.round(start + diff * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /**
     * Build initials from a name string (first two letters of first two words).
     */
    function getInitials(name) {
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0])
            .join('')
            .toUpperCase();
    }

    // ============================================================
    //  SPA ROUTING
    // ============================================================

    function switchView(viewName) {
        if (viewName === currentView) return;

        // Cleanup previous view
        cleanupView(currentView);

        // Update nav active states
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Show target view
        views.forEach(v => {
            v.classList.remove('active');
            if (v.id === `view-${viewName}`) {
                v.classList.add('active');
                // Re-trigger animation
                v.style.animation = 'none';
                // Force reflow
                void v.offsetHeight;
                v.style.animation = '';
            }
        });

        currentView = viewName;
        mainContent.scrollTop = 0;

        // Initialize new view
        initView(viewName);
    }

    function initView(name) {
        switch (name) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'register':
                startWebcam('register');
                break;
            case 'attendance':
                startWebcam('attendance');
                break;
            case 'records':
                loadRecords();
                break;
        }
    }

    function cleanupView(name) {
        switch (name) {
            case 'register':
                stopWebcam('register');
                break;
            case 'attendance':
                stopRecognition();
                stopWebcam('attendance');
                break;
        }
    }

    // Bind nav clicks
    navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    // ============================================================
    //  WEBCAM MANAGEMENT
    // ============================================================

    async function startWebcam(mode) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });

            if (mode === 'register') {
                registerVideo.srcObject = stream;
                registerStream = stream;
                registerPlaceholder.classList.add('hidden');
            } else if (mode === 'attendance') {
                attendanceVideo.srcObject = stream;
                attendanceStream = stream;
                attendancePlaceholder.classList.add('hidden');

                // Match canvas size to video once metadata is loaded
                attendanceVideo.addEventListener('loadedmetadata', () => {
                    attendanceCanvas.width = attendanceVideo.videoWidth;
                    attendanceCanvas.height = attendanceVideo.videoHeight;
                }, { once: true });
            }
        } catch (err) {
            console.error('Webcam error:', err);
            showToast('Could not access webcam. Please allow camera permissions.', 'error');
        }
    }

    function stopWebcam(mode) {
        if (mode === 'register' && registerStream) {
            registerStream.getTracks().forEach(t => t.stop());
            registerVideo.srcObject = null;
            registerStream = null;
            registerPlaceholder.classList.remove('hidden');
        } else if (mode === 'attendance' && attendanceStream) {
            attendanceStream.getTracks().forEach(t => t.stop());
            attendanceVideo.srcObject = null;
            attendanceStream = null;
            attendancePlaceholder.classList.remove('hidden');
        }
    }

    /**
     * Capture a single frame from a video element as base64 JPEG.
     */
    function captureFrame(videoEl, canvasEl) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(videoEl, 0, 0);
        return canvasEl.toDataURL('image/jpeg', 0.8);
    }

    // ============================================================
    //  DASHBOARD
    // ============================================================

    async function loadDashboard() {
        try {
            // Fetch stats
            const statsRes = await fetch('/api/stats');
            if (statsRes.ok) {
                const stats = await statsRes.json();
                animateCounter(statFacesVal, stats.registered_faces || 0);
                animateCounter(statTodayVal, stats.today_attendance || 0);
                animateCounter(statTotalVal, stats.total_records || 0);
            }
        } catch (e) {
            console.warn('Failed to load stats:', e);
        }

        try {
            // Fetch recent attendance
            const attRes = await fetch('/api/attendance');
            if (attRes.ok) {
                const data = await attRes.json();
                renderActivityList(data.records || data || []);
            }
        } catch (e) {
            console.warn('Failed to load attendance:', e);
        }
    }

    function renderActivityList(records) {
        // Take last 10
        const recent = records.slice(-10).reverse();
        activityCount.textContent = `${recent.length} entries`;

        if (recent.length === 0) {
            activityList.innerHTML = '';
            activityList.appendChild(dashboardEmpty);
            dashboardEmpty.style.display = '';
            return;
        }

        dashboardEmpty.style.display = 'none';
        activityList.innerHTML = '';

        recent.forEach((rec, i) => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.style.animationDelay = `${i * 0.05}s`;

            const name = rec.name || 'Unknown';
            const date = rec.date || '';
            const time = rec.time || '';

            item.innerHTML = `
                <div class="activity-avatar">${getInitials(name)}</div>
                <div class="activity-info">
                    <div class="activity-name">${escapeHTML(name)}</div>
                    <div class="activity-time">${escapeHTML(date)}  •  ${escapeHTML(time)}</div>
                </div>
            `;
            activityList.appendChild(item);
        });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    //  REGISTER FACE
    // ============================================================

    btnCapture.addEventListener('click', async () => {
        const name = studentNameInput.value.trim();
        if (!name) {
            showStatus(registerStatus, 'Please enter the student\'s name.', 'error');
            studentNameInput.focus();
            return;
        }

        if (!registerStream) {
            showStatus(registerStatus, 'Webcam is not active. Please allow camera access.', 'error');
            return;
        }

        // Capture frame
        const imageData = captureFrame(registerVideo, registerCanvas);

        // Show loading state
        btnCapture.disabled = true;
        btnCapture.textContent = 'Processing...';
        showStatus(registerStatus, 'Capturing and registering face...', 'info');

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, image: imageData })
            });

            const data = await res.json();

            if (res.ok && data.success !== false) {
                showStatus(registerStatus, data.message || `Successfully registered ${name}!`, 'success');
                showToast(`${name} registered successfully!`, 'success');
                studentNameInput.value = '';
            } else {
                showStatus(registerStatus, data.message || data.error || 'Registration failed. Please try again.', 'error');
                showToast('Registration failed.', 'error');
            }
        } catch (err) {
            console.error('Register error:', err);
            showStatus(registerStatus, 'Network error. Is the server running?', 'error');
            showToast('Network error.', 'error');
        } finally {
            btnCapture.disabled = false;
            btnCapture.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Capture & Register
            `;
        }
    });

    function showStatus(el, message, type) {
        el.textContent = message;
        el.className = `status-message show ${type}`;
    }

    // ============================================================
    //  TAKE ATTENDANCE — RECOGNITION
    // ============================================================

    btnStartRecognition.addEventListener('click', () => {
        if (!attendanceStream) {
            showToast('Webcam is not active.', 'error');
            return;
        }
        startRecognition();
    });

    btnStopRecognition.addEventListener('click', () => {
        stopRecognition();
    });

    function startRecognition() {
        if (isRecognizing) return;
        isRecognizing = true;

        btnStartRecognition.disabled = true;
        btnStopRecognition.disabled = false;

        // Update status
        const statusIndicator = recognitionStatusEl.querySelector('.status-indicator');
        statusIndicator.className = 'status-indicator running';
        recognitionStatusEl.querySelector('span:last-child').textContent = 'Scanning...';

        // Start loop at ~3 FPS (350ms interval)
        recognitionLoop = setInterval(recognitionTick, 350);
    }

    function stopRecognition() {
        if (!isRecognizing) return;
        isRecognizing = false;

        if (recognitionLoop) {
            clearInterval(recognitionLoop);
            recognitionLoop = null;
        }

        btnStartRecognition.disabled = false;
        btnStopRecognition.disabled = true;

        // Update status
        const statusIndicator = recognitionStatusEl.querySelector('.status-indicator');
        statusIndicator.className = 'status-indicator idle';
        recognitionStatusEl.querySelector('span:last-child').textContent = 'Idle';

        // Clear canvas
        const ctx = attendanceCanvas.getContext('2d');
        ctx.clearRect(0, 0, attendanceCanvas.width, attendanceCanvas.height);
    }

    async function recognitionTick() {
        if (!isRecognizing || !attendanceStream) return;

        const imageData = captureFrame(attendanceVideo, attendanceCaptureCanvas);

        try {
            const res = await fetch('/api/recognize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });

            if (!res.ok) return;

            const data = await res.json();
            const faces = data.faces || [];

            drawFaceBoxes(faces);
            updateRecognizedList(faces);
        } catch (err) {
            // Silent fail — server might be busy
        }
    }

    /**
     * Draw bounding boxes and labels on the attendance canvas overlay.
     */
    function drawFaceBoxes(faces) {
        const ctx = attendanceCanvas.getContext('2d');
        const vw = attendanceVideo.videoWidth;
        const vh = attendanceVideo.videoHeight;

        attendanceCanvas.width = vw;
        attendanceCanvas.height = vh;
        ctx.clearRect(0, 0, vw, vh);

        faces.forEach(face => {
            const { name, top, right, bottom, left } = face;
            const isKnown = name && name.toLowerCase() !== 'unknown';

            const x = left;
            const y = top;
            const w = right - left;
            const h = bottom - top;

            // Box
            ctx.strokeStyle = isKnown ? '#10b981' : '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.strokeRect(x, y, w, h);

            // Corner accents
            const cornerLen = Math.min(w, h) * 0.2;
            ctx.lineWidth = 3.5;
            // Top-left
            ctx.beginPath();
            ctx.moveTo(x, y + cornerLen);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLen, y);
            ctx.stroke();
            // Top-right
            ctx.beginPath();
            ctx.moveTo(x + w - cornerLen, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + cornerLen);
            ctx.stroke();
            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(x, y + h - cornerLen);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + cornerLen, y + h);
            ctx.stroke();
            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(x + w - cornerLen, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - cornerLen);
            ctx.stroke();

            // Label background
            const label = isKnown ? name : 'Unknown';
            ctx.font = '600 14px Inter, sans-serif';
            const textWidth = ctx.measureText(label).width;
            const labelPadX = 10;
            const labelPadY = 6;
            const labelH = 24;

            ctx.fillStyle = isKnown
                ? 'rgba(16, 185, 129, 0.85)'
                : 'rgba(239, 68, 68, 0.85)';
            const labelX = x;
            const labelY = y - labelH - 4;
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, textWidth + labelPadX * 2, labelH, 6);
            ctx.fill();

            // Label text
            ctx.fillStyle = '#fff';
            ctx.fillText(label, labelX + labelPadX, labelY + labelH - labelPadY);
        });
    }

    /**
     * Update the "Recognized Today" list, avoiding duplicates.
     */
    function updateRecognizedList(faces) {
        let hasNew = false;

        faces.forEach(face => {
            const name = face.name;
            if (name && name.toLowerCase() !== 'unknown' && !recognizedNames.has(name)) {
                recognizedNames.add(name);
                hasNew = true;
            }
        });

        if (hasNew) {
            renderRecognizedList();
        }
    }

    function renderRecognizedList() {
        recognizedCount.textContent = recognizedNames.size;

        if (recognizedNames.size === 0) {
            recognizedList.innerHTML = '<li class="empty-state-small">No faces recognized yet</li>';
            return;
        }

        recognizedList.innerHTML = '';
        recognizedNames.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            recognizedList.appendChild(li);
        });
    }

    // ============================================================
    //  RECORDS
    // ============================================================

    async function loadRecords(dateStr) {
        let url = '/api/attendance';
        if (dateStr) {
            url += `?date=${encodeURIComponent(dateStr)}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load records');
            const data = await res.json();
            const records = data.records || data || [];
            renderRecordsTable(records);
        } catch (err) {
            console.warn('Failed to load records:', err);
            renderRecordsTable([]);
        }
    }

    function renderRecordsTable(records) {
        recordsTbody.innerHTML = '';

        if (records.length === 0) {
            recordsTable.style.display = 'none';
            recordsEmpty.style.display = '';
            return;
        }

        recordsTable.style.display = '';
        recordsEmpty.style.display = 'none';

        records.forEach((rec, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${escapeHTML(rec.name || 'Unknown')}</td>
                <td>${escapeHTML(rec.date || '')}</td>
                <td>${escapeHTML(rec.time || '')}</td>
            `;
            recordsTbody.appendChild(tr);
        });
    }

    // Filter button
    btnFilter.addEventListener('click', () => {
        const date = recordsDate.value;
        if (!date) {
            showToast('Please select a date to filter.', 'error');
            return;
        }
        loadRecords(date);
    });

    // Clear button
    btnClear.addEventListener('click', () => {
        recordsDate.value = '';
        loadRecords();
    });

    // Download CSV
    btnDownloadCSV.addEventListener('click', () => {
        const date = recordsDate.value;
        let url = '/api/attendance/download';
        if (date) {
            url += `?date=${encodeURIComponent(date)}`;
        }
        window.open(url, '_blank');
    });

    // ============================================================
    //  INITIALIZATION
    // ============================================================

    // Set today's date as default for records
    const today = new Date().toISOString().split('T')[0];
    recordsDate.value = today;

    // Load initial view
    initView('dashboard');

})();
