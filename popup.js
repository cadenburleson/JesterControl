document.addEventListener('DOMContentLoaded', function () {
    // Create a connection to the background script
    const port = chrome.runtime.connect({ name: "popup" });

    const gestureToggle = document.getElementById('gestureToggle');
    const statusElement = document.getElementById('status');
    const openSettingsLink = document.getElementById('openSettings');
    const toggleFeedbackBtn = document.getElementById('toggleFeedback');
    const emergencyShowBtn = document.getElementById('emergencyShowBtn');

    // Add another emergency reset button
    const emergencyResetBtn = document.createElement('button');
    emergencyResetBtn.id = 'emergencyResetBtn';
    emergencyResetBtn.innerHTML = '🚨 EMERGENCY RESET';
    emergencyResetBtn.style.cssText = `
        display: block;
        width: 100%;
        margin-top: 10px;
        padding: 10px;
        background-color: #F44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    // Insert the button just after the emergencyShowBtn
    if (emergencyShowBtn && emergencyShowBtn.parentNode) {
        emergencyShowBtn.parentNode.insertBefore(emergencyResetBtn, emergencyShowBtn.nextSibling);
    } else {
        // Fallback - insert after the feedback toggle
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(emergencyResetBtn);
        }
    }

    // Add a description label below the button
    const resetDescription = document.createElement('div');
    resetDescription.style.cssText = `
        font-size: 10px;
        color: #757575;
        text-align: center;
        margin-top: 5px;
        margin-bottom: 10px;
    `;
    resetDescription.textContent = 'Use if hand tracking is not responding correctly';

    if (emergencyResetBtn && emergencyResetBtn.parentNode) {
        emergencyResetBtn.parentNode.insertBefore(resetDescription, emergencyResetBtn.nextSibling);
    }

    // IMMEDIATELY try to force show visual feedback on all tabs
    forceShowVisualFeedbackOnAllTabs();

    // Try multiple times with increasing delays to ensure it shows
    setTimeout(forceShowVisualFeedbackOnAllTabs, 500);
    setTimeout(forceShowVisualFeedbackOnAllTabs, 1500);

    // Add emergency button click handler
    emergencyShowBtn.addEventListener('click', function () {
        this.textContent = '🔄 Forcing display...';
        this.style.backgroundColor = '#9C27B0';

        // Force show with additional message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs && tabs[0] && tabs[0].id) {
                // First make sure gestures are enabled
                chrome.storage.local.set({ enabled: true }, () => {
                    gestureToggle.checked = true;
                    updateStatus(true);

                    // Send multiple messages to ensure it gets through
                    sendMessageToActiveTab({
                        action: 'toggleGestures',
                        enabled: true
                    });

                    setTimeout(() => {
                        sendMessageToActiveTab({
                            action: 'forceShowFeedback'
                        });
                    }, 100);

                    // Update storage settings
                    chrome.storage.local.get(['settings'], function (result) {
                        const settings = result.settings || {};
                        settings.showVisualFeedback = true;
                        chrome.storage.local.set({ settings });
                        updateFeedbackButtonText(true);

                        // Provide visual feedback
                        setTimeout(() => {
                            emergencyShowBtn.textContent = '✅ Panel forced visible';
                            emergencyShowBtn.style.backgroundColor = '#4CAF50';

                            setTimeout(() => {
                                emergencyShowBtn.textContent = '🚨 Force Show Panel';
                                emergencyShowBtn.style.backgroundColor = '#FF5722';
                            }, 2000);
                        }, 500);
                    });
                });
            }
        });
    });

    // Load saved state
    chrome.storage.local.get(['enabled', 'settings'], function (result) {
        if (result.enabled !== undefined) {
            gestureToggle.checked = result.enabled;
            updateStatus(result.enabled);

            // Disable feedback button if gestures are disabled
            if (!result.enabled && toggleFeedbackBtn) {
                toggleFeedbackBtn.classList.add('btn-disabled');
                toggleFeedbackBtn.disabled = true;
            }
        }

        // Update button text based on current visual feedback state
        if (result.settings && toggleFeedbackBtn) {
            updateFeedbackButtonText(result.settings.showVisualFeedback !== undefined ?
                result.settings.showVisualFeedback : true);
        }

        // If gestures are enabled, force show visual feedback again
        if (result.enabled) {
            setTimeout(forceShowVisualFeedbackOnAllTabs, 500);
        }
    });

    // Safe way to send messages to tabs
    function sendMessageToActiveTab(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs && tabs[0] && tabs[0].id) {
                try {
                    chrome.tabs.sendMessage(tabs[0].id, message, function (response) {
                        if (chrome.runtime.lastError) {
                            console.log('Error sending message to tab:', chrome.runtime.lastError.message);
                            // Message failed, but we won't disrupt the user experience
                        }
                    });
                } catch (e) {
                    console.error('Failed to send message to tab:', e);
                }
            }
        });
    }

    // Send message to ALL tabs
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

    // Force show visual feedback on all tabs
    function forceShowVisualFeedbackOnAllTabs() {
        console.log("Forcing visual feedback on all tabs");

        // First update storage
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || {};
            settings.showVisualFeedback = true;
            chrome.storage.local.set({ settings }, function () {
                // Then send message to all tabs
                sendMessageToAllTabs({
                    action: 'forceShowFeedback'
                });
            });
        });

        // If toggle button exists, update its appearance
        if (toggleFeedbackBtn) {
            updateFeedbackButtonText(true);
        }
    }

    // Handle toggle changes
    gestureToggle.addEventListener('change', function () {
        const enabled = this.checked;

        // Save state
        chrome.storage.local.set({ enabled: enabled });

        // Send message to content script
        sendMessageToActiveTab({
            action: 'toggleGestures',
            enabled: enabled
        });

        updateStatus(enabled);

        // Update feedback button state
        if (toggleFeedbackBtn) {
            if (enabled) {
                toggleFeedbackBtn.classList.remove('btn-disabled');
                toggleFeedbackBtn.disabled = false;

                // When enabling gestures, check if we should also show visual feedback
                chrome.storage.local.get(['settings'], function (result) {
                    const settings = result.settings || {};
                    const shouldShowFeedback = settings.showVisualFeedback !== undefined ?
                        settings.showVisualFeedback : true;

                    // If feedback should be shown, force it to appear
                    if (shouldShowFeedback) {
                        setTimeout(() => {
                            sendMessageToActiveTab({
                                action: 'forceShowFeedback'
                            });
                        }, 500);
                    }
                });
            } else {
                toggleFeedbackBtn.classList.add('btn-disabled');
                toggleFeedbackBtn.disabled = true;
            }
        }
    });

    // Handle toggle feedback button
    if (toggleFeedbackBtn) {
        toggleFeedbackBtn.addEventListener('click', function () {
            if (this.disabled) return;

            chrome.storage.local.get(['settings'], function (result) {
                const settings = result.settings || {};
                const currentState = settings.showVisualFeedback !== undefined ?
                    settings.showVisualFeedback : true;

                // Toggle the state
                settings.showVisualFeedback = !currentState;

                // Save the new settings
                chrome.storage.local.set({ settings: settings }, function () {
                    // Update button text
                    updateFeedbackButtonText(!currentState);

                    if (!currentState) {
                        // We're turning ON visual feedback, send the force show message
                        sendMessageToActiveTab({
                            action: 'forceShowFeedback'
                        });
                    } else {
                        // We're turning OFF visual feedback, send normal update
                        sendMessageToActiveTab({
                            action: 'updateSettings',
                            settings: settings
                        });
                    }
                });
            });
        });

        // Add double-click handler to force show feedback
        toggleFeedbackBtn.addEventListener('dblclick', function (e) {
            if (this.disabled) return;

            // Force show feedback regardless of current state
            sendMessageToActiveTab({
                action: 'forceShowFeedback'
            });

            // Update UI and settings
            chrome.storage.local.get(['settings'], function (result) {
                const settings = result.settings || {};
                settings.showVisualFeedback = true;
                chrome.storage.local.set({ settings });
                updateFeedbackButtonText(true);
            });

            // Show temporary confirmation
            const originalBgColor = toggleFeedbackBtn.style.backgroundColor;
            toggleFeedbackBtn.style.backgroundColor = '#9C27B0';
            setTimeout(() => {
                toggleFeedbackBtn.style.backgroundColor = originalBgColor;
            }, 1000);
        });
    }

    // Update feedback button text
    function updateFeedbackButtonText(isVisible) {
        if (toggleFeedbackBtn) {
            if (isVisible) {
                toggleFeedbackBtn.innerHTML = '<span class="emoji">👁️</span> Hide Visual Feedback';
                toggleFeedbackBtn.style.backgroundColor = '#F44336';
            } else {
                toggleFeedbackBtn.innerHTML = '<span class="emoji">👁️</span> Show Visual Feedback';
                toggleFeedbackBtn.style.backgroundColor = '#4CAF50';
            }
        }
    }

    // Open settings page
    openSettingsLink.addEventListener('click', function (e) {
        e.preventDefault();
        chrome.tabs.create({ url: 'settings.html' });
    });

    function updateStatus(enabled) {
        statusElement.textContent = enabled ? 'Status: Active' : 'Status: Disabled';

        if (enabled) {
            statusElement.className = 'status active';
        } else {
            statusElement.className = 'status inactive';
        }
    }

    // Add event listener for the emergency reset button
    if (emergencyResetBtn) {
        emergencyResetBtn.addEventListener('click', function () {
            this.textContent = "🔄 Resetting...";
            this.disabled = true;
            this.style.backgroundColor = "#9E9E9E";

            // Get the active tab and tell it to run the emergency reset
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs && tabs[0]) {
                    // Send a reset command to the content script
                    chrome.tabs.sendMessage(tabs[0].id, { command: "emergencyReset" });

                    // Add some feedback in the popup
                    const statusElement = document.getElementById('status');
                    if (statusElement) {
                        statusElement.textContent = "🔄 Emergency reset initiated...";
                        statusElement.style.color = "#FF9800";
                    }
                }
            });

            // Re-enable the button after a delay
            setTimeout(() => {
                this.textContent = "🚨 EMERGENCY RESET";
                this.disabled = false;
                this.style.backgroundColor = "#F44336";

                if (statusElement) {
                    statusElement.textContent = "Reset complete. Try again.";
                    statusElement.style.color = "#4CAF50";
                }
            }, 5000);
        });
    }
});