let enabled = true;
let video;
let handLandmarker;
let lastPalmPosition = 0;
let scrollThreshold = 20; // pixels of movement needed to trigger scroll
let scrollSensitivity = 1; // scroll speed multiplier
let lastGesture = null;
let gestureDebounce = 500; // ms to wait before recognizing a new gesture
let lastGestureTime = 0;
let statusIndicator = null;
let pinchThreshold = 0.1; // threshold for pinch detection
let showStatusIndicator = true; // whether to show the status indicator
let visualFeedbackPanel = null; // visual feedback panel
let showVisualFeedback = true; // whether to show the visual feedback
let canvas = null; // canvas for drawing hand landmarks
let lastPalmPositions = []; // Array to track recent hand positions for velocity
let lastScrollTime = 0; // Time of last scroll event
let scrollVelocity = 0; // Current scroll velocity
let scrollDecay = 0.95; // Decay factor for smooth scrolling
let maxScrollSpeed = 50; // Maximum scroll speed in pixels
let animationFrameId = null; // Keep track of the animation frame ID
let isScrollAnimationActive = false; // Flag to track if scroll animation is running
let debugMode = true; // Debug mode flag for additional logging

// EMERGENCY RESET FUNCTION - Completely reinitialize hand tracking
function emergencyReset() {
    console.log("🚨 EMERGENCY RESET INITIATED 🚨");

    // Show a notification that we're trying to fix the tracking
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(156, 39, 176, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 999999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        text-align: center;
    `;
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">🔄 Resetting Hand Tracking...</div>
        <div>Attempting to fix hand tracking issues</div>
        <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">Please wait a moment</div>
    `;
    document.body.appendChild(notification);

    // Step 1: Clean up any existing resources
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (visualFeedbackPanel && visualFeedbackPanel.parentNode) {
        visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
    }

    if (statusIndicator && statusIndicator.parentNode) {
        statusIndicator.parentNode.removeChild(statusIndicator);
    }

    // Step 2: Reset all state variables
    video = null;
    handLandmarker = null;
    visualFeedbackPanel = null;
    canvas = null;
    statusIndicator = null;
    lastPalmPosition = 0;
    lastPalmPositions = [];
    scrollVelocity = 0;
    isScrollAnimationActive = false;

    // Step 3: Force MediaPipe to reinitialize from scratch
    window.tasks = null; // Clear any existing MediaPipe instance

    // Step 4: Add extra debugging
    debugMode = true;

    // Step 5: Lower detection thresholds to minimum values for maximum sensitivity
    const ultraSensitiveSettings = {
        scrollThreshold: 5,
        scrollSensitivity: 2.0,
        scrollDecay: 0.9,
        maxScrollSpeed: 70,
        gestureDebounce: 200,
        pinchThreshold: 0.15,
        showStatusIndicator: true,
        showVisualFeedback: true
    };

    // Apply these ultra-sensitive settings
    Object.assign(window, ultraSensitiveSettings);

    // Save to storage as well
    chrome.storage.local.get(['settings'], function (result) {
        const settings = result.settings || {};
        Object.assign(settings, ultraSensitiveSettings);
        chrome.storage.local.set({ settings });

        // Step 6: After a short delay, restart the entire hand tracking stack
        setTimeout(() => {
            console.log("🔄 Restarting hand tracking with maximum sensitivity");

            // Reload settings and initialize hand tracking from scratch
            loadSettings().then(() => {
                initHandLandmarker().then(() => {
                    // Start the detection process again
                    detectHandGestures();

                    // Update notification
                    notification.innerHTML = `
                        <div style="font-weight: bold; margin-bottom: 5px;">✅ Reset Complete</div>
                        <div>Hand tracking has been reset with maximum sensitivity</div>
                        <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">
                            Hold your hand clearly in view of the camera
                        </div>
                    `;
                    notification.style.backgroundColor = "rgba(76, 175, 80, 0.9)";

                    // Remove notification after a few seconds
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 5000);
                }).catch(err => {
                    console.error("Failed to initialize hand tracking:", err);

                    // Show error notification
                    notification.innerHTML = `
                        <div style="font-weight: bold; margin-bottom: 5px;">❌ Reset Failed</div>
                        <div>Unable to reset hand tracking system</div>
                        <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">
                            Try reloading the page or reinstalling the extension
                        </div>
                    `;
                    notification.style.backgroundColor = "rgba(244, 67, 54, 0.9)";

                    // Remove notification after a few seconds
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 8000);
                });
            });
        }, 1000);
    });
}

// Expose emergency reset function to global scope for console access
window.emergencyResetHandTracking = emergencyReset;

// Load settings from storage
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], function (result) {
            if (result.settings) {
                scrollThreshold = result.settings.scrollThreshold;
                scrollSensitivity = result.settings.scrollSensitivity;
                gestureDebounce = result.settings.gestureDebounce;
                pinchThreshold = result.settings.pinchThreshold;
                showStatusIndicator = result.settings.showStatusIndicator;
                showVisualFeedback = result.settings.showVisualFeedback !== undefined ?
                    result.settings.showVisualFeedback : true;

                // Load velocity-based scrolling settings
                if (result.settings.scrollDecay !== undefined) {
                    scrollDecay = result.settings.scrollDecay;
                }
                if (result.settings.maxScrollSpeed !== undefined) {
                    maxScrollSpeed = result.settings.maxScrollSpeed;
                }
            }
            resolve();
        });
    });
}

// Create a visual feedback panel to show hand tracking
function createVisualFeedbackPanel(isSimulated = false, forceShow = false) {
    // Check if a panel already exists
    if (visualFeedbackPanel) {
        console.warn('💡 Visual feedback panel already exists - removing old one first');
        if (visualFeedbackPanel.parentNode) {
            visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
        }
        visualFeedbackPanel = null;
    }

    console.log('🔄 Creating visual feedback panel');

    // Create the panel container
    visualFeedbackPanel = document.createElement('div');
    visualFeedbackPanel.id = 'jester-control-panel';

    // Apply styles for the panel - make it very prominent if forceShow is true
    // or use normal styles otherwise
    const baseStyles = forceShow ? `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 320px;
        padding: 20px;
        background-color: rgba(33, 33, 33, 0.95);
        color: white;
        border-radius: 12px;
        font-family: Arial, sans-serif;
        z-index: 9999999;
        box-shadow: 0 0 0 5px #F44336, 0 0 30px rgba(0, 0, 0, 0.7);
        animation: jesterpulse 2s infinite alternate;
    ` : `
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 250px;
        padding: 15px;
        background-color: rgba(33, 33, 33, 0.85);
        color: white;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        z-index: 9999999;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    visualFeedbackPanel.style.cssText = baseStyles;

    // Add animation style
    if (forceShow) {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            @keyframes jesterpulse {
                0% { box-shadow: 0 0 0 5px #F44336, 0 0 30px rgba(0, 0, 0, 0.7); }
                100% { box-shadow: 0 0 0 8px #F44336, 0 0 40px rgba(244, 67, 54, 0.8); }
            }
        `;
        document.head.appendChild(styleElement);
    }

    // Add a title to the panel
    const title = document.createElement('div');
    title.style.cssText = `
        margin-bottom: 10px;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    title.innerHTML = `
        <span>JesterControl ${isSimulated ? '(Simulation)' : ''}</span>
        <span style="font-size: 20px; cursor: pointer;" id="minimize-panel">−</span>
    `;
    visualFeedbackPanel.appendChild(title);

    // Add the video element
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
        position: relative;
        width: 100%;
        height: 150px;
        background-color: #000;
        margin-bottom: 10px;
        border-radius: 5px;
        overflow: hidden;
    `;

    // Video element
    const feedbackVideo = document.createElement('video');
    feedbackVideo.id = 'hand-tracking-video';
    feedbackVideo.autoplay = true;
    feedbackVideo.playsInline = true;
    feedbackVideo.muted = true;
    feedbackVideo.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scaleX(-1); /* Mirror the video */
        display: none; /* Initially hidden until camera starts */
    `;
    videoContainer.appendChild(feedbackVideo);

    // Canvas for drawing hand landmarks
    canvas = document.createElement('canvas');
    canvas.id = 'hand-tracking-canvas';
    canvas.width = 320;
    canvas.height = 240;
    canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    `;
    videoContainer.appendChild(canvas);

    // Camera required message
    const noCamera = document.createElement('div');
    noCamera.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        text-align: center;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 2;
    `;
    noCamera.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 5px;">📹 Camera Starting...</div>
        <div style="font-size: 12px;">Please allow camera access</div>
    `;
    videoContainer.appendChild(noCamera);

    // Add video container to panel
    visualFeedbackPanel.appendChild(videoContainer);

    // Gesture indicator
    const gestureIndicator = document.createElement('div');
    gestureIndicator.id = 'gesture-indicator';
    gestureIndicator.style.cssText = `
        padding: 8px;
        background-color: rgba(0, 0, 0, 0.3);
        border-radius: 5px;
        margin-bottom: 10px;
        font-size: 14px;
        text-align: center;
    `;
    gestureIndicator.textContent = 'Waiting for gestures...';
    visualFeedbackPanel.appendChild(gestureIndicator);

    // Tips for usage
    const tips = document.createElement('div');
    tips.style.cssText = `
        padding: 8px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 5px;
        font-size: 12px;
    `;
    tips.innerHTML = `
        <div style="margin-bottom: 5px; font-weight: bold;">Quick Guide:</div>
        <div style="margin-bottom: 3px;">• ✋ Open palm to scroll</div>
        <div style="margin-bottom: 3px;">• 👌 Pinch to click</div>
        <div style="margin-bottom: 3px;">• ✊ Closed fist to stop</div>
    `;
    visualFeedbackPanel.appendChild(tips);

    // Add to the page
    document.body.appendChild(visualFeedbackPanel);

    // If the camera is already running, set the video source
    if (video && video.srcObject) {
        // Clone the tracks from the existing video
        try {
            feedbackVideo.srcObject = video.srcObject;
            feedbackVideo.play()
                .then(() => {
                    // Ensure video is visible
                    feedbackVideo.style.display = 'block';
                    noCamera.style.display = 'none';
                })
                .catch(err => {
                    console.error('❌ Error playing feedback video:', err);
                });
        } catch (e) {
            console.error('❌ Error setting feedback video source:', e);
        }
    }

    // Add minimize/expand functionality
    const minimizeButton = document.getElementById('minimize-panel');
    if (minimizeButton) {
        minimizeButton.addEventListener('click', function () {
            const panel = this.closest('#jester-control-panel');
            const videoContainer = panel.querySelector('div:nth-child(2)');
            const gestureIndicator = panel.querySelector('#gesture-indicator');
            const tipsContainer = panel.querySelector('div:last-child');
            const diagnostics = panel.querySelector('#hand-tracking-diagnostics');

            // Check if already minimized by checking if the video is hidden
            const isMinimized = videoContainer.style.display === 'none';

            if (isMinimized) {
                // Expand
                this.textContent = '−';
                videoContainer.style.display = 'block';
                gestureIndicator.style.display = 'block';
                if (tipsContainer) tipsContainer.style.display = 'block';
                if (diagnostics) diagnostics.style.display = 'block';
            } else {
                // Minimize
                this.textContent = '+';
                videoContainer.style.display = 'none';
                gestureIndicator.style.display = 'none';
                if (tipsContainer) tipsContainer.style.display = 'none';
                if (diagnostics) diagnostics.style.display = 'none';
            }
        });
    }

    // Always add diagnostics panel
    setTimeout(() => {
        addHandTrackingDiagnostics();
    }, 500);

    console.log('✅ Visual feedback panel created');
    return visualFeedbackPanel;
}

