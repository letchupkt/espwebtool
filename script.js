document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const connectButton = document.getElementById('connectButton');
    const programButton = document.getElementById('programButton');
    const clearButton = document.getElementById('clearButton');
    const portSelect = document.getElementById('portSelect');
    const output = document.getElementById('output');
    const yearSpan = document.getElementById('year');
    const themeToggle = document.getElementById('themeToggle');
    const firmwareFile = document.getElementById('firmwareFile');
    const serialInput = document.getElementById('serialInput');
    const serialSendButton = document.getElementById('serialSendButton');
    const serialClearButton = document.getElementById('serialClearButton');
    const serialOutput = document.getElementById('serialOutput');

    // Set current year in footer
    yearSpan.textContent = new Date().getFullYear();

    // Theme handling
    const getTheme = () => localStorage.getItem('theme') || 'light';
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    // Set initial theme
    setTheme(getTheme());

    // Theme toggle handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = getTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });

    // State
    let isConnected = false;
    let outputLines = [];
    let serialLines = [];
    let port = null;
    let selectedFirmware = null;
    let reader = null;
    let writer = null;

    // Functions
    const updateOutput = () => {
        output.textContent = outputLines.length > 0 
            ? outputLines.join('\n') 
            : 'Click Connect to start';
    };

    const updateSerialOutput = () => {
        serialOutput.textContent = serialLines.length > 0
            ? serialLines.join('\n')
            : 'No serial data';
        serialOutput.scrollTop = serialOutput.scrollHeight;
    };

    const addOutputLine = (line) => {
        outputLines.push(line);
        updateOutput();
        output.scrollTop = output.scrollHeight;
    };

    const addSerialLine = (line) => {
        serialLines.push(line);
        if (serialLines.length > 1000) {
            serialLines.shift(); // Keep only last 1000 lines
        }
        updateSerialOutput();
    };

    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
        addOutputLine('> Web Serial API is not supported in your browser');
        connectButton.disabled = true;
        portSelect.disabled = true;
    }

    // Function to update available ports
    async function updatePorts() {
        const ports = await navigator.serial.getPorts();
        portSelect.innerHTML = '<option value="">Select a port...</option>';
        
        for (const port of ports) {
            const portInfo = await port.getInfo();
            const option = document.createElement('option');
            option.value = portInfo.usbVendorId ? 
                `${portInfo.usbVendorId}:${portInfo.usbProductId}` : 
                'unknown';
            option.textContent = portInfo.usbVendorId ? 
                `USB Serial Device (VID:${portInfo.usbVendorId} PID:${portInfo.usbProductId})` : 
                'Serial Port';
            portSelect.appendChild(option);
        }

        if (ports.length === 0) {
            addOutputLine('> No serial ports detected');
        } else {
            addOutputLine(`> Found ${ports.length} serial port(s)`);
        }
    }

    // Request port access and update list
    async function requestPort() {
        try {
            port = await navigator.serial.requestPort();
            await updatePorts();
            // Auto-select the newly added port
            const portInfo = await port.getInfo();
            const portValue = portInfo.usbVendorId ? 
                `${portInfo.usbVendorId}:${portInfo.usbProductId}` : 
                'unknown';
            portSelect.value = portValue;
            addOutputLine('> Port selected successfully');
            return true;
        } catch (err) {
            addOutputLine(`> Error selecting port: ${err.message}`);
            return false;
        }
    }

    // Read from serial port
    async function readFromSerial() {
        while (port && port.readable && isConnected) {
            try {
                reader = port.readable.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        break;
                    }
                    const text = decoder.decode(value);
                    addSerialLine(text);
                }
            } catch (err) {
                addSerialLine(`Error reading from serial: ${err.message}`);
            } finally {
                if (reader) {
                    reader.releaseLock();
                }
            }
        }
    }

    // Connect to the selected port
    async function connectToPort() {
        if (!port) {
            const success = await requestPort();
            if (!success) return;
        }

        try {
            await port.open({ baudRate: 115200 });
            isConnected = true;
            connectButton.textContent = 'Connected';
            connectButton.classList.toggle('primary');
            connectButton.classList.toggle('success');
            updateProgramButton();
            portSelect.disabled = true;
            serialInput.disabled = false;
            serialSendButton.disabled = false;
            addOutputLine('> Connected to device');
            
            // Start reading from serial
            readFromSerial();
            
            // Set up writer
            writer = port.writable.getWriter();
        } catch (err) {
            addOutputLine(`> Error connecting to port: ${err.message}`);
            isConnected = false;
        }
    }

    // Update program button state
    function updateProgramButton() {
        programButton.disabled = !isConnected || !selectedFirmware;
    }

    // Event Handlers
    connectButton.addEventListener('click', async () => {
        if (!isConnected) {
            await connectToPort();
        } else {
            try {
                if (reader) {
                    reader.cancel();
                }
                if (writer) {
                    writer.releaseLock();
                }
                await port.close();
                isConnected = false;
                connectButton.textContent = 'Connect';
                connectButton.classList.toggle('primary');
                connectButton.classList.toggle('success');
                updateProgramButton();
                portSelect.disabled = false;
                serialInput.disabled = true;
                serialSendButton.disabled = true;
                addOutputLine('> Disconnected from device');
            } catch (err) {
                addOutputLine(`> Error disconnecting: ${err.message}`);
            }
        }
    });

    programButton.addEventListener('click', async () => {
        if (!isConnected || !selectedFirmware) return;

        addOutputLine('> Starting flash process...');
        
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    addOutputLine('> Uploading firmware...');
                    // Here you would implement the actual firmware upload logic
                    // For now, we'll simulate the process
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    addOutputLine('> Flash complete! Device ready.');
                } catch (err) {
                    addOutputLine(`> Error during flash: ${err.message}`);
                }
            };
            reader.onerror = () => {
                addOutputLine('> Error reading firmware file');
            };
            reader.readAsArrayBuffer(selectedFirmware);
        } catch (err) {
            addOutputLine(`> Error preparing firmware: ${err.message}`);
        }
    });

    clearButton.addEventListener('click', () => {
        outputLines = [];
        updateOutput();
    });

    serialClearButton.addEventListener('click', () => {
        serialLines = [];
        updateSerialOutput();
    });

    // Serial input handling
    serialSendButton.addEventListener('click', async () => {
        const text = serialInput.value;
        if (text && isConnected && writer) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(text + '\n');
                await writer.write(data);
                serialInput.value = '';
            } catch (err) {
                addSerialLine(`Error sending data: ${err.message}`);
            }
        }
    });

    serialInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            serialSendButton.click();
        }
    });

    // File input handling
    firmwareFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.name.toLowerCase().endsWith('.bin')) {
                selectedFirmware = file;
                addOutputLine(`> Selected firmware: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
                updateProgramButton();
            } else {
                addOutputLine('> Error: Please select a valid .bin file');
                event.target.value = '';
                selectedFirmware = null;
                updateProgramButton();
            }
        } else {
            selectedFirmware = null;
            updateProgramButton();
        }
    });

    // Initial port list update
    updatePorts();

    // Listen for connect/disconnect events
    navigator.serial.addEventListener('connect', (event) => {
        addOutputLine('> Serial device connected');
        updatePorts();
    });

    navigator.serial.addEventListener('disconnect', (event) => {
        addOutputLine('> Serial device disconnected');
        if (isConnected) {
            isConnected = false;
            connectButton.textContent = 'Connect';
            connectButton.classList.toggle('primary');
            connectButton.classList.toggle('success');
            updateProgramButton();
            portSelect.disabled = false;
            serialInput.disabled = true;
            serialSendButton.disabled = true;
        }
        updatePorts();
    });
});
