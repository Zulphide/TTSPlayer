// Global variables
        let wordsData = [];
        let currentIndex = 0;
        let playing = false;
        let paused = false;
        let synth = window.speechSynthesis;
        let currentUtterance = null;
        let playbackQueue = [];
        let isProcessingQueue = false;
        let autoPlayAllWords = true;

        // DOM Elements
        const loadBtn = document.getElementById('loadBtn');
        const sheetUrl = document.getElementById('sheetUrl');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const speedControl = document.getElementById('speedControl');
        const pauseDelay = document.getElementById('pauseDelay');
        const currentWordInput = document.getElementById('currentWord');
        const progressBar = document.getElementById('progressBar');
        const status = document.getElementById('status');
        const errorMsg = document.getElementById('errorMsg');
        const wordCounter = document.getElementById('wordCounter');
        const playAllWords = document.getElementById('playAllWords');
        
        // Language checkboxes
        const playEnglish = document.getElementById('playEnglish');
        const playChinese = document.getElementById('playChinese');
        const playSpanish = document.getElementById('playSpanish');

        // Word display elements
        const wordEn = document.getElementById('wordEn');
        const wordCn = document.getElementById('wordCn');
        const wordPinyin = document.getElementById('wordPinyin');
        const wordTone = document.getElementById('wordTone');
        const sentenceEn = document.getElementById('sentenceEn');
        const sentenceCn = document.getElementById('sentenceCn');
        const sentencePinyin = document.getElementById('sentencePinyin');
        const sentenceSp = document.getElementById('sentenceSp');

        // Function to parse CSV data
        function parseCSV(csv) {
            const lines = csv.split('\n');
            const result = [];
            const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''));

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                // Handle commas within quotes correctly
                const values = [];
                let currentValue = '';
                let insideQuotes = false;
                
                for (let char of lines[i]) {
                    if (char === '"') {
                        insideQuotes = !insideQuotes;
                    } else if (char === ',' && !insideQuotes) {
                        values.push(currentValue.replace(/^"|"$/g, ''));
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue.replace(/^"|"$/g, ''));
                
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] || '';
                });
                result.push(obj);
            }
            return result;
        }

        // Add Papa Parse loading mechanism (which has better CORS handling)
        function loadWithPapaParse(url) {
            status.textContent = 'Loading with Papa Parse...';
            
            // Check if we need to use a proxy
            let fetchUrl = url;
            
            // If Papa Parse alone doesn't work due to CORS, try these alternative proxies
            if (!url.includes('cors-anywhere') && !url.includes('corsproxy.io')) {
                // Create backup URLs with different proxies for fallback
                const proxies = [
                    url, // Try direct first
                    'https://corsproxy.io/?' + encodeURIComponent(url),
                    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
                ];
                
                // Try each proxy in sequence until one works
                tryNextProxy(proxies, 0);
                return;
            }
            
            // If URL already includes a proxy, just try to parse it
            Papa.parse(fetchUrl, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.data && results.data.length > 0) {
                        wordsData = results.data;
                        updateUI();
                        currentWordInput.max = wordsData.length;
                        updateProgress();
                        status.textContent = `Loaded ${wordsData.length} words`;
                        errorMsg.textContent = '';
                    } else {
                        displayError("No data found in the sheet");
                    }
                },
                error: function(error) {
                    displayError(`Papa Parse error: ${error}`);
                    console.error('Papa Parse error:', error);
                }
            });
        }
        
        // Try loading with different proxies until one works
        function tryNextProxy(proxies, index) {
            if (index >= proxies.length) {
                displayError("Failed to load data with all available methods");
                return;
            }
            
            status.textContent = `Trying loading method ${index + 1}...`;
            
            Papa.parse(proxies[index], {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.data && results.data.length > 0) {
                        wordsData = results.data;
                        updateUI();
                        currentWordInput.max = wordsData.length;
                        updateProgress();
                        status.textContent = `Loaded ${wordsData.length} words successfully`;
                        errorMsg.textContent = '';
                    } else {
                        // Try next proxy
                        tryNextProxy(proxies, index + 1);
                    }
                },
                error: function(error) {
                    console.error(`Proxy ${index + 1} failed:`, error);
                    // Try next proxy
                    tryNextProxy(proxies, index + 1);
                }
            });
        }

        // Function to load data from Google Sheets
        function loadSheetData(url) {
            // Check if URL is already a published CSV URL
            let fetchUrl = url;
            
            // If it's a standard Google Sheets URL, convert to export URL
            if (url.includes('/d/') || url.includes('spreadsheets')) {
                // Extract the sheet ID from the URL
                let sheetId;
                if (url.includes('/d/')) {
                    sheetId = url.split('/d/')[1].split('/')[0];
                } else if (url.includes('key=')) {
                    sheetId = url.split('key=')[1].split('&')[0];
                } else {
                    displayError("Invalid Google Sheet URL");
                    return;
                }
                
                // Construct the export URL
                fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            }
            
            // Use CORS proxy to avoid cross-origin issues
            const corsProxyUrl = 'https://corsproxy.io/?';
            const proxyFetchUrl = corsProxyUrl + encodeURIComponent(fetchUrl);
            
            status.textContent = 'Loading data through CORS proxy...';
            
            fetch(proxyFetchUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load sheet data: ${response.status}`);
                    }
                    return response.text();
                })
                .then(csv => {
                    try {
                        wordsData = parseCSV(csv);
                        
                        if (wordsData.length > 0) {
                            updateUI();
                            currentWordInput.max = wordsData.length;
                            updateProgress();
                            status.textContent = `Loaded ${wordsData.length} words`;
                            errorMsg.textContent = '';
                        } else {
                            displayError("No data found in the sheet");
                        }
                    } catch (e) {
                        displayError(`Error parsing data: ${e.message}`);
                    }
                })
                .catch(error => {
                    displayError(`Error: ${error.message}`);
                    console.error('Error loading sheet data:', error);
                    // Try with Papa Parse as a fallback
                    loadWithPapaParse(url);
                });
        }

        function displayError(message) {
            errorMsg.textContent = message;
            status.textContent = 'Error loading data';
        }

        // Update the display with current word data
        function updateUI() {
            if (wordsData.length === 0) return;
            
            const currentWord = wordsData[currentIndex];
            
            // Update word info
            wordEn.textContent = currentWord['Word EN'] || '';
            wordCn.textContent = currentWord['Word CN'] || '';
            wordPinyin.textContent = currentWord['Word PinYin'] || '';
            wordTone.textContent = currentWord['Word Tone'] || '';
            
            // Update sentences
            sentenceEn.textContent = currentWord['English Sentence'] || '';
            sentenceCn.textContent = currentWord['Chinese Sentence'] || '';
            sentencePinyin.textContent = currentWord['PinYin Sentence'] || '';
            sentenceSp.textContent = currentWord['Spanish Sentence'] || '';
            
            // Update counter and input
            wordCounter.textContent = `Word ${currentIndex + 1} of ${wordsData.length}`;
            currentWordInput.value = currentIndex + 1;
            
            updateProgress();
        }

        // Update the progress bar
        function updateProgress() {
            const progress = ((currentIndex + 1) / wordsData.length) * 100;
            progressBar.style.width = `${progress}%`;
        }

        // Play TTS for text in specified language
        function speak(text, lang, callback) {
            if (!text) {
                if (callback) callback();
                return;
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = parseFloat(speedControl.value);
            
            currentUtterance = utterance;
            
            utterance.onend = function() {
                currentUtterance = null;
                if (callback) callback();
            };
            
            utterance.onerror = function() {
                console.error(`TTS error for language: ${lang}`);
                currentUtterance = null;
                if (callback) callback();
            };
            
            synth.speak(utterance);
        }

        // Process the playback queue
        function processQueue() {
            if (isProcessingQueue || playbackQueue.length === 0 || paused) return;
            
            isProcessingQueue = true;
            const item = playbackQueue.shift();
            
            if (item.type === 'speak') {
                status.textContent = `Speaking: ${item.text.substring(0, 30)}... (${item.language})`;
                speak(item.text, item.language, () => {
                    setTimeout(() => {
                        isProcessingQueue = false;
                        processQueue();
                    }, parseInt(pauseDelay.value));
                });
            } else if (item.type === 'action') {
                item.action();
                setTimeout(() => {
                    isProcessingQueue = false;
                    processQueue();
                }, parseInt(pauseDelay.value));
            }
        }

        // Queue TTS item
        function queueTTS(text, language) {
            playbackQueue.push({
                type: 'speak',
                text: text,
                language: language
            });
            
            if (!isProcessingQueue) {
                processQueue();
            }
        }

        // Queue an action
        function queueAction(action) {
            playbackQueue.push({
                type: 'action',
                action: action
            });
            
            if (!isProcessingQueue) {
                processQueue();
            }
        }

        // Play the current word sequence
        function playCurrentWord() {
            if (wordsData.length === 0) {
                status.textContent = 'No data loaded';
                return;
            }
            
            const currentWord = wordsData[currentIndex];
            
            // Clear any existing queue
            playbackQueue = [];
            
            // Add items to queue based on selected languages
            // Read "Word EN", "Word CN", "Word Tone" in English
            if (playEnglish.checked) {
                queueTTS(currentWord['Word EN'] || '', 'en-US');
            }
            
            if (playChinese.checked) {
                queueTTS(currentWord['Word CN'] || '', 'zh-CN');
            }
            
            queueTTS(`Tone: ${currentWord['Word Tone'] || ''}`, 'en-US');
            
            // Read "Word CN" again in Chinese
            if (playChinese.checked) {
                queueTTS(currentWord['Word CN'] || '', 'zh-CN');
            }
            
            // Read sentences
            if (playEnglish.checked) {
                queueTTS(currentWord['English Sentence'] || '', 'en-US');
            }
            
            if (playChinese.checked) {
                queueTTS(currentWord['Chinese Sentence'] || '', 'zh-CN');
            }
            
            if (playSpanish.checked) {
                queueTTS(currentWord['Spanish Sentence'] || '', 'es-mx');
            }
            
            // Move to next word after completion if still playing and auto-play is enabled
            queueAction(() => {
                if (playing && !paused && autoPlayAllWords && currentIndex < wordsData.length - 1) {
                    currentIndex++;
                    updateUI();
                    playCurrentWord();
                } else if (playing && !paused && (currentIndex >= wordsData.length - 1 || !autoPlayAllWords)) {
                    // Reached end of list or auto-play is disabled
                    if (!autoPlayAllWords) {
                        status.textContent = 'Current word playback completed';
                    } else {
                        status.textContent = 'All words playback completed';
                        playing = false;
                    }
                }
            });
        }

        // Play button click handler
        playBtn.addEventListener('click', () => {
            if (wordsData.length === 0) {
                status.textContent = 'No data loaded';
                return;
            }
            
            playing = true;
            paused = false;
            status.textContent = 'Playing...';
            
            // If paused, resume the queue processing
            if (isProcessingQueue) {
                if (currentUtterance) {
                    synth.resume();
                }
                processQueue();
            } else {
                // Start fresh playback
                playCurrentWord();
            }
        });

        // Pause button click handler
        pauseBtn.addEventListener('click', () => {
            if (playing) {
                paused = !paused;
                
                if (paused) {
                    status.textContent = 'Paused';
                    if (currentUtterance) {
                        synth.pause();
                    }
                } else {
                    status.textContent = 'Resuming...';
                    if (currentUtterance) {
                        synth.resume();
                    }
                    processQueue();
                }
            }
        });

        // Stop button click handler
        stopBtn.addEventListener('click', () => {
            playing = false;
            paused = false;
            playbackQueue = [];
            synth.cancel();
            status.textContent = 'Stopped';
            isProcessingQueue = false;
            currentUtterance = null;
        });

        // Previous button click handler
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                updateUI();
                
                if (playing) {
                    stopBtn.click();
                    setTimeout(() => {
                        playBtn.click();
                    }, 100);
                }
            }
        });

        // Next button click handler
        nextBtn.addEventListener('click', () => {
            if (currentIndex < wordsData.length - 1) {
                currentIndex++;
                updateUI();
                
                if (playing) {
                    stopBtn.click();
                    setTimeout(() => {
                        playBtn.click();
                    }, 100);
                }
            }
        });

        // Current word input change handler
        currentWordInput.addEventListener('change', () => {
            const newIndex = parseInt(currentWordInput.value) - 1;
            
            if (newIndex >= 0 && newIndex < wordsData.length) {
                currentIndex = newIndex;
                updateUI();
                
                if (playing) {
                    stopBtn.click();
                    setTimeout(() => {
                        playBtn.click();
                    }, 100);
                }
            }
        });

        // Load button click handler
        loadBtn.addEventListener('click', () => {
            const url = sheetUrl.value.trim();
            
            if (url) {
                status.textContent = 'Loading data...';
                // Try PapaParse first which has better CORS handling
                loadWithPapaParse(url);
            } else {
                displayError('Please enter a Google Sheet CSV URL');
            }
        });

        // Check if speech synthesis is available
        if (!window.speechSynthesis) {
            displayError('Speech synthesis is not supported in your browser');
            playBtn.disabled = true;
            pauseBtn.disabled = true;
            stopBtn.disabled = true;
        }

        // Set up event listener for auto-play toggle
        playAllWords.addEventListener('change', () => {
            autoPlayAllWords = playAllWords.checked;
            if (autoPlayAllWords) {
                status.textContent = 'Auto-play all words enabled';
            } else {
                status.textContent = 'Playing current word only';
            }
        });
        
        // Initialize with sample data URL for CSV
        sheetUrl.value = "";

document.getElementById("sheetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const sheetUrl = document.getElementById("sheetUrl").value;
    const proxyUrl = "https://api.allorigins.win/get?url=";
    const fullUrl = proxyUrl + encodeURIComponent(sheetUrl);

    fetch(fullUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then(data => {
            const csvContent = data.contents;
            Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    console.log("Parsed data:", results.data);
                    // Process the data...
                },
                error: function (error) {
                    console.error("Papa Parse error:", error);
                }
            });
        })
        .catch(error => {
            console.error("Fetch error:", error);
        });
});