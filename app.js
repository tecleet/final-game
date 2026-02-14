import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    PARTICLE_COUNT: 1000,
    BLOOM_STRENGTH: 1.5,
    BLOOM_RADIUS: 0.4,
    BLOOM_THRESHOLD: 0,
    FOV: 60,
    CAMERA_Z: 50,
    COLORS: [0x00ffff, 0xff00ff, 0xbc13fe] // Cyan, Magenta, Purple
};

// --- GLOBALS ---
let scene, camera, renderer, composer;
let particles;
const clock = new THREE.Clock();

// --- INITIALIZATION ---
function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.002); // Cyberpunk fog

    // 2. Camera
    camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = CONFIG.CAMERA_Z;

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false }); // Post-processing handles AA usually, or disable for performance
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050505);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 4. Post-processing (Bloom)
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = CONFIG.BLOOM_THRESHOLD;
    bloomPass.strength = CONFIG.BLOOM_STRENGTH;
    bloomPass.radius = CONFIG.BLOOM_RADIUS;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 5. Background Particles
    createParticles();

    // 6. Lights (Ambient + Directional for depth)
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize);

    // 8. Setup UI
    setupUI();

    // 9. Start Loop
    animate();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    const color = new THREE.Color();

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        // Random position in a large box
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 100 - 50; // Push slightly back

        positions.push(x, y, z);

        // Random cyberpunk color
        color.setHex(CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)]);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Rotate particles slowly
    if (particles) {
        particles.rotation.y += 0.0005;
        particles.rotation.x += 0.0002;
    }

    // Update active user boxes
    if (dataManager) {
        dataManager.activeUsers.forEach(user => {
            if (user.box) {
                user.box.update(time);
            }
        });

        // Periodic cleanup (every ~1s is enough, but per frame is fine for < 50 items)
        if (Math.floor(time) % 2 === 0) { // Every second roughly
             dataManager.cleanupCounts();
        }
    }

    composer.render();
}

// Start
// moved to end

// --- YOUTUBE API CLIENT ---
class YouTubeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    async fetchLiveChatId(videoId) {
        const url = `${this.baseUrl}/videos?part=liveStreamingDetails&id=${videoId}&key=${this.apiKey}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const details = data.items[0].liveStreamingDetails;
                if (details && details.activeLiveChatId) {
                    return details.activeLiveChatId;
                } else {
                    throw new Error("No active live chat found. Is the video live?");
                }
            } else {
                throw new Error("Video not found.");
            }
        } catch (error) {
            console.error("Error fetching Live Chat ID:", error);
            throw error;
        }
    }

    async fetchMessages(liveChatId, pageToken = '') {
        let url = `${this.baseUrl}/liveChatMessages?part=snippet,authorDetails&liveChatId=${liveChatId}&key=${this.apiKey}`;
        if (pageToken) {
            url += `&pageToken=${pageToken}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            return {
                messages: data.items || [],
                nextPageToken: data.nextPageToken,
                pollingIntervalMillis: data.pollingIntervalMillis || 5000
            };
        } catch (error) {
            console.error("Error fetching messages:", error);
            throw error;
        }
    }
}

// --- FAKE DATA GENERATOR ---
class FakeDataGenerator {
    constructor() {
        this.interval = null;
        this.usernames = ["Neo", "Trinity", "Morpheus", "Switch", "Apoc", "Cypher", "Tank", "Dozer", "Mouse", "Oracle", "Smith", "Merovingian", "Persephone", "Keymaker", "Architect", "Niobe", "Ghost", "Seraph", "Sati", "Bane"];
        this.comments = ["Wake up...", "Follow the white rabbit.", "The Matrix has you.", "Knock, knock.", "I know kung fu.", "Free your mind.", "There is no spoon.", "Welcome to the real world.", "Ignorance is bliss.", "Not like this...", "Whoa.", "Dodge this.", "Mr. Anderson...", "System Failure", "Glitch in the matrix", "Uploading...", "Connection established", "Signal lost", "Rebooting...", "Access denied"];
    }

    start(callback) {
        this.stop();
        const loop = () => {
            const delay = Math.random() * 2000 + 500; // 0.5s to 2.5s
            this.interval = setTimeout(() => {
                const msg = this.generateMessage();
                callback([msg]); // Return array to match API format
                loop();
            }, delay);
        };
        loop();
    }

    stop() {
        if (this.interval) clearTimeout(this.interval);
    }

    generateMessage() {
        const username = this.usernames[Math.floor(Math.random() * this.usernames.length)];
        // Create a persistent user ID based on username for consistent tracking in demo
        const userId = 'user_' + username.toLowerCase();
        const comment = this.comments[Math.floor(Math.random() * this.comments.length)];

        return {
            snippet: {
                publishedAt: new Date().toISOString(),
                displayMessage: comment
            },
            authorDetails: {
                channelId: userId,
                displayName: username,
                profileImageUrl: 'https://robohash.org/' + userId + '?set=set2&size=64x64', // Generative avatar
                isChatOwner: Math.random() > 0.9,
                isChatModerator: Math.random() > 0.95
            }
        };
    }
}