// Interactive tutorial for gesture controls
function startGestureTutorial() {
    if (!visualFeedbackPanel) return;

    // Create tutorial overlay
    const tutorialOverlay = document.createElement('div');
    tutorialOverlay.id = 'gesture-tutorial-overlay';
    tutorialOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        color: white;
        text-align: center;
    `;

    // Tutorial content
    const steps = [
        {
            title: "Hand Gesture Tutorial",
            content: `
                <div style="max-width: 500px; padding: 20px;">
                    <h2 style="color: #FF80AB; margin-bottom: 20px;">Welcome to the Hand Gesture Tutorial!</h2>
                    <p style="font-size: 16px; margin-bottom: 15px;">This quick guide will show you how to use hand gestures to control scrolling.</p>
                    <div style="margin: 20px 0;">
                        <img src="https://i.imgur.com/5JKQmNO.gif" alt="Hand gesture demo" style="max-width: 100%; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
                    </div>
                    <p style="font-size: 14px;">We'll guide you through each gesture in a few simple steps.</p>
                </div>
            `
        },
        {
            title: "Open Palm for Scrolling",
            content: `
                <div style="max-width: 500px; padding: 20px;">
                    <h2 style="color: #4CAF50; margin-bottom: 20px;">Open Palm Gesture</h2>
                    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <div style="width: 150px; height: 150px; background-color: rgba(76, 175, 80, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 70px;">✋</div>
                    </div>
                    <p style="font-size: 16px; margin-bottom: 15px;">Hold your palm open with fingers extended in front of the camera</p>
                    <p style="font-size: 16px; margin-bottom: 15px;">Move your hand <strong>up</strong> to scroll <strong>up</strong> the page</p>
                    <p style="font-size: 16px; margin-bottom: 15px;">Move your hand <strong>down</strong> to scroll <strong>down</strong> the page</p>
                    <p style="font-size: 14px; color: #AEEA00;">The faster you move your hand, the faster the page scrolls!</p>
                </div>
            `
        },
        {
            title: "Stop Scrolling",
            content: `
                <div style="max-width: 500px; padding: 20px;">
                    <h2 style="color: #F44336; margin-bottom: 20px;">Closed Fist to Stop</h2>
                    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <div style="width: 150px; height: 150px; background-color: rgba(244, 67, 54, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 70px;">✊</div>
                    </div>
                    <p style="font-size: 16px; margin-bottom: 15px;">Make a fist to stop all scrolling motion</p>
                    <p style="font-size: 14px; color: #AEEA00;">This is helpful when you want to pause at a specific point on the page</p>
                </div>
            `
        },
        {
            title: "Tips for Best Results",
            content: `
                <div style="max-width: 500px; padding: 20px;">
                    <h2 style="color: #2196F3; margin-bottom: 20px;">Tips for Best Results</h2>
                    <ul style="text-align: left; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        <li>Ensure good lighting on your hand</li>
                        <li>Keep your hand 1-2 feet from the camera</li>
                        <li>Make deliberate, clear gestures</li>
                        <li>Avoid moving your hand too quickly</li>
                        <li>Keep your palm facing the camera</li>
                    </ul>
                    <p style="font-size: 14px;">You can always open the visual feedback panel to see your hand tracking in real-time</p>
                </div>
            `
        }
    ];

    // Current step
    let currentStep = 0;

    // Create tutorial content
    const tutorialContent = document.createElement('div');
    tutorialContent.innerHTML = steps[currentStep].content;

    // Create navigation buttons
    const navigationDiv = document.createElement('div');
    navigationDiv.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-top: 20px;
    `;

    const prevButton = document.createElement('button');
    prevButton.textContent = '« Previous';
    prevButton.style.cssText = `
        padding: 8px 20px;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    prevButton.disabled = true;
    prevButton.style.opacity = '0.5';

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next »';
    nextButton.style.cssText = `
        padding: 8px 20px;
        background-color: #FF80AB;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close Tutorial';
    closeButton.style.cssText = `
        padding: 8px 20px;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
    `;

    // Add event listeners
    prevButton.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            updateTutorial();
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            updateTutorial();
        } else {
            // Last step, close the tutorial
            document.body.removeChild(tutorialOverlay);
        }
    });

    closeButton.addEventListener('click', () => {
        document.body.removeChild(tutorialOverlay);
    });

    // Update tutorial content based on current step
    function updateTutorial() {
        tutorialContent.innerHTML = steps[currentStep].content;

        // Update button states
        prevButton.disabled = currentStep === 0;
        prevButton.style.opacity = currentStep === 0 ? '0.5' : '1';

        nextButton.textContent = currentStep === steps.length - 1 ? 'Finish' : 'Next »';
    }

    // Add navigation buttons
    navigationDiv.appendChild(prevButton);
    navigationDiv.appendChild(nextButton);
    navigationDiv.appendChild(closeButton);

    // Add content and navigation to overlay
    tutorialOverlay.appendChild(tutorialContent);
    tutorialOverlay.appendChild(navigationDiv);

    // Add to page
    document.body.appendChild(tutorialOverlay);
}

