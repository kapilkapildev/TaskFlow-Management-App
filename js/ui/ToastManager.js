// Toast Notification System
export class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.maxToasts = 5;
        this.defaultDuration = 4000;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            console.warn('Toast container not found');
        }
        
        console.log('ToastManager initialized');
    }
    
    show(options) {
        const toastConfig = {
            id: this.generateId(),
            type: options.type || 'info', // info, success, warning, error
            title: options.title || '',
            message: options.message || '',
            duration: options.duration || this.defaultDuration,
            actions: options.actions || [],
            dismissible: options.dismissible !== false,
            persistent: options.persistent || false,
            ...options
        };
        
        // Remove oldest toast if we have too many
        if (this.toasts.size >= this.maxToasts) {
            const oldestId = this.toasts.keys().next().value;
            this.hide(oldestId);
        }
        
        // Create toast element
        const toastElement = this.createToastElement(toastConfig);
        
        // Add to container
        if (this.container) {
            this.container.appendChild(toastElement);
        }
        
        // Store toast
        this.toasts.set(toastConfig.id, {
            config: toastConfig,
            element: toastElement,
            timer: null
        });
        
        // Show animation
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });
        
        // Auto-hide if not persistent
        if (!toastConfig.persistent && toastConfig.duration > 0) {
            this.scheduleHide(toastConfig.id, toastConfig.duration);
        }
        
        console.log(`Toast shown: ${toastConfig.type} - ${toastConfig.title}`);
        
        return toastConfig.id;
    }
    
    createToastElement(config) {
        const toast = document.createElement('div');
        toast.className = `toast ${config.type}`;
        toast.dataset.toastId = config.id;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        // Create toast content
        let actionsHtml = '';
        if (config.actions && config.actions.length > 0) {
            actionsHtml = '<div class="toast-actions">' +
                config.actions.map(action => 
                    `<button class="toast-action" data-action="${action.action || 'dismiss'}">${action.label}</button>`
                ).join('') +
                '</div>';
        }
        
        const closeButton = config.dismissible ? 
            `<button class="toast-close" aria-label="Close notification">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>` : '';
        
        toast.innerHTML = `
            <div class="toast-content">
                ${config.title ? `<div class="toast-title">${this.escapeHtml(config.title)}</div>` : ''}
                ${config.message ? `<div class="toast-message">${this.escapeHtml(config.message)}</div>` : ''}
            </div>
            ${actionsHtml}
            ${closeButton}
        `;
        
        // Add event listeners
        this.addToastEventListeners(toast, config);
        
        return toast;
    }
    
    addToastEventListeners(toast, config) {
        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide(config.id);
            });
        }
        
        // Action buttons
        toast.querySelectorAll('.toast-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionName = e.target.dataset.action;
                this.handleToastAction(config.id, actionName, config);
            });
        });
        
        // Auto-dismiss on click (if not persistent)
        if (!config.persistent && config.dismissible) {
            toast.addEventListener('click', (e) => {
                if (!e.target.closest('.toast-action, .toast-close')) {
                    this.hide(config.id);
                }
            });
        }
        
        // Pause auto-hide on hover
        if (config.duration > 0) {
            toast.addEventListener('mouseenter', () => {
                this.pauseHide(config.id);
            });
            
            toast.addEventListener('mouseleave', () => {
                this.resumeHide(config.id);
            });
        }
    }
    
    handleToastAction(toastId, actionName, config) {
        // Find the action
        const action = config.actions?.find(a => (a.action || 'dismiss') === actionName);
        
        if (action && typeof action.action === 'function') {
            try {
                action.action();
            } catch (error) {
                console.error('Toast action error:', error);
            }
        }
        
        // Auto-dismiss after action (unless specified otherwise)
        if (!action || action.dismiss !== false) {
            this.hide(toastId);
        }
    }
    
    hide(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;
        
        // Clear timer
        if (toast.timer) {
            clearTimeout(toast.timer);
            toast.timer = null;
        }
        
        // Hide animation
        toast.element.classList.remove('show');
        
        // Remove after animation
        setTimeout(() => {
            if (toast.element && toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.toasts.delete(toastId);
        }, 300);
        
        console.log(`Toast hidden: ${toastId}`);
    }
    
    scheduleHide(toastId, duration) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;
        
        toast.timer = setTimeout(() => {
            this.hide(toastId);
        }, duration);
    }
    
    pauseHide(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast || !toast.timer) return;
        
        clearTimeout(toast.timer);
        toast.timer = null;
        toast.remainingTime = Date.now() - toast.startTime;
    }
    
    resumeHide(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast || toast.timer) return;
        
        const remainingTime = toast.remainingTime || toast.config.duration;
        this.scheduleHide(toastId, remainingTime);
    }
    
    // Predefined toast types
    success(title, message, options = {}) {
        return this.show({
            type: 'success',
            title,
            message,
            ...options
        });
    }
    
    error(title, message, options = {}) {
        return this.show({
            type: 'error',
            title,
            message,
            duration: 6000, // Longer for errors
            ...options
        });
    }
    
    warning(title, message, options = {}) {
        return this.show({
            type: 'warning',
            title,
            message,
            duration: 5000,
            ...options
        });
    }
    
    info(title, message, options = {}) {
        return this.show({
            type: 'info',
            title,
            message,
            ...options
        });
    }
    
    // Task-specific toasts
    taskCreated(task) {
        return this.success(
            'Task Created',
            `"${task.title}" has been created successfully!`
        );
    }
    
    taskUpdated(task) {
        return this.success(
            'Task Updated',
            `"${task.title}" has been updated.`
        );
    }
    
    taskDeleted(task, onUndo = null) {
        return this.show({
            type: 'success',
            title: 'Task Deleted',
            message: `"${task.title}" has been deleted.`,
            duration: 6000,
            actions: onUndo ? [{
                label: 'Undo',
                action: onUndo
            }] : []
        });
    }
    
    taskMoved(task, fromStatus, toStatus) {
        const statusNames = {
            todo: 'To Do',
            inProgress: 'In Progress',
            done: 'Done'
        };
        
        return this.info(
            'Task Moved',
            `"${task.title}" moved from ${statusNames[fromStatus]} to ${statusNames[toStatus]}.`
        );
    }
    
    syncSuccess(count) {
        return this.success(
            'Sync Complete',
            `Successfully synced ${count} tasks with server.`
        );
    }
    
    syncError() {
        return this.warning(
            'Sync Failed',
            'Unable to sync with server. Working offline.',
            { duration: 3000 }
        );
    }
    
    offlineMode() {
        return this.warning(
            'Offline Mode',
            'No internet connection. Changes will sync when connection is restored.',
            { persistent: true }
        );
    }
    
    // Utility methods
    hideAll() {
        Array.from(this.toasts.keys()).forEach(id => {
            this.hide(id);
        });
    }
    
    hideByType(type) {
        Array.from(this.toasts.values()).forEach(toast => {
            if (toast.config.type === type) {
                this.hide(toast.config.id);
            }
        });
    }
    
    getActiveToasts() {
        return Array.from(this.toasts.values()).map(toast => toast.config);
    }
    
    hasActiveToasts() {
        return this.toasts.size > 0;
    }
    
    // Configuration
    setMaxToasts(max) {
        this.maxToasts = Math.max(1, max);
    }
    
    setDefaultDuration(duration) {
        this.defaultDuration = Math.max(1000, duration);
    }
    
    // Helpers
    generateId() {
        return 'toast_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Testing helpers
    showTestToasts() {
        setTimeout(() => this.success('Success!', 'This is a success message'), 100);
        setTimeout(() => this.info('Information', 'This is an info message'), 600);
        setTimeout(() => this.warning('Warning!', 'This is a warning message'), 1100);
        setTimeout(() => this.error('Error!', 'This is an error message'), 1600);
    }
    
    // Cleanup
    destroy() {
        this.hideAll();
        this.toasts.clear();
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        console.log('ToastManager destroyed');
    }
}