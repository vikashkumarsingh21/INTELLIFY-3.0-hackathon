/****************** Firebase init & realtime bindings ******************/
// Paste this at the TOP of script.js (before other code runs)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAjlLFQ91uQMHIzSyY_biDkEtRWmtlFI8w",
  authDomain: "farmer-f19d9.firebaseapp.com",
  databaseURL: "https://farmer-f19d9-default-rtdb.firebaseio.com",
  projectId: "farmer-f19d9",
  storageBucket: "farmer-f19d9.appspot.com",
  messagingSenderId: "71192629092",
  appId: "1:71192629092:web:d4340485ec6743be78f471",
  measurementId: "G-83SB7ZF391"
};

// initialize firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();


// --- Helpers for date and history storage ---
function getDateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Save today's latest value under /history/<sensor>/<YYYY-MM-DD>/latest
function saveTodayLatest(sensor, value) {
  try {
    const date = getDateString(new Date());
    const ref = db.ref(`/history/${sensor}/${date}/latest`);
    ref.set({ value: Number(value), ts: Date.now() })
      .catch(err => console.error('saveTodayLatest err', err));
  } catch (e) { console.error(e); }
}

// Read yesterday's latest value. Resolves to number or null.
function getYesterdayLatest(sensor) {
  const yesterday = getDateString(new Date(Date.now() - 86400000));
  return db.ref(`/history/${sensor}/${yesterday}/latest`).once('value')
    .then(snap => {
      if (!snap.exists()) return null;
      const val = snap.val();
      return (val && typeof val.value !== 'undefined') ? Number(val.value) : null;
    })
    .catch(err => {
      console.error('getYesterdayLatest err', err);
      return null;
    });
}

// Update trend UI (icon + text). unitExample: '°C' or '%'
function updateYesterdayTrendUI(sensor, currentValue, textId, iconId, unitExample) {
  getYesterdayLatest(sensor).then(yesterdayValue => {
    const textEl = document.getElementById(textId);
    const iconEl = document.getElementById(iconId);
    if (!textEl) return;

    if (yesterdayValue === null) {
      textEl.innerText = 'No data for yesterday';
      if (iconEl) { iconEl.className = 'fas fa-minus trend-icon'; iconEl.style.color = ''; }
      return;
    }

    const delta = Number(currentValue) - Number(yesterdayValue);
    const sign = (delta > 0) ? '+' : (delta < 0 ? '' : ''); // negative already has '-'
    const abs = Math.abs(delta).toFixed(unitExample === '°C' ? 1 : 1); // one decimal; tweak if you want
    textEl.innerText = `${sign}${abs}${unitExample} from yesterday`;

    if (iconEl) {
      if (delta > 0) {
        iconEl.className = 'fas fa-arrow-up trend-icon';
        iconEl.style.color = '#ff6b6b';
      } else if (delta < 0) {
        iconEl.className = 'fas fa-arrow-down trend-icon';
        iconEl.style.color = '#4ecdc4';
      } else {
        iconEl.className = 'fas fa-minus trend-icon';
        iconEl.style.color = '#b0b0b0';
      }
    }
  });
}


// small helper
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// Chart helper (safe — will only run if canvas exists)
function ensureChart(id, label) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  if (window[id]) return window[id]; // reuse if created
  window[id] = new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [{ label: label, data: [], fill: true }] },
    options: { animation: false, scales: { x: { display: false } } }
  });
  return window[id];
}