// --- DATA MANAGER ---
class DataManager {
    constructor() {
        this.activeUsers = new Map(); // userId -> { userId, username, avatar, timestamps: [], box: null, insertedAt: number }
        this.userOrder = []; // List of userIds in order of insertion (FIFO)
        this.maxUsers = 50;
        this.windowSeconds = 60;
    }

    processMessages(messages) {
        const now = Date.now();

        messages.forEach(msg => {
            const userId = msg.authorDetails.channelId;
            const username = msg.authorDetails.displayName;
            const avatar = msg.authorDetails.profileImageUrl;
            const publishedAt = new Date(msg.snippet.publishedAt).getTime(); // Use API time or Date.now() if simulating

            if (this.activeUsers.has(userId)) {
                // Existing user
                const user = this.activeUsers.get(userId);
                user.timestamps.push(now); // Add current time for the count window
                user.username = username; // Update just in case
                user.avatar = avatar;

                // Visual update triggers
                this.updateUserVisuals(user);

                // Audio
                if (window.audioManager) window.audioManager.playPing();
            } else {
                // New user
                if (this.userOrder.length >= this.maxUsers) {
                    this.removeOldestUser();
                }

                const newUser = {
                    userId,
                    username,
                    avatar,
                    timestamps: [now],
                    box: null, // Will be created
                    insertedAt: now
                };

                this.activeUsers.set(userId, newUser);
                this.userOrder.push(userId);

                // Create visual
                this.createUserVisuals(newUser);

                // Audio
                if (window.audioManager) window.audioManager.playGlitch();
            }
        });
    }

    cleanupCounts() {
        const now = Date.now();
        const cutoff = now - (this.windowSeconds * 1000);

        this.activeUsers.forEach(user => {
            const originalCount = user.timestamps.length;
            user.timestamps = user.timestamps.filter(t => t > cutoff);

            if (user.timestamps.length !== originalCount) {
                this.updateUserVisuals(user); // Update count display if changed
            }
        });
    }

    removeOldestUser() {
        const oldestUserId = this.userOrder.shift(); // Remove first
        if (oldestUserId) {
            const user = this.activeUsers.get(oldestUserId);
            if (user) {
                this.removeUserVisuals(user);
                this.activeUsers.delete(oldestUserId);
            }
        }
    }

    // Visual Management
    createUserVisuals(user) {
        if (scene) {
            user.box = new UserBox(user, scene);
        }
    }

    updateUserVisuals(user) {
        if (user.box) {
            user.box.updateTexture();
            // Optional: Add a pulse effect or highlight
        }
    }

    removeUserVisuals(user) {
        if (user.box) {
            user.box.dispose();
            user.box = null;
        }
    }
}

const dataManager = new DataManager();

// --- USER BOX VISUALIZATION ---
class UserBox {
    constructor(user, scene) {
        this.user = user;
        this.scene = scene;
        this.group = new THREE.Group();

        // Dimensions
        this.width = 7;
        this.height = 2.4;
        this.depth = 0.2;

        // 1. Main Panel Mesh
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 175; // Aspect ratio matches box
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

        // 2. Glowing Border
        const edges = new THREE.EdgesGeometry(geometry);
        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        this.border = new THREE.LineSegments(edges, borderMaterial);
        this.group.add(this.border);

        // 3. Initial Position (Random)
        this.group.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );

        // 4. Movement State
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        this.movementType = Math.floor(Math.random() * 3); // 0: Wander, 1: Orbit, 2: Sine
        this.timeOffset = Math.random() * 100;
        this.orbitRadius = 15 + Math.random() * 15;
        this.orbitSpeed = (Math.random() - 0.5) * 0.02;

        // 5. Add to Scene
        scene.add(this.group);

        // 6. Render Initial Texture
        this.updateTexture();

