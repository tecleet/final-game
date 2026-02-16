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

    // Liquid/Flow Background
    if (particles) {
        // More organic wave movement instead of simple rotation
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            // Original positions are not stored, so we drift them
            // Or better, use sine waves on Y based on X and Z
            // Simple flow:
            positions[i3 + 1] += Math.sin(time * 0.5 + positions[i3] * 0.05) * 0.1;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Slow rotation
        particles.rotation.z = Math.sin(time * 0.1) * 0.1;
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

    if (window.commentLog) {
        window.commentLog.update(time);
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
                const domain = window.location.hostname;
                throw new Error(`Network/CORS Error: Check API Key restrictions. Ensure '${domain}' is added to "Website Restrictions" in Google Cloud Console.`);
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
                 const domain = window.location.hostname;
                 throw new Error(`Network/CORS Error: Stream offline OR API Key restricts '${domain}'. Check Google Cloud Console.`);
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
            // Flood Simulation: Faster comments (100ms - 800ms)
            const delay = Math.random() * 700 + 100;
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

            // Add to Ladder Log (for both new and existing users if they comment)
            if (this.activeUsers.has(userId)) {
                 const u = this.activeUsers.get(userId);
                 // We don't have msg.snippet.displayMessage here directly in the loop above?
                 // Wait, 'msg' is in scope.
                 this.addCommentToLadder(msg.snippet.displayMessage, u.box ? u.box.userColor : '#ffffff');
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

    // Helper to add latest message to ladder
    addCommentToLadder(text, color) {
        if (window.commentLog) {
            window.commentLog.add(text, color);
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

        // Pick random neon color
        const colors = ['#00ffff', '#ff00ff', '#bc13fe', '#00ffaa', '#ffaa00', '#ff3333'];
        this.userColor = colors[Math.floor(Math.random() * colors.length)];
        this.borderColor = new THREE.Color(this.userColor); // For trails

        // Use MeshBasicMaterial with Emissive map if possible, but texture map is emissive enough
        // Using BasicMaterial ensures it ignores lighting and glows with bloom
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 1.0, // Ensure full opacity
            side: THREE.DoubleSide // Plane needs double side to be seen if rotation flips
        });

        // Use PlaneGeometry instead of Box to eliminate "rectangle border" artifacts from depth
        const geometry = new THREE.PlaneGeometry(this.width, this.height);
        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

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
        // Must be rounded to match geometry
        ctx.fillStyle = '#000000';

        // Define rounded path
        const r = h / 2; // Full rounded pill shape
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();

        ctx.fill(); // Fill rounded background

        // Save this path for clipping later if needed, or just use it
        ctx.save();
        ctx.clip(); // Clip everything to this rounded shape

        // Border - Thin Connected Round Border
        ctx.strokeStyle = this.userColor;
        ctx.lineWidth = 6;

        const rBorder = h / 2 - 5; // Almost full height radius
        ctx.beginPath();
        ctx.moveTo(rBorder, 5);
        ctx.lineTo(w - rBorder, 5);
        ctx.quadraticCurveTo(w - 5, 5, w - 5, rBorder + 5);
        ctx.lineTo(w - 5, h - rBorder - 5);
        ctx.quadraticCurveTo(w - 5, h - 5, w - rBorder, h - 5);
        ctx.lineTo(rBorder, h - 5);
        ctx.quadraticCurveTo(5, h - 5, 5, h - rBorder - 5);
        ctx.lineTo(5, rBorder + 5);
        ctx.quadraticCurveTo(5, 5, rBorder, 5);
        ctx.closePath();
        ctx.stroke();

        // Text - Count (Right Aligned - Measure first to reserve space)
        ctx.font = 'bold 160px Orbitron, sans-serif';
        const countStr = this.user.timestamps.length.toString();
        const countWidth = ctx.measureText(countStr).width;
        const countX = w - 60; // Right padding

        // Text - Username (Center Left - Dynamic Fit)
        // Strict Zone Calculation
        const avatarEnd = 120 + 80 + 20; // AvatarX + Radius + Padding
        const countStart = countX - countWidth - 40; // CountX - Width - Padding
        const maxTextWidth = countStart - avatarEnd;

        let fontSize = 100;
        ctx.font = `${fontSize}px Orbitron, sans-serif`;

        // Truncate logic (10 chars max)
        const truncatedName = this.user.username.length > 10
            ? this.user.username.substring(0, 10)
            : this.user.username;
        const finalName = truncatedName.toUpperCase();

        let textWidth = ctx.measureText(finalName).width;
        while (textWidth > maxTextWidth && fontSize > 40) {
            fontSize -= 5;
            ctx.font = `${fontSize}px Orbitron, sans-serif`;
            textWidth = ctx.measureText(finalName).width;
        }

        ctx.fillStyle = this.userColor || '#ffffff'; // Sync with user color
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;

        // Draw Name
        ctx.fillText(finalName, avatarEnd, h / 2);

        // Draw Count
        ctx.font = 'bold 160px Orbitron, sans-serif';
        ctx.fillStyle = this.userColor;
        ctx.textAlign = 'right';
        ctx.fillText(countStr, countX, h / 2 + 20);

        // Avatar Placeholder (Circle) - LEFT
        const avatarX = 120;
        const avatarY = h / 2;
        const avatarR = 80;

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = this.userColor; // Sync circle
        ctx.lineWidth = 4;
        ctx.stroke();

        // ANIMAL ICON LOGIC (REALISTIC IMAGES)
        // "Number one claims lion icon"
        let maxCount = 0;
        dataManager.activeUsers.forEach(u => {
            if (u.timestamps.length > maxCount) maxCount = u.timestamps.length;
        });

        const isLeader = (this.user.timestamps.length === maxCount && maxCount > 0);

        // Define realistic image URLs (Curated Close-Up Animal Faces)
        // Using explicit crop parameters to zoom into faces
        const lionUrl = 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80&crop=faces';
        const otherAnimals = [
            'https://images.unsplash.com/photo-1505672984959-1c07309e4694?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Wolf Face
            'https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Tiger Face
            'https://images.unsplash.com/photo-1578165272330-802e3a0937a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Fox Face
            'https://images.unsplash.com/photo-1615963244664-5b845b2025ee?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Owl Face
            'https://images.unsplash.com/photo-1522502693259-26ddcfc24e64?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Dog Face
            'https://images.unsplash.com/photo-1574158622682-e40e69881006?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Cat Eyes
            'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80', // Panda Face
            'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80'  // Bear Face
        ];

        let targetUrl = '';
        if (isLeader) {
            targetUrl = lionUrl;
        } else {
            let hash = 0;
            for (let i = 0; i < this.user.username.length; i++) {
                hash = this.user.username.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % otherAnimals.length;
            targetUrl = otherAnimals[index];
        }

        // Load & Draw Image
        if (!this.animalImg || this.animalImgSrc !== targetUrl) {
            // Need to load new image
            if (!this.loadingAnimal) {
                this.loadingAnimal = true;
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = targetUrl;
                img.onload = () => {
                    this.animalImg = img;
                    this.animalImgSrc = targetUrl; // Cache key
                    this.loadingAnimal = false;
                    this.updateTexture(); // Redraw
                };
            }
        }

        if (this.animalImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
            ctx.clip();
            // Draw image covering the circle
            ctx.drawImage(this.animalImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
        } else {
            // Fallback while loading
            ctx.font = '60px Orbitron';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('...', avatarX, avatarY);
        }

        this.texture.needsUpdate = true;

        // Restore context clip from background
        ctx.restore();
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
        // Rounded Trail: Match the box geometry roughly with a Circle or Rounded Plane
        // Since RoundedPlane isn't a standard primitive easily, we use a Circle scaled
        // to approximate the pill shape, or just a lower opacity version of the RoundedBox texture?
        // Let's use CircleGeometry for "bubbles" trail or Plane with Rounded Texture
        // Simpler: Use a Plane but apply a circular soft gradient map?
        // User asked for "trail animation of the moving boxex".
        // Let's stick to the Ghost Effect (Plane) but make it rounder by using a texture or just Circle

        const scale = this.currentScale;
        // Use a simple Plane but maybe with a rounded texture if we had one.
        // For performance, let's use a Circle scaled to be an ellipse matching the box aspect ratio
        // Box is 7 x 2.4. Aspect ~2.9

        const geo = new THREE.CircleGeometry(1, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: this.borderColor,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.scale.set((this.width * scale) / 2, (this.height * scale) / 2, 1);

        mesh.position.copy(this.group.position);
        mesh.rotation.copy(this.group.rotation);
        mesh.position.z -= 0.5; // Behind

        scene.add(mesh);

        const fade = () => {
            mat.opacity -= 0.015; // Slower fade for longer trail
            mesh.scale.multiplyScalar(0.96);
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

// --- COMMENT LOG LADDER ---
class CommentLog {
    constructor(scene) {
        this.scene = scene;
        this.messages = []; // { mesh, startTime, text }
    }

    add(text, color) {
        // Create canvas texture for text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 128;

        ctx.clearRect(0,0, 1024, 128);

        // Dark Background Plate for Readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        // Rounded rect centered
        const plateW = 900;
        const plateH = 100;
        const radius = 40;
        const x = (1024 - plateW) / 2;
        const y = (128 - plateH) / 2;

        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + plateW - radius, y);
        ctx.quadraticCurveTo(x + plateW, y, x + plateW, y + radius);
        ctx.lineTo(x + plateW, y + plateH - radius);
        ctx.quadraticCurveTo(x + plateW, y + plateH, x + plateW - radius, y + plateH);
        ctx.lineTo(x + radius, y + plateH);
        ctx.quadraticCurveTo(x, y + plateH, x, y + plateH - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        // Text Settings
        ctx.font = 'bold 50px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Stroke for contrast
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(text.substring(0, 50), 512, 64);

        // Main Text (No Shadow/Bloom on texture to avoid "too much light")
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.fillText(text.substring(0, 50), 512, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 }); // Start invisible, fade in
        const sprite = new THREE.Sprite(mat);

        // Initial spawn position (will be overridden by update)
        sprite.position.set(0, -60, -60);

        this.scene.add(sprite);

        // Add to BEGINNING of array (Stack bottom)
        this.messages.unshift({
            mesh: sprite,
            created: clock.getElapsedTime(),
            color: color
        });

        // Limit Stack Size (Increased for flood)
        if (this.messages.length > 100) {
            const removed = this.messages.pop();
            this.disposeMessage(removed);
        }
    }

    update(time) {
        // Stack Logic: Position based on Index
        // Index 0 is newest (Bottom)
        // Index N is oldest (Top/Back)

        const spacingY = 4; // Tighter vertical gap
        const spacingZ = 2; // Tighter depth gap
        const baseY = -45;
        const baseZ = -60;

        this.messages.forEach((m, index) => {
            // Target Positions
            const targetY = baseY + (index * spacingY);
            const targetZ = baseZ - (index * spacingZ);

            // Lerp Position
            m.mesh.position.y += (targetY - m.mesh.position.y) * 0.1;
            m.mesh.position.z += (targetZ - m.mesh.position.z) * 0.1;

            // Scale Calculation
            // Shrink as index increases (further back)
            // Base scale 2.5x (from previous tweak)
            const baseScale = 2.5;
            const scaleDecay = 0.01; // Slower shrink (1% per step)
            const s = Math.max(0.1, 1.0 - (index * scaleDecay));

            m.mesh.scale.set(40 * baseScale * s, 5 * baseScale * s, 1);

            // Fade In/Out
            // Fade in if new (opacity < 1)
            // Fade out if near limit (start fading at 80)
            let targetOpacity = 1.0;
            if (index > 80) targetOpacity = 0;

            m.mesh.material.opacity += (targetOpacity - m.mesh.material.opacity) * 0.1;
        });
    }

    disposeMessage(m) {
        if (m && m.mesh) {
            this.scene.remove(m.mesh);
            if (m.mesh.material.map) m.mesh.material.map.dispose();
            if (m.mesh.material) m.mesh.material.dispose();
        }
    }

    removeMessage(index) {
        const m = this.messages[index];
        if (m && m.mesh) {
            this.scene.remove(m.mesh);
            if (m.mesh.material.map) m.mesh.material.map.dispose();
            if (m.mesh.material) m.mesh.material.dispose();
        }
        this.messages.splice(index, 1);
    }
}

// Init logic wrapper
function initApp() {
    init();
    window.commentLog = new CommentLog(scene);
}

initApp();

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
    const helpBtn = document.getElementById('help-btn');

    const savedKey = localStorage.getItem('yt_api_key');
    if (savedKey) inputApiKey.value = savedKey;

    // Help Button Logic
    helpBtn.addEventListener('click', () => {
        const domain = window.location.hostname || 'localhost';
        alert(
            `CORS CONFIGURATION HELP:\n\n` +
            `If you see "Network/CORS Error", you must update your API Key settings.\n\n` +
            `1. Go to Google Cloud Console > Credentials.\n` +
            `2. Edit your API Key.\n` +
            `3. Under "Website Restrictions", ADD this domain:\n` +
            `   ${window.location.protocol}//${domain}/*\n\n` +
            `Note: "GitHub Secrets" cannot be used for client-side apps like this. You must rely on domain restrictions.`
        );
    });

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
