import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// --- CONFIGURATION ---
const CONFIG = {
    PARTICLE_COUNT: 1000,
    BLOOM_STRENGTH: 0.6,
    BLOOM_RADIUS: 0.4,
    BLOOM_THRESHOLD: 0.1,
    FOV: 60,
    CAMERA_Z: 60,
    COLORS: [0x00ffff, 0xff00ff, 0xbc13fe, 0x00ffaa]
};

// --- GLOBALS ---
let scene, camera, renderer, composer;
let particles;
const clock = new THREE.Clock();

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.0015);

    camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = CONFIG.CAMERA_Z;

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050505);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = CONFIG.BLOOM_THRESHOLD;
    bloomPass.strength = CONFIG.BLOOM_STRENGTH;
    bloomPass.radius = CONFIG.BLOOM_RADIUS;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    createParticles();

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    window.addEventListener('resize', onWindowResize);
    setupUI();
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
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3 + 1] += Math.sin(time * 0.5 + positions[i3] * 0.05) * 0.1;
        }
        particles.geometry.attributes.position.needsUpdate = true;
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

// --- WEBSOCKET CLIENT ---
class WebSocketClient {
    constructor(url, statusCallback) {
        this.url = url;
        this.ws = null;
        this.statusCallback = statusCallback;
    }

    connect(videoId) {
        if (this.ws) {
            this.ws.close();
        }

        try {
            this.ws = new WebSocket(this.url);
        } catch (e) {
            this.statusCallback("Invalid WebSocket URL", true);
            return;
        }

        this.ws.onopen = () => {
            this.statusCallback("Connected to Backend...", false);
            this.ws.send(JSON.stringify({ type: 'CONNECT', videoId: videoId }));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'chat') {
                    if (data.messages && dataManager) {
                        dataManager.processMessages(data.messages);
                        const count = data.messages.length;
                        this.statusCallback(`LIVE: Received ${count} msgs`, false);
                    }
                } else if (data.type === 'status') {
                    this.statusCallback(data.message, false);
                } else if (data.type === 'error') {
                    this.statusCallback("ERROR: " + data.message, true);
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        this.ws.onerror = (error) => {
            console.error("WS Error", error);
            this.statusCallback("WebSocket Connection Failed. Is the backend running?", true);
        };

        this.ws.onclose = () => {
            this.statusCallback("Disconnected from Backend.", true);
        };
    }

    close() {
        if (this.ws) this.ws.close();
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
                    userId, username, avatar,
                    timestamps: [now],
                    box: null,
                    insertedAt: now
                };
                this.activeUsers.set(userId, newUser);
                this.userOrder.push(userId);
                this.createUserVisuals(newUser);
                if (window.audioManager) window.audioManager.playGlitch();
            }

            if (this.activeUsers.has(userId)) {
                 const u = this.activeUsers.get(userId);
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
        if (scene) user.box = new UserBox(user, scene);
    }

    updateUserVisuals(user) {
        if (user.box) user.box.updateTexture();
    }

