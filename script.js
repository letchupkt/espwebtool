document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectBtn');
    const outputContent = document.querySelector('.output-content');
    const themeToggle = document.querySelector('.theme-toggle');
    let isConnected = false;

    // Theme Management
    const getCurrentTheme = () => document.documentElement.getAttribute('data-theme');
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    };

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Theme toggle handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = getCurrentTheme();
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // Typing effect for output messages
    const typeMessage = (element, message, speed = 50) => {
        let i = 0;
        element.textContent = '';
        return new Promise(resolve => {
            const typing = setInterval(() => {
                if (i < message.length) {
                    element.textContent += message.charAt(i);
                    i++;
                } else {
                    clearInterval(typing);
                    resolve();
                }
            }, speed);
        });
    };

    // Check if Web Serial API is available
    if (!('serial' in navigator)) {
        typeMessage(outputContent, 'Web Serial API is not supported in your browser. Please use Chrome or Edge.');
        connectBtn.disabled = true;
        return;
    }

    // Add hover effect to instructions
    const instructions = document.querySelectorAll('.instructions li');
    instructions.forEach(li => {
        li.addEventListener('mouseenter', () => {
            li.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
        });
        li.addEventListener('mouseleave', () => {
            li.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
        });
    });

    // Settings panel functionality
    const settingsIcon = document.querySelector('.settings-icon');
    settingsIcon.addEventListener('click', () => {
        settingsIcon.style.transform = 'rotate(180deg)';
        setTimeout(() => {
            settingsIcon.style.transform = 'rotate(0deg)';
            alert('Settings panel coming soon!');
        }, 500);
    });

    connectBtn.addEventListener('click', async () => {
        try {
            if (!isConnected) {
                // Request port access
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });
                
                isConnected = true;
                connectBtn.style.backgroundColor = 'var(--disconnect-btn-bg)';
                connectBtn.textContent = 'DISCONNECT';
                await typeMessage(outputContent, 'Connected successfully!\nWaiting for ESP device...');
                
                // Set up the reading loop
                while (port.readable) {
                    const reader = port.readable.getReader();
                    try {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            const text = new TextDecoder().decode(value);
                            outputContent.textContent += text;
                            outputContent.scrollTop = outputContent.scrollHeight;
                        }
                    } catch (error) {
                        console.error('Error reading data:', error);
                    } finally {
                        reader.releaseLock();
                    }
                }
            } else {
                // Disconnect logic
                isConnected = false;
                connectBtn.style.backgroundColor = 'var(--connect-btn-bg)';
                connectBtn.textContent = 'CONNECT';
                await typeMessage(outputContent, 'Disconnected. Click Connect to start.');
            }
        } catch (error) {
            console.error('Error:', error);
            await typeMessage(outputContent, `Error: ${error.message}`);
        }
    });

    // Terminal button animation and functionality
    const terminalBtn = document.querySelector('.terminal-btn');
    terminalBtn.addEventListener('click', () => {
        terminalBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            terminalBtn.style.transform = 'scale(1)';
            window.open('terminal.html', '_blank', 'width=800,height=600');
        }, 100);
    });

    // Help button functionality
    const helpBtn = document.querySelector('.help-btn');
    helpBtn.addEventListener('click', () => {
        helpBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            helpBtn.style.transform = 'scale(1)';
            window.open('https://docs.espressif.com/', '_blank');
        }, 100);
    });

    // More tools button functionality
    const moreToolsBtn = document.querySelector('.more-tools-btn');
    moreToolsBtn.addEventListener('click', () => {
        moreToolsBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            moreToolsBtn.style.transform = 'scale(1)';
            window.open('https://www.espressif.com/en/products/software/esp-idf', '_blank');
        }, 100);
    });
});