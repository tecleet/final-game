# Cyberpunk YouTube Stream Visualizer

## Important: How to Run This App

**Do not open `index.html` directly (e.g., double-clicking it).**

Modern browsers (Chrome, Safari, etc.) block features like **ES Modules** (used by Three.js) when opening files directly from your computer due to security policies (CORS). This is why you see the "Access to script... blocked by CORS policy" error.

### Solution: Use a Local Server

Since you are on a Mac, Python is likely pre-installed. Follow these steps:

1. Open your **Terminal**.
2. Navigate to the folder containing these files (e.g., `cd path/to/folder`).
3. Run the following command:
   ```bash
   python3 -m http.server
   ```
4. Open your browser (Chrome recommended) and go to:
   [http://localhost:8000](http://localhost:8000)

### Or use the Helper Script (Mac)

1. Double-click the file named **`run_mac.command`** in this folder.
2. It will automatically start the server and open your default browser.

---

## Usage

1. **Enter Video ID:** Paste the ID of a live YouTube video (the part after `v=` in the URL).
2. **Enter API Key:** You need a Google API Key with the **YouTube Data API v3** enabled.
3. **Click Connect:** Start visualizing comments!
4. **Demo Mode:** Click "DEMO MODE (FAKE DATA)" to see the visualizer in action without connecting to YouTube.

## Features
- **Real-time Visualization:** Comments appear as floating holographic panels.
- **Dynamic Scaling:** Boxes grow larger as users comment more.
- **Cyberpunk Aesthetics:** Neon glow, bloom, and particle effects.
- **Audio:** Glitch/Ping sounds on activity.

---

## Troubleshooting

### API Connection Issues

If you see errors in the console or the app doesn't connect:

1.  **CORS Errors / 403 Forbidden:**
    *   **API Key Restrictions:** If you restricted your API key to specific HTTP referrers, ensure you have added `http://localhost:8000` (or whatever port you are using) to the allowed list in the Google Cloud Console.
    *   **Browser Extensions:** Sometimes ad-blockers or privacy extensions can interfere with API requests.

2.  **404 Not Found:**
    *   **Video ID:** Double-check the Video ID. It must be for a **currently live** stream. Past livestreams (VODs) will not work with the Live Chat API endpoint used here.
    *   **Stream Offline:** The streamer may have ended the broadcast.

3.  **Quota Exceeded (403):**
    *   The YouTube Data API has a daily quota. This app polls frequently. If you hit the limit, you will need to wait until the next day (Pacific Time) or use a different API key.
