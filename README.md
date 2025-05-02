# Hand Gesture Scroll Chrome Extension

This Chrome extension allows you to scroll through webpages using hand gestures captured by your webcam and processed with a simulated hand tracking system.

## Features

- Hands-free browsing of web pages with multiple gesture controls
- Toggle gesture control on/off
- Simulated hand tracking with realistic gestures (no external dependencies)
- Visual feedback panel showing live hand tracking
- Minimal UI impact when enabled
- Customizable settings for sensitivity and performance

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the directory containing this extension
5. The extension should now appear in your toolbar

## Usage

1. Click the extension icon in your Chrome toolbar to open the popup
2. Toggle the switch to enable/disable hand gesture control
3. When enabled, the extension will request access to your camera (optional)
4. Use the following gestures to control your browsing:

### Gesture Controls

- **Open Palm**: Move your hand up and down to scroll the webpage
- **Pinch** (thumb and index finger): Click on links or buttons
- **Peace Sign** (index and middle finger extended): Go back to the previous page
- **Closed Fist**: Pause scrolling

### Visual Feedback

The extension provides a draggable visual feedback panel that shows:

- Simulated hand landmark tracking
- Current detected gesture
- Hand position visualization

You can:
- Toggle the panel on/off by clicking the 👁️ icon in the status indicator
- Minimize the panel using the − button
- Close the panel using the × button
- Drag the panel to any position on the screen

## Simulation Mode

This extension uses a built-in hand tracking simulation that:

- Works without requiring MediaPipe library access
- Provides a realistic simulation of hand tracking
- Demonstrates gestures and functionality without privacy concerns
- Works even without camera access

## Customization

You can customize the extension's behavior by clicking on the "Advanced Settings" link in the popup:

### Adjustable Settings

- **Scroll Threshold**: How much hand movement is required to trigger scrolling
- **Scroll Sensitivity**: How fast the page scrolls in response to hand movements
- **Gesture Debounce**: How long to wait before detecting a new gesture
- **Pinch Threshold**: How close thumb and index finger need to be to register as a pinch
- **Status Indicator**: Toggle the visual indicator that shows the current gesture
- **Visual Feedback Panel**: Toggle the panel showing the simulated hand tracking

## Required Permissions

- Camera access (optional, for real hand tracking)
- Active tab (to apply scrolling and click actions)
- Storage (to save your preferences)

## Files in this Project

- `manifest.json`: Extension configuration
- `popup.html/js`: User interface for the extension popup
- `content.js`: Main script that handles gesture detection and actions
- `background.js`: Background script for permission handling
- `settings.html/js`: Settings page for customizing extension behavior

## Notes

- Replace the placeholder icon files in the `images` folder with actual icon images
- The extension uses simulated hand tracking to avoid Content Security Policy restrictions