function pushToChart(chart, label, value, maxPoints=50) {
  if (!chart) return;
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

// realtime listeners for sensor paths
db.ref('/temperature').on('value', snap => {
  const v = snap.val();
  setText('temp-value', v != null ? parseFloat(v).toFixed(1) : '--');
  const ch = ensureChart('tempChart', 'Temperature (°C)');
  pushToChart(ch, new Date().toLocaleTimeString(), parseFloat(v) || 0);
});

db.ref('/humidity').on('value', snap => {
  const v = snap.val();
  setText('humidity-value', v != null ? parseFloat(v).toFixed(1) : '--');
  const ch = ensureChart('humidityChart', 'Humidity (%)');
  pushToChart(ch, new Date().toLocaleTimeString(), parseFloat(v) || 0);
});

db.ref('/soil').on('value', snap => {
  const v = snap.val();
  setText('soil-value', v != null ? parseInt(v) : '--');
  const ch = ensureChart('soilChart', 'Soil Moisture (%)');
  pushToChart(ch, new Date().toLocaleTimeString(), parseInt(v) || 0);
});

db.ref('/rain').on('value', snap => {
  const v = snap.val();
  // adjust depending on your NodeMCU value (0 or 1)
  const statusText = (v == 1 || v === true) ? "Raining" : "Clear";
  setText('rain-status', statusText);
  setText('rain-value', (v == 1 || v === true) ? " No Rain" : "Rain");
});

db.ref('/motor').on('value', snap => {
  const v = snap.val();
  setText('motor-status', v ? 'Running' : 'Standby');
  setText('motor-value', v ? 'OFF' : 'ON');
});

// reflect manualMotor state (shows whether site commanded motor)
db.ref('/manualMotor').on('value', snap => {
  const v = snap.val();
  // If you also have a UI switch, update its state:
  const chk = document.getElementById('autoIrrigation'); // example
  if (chk) chk.checked = !!v;
});

// optional battery if ESP writes it
db.ref('/battery').on('value', snap => {
  const v = snap.val();
  if (v !== null) {
    setText('battery-value', parseFloat(v).toFixed(2));
    const percent = Math.round((parseFloat(v)/4.2) * 100);
    const fill = document.getElementById('batteryFill');
    const pct = document.getElementById('batteryPercentage');
    if (fill) fill.style.width = Math.max(0, Math.min(100, percent)) + '%';
    if (pct) pct.innerText = (pct ? Math.max(0, Math.min(100, percent)) : '--') + '%';
  }
});

/****************** Pump control functions (global) ******************/
window.startPump = function() { db.ref('/manualMotor').set(true); }
window.stopPump  = function() { db.ref('/manualMotor').set(false); }
window.toggleMotor = function() {
  db.ref('/manualMotor').get().then(snap => {
    const current = !!snap.val();
    db.ref('/manualMotor').set(!current);
  }).catch(err => console.error('toggleMotor err', err));
}



// Advanced Animation System for Smart Irrigation Dashboard
class AdvancedAnimationEngine {
    constructor() {
        this.animations = new Map();
        this.observers = new Map();
        this.particles = [];
        this.mousePosition = { x: 0, y: 0 };
        this.isVisible = true;
        this.scrollY = 0;
        this.deltaTime = 0;
        this.lastTime = 0;
        this.activeAnimations = new Set();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createParticleSystem();
        this.initIntersectionObserver();
        this.startAnimationLoop();
        this.setupAdvancedScrollEffects();
        this.createFloatingElements();
        this.initMorphingBackgrounds();
        this.setupTiltEffects();
        this.createLiquidAnimations();
        this.initGestureAnimations();
    }

    // Core Animation Loop with Performance Optimization
    startAnimationLoop() {
        const animate = (currentTime) => {
            this.deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            if (this.isVisible) {
                this.updateParticles();
                this.updateScrollAnimations();
                this.updateFloatingElements();
                this.updateTiltEffects();
                this.updateLiquidAnimations();
                this.updateMorphingBackgrounds();
            }

            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }

    // Advanced Particle System
    createParticleSystem() {
        const particleCount = 100;
        const container = document.querySelector('.bg-animation');
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.createAdvancedParticle(i);
            this.particles.push(particle);
            container.appendChild(particle.element);
        }
    }

    createAdvancedParticle(index) {
        const element = document.createElement('div');
        element.className = 'advanced-particle';
        
        const size = Math.random() * 4 + 2;
        const hue = Math.random() * 360;
        const opacity = Math.random() * 0.3 + 0.1;
        
        element.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, hsl(${hue}, 70%, 60%) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            filter: blur(${Math.random() * 2}px);
            opacity: ${opacity};
            box-shadow: 0 0 ${size * 2}px hsl(${hue}, 70%, 60%);
        `;

        return {
            element,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size,
            hue,
            phase: Math.random() * Math.PI * 2,
            frequency: Math.random() * 0.02 + 0.01,
            amplitude: Math.random() * 50 + 25,
            life: 1,
            decay: Math.random() * 0.001 + 0.0005
        };
    }

    updateParticles() {
        this.particles.forEach(particle => {
            // Advanced particle physics
            particle.x += particle.vx + Math.sin(particle.phase) * particle.amplitude * 0.01;
            particle.y += particle.vy + Math.cos(particle.phase) * particle.amplitude * 0.01;
            particle.phase += particle.frequency;
            
            // Mouse interaction
            const dx = this.mousePosition.x - particle.x;
            const dy = this.mousePosition.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 150) {
                const force = (150 - distance) * 0.01;
                particle.vx -= (dx / distance) * force;
                particle.vy -= (dy / distance) * force;
            }
            
            // Boundary check with wrapping
            if (particle.x < 0) particle.x = window.innerWidth;
            if (particle.x > window.innerWidth) particle.x = 0;
            if (particle.y < 0) particle.y = window.innerHeight;
            if (particle.y > window.innerHeight) particle.y = 0;
            
            // Apply velocity damping
            particle.vx *= 0.99;
            particle.vy *= 0.99;
            
            // Life cycle management
            particle.life -= particle.decay;
            if (particle.life <= 0) {
                particle.life = 1;
                particle.x = Math.random() * window.innerWidth;
                particle.y = Math.random() * window.innerHeight;
                particle.hue = Math.random() * 360;
            }
            
            // Update visual properties
            const intensity = particle.life * (1 + Math.sin(particle.phase) * 0.3);
            particle.element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) scale(${intensity})`;
            particle.element.style.background = `radial-gradient(circle, hsla(${particle.hue}, 70%, 60%, ${intensity * 0.4}) 0%, transparent 70%)`;
        });
    }

    // Advanced Scroll-Based Animations
    setupAdvancedScrollEffects() {
        let ticking = false;
        
        const updateScroll = () => {
            this.scrollY = window.pageYOffset;
            this.updateParallaxElements();
            this.updateScrollReveal();
            this.updateNavbarEffects();
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScroll);
                ticking = true;
            }
        });
    }

    updateParallaxElements() {
        const parallaxElements = document.querySelectorAll('.sensor-card, .info-card, .analytics-card');
        
        parallaxElements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            const offset = index * 0.1;
            
            // 3D Parallax with rotation
            const rotateX = (rect.top - window.innerHeight / 2) * 0.01;
            const rotateY = (rect.left - window.innerWidth / 2) * 0.01;
            
            element.style.transform = `
                translate3d(0, ${rate * offset}px, 0) 
                rotateX(${rotateX}deg) 
                rotateY(${rotateY}deg)
                perspective(1000px)
            `;
            
            // Dynamic opacity based on scroll position
            const opacity = Math.max(0, Math.min(1, 1 - Math.abs(rect.top - window.innerHeight / 2) / 500));
            element.style.opacity = opacity;
        });
    }

    updateScrollReveal() {
        const elements = document.querySelectorAll('[data-reveal]');
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight * 0.8;
            
            if (isVisible && !element.classList.contains('revealed')) {
                element.classList.add('revealed');
                this.triggerRevealAnimation(element);
            }
        });
    }

    triggerRevealAnimation(element) {
        const animationType = element.dataset.reveal || 'fade';
        
        switch (animationType) {
            case 'slide-up':
                this.animateSlideUp(element);
                break;
            case 'scale':
                this.animateScale(element);
                break;
            case 'rotate':
                this.animateRotate(element);
                break;
            case 'elastic':
                this.animateElastic(element);
                break;
            default:
                this.animateFade(element);
        }
    }

    // Advanced Animation Methods
    animateSlideUp(element) {
        gsap.fromTo(element, 
            { y: 100, opacity: 0, rotationX: 45 },
            { 
                y: 0, 
                opacity: 1, 
                rotationX: 0,
                duration: 1.2,
                ease: "elastic.out(1, 0.8)",
                stagger: 0.1
            }
        );
    }

    animateScale(element) {
        gsap.fromTo(element,
            { scale: 0, rotation: 180, opacity: 0 },
            {
                scale: 1,
                rotation: 0,
                opacity: 1,
                duration: 0.8,
                ease: "back.out(1.7)"
            }
        );
    }

    animateElastic(element) {
        gsap.fromTo(element,
            { scaleX: 0, transformOrigin: "left center" },
            {
                scaleX: 1,
                duration: 1.5,
                ease: "elastic.out(1, 0.5)"
            }
        );
    }

    // Advanced Hover Effects with 3D Transforms
    setupTiltEffects() {
        const tiltElements = document.querySelectorAll('.sensor-card, .info-card');
        
        tiltElements.forEach(element => {
            element.addEventListener('mousemove', (e) => {
                const rect = element.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / centerY * 15;
                const rotateY = (centerX - x) / centerX * 15;
                
                element.style.transform = `
                    perspective(1000px) 
                    rotateX(${rotateX}deg) 
                    rotateY(${rotateY}deg) 
                    translateZ(20px)
                    scale3d(1.05, 1.05, 1.05)
                `;
                
                // Create light following cursor
                this.createLightFollower(element, x, y);
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0) scale3d(1, 1, 1)';
                this.removeLightFollower(element);
            });
        });
    }

    createLightFollower(element, x, y) {
        const light = element.querySelector('.light-follower') || document.createElement('div');
        light.className = 'light-follower';
        light.style.cssText = `
            position: absolute;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            left: ${x - 100}px;
            top: ${y - 100}px;
            transition: transform 0.1s ease-out;
            z-index: 1;
        `;
        
        if (!element.querySelector('.light-follower')) {
            element.appendChild(light);
        }
    }

    // Morphing Background System
    initMorphingBackgrounds() {
        const morphingBg = document.querySelector('.bg-animation');
        this.morphingShape = {
            points: [],
            targetPoints: [],
            morphing: false
        };
        
        this.generateMorphingPoints();
        this.startMorphingAnimation();
    }

    generateMorphingPoints() {
        const pointCount = 8;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
        
        for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.morphingShape.points.push({ x, y });
            this.morphingShape.targetPoints.push({ x, y });
        }
    }

    startMorphingAnimation() {
        setInterval(() => {
            this.morphingShape.targetPoints.forEach(point => {
                point.x += (Math.random() - 0.5) * 100;
                point.y += (Math.random() - 0.5) * 100;
            });
            this.morphingShape.morphing = true;
        }, 3000);
    }

    updateMorphingBackgrounds() {
        if (!this.morphingShape.morphing) return;
        
        let allReached = true;
        this.morphingShape.points.forEach((point, i) => {
            const target = this.morphingShape.targetPoints[i];
            const dx = target.x - point.x;
            const dy = target.y - point.y;
            
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                point.x += dx * 0.02;
                point.y += dy * 0.02;
                allReached = false;
            }
        });
        
        if (allReached) {
            this.morphingShape.morphing = false;
        }
        
        this.updateMorphingVisual();
    }

    updateMorphingVisual() {
        const svg = document.getElementById('morphing-svg') || this.createMorphingSVG();
        const path = svg.querySelector('path');
        
        let pathData = `M ${this.morphingShape.points[0].x} ${this.morphingShape.points[0].y}`;
        
        for (let i = 1; i < this.morphingShape.points.length; i++) {
            const point = this.morphingShape.points[i];
            pathData += ` L ${point.x} ${point.y}`;
        }
        pathData += ' Z';
        
        path.setAttribute('d', pathData);
    }

    createMorphingSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'morphing-svg';
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -1;
            opacity: 0.1;
        `;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'url(#morphing-gradient)');
        
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        gradient.innerHTML = `
            <linearGradient id="morphing-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:0.1" />
            </linearGradient>
        `;
        
        svg.appendChild(gradient);
        svg.appendChild(path);
        document.querySelector('.bg-animation').appendChild(svg);
        
        return svg;
    }

    // Advanced Liquid Loading Animations
    createLiquidAnimations() {
        const liquidElements = document.querySelectorAll('[data-liquid]');
        
        liquidElements.forEach(element => {
            const liquid = this.createLiquidEffect(element);
            element.appendChild(liquid);
        });
    }

    createLiquidEffect(container) {
        const liquid = document.createElement('div');
        liquid.className = 'liquid-effect';
        liquid.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: inherit;
            overflow: hidden;
            pointer-events: none;
            z-index: -1;
        `;
        
        const wave = document.createElement('div');
        wave.className = 'liquid-wave';
        wave.style.cssText = `
            position: absolute;
            top: 70%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(from 0deg, 
                rgba(79, 172, 254, 0.3) 0deg, 
                rgba(67, 233, 123, 0.3) 90deg,
                rgba(255, 107, 107, 0.3) 180deg,
                rgba(255, 212, 61, 0.3) 270deg,
                rgba(79, 172, 254, 0.3) 360deg
            );
            border-radius: 50%;
            animation: liquidRotate 10s linear infinite;
        `;
        
        liquid.appendChild(wave);
        
        // Add CSS animation
        if (!document.getElementById('liquid-styles')) {
            const style = document.createElement('style');
            style.id = 'liquid-styles';
            style.textContent = `
                @keyframes liquidRotate {
                    from { transform: rotate(0deg) scale(1); }
                    50% { transform: rotate(180deg) scale(1.1); }
                    to { transform: rotate(360deg) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return liquid;
    }

    // Advanced Gesture-Based Animations
    initGestureAnimations() {
        let startY = 0;
        let currentY = 0;
        let startTime = 0;
        
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startTime = Date.now();
        });
        
        document.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            // Apply elastic scroll effect
            const elasticity = Math.min(1, Math.abs(deltaY) / 100);
            document.body.style.transform = `translateY(${deltaY * elasticity * 0.5}px) scale(${1 - elasticity * 0.05})`;
        });
        
        document.addEventListener('touchend', (e) => {
            const endTime = Date.now();
            const deltaY = currentY - startY;
            const deltaTime = endTime - startTime;
            const velocity = Math.abs(deltaY) / deltaTime;
            
            // Trigger special animations based on gesture
            if (velocity > 1 && Math.abs(deltaY) > 100) {
                this.triggerGestureAnimation(deltaY > 0 ? 'down' : 'up');
            }
            
            // Reset transform
            document.body.style.transform = '';
            document.body.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            
            setTimeout(() => {
                document.body.style.transition = '';
            }, 300);
        });
    }

    triggerGestureAnimation(direction) {
        if (direction === 'down') {
            this.createRippleEffect();
        } else {
            this.createFloatEffect();
        }
    }

    createRippleEffect() {
        const ripples = document.querySelectorAll('.sensor-card');
        
        ripples.forEach((card, index) => {
            setTimeout(() => {
                card.style.transform = 'scale(1.1) rotateY(180deg)';
                card.style.transition = 'transform 0.5s ease-out';
                
                setTimeout(() => {
                    card.style.transform = '';
                }, 500);
            }, index * 100);
        });
    }

    createFloatEffect() {
        const elements = document.querySelectorAll('.sensor-card, .info-card');
        
        elements.forEach((element, index) => {
            const randomX = (Math.random() - 0.5) * 50;
            const randomY = (Math.random() - 0.5) * 50;
            const randomRotate = (Math.random() - 0.5) * 20;
            
            setTimeout(() => {
                element.style.transform = `translate3d(${randomX}px, ${randomY}px, 0) rotate(${randomRotate}deg)`;
                element.style.transition = 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                
                setTimeout(() => {
                    element.style.transform = '';
                }, 1000);
            }, index * 50);
        });
    }

    // Advanced Data Visualization Animations
    animateDataChanges(element, newValue, oldValue) {
        const valueElement = element.querySelector('.value');
        const change = newValue - oldValue;
        
        // Create counter animation
        let currentValue = oldValue;
        const increment = change / 30;
        const duration = 1000;
        const startTime = Date.now();
        
        const animateValue = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            currentValue = oldValue + (change * this.easeOutExpo(progress));
            valueElement.textContent = Math.round(currentValue * 10) / 10;
            
            if (progress < 1) {
                requestAnimationFrame(animateValue);
            }
        };
        
        // Add visual feedback for change
        const changeIndicator = document.createElement('div');
        changeIndicator.className = 'change-indicator';
        changeIndicator.textContent = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
        changeIndicator.style.cssText = `
            position: absolute;
            top: -20px;
            right: 0;
            color: ${change > 0 ? '#43e97b' : '#ff6b6b'};
            font-size: 0.8rem;
            font-weight: 600;
            opacity: 0;
            transform: translateY(10px);
            animation: changeIndicatorAnim 2s ease-out forwards;
        `;
        
        element.style.position = 'relative';
        element.appendChild(changeIndicator);
        
        // Add glow effect
        element.style.boxShadow = `0 0 20px ${change > 0 ? 'rgba(67, 233, 123, 0.5)' : 'rgba(255, 107, 107, 0.5)'}`;
        
        setTimeout(() => {
            element.style.boxShadow = '';
            changeIndicator.remove();
        }, 2000);
        
        animateValue();
    }

    // Easing Functions
    easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Mouse tracking for interactive particles
        document.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        // Visibility API for performance
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
        });

        // Resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Advanced keyboard interactions
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardAnimation(e);
        });
    }

    handleKeyboardAnimation(e) {
        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            this.triggerSystemAnimation();
        }
        
        if (e.key === 'Escape') {
            this.resetAllAnimations();
        }
    }

    triggerSystemAnimation() {
        // Create system-wide pulse animation
        document.body.style.animation = 'systemPulse 1s ease-out';
        
        setTimeout(() => {
            document.body.style.animation = '';
        }, 1000);
        
        // Add CSS if not exists
        if (!document.getElementById('system-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'system-animation-styles';
            style.textContent = `
                @keyframes systemPulse {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.02); filter: brightness(1.2); }
                    100% { transform: scale(1); filter: brightness(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    resetAllAnimations() {
        // Reset all transforms and animations
        const elements = document.querySelectorAll('.sensor-card, .info-card, .analytics-card');
        elements.forEach(element => {
            element.style.transform = '';
            element.style.transition = 'all 0.3s ease';
        });
    }

    handleResize() {
        // Recalculate particle positions
        this.particles.forEach(particle => {
            if (particle.x > window.innerWidth) particle.x = window.innerWidth;
            if (particle.y > window.innerHeight) particle.y = window.innerHeight;
        });
        
        // Update morphing background
        this.generateMorphingPoints();
    }

    // Floating Elements System
    createFloatingElements() {
        const floatingElements = document.querySelectorAll('[data-float]');
        
        floatingElements.forEach(element => {
            const amplitude = parseFloat(element.dataset.float) || 10;
            const frequency = Math.random() * 0.02 + 0.01;
            const phase = Math.random() * Math.PI * 2;
            
            element.floatData = { amplitude, frequency, phase, offset: 0 };
        });
    }

    updateFloatingElements() {
        const floatingElements = document.querySelectorAll('[data-float]');
        
        floatingElements.forEach(element => {
            if (!element.floatData) return;
            
            element.floatData.offset += element.floatData.frequency;
            const y = Math.sin(element.floatData.offset + element.floatData.phase) * element.floatData.amplitude;
            
            element.style.transform = `translateY(${y}px)`;
        });
    }

    // Intersection Observer for Performance
    initIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.activateElementAnimations(entry.target);
                } else {
                    this.deactivateElementAnimations(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });

        const observeElements = document.querySelectorAll('.sensor-card, .info-card, .analytics-card');
        observeElements.forEach(element => {
            observer.observe(element);
        });
    }

    activateElementAnimations(element) {
        element.classList.add('animate-active');
        this.activeAnimations.add(element);
    }

    deactivateElementAnimations(element) {
        element.classList.remove('animate-active');
        this.activeAnimations.delete(element);
    }

    // Update methods for different animation systems
    updateScrollAnimations() {
        if (this.activeAnimations.size === 0) return;
        
        this.activeAnimations.forEach(element => {
            const rect = element.getBoundingClientRect();
            const progress = 1 - (rect.top / window.innerHeight);
            
            if (progress > 0 && progress < 1) {
                const scale = 0.9 + (progress * 0.1);
                const opacity = Math.max(0.3, progress);
                
                element.style.transform = `scale(${scale})`;
                element.style.opacity = opacity;
            }
        });
    }

    updateTiltEffects() {
        // Update any active tilt effects
        // This would be called from the main animation loop
    }

    updateLiquidAnimations() {
        const liquidElements = document.querySelectorAll('.liquid-wave');
        liquidElements.forEach(element => {
            // Additional liquid animation updates can be added here
        });
    }

    removeLightFollower(element) {
        const light = element.querySelector('.light-follower');
        if (light) {
            light.remove();
        }
    }

    updateNavbarEffects() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        
        if (this.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    animateFade(element) {
        gsap.fromTo(element,
            { opacity: 0 },
            {
                opacity: 1,
                duration: 0.6,
                ease: "power2.out"
            }
        );
    }

    animateRotate(element) {
        gsap.fromTo(element,
            { rotation: -90, opacity: 0, scale: 0.8 },
            {
                rotation: 0,
                opacity: 1,
                scale: 1,
                duration: 0.8,
                ease: "power3.out"
            }
        );
    }
}