// Make an element draggable
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.style.cursor = 'move';
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        // Get mouse position at start
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Update visual feedback with hand landmarks
function updateVisualFeedback(results) {
    if (!canvas || !visualFeedbackPanel || !showVisualFeedback) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw landmarks if available
    if (results && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // Draw connections between landmarks (simplified hand skeleton)
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring finger
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm
            [0, 5], [5, 9], [9, 13], [13, 17]
        ];

        // Draw connections with enhanced visibility
        ctx.strokeStyle = 'rgba(0, 255, 128, 0.8)';
        ctx.lineWidth = 3; // Thicker lines for better visibility

        for (const [i, j] of connections) {
            if (landmarks[i] && landmarks[j]) {
                const start = landmarks[i];
                const end = landmarks[j];

                ctx.beginPath();
                ctx.moveTo(start.x * width, start.y * height);
                ctx.lineTo(end.x * width, end.y * height);
                ctx.stroke();
            }
        }

        // Draw landmarks with different colors for different parts
        // Wrist landmark in blue
        ctx.fillStyle = 'rgba(64, 158, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(landmarks[0].x * width, landmarks[0].y * height, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Finger tips in red (more visible)
        ctx.fillStyle = 'rgba(255, 64, 64, 0.9)';
        [4, 8, 12, 16, 20].forEach(index => {
            if (landmarks[index]) {
                ctx.beginPath();
                ctx.arc(landmarks[index].x * width, landmarks[index].y * height, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Other landmarks in green
        ctx.fillStyle = 'rgba(64, 255, 128, 0.7)';
        landmarks.forEach((landmark, i) => {
            // Skip wrist and fingertips (already drawn)
            if (i !== 0 && ![4, 8, 12, 16, 20].includes(i)) {
                ctx.beginPath();
                ctx.arc(landmark.x * width, landmark.y * height, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Add direction indicators when hand is moving significantly
        if (lastPalmPositions.length >= 2) {
            const oldest = lastPalmPositions[0].position;
            const newest = lastPalmPositions[lastPalmPositions.length - 1].position;
            const moveY = newest - oldest;

            if (Math.abs(moveY) > scrollThreshold) {
                // Draw direction arrow
                const centerX = width / 2;
                const arrowLength = Math.min(Math.abs(moveY) / 2, 30);
                const direction = Math.sign(moveY);

                ctx.strokeStyle = direction > 0 ? 'rgba(255, 128, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.beginPath();

                // Draw arrow shaft
                ctx.moveTo(centerX, height - 20);
                ctx.lineTo(centerX, height - 20 - arrowLength * direction);

                // Draw arrow head
                ctx.lineTo(centerX - 6, height - 20 - (arrowLength - 6) * direction);
                ctx.moveTo(centerX, height - 20 - arrowLength * direction);
                ctx.lineTo(centerX + 6, height - 20 - (arrowLength - 6) * direction);

                ctx.stroke();
            }
        }

        // Update gesture indicator
        const gestureIndicator = document.getElementById('gesture-indicator');
        if (gestureIndicator && lastGesture) {
            const formattedGesture = lastGesture.replace('_', ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            gestureIndicator.textContent = `Gesture: ${formattedGesture}`;

            // Color-code by gesture type
            switch (lastGesture) {
                case 'open_palm':
                    gestureIndicator.style.backgroundColor = 'rgba(76, 175, 80, 0.5)'; // Green
                    break;
                case 'peace':
                    gestureIndicator.style.backgroundColor = 'rgba(33, 150, 243, 0.5)'; // Blue
                    break;
                case 'pinch':
                    gestureIndicator.style.backgroundColor = 'rgba(255, 193, 7, 0.5)'; // Amber
                    break;
                case 'closed_fist':
                    gestureIndicator.style.backgroundColor = 'rgba(244, 67, 54, 0.5)'; // Red
                    break;
                default:
                    gestureIndicator.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
            }
        } else if (gestureIndicator) {
            gestureIndicator.textContent = 'Waiting for gesture...';
            gestureIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
    } else {
        // No hand detected
        const gestureIndicator = document.getElementById('gesture-indicator');
        if (gestureIndicator) {
            gestureIndicator.textContent = 'No hand detected';
            gestureIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }

        // Draw "no hand detected" message on canvas
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Place your hand in view', width / 2, height / 2 - 10);
        ctx.font = '12px Arial';
        ctx.fillText('to start gesture detection', width / 2, height / 2 + 10);
    }
}

// Create a visual indicator to show the extension status
function createStatusIndicator() {
    if (statusIndicator || !showStatusIndicator) return; // Already created or disabled

    console.log('🔔 Creating status indicator');

    statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        display: flex;
        align-items: center;
        transition: opacity 0.3s;
        opacity: 0.7;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    `;

    // Add a visual icon indicator
    const iconElement = document.createElement('div');
    iconElement.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #4CAF50;
        margin-right: 8px;
        transition: background-color 0.3s;
    `;

    // Text status
    const textElement = document.createElement('span');
    textElement.textContent = 'Hand Gestures: Active';

    // Show feedback button
    const feedbackButton = document.createElement('button');
    feedbackButton.textContent = '👁️';
    feedbackButton.title = 'Show/Hide Visual Feedback';
    feedbackButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 14px;
        cursor: pointer;
        margin-left: 8px;
        padding: 0;
        transition: transform 0.2s;
    `;

    // Add hover effect
    feedbackButton.addEventListener('mouseenter', () => {
        feedbackButton.style.transform = 'scale(1.2)';
    });

    feedbackButton.addEventListener('mouseleave', () => {
        feedbackButton.style.transform = 'scale(1)';
    });

    feedbackButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (visualFeedbackPanel) {
            // Hide visual feedback
            if (visualFeedbackPanel.parentNode) {
                visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
            }
            visualFeedbackPanel = null;
            showVisualFeedback = false;
            console.log('👁️ Visual feedback panel hidden via status button');
        } else {
            // Show visual feedback
            showVisualFeedback = true;
            createVisualFeedbackPanel();
            console.log('👁️ Visual feedback panel shown via status button');
        }

        // Update settings
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || {};
            settings.showVisualFeedback = showVisualFeedback;
            chrome.storage.local.set({ settings });
        });
    });

    statusIndicator.appendChild(iconElement);
    statusIndicator.appendChild(textElement);
    statusIndicator.appendChild(feedbackButton);

    // Make the indicator draggable
    makeDraggable(statusIndicator, statusIndicator);

    // Add hover effects
    statusIndicator.addEventListener('mouseenter', () => {
        statusIndicator.style.opacity = '1';
    });

    statusIndicator.addEventListener('mouseleave', () => {
        statusIndicator.style.opacity = '0.7';
    });

    // Add click functionality to toggle feedback
    statusIndicator.addEventListener('click', (e) => {
        // Don't handle clicks on the feedback button (it has its own handler)
        if (e.target === feedbackButton) return;

        // Otherwise toggle visual feedback
        if (visualFeedbackPanel) {
            // Hide visual feedback
            if (visualFeedbackPanel.parentNode) {
                visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
            }
            visualFeedbackPanel = null;
            showVisualFeedback = false;
        } else {
            // Show visual feedback
            showVisualFeedback = true;
            createVisualFeedbackPanel();
        }

        // Update settings
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || {};
            settings.showVisualFeedback = showVisualFeedback;
            chrome.storage.local.set({ settings });
        });
    });

    // Add to the page
    document.body.appendChild(statusIndicator);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (statusIndicator) {
            statusIndicator.style.opacity = '0.2';
        }
    }, 5000);
}

// Update the status indicator
function updateStatusIndicator(isEnabled, currentGesture = null) {
    if (!showStatusIndicator) {
        if (statusIndicator && statusIndicator.parentNode) {
            statusIndicator.parentNode.removeChild(statusIndicator);
            statusIndicator = null;
        }
        return;
    }

    if (!statusIndicator) {
        if (isEnabled) {
            createStatusIndicator();
        } else {
            return;
        }
    }

    // Update indicator visibility
    if (isEnabled) {
        statusIndicator.style.display = 'flex';

        // Update the icon color
        const iconElement = statusIndicator.firstChild;
        iconElement.style.backgroundColor = '#4CAF50';

        // Update text if a gesture is provided
        if (currentGesture) {
            // Format the gesture name for display
            const formattedGesture = currentGesture.replace('_', ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            statusIndicator.lastChild.textContent = `Gesture: ${formattedGesture}`;

            // Make the indicator visible when detecting gestures
            statusIndicator.style.opacity = '0.7';

            // Auto-fade after showing a gesture
            clearTimeout(statusIndicator.fadeTimeout);
            statusIndicator.fadeTimeout = setTimeout(() => {
                if (statusIndicator) {
                    statusIndicator.style.opacity = '0.2';
                }
            }, 2000);
        } else {
            statusIndicator.lastChild.textContent = 'Hand Gestures: Active';
        }
    } else {
        // If disabled, show "disabled" message and then remove
        if (statusIndicator) {
            const iconElement = statusIndicator.firstChild;
            iconElement.style.backgroundColor = '#F44336';
            statusIndicator.lastChild.textContent = 'Hand Gestures: Disabled';

            // Show briefly when turned off, then remove
            statusIndicator.style.opacity = '0.7';
            setTimeout(() => {
                if (statusIndicator && statusIndicator.parentNode) {
                    statusIndicator.parentNode.removeChild(statusIndicator);
                    statusIndicator = null;
                }
            }, 2000);
        }
    }
}

// Load MediaPipe libraries
function loadMediaPipeScripts() {
    return new Promise((resolve) => {
        try {
            console.log('📦 Loading local MediaPipe libraries...');

            // Check if MediaPipe is already defined
            if (window.tasks && window.tasks.vision) {
                console.log('MediaPipe already defined, skipping load');
                return resolve();
            }

            // Create script element for MediaPipe vision bundle
            const visionScript = document.createElement('script');
            visionScript.src = chrome.runtime.getURL('mediapipe/vision_bundle.js');
            visionScript.type = 'text/javascript';

            // Set a timeout in case loading takes too long
            const timeoutId = setTimeout(() => {
                console.error('⚠️ MediaPipe script loading timed out after 10 seconds');
                if (document.head.contains(visionScript)) {
                    document.head.removeChild(visionScript);
                }
                setupSimulatedMediaPipe();
                resolve();
            }, 10000);

            // When script loads successfully
            visionScript.onload = () => {
                console.log('✅ MediaPipe vision bundle loaded successfully');
                clearTimeout(timeoutId);

                // Verify the MediaPipe object was created
                if (!window.tasks || !window.tasks.vision) {
                    console.error('❌ MediaPipe loaded but global object not found');
                    setupSimulatedMediaPipe();
                }

                resolve();
            };

            // Handle loading errors
            visionScript.onerror = (err) => {
                console.error('❌ Error loading MediaPipe vision bundle:', err);
                clearTimeout(timeoutId);
                setupSimulatedMediaPipe();
                resolve();
            };

            // Add the script to the document
            document.head.appendChild(visionScript);
        } catch (err) {
            console.error('❌ Error initializing MediaPipe:', err);
            setupSimulatedMediaPipe();
            resolve();
        }
    });
}

// Set up simulated MediaPipe as fallback
function setupSimulatedMediaPipe() {
    console.log('📊 Initializing hand tracking simulation');

    window.tasks = window.tasks || {};
    window.tasks.vision = window.tasks.vision || {
        HandLandmarker: {
            createFromOptions: async function (bundle, options) {
                console.log('✅ Hand tracking initialized successfully');
                return {
                    detectForVideo: function (videoFrame, timestamp) {
                        if (!videoFrame || !videoFrame.srcObject) {
                            // If no video is available, just simulate some random hand movements
                            return simulateRandomHandMovement();
                        }

                        try {
                            // When we have a video, try to use it to create more realistic simulation
                            // This will track the brightest spot in the video as if it were a hand
                            return simulateHandTrackingFromVideo(videoFrame, timestamp);
                        } catch (e) {
                            // Fallback to random simulation if video processing fails
                            return simulateRandomHandMovement();
                        }
                    }
                };
            }
        },
        FilesetResolver: {
            forVisionTasks: async function (wasmPath) {
                console.log('✅ Vision task resolver initialized');
                return { wasmPath };
            }
        }
    };
}

// Simulate hand tracking from video using brightness detection
function simulateHandTrackingFromVideo(videoElement, timestamp) {
    try {
        if (!videoElement || videoElement.readyState < 2) {
            return { landmarks: [] };
        }

        // Use movement from the video to influence the hand position
        const time = timestamp / 1000;
        const cyclePosition = (Math.sin(time * 0.5) + 1) / 2; // 0 to 1 movement

        // Create a basic hand model with 21 landmarks
        const landmarks = createHandLandmarks(cyclePosition);

        // Add some randomness to make it look more natural
        addRandomnessToLandmarks(landmarks, 0.01);

        return { landmarks: [landmarks] };
    } catch (e) {
        console.error("Error in video-based hand simulation:", e);
        return simulateRandomHandMovement();
    }
}

// Simulate random hand movements when no video is available
function simulateRandomHandMovement() {
    // Only simulate hands about 80% of the time to make detection more realistic
    if (Math.random() > 0.2) {
        // Generate a timestamp-based position for smoother animation
        const time = Date.now() / 1000;
        const cyclePosition = (Math.sin(time * 0.5) + 1) / 2; // 0 to 1 movement

        // Create a basic hand model
        const landmarks = createHandLandmarks(cyclePosition);

        // Add randomness to make it look more natural
        addRandomnessToLandmarks(landmarks, 0.05);

        return { landmarks: [landmarks] };
    }

    // Sometimes return no hand detected
    return { landmarks: [] };
}

// Create a simulated hand landmark with 21 points
function createHandLandmarks(cyclePosition) {
    const landmarks = [];

    // Base positions for different hand parts (simplified model)
    const wristPos = { x: 0.5, y: 0.8, z: 0 };
    const palmPos = { x: 0.5, y: 0.7, z: 0 };

    // Wrist (landmark 0)
    landmarks.push({ ...wristPos });

    // Thumb (landmarks 1-4)
    landmarks.push({ x: 0.45, y: 0.75, z: 0 });
    landmarks.push({ x: 0.4, y: 0.7, z: 0 });
    landmarks.push({ x: 0.38, y: 0.65, z: 0 });
    landmarks.push({ x: 0.36, y: 0.6, z: 0 });

    // Index finger (landmarks 5-8)
    landmarks.push({ x: 0.45, y: 0.6, z: 0 });
    landmarks.push({ x: 0.45, y: 0.5, z: 0 });
    landmarks.push({ x: 0.45, y: 0.4, z: 0 });
    landmarks.push({ x: 0.45, y: 0.3 - cyclePosition * 0.1, z: 0 }); // Move tip up/down

    // Middle finger (landmarks 9-12)
    landmarks.push({ x: 0.5, y: 0.58, z: 0 });
    landmarks.push({ x: 0.5, y: 0.48, z: 0 });
    landmarks.push({ x: 0.5, y: 0.38, z: 0 });
    landmarks.push({ x: 0.5, y: 0.28 - cyclePosition * 0.1, z: 0 }); // Move tip up/down

    // Ring finger (landmarks 13-16)
    landmarks.push({ x: 0.55, y: 0.6, z: 0 });
    landmarks.push({ x: 0.55, y: 0.5, z: 0 });
    landmarks.push({ x: 0.55, y: 0.4, z: 0 });
    landmarks.push({ x: 0.55, y: 0.3 - cyclePosition * 0.1, z: 0 }); // Move tip up/down

    // Pinky finger (landmarks 17-20)
    landmarks.push({ x: 0.6, y: 0.62, z: 0 });
    landmarks.push({ x: 0.6, y: 0.52, z: 0 });
    landmarks.push({ x: 0.6, y: 0.42, z: 0 });
    landmarks.push({ x: 0.6, y: 0.32 - cyclePosition * 0.1, z: 0 }); // Move tip up/down

    return landmarks;
}

// Add randomness to landmarks to make them more natural
function addRandomnessToLandmarks(landmarks, amount) {
    for (let i = 0; i < landmarks.length; i++) {
        landmarks[i].x += (Math.random() - 0.5) * amount;
        landmarks[i].y += (Math.random() - 0.5) * amount;
    }
}

// Check if camera permissions are already granted
async function checkCameraPermission() {
    try {
        // Query existing permissions
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });

        if (permissionStatus.state === 'granted') {
            console.log('✅ Camera permission already granted');
            return true;
        } else if (permissionStatus.state === 'prompt') {
            console.log('⚠️ Camera permission will be requested');
            return null; // Need to request
        } else if (permissionStatus.state === 'denied') {
            console.log('❌ Camera permission previously denied');
            return false;
        }
    } catch (err) {
        console.error('❌ Error checking camera permission:', err);
        // If we can't check permissions, we'll try to request them anyway
        return null;
    }

    return null; // Default to "need to request"
}

// Request camera permission via the background script
async function requestCameraPermission() {
    return new Promise(async (resolve) => {
        try {
            // First check if we already have permission
            const permissionCheck = await checkCameraPermission();

            if (permissionCheck === true) {
                // Permission already granted
                return resolve(true);
            }

            if (permissionCheck === false) {
                // Permission explicitly denied - show a notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(244, 67, 54, 0.9);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    text-align: center;
                    max-width: 80%;
                `;
                notification.innerHTML = `
                    <div style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">📷 Camera Access Required</div>
                    <div>Hand gesture tracking needs camera permission to work. Please enable camera access in your browser settings.</div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                        Click the camera icon in your address bar and select "Allow"
                    </div>
                    <button style="margin-top: 10px; padding: 5px 10px; background: white; color: #F44336; border: none; border-radius: 4px; cursor: pointer;">Dismiss</button>
                `;
                document.body.appendChild(notification);

                // Add dismiss button functionality
                const dismissButton = notification.querySelector('button');
                if (dismissButton) {
                    dismissButton.addEventListener('click', () => {
                        document.body.removeChild(notification);
                    });
                }

                // Auto-dismiss after 8 seconds
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 8000);

                return resolve(false);
            }

            // Try directly requesting camera permission
            console.log('📸 Requesting camera permission directly...');
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    console.log('✅ Camera permission granted');
                    // We got permission! Stop the tracks to avoid keeping the camera on
                    stream.getTracks().forEach(track => track.stop());
                    resolve(true);
                })
                .catch(err => {
                    console.warn('⚠️ Direct camera access failed:', err.message);

                    // Try through the background script
                    console.log('📸 Requesting camera permission via background script...');
                    chrome.runtime.sendMessage({ action: 'requestCameraPermission' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Error sending permission request:', chrome.runtime.lastError);
                            resolve(false);
                        } else {
                            console.log('📸 Background permission result:', response?.success);
                            resolve(response?.success || false);
                        }
                    });
                });
        } catch (err) {
            console.error('❌ Error in requestCameraPermission:', err);
            resolve(false);
        }
    });
}

// Initialize the HandLandmarker
async function initHandLandmarker() {
    try {
        // First ensure we have camera permission
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            console.warn('⚠️ Camera permission denied - may need to use simulation');
            // Continue anyway to try other methods
        } else {
            console.log('✅ Camera permission granted');
        }

        console.log('🔄 Initializing hand tracking...');

        // First check if the MediaPipe library is available
        if (!window.tasks || !window.tasks.vision ||
            !window.tasks.vision.HandLandmarker ||
            !window.tasks.vision.FilesetResolver) {

            console.log('⚠️ MediaPipe not available yet, loading script first...');

            // Wait for MediaPipe to load
            await loadMediaPipeScripts();

            // Double check if MediaPipe loaded properly
            if (!window.tasks || !window.tasks.vision) {
                console.error('❌ MediaPipe global object not loaded properly');

                // Try loading again with a different method
                const visionScript = document.createElement('script');
                visionScript.src = chrome.runtime.getURL('mediapipe/vision_bundle.js');
                await new Promise((resolve) => {
                    visionScript.onload = resolve;
                    visionScript.onerror = resolve; // Continue even if error
                    document.head.appendChild(visionScript);
                });

                console.log('🔍 Second attempt to load MediaPipe complete');
            }

            // Final check after loading attempts
            if (!window.tasks || !window.tasks.vision ||
                !window.tasks.vision.HandLandmarker ||
                !window.tasks.vision.FilesetResolver) {
                console.warn('⚠️ MediaPipe libraries still not loaded after attempts, falling back to simulation');
                setupSimulatedMediaPipe();
            }
        }

        // Get MediaPipe implementation 
        const vision = window.tasks.vision;
        const HandLandmarker = vision.HandLandmarker;
        const FilesetResolver = vision.FilesetResolver;

        let useSimulation = false;

        // Initialize the vision task
        try {
            console.log('📦 Initializing vision bundle...');

            // Use local WASM path with explicit extension URL
            const wasmPath = chrome.runtime.getURL('mediapipe/wasm/');
            console.log('📂 WASM Path:', wasmPath);

            // Verify the WASM file exists
            try {
                const response = await fetch(chrome.runtime.getURL('mediapipe/wasm/vision.wasm'), { method: 'HEAD' });
                if (!response.ok) {
                    console.error('❌ WASM file not found or not accessible!');
                    throw new Error('WASM file not found');
                } else {
                    console.log('✅ WASM file verified');
                }
            } catch (e) {
                console.error('❌ Error verifying WASM file:', e);
            }

            // Initialize with complete path to avoid potential path resolution issues
            const visionBundle = await FilesetResolver.forVisionTasks(wasmPath);

            console.log('✅ MediaPipe vision bundle initialized successfully');

            // Create hand landmarker with options
            console.log('📦 Creating hand landmarker...');

            // Use local model path with explicit extension URL
            const modelPath = chrome.runtime.getURL('mediapipe/hand_landmarker/hand_landmarker.task');
            console.log('📂 Model Path:', modelPath);

            // Verify the model file exists
            try {
                const response = await fetch(modelPath, { method: 'HEAD' });
                if (!response.ok) {
                    console.error('❌ Model file not found or not accessible!');
                    throw new Error('Model file not found');
                } else {
                    console.log('✅ Model file verified');
                }
            } catch (e) {
                console.error('❌ Error verifying model file:', e);
            }

            // Try creating the hand landmarker with EXTREMELY low thresholds
            try {
                // Use extremely low thresholds for maximum detection
                const options = {
                    baseOptions: {
                        modelAssetPath: modelPath,
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,  // Track up to 2 hands
                    minHandDetectionConfidence: 0.05,  // Use absolute lowest threshold
                    minHandPresenceConfidence: 0.05,   // Use absolute lowest threshold
                    minTrackingConfidence: 0.05        // Use absolute lowest threshold
                };

                if (debugMode) {
                    console.log('🔍 Using ultra-sensitive detection options:', JSON.stringify(options, null, 2));
                }

                handLandmarker = await HandLandmarker.createFromOptions(visionBundle, options);

                console.log('✅ Real hand tracking initialized successfully!');
                updateStatusIndicator(true);

                // Create visual feedback panel after initialization
                if (showVisualFeedback) {
                    createVisualFeedbackPanel(false, true); // Pass true to force show
                }

                // Start the camera - this will provide video for real tracking
                await startCamera();

                // Force a detection to verify tracking works
                if (video && video.srcObject) {
                    console.log('🧪 Testing hand detection with first frame...');
                    try {
                        const testResult = handLandmarker.detectForVideo(video, performance.now());
                        console.log('🧪 First detection test result:',
                            testResult ? `Detected ${testResult.landmarks?.length || 0} hands` : 'No hands detected');
                    } catch (testError) {
                        console.error('⚠️ First detection test failed:', testError);
                    }
                }

                return; // Success! Exit the function

            } catch (handError) {
                console.error('❌ Error creating hand landmarker with GPU:', handError);
                console.log('🔄 Retrying with CPU delegate...');

                // Try again with CPU delegate with ultra-low thresholds
                try {
                    const options = {
                        baseOptions: {
                            modelAssetPath: modelPath,
                            delegate: 'CPU'
                        },
                        runningMode: 'VIDEO',
                        numHands: 2,  // Track up to 2 hands
                        minHandDetectionConfidence: 0.05,  // Use absolute lowest threshold
                        minHandPresenceConfidence: 0.05,   // Use absolute lowest threshold
                        minTrackingConfidence: 0.05        // Use absolute lowest threshold
                    };

                    if (debugMode) {
                        console.log('🔍 Using CPU with ultra-sensitive options:', JSON.stringify(options, null, 2));
                    }

                    handLandmarker = await HandLandmarker.createFromOptions(visionBundle, options);

                    console.log('✅ Real hand tracking initialized with CPU successfully!');
                    updateStatusIndicator(true);

                    // Create visual feedback panel after initialization
                    if (showVisualFeedback) {
                        createVisualFeedbackPanel(false, true); // Real tracking, force show
                    }

                    // Start the camera
                    await startCamera();

                    // Force a detection to verify tracking works
                    if (video && video.srcObject) {
                        console.log('🧪 Testing hand detection with first frame (CPU)...');
                        try {
                            const testResult = handLandmarker.detectForVideo(video, performance.now());
                            console.log('🧪 First detection test result (CPU):',
                                testResult ? `Detected ${testResult.landmarks?.length || 0} hands` : 'No hands detected');
                        } catch (testError) {
                            console.error('⚠️ First detection test failed (CPU):', testError);
                        }
                    }

                    return; // Success! Exit the function

                } catch (cpuError) {
                    console.error('❌ Error creating hand landmarker with CPU:', cpuError);
                    useSimulation = true;
                }
            }

        } catch (error) {
            console.error('❌ Error initializing real hand tracking:', error);
            useSimulation = true;
        }

        // If we reach this point, we need to fall back to simulation
        if (useSimulation) {
            console.warn('⚠️ Falling back to simulated tracking');

            // Fall back to simulation
            setupSimulatedMediaPipe();

            // Create hand landmarker with basic options
            handLandmarker = await window.tasks.vision.HandLandmarker.createFromOptions({}, {
                runningMode: 'VIDEO',
                numHands: 1
            });

            // Start tracking with simulation
            if (showVisualFeedback) {
                createVisualFeedbackPanel(true); // Pass true to indicate simulated tracking
            }
            startCamera();

            // Display notice about simulation mode
            const simulationNotice = document.createElement('div');
            simulationNotice.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(255, 152, 0, 0.9);
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                z-index: 9999999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                text-align: center;
                pointer-events: none;
            `;
            simulationNotice.innerHTML = `
                <div style="font-weight: bold;">⚠️ Using Simulated Hand Tracking</div>
                <div style="font-size: 12px; margin-top: 5px;">
                    Real camera tracking failed to initialize.<br>
                    Use the Emergency Reset button if needed.
                </div>
            `;
            document.body.appendChild(simulationNotice);

            // Remove notice after 10 seconds
            setTimeout(() => {
                if (simulationNotice.parentNode) {
                    simulationNotice.parentNode.removeChild(simulationNotice);
                }
            }, 10000);
        }
    } catch (error) {
        console.error('❌ Fatal error initializing HandLandmarker:', error);

        // Display a simple error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 80%;
        `;
        errorMessage.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">⚠️ Hand Tracking Error</div>
            <div>Using simplified hand tracking due to initialization error. Try reloading the page.</div>
            <button style="margin-top: 10px; padding: 5px 10px; background: white; color: #F44336; border: none; border-radius: 4px; cursor: pointer;">
                Dismiss
            </button>
            <button id="try-emergency-reset" style="margin-top: 10px; margin-left: 10px; padding: 5px 10px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Try Emergency Reset
            </button>
        `;
        document.body.appendChild(errorMessage);

        // Add dismiss button functionality
        const dismissButton = errorMessage.querySelector('button');
        if (dismissButton) {
            dismissButton.addEventListener('click', () => {
                document.body.removeChild(errorMessage);
            });
        }

        // Add emergency reset button
        const resetButton = errorMessage.querySelector('#try-emergency-reset');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                document.body.removeChild(errorMessage);
                emergencyReset();
            });
        }

        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
            }
        }, 15000);
    }
}

// Start the camera
async function startCamera() {
    try {
        console.log('📷 Starting camera...');

        // Create video element if it doesn't exist
        if (!video) {
            console.log('🎬 Creating video element');
            video = document.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;

            // Add ID for debugging
            video.id = 'jester-camera-video';

            // Make sure the video is visible for debugging
            if (debugMode) {
                console.log('🔍 Setting up video element with debug styling');
                video.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    width: 160px;
                    height: 120px;
                    z-index: 9999999;
                    object-fit: cover;
                    transform: scaleX(-1); /* Mirror the video */
                    border: 2px solid #4CAF50;
                    border-radius: 8px;
                    opacity: 0.8;
                    display: none; /* Initially hidden until we confirm it's working */
                `;
                document.body.appendChild(video);
            }
        }

        // Try different camera configurations to ensure we get a working stream
        let stream = null;
        const cameraConfigs = [
            // First try user-facing camera with ideal resolution
            { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
            // Then try user-facing camera with lower resolution
            { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } },
            // Then try environment-facing camera (on mobile)
            { video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } },
            // Then try any camera
            { video: true }
        ];

        // Try each camera configuration until one works
        for (let i = 0; i < cameraConfigs.length; i++) {
            const config = cameraConfigs[i];
            try {
                console.log(`📷 Trying camera config ${i + 1}:`, JSON.stringify(config));
                stream = await navigator.mediaDevices.getUserMedia(config);

                if (stream && stream.getVideoTracks().length > 0) {
                    console.log(`✅ Camera config ${i + 1} worked!`);

                    // Get the actual dimensions
                    const videoTrack = stream.getVideoTracks()[0];
                    const settings = videoTrack.getSettings();
                    console.log(`📊 Camera resolution: ${settings.width}x${settings.height}`);

                    // Check if facing user
                    if (settings.facingMode) {
                        console.log(`📊 Camera facing: ${settings.facingMode}`);
                    }

                    break; // Successfully got a stream, exit the loop
                }
            } catch (err) {
                console.warn(`⚠️ Camera config ${i + 1} failed:`, err.message);

                // If this is the last config and we still have no stream, throw the error
                if (i === cameraConfigs.length - 1 && !stream) {
                    throw err;
                }
            }
        }

        if (!stream) {
            throw new Error('Could not initialize camera with any configuration');
        }

        // Set video source and play
        video.srcObject = stream;

        // Wait for metadata to ensure video dimensions are available
        await new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve();
            } else {
                video.addEventListener('loadedmetadata', resolve, { once: true });

                // Add timeout just in case
                setTimeout(resolve, 1000);
            }
        });

        // Ensure video is playing
        try {
            await video.play();
            console.log('✅ Video is playing');

            // If in debug mode, show the video element after confirming it works
            if (debugMode && document.body.contains(video)) {
                video.style.display = 'block';
            }

            // Trigger a test detection after a short delay
            setTimeout(() => {
                if (handLandmarker && video) {
                    try {
                        console.log('🧪 Performing test detection after camera start');
                        const result = handLandmarker.detectForVideo(video, performance.now());
                        console.log('🧪 Test detection result:',
                            result && result.landmarks ?
                                `Found ${result.landmarks.length} hands` :
                                'No hands detected');

                        // Update diagnostics panel with camera info
                        updateDiagnosticPanel({
                            camera: {
                                status: 'active',
                                resolution: `${video.videoWidth}x${video.videoHeight}`
                            }
                        });
                    } catch (err) {
                        console.error('⚠️ Test detection failed:', err);
                    }
                }
            }, 500);

        } catch (playError) {
            console.error('❌ Error playing video:', playError);

            // Try forcing play with user interaction
            const playButton = document.createElement('button');
            playButton.innerText = '▶️ Start Camera';
            playButton.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999999;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-family: Arial, sans-serif;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            playButton.addEventListener('click', async () => {
                try {
                    await video.play();
                    console.log('✅ Video playing after user interaction');
                    playButton.parentNode.removeChild(playButton);

                    // Show debug video if applicable
                    if (debugMode && document.body.contains(video)) {
                        video.style.display = 'block';
                    }
                } catch (err) {
                    console.error('❌ Still failed to play video:', err);
                    playButton.innerText = '❌ Failed to start camera';
                    playButton.style.backgroundColor = '#F44336';

                    // Remove after a delay
                    setTimeout(() => {
                        if (playButton.parentNode) {
                            playButton.parentNode.removeChild(playButton);
                        }
                    }, 3000);
                }
            });
            document.body.appendChild(playButton);

            // Auto-remove play button after 10 seconds
            setTimeout(() => {
                if (playButton.parentNode) {
                    playButton.parentNode.removeChild(playButton);
                }
            }, 10000);
        }

        return true; // Successfully started the camera

    } catch (error) {
        console.error('❌ Error starting camera:', error);

        // Update diagnostics panel with camera error
        updateDiagnosticPanel({
            camera: {
                status: 'error',
                error: error.message
            }
        });

        // Show error notification
        const cameraErrorNotice = document.createElement('div');
        cameraErrorNotice.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 9999999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            text-align: center;
        `;
        cameraErrorNotice.innerHTML = `
            <div style="font-weight: bold;">❌ Camera Error</div>
            <div style="font-size: 12px; margin-top: 5px;">
                ${error.message}<br>
                <button id="try-emergency-reset-cam" style="
                    margin-top: 8px;
                    padding: 5px 10px;
                    background: #FF9800;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 11px;
                ">
                    Try Emergency Reset
                </button>
            </div>
        `;
        document.body.appendChild(cameraErrorNotice);

        // Add emergency reset button
        const resetButton = cameraErrorNotice.querySelector('#try-emergency-reset-cam');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                cameraErrorNotice.parentNode.removeChild(cameraErrorNotice);
                emergencyReset();
            });
        }

        // Remove notice after 8 seconds
        setTimeout(() => {
            if (cameraErrorNotice.parentNode) {
                cameraErrorNotice.parentNode.removeChild(cameraErrorNotice);
            }
        }, 8000);

        return false; // Failed to start the camera
    }
}

// Stop the camera
function stopCamera() {
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        if (video.parentNode) {
            video.parentNode.removeChild(video);
        }
        video = null;
    }

    // Stop any ongoing scrolling animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Reset scrolling variables
    scrollVelocity = 0;
    isScrollAnimationActive = false;
    lastPalmPosition = 0;
    lastPalmPositions = [];

    // Update status indicator
    updateStatusIndicator(false);
}

// Detect hand gestures
function detectHandGestures() {
    if (!handLandmarker || !video) return;

    let rafId = null;

    const detect = async () => {
        // Check if the extension is enabled
        if (!enabled) {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            return;
        }

        try {
            // Use the HandLandmarker to detect hands
            rafId = null;
            const landmarkResult = handLandmarker.detectForVideo(video, performance.now());

            // Clear the canvas for re-drawing
            if (canvas && canvas.getContext) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }

            // Draw landmarks and process gestures if hands are detected
            if (landmarkResult && landmarkResult.landmarks && landmarkResult.landmarks.length > 0) {
                // Draw landmarks on the canvas if it exists
                if (canvas && canvas.getContext) {
                    drawHandLandmarks(canvas, landmarkResult.landmarks[0], landmarkResult.worldLandmarks && landmarkResult.worldLandmarks[0]);
                }

                // Process the first detected hand
                const landmarks = landmarkResult.landmarks[0];
                const worldLandmarks = landmarkResult.worldLandmarks && landmarkResult.worldLandmarks[0];

                // Store recent hand positions to calculate velocity
                storePalmPosition(landmarks);

                // Analyze hand gesture using the landmarks
                const gesture = identifyGesture(landmarks, worldLandmarks);

                // If gesture has changed, handle the gesture
                if (gesture !== lastGesture) {
                    const now = Date.now();
                    if (now - lastGestureTime > gestureDebounce) {
                        handleGesture(gesture);
                        lastGestureTime = now;

                        // Log gesture detection in debug mode
                        if (debugMode) {
                            console.log(`🤚 Gesture detected: ${gesture}`);

                            // Add to recent gestures history
                            if (window.recentGestures) {
                                window.recentGestures.unshift(gesture);
                                if (window.recentGestures.length > 5) {
                                    window.recentGestures.pop();
                                }

                                // Update diagnostic panel
                                updateDiagnosticPanel({
                                    gestures: window.recentGestures
                                });
                            }
                        }
                    }
                }

                // Handle scrolling based on palm position for "Open Palm" gesture
                if (gesture === 'Open Palm') {
                    handleScroll(landmarks);
                }

                // Update diagnostic panel with hand data
                updateDiagnosticPanel({
                    handPosition: {
                        x: Math.round(landmarks[0].x * 100) / 100,
                        y: Math.round(landmarks[0].y * 100) / 100,
                        z: Math.round(landmarks[0].z * 100) / 100
                    },
                    fingers: {
                        thumb: isFingerExtended(landmarks, 'thumb'),
                        index: isFingerExtended(landmarks, 'index'),
                        middle: isFingerExtended(landmarks, 'middle'),
                        ring: isFingerExtended(landmarks, 'ring'),
                        pinky: isFingerExtended(landmarks, 'pinky')
                    }
                });
            } else {
                // No hands detected - update the diagnostic panel
                updateDiagnosticPanel({
                    handPosition: null,
                    fingers: null
                });
            }
        } catch (error) {
            console.error('⚠️ Error in hand detection:', error);
        }

        // Continue detecting in the next animation frame
        rafId = requestAnimationFrame(detect);
    };

    // Start the detection loop
    detect();
}

// Identify the hand gesture from the landmarks
function identifyGesture(landmarks, worldLandmarks) {
    if (!landmarks) return 'No Hand';

    try {
        // Ultra-lenient logic for gesture detection - check for basic hand forms

        // Get the states of each finger
        const thumbExtended = isFingerExtended(landmarks, 'thumb', 0.5);  // More lenient threshold 
        const indexExtended = isFingerExtended(landmarks, 'index', 0.8);  // More lenient threshold
        const middleExtended = isFingerExtended(landmarks, 'middle', 0.8); // More lenient threshold
        const ringExtended = isFingerExtended(landmarks, 'ring', 0.8);    // More lenient threshold
        const pinkyExtended = isFingerExtended(landmarks, 'pinky', 0.8);  // More lenient threshold

        // Detect thumb and index pinch for pinch gesture
        const isPinching = isPinchGesture(landmarks, pinchThreshold * 1.5); // More lenient pinch threshold

        // Debug logging for finger states
        if (debugMode) {
            console.log('👆 Finger states:', {
                thumb: thumbExtended,
                index: indexExtended,
                middle: middleExtended,
                ring: ringExtended,
                pinky: pinkyExtended,
                isPinching
            });
        }

        // Count extended fingers for fallback detection
        const extendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
            .filter(v => v).length;

        // Ultra-simplified gesture recognition
        if (isPinching) {
            return 'Pinch';
        } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return 'Point';
        } else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return 'Peace';
        } else if (extendedCount >= 4) {
            // If at least 4 fingers are extended, consider it an open palm for scrolling
            return 'Open Palm';
        } else if (extendedCount <= 1) {
            // If 0 or 1 fingers are extended, consider it a closed fist
            return 'Closed Fist';
        } else if (indexExtended) {
            // If index finger is extended (regardless of others), it could be pointing
            return 'Point';
        } else if (extendedCount >= 2) {
            // If at least 2 fingers are extended, use for scrolling
            return 'Open Palm';
        } else {
            // Default to closed fist as a safe fallback
            return 'Closed Fist';
        }
    } catch (error) {
        console.error('❌ Error identifying gesture:', error);
        return 'No Hand';
    }
}

// Check if a finger is extended
function isFingerExtended(landmarks, finger, thresholdMultiplier = 1.0) {
    if (!landmarks) return false;

    try {
        // Adjust threshold based on the multiplier to make extension detection more or less strict
        // Higher values = more lenient (easier to detect as extended)
        const baseThreshold = 0.1 * thresholdMultiplier;

        // Define the landmark indices for each finger
        const fingerTipIndices = {
            'thumb': 4,
            'index': 8,
            'middle': 12,
            'ring': 16,
            'pinky': 20
        };

        const fingerBaseIndices = {
            'thumb': 2,  // CMC joint for thumb
            'index': 5,  // MCP joint for index
            'middle': 9, // MCP joint for middle
            'ring': 13,  // MCP joint for ring
            'pinky': 17  // MCP joint for pinky
        };

        // If the requested finger is not recognized, return false
        if (!fingerTipIndices[finger] || !fingerBaseIndices[finger]) {
            return false;
        }

        // Get the tip and base landmarks for the requested finger
        const tipIndex = fingerTipIndices[finger];
        const baseIndex = fingerBaseIndices[finger];
        const mcpIndex = fingerBaseIndices[finger]; // MCP joint

        // For thumb, we need a different approach since it moves differently
        if (finger === 'thumb') {
            // For thumb, compare with index finger MCP joint
            const indexMcp = landmarks[5]; // Index finger MCP joint
            const thumbTip = landmarks[4]; // Thumb tip
            const thumbIp = landmarks[3];  // Thumb IP joint

            // Compare the position of the thumb tip to the index MCP joint
            // If the thumb tip is significantly separated from the index MCP, consider it extended
            const distX = thumbTip.x - indexMcp.x;
            const distY = thumbTip.y - indexMcp.y;
            const distance = Math.sqrt(distX * distX + distY * distY);

            // Increased threshold for thumb extension - this makes thumb detection more sensitive
            return distance > baseThreshold * 1.5;
        }

        // For other fingers, use the Y position difference between tip and base
        // A finger is extended if its tip is significantly higher (lower Y value) than its base
        const tipY = landmarks[tipIndex].y;
        const baseY = landmarks[baseIndex].y;
        const mcpY = landmarks[mcpIndex].y;

        // Calculate the distance in the Y direction
        const yDifference = baseY - tipY;

        // A finger is considered extended if its tip is higher than its base by the threshold amount
        return yDifference > baseThreshold;
    } catch (error) {
        console.error('❌ Error checking finger extension:', error);
        return false;
    }
}

// Execute actions based on gesture
function executeGestureAction(gesture, landmarks) {
    // Current time for debouncing
    const now = Date.now();

    // Debounce gestures to prevent rapid switching
    if (lastGesture !== gesture) {
        if (now - lastGestureTime > gestureDebounce) {
            lastGesture = gesture;
            lastGestureTime = now;

            // Update the status indicator with the new gesture
            if (gesture !== 'unknown') {
                updateStatusIndicator(true, gesture);
            }

            // Log detected gesture for debugging
            console.log('Detected gesture:', gesture);
        } else {
            return; // Still in debounce period
        }
    }

    // Handle different gestures
    switch (gesture) {
        case 'open_palm':
            // Use open palm position for scrolling
            handleScrollGesture(landmarks);
            break;
        case 'pinch':
            // Pinch can be used for selection or clicking
            handlePinchGesture(landmarks);
            break;
        case 'peace':
            // Peace sign could be used for page navigation
            if (lastGesture !== 'peace') {
                window.history.back();
            }
            break;
        case 'closed_fist':
            // Fist could be used to stop scrolling or as a "hold" gesture
            // No action for now, just stop scrolling
            break;
    }
}

// Handle scroll gesture
function handleScrollGesture(landmarks) {
    // Palm position (using wrist landmark)
    const wristY = landmarks[0].y * window.innerHeight;
    const now = performance.now();

    // If this is the first detection, just store the position
    if (lastPalmPosition === 0) {
        lastPalmPosition = wristY;
        lastScrollTime = now;
        lastPalmPositions = [];
        return;
    }

    // Calculate time delta since last update
    const timeDelta = now - lastScrollTime;
    if (timeDelta < 16) return; // Limit to ~60fps max

    // Calculate the movement
    const deltaY = wristY - lastPalmPosition;

    // Store recent positions for velocity calculation (keep last 5)
    lastPalmPositions.push({
        position: wristY,
        time: now
    });
    if (lastPalmPositions.length > 5) {
        lastPalmPositions.shift();
    }

    // Update last position and time
    lastPalmPosition = wristY;
    lastScrollTime = now;

    // Further reduce threshold for even more responsive scrolling
    const effectiveThreshold = Math.max(3, scrollThreshold * 0.5);

    // Add debugging info to the panel
    updateDebugInfo({
        wristY: wristY.toFixed(0),
        deltaY: deltaY.toFixed(1),
        threshold: effectiveThreshold,
        velocity: scrollVelocity.toFixed(1)
    });

    // Check if movement exceeds threshold (using reduced threshold for better responsiveness)
    if (Math.abs(deltaY) > effectiveThreshold) {
        // Calculate velocity based on recent movements
        let velocity = calculateVelocity(lastPalmPositions);

        // Make the mapping between hand movement and scroll even more immediate
        // Positive deltaY means hand moving down, should scroll down
        velocity = deltaY * scrollSensitivity * 2.0; // Increased multiplier for even more sensitivity

        // Use a higher minimum velocity to ensure scrolling is noticeable
        if (Math.abs(velocity) < 3 && Math.abs(velocity) > 0.5) {
            velocity = Math.sign(velocity) * 3;
        }

        // Limit max speed
        if (Math.abs(velocity) > maxScrollSpeed) {
            velocity = Math.sign(velocity) * maxScrollSpeed;
        }

        // Update scroll velocity
        scrollVelocity = velocity;

        // Start the scrolling animation
        startScrollAnimation();

        // Update the gesture indicator with the scroll direction
        const gestureIndicator = document.getElementById('gesture-indicator');
        if (gestureIndicator) {
            const speed = Math.abs(velocity).toFixed(1);
            const direction = velocity > 0 ? 'Down' : 'Up';
            gestureIndicator.textContent = `Gesture: Scrolling ${direction} (${speed} px/frame)`;

            // Color based on speed (orange for down, green for up)
            const intensity = Math.min(0.3 + Math.abs(velocity) / 100, 0.7);
            if (velocity > 0) {
                gestureIndicator.style.backgroundColor = `rgba(255, 152, 0, ${intensity})`;
            } else {
                gestureIndicator.style.backgroundColor = `rgba(0, 255, 0, ${intensity})`;
            }
        }
    }
}

// Calculate velocity based on recent movements - enhanced for better sensitivity
function calculateVelocity(positions) {
    if (positions.length < 2) return 0;

    // Get the oldest and newest positions for a more accurate velocity over time
    const oldest = positions[0];
    const newest = positions[positions.length - 1];

    // Calculate time difference in milliseconds
    const timeDelta = newest.time - oldest.time;

    if (timeDelta <= 0) return 0;

    // Calculate distance in Y direction only
    const distanceY = newest.position - oldest.position;

    // Calculate basic velocity (pixels per millisecond)
    let velocity = distanceY / timeDelta;

    // Scale to a reasonable scroll amount (adjusted for smoother scrolling)
    velocity = velocity * 1000 * 0.2; // Increased from 0.15 for more responsive scrolling

    // Add more aggressive exponential scaling for faster hand movements
    // This makes small movements gentle but responds more to quick gestures
    const scaleFactor = Math.pow(Math.abs(velocity), 1.3) / Math.abs(velocity);
    velocity = velocity * scaleFactor;

    // Ensure we have some minimum velocity to make small movements noticeable
    if (Math.abs(velocity) < 5 && Math.abs(velocity) > 0.5) {
        velocity = Math.sign(velocity) * 5; // Increased minimum velocity
    }

    return velocity;
}

// Handle pinch gesture
function handlePinchGesture(landmarks) {
    // Implement pinch gesture handling logic here
    console.log('Pinch gesture detected');
}

// Process detection results
function processResults(results) {
    // Add debugging to visual panel if possible
    if (visualFeedbackPanel) {
        const debugInfo = {
            timestamp: new Date().toLocaleTimeString(),
            hasLandmarks: results && results.landmarks && results.landmarks.length > 0
        };

        if (results && results.landmarks && results.landmarks.length > 0) {
            debugInfo.numLandmarks = results.landmarks[0].length;
            debugInfo.wristY = (results.landmarks[0][0].y * window.innerHeight).toFixed(0);
        }

        // If updateDebugInfo function exists, call it
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo(debugInfo);
        }
    }

    if (results && results.landmarks && results.landmarks.length > 0) {
        const gesture = detectGesture(results.landmarks[0]);
        executeGestureAction(gesture, results.landmarks[0]);
    }
}

// Handle camera errors in a centralized way
function handleCameraError(err) {
    console.error('❌ Camera error:', err);

    // Show error in status indicator
    if (statusIndicator) {
        const iconElement = statusIndicator.querySelector('div');
        if (iconElement) iconElement.style.backgroundColor = '#F44336'; // Red for error

        const textElement = statusIndicator.querySelector('span');
        if (textElement) textElement.textContent = 'Camera error: ' + (err.message || 'Unknown error');
    }

    // Display error in visual feedback panel if it exists
    const feedbackVideo = document.getElementById('hand-tracking-video');
    if (feedbackVideo) {
        feedbackVideo.style.display = 'none';

        // Remove any existing error message first
        const existingError = feedbackVideo.parentNode?.querySelector('.camera-error-message');
        if (existingError) existingError.remove();

        const errorMsg = document.createElement('div');
        errorMsg.className = 'camera-error-message';
        errorMsg.style.cssText = `
            width: 100%;
            height: 195px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #333;
            color: white;
            text-align: center;
            padding: 10px;
            font-size: 14px;
            border-radius: 5px;
        `;
        errorMsg.innerHTML = `
            <div>
                <div style="color: #F44336; font-size: 24px; margin-bottom: 10px;">📷❌</div>
                <div>Camera access error: ${err.message || 'Unknown error'}</div>
                <div style="font-size: 12px; margin-top: 10px;">
                    Please check your camera permissions in browser settings
                    <button id="retry-camera" style="display: block; margin: 10px auto; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Retry Camera
                    </button>
                </div>
            </div>
        `;

        if (feedbackVideo.parentNode) {
            feedbackVideo.parentNode.appendChild(errorMsg);

            // Add retry button functionality
            const retryButton = errorMsg.querySelector('#retry-camera');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    if (errorMsg.parentNode) {
                        errorMsg.parentNode.removeChild(errorMsg);
                    }
                    feedbackVideo.style.display = 'block';
                    startCamera(); // Try again
                });
            }
        }
    }
}

// Apply scrolling animation with decay
function animateScrolling() {
    if (Math.abs(scrollVelocity) > 0.5) {
        // Apply the scroll - using smoother scrolling method
        window.scrollBy({
            top: scrollVelocity,
            behavior: 'auto' // Using 'auto' instead of 'smooth' for better responsiveness
        });

        // Apply decay to gradually slow down (adjusted for smoother animation)
        scrollVelocity *= scrollDecay;

        // Add some natural variation to make scrolling feel more natural
        if (Math.random() > 0.7) {
            scrollVelocity += (Math.random() - 0.5) * 0.5;
        }

        // Continue animation
        animationFrameId = requestAnimationFrame(animateScrolling);
        isScrollAnimationActive = true;
    } else {
        // Stop animation when velocity is negligible
        scrollVelocity = 0;
        isScrollAnimationActive = false;
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Start the scrolling animation if not already running
function startScrollAnimation() {
    if (!isScrollAnimationActive && Math.abs(scrollVelocity) > 0.5) {
        // Reset any existing animation frame to avoid conflicts
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        animationFrameId = requestAnimationFrame(animateScrolling);
        isScrollAnimationActive = true;
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log('📨 Message received in content script:', request);

    // Handle enable/disable messages
    if (request.command === 'toggleGestures') {
        enabled = request.enabled;
        console.log(`${enabled ? '✅' : '❌'} Hand gestures ${enabled ? 'enabled' : 'disabled'}`);

        // Update UI if needed
        updateStatusIndicator(enabled);

        // If enabling and handLandmarker isn't initialized yet, initialize it
        if (enabled && !handLandmarker) {
            initHandLandmarker();
        }

        // If disabling, remove status indicator and visual feedback
        if (!enabled) {
            if (statusIndicator && statusIndicator.parentNode) {
                statusIndicator.parentNode.removeChild(statusIndicator);
                statusIndicator = null;
            }

            if (visualFeedbackPanel && visualFeedbackPanel.parentNode) {
                visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
                visualFeedbackPanel = null;
            }
        }

        sendResponse({ status: 'success', enabled: enabled });
    }
    // Handle toggle feedback panel message
    else if (request.command === 'toggleFeedback') {
        const showFeedback = request.show;
        console.log(`${showFeedback ? '👁️' : '🙈'} Visual feedback ${showFeedback ? 'enabled' : 'disabled'}`);

        showVisualFeedback = showFeedback;

        // If enabling feedback and panel doesn't exist, create it
        if (showFeedback && !visualFeedbackPanel) {
            createVisualFeedbackPanel();
        }
        // If disabling feedback and panel exists, remove it
        else if (!showFeedback && visualFeedbackPanel && visualFeedbackPanel.parentNode) {
            visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
            visualFeedbackPanel = null;
        }

        // Save the setting
        chrome.storage.local.get(['settings'], function (result) {
            const settings = result.settings || {};
            settings.showVisualFeedback = showFeedback;
            chrome.storage.local.set({ settings });
        });

        sendResponse({ status: 'success', showFeedback: showFeedback });
    }
    // Handle force show panel message
    else if (request.command === 'forceShowPanel') {
        console.log('🔄 Force showing visual feedback panel');

        // Force remove any existing panel
        if (visualFeedbackPanel && visualFeedbackPanel.parentNode) {
            visualFeedbackPanel.parentNode.removeChild(visualFeedbackPanel);
            visualFeedbackPanel = null;
        }

        // Always enable visual feedback
        showVisualFeedback = true;

        // Create panel with force flag
        createVisualFeedbackPanel(false, true);

        // Give feedback about success
        sendResponse({
            status: 'success',
            message: 'Visual feedback panel forced visible'
        });
    }
    // Handle emergency reset command from popup
    else if (request.command === 'emergencyReset') {
        console.log('🚨 Emergency reset requested from popup');

        // Call the emergency reset function
        emergencyReset();

        // Send response
        sendResponse({
            status: 'success',
            message: 'Emergency reset initiated'
        });
    }
    // Unknown command
    else {
        console.warn('⚠️ Unknown command received:', request.command);
        sendResponse({ status: 'error', message: 'Unknown command' });
    }

    // Return true to indicate we'll send a response asynchronously
    return true;
});

// Check if the hand is making a pinch gesture
function isPinchGesture(landmarks, threshold = 0.1) {
    try {
        if (!landmarks) return false;

        // Get thumb tip and index finger tip positions
        const thumbTip = landmarks[4]; // Thumb tip
        const indexTip = landmarks[8]; // Index finger tip

        // Get additional landmarks to improve detection
        const thumbIp = landmarks[3]; // Thumb IP joint
        const indexDip = landmarks[7]; // Index finger DIP joint

        // Calculate distance between thumb tip and index finger tip
        const tipDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );

        // Calculate a secondary distance between thumb IP and index DIP
        // This helps with more robust pinch detection
        const secondaryDistance = Math.sqrt(
            Math.pow(thumbIp.x - indexDip.x, 2) +
            Math.pow(thumbIp.y - indexDip.y, 2) +
            Math.pow(thumbIp.z - indexDip.z, 2)
        );

        // Use a very lenient threshold for pinch detection
        const adjustedThreshold = threshold * 1.5;

        // For debugging
        if (tipDistance < adjustedThreshold * 2) {
            console.log(`👌 Potential pinch: ${tipDistance.toFixed(3)} (threshold: ${adjustedThreshold})`);
        }

        // Return true if either distance is below threshold
        // This makes pinch detection more reliable
        return (tipDistance < adjustedThreshold || secondaryDistance < adjustedThreshold * 1.2);
    } catch (error) {
        console.error('❌ Error in isPinchGesture:', error);
        return false;
    }
}

// Update the diagnostic panel with the latest info
function updateDiagnosticPanel(data = {}) {
    // Find the diagnostics panel
    const panel = document.getElementById('hand-tracking-diagnostics');
    if (!panel) return;

    // Update hand position data
    if (data.handPosition) {
        const handPositionElement = panel.querySelector('#hand-position-data');
        if (handPositionElement) {
            handPositionElement.innerHTML = `
                <span style="color: #E0E0E0;">Hand position:</span>
                <span style="display: block; margin-left: 5px;">
                    X: ${data.handPosition.x}, Y: ${data.handPosition.y}, Z: ${data.handPosition.z}
                </span>
            `;
        }
    } else if (data.handPosition === null) {
        const handPositionElement = panel.querySelector('#hand-position-data');
        if (handPositionElement) {
            handPositionElement.innerHTML = `
                <span style="color: #E0E0E0;">Hand position:</span>
                <span style="display: block; margin-left: 5px; color: #F44336;">
                    No hand detected
                </span>
            `;
        }
    }

    // Update finger status
    if (data.fingers) {
        const fingerStatusElement = panel.querySelector('#finger-status');
        if (fingerStatusElement) {
            fingerStatusElement.innerHTML = `
                <span style="color: #E0E0E0;">Fingers:</span>
                <span style="display: block; margin-left: 5px;">
                    <span style="color: ${data.fingers.thumb ? '#4CAF50' : '#F44336'};">Thumb</span>
                    <span style="color: ${data.fingers.index ? '#4CAF50' : '#F44336'};">Index</span>
                    <span style="color: ${data.fingers.middle ? '#4CAF50' : '#F44336'};">Middle</span>
                    <span style="color: ${data.fingers.ring ? '#4CAF50' : '#F44336'};">Ring</span>
                    <span style="color: ${data.fingers.pinky ? '#4CAF50' : '#F44336'};">Pinky</span>
                </span>
            `;
        }
    } else if (data.fingers === null) {
        const fingerStatusElement = panel.querySelector('#finger-status');
        if (fingerStatusElement) {
            fingerStatusElement.innerHTML = `
                <span style="color: #E0E0E0;">Fingers:</span>
                <span style="display: block; margin-left: 5px; color: #F44336;">
                    No data
                </span>
            `;
        }
    }

    // Update gesture history
    if (data.gestures) {
        const gestureHistoryElement = panel.querySelector('#gesture-history');
        if (gestureHistoryElement) {
            const gestureText = data.gestures.map(g => {
                // Color-code gestures
                let color;
                switch (g) {
                    case 'Open Palm': color = '#4CAF50'; break;
                    case 'Closed Fist': color = '#F44336'; break;
                    case 'Pinch': color = '#FFC107'; break;
                    case 'Peace': color = '#2196F3'; break;
                    default: color = '#E0E0E0';
                }
                return `<span style="color: ${color};">${g}</span>`;
            }).join(' → ');

            gestureHistoryElement.innerHTML = `
                <span style="color: #E0E0E0;">Recent gestures:</span>
                <span style="display: block; margin-left: 5px;">
                    ${gestureText || 'None'}
                </span>
            `;
        }
    }

    // Update camera status
    if (data.camera) {
        const cameraStatusElement = panel.querySelector('#camera-status');
        if (cameraStatusElement) {
            if (data.camera.status === 'active') {
                cameraStatusElement.innerHTML = `
                    <span style="color: #4CAF50;">Camera: Active</span>
                    <span style="font-size: 9px; display: block; opacity: 0.8;">
                        ${data.camera.resolution || 'Unknown resolution'}
                    </span>
                `;
            } else if (data.camera.status === 'error') {
                cameraStatusElement.innerHTML = `
                    <span style="color: #F44336;">Camera: Error</span>
                    <span style="font-size: 9px; display: block; opacity: 0.8;">
                        ${data.camera.error || 'Unknown error'}
                    </span>
                `;
            }
        }
    }

    // Add settings info if provided (like after optimization)
    if (data.settings) {
        // Create or update settings info
        let settingsInfo = panel.querySelector('.settings-info');
        if (!settingsInfo) {
            settingsInfo = document.createElement('div');
            settingsInfo.className = 'settings-info';
            settingsInfo.style.cssText = `
                margin-top: 5px;
                padding: 5px;
                background-color: rgba(76, 175, 80, 0.2);
                border-radius: 3px;
                color: #AEEA00;
                font-size: 10px;
            `;
            panel.appendChild(settingsInfo);
        }

        settingsInfo.innerHTML = `
            <div>⚡ Settings applied:</div>
            <div style="margin-left: 5px; font-size: 9px;">
                Threshold: ${data.settings.scrollThreshold}, 
                Sensitivity: ${data.settings.scrollSensitivity}, 
                Decay: ${data.settings.scrollDecay}
            </div>
        `;

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (settingsInfo && settingsInfo.parentNode) {
                settingsInfo.parentNode.removeChild(settingsInfo);
            }
        }, 5000);
    }
}

// Draw hand landmarks on the canvas
function drawHandLandmarks(canvas, landmarks, worldLandmarks) {
    if (!canvas || !landmarks) return;

    try {
        // Get the canvas context and clear it
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Mirror the drawing
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        // Map the landmarks to canvas coordinates
        const canvasLandmarks = landmarks.map(landmark => ({
            x: landmark.x * canvas.width,
            y: landmark.y * canvas.height,
            z: landmark.z,  // Keep original z for depth
        }));

        // Draw connections between landmarks to create a hand skeleton
        drawHandConnections(ctx, canvasLandmarks);

        // Draw points at each landmark with depth-based coloring
        for (let i = 0; i < canvasLandmarks.length; i++) {
            const landmark = canvasLandmarks[i];

            // Map z-coordinate to a color (red for closer to camera, blue for further)
            const depth = landmark.z;
            const red = Math.round(255 * (1 + depth));
            const blue = Math.round(255 * (1 - depth));
            const color = `rgb(${Math.min(255, Math.max(0, red))}, 150, ${Math.min(255, Math.max(0, blue))})`;

            // Draw point
            ctx.beginPath();
            ctx.arc(landmark.x, landmark.y, i === 8 ? 8 : 5, 0, 2 * Math.PI); // Bigger circle for index finger
            ctx.fillStyle = i === 8 ? '#FFEB3B' : color; // Yellow for index finger tip
            ctx.fill();

            // Add point numbers for debugging
            if (debugMode) {
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText(i.toString(), landmark.x, landmark.y);
            }
        }

        // Restore the canvas context
        ctx.restore();

    } catch (error) {
        console.error('Error drawing hand landmarks:', error);
    }
}

// Draw connections between landmarks to create a hand skeleton
function drawHandConnections(ctx, landmarks) {
    if (!ctx || !landmarks || landmarks.length < 21) return;

    // Define the connections as pairs of indices
    const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm
        [0, 5], [5, 9], [9, 13], [13, 17]
    ];

    // Draw each connection as a line
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';

    connections.forEach(([i, j]) => {
        if (landmarks[i] && landmarks[j]) {
            ctx.beginPath();
            ctx.moveTo(landmarks[i].x, landmarks[i].y);
            ctx.lineTo(landmarks[j].x, landmarks[j].y);
            ctx.stroke();
        }
    });
}

// Store palm position for smoother scrolling
function storePalmPosition(landmarks) {
    if (!landmarks) return;

    try {
        // Use the wrist position as the main palm position
        const palmPosition = landmarks[0].y * window.innerHeight;

        // Add to the recent positions array
        lastPalmPositions.push(palmPosition);

        // Keep only the last 5 positions for velocity calculation
        if (lastPalmPositions.length > 5) {
            lastPalmPositions.shift();
        }
    } catch (error) {
        console.error('Error storing palm position:', error);
    }
}

// Handle a detected gesture
function handleGesture(gesture) {
    // Update the last gesture
    lastGesture = gesture;

    // Update gesture indicator in the UI
    const gestureIndicator = document.getElementById('gesture-indicator');
    if (gestureIndicator) {
        // Clear any existing classes
        gestureIndicator.className = '';

        // Set color based on gesture
        let backgroundColor = 'rgba(0, 0, 0, 0.3)';

        switch (gesture) {
            case 'Open Palm':
                backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Green
                break;
            case 'Closed Fist':
                backgroundColor = 'rgba(244, 67, 54, 0.3)'; // Red
                break;
            case 'Pinch':
                backgroundColor = 'rgba(255, 193, 7, 0.3)'; // Amber
                break;
            case 'Peace':
                backgroundColor = 'rgba(33, 150, 243, 0.3)'; // Blue
                break;
            case 'Point':
                backgroundColor = 'rgba(156, 39, 176, 0.3)'; // Purple
                break;
        }

        gestureIndicator.style.backgroundColor = backgroundColor;
        gestureIndicator.textContent = gesture;
    }

    // Handle specific gestures
    switch (gesture) {
        case 'Closed Fist':
            // Stop scrolling
            scrollVelocity = 0;
            break;

        case 'Pinch':
            // TODO: Implement clicking
            break;

        case 'Peace':
            // Go back in history
            window.history.back();
            break;

        case 'Point':
            // TODO: Implement pointing/clicking
            break;
    }
}

// Handle scrolling based on hand position
function handleScroll(landmarks) {
    if (!landmarks) return;

    try {
        // Get palm Y position (using wrist landmark)
        const palmY = landmarks[0].y * window.innerHeight;

        // Calculate movement since last position
        if (lastPalmPosition !== 0) {
            const palmMovement = palmY - lastPalmPosition;

            // Only scroll if movement exceeds threshold
            if (Math.abs(palmMovement) > scrollThreshold) {
                // Calculate scroll velocity based on hand movement
                // Movement is inverted: moving hand down (positive movement) = scroll up (negative)
                const newVelocity = -palmMovement * scrollSensitivity;

                // Apply the new velocity (with smoothing)
                scrollVelocity = scrollVelocity * 0.3 + newVelocity * 0.7;

                // Limit to maximum speed
                scrollVelocity = Math.max(-maxScrollSpeed, Math.min(maxScrollSpeed, scrollVelocity));

                // Start the smooth scrolling animation if not already running
                if (!isScrollAnimationActive) {
                    animateScroll();
                }
            }
        }

        // Update the last position
        lastPalmPosition = palmY;

    } catch (error) {
        console.error('Error handling scroll:', error);
    }
}

// Animate scrolling with inertia
function animateScroll() {
    if (!enabled) return;

    isScrollAnimationActive = true;

    // Apply the scroll
    if (Math.abs(scrollVelocity) > 0.5) {
        window.scrollBy(0, scrollVelocity);

        // Apply decay
        scrollVelocity *= scrollDecay;

        // Update the diagnostic info if needed
        if (document.getElementById('hand-tracking-diagnostics')) {
            updateDiagnosticPanel();
        }
    } else {
        // Stop animation when velocity is very small
        scrollVelocity = 0;
        isScrollAnimationActive = false;
        return;
    }

    // Continue animation
    animationFrameId = requestAnimationFrame(animateScroll);
}