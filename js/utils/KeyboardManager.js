// Keyboard Shortcuts and Accessibility Manager
export class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.callbacks = {};
        this.focusTracker = null;
        this.modalStack = [];
        
        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            focusIn: this.handleFocusIn.bind(this),
            focusOut: this.handleFocusOut.bind(this)
        };
        
        this.isEnabled = true;
    }
    
    init(callbacks = {}) {
        this.callbacks = callbacks;
        this.setupDefaultShortcuts();
        this.addEventListeners();
        
        console.log('KeyboardManager initialized with shortcuts:', Array.from(this.shortcuts.keys()));
    }
    
    setupDefaultShortcuts() {
        // Task management shortcuts
        this.addShortcut('ctrl+n', 'onCreateTask', 'Create new task');
        this.addShortcut('ctrl+d', 'onDeleteTask', 'Delete selected task');
        this.addShortcut('ctrl+f', 'onSearch', 'Focus search');
        this.addShortcut('escape', 'onEscape', 'Cancel/Close');
        this.addShortcut('ctrl+s', 'onSave', 'Save changes');
        this.addShortcut('ctrl+z', 'onUndo', 'Undo last action');
        this.addShortcut('ctrl+shift+z', 'onRedo', 'Redo action');
        
        // Navigation shortcuts
        this.addShortcut('ctrl+1', () => this.focusColumn('todo'), 'Focus To Do column');
        this.addShortcut('ctrl+2', () => this.focusColumn('inProgress'), 'Focus In Progress column');
        this.addShortcut('ctrl+3', () => this.focusColumn('done'), 'Focus Done column');
        
        // Modal shortcuts
        this.addShortcut('enter', 'onEnter', 'Confirm/Submit', { modal: true });
        this.addShortcut('tab', 'onTab', 'Navigate fields', { modal: true });
        this.addShortcut('shift+tab', 'onShiftTab', 'Navigate backwards', { modal: true });
        
        // Accessibility shortcuts
        this.addShortcut('alt+h', () => this.showShortcutsHelp(), 'Show shortcuts help');
        this.addShortcut('alt+s', () => this.toggleSidebar(), 'Toggle sidebar');
        
        // Quick filters
        this.addShortcut('alt+1', () => this.quickFilter('all'), 'Show all tasks');
        this.addShortcut('alt+2', () => this.quickFilter('todo'), 'Show todo tasks');
        this.addShortcut('alt+3', () => this.quickFilter('inProgress'), 'Show in progress tasks');
        this.addShortcut('alt+4', () => this.quickFilter('done'), 'Show completed tasks');
    }
    
    addEventListeners() {
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);
        document.addEventListener('focusin', this.boundHandlers.focusIn);
        document.addEventListener('focusout', this.boundHandlers.focusOut);
    }
    
    addShortcut(key, callback, description, options = {}) {
        const shortcutKey = this.normalizeKey(key);
        
        this.shortcuts.set(shortcutKey, {
            callback,
            description,
            options,
            key: shortcutKey
        });
    }
    
    removeShortcut(key) {
        const shortcutKey = this.normalizeKey(key);
        this.shortcuts.delete(shortcutKey);
    }
    
    normalizeKey(key) {
        return key.toLowerCase()
            .replace(/\s+/g, '')
            .split('+')
            .sort((a, b) => {
                // Sort modifiers first
                const modifierOrder = ['ctrl', 'alt', 'shift', 'meta'];
                const aIndex = modifierOrder.indexOf(a);
                const bIndex = modifierOrder.indexOf(b);
                
                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                
                return a.localeCompare(b);
            })
            .join('+');
    }
    
    getKeyFromEvent(event) {
        const parts = [];
        
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        
        let key = event.key.toLowerCase();
        
        // Handle special keys
        const keyMap = {
            ' ': 'space',
            'arrowup': 'up',
            'arrowdown': 'down',
            'arrowleft': 'left',
            'arrowright': 'right'
        };
        
        if (keyMap[key]) {
            key = keyMap[key];
        }
        
        parts.push(key);
        
        return parts.join('+');
    }
    
    handleKeyDown(event) {
        if (!this.isEnabled) return;
        
        const key = this.getKeyFromEvent(event);
        const shortcut = this.shortcuts.get(key);
        
        if (!shortcut) return;
        
        // Check if we're in a modal and if the shortcut is modal-appropriate
        const inModal = this.isInModal();
        
        // Skip shortcuts in input fields unless specifically allowed
        if (this.isInInputField(event.target) && !this.isAllowedInInput(key)) {
            return;
        }
        
        // Handle modal-specific shortcuts
        if (inModal && shortcut.options.modal !== true && !this.isGlobalShortcut(key)) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        // Execute callback
        if (typeof shortcut.callback === 'string') {
            const callbackName = shortcut.callback;
            if (this.callbacks[callbackName]) {
                this.callbacks[callbackName](event);
            }
        } else if (typeof shortcut.callback === 'function') {
            shortcut.callback(event);
        }
        
        console.log(`Executed shortcut: ${key} - ${shortcut.description}`);
    }
    
    handleKeyUp(event) {
        // Handle any key up events if needed
    }
    
    handleFocusIn(event) {
        this.focusTracker = {
            element: event.target,
            timestamp: Date.now()
        };
        
        // Update focus indicators
        this.updateFocusIndicators();
    }
    
    handleFocusOut(event) {
        // Handle focus out events
    }
    
    isInModal() {
        const modals = document.querySelectorAll('.modal-overlay.show');
        return modals.length > 0;
    }
    
    isInInputField(element) {
        const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
        const editableElements = element.contentEditable === 'true';
        
        return inputTypes.includes(element.tagName) || editableElements;
    }
    
    isAllowedInInput(key) {
        // Allow certain shortcuts even in input fields
        const allowedKeys = ['escape', 'enter', 'tab', 'shift+tab', 'ctrl+s', 'ctrl+z'];
        return allowedKeys.includes(key);
    }
    
    isGlobalShortcut(key) {
        // Global shortcuts that work everywhere
        const globalKeys = ['escape', 'ctrl+f', 'alt+h', 'alt+s'];
        return globalKeys.includes(key);
    }
    
    // Focus Management
    focusColumn(status) {
        const column = document.querySelector(`[data-status="${status}"]`);
        if (column) {
            const firstTask = column.querySelector('.task-card');
            if (firstTask) {
                firstTask.focus();
            } else {
                column.focus();
            }
        }
    }
    
    updateFocusIndicators() {
        // Remove previous focus indicators
        document.querySelectorAll('.keyboard-focused').forEach(el => {
            el.classList.remove('keyboard-focused');
        });
        
        // Add focus indicator to current element
        if (this.focusTracker && this.focusTracker.element) {
            this.focusTracker.element.classList.add('keyboard-focused');
        }
    }
    
    // Tab Management for Modals
    trapFocus(modal) {
        const focusableElements = this.getFocusableElements(modal);
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Focus first element
        firstElement.focus();
        
        // Handle tab navigation within modal
        const handleTab = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab: go to previous element
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab: go to next element
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        modal.addEventListener('keydown', handleTab);
        
        // Return cleanup function
        return () => {
            modal.removeEventListener('keydown', handleTab);
        };
    }
    
    getFocusableElements(container) {
        const selector = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(', ');
        
        return Array.from(container.querySelectorAll(selector));
    }
    
    // Quick Actions
    quickFilter(status) {
        // Trigger filter change
        const filterSelect = document.getElementById('statusFilter');
        if (filterSelect) {
            filterSelect.value = status === 'all' ? '' : status;
            filterSelect.dispatchEvent(new Event('change'));
        }
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }
    
    showShortcutsHelp() {
        const shortcuts = Array.from(this.shortcuts.entries())
            .filter(([, shortcut]) => shortcut.description)
            .map(([key, shortcut]) => ({ key, ...shortcut }))
            .sort((a, b) => a.description.localeCompare(b.description));
        
        const helpContent = shortcuts.map(shortcut => 
            `<div class="shortcut-item">
                <kbd>${shortcut.key}</kbd>
                <span>${shortcut.description}</span>
            </div>`
        ).join('');
        
        // Create or update help modal
        this.showModal('Keyboard Shortcuts', helpContent);
    }
    
    showModal(title, content) {
        // Remove existing help modal
        const existingModal = document.getElementById('shortcutsHelpModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create new modal
        const modal = document.createElement('div');
        modal.id = 'shortcutsHelpModal';
        modal.className = 'modal-overlay show';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" aria-label="Close help">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-help">
                        ${content}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add close handlers
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal;
        
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn?.addEventListener('click', closeModal);
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        
        // Trap focus
        this.trapFocus(modal.querySelector('.modal'));
        
        // Auto-close on escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
    }
    
    // Accessibility Helpers
    announceToScreenReader(message) {
        const announcer = document.getElementById('sr-announcer') || this.createScreenReaderAnnouncer();
        announcer.textContent = message;
        
        // Clear after a delay
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }
    
    createScreenReaderAnnouncer() {
        const announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.position = 'absolute';
        announcer.style.left = '-10000px';
        announcer.style.width = '1px';
        announcer.style.height = '1px';
        announcer.style.overflow = 'hidden';
        
        document.body.appendChild(announcer);
        return announcer;
    }
    
    // Utility Methods
    enable() {
        this.isEnabled = true;
    }
    
    disable() {
        this.isEnabled = false;
    }
    
    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([key, shortcut]) => ({
            key,
            ...shortcut
        }));
    }
    
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        document.removeEventListener('keyup', this.boundHandlers.keyUp);
        document.removeEventListener('focusin', this.boundHandlers.focusIn);
        document.removeEventListener('focusout', this.boundHandlers.focusOut);
        
        // Remove screen reader announcer
        const announcer = document.getElementById('sr-announcer');
        if (announcer) {
            announcer.remove();
        }
        
        // Clear shortcuts
        this.shortcuts.clear();
        this.callbacks = {};
        
        console.log('KeyboardManager destroyed');
    }
}