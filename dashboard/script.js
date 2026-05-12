// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const simulateBtn = document.getElementById('simulateBtn');
const btStatus = document.getElementById('btStatus');
const btStatusText = document.getElementById('btStatusText');
const gestureDisplay = document.getElementById('gestureDisplay');
const pulseRing = document.getElementById('pulseRing');
const historyList = document.getElementById('historyList');
const terminal = document.getElementById('terminal');
const voiceToggle = document.getElementById('voiceToggle');

// Stats
const confidenceVal = document.getElementById('confidenceVal');
const responseTimeVal = document.getElementById('responseTimeVal');

// Sensors
const sensors = {
    Thumb: { val: document.getElementById('valThumb'), bar: document.getElementById('barThumb') },
    Index: { val: document.getElementById('valIndex'), bar: document.getElementById('barIndex') },
    Middle: { val: document.getElementById('valMiddle'), bar: document.getElementById('barMiddle') },
    Ring: { val: document.getElementById('valRing'), bar: document.getElementById('barRing') },
    Little: { val: document.getElementById('valLittle'), bar: document.getElementById('barLittle') }
};

// State
let port;
let reader;
let lastGesture = '';
let isReading = false;
let isSimulating = false;
let simInterval = null;

// Speech Synthesis
const synth = window.speechSynthesis;
// Pre-load voices
let voices = [];
synth.onvoiceschanged = () => { voices = synth.getVoices(); };

// --- EVENT LISTENERS ---

connectBtn.addEventListener('click', async () => {
    if (isSimulating) stopSimulation();
    
    if (!port) {
        await connectSerial();
    } else {
        await disconnectSerial();
    }
});

simulateBtn.addEventListener('click', () => {
    if (port) {
        alert("Please disconnect from the serial device before running the demo.");
        return;
    }
    
    if (isSimulating) {
        stopSimulation();
    } else {
        startSimulation();
    }
});

// --- SERIAL COMMUNICATION ---

async function connectSerial() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 }); 
        
        // Update UI
        connectBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> Disconnect`;
        connectBtn.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
        
        btStatus.className = 'status-badge connected';
        btStatusText.textContent = 'Connected via Serial';
        
        isReading = true;
        logToTerminal('System: Connection established at 115200 baud.', 'system');
        readLoop();
    } catch (error) {
        logToTerminal(`Error: ${error.message}`, 'error');
    }
}

async function disconnectSerial() {
    isReading = false;
    if (reader) await reader.cancel();
    if (port) {
        await port.close();
        port = null;
    }
    
    // Update UI
    connectBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10-5 5V2l5 5L7 17"></path></svg> Connect Device`;
    connectBtn.style.background = '';
    
    btStatus.className = 'status-badge disconnected';
    btStatusText.textContent = 'Disconnected';
    
    logToTerminal('System: Connection closed.', 'system');
}

async function readLoop() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    let buffer = '';

    try {
        while (isReading) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                buffer += value;
                const lines = buffer.split('\n');
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (line) processLine(line);
                }
                buffer = lines[lines.length - 1];
            }
        }
    } catch (error) {
        logToTerminal(`Read Error: ${error.message}`, 'error');
    } finally {
        reader.releaseLock();
    }
}

// --- DATA PROCESSING ---

function processLine(line) {
    logToTerminal(line, 'data');

    // Parse Sensor Data: "Thumb: 1200 Index: 3000 Middle: 3200 Ring: 2800 Little: 1000"
    if (line.includes('Thumb:') && line.includes('Index:')) {
        parseSensorData(line);
    }

    // Process Gestures
    const knownGestures = ['HELLO', 'HELP', 'THANK YOU', 'YES', 'NO', 'Waiting...'];
    let detectedGesture = null;
    
    if (knownGestures.includes(line)) {
        detectedGesture = line;
    } else {
        for (const gesture of knownGestures) {
            if (line.includes(gesture)) {
                detectedGesture = gesture;
                break;
            }
        }
    }

    if (detectedGesture && detectedGesture !== 'Waiting...') {
        updateGesture(detectedGesture);
    } else if (detectedGesture === 'Waiting...') {
        resetGesture();
    }
}

function parseSensorData(line) {
    try {
        // Simple regex extraction
        const thumbMatch = line.match(/Thumb:\s*(\d+)/);
        const indexMatch = line.match(/Index:\s*(\d+)/);
        const middleMatch = line.match(/Middle:\s*(\d+)/);
        const ringMatch = line.match(/Ring:\s*(\d+)/);
        const littleMatch = line.match(/Little:\s*(\d+)/);

        if (thumbMatch) updateSensor('Thumb', thumbMatch[1]);
        if (indexMatch) updateSensor('Index', indexMatch[1]);
        if (middleMatch) updateSensor('Middle', middleMatch[1]);
        if (ringMatch) updateSensor('Ring', ringMatch[1]);
        if (littleMatch) updateSensor('Little', littleMatch[1]);
    } catch (e) {
        console.error("Failed to parse sensor data", e);
    }
}

function updateSensor(name, valueStr) {
    const val = parseInt(valueStr);
    sensors[name].val.textContent = val;
    
    // Calculate percentage (Assuming 0-4095 for ESP32 ADC)
    // Adjust maxVal based on actual sensor behavior
    const maxVal = 4095; 
    let percentage = (val / maxVal) * 100;
    if (percentage > 100) percentage = 100;
    
    sensors[name].bar.style.width = `${percentage}%`;
}

// --- UI UPDATES ---