    addCommentToLadder(text, color) {
        if (window.commentLog) window.commentLog.add(text, color);
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
        this.width = 7;
        this.height = 2.4;
        this.depth = 0.2;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 350;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        const colors = ['#00ffff', '#ff00ff', '#bc13fe', '#00ffaa', '#ffaa00', '#ff3333'];
        this.userColor = colors[Math.floor(Math.random() * colors.length)];
        this.borderColor = new THREE.Color(this.userColor);

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });

        const geometry = new THREE.PlaneGeometry(this.width, this.height);
        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

        this.group.position.set(
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 30
        );

        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.05
        );
        this.speed = 1.0;
        this.targetScale = 1.0;
        this.currentScale = 1.0;

        scene.add(this.group);
        this.updateTexture();
        this.trailPoints = [];
        this.lastTrailTime = 0;
    }

    updateTexture() {
        const count = this.user.timestamps.length;
        this.targetScale = 1.0 + Math.min((count - 1) * 0.2, 2.0);

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#000000';

        const r = h / 2;
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

        ctx.fill();
        ctx.save();
        ctx.clip();

        ctx.strokeStyle = this.userColor;
        ctx.lineWidth = 6;

        const rBorder = h / 2 - 5;
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

        ctx.font = 'bold 160px Orbitron, sans-serif';
        const countStr = this.user.timestamps.length.toString();
        const countWidth = ctx.measureText(countStr).width;
        const countX = w - 60;

        const avatarEnd = 120 + 80 + 20;
        const countStart = countX - countWidth - 40;
        const maxTextWidth = countStart - avatarEnd;

        let fontSize = 100;
        ctx.font = `${fontSize}px Orbitron, sans-serif`;

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

        ctx.fillStyle = this.userColor || '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;

        ctx.fillText(finalName, avatarEnd, h / 2);

        ctx.font = 'bold 160px Orbitron, sans-serif';
        ctx.fillStyle = this.userColor;
        ctx.textAlign = 'right';
        ctx.fillText(countStr, countX, h / 2 + 20);

        const avatarX = 120;
        const avatarY = h / 2;
        const avatarR = 80;

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = this.userColor;
        ctx.lineWidth = 4;
        ctx.stroke();

        let maxCount = 0;
        dataManager.activeUsers.forEach(u => {
            if (u.timestamps.length > maxCount) maxCount = u.timestamps.length;
        });

        const isLeader = (this.user.timestamps.length === maxCount && maxCount > 0);

        const lionUrl = 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80&crop=faces';
        const otherAnimals = [
            'https://images.unsplash.com/photo-1505672984959-1c07309e4694?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1578165272330-802e3a0937a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1615963244664-5b845b2025ee?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1522502693259-26ddcfc24e64?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1574158622682-e40e69881006?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80',
            'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&h=256&q=80'
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

        if (!this.animalImg || this.animalImgSrc !== targetUrl) {
            if (!this.loadingAnimal) {
                this.loadingAnimal = true;
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = targetUrl;
                img.onload = () => {
                    this.animalImg = img;
                    this.animalImgSrc = targetUrl;
                    this.loadingAnimal = false;
                    this.updateTexture();
                };
            }
        }

        if (this.animalImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.animalImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
        } else {
            ctx.font = '60px Orbitron';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('...', avatarX, avatarY);
        }

        this.texture.needsUpdate = true;
        ctx.restore();
    }

    update(time) {
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;
        this.group.scale.set(this.currentScale, this.currentScale, this.currentScale);

        const dist = camera.position.z - this.group.position.z;
        const vFOV = THREE.MathUtils.degToRad(camera.fov);
        const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
        const visibleWidth = visibleHeight * camera.aspect;

        const xBound = visibleWidth / 2 - (this.width * this.currentScale) / 2;
        const yBound = visibleHeight / 2 - (this.height * this.currentScale) / 2;
        const zFront = 20;
        const zBack = -40;

        this.velocity.x += (Math.random() - 0.5) * 0.002;
        this.velocity.y += (Math.random() - 0.5) * 0.002;
        this.velocity.z += (Math.random() - 0.5) * 0.001;

        const maxSpeed = 0.15;
        this.velocity.clampLength(0, maxSpeed);

        this.group.position.add(this.velocity);

        if (this.group.position.x > xBound) {
            this.group.position.x = xBound;
            this.velocity.x *= -1;
        } else if (this.group.position.x < -xBound) {
            this.group.position.x = -xBound;
            this.velocity.x *= -1;
        }

        if (this.group.position.y > yBound) {
            this.group.position.y = yBound;
            this.velocity.y *= -1;
        } else if (this.group.position.y < -yBound) {
            this.group.position.y = -yBound;
            this.velocity.y *= -1;
        }

        if (this.group.position.z > zFront) {
            this.group.position.z = zFront;
            this.velocity.z *= -1;
        } else if (this.group.position.z < zBack) {
            this.group.position.z = zBack;
            this.velocity.z *= -1;
        }

        if (time - this.lastTrailTime > 0.08) {
             this.spawnTrailParticle();
             this.lastTrailTime = time;
        }
    }

    spawnTrailParticle() {
        const scale = this.currentScale;
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
        mesh.position.z -= 0.5;

        scene.add(mesh);

        const fade = () => {
            mat.opacity -= 0.015;
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
        this.messages = [];
    }

    add(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 128;

        ctx.clearRect(0,0, 1024, 128);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
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

        ctx.font = 'bold 50px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(text.substring(0, 50), 512, 64);

        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.fillText(text.substring(0, 50), 512, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(0, -60, -60);

        this.scene.add(sprite);

        this.messages.unshift({
            mesh: sprite,
            created: clock.getElapsedTime(),
            color: color
        });

        if (this.messages.length > 100) {
            const removed = this.messages.pop();
            this.disposeMessage(removed);
        }
    }

    update(time) {
        const spacingY = 4;
        const spacingZ = 2;
        const baseY = -45;
        const baseZ = -60;

        this.messages.forEach((m, index) => {
            const targetY = baseY + (index * spacingY);
            const targetZ = baseZ - (index * spacingZ);

            m.mesh.position.y += (targetY - m.mesh.position.y) * 0.1;
            m.mesh.position.z += (targetZ - m.mesh.position.z) * 0.1;

            const baseScale = 2.5;
            const scaleDecay = 0.01;
            const s = Math.max(0.1, 1.0 - (index * scaleDecay));

            m.mesh.scale.set(40 * baseScale * s, 5 * baseScale * s, 1);

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
}

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
    const inputBackend = document.getElementById('backend-url');
    const statusDiv = document.getElementById('status');
    const panel = document.querySelector('.panel');
    const btnToggle = document.getElementById('btn-toggle-ui');

    const savedUrl = localStorage.getItem('backend_url');
    if (savedUrl && inputBackend) inputBackend.value = savedUrl;

    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            panel.classList.toggle('hidden');
        });
    }

    btnFake.addEventListener('click', () => {
        statusDiv.textContent = "MODE: DEMO (FAKE DATA)";
        statusDiv.style.color = "#bc13fe";
        panel.classList.add('hidden');

        if (pollingInterval) clearTimeout(pollingInterval);
        if (typeof wsClient !== 'undefined' && wsClient) wsClient.close();

        const generator = new FakeDataGenerator();
        generator.start((messages) => {
            if (dataManager) dataManager.processMessages(messages);
        });
    });

    let wsClient = null;

    if (btnConnect) {
        btnConnect.addEventListener('click', () => {
            const videoId = inputVideoId.value.trim();
            const backendUrl = inputBackend.value.trim();

            if (!videoId || !backendUrl) {
                statusDiv.textContent = "ERROR: Missing ID or URL";
                statusDiv.style.color = "red";
                return;
            }

            localStorage.setItem('backend_url', backendUrl);

            if (pollingInterval) clearTimeout(pollingInterval);

            statusDiv.textContent = "CONNECTING TO BACKEND...";
            statusDiv.style.color = "#0ff";

            const updateStatus = (msg, isError) => {
                statusDiv.textContent = msg;
                statusDiv.style.color = isError ? "red" : "#0ff";
                if (!isError && msg.includes("Connected")) {
                    panel.classList.add('hidden');
                }
            };

            wsClient = new WebSocketClient(backendUrl, updateStatus);
            wsClient.connect(videoId);
        });
    }
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
