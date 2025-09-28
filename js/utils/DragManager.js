// High-Performance Drag and Drop Manager
export class DragManager {
    constructor() {
        this.isDragging = false;
        this.dragData = null;
        this.dragElement = null;
        this.dragClone = null;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
        this.rafId = null;
        
        this.callbacks = {
            onDragStart: null,
            onDragMove: null,
            onDragEnd: null
        };
        
        this.boundHandlers = {
            pointerDown: this.handlePointerDown.bind(this),
            pointerMove: this.handlePointerMove.bind(this),
            pointerUp: this.handlePointerUp.bind(this),
            keyDown: this.handleKeyDown.bind(this)
        };
        
        this.dragThreshold = 5; // Minimum pixels to start drag
        this.isPointerDown = false;
    }
    
    init(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        
        // Add global event listeners
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        
        console.log('DragManager initialized');
    }
    
    makeDraggable(element) {
        if (!element) return;
        
        element.style.cursor = 'grab';
        element.draggable = false; // Disable native drag
        
        // Add data attribute for identification
        if (!element.dataset.draggable) {
            element.dataset.draggable = 'true';
        }
        
        // Remove existing listeners to avoid duplicates
        element.removeEventListener('pointerdown', this.boundHandlers.pointerDown);
        
        // Add pointer event listener
        element.addEventListener('pointerdown', this.boundHandlers.pointerDown);
        
        // Prevent default drag behavior
        element.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    handlePointerDown(e) {
        // Only handle left mouse button
        if (e.button !== 0) return;
        
        // Ignore if clicking on buttons or form elements
        if (this.isInteractiveElement(e.target)) return;
        
        e.preventDefault();
        
        this.isPointerDown = true;
        this.dragElement = e.currentTarget;
        
        // Store initial position
        this.startPos = { x: e.clientX, y: e.clientY };
        this.currentPos = { x: e.clientX, y: e.clientY };
        
        // Calculate offset from element's top-left corner
        const rect = this.dragElement.getBoundingClientRect();
        this.offset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Add temporary event listeners
        document.addEventListener('pointermove', this.boundHandlers.pointerMove);
        document.addEventListener('pointerup', this.boundHandlers.pointerUp);
        
        // Set pointer capture
        this.dragElement.setPointerCapture(e.pointerId);
        
        // Change cursor
        this.dragElement.style.cursor = 'grabbing';
    }
    
    handlePointerMove(e) {
        if (!this.isPointerDown) return;
        
        this.currentPos = { x: e.clientX, y: e.clientY };
        
        // Check if we've moved enough to start dragging
        const distance = Math.sqrt(
            Math.pow(this.currentPos.x - this.startPos.x, 2) +
            Math.pow(this.currentPos.y - this.startPos.y, 2)
        );
        
        if (!this.isDragging && distance > this.dragThreshold) {
            this.startDrag(e);
        }
        
        if (this.isDragging) {
            e.preventDefault();
            this.updateDragPosition();
        }
    }
    
    handlePointerUp(e) {
        if (this.isDragging) {
            this.endDrag(e);
        } else {
            this.cancelDrag();
        }
        
        this.cleanup();
    }
    
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.isDragging) {
            this.cancelDrag();
            this.cleanup();
        }
    }
    
    startDrag(e) {
        this.isDragging = true;
        
        // Create drag data
        this.dragData = {
            element: this.dragElement,
            startPos: { ...this.startPos },
            currentPos: { ...this.currentPos }
        };
        
        // Create drag clone
        this.createDragClone();
        
        // Add drag placeholder to original element
        this.dragElement.classList.add('drag-placeholder');
        
        // Call start callback
        if (this.callbacks.onDragStart) {
            const result = this.callbacks.onDragStart(this.dragElement);
            if (result) {
                this.dragData = { ...this.dragData, ...result };
            }
        }
        
        // Disable text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        
        // Start RAF loop for smooth updates
        this.startRAFLoop();
        
        console.log('Drag started');
    }
    
    createDragClone() {
        // Clone the original element
        this.dragClone = this.dragElement.cloneNode(true);
        
        // Position the clone
        const rect = this.dragElement.getBoundingClientRect();
        
        this.dragClone.style.position = 'fixed';
        this.dragClone.style.top = rect.top + 'px';
        this.dragClone.style.left = rect.left + 'px';
        this.dragClone.style.width = rect.width + 'px';
        this.dragClone.style.height = rect.height + 'px';
        this.dragClone.style.zIndex = '9999';
        this.dragClone.style.pointerEvents = 'none';
        this.dragClone.style.opacity = '0.9';
        this.dragClone.style.transform = 'rotate(2deg) scale(1.02)';
        this.dragClone.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
        this.dragClone.style.willChange = 'transform';
        
        // Add dragging class
        this.dragClone.classList.add('dragging');
        this.dragClone.classList.remove('drag-placeholder');
        
        // Remove any event listeners from clone
        this.dragClone.querySelectorAll('*').forEach(el => {
            el.style.pointerEvents = 'none';
        });
        
        // Add to document
        document.body.appendChild(this.dragClone);
    }
    
    updateDragPosition() {
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                
                if (this.dragClone) {
                    // Calculate new position
                    const x = this.currentPos.x - this.offset.x;
                    const y = this.currentPos.y - this.offset.y;
                    
                    // Use transform for better performance
                    this.dragClone.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(2deg) scale(1.02)`;
                }
                
                // Call move callback
                if (this.callbacks.onDragMove) {
                    const moveData = this.callbacks.onDragMove(this.dragData, {
                        x: this.currentPos.x,
                        y: this.currentPos.y
                    });
                    
                    if (moveData) {
                        this.dragData = { ...this.dragData, ...moveData };
                    }
                }
            });
        }
    }
    
    startRAFLoop() {
        const loop = () => {
            if (this.isDragging) {
                this.updateDragPosition();
                requestAnimationFrame(loop);
            }
        };
        requestAnimationFrame(loop);
    }
    
    endDrag(e) {
        console.log('Drag ended');
        
        // Call end callback
        if (this.callbacks.onDragEnd) {
            this.callbacks.onDragEnd(this.dragData, this.dragData);
        }
        
        // Animate clone back or remove it
        this.animateCloneEnd();
    }
    
    cancelDrag() {
        console.log('Drag cancelled');
        
        // Remove drag placeholder
        if (this.dragElement) {
            this.dragElement.classList.remove('drag-placeholder');
        }
        
        // Animate clone back to original position
        this.animateCloneCancel();
    }
    
    animateCloneEnd() {
        if (!this.dragClone) return;
        
        // Add transition for smooth snap
        this.dragClone.style.transition = 'all 0.2s cubic-bezier(0.2, 0.9, 0.2, 1)';
        this.dragClone.style.opacity = '0';
        this.dragClone.style.transform = 'scale(0.8) rotate(0deg)';
        
        setTimeout(() => {
            this.removeDragClone();
            this.removeDragPlaceholder();
        }, 200);
    }
    
    animateCloneCancel() {
        if (!this.dragClone) return;
        
        // Get original position
        const originalRect = this.dragElement.getBoundingClientRect();
        
        // Animate back to original position
        this.dragClone.style.transition = 'all 0.3s cubic-bezier(0.2, 0.9, 0.2, 1)';
        this.dragClone.style.transform = `translate3d(${originalRect.left}px, ${originalRect.top}px, 0) scale(1) rotate(0deg)`;
        this.dragClone.style.opacity = '0.5';
        
        setTimeout(() => {
            this.removeDragClone();
            this.removeDragPlaceholder();
        }, 300);
    }
    
    removeDragClone() {
        if (this.dragClone) {
            this.dragClone.remove();
            this.dragClone = null;
        }
    }
    
    removeDragPlaceholder() {
        if (this.dragElement) {
            this.dragElement.classList.remove('drag-placeholder');
        }
    }
    
    cleanup() {
        // Cancel RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        // Remove event listeners
        document.removeEventListener('pointermove', this.boundHandlers.pointerMove);
        document.removeEventListener('pointerup', this.boundHandlers.pointerUp);
        
        // Reset cursor
        if (this.dragElement) {
            this.dragElement.style.cursor = 'grab';
        }
        
        // Restore text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        
        // Reset state
        this.isDragging = false;
        this.isPointerDown = false;
        this.dragData = null;
        this.dragElement = null;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
    }
    
    isInteractiveElement(element) {
        const interactiveTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'];
        const interactiveRoles = ['button', 'link', 'textbox', 'combobox'];
        
        // Check element tag
        if (interactiveTags.includes(element.tagName)) {
            return true;
        }
        
        // Check role attribute
        if (interactiveRoles.includes(element.getAttribute('role'))) {
            return true;
        }
        
        // Check if element is clickable
        if (element.onclick || element.style.cursor === 'pointer') {
            return true;
        }
        
        // Check parent elements
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            if (parent.classList.contains('task-action') || 
                parent.classList.contains('modal-close') ||
                parent.tagName === 'BUTTON') {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    }
    
    destroy() {
        // Remove global event listeners
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        
        // Cancel any ongoing drag
        if (this.isDragging) {
            this.cancelDrag();
        }
        
        this.cleanup();
        
        // Remove draggable elements
        document.querySelectorAll('[data-draggable]').forEach(element => {
            element.removeEventListener('pointerdown', this.boundHandlers.pointerDown);
            element.style.cursor = '';
            element.draggable = true;
        });
        
        console.log('DragManager destroyed');
    }
    
    // Static helper methods
    static getDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + 
            Math.pow(pos2.y - pos1.y, 2)
        );
    }
    
    static isPointInRect(point, rect) {
        return (
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom
        );
    }
}