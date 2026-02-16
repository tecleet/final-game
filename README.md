# Cyberpunk YouTube Stream Visualizer

## Important: How to Run This App

This application uses a **Backend Architecture** to securely handle API keys and avoid CORS issues.

### 1. Setup the Backend (Node.js)

The backend handles the connection to YouTube.

1.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your API Key:
    -   Open `backend/.env`
    -   Replace `YOUR_API_KEY_HERE` with your **YouTube Data API v3 Key**.
4.  Start the server:
    ```bash
    node server.js
    ```
    -   It should say: `Backend running on http://localhost:3000`

### 2. Setup the Frontend (Browser)

1.  Open a new terminal in the **root** folder (where `index.html` is).
2.  Start a local server (required for 3D modules):
    ```bash
    python3 -m http.server 8000
    ```
3.  Open your browser to: **[http://localhost:8000](http://localhost:8000)**

### 3. Usage

1.  **Video ID:** Paste the ID of a *currently live* YouTube video.
2.  **Backend URL:** Default is `ws://localhost:3000` (leave as is for local run).
3.  **Connect:** Click CONNECT. The status should change to "Connected to Backend...".

### Demo Mode
Click "DEMO MODE" to see the visualizer in action with fake data (Matrix theme) without needing a backend or API key.

## Troubleshooting

-   **"WebSocket Connection Failed":** Ensure `node server.js` is running in the `backend` folder.
-   **"Stream Offline":** The video ID must be a live broadcast, not a past recording.
-   **Images not loading:** The app fetches random animal avatars from Unsplash. If they fail, check your internet connection.
