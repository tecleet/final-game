import express from 'express';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;

// Serve a basic status page
app.get('/', (req, res) => {
    res.send('Cyberpunk Visualizer Backend is Running. Connect via WebSocket.');
});

const server = app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    let pollingInterval = null;
    let isActive = true;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'CONNECT') {
                let apiKey = API_KEY;
                if ((!apiKey || apiKey === 'YOUR_API_KEY_HERE') && data.apiKey) {
                    apiKey = data.apiKey;
                }

                if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
                    ws.send(JSON.stringify({ type: 'error', message: 'Server API Key not configured. Please set it in .env or provide it in the UI.' }));
                    return;
                }

                await startPolling(ws, data.videoId, apiKey);
            }
        } catch (err) {
            console.error('Message error:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        isActive = false;
        if (pollingInterval) clearTimeout(pollingInterval);
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
        isActive = false;
        if (pollingInterval) clearTimeout(pollingInterval);
    });

    // --- Polling Logic ---
    async function startPolling(ws, videoId, apiKey) {
        // 1. Fetch Live Chat ID
        ws.send(JSON.stringify({ type: 'status', message: 'Fetching Live Stream Details...' }));

        try {
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`;
            const vidRes = await axios.get(videoUrl);

            if (!vidRes.data.items || vidRes.data.items.length === 0) {
                throw new Error("Video not found.");
            }

            const item = vidRes.data.items[0];
            const snippet = item.snippet;
            const details = item.liveStreamingDetails;

            // Strict Live Check
            if (snippet.liveBroadcastContent !== 'live') {
                 throw new Error(`Video is '${snippet.liveBroadcastContent}', not 'live'. Visualizer only works for ACTIVE livestreams.`);
            }

            if (!details || !details.activeLiveChatId) {
                throw new Error("No active live chat found. Is the video live?");
            }

            const liveChatId = details.activeLiveChatId;
            ws.send(JSON.stringify({ type: 'status', message: 'Connected! Fetching chat...' }));

            // 2. Start Polling Loop
            let pageToken = '';

            const poll = async () => {
                if (!isActive) return;

                try {
                    let chatUrl = `https://www.googleapis.com/youtube/v3/liveChatMessages?part=snippet,authorDetails&liveChatId=${liveChatId}&key=${apiKey}`;
                    if (pageToken && pageToken.length > 0) {
                        chatUrl += `&pageToken=${pageToken}`;
                    }

                    const chatRes = await axios.get(chatUrl);

                    // Send Messages
                    if (chatRes.data.items && chatRes.data.items.length > 0) {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            messages: chatRes.data.items
                        }));
                    }

                    // Setup next poll
                    pageToken = chatRes.data.nextPageToken;
                    let delay = chatRes.data.pollingIntervalMillis;
                    if (!delay || delay < 1000) delay = 5000;

                    pollingInterval = setTimeout(poll, delay);

                } catch (err) {
                    if (!isActive) return;
                    console.error("Polling Error:", err.response ? err.response.data : err.message);

                    let errorMsg = "Unknown Error";
                    if (err.response) {
                        if (err.response.status === 403) errorMsg = "API Quota Exceeded or Forbidden.";
                        else if (err.response.status === 404) errorMsg = "Stream Offline or Chat Disabled. Is the video Live?";
                        else if (err.response.status === 400) errorMsg = "Invalid Request. Check API Key or Video ID.";
                        else errorMsg = `API Error ${err.response.status}`;
                    } else {
                        errorMsg = err.message;
                    }

                    ws.send(JSON.stringify({ type: 'error', message: errorMsg }));

                    // Stop polling on fatal errors (403/404)
                    if (err.response && (err.response.status === 404 || err.response.status === 403)) {
                        return;
                    }

                    // Retry otherwise
                    pollingInterval = setTimeout(poll, 10000);
                }
            };

            poll();

        } catch (error) {
            console.error("Init Error:", error.message);
            let msg = error.message;
            if (error.response) {
                 msg = error.response.data.error.message || error.message;
            }
            ws.send(JSON.stringify({ type: 'error', message: msg }));
        }
    }
});