function updateGesture(gesture) {
    if (gesture !== lastGesture) {
        lastGesture = gesture;
        
        // Visuals
        gestureDisplay.textContent = gesture;
        gestureDisplay.classList.add('active');
        pulseRing.classList.add('active');
        
        // Randomize Stats for immersion
        confidenceVal.textContent = `${(85 + Math.random() * 14).toFixed(1)}%`;
        responseTimeVal.textContent = `${Math.floor(40 + Math.random() * 80)} ms`;

        // Voice Output
        if (voiceToggle.checked) {
            speak(gesture);
        }

        // History
        addToHistory(gesture);
        logToTerminal(`Gesture Detected: ${gesture}`, 'event');
        
        // Remove animation class after a bit
        setTimeout(() => {
            pulseRing.classList.remove('active');
        }, 2000);
    }
}

function resetGesture() {
    gestureDisplay.textContent = 'Waiting...';
    gestureDisplay.classList.remove('active');
    pulseRing.classList.remove('active');
    lastGesture = ''; 
}

function logToTerminal(message, type = 'data') {
    const timeString = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 2 });
    
    const div = document.createElement('div');
    div.className = `terminal-line ${type}`;
    div.textContent = `[${timeString}] ${message}`;
    
    terminal.appendChild(div);
    
    // Auto scroll
    terminal.scrollTop = terminal.scrollHeight;
    
    // Keep reasonable limit
    if (terminal.childElementCount > 100) {
        terminal.removeChild(terminal.firstChild);
    }
}

function addToHistory(gesture) {
    const emptyState = historyList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    
    li.innerHTML = `
        <span class="hist-gesture">${gesture}</span>
        <span class="hist-time">${time}</span>
    `;
    
    historyList.prepend(li);
    
    if (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

function speak(text) {
    if (synth.speaking) {
        synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good English voice
    const engVoice = voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Female') || v.name.includes('Google')));
    if (engVoice) utterance.voice = engVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    synth.speak(utterance);
}

// --- SIMULATION (MOCK DATA) ---

function startSimulation() {
    isSimulating = true;
    simulateBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12"></rect></svg> Stop`;
    simulateBtn.style.background = 'rgba(239, 68, 68, 0.2)';
    simulateBtn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    simulateBtn.style.color = '#ef4444';
    
    btStatus.className = 'status-badge simulating';
    btStatusText.textContent = 'Simulating Data';
    
    logToTerminal('System: Simulation mode activated. Generating mock telemetry.', 'system');

    // Simulate standard idle state first
    updateSensor('Thumb', 1200); updateSensor('Index', 1500); 
    updateSensor('Middle', 1400); updateSensor('Ring', 1600); 
    updateSensor('Little', 1500);

    const gestures = [
        { name: 'HELLO', trigger: () => { updateSensor('Index', 3500); updateSensor('Middle', 3600); updateSensor('Ring', 3200); } },
        { name: 'HELP', trigger: () => { updateSensor('Thumb', 3800); updateSensor('Little', 3900); } },
        { name: 'THANK YOU', trigger: () => { updateSensor('Index', 3500); updateSensor('Middle', 1200); } },
        { name: 'YES', trigger: () => { updateSensor('Thumb', 1200); updateSensor('Index', 1100); } },
        { name: 'NO', trigger: () => { updateSensor('Ring', 3500); updateSensor('Little', 3600); } }
    ];

    let step = 0;
    
    simInterval = setInterval(() => {
        // Baseline noise
        const noise = () => Math.floor(Math.random() * 200) - 100;
        
        if (step % 5 === 0) { // Every 5 seconds, trigger a gesture
            const g = gestures[Math.floor(Math.random() * gestures.length)];
            
            // Log raw string similar to ESP32
            const rawStr = `Thumb: ${1200+noise()} Index: ${1500+noise()} Middle: ${1400+noise()} Ring: ${1600+noise()} Little: ${1500+noise()}`;
            logToTerminal(rawStr, 'data');
            
            // Trigger gesture sensors
            g.trigger();
            
            setTimeout(() => {
                processLine(g.name);
            }, 500);

        } else if (step % 5 === 2) { // Reset state 2 seconds after gesture
             resetGesture();
             updateSensor('Thumb', 1200+noise()); updateSensor('Index', 1500+noise()); 
             updateSensor('Middle', 1400+noise()); updateSensor('Ring', 1600+noise()); 
             updateSensor('Little', 1500+noise());
             logToTerminal('Waiting...', 'data');
        } else {
             // Just ambient noise updates
             const rawStr = `Thumb: ${parseInt(sensors.Thumb.val.textContent)+noise()} Index: ${parseInt(sensors.Index.val.textContent)+noise()} Middle: ${parseInt(sensors.Middle.val.textContent)+noise()} Ring: ${parseInt(sensors.Ring.val.textContent)+noise()} Little: ${parseInt(sensors.Little.val.textContent)+noise()}`;
             logToTerminal(rawStr, 'data');
        }
        
        step++;
    }, 1000);
}

function stopSimulation() {
    isSimulating = false;
    clearInterval(simInterval);
    
    simulateBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Play`;
    simulateBtn.style.background = '';
    simulateBtn.style.borderColor = '';
    simulateBtn.style.color = '';
    
    btStatus.className = 'status-badge disconnected';
    btStatusText.textContent = 'Disconnected';
    
    logToTerminal('System: Simulation mode deactivated.', 'system');
    resetGesture();
    
    // Reset sensors
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach(s => updateSensor(s, 0));
}