        // 7. Trail System
        this.trailPoints = [];
        this.lastTrailTime = 0;
    }

    updateTexture() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
        ctx.fillRect(0, 0, w, h);

        // Border Glow Effect (Inner)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, w, h);

        // Text - Username
        ctx.font = 'bold 40px Orbitron, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.user.username.substring(0, 15), 110, h / 2);

        // Text - Count (Big & Neon)
        ctx.font = 'bold 80px Orbitron, sans-serif';
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'right';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20;
        ctx.fillText(this.user.timestamps.length, w - 30, h / 2 + 10);
        ctx.shadowBlur = 0;

        // Avatar Placeholder (Circle)
        ctx.beginPath();
        ctx.arc(60, h / 2, 40, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Load Avatar Image (Async)
        if (this.user.avatar && !this.avatarLoaded) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = this.user.avatar;
            img.onload = () => {
                this.avatarImg = img;
                this.avatarLoaded = true;
                this.updateTexture(); // Redraw with image
            };
        }

        if (this.avatarLoaded && this.avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(60, h / 2, 40, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.avatarImg, 20, h / 2 - 40, 80, 80);
            ctx.restore();
        }

        this.texture.needsUpdate = true;
    }

    update(time) {
        const t = time + this.timeOffset;

        if (this.movementType === 0) { // Wander / Bounce
            this.group.position.add(this.velocity);

            // Bounce
            if (this.group.position.x > 35 || this.group.position.x < -35) this.velocity.x *= -1;
            if (this.group.position.y > 20 || this.group.position.y < -20) this.velocity.y *= -1;
            if (this.group.position.z > 10 || this.group.position.z < -20) this.velocity.z *= -1; // Adjusted Z back limit

        } else if (this.movementType === 1) { // Orbit
            this.group.position.x = Math.cos(t * this.orbitSpeed) * this.orbitRadius;
            this.group.position.z = Math.sin(t * this.orbitSpeed) * this.orbitRadius - 20;
            this.group.position.y += Math.sin(t * 0.5) * 0.05; // Bobbing

        } else if (this.movementType === 2) { // Sine / Snake
            this.group.position.x += this.velocity.x;
            if (this.group.position.x > 40) this.group.position.x = -40;
            if (this.group.position.x < -40) this.group.position.x = 40;

            this.group.position.y = Math.sin(this.group.position.x * 0.2 + t) * 10;
        }

        // Randomly switch patterns occasionally
        if (Math.random() < 0.001) {
             this.movementType = (this.movementType + 1) % 3;
        }

        // Face camera
        this.group.lookAt(camera.position);

        // Spawn Trail Particle
        if (time - this.lastTrailTime > 0.1) {
             this.spawnTrailParticle();
             this.lastTrailTime = time;
        }
    }

    spawnTrailParticle() {
        // Simple particle that fades
        const geo = new THREE.PlaneGeometry(0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({
            color: this.border.material.color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(this.group.position);
        mesh.lookAt(camera.position);
        scene.add(mesh);

        // Animate fading
        const fade = () => {
            mat.opacity -= 0.02;
            mesh.scale.multiplyScalar(0.95);
            if (mat.opacity <= 0) {
                scene.remove(mesh);
                geo.dispose();
                mat.dispose();
            } else {
                requestAnimationFrame(fade);
            }
        };
        fade();
    }

    dispose() {
        this.scene.remove(this.group);
        this.texture.dispose();
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.border.geometry.dispose();
        this.border.material.dispose();
    }
}
init();

// --- UI LOGIC ---
let pollingInterval = null;

function setupUI() {
    const btnConnect = document.getElementById('btn-connect');
    const btnFake = document.getElementById('btn-fake');
    const inputVideoId = document.getElementById('video-id');
    const inputApiKey = document.getElementById('api-key');
    const statusDiv = document.getElementById('status');
    const panel = document.querySelector('.panel');

    // Load saved API Key
    const savedKey = localStorage.getItem('yt_api_key');
    if (savedKey) inputApiKey.value = savedKey;

    btnFake.addEventListener('click', () => {
        statusDiv.textContent = "MODE: DEMO (FAKE DATA)";
        statusDiv.style.color = "#bc13fe";
        panel.classList.add('hidden');

        // Stop any existing polling
        if (pollingInterval) clearTimeout(pollingInterval);

        const generator = new FakeDataGenerator();
        generator.start((messages) => {
            dataManager.processMessages(messages);
        });
    });

    btnConnect.addEventListener('click', async () => {
        const videoId = inputVideoId.value.trim();
        const apiKey = inputApiKey.value.trim();

        if (!videoId || !apiKey) {
            statusDiv.textContent = "ERROR: Missing ID or Key";
            statusDiv.style.color = "red";
            return;
        }

        // Save API Key
        localStorage.setItem('yt_api_key', apiKey);

        statusDiv.textContent = "CONNECTING...";
        statusDiv.style.color = "#0ff";

        // Stop any existing polling
        if (pollingInterval) clearTimeout(pollingInterval);

        const client = new YouTubeClient(apiKey);

        try {
            const liveChatId = await client.fetchLiveChatId(videoId);
            statusDiv.textContent = "CONNECTED! Fetching...";
            panel.classList.add('hidden');

            let pageToken = '';

            const poll = async () => {
                try {
                    const result = await client.fetchMessages(liveChatId, pageToken);

                    dataManager.processMessages(result.messages);

                    pageToken = result.nextPageToken;
                    const delay = result.pollingIntervalMillis || 5000;

                    statusDiv.textContent = `LIVE: ${result.messages.length} msgs. Next: ${delay/1000}s`;

                    pollingInterval = setTimeout(poll, delay);
                } catch (err) {
                    console.error(err);
                    statusDiv.textContent = "ERROR: " + err.message;
                    statusDiv.style.color = "red";
                    // Retry after delay
                    pollingInterval = setTimeout(poll, 10000);
                }
            };

            poll();

        } catch (error) {
            statusDiv.textContent = "ERROR: " + error.message;
            statusDiv.style.color = "red";
        }
    });
}

// --- AUDIO MANAGER ---
class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.1; // Low volume
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playPing() {
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playGlitch() {
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100 + Math.random() * 200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
