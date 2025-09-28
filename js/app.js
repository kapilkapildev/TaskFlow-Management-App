// Main Application Entry Point
import { TaskManager } from './store/TaskManager.js';
import { DragManager } from './utils/DragManager.js';
import { KeyboardManager } from './utils/KeyboardManager.js';
import { CanvasBackground } from './bg/CanvasBackground.js';
import { UIManager } from './ui/UIManager.js';
import { ToastManager } from './ui/ToastManager.js';
import { ModalManager } from './ui/ModalManager.js';
import { FilterManager } from './ui/FilterManager.js';

class TaskFlowApp {
    constructor() {
        this.taskManager = new TaskManager();
        this.dragManager = new DragManager();
        this.keyboardManager = new KeyboardManager();
        this.canvasBackground = new CanvasBackground();
        this.uiManager = new UIManager();
        this.toastManager = new ToastManager();
        this.modalManager = new ModalManager();
        this.filterManager = new FilterManager();
        
        this.selectedTaskId = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            // Show loading overlay
            this.showLoading();
            
            // Initialize components
            await this.initializeComponents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Hide loading overlay
            this.hideLoading();
            
            this.isInitialized = true;
            
            // Show welcome message
            this.toastManager.show({
                type: 'success',
                title: 'Welcome to TaskFlow',
                message: 'Your tasks have been loaded successfully!'
            });
            
            console.log('TaskFlow initialized successfully');
        } catch (error) {
            console.error('Failed to initialize TaskFlow:', error);
            this.toastManager.show({
                type: 'error',
                title: 'Initialization Error',
                message: 'Failed to load TaskFlow. Please refresh the page.'
            });
            this.hideLoading();
        }
    }
    
    async initializeComponents() {
        // Initialize task manager
        await this.taskManager.init();
        
        // Initialize UI components
        this.uiManager.init(this.taskManager);
        this.modalManager.init(this.taskManager, this.uiManager);
        this.filterManager.init(this.taskManager, this.uiManager);
        
        // Initialize drag manager
        this.dragManager.init({
            onDragStart: this.handleDragStart.bind(this),
            onDragMove: this.handleDragMove.bind(this),
            onDragEnd: this.handleDragEnd.bind(this)
        });
        
        // Initialize keyboard manager
        this.keyboardManager.init({
            onCreateTask: () => this.modalManager.openCreateModal(),
            onDeleteTask: () => this.handleDeleteSelectedTask(),
            onSearch: () => this.focusSearch(),
            onEscape: () => this.handleEscape()
        });
        
        // Initialize canvas background
        this.canvasBackground.init();
    }
    
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        sidebarToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
            // On mobile, show/hide sidebar
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show');
            }
        });
        
        // Background toggle
        const bgToggle = document.getElementById('bgToggle');
        bgToggle?.addEventListener('click', () => {
            const isActive = this.canvasBackground.toggle();
            bgToggle.classList.toggle('active', isActive);
        });
        
        // Profile dropdown
        this.setupProfileDropdown();
        
        // Search
        this.setupSearch();
        
        // Filter bar
        this.setupFilterBar();
        
        // Task creation buttons
        this.setupTaskCreation();
        
        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Click outside to close modals
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        // Task manager events
        this.taskManager.on('tasksUpdated', this.handleTasksUpdated.bind(this));
        this.taskManager.on('taskCreated', this.handleTaskCreated.bind(this));
        this.taskManager.on('taskUpdated', this.handleTaskUpdated.bind(this));
        this.taskManager.on('taskDeleted', this.handleTaskDeleted.bind(this));
        
        // Filter events
        this.filterManager.on('filtersChanged', this.handleFiltersChanged.bind(this));
    }
    
    setupProfileDropdown() {
        const profileButton = document.getElementById('profileButton');
        const profileMenu = document.getElementById('profileMenu');
        
        profileButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });
        
        // Settings button
        document.getElementById('settingsButton')?.addEventListener('click', () => {
            this.toastManager.show({
                type: 'info',
                title: 'Settings',
                message: 'Settings panel coming soon!'
            });
            profileMenu.classList.remove('show');
        });
        
        // Logout button
        document.getElementById('logoutButton')?.addEventListener('click', () => {
            this.handleLogout();
            profileMenu.classList.remove('show');
        });
    }
    
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput?.addEventListener('input', (e) => {
            this.filterManager.setSearch(e.target.value);
        });
        
        // Clear search on escape
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.filterManager.setSearch('');
                e.target.blur();
            }
        });
    }
    
    setupFilterBar() {
        const statusFilter = document.getElementById('statusFilter');
        const categoryFilter = document.getElementById('categoryFilter');
        const priorityFilter = document.getElementById('priorityFilter');
        const sortBy = document.getElementById('sortBy');
        
        statusFilter?.addEventListener('change', (e) => {
            this.filterManager.setStatusFilter(e.target.value);
        });
        
        categoryFilter?.addEventListener('change', (e) => {
            this.filterManager.setCategoryFilter(e.target.value);
        });
        
        priorityFilter?.addEventListener('change', (e) => {
            this.filterManager.setPriorityFilter(e.target.value);
        });
        
        sortBy?.addEventListener('change', (e) => {
            this.filterManager.setSortBy(e.target.value);
        });
    }
    
    setupTaskCreation() {
        // Main create button
        document.getElementById('createTaskBtn')?.addEventListener('click', () => {
            this.modalManager.openCreateModal();
        });
        
        // Column add buttons
        document.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.target.closest('.add-task-btn').dataset.status;
                this.modalManager.openCreateModal(status);
            });
        });
    }
    
    async loadInitialData() {
        // Load tasks from storage and sync with server
        await this.taskManager.loadTasks();
        
        // Render initial UI
        this.renderTasks();
        this.updateTaskCounts();
        this.updateCategoryFilters();
        
        // Sync with server in background
        try {
            await this.taskManager.syncWithServer();
            this.renderTasks();
            this.updateTaskCounts();
        } catch (error) {
            console.log('Server sync failed, working offline:', error);
            this.toastManager.show({
                type: 'warning',
                title: 'Offline Mode',
                message: 'Working offline. Changes will sync when connection is restored.'
            });
        }
    }
    
    // Drag and Drop Handlers
    handleDragStart(taskCard) {
        this.selectedTaskId = taskCard.dataset.taskId;
        taskCard.classList.add('dragging');
        
        // Add drag-over class to all drop zones
        document.querySelectorAll('.task-list, .drop-zone').forEach(zone => {
            zone.classList.add('drag-active');
        });
        
        return {
            taskId: taskCard.dataset.taskId,
            originalStatus: taskCard.dataset.status
        };
    }
    
    handleDragMove(data, pointer) {
        // Find drop target
        const dropTarget = this.findDropTarget(pointer.x, pointer.y);
        
        // Update drop zone highlights
        document.querySelectorAll('.task-list, .drop-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });
        
        if (dropTarget) {
            dropTarget.classList.add('drag-over');
        }
        
        return { dropTarget };
    }
    
    async handleDragEnd(data, dragData) {
        const taskCard = document.querySelector(`[data-task-id="${data.taskId}"]`);
        taskCard?.classList.remove('dragging');
        
        // Remove drag states
        document.querySelectorAll('.task-list, .drop-zone').forEach(zone => {
            zone.classList.remove('drag-active', 'drag-over');
        });
        
        // Handle drop
        if (dragData.dropTarget) {
            const newStatus = dragData.dropTarget.dataset.status;
            if (newStatus && newStatus !== data.originalStatus) {
                try {
                    await this.taskManager.updateTask(data.taskId, { status: newStatus });
                    
                    this.toastManager.show({
                        type: 'success',
                        title: 'Task Moved',
                        message: `Task moved to ${this.getStatusDisplayName(newStatus)}`
                    });
                } catch (error) {
                    console.error('Failed to update task status:', error);
                    this.toastManager.show({
                        type: 'error',
                        title: 'Update Failed',
                        message: 'Failed to move task. Please try again.'
                    });
                }
            }
        }
        
        this.selectedTaskId = null;
    }
    
    findDropTarget(x, y) {
        const element = document.elementFromPoint(x, y);
        if (!element) return null;
        
        // Find the closest task list or drop zone
        return element.closest('.task-list[data-status], .drop-zone[data-status]');
    }
    
    getStatusDisplayName(status) {
        const statusNames = {
            todo: 'To Do',
            inProgress: 'In Progress',
            done: 'Done'
        };
        return statusNames[status] || status;
    }
    
    // Event Handlers
    handleTasksUpdated(tasks) {
        this.renderTasks();
        this.updateTaskCounts();
        this.updateCategoryFilters();
    }
    
    handleTaskCreated(task) {
        this.toastManager.show({
            type: 'success',
            title: 'Task Created',
            message: `"${task.title}" has been created successfully!`
        });
    }
    
    handleTaskUpdated(task) {
        this.toastManager.show({
            type: 'success',
            title: 'Task Updated',
            message: `"${task.title}" has been updated successfully!`
        });
    }
    
    handleTaskDeleted(task) {
        this.toastManager.show({
            type: 'success',
            title: 'Task Deleted',
            message: `"${task.title}" has been deleted.`,
            actions: [{
                label: 'Undo',
                action: () => this.handleUndoDelete(task)
            }],
            duration: 6000
        });
    }
    
    async handleUndoDelete(task) {
        try {
            await this.taskManager.createTask(task);
            this.toastManager.show({
                type: 'success',
                title: 'Task Restored',
                message: `"${task.title}" has been restored.`
            });
        } catch (error) {
            console.error('Failed to restore task:', error);
            this.toastManager.show({
                type: 'error',
                title: 'Restore Failed',
                message: 'Failed to restore task. Please try again.'
            });
        }
    }
    
    async handleDeleteSelectedTask() {
        if (!this.selectedTaskId) {
            this.toastManager.show({
                type: 'warning',
                title: 'No Task Selected',
                message: 'Please select a task to delete.'
            });
            return;
        }
        
        const task = this.taskManager.getTask(this.selectedTaskId);
        if (task) {
            this.modalManager.openDeleteModal(task);
        }
    }
    
    handleFiltersChanged(filters) {
        this.renderTasks();
    }
    
    handleResize() {
        // Handle mobile sidebar
        if (window.innerWidth > 768) {
            document.getElementById('sidebar')?.classList.remove('show');
        }
        
        // Resize canvas background
        this.canvasBackground.resize();
    }
    
    handleDocumentClick(e) {
        // Close profile dropdown
        const profileMenu = document.getElementById('profileMenu');
        const profileButton = document.getElementById('profileButton');
        
        if (profileMenu && !profileButton?.contains(e.target) && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove('show');
        }
        
        // Handle task selection
        const taskCard = e.target.closest('.task-card');
        if (taskCard) {
            // Remove previous selection
            document.querySelectorAll('.task-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Add selection to clicked task
            taskCard.classList.add('selected');
            this.selectedTaskId = taskCard.dataset.taskId;
        } else if (!e.target.closest('.modal') && !e.target.closest('button')) {
            // Clear selection if clicking outside
            document.querySelectorAll('.task-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
            this.selectedTaskId = null;
        }
    }
    
    handleEscape() {
        // Close modals
        this.modalManager.closeAll();
        
        // Clear search
        const searchInput = document.getElementById('searchInput');
        if (document.activeElement === searchInput) {
            searchInput.value = '';
            this.filterManager.setSearch('');
            searchInput.blur();
        }
        
        // Clear selection
        document.querySelectorAll('.task-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        this.selectedTaskId = null;
        
        // Close profile dropdown
        document.getElementById('profileMenu')?.classList.remove('show');
    }
    
    handleLogout() {
        // Clear local data
        this.taskManager.clearLocalData();
        
        // Show logout message
        this.toastManager.show({
            type: 'info',
            title: 'Logged Out',
            message: 'You have been logged out successfully.'
        });
        
        // In a real app, redirect to login page
        console.log('Logout - would redirect to login page');
    }
    
    focusSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput?.focus();
        searchInput?.select();
    }
    
    // UI Rendering Methods
    renderTasks() {
        const filteredTasks = this.filterManager.getFilteredTasks();
        
        // Group tasks by status
        const tasksByStatus = {
            todo: filteredTasks.filter(task => task.status === 'todo'),
            inProgress: filteredTasks.filter(task => task.status === 'inProgress'),
            done: filteredTasks.filter(task => task.status === 'done')
        };
        
        // Render each column
        Object.keys(tasksByStatus).forEach(status => {
            this.renderTaskColumn(status, tasksByStatus[status]);
        });
    }
    
    renderTaskColumn(status, tasks) {
        const columnList = document.getElementById(`${status}List`) || 
                         document.querySelector(`[data-status="${status}"] .task-list`);
        
        if (!columnList) return;
        
        // Clear existing tasks
        columnList.innerHTML = '';
        
        // Render tasks
        if (tasks.length === 0) {
            columnList.appendChild(this.createEmptyState(status));
        } else {
            tasks.forEach(task => {
                const taskCard = this.createTaskCard(task);
                columnList.appendChild(taskCard);
            });
        }
    }
    
    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;
        card.dataset.status = task.status;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Task: ${task.title}`);
        
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const now = new Date();
        const isOverdue = dueDate && dueDate < now;
        const isDueSoon = dueDate && !isOverdue && (dueDate - now) < (24 * 60 * 60 * 1000);
        
        card.innerHTML = `
            <div class="task-header">
                <h3 class="task-title">${this.escapeHtml(task.title)}</h3>
                <div class="task-actions">
                    <button class="task-action edit-action" aria-label="Edit task" data-task-id="${task.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="task-action delete-action" aria-label="Delete task" data-task-id="${task.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
            
            <div class="task-meta">
                <div class="task-badges">
                    ${task.category ? `<span class="task-category">${this.escapeHtml(task.category)}</span>` : ''}
                    <span class="task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span>
                </div>
                ${dueDate ? `
                    <div class="task-due-date ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${this.formatDate(dueDate)}
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.edit-action')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.modalManager.openEditModal(task);
        });
        
        card.querySelector('.delete-action')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.modalManager.openDeleteModal(task);
        });
        
        // Add drag support
        this.dragManager.makeDraggable(card);
        
        return card;
    }
    
    createEmptyState(status) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        
        const messages = {
            todo: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12l2 2 4-4"></path>
                </svg>`,
                title: 'No tasks to do',
                message: 'Create a new task to get started!'
            },
            inProgress: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>`,
                title: 'No tasks in progress',
                message: 'Move tasks here when you start working on them.'
            },
            done: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22,4 12,14.01 9,11.01"></polyline>
                </svg>`,
                title: 'No completed tasks',
                message: 'Completed tasks will appear here.'
            }
        };
        
        const config = messages[status] || messages.todo;
        
        emptyState.innerHTML = `
            ${config.icon}
            <h3>${config.title}</h3>
            <p>${config.message}</p>
        `;
        
        return emptyState;
    }
    
    updateTaskCounts() {
        const tasks = this.taskManager.getTasks();
        
        // Status counts
        const statusCounts = {
            all: tasks.length,
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'inProgress').length,
            done: tasks.filter(t => t.status === 'done').length
        };
        
        // Update sidebar counts
        Object.keys(statusCounts).forEach(status => {
            const countEl = document.getElementById(`${status}TasksCount`);
            if (countEl) countEl.textContent = statusCounts[status];
        });
        
        // Update column counts
        const columnCounts = {
            todo: statusCounts.todo,
            inProgress: statusCounts.inProgress,
            done: statusCounts.done
        };
        
        Object.keys(columnCounts).forEach(status => {
            const countEl = document.getElementById(`${status}ColumnCount`);
            if (countEl) countEl.textContent = columnCounts[status];
        });
        
        // Priority counts
        const priorityCounts = {
            high: tasks.filter(t => t.priority === 'High').length,
            medium: tasks.filter(t => t.priority === 'Medium').length,
            low: tasks.filter(t => t.priority === 'Low').length
        };
        
        Object.keys(priorityCounts).forEach(priority => {
            const countEl = document.getElementById(`${priority}PriorityCount`);
            if (countEl) countEl.textContent = priorityCounts[priority];
        });
    }
    
    updateCategoryFilters() {
        const tasks = this.taskManager.getTasks();
        const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
        
        // Update category filter dropdown
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            // Keep current selection
            const currentValue = categoryFilter.value;
            
            // Clear existing options except "All Categories"
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            
            // Add category options
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });
            
            // Restore selection
            categoryFilter.value = currentValue;
        }
        
        // Update sidebar category list
        const categoryList = document.getElementById('categoryList');
        if (categoryList) {
            categoryList.innerHTML = '';
            
            categories.forEach(category => {
                const count = tasks.filter(t => t.category === category).length;
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.innerHTML = `
                    <button class="nav-link" data-category="${category}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                        ${this.escapeHtml(category)}
                        <span class="task-count">${count}</span>
                    </button>
                `;
                
                // Add click handler
                li.querySelector('.nav-link').addEventListener('click', () => {
                    this.filterManager.setCategoryFilter(category);
                });
                
                categoryList.appendChild(li);
            });
        }
        
        // Update datalist for task form
        const categoryDatalist = document.getElementById('categoryDatalist');
        if (categoryDatalist) {
            categoryDatalist.innerHTML = '';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                categoryDatalist.appendChild(option);
            });
        }
    }
    
    // Utility Methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(date) {
        const now = new Date();
        const diff = date - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
            return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
        } else if (days === 0) {
            return 'Due today';
        } else if (days === 1) {
            return 'Due tomorrow';
        } else if (days <= 7) {
            return `Due in ${days} days`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    showLoading() {
        document.getElementById('loadingOverlay')?.classList.add('show');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('show');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskFlowApp();
});

// Export for testing purposes
window.TaskFlowApp = TaskFlowApp;