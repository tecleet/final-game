import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// --- CONFIGURATION ---
const CONFIG = {
    PARTICLE_COUNT: 1000,
    BLOOM_STRENGTH: 0.6, // Reduced further for clearer text
    BLOOM_RADIUS: 0.4,
    BLOOM_THRESHOLD: 0.1, // Only bloom bright parts
    FOV: 60,
    CAMERA_Z: 60, // Pulled back slightly for more view
    COLORS: [0x00ffff, 0xff00ff, 0xbc13fe, 0x00ffaa] // Added Neon Green
};

// --- GLOBALS ---
let scene, camera, renderer, composer;
let particles;
const clock = new THREE.Clock();

// --- INITIALIZATION ---
function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.0015); // Cyberpunk fog

    // 2. Camera
    camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = CONFIG.CAMERA_Z;

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
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

    // 6. Lights
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
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 100 - 50;
        positions.push(x, y, z);

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

    if (particles) {
        particles.rotation.y += 0.0005;
        particles.rotation.x += 0.0002;
    }

    if (dataManager) {
        dataManager.activeUsers.forEach(user => {
            if (user.box) {
                user.box.update(time);
            }
        });

        if (Math.floor(time) % 2 === 0) {
             dataManager.cleanupCounts();
        }
    }

    composer.render();
}

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

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `API Error: ${response.status} ${response.statusText}`);
            }

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
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error("Network/CORS Error: Check API Key restrictions (allow localhost) or internet connection.");
            }
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

            if (!response.ok) {
                if (response.status === 404) {
                     throw new Error("Live Stream Ended or Invalid Chat ID.");
                }
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `API Error: ${response.status} ${response.statusText}`);
            }

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
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                 throw new Error("Network/CORS Error: Stream might be offline or API Key restrictions block localhost.");
            }
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
            const delay = Math.random() * 2000 + 500;
            this.interval = setTimeout(() => {
                const msg = this.generateMessage();
                callback([msg]);
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
                profileImageUrl: 'https://robohash.org/' + userId + '?set=set2&size=64x64',
                isChatOwner: Math.random() > 0.9,
                isChatModerator: Math.random() > 0.95
            }
        };
    }
}

// --- DATA MANAGER ---
class DataManager {
    constructor() {
        this.activeUsers = new Map();
        this.userOrder = [];
        this.maxUsers = 50;
        this.windowSeconds = 60;
    }

    processMessages(messages) {
        const now = Date.now();

        messages.forEach(msg => {
            const userId = msg.authorDetails.channelId;
            const username = msg.authorDetails.displayName;
            const avatar = msg.authorDetails.profileImageUrl;

            if (this.activeUsers.has(userId)) {
                const user = this.activeUsers.get(userId);
                user.timestamps.push(now);
                user.username = username;
                user.avatar = avatar;
                this.updateUserVisuals(user);
                if (window.audioManager) window.audioManager.playPing();
            } else {
                if (this.userOrder.length >= this.maxUsers) {
                    this.removeOldestUser();
                }

                const newUser = {
                    userId,
                    username,
                    avatar,
                    timestamps: [now],
                    box: null,
                    insertedAt: now
                };

                this.activeUsers.set(userId, newUser);
                this.userOrder.push(userId);
                this.createUserVisuals(newUser);
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
                this.updateUserVisuals(user);
            }
        });
    }

    removeOldestUser() {
        const oldestUserId = this.userOrder.shift();
        if (oldestUserId) {
            const user = this.activeUsers.get(oldestUserId);
            if (user) {
                this.removeUserVisuals(user);
                this.activeUsers.delete(oldestUserId);
            }
        }
    }

    createUserVisuals(user) {
        if (scene) {
            user.box = new UserBox(user, scene);
        }
    }

