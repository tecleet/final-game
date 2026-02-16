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

### API Connection Issues / GitHub Pages

If you are running this on **GitHub Pages** (e.g., `https://yourname.github.io/repo/`) or seeing CORS errors:

1.  **CORS Errors / 403 Forbidden:**
    *   **The Problem:** Google blocks API requests from unauthorized websites.
    *   **The Solution:** You **must** add your specific URL to the Google Cloud Console.
        1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
        2. Click the "Edit" (pencil) icon next to your API Key.
        3. Under **Application restrictions**, select **Websites (HTTP referrers)**.
        4. Click **ADD ITEM**.
        5. Enter your URL exactly: e.g., `https://tecleet.github.io/*` (don't forget the `*` at the end).
        6. Also add `http://localhost:8000/*` for local testing.
        7. Click **SAVE**. It may take 5 minutes to propagate.

2.  **Why not GitHub Secrets?**
    *   **GitHub Secrets** are for *build scripts* (server-side). This is a *client-side* web app. The browser needs the API key to talk to YouTube. Even if you "hide" it in the code, it is visible in the Network tab.
    *   **Security:** The correct way to secure a client-side key is by using the **Website Restrictions** (Referrers) mentioned above. This prevents others from using your key on *their* websites.

3.  **404 Not Found:**
    *   **Video ID:** Double-check the Video ID. It must be for a **currently live** stream. Past livestreams (VODs) will not work with the Live Chat API endpoint used here.
    *   **Stream Offline:** The streamer may have ended the broadcast.

4.  **Quota Exceeded (403):**
    *   The YouTube Data API has a daily quota. This app polls frequently. If you hit the limit, you will need to wait until the next day (Pacific Time) or use a different API key.