// Motor Control Animations
function toggleMotor() {
    const motorCard = document.querySelector('.motor-status');
    const motorStatus = document.getElementById('motor-status');
    const motorValue = document.getElementById('motor-value');
    const startBtn = motorCard.querySelector('.start');
    const stopBtn = motorCard.querySelector('.stop');
    
    const isRunning = motorValue.textContent === 'ON';
    
    if (!isRunning) {
        // Start motor animation
        motorValue.textContent = 'ON';
        motorStatus.textContent = 'Running';
        motorCard.style.background = 'linear-gradient(135deg, rgba(67, 233, 123, 0.2), rgba(56, 249, 215, 0.1))';
        
        // Advanced motor start animation
        gsap.timeline()
            .to(motorCard, {
                scale: 1.1,
                duration: 0.2,
                ease: "power2.out"
            })
            .to(motorCard, {
                scale: 1,
                duration: 0.3,
                ease: "elastic.out(1, 0.5)"
            })
            .to(motorCard.querySelector('.sensor-icon'), {
                rotation: 360,
                duration: 1,
                ease: "power2.inOut",
                repeat: -1
            }, 0);
            
        // Create pulsing border effect
        motorCard.style.boxShadow = '0 0 30px rgba(67, 233, 123, 0.6)';
        motorCard.style.animation = 'motorPulse 2s infinite';
        
        // Button state animation
        startBtn.style.background = 'rgba(67, 233, 123, 0.3)';
        startBtn.style.transform = 'scale(0.95)';
        
        showNotification('Motor Started', 'Irrigation system is now active', 'success');
        
    } else {
        stopMotor();
    }
}

