// Animated Robot Background Canvas Controller
export class CanvasBackground {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.robots = [];
        this.isRunning = false;
        this.isPaused = false;
        this.animationId = null;
        
        this.config = {
            robotCount: 15,
            maxRobotCount: 25,
            minRobotCount: 5,
            speed: 0.5,
            maxSpeed: 2,
            spriteSize: 32,
            frameCount: 4,
            animationSpeed: 8
        };
        
        this.performance = {
            lastTime: 0,
            frameRate: 60,
            skipFrames: 0,
            maxSkipFrames: 3
        };
        
        // Robot sprite sheet will be created programmatically
        this.spriteSheet = null;
        
        this.boundHandlers = {
            resize: this.handleResize.bind(this),
            visibilityChange: this.handleVisibilityChange.bind(this)
        };
    }
    
    async init() {
        console.log('Initializing CanvasBackground...');
        
        this.canvas = document.getElementById('bg-canvas');
        if (!this.canvas) {
            console.warn('Canvas element not found');
            return false;
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.warn('Canvas context not available');
            return false;
        }
        
        // Check for reduced motion preference
        if (this.prefersReducedMotion()) {
            console.log('User prefers reduced motion, disabling background animation');
            this.canvas.style.display = 'none';
            return false;
        }
        
        // Set up canvas
        this.setupCanvas();
        
        // Create sprite sheet
        await this.createSpriteSheet();
        
        // Initialize robots
        this.initRobots();
        
        // Add event listeners
        this.addEventListeners();
        
        // Start animation
        this.start();
        
        console.log('CanvasBackground initialized successfully');
        return true;
    }
    
    setupCanvas() {
        // Set canvas size
        this.resize();
        
        // Set rendering options for better performance
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'low';
        
        // Set initial styles
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = '0.6';
    }
    
    async createSpriteSheet() {
        // Create a simple robot sprite sheet programmatically
        const spriteCanvas = document.createElement('canvas');
        const spriteCtx = spriteCanvas.getContext('2d');
        
        const size = this.config.spriteSize;
        const frames = this.config.frameCount;
        
        spriteCanvas.width = size * frames;
        spriteCanvas.height = size;
        
        // Create different robot frames
        for (let frame = 0; frame < frames; frame++) {
            const x = frame * size;
            
            // Clear frame area
            spriteCtx.clearRect(x, 0, size, size);
            
            // Robot body (main rectangle)
            spriteCtx.fillStyle = '#58C7D2';
            spriteCtx.fillRect(x + 8, 12, 16, 16);
            
            // Robot head
            spriteCtx.fillStyle = '#4FB3C2';
            spriteCtx.fillRect(x + 10, 6, 12, 8);
            
            // Eyes
            spriteCtx.fillStyle = '#FFFFFF';
            spriteCtx.fillRect(x + 12, 8, 2, 2);
            spriteCtx.fillRect(x + 18, 8, 2, 2);
            
            // Arms (animated based on frame)
            spriteCtx.fillStyle = '#58C7D2';
            const armOffset = Math.sin(frame * 0.5) * 2;
            spriteCtx.fillRect(x + 4, 14 + armOffset, 4, 8);
            spriteCtx.fillRect(x + 24, 14 - armOffset, 4, 8);
            
            // Legs (animated based on frame)
            const legOffset = Math.sin(frame * 0.8) * 1;
            spriteCtx.fillRect(x + 10, 24 + legOffset, 4, 6);
            spriteCtx.fillRect(x + 18, 24 - legOffset, 4, 6);
            
            // Antenna
            spriteCtx.strokeStyle = '#4FB3C2';
            spriteCtx.lineWidth = 1;
            spriteCtx.beginPath();
            spriteCtx.moveTo(x + 16, 6);
            spriteCtx.lineTo(x + 16 + Math.sin(frame * 0.3) * 2, 2);
            spriteCtx.stroke();
            
            // Antenna tip
            spriteCtx.fillStyle = '#FF6B81';
            spriteCtx.beginPath();
            spriteCtx.arc(x + 16 + Math.sin(frame * 0.3) * 2, 2, 1, 0, Math.PI * 2);
            spriteCtx.fill();
        }
        
        this.spriteSheet = spriteCanvas;
    }
    
    initRobots() {
        this.robots = [];
        
        const count = this.getOptimalRobotCount();
        
        for (let i = 0; i < count; i++) {
            this.robots.push(this.createRobot());
        }
        
        console.log(`Created ${this.robots.length} robots`);
    }
    
    createRobot() {
        const margin = 100; // Keep robots away from main content area
        
        return {
            x: Math.random() * (this.canvas.width - margin * 2) + margin,
            y: Math.random() * (this.canvas.height - margin * 2) + margin,
            vx: (Math.random() - 0.5) * this.config.speed * 2,
            vy: (Math.random() - 0.5) * this.config.speed * 2,
            frame: Math.floor(Math.random() * this.config.frameCount),
            frameTimer: Math.random() * this.config.animationSpeed,
            scale: 0.6 + Math.random() * 0.4, // Random size between 0.6 and 1.0
            alpha: 0.3 + Math.random() * 0.4, // Random opacity
            depth: Math.random() // For parallax effect
        };
    }
    
    getOptimalRobotCount() {
        // Adjust robot count based on screen size and performance
        const area = this.canvas.width * this.canvas.height;
        const density = area / 100000; // Adjust density based on screen area
        
        let count = Math.floor(density * this.config.robotCount);
        count = Math.max(this.config.minRobotCount, Math.min(this.config.maxRobotCount, count));
        
        // Reduce count on mobile devices
        if (window.innerWidth < 768) {
            count = Math.floor(count * 0.5);
        }
        
        return count;
    }
    
    addEventListeners() {
        window.addEventListener('resize', this.boundHandlers.resize);
        document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);
    }
    
    handleResize() {
        this.resize();
        
        // Adjust robot count based on new screen size
        const optimalCount = this.getOptimalRobotCount();
        
        if (this.robots.length < optimalCount) {
            // Add more robots
            while (this.robots.length < optimalCount) {
                this.robots.push(this.createRobot());
            }
        } else if (this.robots.length > optimalCount) {
            // Remove excess robots
            this.robots.splice(optimalCount);
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else if (this.isRunning) {
            this.resume();
        }
    }
    
    resize() {
        // Use device pixel ratio for crisp rendering
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limit to 2 for performance
        
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Set canvas size
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        
        // Scale canvas back down using CSS
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Scale the drawing context
        this.ctx.scale(dpr, dpr);
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.performance.lastTime = performance.now();
        
        this.animate();
        
        console.log('Background animation started');
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        console.log('Background animation stopped');
    }
    
    pause() {
        this.isPaused = true;
        this.canvas.classList.add('paused');
    }
    
    resume() {
        this.isPaused = false;
        this.canvas.classList.remove('paused');
        this.performance.lastTime = performance.now(); // Reset timing
    }
    
    toggle() {
        if (this.isRunning) {
            this.stop();
            return false;
        } else {
            this.start();
            return true;
        }
    }
    
    animate(currentTime = 0) {
        if (!this.isRunning) return;
        
        // Calculate delta time
        const deltaTime = currentTime - this.performance.lastTime;
        this.performance.lastTime = currentTime;
        
        // Skip frames for performance if needed
        const targetFrameTime = 1000 / this.performance.frameRate;
        if (deltaTime < targetFrameTime * 0.8) {
            this.performance.skipFrames++;
            if (this.performance.skipFrames < this.performance.maxSkipFrames) {
                this.animationId = requestAnimationFrame(this.animate.bind(this));
                return;
            }
        }
        this.performance.skipFrames = 0;
        
        // Update and render only if not paused
        if (!this.isPaused) {
            this.update(deltaTime);
            this.render();
        }
        
        // Schedule next frame
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
    
    update(deltaTime) {
        const speedMultiplier = deltaTime / 16; // Normalize to 60fps
        
        this.robots.forEach(robot => {
            // Update position
            robot.x += robot.vx * speedMultiplier;
            robot.y += robot.vy * speedMultiplier;
            
            // Bounce off edges with some margin
            const margin = 50;
            if (robot.x < margin || robot.x > this.canvas.width - margin) {
                robot.vx *= -1;
                robot.x = Math.max(margin, Math.min(this.canvas.width - margin, robot.x));
            }
            
            if (robot.y < margin || robot.y > this.canvas.height - margin) {
                robot.vy *= -1;
                robot.y = Math.max(margin, Math.min(this.canvas.height - margin, robot.y));
            }
            
            // Update animation frame
            robot.frameTimer += speedMultiplier;
            if (robot.frameTimer >= this.config.animationSpeed) {
                robot.frame = (robot.frame + 1) % this.config.frameCount;
                robot.frameTimer = 0;
            }
            
            // Subtle random movement variation
            if (Math.random() < 0.01) {
                robot.vx += (Math.random() - 0.5) * 0.1;
                robot.vy += (Math.random() - 0.5) * 0.1;
                
                // Limit speed
                const speed = Math.sqrt(robot.vx * robot.vx + robot.vy * robot.vy);
                if (speed > this.config.maxSpeed) {
                    robot.vx = (robot.vx / speed) * this.config.maxSpeed;
                    robot.vy = (robot.vy / speed) * this.config.maxSpeed;
                }
            }
        });
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.spriteSheet) return;
        
        // Sort robots by depth for parallax effect
        const sortedRobots = [...this.robots].sort((a, b) => a.depth - b.depth);
        
        // Render robots
        sortedRobots.forEach(robot => {
            this.ctx.save();
            
            // Apply parallax offset based on depth
            const parallaxX = robot.x + (robot.depth - 0.5) * 20;
            const parallaxY = robot.y + (robot.depth - 0.5) * 10;
            
            // Set alpha based on depth and robot alpha
            this.ctx.globalAlpha = robot.alpha * (0.3 + robot.depth * 0.7);
            
            // Apply scale
            const scale = robot.scale * (0.5 + robot.depth * 0.5);
            
            // Draw robot
            this.ctx.translate(parallaxX, parallaxY);
            this.ctx.scale(scale, scale);
            
            // Draw sprite frame
            const frameX = robot.frame * this.config.spriteSize;
            
            this.ctx.drawImage(
                this.spriteSheet,
                frameX, 0,
                this.config.spriteSize, this.config.spriteSize,
                -this.config.spriteSize / 2, -this.config.spriteSize / 2,
                this.config.spriteSize, this.config.spriteSize
            );
            
            this.ctx.restore();
        });
    }
    
    // Performance monitoring
    setPerformanceMode(mode) {
        switch (mode) {
            case 'high':
                this.config.robotCount = Math.min(this.config.maxRobotCount, 20);
                this.performance.frameRate = 60;
                this.performance.maxSkipFrames = 1;
                break;
                
            case 'medium':
                this.config.robotCount = Math.min(this.config.maxRobotCount, 15);
                this.performance.frameRate = 45;
                this.performance.maxSkipFrames = 2;
                break;
                
            case 'low':
                this.config.robotCount = Math.min(this.config.maxRobotCount, 10);
                this.performance.frameRate = 30;
                this.performance.maxSkipFrames = 3;
                break;
        }
        
        // Adjust current robots
        this.adjustRobotCount();
    }
    
    adjustRobotCount() {
        const targetCount = this.getOptimalRobotCount();
        
        if (this.robots.length < targetCount) {
            while (this.robots.length < targetCount) {
                this.robots.push(this.createRobot());
            }
        } else if (this.robots.length > targetCount) {
            this.robots.splice(targetCount);
        }
    }
    
    // Utility methods
    prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    
    getPerformanceInfo() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            robotCount: this.robots.length,
            frameRate: this.performance.frameRate,
            canvasSize: {
                width: this.canvas?.width || 0,
                height: this.canvas?.height || 0
            }
        };
    }
    
    destroy() {
        // Stop animation
        this.stop();
        
        // Remove event listeners
        window.removeEventListener('resize', this.boundHandlers.resize);
        document.removeEventListener('visibilitychange', this.boundHandlers.visibilityChange);
        
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Reset properties
        this.robots = [];
        this.spriteSheet = null;
        this.canvas = null;
        this.ctx = null;
        
        console.log('CanvasBackground destroyed');
    }
}