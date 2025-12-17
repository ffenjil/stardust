/* ============================================
   Jil's Portfolio - Main JavaScript
   Author: Jil (ffenjil)
   
   This script handles:
   1. Animated space background (stars, planets, shooting stars)
   2. Lanyard API for real-time Discord & Spotify status
   3. Toast notifications
   4. Background music autoplay
   ============================================ */


// ============================================
// CANVAS SETUP - THE ANIMATED SPACE BACKGROUND
// ============================================

// Get the canvas element and its 2D drawing context
const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

// Variables to store canvas size and our space objects
let width, height;
let stars = [];           // Array of all the twinkling stars
let shootingStars = [];   // Array of currently active shooting stars


// --------------------------------------------
// PLANET CONFIGURATION
// These are the planets that float across the
// background. Each has its own size, speed,
// and colors. They reset when they go off screen.
// --------------------------------------------
const planets = [
    { 
        name: 'Saturn',
        type: 'ringed',           // Has rings around it
        x: -100,                  // Start off-screen to the left
        y: 0,                     // Y position set in resize()
        size: 40,                 // Planet radius in pixels
        dx: 0.2,                  // Horizontal speed (pixels per frame)
        colors: ['#e0c39c', '#a88b68']  // Tan/brown gradient
    },
    { 
        name: 'Mars',
        type: 'solid',            // Just a solid colored planet
        x: -300, 
        y: 0, 
        size: 15, 
        dx: 0.35,                 // Faster than Saturn
        colors: ['#ff4b1f', '#ff9068']  // Red/orange gradient
    },
    { 
        name: 'Jupiter',
        type: 'striped',          // Has horizontal stripes
        x: -600, 
        y: 0, 
        size: 55,                 // The biggest planet
        dx: 0.15,                 // Slowest moving
        colors: ['#b9935a', '#d4af37']  // Brown/gold gradient
    },
    { 
        name: 'Neptune',
        type: 'solid', 
        x: -900, 
        y: 0, 
        size: 28, 
        dx: 0.18, 
        colors: ['#2193b0', '#6dd5ed']  // Blue/cyan gradient
    }
];


// --------------------------------------------
// RESIZE HANDLER
// This runs on load and when the window resizes.
// It updates the canvas size and repositions planets.
// --------------------------------------------
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Distribute planets at different heights
    planets[0].y = height * 0.2;   // Saturn near the top
    planets[1].y = height * 0.75;  // Mars lower down
    planets[2].y = height * 0.5;   // Jupiter in the middle
    planets[3].y = height * 0.85;  // Neptune near the bottom

    // Reinitialize stars for new canvas size
    initStars();
}


// --------------------------------------------
// STAR GENERATION
// Creates random stars across the entire canvas.
// Each star has a position, size, and twinkle speed.
// --------------------------------------------
function initStars() {
    stars = [];
    
    // Calculate how many stars to create based on screen size
    // Roughly 1 star per 4000 square pixels
    const count = Math.floor((width * height) / 4000); 
    
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * width,           // Random X position
            y: Math.random() * height,          // Random Y position
            size: Math.random() * 1.5,          // Small random size
            alpha: Math.random(),               // Starting opacity
            twinkleSpeed: Math.random() * 0.02 + 0.005  // How fast it twinkles
        });
    }
}


// --------------------------------------------
// SHOOTING STAR CREATION
// Spawns a new shooting star from the top half
// of the screen. It flies diagonally down-right.
// --------------------------------------------
function createShootingStar() {
    const startX = Math.random() * width;
    const startY = Math.random() * (height / 2);  // Start in upper half only
    
    shootingStars.push({
        x: startX,
        y: startY,
        len: Math.random() * 80 + 50,     // Tail length (50-130 pixels)
        speed: Math.random() * 10 + 10,   // Speed (10-20 pixels/frame)
        angle: Math.PI / 4                // 45 degrees diagonal
    });
}


// --------------------------------------------
// PLANET DRAWING FUNCTION
// Draws a single planet based on its type.
// Handles solid planets, ringed (Saturn), and
// striped (Jupiter) planets differently.
// --------------------------------------------
function drawPlanet(ctx, p) {
    ctx.save();  // Save current state so we can restore later
    ctx.translate(p.x, p.y);  // Move origin to planet center

    // Create gradient for planet body
    const planetGradient = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
    planetGradient.addColorStop(0, p.colors[0]);
    planetGradient.addColorStop(1, p.colors[1]);
    
    // Draw the main planet circle
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fillStyle = planetGradient;
    ctx.shadowBlur = p.size * 0.5;  // Soft glow effect
    ctx.shadowColor = p.colors[0];
    ctx.fill();
    ctx.shadowBlur = 0;  // Reset shadow

    // Add extra details based on planet type
    if (p.type === 'ringed') {
        // SATURN - Draw rings around the planet
        ctx.rotate(0.4);  // Tilt the rings slightly

        // Main ring
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(230, 230, 230, 0.4)';
        ctx.lineWidth = p.size * 0.4;
        ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner ring detail
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
        ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Shadow on bottom half
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI, true); 
        ctx.fillStyle = "rgba(0,0,0,0.1)"; 
        ctx.fill();

    } else if (p.type === 'striped') {
        // JUPITER - Draw horizontal stripes
        ctx.globalCompositeOperation = 'source-atop';  // Only draw on top of planet
        
        // Dark stripe 1
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.2); 
        
        // Dark stripe 2
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-p.size, p.size * 0.1, p.size * 2, p.size * 0.25);
        
        // Great Red Spot (tiny ellipse)
        ctx.beginPath();
        ctx.ellipse(p.size * 0.3, p.size * 0.2, p.size * 0.2, p.size * 0.1, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(150, 50, 50, 0.2)';
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';  // Reset blend mode
    }
    
    ctx.restore();  // Restore to state before translate
}