function stopMotor() {
    const motorCard = document.querySelector('.motor-status');
    const motorStatus = document.getElementById('motor-status');
    const motorValue = document.getElementById('motor-value');
    const startBtn = motorCard.querySelector('.start');
    const stopBtn = motorCard.querySelector('.stop');
    
    // Stop motor animation
    motorValue.textContent = 'OFF';
    motorStatus.textContent = 'Standby';
    motorCard.style.background = '';
    motorCard.style.boxShadow = '';
    motorCard.style.animation = '';
    
    // Stop icon rotation
    gsap.killTweensOf(motorCard.querySelector('.sensor-icon'));
    gsap.to(motorCard.querySelector('.sensor-icon'), {
        rotation: 0,
        duration: 0.5,
        ease: "power2.out"
    });
    
    // Reset button states
    startBtn.style.background = '';
    startBtn.style.transform = '';
    stopBtn.style.background = 'rgba(255, 107, 107, 0.3)';
    stopBtn.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        stopBtn.style.background = '';
        stopBtn.style.transform = '';
    }, 200);
    
    showNotification('Motor Stopped', 'Irrigation system is now on standby', 'info');
}

// Weather Animation System
function refreshWeather() {
    const refreshBtn = document.querySelector('.refresh-btn');
    const weatherContent = document.getElementById('weatherData');
    
    // Animate refresh button
    gsap.to(refreshBtn.querySelector('i'), {
        rotation: 360,
        duration: 1,
        ease: "power2.inOut"
    });
    
    // Show loading state
    weatherContent.innerHTML = `
        <div class="weather-loading">
            <div class="advanced-loading-spinner"></div>
            <p>Fetching latest weather data...</p>
        </div>
    `;
    
    // Simulate weather data fetch with advanced loading animation
const apiKey = "d5130d7b6503d207ab37b4e63b946916"; // Replace with real key
const city = "Delhi"; // Change as needed
const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

fetch(url)
  .then(response => {
    if (!response.ok) {
      throw new Error("Failed to fetch weather data");
    }
    return response.json();
  })
  .then(data => {
    document.getElementById("weather-temp").innerText = data.main.temp + "°C";
    document.getElementById("weather-status").innerText = data.weather[0].description;
  })
  .catch(error => {
    console.error(error);
    document.getElementById("weather-temp").innerText = "--";
    document.getElementById("weather-status").innerText = "Failed to fetch";
  });

    // Animate weather items in
    const weatherItems = weatherContent.querySelectorAll('.weather-item');
    gsap.fromTo(weatherItems, 
        { 
            y: 30, 
            opacity: 0, 
            scale: 0.8,
            rotationX: 45
        },
        { 
            y: 0, 
            opacity: 1, 
            scale: 1,
            rotationX: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "back.out(1.7)"
        }
    );
    
    // Add hover animations to weather items
    weatherItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            gsap.to(item, {
                scale: 1.05,
                y: -5,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        
        item.addEventListener('mouseleave', () => {
            gsap.to(item, {
                scale: 1,
                y: 0,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
}

// Camera Control Animations
function toggleCamera() {
    const cameraFeed = document.getElementById('cameraFeed');
    const isOffline = cameraFeed.textContent.includes('Offline');
    
    if (isOffline) {
        // Simulate camera activation
        cameraFeed.innerHTML = `
            <div class="camera-activating">
                <div class="camera-loading-ring"></div>
                <p>Activating Camera...</p>
            </div>
        `;
        
        // Add camera loading animation
        setTimeout(() => {
            cameraFeed.innerHTML = `
                <div class="camera-active">
                    <i class="fas fa-video camera-active-icon"></i>
                    <p>Camera Online</p>
                    <div class="signal-bars">
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                    </div>
                </div>
            `;
            
            // Animate signal bars
            const bars = cameraFeed.querySelectorAll('.bar');
            bars.forEach((bar, index) => {
                gsap.to(bar, {
                    scaleY: Math.random() * 0.7 + 0.3,
                    duration: 0.5,
                    repeat: -1,
                    yoyo: true,
                    delay: index * 0.1
                });
            });
            
            showNotification('Camera Activated', 'Live feed is now available', 'success');
            
            // Simulate animal detection after 5 seconds
            setTimeout(() => {
                simulateAnimalDetection();
            }, 5000);
            
        }, 2000);
        
    } else {
        // Turn off camera
        cameraFeed.innerHTML = `
            <i class="fas fa-camera"></i>
            <p>Camera Offline</p>
            <small>Check connection</small>
        `;
        
        hideAnimalAlert();
        showNotification('Camera Deactivated', 'Live feed has been stopped', 'info');
    }
}

function captureImage() {
    const cameraFeed = document.getElementById('cameraFeed');
    
    // Flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        opacity: 0;
        border-radius: inherit;
        pointer-events: none;
        z-index: 10;
    `;
    
    cameraFeed.style.position = 'relative';
    cameraFeed.appendChild(flash);
    
    // Animate flash
    gsap.to(flash, {
        opacity: 1,
        duration: 0.1,
        onComplete: () => {
            gsap.to(flash, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    flash.remove();
                }
            });
        }
    });
    
    // Show capture feedback
    showNotification('Image Captured', 'Screenshot saved to device', 'success');
}

function simulateAnimalDetection() {
    const alertBox = document.getElementById('animalAlert');
    alertBox.classList.add('active');
    
    // Shake animation for alert
    gsap.to(alertBox, {
        x: -5,
        duration: 0.1,
        repeat: 5,
        yoyo: true,
        ease: "power2.inOut"
    });
    
    // Flash the camera card
    const cameraCard = document.querySelector('.camera-card');
    cameraCard.style.animation = 'alertFlash 0.5s ease-in-out 3';
    
    showNotification('Security Alert!', 'Animal detected in the field', 'danger');
    
    // Auto-hide alert after 10 seconds
    setTimeout(() => {
        hideAnimalAlert();
    }, 10000);
}

function hideAnimalAlert() {
    const alertBox = document.getElementById('animalAlert');
    alertBox.classList.remove('active');
    
    const cameraCard = document.querySelector('.camera-card');
    cameraCard.style.animation = '';
}

// Advanced Notification System
function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <button class="notification-close" onclick="closeNotification(this)">
            <i class="fas fa-times"></i>
        </button>
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    gsap.fromTo(notification,
        { x: 400, opacity: 0, scale: 0.8 },
        { 
            x: 0, 
            opacity: 1, 
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.7)"
        }
    );
    
    notification.classList.add('show');
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        closeNotification(notification.querySelector('.notification-close'));
    }, 5000);
}

function closeNotification(closeBtn) {
    const notification = closeBtn.parentElement;
    
    gsap.to(notification, {
        x: 400,
        opacity: 0,
        scale: 0.8,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
            notification.remove();
        }
    });
}

// Chart Animation System
function initializeChart() {
    const ctx = document.getElementById('sensorChart');
    if (!ctx) return;
    
    const chartData = {
        labels: ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM', '12AM'],
        datasets: [
            {
                label: 'Temperature (°C)',
                data: [22, 25, 28, 32, 30, 26, 24],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Humidity (%)',
                data: [70, 65, 60, 55, 58, 65, 68],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Soil Moisture (%)',
                data: [80, 78, 75, 70, 68, 72, 76],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    };
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            elements: {
                point: {
                    radius: 6,
                    hoverRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart',
                onComplete: function() {
                    // Add sparkle effect after chart load
                    addChartSparkles();
                }
            }
        }
    });
    
    // Update chart data periodically with animation
    setInterval(() => {
        updateChartData(chart);
    }, 10000);
    
    return chart;
}

function updateChartData(chart) {
    // Generate new data points
    const newData = chart.data.datasets.map(dataset => {
        return dataset.data.map(value => {
            const change = (Math.random() - 0.5) * 10;
            return Math.max(0, value + change);
        });
    });
    
    // Animate data change
    chart.data.datasets.forEach((dataset, index) => {
        dataset.data = newData[index];
    });
    
    chart.update('active');
}

function addChartSparkles() {
    const chartContainer = document.querySelector('.chart-container');
    
    for (let i = 0; i < 20; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'chart-sparkle';
        sparkle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, #fff 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            opacity: 0;
            animation: sparkleAnim ${2 + Math.random() * 3}s infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        
        chartContainer.appendChild(sparkle);
        
        // Remove sparkle after animation
        setTimeout(() => {
            sparkle.remove();
        }, 5000);
    }
}

// Data Update Animation System
// Comment out or remove this function and related ones
/*
function simulateDataUpdates() {
  const sensors = ['temperature', 'humidity', 'soil-moisture', 'battery'];
  setInterval(() => {
    const randomSensor = sensors[Math.floor(Math.random() * sensors.length)];
    updateSensorValue(randomSensor);
  }, 5000);
}
function updateSensorValue(sensorType) { ... }
function animateValueChange(element, oldValue, newValue) { ... }
*/
// Remove call in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const animationEngine = new AdvancedAnimationEngine();
  // simulateDataUpdates(); // Comment out
  const chart = initializeChart();
  const navToggle = document.getElementById('navToggle');
  if (navToggle) navToggle.addEventListener('click', toggleMobileNav);
  setTimeout(() => {
    showNotification('System Ready', 'Smart Irrigation Dashboard is fully operational', 'success');
  }, 1000);
  console.log('Advanced Animation System Initialized');
});


function updateSensorValue(sensorType) {
    const sensorCard = document.querySelector(`.${sensorType}`);
    if (!sensorCard) return;
    
    const valueElement = sensorCard.querySelector('.value');
    const oldValue = parseFloat(valueElement.textContent);
    
    let newValue;
    switch (sensorType) {
        case 'temperature':
            newValue = 20 + Math.random() * 15;
            break;
        case 'humidity':
            newValue = 40 + Math.random() * 40;
            break;
        case 'soil-moisture':
            newValue = 60 + Math.random() * 30;
            break;
        case 'battery':
            newValue = 3.2 + Math.random() * 0.8;
            break;
        default:
            return;
    }
    
    // Animate value change
    animateValueChange(valueElement, oldValue, newValue);
    
    // Update card appearance based on value
    updateSensorCardAppearance(sensorCard, sensorType, newValue);
}

function animateValueChange(element, oldValue, newValue) {
    const duration = 1500;
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = oldValue + (newValue - oldValue) * easedProgress;
        
        element.textContent = currentValue.toFixed(1);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    
    animate();
    
    // Add visual feedback
    element.parentElement.style.transform = 'scale(1.1)';
    element.parentElement.style.filter = 'brightness(1.2)';
    
    setTimeout(() => {
        element.parentElement.style.transform = '';
        element.parentElement.style.filter = '';
    }, 200);
}

function updateSensorCardAppearance(card, type, value) {
    // Update status based on value ranges
    const statusElement = card.querySelector('.sensor-status');
    let status, color;
    
    switch (type) {
        case 'temperature':
            if (value < 25) {
                status = 'Cool';
                color = '#4ecdc4';
            } else if (value > 35) {
                status = 'Hot';
                color = '#ff6b6b';
            } else {
                status = 'Normal';
                color = '#43e97b';
            }
            break;
        case 'humidity':
            if (value < 40) {
                status = 'Low';
                color = '#ff6b6b';
            } else if (value > 80) {
                status = 'High';
                color = '#ffd93d';
            } else {
                status = 'Optimal';
                color = '#43e97b';
            }
            break;
        case 'soil-moisture':
            if (value < 50) {
                status = 'Dry';
                color = '#ff6b6b';
            } else if (value > 85) {
                status = 'Wet';
                color = '#4facfe';
            } else {
                status = 'Good';
                color = '#43e97b';
            }
            break;
    }
    
    if (statusElement && status) {
        statusElement.textContent = status;
        statusElement.style.color = color;
        
        // Pulse animation for status change
        gsap.fromTo(statusElement,
            { scale: 1.2, opacity: 0.7 },
            { 
                scale: 1, 
                opacity: 1, 
                duration: 0.5,
                ease: "power2.out" 
            }
        );
    }
}

// Mobile Navigation Animation
function toggleMobileNav() {
    const navMenu = document.getElementById('navMenu');
    const navToggle = document.getElementById('navToggle');
    const isOpen = navMenu.classList.contains('active');
    
    if (!isOpen) {
        navMenu.classList.add('active');
        
        // Animate menu items
        const menuItems = navMenu.querySelectorAll('.nav-link');
        gsap.fromTo(menuItems,
            { x: -50, opacity: 0 },
            { 
                x: 0, 
                opacity: 1, 
                duration: 0.3,
                stagger: 0.1,
                ease: "power2.out"
            }
        );
        
        // Transform hamburger to X
        gsap.to(navToggle.querySelector('i'), {
            rotation: 90,
            duration: 0.3
        });
        
    } else {
        navMenu.classList.remove('active');
        
        // Reset hamburger
        gsap.to(navToggle.querySelector('i'), {
            rotation: 0,
            duration: 0.3
        });
    }
}

// Initialize animation system
document.addEventListener('DOMContentLoaded', () => {
    // Add required CSS for animations
    const animationStyles = document.createElement('style');
    animationStyles.textContent = `
        @keyframes motorPulse {
            0%, 100% { box-shadow: 0 0 30px rgba(67, 233, 123, 0.6); }
            50% { box-shadow: 0 0 50px rgba(67, 233, 123, 0.9); }
        }
        
        @keyframes alertFlash {
            0%, 100% { background: var(--glass-bg); }
            50% { background: rgba(255, 107, 107, 0.2); }
        }
        
        @keyframes sparkleAnim {
            0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
            50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        
        @keyframes changeIndicatorAnim {
            0% { opacity: 0; transform: translateY(10px); }
            20% { opacity: 1; transform: translateY(-5px); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
        
        .advanced-loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #4facfe;
            animation: spin 1s ease-in-out infinite;
        }
        
        .camera-loading-ring {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #43e97b;
            animation: spin 1s linear infinite;
        }
        
        .signal-bars {
            display: flex;
            gap: 4px;
            margin-top: 10px;
        }
        
        .signal-bars .bar {
            width: 6px;
            height: 20px;
            background: #43e97b;
            border-radius: 2px;
            transform-origin: bottom;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(animationStyles);
    
    // Initialize the advanced animation engine
    const animationEngine = new AdvancedAnimationEngine();
    
    // Start data simulation
    simulateDataUpdates();
    
    // Initialize chart
    const chart = initializeChart();
    
    // Setup mobile navigation
    const navToggle = document.getElementById('navToggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileNav);
    }
    
    // Show welcome notification
    setTimeout(() => {
        showNotification('System Ready', 'Smart Irrigation Dashboard is fully operational', 'success');
    }, 1000);
    
    console.log('Advanced Animation System Initialized');
});




// Page Navigation - Show/Hide Sections
function showSection(sectionId) {
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => {
    section.classList.remove('active');
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
  }

  // Update navbar active class
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${sectionId}`) {
      link.classList.add('active');
    }
  });
}




// 🌦 Weather API Integration
function fetchWeather(city = "Delhi") {
  const apiKey = "d5130d7b6503d207ab37b4e63b946916"; // 🟠 Replace this with your actual key
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      document.getElementById("city").innerText = data.name;
      document.getElementById("weatherTemp").innerText = data.main.temp;
      document.getElementById("weatherDesc").innerText = data.weather[0].description;
      document.getElementById("weatherHumidity").innerText = data.main.humidity;
      document.getElementById("weatherWind").innerText = data.wind.speed;
    })
    .catch(err => {
      console.error("Weather fetch failed:", err);
      alert("Failed to fetch weather data");
    });
}

// 🔁 Call it when page loads
fetchWeather(); // You can also allow city selection later




//=========Live Clock Update for systemTime================
setInterval(() => {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const el = document.getElementById('systemTime');
  if (el) {
    el.innerText = timeString;
  }
}, 1000);





// SETTING PAGE
/****************** SETTINGS PAGE FUNCTIONS ******************/

// Load settings when page loads
window.addEventListener("load", loadSettings);

function loadSettings() {
  db.ref('/settings').once('value').then(snapshot => {
    if (!snapshot.exists()) return;
    const s = snapshot.val();

    document.getElementById("autoIrrigation").checked = s.autoIrrigation ?? true;
    document.getElementById("moistureThreshold").value = s.moistureThreshold ?? 50;
    document.getElementById("moistureValue").innerText = (s.moistureThreshold ?? 50) + "%";
    document.getElementById("irrigationDuration").value = s.irrigationDuration ?? 30;
    document.getElementById("scheduleType").value = s.scheduleType ?? "automatic";

    document.getElementById("emailNotifications").checked = s.emailNotifications ?? true;
    document.getElementById("smsAlerts").checked = s.smsAlerts ?? false;
    document.getElementById("pushNotifications").checked = s.pushNotifications ?? true;
    document.getElementById("alertFrequency").value = s.alertFrequency ?? "hourly";

    document.getElementById("wifiNetwork").innerText = s.wifiNetwork ?? "SmartFarm_Network";
    document.getElementById("updateInterval").value = s.updateInterval ?? 10;
    document.getElementById("cloudBackup").checked = s.cloudBackup ?? true;

    document.getElementById("animalDetection").checked = s.animalDetection ?? true;
    document.getElementById("motionAlerts").checked = s.motionAlerts ?? true;
    document.getElementById("cameraRecording").value = s.cameraRecording ?? "motion";
  });
}

function saveSettings() {
  const settings = {
    autoIrrigation: document.getElementById("autoIrrigation").checked,
    moistureThreshold: document.getElementById("moistureThreshold").value,
    irrigationDuration: document.getElementById("irrigationDuration").value,
    scheduleType: document.getElementById("scheduleType").value,

    emailNotifications: document.getElementById("emailNotifications").checked,
    smsAlerts: document.getElementById("smsAlerts").checked,
    pushNotifications: document.getElementById("pushNotifications").checked,
    alertFrequency: document.getElementById("alertFrequency").value,

    wifiNetwork: document.getElementById("wifiNetwork").innerText,
    updateInterval: document.getElementById("updateInterval").value,
    cloudBackup: document.getElementById("cloudBackup").checked,

    animalDetection: document.getElementById("animalDetection").checked,
    motionAlerts: document.getElementById("motionAlerts").checked,
    cameraRecording: document.getElementById("cameraRecording").value
  };

  db.ref('/settings').set(settings)
    .then(() => alert("Settings saved successfully!"))
    .catch(err => alert("Failed to save settings: " + err));
}

function resetSettings() {
  db.ref('/settings').remove()
    .then(() => {
      alert("Settings reset to default");
      loadSettings(); // reload defaults
    })
    .catch(err => alert("Failed to reset settings: " + err));
}

function exportSettings() {
  db.ref('/settings').once('value').then(snapshot => {
    if (!snapshot.exists()) {
      alert("No settings to export!");
      return;
    }
    const settings = JSON.stringify(snapshot.val(), null, 2);
    const blob = new Blob([settings], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Live update moisture threshold label
document.getElementById("moistureThreshold").addEventListener("input", function() {
  document.getElementById("moistureValue").innerText = this.value + "%";
});

// HISTORY

function loadHistory(range="week", type="all") {
  db.ref('/history').once('value').then(snap => {
    const container = document.getElementById("historyTimeline");
    container.innerHTML = "";
    if (!snap.exists()) {
      container.innerHTML = "<p>No history data available</p>";
      return;
    }
    const data = snap.val();
    for (let sensor in data) {
      for (let date in data[sensor]) {
        if (!data[sensor][date].latest) continue;
        const v = data[sensor][date].latest.value;
        const div = document.createElement("div");
        div.className = "timeline-item " + sensor;
        div.innerHTML = `
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <h4>${sensor} Update</h4>
              <span class="timeline-time">${date}</span>
            </div>
            <p>Latest Value: ${v}</p>
          </div>
        `;
        container.appendChild(div);
      }
    }
  });
}
window.addEventListener("load", () => loadHistory());


// ALERT PAGE 
function loadAlerts() {
  db.ref('/alerts').once('value').then(snap => {
    const container = document.querySelector(".alerts-summary");
    if (!snap.exists()) {
      container.innerHTML = "<p>No alerts found</p>";
      return;
    }
    const alerts = snap.val();
    let critical = 0, warning = 0, info = 0;
    for (let id in alerts) {
      if (alerts[id].level === "critical") critical++;
      else if (alerts[id].level === "warning") warning++;
      else info++;
    }
    container.innerHTML = `
      <div class="alert-counter critical"><h3>${critical}</h3><p>Critical Alerts</p></div>
      <div class="alert-counter warning"><h3>${warning}</h3><p>Warnings</p></div>
      <div class="alert-counter info"><h3>${info}</h3><p>Info</p></div>
    `;
  });
}
window.addEventListener("load", loadAlerts);




// ****** Market price ***** 
const AGMARK_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const AGMARK_BASE = "https://api.data.gov.in/resource/";
const AGMARK_API_KEY = "579b464db66ec23bdd0000014565b5ad5e4a414a517160d1f702a8a3";
function el(id) { return document.getElementById(id); }

function buildUrl(state, commodity) {
  const params = new URLSearchParams({
    "api-key": AGMARK_API_KEY,
    format: "json",
    limit: "500"
  });
  if (state && state !== "All India") params.append("filters[state]", state);
  if (commodity) params.append("filters[commodity]", commodity);
  return `${AGMARK_BASE}${AGMARK_RESOURCE_ID}?${params.toString()}`;
}

async function fetchMarketData(state, commodity) {
  const url = buildUrl(state, commodity);
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error: " + res.status);
  const json = await res.json();
  return json.records || [];
}

function renderTable(records) {
  if (!records.length) {
    el("marketResults").innerHTML = `<p>No data found for this crop/state.</p>`;
    return;
  }

  const rows = records.map(r => `
    <tr>
      <td>${r.market || "--"}</td>
      <td>${r.district || "--"}</td>
      <td>${r.variety || "--"}</td>
      <td class="price-min">₹ ${r.min_price || "--"}</td>
      <td class="price-max">₹ ${r.max_price || "--"}</td>
      <td class="price-modal">₹ ${r.modal_price || "--"}</td>
      <td>${r.arrival_date || "--"}</td>
    </tr>`).join("");

  el("marketResults").innerHTML = `
    <div class="result-meta">
      <span>Showing <strong>${records.length}</strong> records</span>
    </div>
    <table class="market-table">
      <thead>
        <tr>
          <th>Market</th>
          <th>District</th>
          <th>Variety</th>
          <th>Min Price</th>
          <th>Max Price</th>
          <th>Modal Price</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function handleSearch() {
  const crop = el("cropSearch").value.trim();
  const state = el("stateSelect").value;
  if (!crop) {
    el("marketResults").innerHTML = "<p>Please enter a crop name.</p>";
    return;
  }
  el("marketResults").innerHTML = "<p>Loading data...</p>";
  try {
    const records = await fetchMarketData(state, crop);
    renderTable(records.slice(0, 200));
  } catch (err) {
    el("marketResults").innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

el("searchBtn").addEventListener("click", handleSearch);

document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const cropInput = document.getElementById("cropSearch");
  const stateSelect = document.getElementById("stateSelect");
  const resultsDiv = document.getElementById("marketResults");

  if (!searchBtn) {
    console.error("❌ searchBtn not found in DOM");
    return;
  }

  searchBtn.addEventListener("click", async () => {
    const crop = cropInput.value.trim();
    const state = stateSelect.value.trim();

    if (!crop || !state) {
      resultsDiv.innerHTML = `<p style="color:red;">⚠ Please enter a crop and select a state.</p>`;
      return;
    }

    resultsDiv.innerHTML = `<p>🔄 Fetching latest market prices for <b>${crop}</b> in <b>${state}</b>...</p>`;

    try {
      // Example API call (replace with your real API key from data.gov.in)
      const response = await fetch(
        `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?format=json&filters[commodity]=${crop}&filters[state]=${state}&api-key=YOUR_API_KEY`
      );

      const data = await response.json();

      if (!data.records || data.records.length === 0) {
        resultsDiv.innerHTML = `<p>❌ No data found for ${crop} in ${state}.</p>`;
        return;
      }

      // Display results
      resultsDiv.innerHTML = data.records
        .map(
          (item) => `
          <div class="result-card">
            <h4>${item.commodity} (${item.state})</h4>
            <p><b>District:</b> ${item.district}</p>
            <p><b>Market:</b> ${item.market}</p>
            <p><b>Price:</b> ₹${item.modal_price} / ${item.unit_of_price}</p>
          </div>
        `
        )
        .join("");
    } catch (error) {
      resultsDiv.innerHTML = `<p style="color:red;">⚠ Error fetching data. Please try again later.</p>`;
      console.error(error);
    }
  });
});

// Weather module using Open-Meteo (no API key needed)
// Docs: https://open-meteo.com/ & https://open-meteo.com/en/docs/geocoding-api

const weather = (() => {
  const geocodeUrl = (q) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const forecastUrl = (lat, lon, tz) => 
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=${encodeURIComponent(tz)}`;

  const codeToEmoji = (code) => {
    // Mapping based on WMO weather interpretation codes
    // https://open-meteo.com/en/docs
    if ([0].includes(code)) return "☀️";
    if ([1,2].includes(code)) return "🌤️";
    if ([3].includes(code)) return "☁️";
    if ([45,48].includes(code)) return "🌫️";
    if ([51,53,55,56,57].includes(code)) return "🌦️";
    if ([61,63,65,66,67].includes(code)) return "🌧️";
    if ([71,73,75,77,85,86].includes(code)) return "❄️";
    if ([80,81,82].includes(code)) return "🌧️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "🌀";
  };

  const codeLabel = (code) => {
    const map = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      56: "Freezing drizzle", 57: "Dense freezing drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      66: "Freezing rain", 67: "Heavy freezing rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
      77: "Snow grains",
      80: "Rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      85: "Slight snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm w/ slight hail", 99: "Thunderstorm w/ heavy hail",
    };
    return map[code] || "Unknown";
  };

 const analyticsSection = document.getElementById("analytics");
const weatherContainer = analyticsSection ? analyticsSection.querySelector("#weather-section") : null;

const ui = {
    section: weatherContainer,
    form: weatherContainer ? weatherContainer.querySelector("#weather-form") : null,
    query: weatherContainer ? weatherContainer.querySelector("#weather-query") : null,
    status: weatherContainer ? weatherContainer.querySelector("#weather-status") : null,
    current: weatherContainer ? weatherContainer.querySelector("#weather-current") : null,
    daily: weatherContainer ? weatherContainer.querySelector("#weather-daily") : null,
};


  const fmt = (n, unit="") => (n === null || n === undefined) ? "-" : `${Math.round(n)}${unit}`;

  async function fetchWeather(q) {
    ui.status.textContent = "Finding location…";
    ui.current.innerHTML = "";
    ui.daily.innerHTML = "";

    try {
      const geoRes = await fetch(geocodeUrl(q));
      if (!geoRes.ok) throw new Error("Geocoding failed");
      const geo = await geoRes.json();
      if (!geo.results || !geo.results.length) {
        ui.status.textContent = "No matching location found. Try a different city/town name.";
        return;
      }
      const place = geo.results[0];
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

      ui.status.textContent = "Fetching forecast…";

      const fcRes = await fetch(forecastUrl(place.latitude, place.longitude, tz));
      if (!fcRes.ok) throw new Error("Forecast fetch failed");
      const fc = await fcRes.json();

      // Render current
      const c = fc.current;
      const emoji = codeToEmoji(c.weather_code);
      const label = codeLabel(c.weather_code);
      ui.current.innerHTML = `
        <div class="weather-card">
          <div class="weather-head">
            <div>
              <h3 class="weather-place">${place.name}${place.country ? ", " + place.country : ""}</h3>
              <p class="weather-time">${new Date(c.time).toLocaleString()}</p>
            </div>
            <div class="weather-emoji">${emoji}</div>
          </div>
          <div class="weather-grid">
            <div><span>${fmt(c.temperature_2m, "°C")}</span><label>Temp</label></div>
            <div><span>${fmt(c.apparent_temperature, "°C")}</span><label>Feels like</label></div>
            <div><span>${fmt(c.relative_humidity_2m, "%")}</span><label>Humidity</label></div>
            <div><span>${fmt(c.wind_speed_10m, " km/h")}</span><label>Wind</label></div>
            <div><span>${fmt(c.wind_direction_10m, "°")}</span><label>Wind Dir</label></div>
            <div><span>${label}</span><label>Condition</label></div>
          </div>
        </div>
      `;

      // Render daily
      const d = fc.daily;
      let rows = "";
      for (let i=0; i<d.time.length; i++) {
        const wcode = d.weather_code[i];
        rows += `
          <div class="day-row">
            <div class="dw-col">${new Date(d.time[i]).toLocaleDateString()}</div>
            <div class="dw-col">${codeToEmoji(wcode)} ${codeLabel(wcode)}</div>
            <div class="dw-col">${fmt(d.temperature_2m_max[i], "°C")} / ${fmt(d.temperature_2m_min[i], "°C")}</div>
            <div class="dw-col">${fmt(d.precipitation_probability_max[i], "%")}</div>
            <div class="dw-col">${fmt(d.precipitation_sum[i], " mm")}</div>
            <div class="dw-col">${fmt(d.wind_speed_10m_max[i], " km/h")}</div>
          </div>`;
      }
      ui.daily.innerHTML = `
        <div class="weather-table">
          <div class="day-row head">
            <div class="dw-col">Date</div>
            <div class="dw-col">Condition</div>
            <div class="dw-col">Max / Min</div>
            <div class="dw-col">Rain Chance</div>
            <div class="dw-col">Rain (sum)</div>
            <div class="dw-col">Wind (max)</div>
          </div>
          ${rows}
        </div>
      `;

      ui.status.textContent = "Forecast updated.";
    } catch (err) {
      console.error(err);
      ui.status.textContent = "Could not load weather. Please try again.";
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const q = ui.query.value.trim();
    if (!q) return;
    fetchWeather(q);
  }

  function init() {
    if (!ui.form) return;
    ui.form.addEventListener("submit", onSubmit);
    // Try to prefill with user's timezone country (fallback to 'Pune')
    ui.query.value = "Pune";
    fetchWeather(ui.query.value);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", weather.init);



/* ===================== Crop Guide & Smart Irrigation ===================== */
(function() {
  const resultsEl = () => document.getElementById('cropResults');
  const inputEl = () => document.getElementById('cropSearchInput');
  const areaEl = () => document.getElementById('areaValue');
  const unitEl = () => document.getElementById('areaUnit');

  let CROPS = [];

  function litersPerHaFromMM(mm) {
    // 1 mm over 1 ha = 10,000 liters
    return mm * 10000;
  }
  function haFrom(area, unit) {
    if (!area || isNaN(area)) return 0;
    return unit === 'acre' ? area * 0.40468564224 : area;
  }
  function formatRange(r, unit) {
    if (!r || r.length < 2) return '—';
    return `${r[0]}–${r[1]} ${unit}`;
  }

  async function loadCropData() {
    try {
      const resp = await fetch('data/crops.json', {cache: 'no-store'});
      if (!resp.ok) throw new Error('fetch failed');
      CROPS = await resp.json();
    } catch (e) {
      // Fallback to inline
      const inline = document.getElementById('cropData');
      if (inline) {
        CROPS = JSON.parse(inline.textContent.trim());
      }
    }
    buildDatalist();
  }

  function buildDatalist() {
    const dl = document.getElementById('cropDatalist');
    if (!dl) return;
    dl.innerHTML = (CROPS || []).map(c => `<option value="${c.name}">`).join('');
  }

  function searchCrops(q) {
    if (!q) return [];
    q = q.toLowerCase();
    return CROPS.filter(c => c.name.toLowerCase().includes(q));
  }

  function renderResults(list) {
    const el = resultsEl();
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="muted">No matching crops found.</div>';
      return;
    }
    const area = parseFloat(areaEl()?.value || '0');
    const unit = (unitEl()?.value) || 'hectare';
    const areaHa = haFrom(area, unit);

    el.innerHTML = list.map(c => {
      const wrMin = c.water_requirement_mm?.[0] ?? null;
      const wrMax = c.water_requirement_mm?.[1] ?? null;
      const wrText = formatRange(c.water_requirement_mm, 'mm/season');
      const ivText = formatRange(c.irrigation_interval_days, 'days');
      const tempText = formatRange(c.ideal_temp_c, '°C');
      const rainText = formatRange(c.rainfall_mm, 'mm/year');
      const phText = formatRange(c.ph_range, 'pH');

      let volumeBlock = '';
      if (areaHa > 0 && wrMin && wrMax) {
        const minLit = litersPerHaFromMM(wrMin) * areaHa;
        const maxLit = litersPerHaFromMM(wrMax) * areaHa;
        const toKL = v => (v/1000).toFixed(1);
        const toML = v => (v/1e6).toFixed(2);
        volumeBlock = `<div class="kv">
            <div><span>Total water (min):</span><b>${toML(minLit)} ML</b> <small>(${toKL(minLit)} kL)</small></div>
            <div><span>Total water (max):</span><b>${toML(maxLit)} ML</b> <small>(${toKL(maxLit)} kL)</small></div>
          </div>`;
      }

      return `
        <div class="card">
          <div class="card-content">
            <div class="card-title"><i class="fas fa-leaf"></i> ${c.name}</div>
            <div class="grid-3">
              <div>
                <div class="kv"><span>Season:</span><b>${c.season || '—'}</b></div>
                <div class="kv"><span>Water need:</span><b>${wrText}</b></div>
                <div class="kv"><span>Irrigation interval:</span><b>${ivText}</b></div>
              </div>
              <div>
                <div class="kv"><span>Ideal temp:</span><b>${tempText}</b></div>
                <div class="kv"><span>Rainfall:</span><b>${rainText}</b></div>
                <div class="kv"><span>Soil:</span><b>${c.soil || '—'}</b></div>
              </div>
              <div>
                <div class="kv"><span>pH range:</span><b>${phText}</b></div>
                <div class="kv"><span>Notes:</span><b>${c.notes || '—'}</b></div>
              </div>
            </div>
            ${volumeBlock}
          </div>
        </div>
      `;
    }).join('');
  }

  function handleSearch() {
    const q = inputEl()?.value?.trim();
    const res = searchCrops(q);
    renderResults(res.slice(0, 10));
  }

  function handleClear() {
    if (inputEl()) inputEl().value='';
    if (areaEl()) areaEl().value='';
    renderResults([]);
  }

  function wireUp() {
    const btn = document.getElementById('cropSearchBtn');
    const clr = document.getElementById('cropClearBtn');
    const input = inputEl();
    const area = areaEl();
    const unit = unitEl();
    if (btn) btn.addEventListener('click', handleSearch);
    if (clr) clr.addEventListener('click', handleClear);
    if (input) input.addEventListener('change', handleSearch);
    if (area) area.addEventListener('input', handleSearch);
    if (unit) unit.addEventListener('change', handleSearch);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCropData();
    wireUp();
  });
})();
