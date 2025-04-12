import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Upload, Moon, Sun, Cpu, Zap } from 'lucide-react';

function App() {
  const [isDark, setIsDark] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const serialRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const serialMonitorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    // Auto-scroll to bottom when new output is added
    if (serialMonitorRef.current) {
      serialMonitorRef.current.scrollTop = serialMonitorRef.current.scrollHeight;
    }
  }, [serialOutput]);

  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialRef.current = port;
      writerRef.current = port.writable.getWriter();
      setIsConnected(true);
      startReading();
      addToLog('Connected to device');
    } catch (err) {
      console.error('Error connecting to serial port:', err);
      addToLog('Failed to connect to device');
    }
  };

  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSerialOutput(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const startReading = async () => {
    if (!serialRef.current) return;

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialRef.current.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        // Split the incoming data by newlines and add timestamp
        const lines = value.split('\n').filter(line => line.trim() !== '');
        const timestamp = new Date().toLocaleTimeString();
        lines.forEach(line => {
          setSerialOutput(prev => [...prev, `[${timestamp}] ${line}`]);
        });
      }
    } catch (err) {
      console.error('Error reading serial:', err);
      addToLog('Error reading from device');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.bin') || file.name.endsWith('.BIN'))) {
      setSelectedFile(file);
      addToLog(`Selected firmware: ${file.name}`);
    } else {
      alert('Please select a valid .bin file');
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sendCommand = async (command: Uint8Array): Promise<void> => {
    if (!writerRef.current) return;
    await writerRef.current.write(command);
  };

  const enterBootloader = async () => {
    if (!serialRef.current || !writerRef.current) return false;
    
    try {
      // Reset ESP into bootloader mode
      await serialRef.current.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(100);
      await serialRef.current.setSignals({ dataTerminalReady: true, requestToSend: false });
      await sleep(50);
      await serialRef.current.setSignals({ dataTerminalReady: false });
      
      // Send sync command
      const syncCommand = new Uint8Array([0x7f]); // Sync byte
      await sendCommand(syncCommand);
      await sleep(100);
      
      addToLog('Device entered bootloader mode');
      return true;
    } catch (err) {
      console.error('Error entering bootloader mode:', err);
      addToLog('Failed to enter bootloader mode');
      return false;
    }
  };

  const flashFirmware = async () => {
    if (!selectedFile || !serialRef.current || !writerRef.current) return;
    
    try {
      setIsFlashing(true);
      addToLog('Starting firmware flash process...');

      // Enter bootloader mode
      const bootloaderSuccess = await enterBootloader();
      if (!bootloaderSuccess) {
        throw new Error('Failed to enter bootloader mode');
      }

      // Read the firmware file
      const firmware = await selectedFile.arrayBuffer();
      const totalSize = firmware.byteLength;
      const chunkSize = 1024; // Flash in 1KB chunks
      const totalChunks = Math.ceil(totalSize / chunkSize);

      // Flash firmware in chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunk = new Uint8Array(firmware.slice(start, end));
        
        // Send chunk to ESP
        await sendCommand(chunk);
        await sleep(50); // Wait for chunk to be processed
        
        const progress = Math.round((i + 1) / totalChunks * 100);
        setFlashProgress(progress);
        addToLog(`Flashing: ${progress}%`);
      }

      // Reset device
      await sleep(100);
      await serialRef.current.setSignals({ dataTerminalReady: false });
      await sleep(100);
      await serialRef.current.setSignals({ dataTerminalReady: true });
      
      addToLog('Firmware flashed successfully!');
      setFlashProgress(0);
    } catch (err) {
      console.error('Error flashing firmware:', err);
      addToLog('Error flashing firmware: ' + (err as Error).message);
    } finally {
      setIsFlashing(false);
    }
  };

  const clearSerialOutput = () => {
    setSerialOutput([]);
    addToLog('Serial monitor cleared');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <nav className="bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-900 dark:to-blue-900 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Synq ESP Web Tool</h1>
              <p className="text-xs text-purple-200">by Synq Technologies</p>
            </div>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <main className="container mx-auto p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <section className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-purple-600 dark:text-purple-400">
                <Upload className="w-5 h-5 mr-2" />
                Firmware Upload
              </h2>
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".bin"
                  onChange={handleFileChange}
                  disabled={isFlashing}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0 file:text-sm file:font-semibold
                    file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100
                    dark:file:bg-purple-900/30 dark:file:text-purple-300
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="space-y-2">
                  {isFlashing && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${flashProgress}%` }}
                      ></div>
                    </div>
                  )}
                  <button
                    onClick={flashFirmware}
                    disabled={!selectedFile || !isConnected || isFlashing}
                    className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 
                      hover:from-purple-700 hover:to-blue-700 text-white rounded-lg
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 
                      disabled:hover:to-blue-600 transition-all duration-300"
                  >
                    {isFlashing ? 'Flashing...' : 'Flash Firmware'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">Device Connection</h2>
              <button
                onClick={connectSerial}
                disabled={isFlashing}
                className={`w-full py-2 px-4 rounded-lg transition-all duration-300 ${
                  isConnected
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isConnected ? 'Connected' : 'Connect Device'}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center text-purple-600 dark:text-purple-400">
                  <Terminal className="w-5 h-5 mr-2" />
                  Serial Monitor
                </h2>
                <button
                  onClick={clearSerialOutput}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Clear
                </button>
              </div>
              <div
                ref={serialMonitorRef}
                className="flex-1 bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-auto border border-gray-700"
              >
                {serialOutput.length === 0 ? (
                  <div className="text-gray-500">Waiting for serial output...</div>
                ) : (
                  <div className="space-y-1">
                    {serialOutput.map((line, i) => (
                      <div
                        key={i}
                        className={`font-mono ${
                          line.includes('Error') || line.includes('Failed')
                            ? 'text-red-400'
                            : line.includes('Success') || line.includes('Connected')
                            ? 'text-green-400'
                            : line.includes('Flashing:')
                            ? 'text-yellow-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          <p>© 2025 Synq Technologies. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;