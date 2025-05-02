document.addEventListener('DOMContentLoaded', function () {
    // Create a connection to the background script
    const port = chrome.runtime.connect({ name: "settings" });

    // Default settings
    const defaultSettings = {
        scrollThreshold: 20,
        scrollSensitivity: 1.0,
        scrollDecay: 0.95,
        maxScrollSpeed: 50,
        gestureDebounce: 500,
        pinchThreshold: 0.1,
        showStatusIndicator: true,
        showVisualFeedback: true
    };

    // Get all input elements
    const scrollThresholdInput = document.getElementById('scrollThreshold');
    const scrollThresholdValue = document.getElementById('scrollThresholdValue');
    const scrollSensitivityInput = document.getElementById('scrollSensitivity');
    const scrollSensitivityValue = document.getElementById('scrollSensitivityValue');
    const scrollDecayInput = document.getElementById('scrollDecay');
    const scrollDecayValue = document.getElementById('scrollDecayValue');
    const maxScrollSpeedInput = document.getElementById('maxScrollSpeed');
    const maxScrollSpeedValue = document.getElementById('maxScrollSpeedValue');
    const gestureDebounceInput = document.getElementById('gestureDebounce');
    const gestureDebounceValue = document.getElementById('gestureDebounceValue');
    const pinchThresholdInput = document.getElementById('pinchThreshold');
    const pinchThresholdValue = document.getElementById('pinchThresholdValue');
    const showStatusIndicatorInput = document.getElementById('showStatusIndicator');
    const showVisualFeedbackInput = document.getElementById('showVisualFeedback');

    // Add the reset visual feedback button if present
    const resetVisualFeedbackBtn = document.getElementById('resetVisualFeedback');

    // Load settings
    function loadSettings() {
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || defaultSettings;

            // Update UI with loaded settings
            scrollThresholdInput.value = settings.scrollThreshold;
            scrollThresholdValue.textContent = settings.scrollThreshold;

            scrollSensitivityInput.value = settings.scrollSensitivity;
            scrollSensitivityValue.textContent = settings.scrollSensitivity.toFixed(1);

            // Initialize new scroll velocity parameters
            scrollDecayInput.value = settings.scrollDecay !== undefined ?
                settings.scrollDecay : defaultSettings.scrollDecay;
            scrollDecayValue.textContent = parseFloat(scrollDecayInput.value).toFixed(2);

            maxScrollSpeedInput.value = settings.maxScrollSpeed !== undefined ?
                settings.maxScrollSpeed : defaultSettings.maxScrollSpeed;
            maxScrollSpeedValue.textContent = maxScrollSpeedInput.value;

            gestureDebounceInput.value = settings.gestureDebounce;
            gestureDebounceValue.textContent = settings.gestureDebounce;

            pinchThresholdInput.value = settings.pinchThreshold;
            pinchThresholdValue.textContent = settings.pinchThreshold.toFixed(2);

            showStatusIndicatorInput.checked = settings.showStatusIndicator;

            // Set visual feedback checkbox (default to true if not set)
            showVisualFeedbackInput.checked = settings.showVisualFeedback !== undefined ?
                settings.showVisualFeedback : true;
        });
    }

    // Safe way to send messages to tabs
    function sendMessageToActiveTab(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs && tabs[0] && tabs[0].id) {
                try {
                    chrome.tabs.sendMessage(tabs[0].id, message, function (response) {
                        if (chrome.runtime.lastError) {
                            console.log('Error sending message to tab:', chrome.runtime.lastError.message);
                            // Message failed, but we can continue without disrupting the user
                        }
                    });
                } catch (e) {
                    console.error('Failed to send message to tab:', e);
                }
            }
        });
    }

    // Send messages to all tabs
    function sendMessageToAllTabs(message) {
        chrome.tabs.query({}, function (tabs) {
            for (let tab of tabs) {
                try {
                    chrome.tabs.sendMessage(tab.id, message, function (response) {
                        if (chrome.runtime.lastError) {
                            // Ignore errors - some tabs may not have content scripts
                            console.log(`Message failed for tab ${tab.id}: ${chrome.runtime.lastError.message}`);
                        }
                    });
                } catch (e) {
                    console.error('Failed to send message to tab:', e);
                }
            }
        });
    }

    // Save settings
    function saveSettings() {
        const settings = {
            scrollThreshold: parseInt(scrollThresholdInput.value),
            scrollSensitivity: parseFloat(scrollSensitivityInput.value),
            scrollDecay: parseFloat(scrollDecayInput.value),
            maxScrollSpeed: parseInt(maxScrollSpeedInput.value),
            gestureDebounce: parseInt(gestureDebounceInput.value),
            pinchThreshold: parseFloat(pinchThresholdInput.value),
            showStatusIndicator: showStatusIndicatorInput.checked,
            showVisualFeedback: showVisualFeedbackInput.checked
        };

        chrome.storage.local.set({ settings: settings }, function () {
            // Show a save confirmation
            const saveButton = document.getElementById('saveSettings');
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Saved!';
            saveButton.style.backgroundColor = '#2196F3';

            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.backgroundColor = '';
            }, 1500);

            // Notify content script of updated settings
            sendMessageToActiveTab({
                action: 'updateSettings',
                settings: settings
            });
        });
    }

    // Reset settings to defaults
    function resetSettings() {
        // Update UI with default settings
        scrollThresholdInput.value = defaultSettings.scrollThreshold;
        scrollThresholdValue.textContent = defaultSettings.scrollThreshold;

        scrollSensitivityInput.value = defaultSettings.scrollSensitivity;
        scrollSensitivityValue.textContent = defaultSettings.scrollSensitivity.toFixed(1);

        scrollDecayInput.value = defaultSettings.scrollDecay;
        scrollDecayValue.textContent = defaultSettings.scrollDecay.toFixed(2);

        maxScrollSpeedInput.value = defaultSettings.maxScrollSpeed;
        maxScrollSpeedValue.textContent = defaultSettings.maxScrollSpeed;

        gestureDebounceInput.value = defaultSettings.gestureDebounce;
        gestureDebounceValue.textContent = defaultSettings.gestureDebounce;

        pinchThresholdInput.value = defaultSettings.pinchThreshold;
        pinchThresholdValue.textContent = defaultSettings.pinchThreshold.toFixed(2);

        showStatusIndicatorInput.checked = defaultSettings.showStatusIndicator;
        showVisualFeedbackInput.checked = defaultSettings.showVisualFeedback;

        // Save the default settings
        chrome.storage.local.set({ settings: defaultSettings }, function () {
            // Show reset confirmation
            const resetButton = document.getElementById('resetSettings');
            const originalText = resetButton.textContent;
            resetButton.textContent = 'Reset Complete!';

            setTimeout(() => {
                resetButton.textContent = originalText;
            }, 1500);

            // Notify content script of updated settings
            sendMessageToActiveTab({
                action: 'updateSettings',
                settings: defaultSettings
            });
        });
    }

    // Reset just the visual feedback
    function resetVisualFeedback() {
        // Get current settings
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || defaultSettings;

            // Force visual feedback to true
            settings.showVisualFeedback = true;
            showVisualFeedbackInput.checked = true;

            // Save the updated settings
            chrome.storage.local.set({ settings: settings }, function () {
                // Show confirmation
                const button = document.getElementById('resetVisualFeedback');
                const originalText = button.textContent;
                button.textContent = 'Visual Feedback Reset!';
                button.style.backgroundColor = '#9C27B0';

                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = '';
                }, 1500);

                // Send message to force show visual feedback to all tabs
                sendMessageToAllTabs({
                    action: 'forceShowFeedback'
                });
            });
        });
    }

    // Update display values when sliders change
    scrollThresholdInput.addEventListener('input', function () {
        scrollThresholdValue.textContent = this.value;
    });

    scrollSensitivityInput.addEventListener('input', function () {
        scrollSensitivityValue.textContent = parseFloat(this.value).toFixed(1);
    });

    scrollDecayInput.addEventListener('input', function () {
        scrollDecayValue.textContent = parseFloat(this.value).toFixed(2);
    });

    maxScrollSpeedInput.addEventListener('input', function () {
        maxScrollSpeedValue.textContent = this.value;
    });

    gestureDebounceInput.addEventListener('input', function () {
        gestureDebounceValue.textContent = this.value;
    });

    pinchThresholdInput.addEventListener('input', function () {
        pinchThresholdValue.textContent = parseFloat(this.value).toFixed(2);
    });

    // Save button event listener
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    // Reset button event listener
    document.getElementById('resetSettings').addEventListener('click', resetSettings);

    // Reset visual feedback button event listener
    if (resetVisualFeedbackBtn) {
        resetVisualFeedbackBtn.addEventListener('click', resetVisualFeedback);
    }

    // Add event listeners for diagnostic buttons
    const optimizeTrackingBtn = document.getElementById('optimizeTracking');
    const forceShowPanelBtn = document.getElementById('forceShowPanel');
    const restartTrackingBtn = document.getElementById('restartTracking');

    if (optimizeTrackingBtn) {
        optimizeTrackingBtn.addEventListener('click', optimizeHandTracking);
    }

    if (forceShowPanelBtn) {
        forceShowPanelBtn.addEventListener('click', forceShowPanels);
    }

    if (restartTrackingBtn) {
        restartTrackingBtn.addEventListener('click', restartHandTracking);
    }

    // Optimize hand tracking settings for better detection
    function optimizeHandTracking() {
        // Optimized settings for better hand detection
        const optimizedSettings = {
            scrollThreshold: 10,           // Lower threshold for more sensitive detection
            scrollSensitivity: 1.5,        // Higher sensitivity for more responsive scrolling
            scrollDecay: 0.92,             // Smoother decay for more natural scrolling
            maxScrollSpeed: 60,            // Higher max speed for better responsiveness
            gestureDebounce: 300,          // Faster gesture recognition
            pinchThreshold: 0.12,          // More lenient pinch detection
            showStatusIndicator: true,
            showVisualFeedback: true
        };

        // Update UI with optimized settings
        scrollThresholdInput.value = optimizedSettings.scrollThreshold;
        scrollThresholdValue.textContent = optimizedSettings.scrollThreshold;

        scrollSensitivityInput.value = optimizedSettings.scrollSensitivity;
        scrollSensitivityValue.textContent = optimizedSettings.scrollSensitivity.toFixed(1);

        scrollDecayInput.value = optimizedSettings.scrollDecay;
        scrollDecayValue.textContent = optimizedSettings.scrollDecay.toFixed(2);

        maxScrollSpeedInput.value = optimizedSettings.maxScrollSpeed;
        maxScrollSpeedValue.textContent = optimizedSettings.maxScrollSpeed;

        gestureDebounceInput.value = optimizedSettings.gestureDebounce;
        gestureDebounceValue.textContent = optimizedSettings.gestureDebounce;

        pinchThresholdInput.value = optimizedSettings.pinchThreshold;
        pinchThresholdValue.textContent = optimizedSettings.pinchThreshold.toFixed(2);

        showStatusIndicatorInput.checked = optimizedSettings.showStatusIndicator;
        showVisualFeedbackInput.checked = optimizedSettings.showVisualFeedback;

        // Save optimized settings
        chrome.storage.local.set({ settings: optimizedSettings }, function () {
            // Show optimization confirmation
            const button = optimizeTrackingBtn;
            const originalText = button.textContent;
            button.textContent = '✅ Optimization Applied!';

            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);

            // Notify content scripts of the updated settings
            sendMessageToAllTabs({
                action: 'updateSettings',
                settings: optimizedSettings
            });

            // Also force show the visual feedback panel
            sendMessageToAllTabs({
                action: 'forceShowFeedback'
            });
        });
    }

    // Force show visual feedback panels on all tabs
    function forceShowPanels() {
        // Update settings to ensure visual feedback is enabled
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || defaultSettings;
            settings.showVisualFeedback = true;
            showVisualFeedbackInput.checked = true;

            // Save the updated settings
            chrome.storage.local.set({ settings: settings }, function () {
                // Show confirmation
                const button = forceShowPanelBtn;
                const originalText = button.textContent;
                button.textContent = '📱 Forcing panels on all tabs...';

                // Send multiple messages to all tabs to ensure delivery
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        sendMessageToAllTabs({
                            action: 'forceShowFeedback'
                        });
                    }, i * 300);
                }

                // First make sure gestures are enabled
                chrome.storage.local.set({ enabled: true });

                setTimeout(() => {
                    button.textContent = '✅ Panels should now be visible!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                }, 1500);
            });
        });
    }

    // Restart the hand tracking system on the active tab
    function restartHandTracking() {
        const button = restartTrackingBtn;
        const originalText = button.textContent;
        button.textContent = '🔄 Restarting tracking...';

        // First disable the tracking
        sendMessageToActiveTab({
            action: 'toggleGestures',
            enabled: false
        });

        // Wait a moment for everything to shut down
        setTimeout(() => {
            // Then re-enable it
            sendMessageToActiveTab({
                action: 'toggleGestures',
                enabled: true
            });

            // And force show the panel
            setTimeout(() => {
                sendMessageToActiveTab({
                    action: 'forceShowFeedback'
                });

                button.textContent = '✅ Tracking restarted!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }, 500);
        }, 1000);
    }

    // Load settings when page loads
    loadSettings();
}); 