// ============================================
// MAIN ANIMATION LOOP
// This runs ~60 times per second and redraws
// everything on the canvas.
// ============================================
function animate() {
    // Clear the entire canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background gradient (deep space colors)
    const bgGrad = ctx.createRadialGradient(width/2, height*2, 0, width/2, height/2, height*1.5);
    bgGrad.addColorStop(0, '#101225');  // Dark blue at center
    bgGrad.addColorStop(1, '#050505');  // Almost black at edges
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw all the twinkling stars
    stars.forEach(star => {
        // Update twinkle (oscillate opacity)
        star.alpha += star.twinkleSpeed;
        if (star.alpha > 1 || star.alpha < 0.2) {
            star.twinkleSpeed *= -1;  // Reverse direction at limits
        }
        
        // Draw the star
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
        ctx.fill();
    });

    // Update and draw all planets
    planets.forEach(p => {
        // Move planet to the right
        p.x += p.dx;
        
        // If planet goes off right side, reset to left side
        if (p.x > width + 150) {
            p.x = -150;
            // Random new Y position when it comes back
            p.y = Math.random() * (height * 0.8) + (height * 0.1); 
        }
        
        drawPlanet(ctx, p);
    });

    // --- SHOOTING STARS ---
    // Small chance (0.1%) to spawn a new shooting star each frame
    // Max 2 shooting stars at once to keep it rare and special
    if (Math.random() < 0.001 && shootingStars.length < 2) {
        createShootingStar();
    }

    // Draw and update each shooting star
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        let s = shootingStars[i];
        
        // Move the shooting star
        s.x += s.speed * Math.cos(s.angle);
        s.y += s.speed * Math.sin(s.angle);
        
        // Calculate tail end position
        const tailX = s.x - s.len * Math.cos(s.angle);
        const tailY = s.y - s.len * Math.sin(s.angle);
        
        // Draw the tail with gradient (bright at head, fades to transparent)
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Remove shooting star if it went off screen
        if (s.x > width + s.len || s.y > height + s.len) {
            shootingStars.splice(i, 1);
        }
    }

    // Keep the animation going
    requestAnimationFrame(animate);
}

// Start everything when the page loads
window.addEventListener('resize', resize);
resize();    // Initial setup
animate();   // Start animation loop


// ============================================
// UI HELPER FUNCTIONS
// ============================================

// Shows a toast notification at the bottom of the screen
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    t.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Stellarium activity timer - counts how long I've been "using" it
let sec = 0, min = 0;
setInterval(() => {
    sec++;
    if (sec === 60) { 
        sec = 0; 
        min++; 
    }
    document.getElementById('timer').innerText = 
        `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec} elapsed`;
}, 1000);


// ============================================
// LANYARD API - REAL-TIME DISCORD & SPOTIFY
// 
// Lanyard is a free API that shows your Discord
// presence in real-time, including what you're
// listening to on Spotify!
// 
// It uses WebSockets so updates happen instantly
// instead of polling every few seconds.
// ============================================

// Get references to all the Spotify/activity elements
const stellariumSection = document.getElementById('stellarium-section');
const spotifySection = document.getElementById('spotify-section');
const progressBar = document.getElementById('spotify-progress');
const timeDisplay = document.getElementById('spotify-current-time');
const totalTimeDisplay = document.getElementById('spotify-total-time');
const songTitle = document.getElementById('spotify-song');
const artistName = document.getElementById('spotify-artist');
const albumArt = document.getElementById('spotify-album-art');
const statusIndicator = document.querySelector('.status-indicator');

// Store Spotify playback data
let spotifyData = null;
let spotifyStartTime = 0;
let spotifyEndTime = 0;

// ========================================
// MY DISCORD USER ID
// Get yours from Discord Developer Mode
// (Settings > Advanced > Developer Mode)
// Then right-click yourself and "Copy ID"
// ========================================
const DISCORD_USER_ID = '1186375223583440967';


