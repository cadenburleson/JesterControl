// Handle installation or update
chrome.runtime.onInstalled.addListener(() => {
    // Initialize extension settings with more lenient defaults
    const defaultSettings = {
        enabled: true,
        scrollThreshold: 15,          // Lower threshold for easier activation
        scrollSensitivity: 1.5,       // Higher sensitivity
        gestureDebounce: 300,         // Lower debounce for faster response
        pinchThreshold: 0.15,         // More lenient pinch detection
        showStatusIndicator: true,
        showVisualFeedback: true
    };

    chrome.storage.local.set({
        enabled: true,
        settings: defaultSettings
    });

    console.log('Extension installed/updated with optimized settings');
});

// Handle message requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'requestCameraPermission') {
        // Request camera permission with high quality video constraints
        const videoConstraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 },
                facingMode: 'user'  // Use front camera
            }
        };

        console.log('Requesting camera permission with constraints:', videoConstraints);

        navigator.mediaDevices.getUserMedia(videoConstraints)
            .then((stream) => {
                // Get camera details for logging
                const videoTrack = stream.getVideoTracks()[0];
                const settings = videoTrack.getSettings();

                console.log('Camera permission granted. Video settings:', settings);

                // Stop the stream since we only wanted permission
                stream.getTracks().forEach(track => track.stop());

                sendResponse({
                    success: true,
                    settings: settings
                });
            })
            .catch(error => {
                console.error('Error accessing camera:', error);

                // Try again with simpler constraints
                console.log('Retrying with basic video constraints');
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then((stream) => {
                        console.log('Camera permission granted with basic constraints');
                        stream.getTracks().forEach(track => track.stop());
                        sendResponse({ success: true });
                    })
                    .catch(retryError => {
                        console.error('Error on retry:', retryError);
                        sendResponse({ success: false, error: retryError.message });
                    });
            });
        return true; // Required to use sendResponse asynchronously
    }

    // Always return true for asynchronous response
    return true;
});

// Listen for connections from settings page and other parts of the extension
chrome.runtime.onConnect.addListener((port) => {
    console.log('Connection established on port:', port.name);
}); 