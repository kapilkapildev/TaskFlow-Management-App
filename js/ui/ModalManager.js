// Modal Management System
export class ModalManager {
    constructor() {
        this.taskManager = null;
        this.uiManager = null;
        this.activeModals = new Map();
        this.focusStack = [];
        this.currentTask = null;
        
        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            outsideClick: this.handleOutsideClick.bind(this)
        };
    }
    
    init(taskManager, uiManager) {
        this.taskManager = taskManager;
        this.uiManager = uiManager;
        
        this.setupEventListeners();
        console.log('ModalManager initialized');
    }
    
    setupEventListeners() {
        // Task form submission
        const taskForm = document.getElementById('taskForm');
        taskForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskFormSubmit();
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Cancel buttons
        document.getElementById('cancelTaskBtn')?.addEventListener('click', () => {
            this.closeModal('taskModal');
        });
        
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
            this.closeModal('deleteModal');
        });
        
        // Delete confirmation
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
            this.handleDeleteConfirmation();
        });
        
        // Global event listeners
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('click', this.boundHandlers.outsideClick);
    }
    
    // Task Modal Methods
    openCreateModal(defaultStatus = 'todo') {
        this.currentTask = null;
        
        // Set modal title
        document.getElementById('modalTitle').textContent = 'Create New Task';
        document.getElementById('saveTaskBtn').querySelector('.btn-text').textContent = 'Create Task';
        
        // Clear form
        this.clearTaskForm();
        
        // Set default status
        const statusSelect = document.getElementById('taskStatus');
        if (statusSelect) {
            statusSelect.value = defaultStatus;
        }
        
        // Open modal
        this.openModal('taskModal');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('taskTitle')?.focus();
        }, 100);
    }
    
    openEditModal(task) {
        this.currentTask = task;
        
        // Set modal title
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('saveTaskBtn').querySelector('.btn-text').textContent = 'Update Task';
        
        // Fill form with task data
        this.fillTaskForm(task);
        
        // Open modal
        this.openModal('taskModal');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('taskTitle')?.focus();
            document.getElementById('taskTitle')?.select();
        }, 100);
    }
    
    fillTaskForm(task) {
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskCategory').value = task.category || '';
        document.getElementById('taskPriority').value = task.priority || 'Medium';
        document.getElementById('taskStatus').value = task.status || 'todo';
        
        // Handle due date
        if (task.dueDate) {
            const date = new Date(task.dueDate);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            document.getElementById('taskDueDate').value = localDate.toISOString().slice(0, 16);
        } else {
            document.getElementById('taskDueDate').value = '';
        }
    }
    
    clearTaskForm() {
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskCategory').value = '';
        document.getElementById('taskPriority').value = 'Medium';
        document.getElementById('taskStatus').value = 'todo';
        document.getElementById('taskDueDate').value = '';
        
        // Clear validation states
        document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
            input.classList.remove('error');
        });
    }
    
    async handleTaskFormSubmit() {
        const formData = this.getTaskFormData();
        
        // Validate form
        const validation = this.validateTaskForm(formData);
        if (!validation.valid) {
            this.showFormErrors(validation.errors);
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = document.getElementById('saveTaskBtn');
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            
            if (this.currentTask) {
                // Update existing task
                await this.taskManager.updateTask(this.currentTask.id, formData);
            } else {
                // Create new task
                await this.taskManager.createTask(formData);
            }
            
            // Close modal
            this.closeModal('taskModal');
            
        } catch (error) {
            console.error('Failed to save task:', error);
            
            // Show error message
            this.showFormError('Failed to save task. Please try again.');
            
        } finally {
            // Reset button state
            const submitBtn = document.getElementById('saveTaskBtn');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    }
    
    getTaskFormData() {
        return {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            category: document.getElementById('taskCategory').value.trim(),
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            dueDate: document.getElementById('taskDueDate').value || null
        };
    }
    
    validateTaskForm(data) {
        const errors = [];
        
        if (!data.title) {
            errors.push({ field: 'taskTitle', message: 'Task title is required' });
        }
        
        if (data.title && data.title.length > 200) {
            errors.push({ field: 'taskTitle', message: 'Task title must be less than 200 characters' });
        }
        
        if (data.description && data.description.length > 1000) {
            errors.push({ field: 'taskDescription', message: 'Description must be less than 1000 characters' });
        }
        
        if (data.category && data.category.length > 50) {
            errors.push({ field: 'taskCategory', message: 'Category must be less than 50 characters' });
        }
        
        // Validate due date
        if (data.dueDate) {
            const dueDate = new Date(data.dueDate);
            if (isNaN(dueDate.getTime())) {
                errors.push({ field: 'taskDueDate', message: 'Invalid due date' });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    showFormErrors(errors) {
        // Clear previous errors
        document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
            input.classList.remove('error');
        });
        
        // Show new errors
        errors.forEach(error => {
            const field = document.getElementById(error.field);
            if (field) {
                field.classList.add('error');
                field.setAttribute('aria-describedby', `${error.field}-error`);
                
                // Create or update error message
                let errorMsg = document.getElementById(`${error.field}-error`);
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.id = `${error.field}-error`;
                    errorMsg.className = 'form-error';
                    errorMsg.setAttribute('role', 'alert');
                    field.parentNode.appendChild(errorMsg);
                }
                errorMsg.textContent = error.message;
            }
        });
        
        // Focus first error field
        if (errors.length > 0) {
            const firstErrorField = document.getElementById(errors[0].field);
            firstErrorField?.focus();
        }
    }
    
    showFormError(message) {
        // Show general form error
        let errorContainer = document.querySelector('.form-error-general');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'form-error-general alert alert-error';
            errorContainer.setAttribute('role', 'alert');
            
            const form = document.getElementById('taskForm');
            form.insertBefore(errorContainer, form.firstChild);
        }
        
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // Hide after delay
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    }
    
    // Delete Modal Methods
    openDeleteModal(task) {
        this.currentTask = task;
        
        // Update task preview
        const preview = document.getElementById('deleteTaskPreview');
        if (preview) {
            preview.innerHTML = `
                <div class="task-preview-content">
                    <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                    ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
                    <div class="task-meta">
                        ${task.category ? `<span class="task-category">${this.escapeHtml(task.category)}</span>` : ''}
                        <span class="task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span>
                    </div>
                </div>
            `;
        }
        
        // Open modal
        this.openModal('deleteModal');
        
        // Focus delete button
        setTimeout(() => {
            document.getElementById('confirmDeleteBtn')?.focus();
        }, 100);
    }
    
    async handleDeleteConfirmation() {
        if (!this.currentTask) return;
        
        try {
            // Show loading state
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            deleteBtn.disabled = true;
            deleteBtn.classList.add('loading');
            
            // Delete task
            await this.taskManager.deleteTask(this.currentTask.id);
            
            // Close modal
            this.closeModal('deleteModal');
            
        } catch (error) {
            console.error('Failed to delete task:', error);
            
            // Show error (could enhance with toast notification)
            alert('Failed to delete task. Please try again.');
            
        } finally {
            // Reset button state
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('loading');
        }
    }
    
    // Modal Control Methods
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        // Store current focus
        this.focusStack.push(document.activeElement);
        
        // Show modal
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        
        // Trap focus
        this.trapFocus(modal);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Store in active modals
        this.activeModals.set(modalId, {
            element: modal,
            openTime: Date.now()
        });
        
        console.log(`Modal opened: ${modalId}`);
        return true;
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        // Hide modal
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        
        // Restore focus
        if (this.focusStack.length > 0) {
            const previousFocus = this.focusStack.pop();
            if (previousFocus && typeof previousFocus.focus === 'function') {
                setTimeout(() => {
                    previousFocus.focus();
                }, 100);
            }
        }
        
        // Enable body scroll if no modals are open
        if (this.activeModals.size <= 1) {
            document.body.style.overflow = '';
        }
        
        // Remove from active modals
        this.activeModals.delete(modalId);
        
        // Clear current task
        this.currentTask = null;
        
        // Clear form errors
        this.clearFormErrors();
        
        console.log(`Modal closed: ${modalId}`);
        return true;
    }
    
    closeAll() {
        Array.from(this.activeModals.keys()).forEach(modalId => {
            this.closeModal(modalId);
        });
    }
    
    isModalOpen(modalId = null) {
        if (modalId) {
            return this.activeModals.has(modalId);
        }
        return this.activeModals.size > 0;
    }
    
    // Focus Management
    trapFocus(modal) {
        const focusableElements = this.getFocusableElements(modal);
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Focus first element
        setTimeout(() => {
            firstElement.focus();
        }, 100);
        
        // Handle tab navigation
        const handleTab = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        modal.addEventListener('keydown', handleTab);
        
        // Store cleanup function
        modal._focusTrapCleanup = () => {
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
        
        return Array.from(container.querySelectorAll(selector))
            .filter(el => el.offsetParent !== null); // Only visible elements
    }
    
    // Event Handlers
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.activeModals.size > 0) {
            e.preventDefault();
            
            // Close topmost modal
            const modalIds = Array.from(this.activeModals.keys());
            const topModalId = modalIds[modalIds.length - 1];
            this.closeModal(topModalId);
        }
    }
    
    handleOutsideClick(e) {
        if (this.activeModals.size === 0) return;
        
        // Check if click is outside modal content
        const modalContent = e.target.closest('.modal');
        if (!modalContent && e.target.classList.contains('modal-overlay')) {
            // Find which modal was clicked
            const modalId = e.target.id;
            if (modalId && this.activeModals.has(modalId)) {
                this.closeModal(modalId);
            }
        }
    }
    
    // Utility Methods
    clearFormErrors() {
        // Clear field errors
        document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
            input.classList.remove('error');
            input.removeAttribute('aria-describedby');
        });
        
        // Clear error messages
        document.querySelectorAll('.form-error').forEach(error => {
            error.remove();
        });
        
        // Hide general error
        const generalError = document.querySelector('.form-error-general');
        if (generalError) {
            generalError.style.display = 'none';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Cleanup
    destroy() {
        // Close all modals
        this.closeAll();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        document.removeEventListener('click', this.boundHandlers.outsideClick);
        
        // Clear focus trap cleanups
        this.activeModals.forEach(modal => {
            if (modal.element._focusTrapCleanup) {
                modal.element._focusTrapCleanup();
            }
        });
        
        // Clear state
        this.activeModals.clear();
        this.focusStack = [];
        this.currentTask = null;
        
        console.log('ModalManager destroyed');
    }
}