// --------------------------------------------
// LANYARD WEBSOCKET CONNECTION
// Connects to Lanyard and listens for updates
// to my Discord presence and Spotify status.
// --------------------------------------------
function connectLanyard() {
    // Safety check - don't connect if no ID set
    if (DISCORD_USER_ID === 'YOUR_DISCORD_USER_ID_HERE') {
        console.log('Lanyard: No Discord User ID set. Using demo mode.');
        return;
    }

    // Create WebSocket connection to Lanyard
    const ws = new WebSocket('wss://api.lanyard.rest/socket');

    ws.onopen = () => {
        console.log('Lanyard: Connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // OP 1 = Hello - Lanyard wants us to subscribe
        if (data.op === 1) {
            // Tell Lanyard which user to track
            ws.send(JSON.stringify({
                op: 2,
                d: { subscribe_to_id: DISCORD_USER_ID }
            }));

            // Start heartbeat to keep connection alive
            setInterval(() => {
                ws.send(JSON.stringify({ op: 3 }));
            }, data.d.heartbeat_interval);
        }

        // OP 0 = Event - Lanyard is sending us presence data
        if (data.op === 0) {
            const presence = data.d;
            
            // Update Spotify card if listening
            handleSpotifyUpdate(presence.spotify);
            
            // Update the status indicator dot
            updateDiscordStatus(presence.discord_status);
        }
    };

    // If connection drops, try again in 5 seconds
    ws.onclose = () => {
        console.log('Lanyard: Disconnected. Reconnecting in 5s...');
        setTimeout(connectLanyard, 5000);
    };
}


// --------------------------------------------
// SPOTIFY UPDATE HANDLER
// Called whenever Lanyard sends new Spotify data.
// Shows/hides the Spotify card and updates info.
// --------------------------------------------
function handleSpotifyUpdate(spotify) {
    if (spotify) {
        // I'M LISTENING TO SPOTIFY!
        spotifyData = spotify;
        spotifyStartTime = spotify.timestamps.start;
        spotifyEndTime = spotify.timestamps.end;

        // Update the Spotify card UI
        songTitle.innerText = spotify.song;
        artistName.innerText = spotify.artist;
        albumArt.src = spotify.album_art_url;

        // Calculate and display total song length
        const totalMs = spotifyEndTime - spotifyStartTime;
        const totalSec = Math.floor(totalMs / 1000);
        const totalM = Math.floor(totalSec / 60);
        const totalS = totalSec % 60;
        totalTimeDisplay.innerText = `${totalM}:${totalS < 10 ? '0'+totalS : totalS}`;

        // Show Spotify card, hide Stellarium activity
        stellariumSection.style.display = 'none';
        spotifySection.style.display = 'block';
    } else {
        // NOT LISTENING - show Stellarium instead
        spotifyData = null;

        stellariumSection.style.display = 'block';
        spotifySection.style.display = 'none';
    }
}


// --------------------------------------------
// DISCORD STATUS UPDATE
// Updates the little colored dot on my avatar
// to show my current Discord status.
// --------------------------------------------
function updateDiscordStatus(status) {
    if (!statusIndicator) return;
    
    // Clear all previous status classes
    statusIndicator.classList.remove('online', 'idle', 'dnd', 'offline');
    
    // Add the new status class (defaults to offline if invalid)
    const validStatus = ['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'offline';
    statusIndicator.classList.add(validStatus);
    
    // Set tooltip text (capitalize first letter)
    statusIndicator.title = validStatus.charAt(0).toUpperCase() + validStatus.slice(1);
}


// --------------------------------------------
// SPOTIFY PROGRESS BAR UPDATE
// Runs every second to update the progress bar
// and current time display while listening.
// --------------------------------------------
function updateSpotifyProgress() {
    if (!spotifyData) return;  // Not listening, skip

    // Calculate how far into the song we are
    const now = Date.now();
    const elapsed = now - spotifyStartTime;
    const total = spotifyEndTime - spotifyStartTime;
    const percentage = Math.min((elapsed / total) * 100, 100);

    // Update the progress bar width
    if (progressBar) progressBar.style.width = `${percentage}%`;

    // Update the current time display (0:00 format)
    const elapsedSec = Math.floor(elapsed / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    if (timeDisplay) timeDisplay.innerText = `${m}:${s < 10 ? '0'+s : s}`;
}

// Update progress bar every second
setInterval(updateSpotifyProgress, 1000);

// Start the Lanyard connection!
connectLanyard();


// ============================================
// BACKGROUND MUSIC
// Plays bgm.mp3 automatically at 10% volume.
// If browser blocks autoplay, it waits for
// any click on the page to start playing.
// ============================================
const bgm = document.getElementById('bgm');

if (bgm) {
    bgm.volume = 0.1;  // 10% volume so it's not too loud
    
    // Try to autoplay
    bgm.play().catch(() => {
        // Browser blocked autoplay (most do now)
        // So we wait for user to click anywhere, then play
        const playOnce = () => {
            bgm.play();
            document.removeEventListener('click', playOnce);
        };
        document.addEventListener('click', playOnce);
    });
}