    updateUserVisuals(user) {
        if (user.box) {
            user.box.updateTexture();
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

// --- USER BOX VISUALIZATION (IMPROVED) ---
class UserBox {
    constructor(user, scene) {
        this.user = user;
        this.scene = scene;
        this.group = new THREE.Group();

        // Dimensions
        this.width = 7;
        this.height = 2.4;
        this.depth = 0.2;

        // 1. High-Res Canvas for Crisp Text
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024; // 2x resolution
        this.canvas.height = 350;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter; // Smooth scaling

        // Use MeshBasicMaterial with Emissive map if possible, but texture map is emissive enough
        // Using BasicMaterial ensures it ignores lighting and glows with bloom
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 1.0, // Ensure full opacity
            side: THREE.FrontSide // Ensure text reads correctly
        });

        // Use RoundedBoxGeometry instead of BoxGeometry
        const geometry = new RoundedBoxGeometry(this.width, this.height, this.depth, 4, 0.5); // segments, radius
        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

        // 2. Glowing Border (Simplified for Rounded Box)
        // EdgesGeometry doesn't work well with rounded box, so we use a secondary wireframe or just rely on texture border
        // Let's remove the line segments for rounded box as it looks messy.
        // Instead, we can add a glow mesh slightly larger
        /*
        const glowGeo = new RoundedBoxGeometry(this.width + 0.1, this.height + 0.1, this.depth + 0.1, 4, 0.5);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
        this.border = new THREE.Mesh(glowGeo, glowMat);
        this.group.add(this.border);
        */
       // Actually, just the texture border is cleaner for "STRAIDT TEXT". We can skip the wireframe cage.
       // Or keep a subtle wireframe if needed. Let's skip to keep it clean.

       this.borderColor = 0x00ffff; // Store for trails

        // 3. Initial Position & Movement Setup (Improved)
        // Spread across wider area
        this.group.position.set(
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 30
        );

        // Physics-based Movement (Wall Bounce)
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1, // Reduced initial speed
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.05
        );
        this.speed = 1.0;

        // Target Scale
        this.targetScale = 1.0;
        this.currentScale = 1.0;

        // 5. Add to Scene
        scene.add(this.group);

        // 6. Render Initial Texture
        this.updateTexture();

        // 7. Trail System
        this.trailPoints = [];
        this.lastTrailTime = 0;
    }

    updateTexture() {
        const count = this.user.timestamps.length;
        // More aggressive scaling for higher counts
        // Starts at 1.0, adds 0.2 per count, max 3x size
        this.targetScale = 1.0 + Math.min((count - 1) * 0.2, 2.0);

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background - SOLID OPAQUE BLACK for max contrast
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        // Border - Thinner, cleaner
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 15;

        // Draw rounded rectangle on canvas to match 3D geometry
        // Use path for rounded rect
        const r = 40; // Corner radius for texture
        ctx.beginPath();
        ctx.moveTo(10 + r, 10);
        ctx.lineTo(w - 10 - r, 10);
        ctx.quadraticCurveTo(w - 10, 10, w - 10, 10 + r);
        ctx.lineTo(w - 10, h - 10 - r);
        ctx.quadraticCurveTo(w - 10, h - 10, w - 10 - r, h - 10);
        ctx.lineTo(10 + r, h - 10);
        ctx.quadraticCurveTo(10, h - 10, 10, h - 10 - r);
        ctx.lineTo(10, 10 + r);
        ctx.quadraticCurveTo(10, 10, 10 + r, 10);
        ctx.closePath();
        ctx.stroke();

        // Text - Username
        // "STRAIDT TEXT" - Standard weight, high contrast
        ctx.font = '80px Orbitron, sans-serif'; // Removed 'bold' to be cleaner/straighter
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // No shadow/glow at all for text
        ctx.shadowBlur = 0;

        // Truncate to 7 chars max
        const truncatedName = this.user.username.length > 7
            ? this.user.username.substring(0, 7)
            : this.user.username;

        ctx.fillText(truncatedName.toUpperCase(), 250, h / 2);

        // Text - Count
        ctx.font = 'bold 160px Orbitron, sans-serif';
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'right';
        // Reduced glow for count too
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 0;
        ctx.fillText(this.user.timestamps.length, w - 60, h / 2 + 20);

        // Avatar Placeholder (Circle) - LEFT
        const avatarX = 120;
        const avatarY = h / 2;
        const avatarR = 80;

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Load Avatar Image (Async)
        if (this.user.avatar && !this.avatarLoaded) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = this.user.avatar;
            img.onload = () => {
                this.avatarImg = img;
                this.avatarLoaded = true;
                this.updateTexture();
            };
        }

        if (this.avatarLoaded && this.avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
        }

        this.texture.needsUpdate = true;
    }

    update(time) {
        // Smooth Scale Transition
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;
        this.group.scale.set(this.currentScale, this.currentScale, this.currentScale);

        // --- WALL BOUNCE PHYSICS ---

        // 1. Calculate Frustum Size at Box's Depth
        // Distance from camera to box plane (approx)
        const dist = camera.position.z - this.group.position.z;
        const vFOV = THREE.MathUtils.degToRad(camera.fov); // vertical field of view

        // Visible height at this distance
        const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
        // Visible width
        const visibleWidth = visibleHeight * camera.aspect;

        // Half dimensions for bounds
        const xBound = visibleWidth / 2 - (this.width * this.currentScale) / 2;
        const yBound = visibleHeight / 2 - (this.height * this.currentScale) / 2;
        // Z bounds (arbitrary depth volume)
        const zFront = 20;
        const zBack = -40;

        // 2. Add small random acceleration (Brownian motion)
        this.velocity.x += (Math.random() - 0.5) * 0.002;
        this.velocity.y += (Math.random() - 0.5) * 0.002;
        this.velocity.z += (Math.random() - 0.5) * 0.001;

        // Limit speed
        const maxSpeed = 0.15;
        this.velocity.clampLength(0, maxSpeed);

        // 3. Move
        this.group.position.add(this.velocity);

        // 4. Check Collisions & Bounce
        // X
        if (this.group.position.x > xBound) {
            this.group.position.x = xBound;
            this.velocity.x *= -1;
        } else if (this.group.position.x < -xBound) {
            this.group.position.x = -xBound;
            this.velocity.x *= -1;
        }

        // Y
        if (this.group.position.y > yBound) {
            this.group.position.y = yBound;
            this.velocity.y *= -1;
        } else if (this.group.position.y < -yBound) {
            this.group.position.y = -yBound;
            this.velocity.y *= -1;
        }

        // Z
        if (this.group.position.z > zFront) {
            this.group.position.z = zFront;
            this.velocity.z *= -1;
        } else if (this.group.position.z < zBack) {
            this.group.position.z = zBack;
            this.velocity.z *= -1;
        }

        // Face camera (Optional: might look weird if strictly 2D bounce, but requested 3D box)
        // this.group.lookAt(camera.position); // Actually, keep it flat facing camera usually looks best for text

        // Spawn Trail Particle
        if (time - this.lastTrailTime > 0.08) {
             this.spawnTrailParticle();
             this.lastTrailTime = time;
        }
    }

    spawnTrailParticle() {
        const geo = new THREE.PlaneGeometry(0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({
            color: this.borderColor,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);

        // Spawn slightly behind box
        mesh.position.copy(this.group.position);
        mesh.position.z -= 0.5;

        mesh.lookAt(camera.position);
        scene.add(mesh);

        const fade = () => {
            mat.opacity -= 0.02;
            mesh.scale.multiplyScalar(0.92);
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
    const btnToggle = document.getElementById('btn-toggle-ui');

    const savedKey = localStorage.getItem('yt_api_key');
    if (savedKey) inputApiKey.value = savedKey;

    // Toggle Button Logic
    btnToggle.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });

    btnFake.addEventListener('click', () => {
        statusDiv.textContent = "MODE: DEMO (FAKE DATA)";
        statusDiv.style.color = "#bc13fe";
        panel.classList.add('hidden'); // Auto-hide on start

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

        localStorage.setItem('yt_api_key', apiKey);

        statusDiv.textContent = "CONNECTING...";
        statusDiv.style.color = "#0ff";

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
        this.masterGain.gain.value = 0.1;
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
