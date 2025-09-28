// UI State Management and Component Coordination
export class UIManager {
    constructor() {
        this.taskManager = null;
        this.components = {};
        this.state = {
            selectedTasks: new Set(),
            sidebarCollapsed: false,
            currentFilter: null
        };
    }
    
    init(taskManager) {
        this.taskManager = taskManager;
        this.setupComponents();
        this.setupEventListeners();
        
        console.log('UIManager initialized');
    }
    
    setupComponents() {
        // Initialize sidebar navigation
        this.initSidebarNavigation();
        
        // Initialize task counters
        this.initTaskCounters();
        
        // Initialize responsive behavior
        this.initResponsiveBehavior();
    }
    
    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                this.handleNavigation(e);
            });
        });
        
        // Task selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.task-card')) {
                this.handleTaskSelection(e);
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    initSidebarNavigation() {
        // Set up active states
        const activeLink = document.querySelector('.nav-link.active');
        if (activeLink) {
            this.state.currentFilter = activeLink.dataset.filter;
        }
    }
    
    initTaskCounters() {
        // Initialize all counters to 0
        this.updateAllCounts();
    }
    
    initResponsiveBehavior() {
        // Check initial screen size
        this.handleResize();
        
        // Mobile sidebar behavior
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar')?.classList.add('collapsed');
            this.state.sidebarCollapsed = true;
        }
    }
    
    // Navigation Methods
    handleNavigation(e) {
        e.preventDefault();
        
        const link = e.currentTarget;
        const filter = link.dataset.filter;
        const category = link.dataset.category;
        const priority = link.dataset.priority;
        
        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Update filter state
        if (filter) {
            this.state.currentFilter = filter;
        }
        
        // Trigger filter update
        this.triggerFilterUpdate({ filter, category, priority });
    }
    
    triggerFilterUpdate(filterData) {
        // Dispatch custom event for filter manager to pick up
        const event = new CustomEvent('filterUpdate', {
            detail: filterData
        });
        
        document.dispatchEvent(event);
    }
    
    // Task Selection Methods
    handleTaskSelection(e) {
        const taskCard = e.target.closest('.task-card');
        const taskId = taskCard.dataset.taskId;
        
        if (e.ctrlKey || e.metaKey) {
            // Multi-select
            this.toggleTaskSelection(taskId);
        } else {
            // Single select
            this.selectTask(taskId);
        }
        
        this.updateSelectionUI();
    }
    
    selectTask(taskId) {
        this.state.selectedTasks.clear();
        this.state.selectedTasks.add(taskId);
    }
    
    toggleTaskSelection(taskId) {
        if (this.state.selectedTasks.has(taskId)) {
            this.state.selectedTasks.delete(taskId);
        } else {
            this.state.selectedTasks.add(taskId);
        }
    }
    
    clearSelection() {
        this.state.selectedTasks.clear();
        this.updateSelectionUI();
    }
    
    updateSelectionUI() {
        // Remove all selection classes
        document.querySelectorAll('.task-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection classes to selected tasks
        this.state.selectedTasks.forEach(taskId => {
            const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskCard) {
                taskCard.classList.add('selected');
            }
        });
        
        // Update selection-dependent UI
        this.updateSelectionControls();
    }
    
    updateSelectionControls() {
        const selectedCount = this.state.selectedTasks.size;
        
        // Enable/disable bulk actions based on selection
        document.querySelectorAll('[data-requires-selection]').forEach(element => {
            element.disabled = selectedCount === 0;
        });
        
        // Update selection counter if exists
        const selectionCounter = document.getElementById('selectionCounter');
        if (selectionCounter) {
            selectionCounter.textContent = selectedCount > 0 ? `${selectedCount} selected` : '';
            selectionCounter.style.display = selectedCount > 0 ? 'block' : 'none';
        }
    }
    
    // Count Management
    updateAllCounts() {
        if (!this.taskManager) return;
        
        const tasks = this.taskManager.getTasks();
        const stats = this.taskManager.getTaskStats();
        
        // Status counts
        this.updateCount('allTasksCount', stats.total);
        this.updateCount('todoTasksCount', stats.byStatus.todo);
        this.updateCount('inProgressTasksCount', stats.byStatus.inProgress);
        this.updateCount('doneTasksCount', stats.byStatus.done);
        
        // Column counts
        this.updateCount('todoColumnCount', stats.byStatus.todo);
        this.updateCount('inProgressColumnCount', stats.byStatus.inProgress);
        this.updateCount('doneColumnCount', stats.byStatus.done);
        
        // Priority counts
        this.updateCount('highPriorityCount', stats.byPriority.high);
        this.updateCount('mediumPriorityCount', stats.byPriority.medium);
        this.updateCount('lowPriorityCount', stats.byPriority.low);
        
        // Category counts
        this.updateCategoryCounts(tasks);
    }
    
    updateCount(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = count.toString();
            
            // Add animation class for changes
            if (element.textContent !== count.toString()) {
                element.classList.add('count-updated');
                setTimeout(() => {
                    element.classList.remove('count-updated');
                }, 300);
            }
        }
    }
    
    updateCategoryCounts(tasks) {
        const categories = new Map();
        
        // Count tasks per category
        tasks.forEach(task => {
            if (task.category) {
                categories.set(task.category, (categories.get(task.category) || 0) + 1);
            }
        });
        
        // Update category nav items
        document.querySelectorAll('[data-category]').forEach(element => {
            const category = element.dataset.category;
            const count = categories.get(category) || 0;
            const countElement = element.querySelector('.task-count');
            
            if (countElement) {
                countElement.textContent = count.toString();
            }
        });
    }
    
    // Responsive Methods
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        
        // Update body classes for responsive styling
        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('tablet', isTablet);
        document.body.classList.toggle('desktop', !isMobile && !isTablet);
        
        // Handle sidebar collapse on mobile
        if (isMobile && !this.state.sidebarCollapsed) {
            this.collapseSidebar();
        } else if (!isMobile && this.state.sidebarCollapsed) {
            this.expandSidebar();
        }
        
        // Update task board layout
        this.updateTaskBoardLayout();
    }
    
    collapseSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            this.state.sidebarCollapsed = true;
        }
    }
    
    expandSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            this.state.sidebarCollapsed = false;
        }
    }
    
    updateTaskBoardLayout() {
        const taskBoard = document.querySelector('.task-board');
        if (!taskBoard) return;
        
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        
        if (isMobile) {
            taskBoard.classList.add('mobile-layout');
            taskBoard.classList.remove('tablet-layout', 'desktop-layout');
        } else if (isTablet) {
            taskBoard.classList.add('tablet-layout');
            taskBoard.classList.remove('mobile-layout', 'desktop-layout');
        } else {
            taskBoard.classList.add('desktop-layout');
            taskBoard.classList.remove('mobile-layout', 'tablet-layout');
        }
    }
    
    // Animation Methods
    animateTaskUpdate(taskId, animation = 'pulse') {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
            taskCard.classList.add(`animate-${animation}`);
            
            setTimeout(() => {
                taskCard.classList.remove(`animate-${animation}`);
            }, 300);
        }
    }
    
    animateColumnUpdate(status) {
        const column = document.querySelector(`[data-status="${status}"]`);
        if (column) {
            column.classList.add('animate-update');
            
            setTimeout(() => {
                column.classList.remove('animate-update');
            }, 200);
        }
    }
    
    // State Management
    getState() {
        return { ...this.state };
    }
    
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.updateUI();
    }
    
    updateUI() {
        this.updateSelectionUI();
        this.updateAllCounts();
    }
    
    // Loading States
    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('loading');
        }
    }
    
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('loading');
        }
    }
    
    // Error States
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('error');
            element.setAttribute('data-error', message);
        }
    }
    
    clearError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('error');
            element.removeAttribute('data-error');
        }
    }
    
    // Accessibility Methods
    announceUpdate(message) {
        // Create or use existing live region
        let liveRegion = document.getElementById('live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-10000px';
            liveRegion.style.width = '1px';
            liveRegion.style.height = '1px';
            liveRegion.style.overflow = 'hidden';
            document.body.appendChild(liveRegion);
        }
        
        // Announce the message
        liveRegion.textContent = message;
        
        // Clear after delay
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }
    
    // Utility Methods
    getSelectedTaskIds() {
        return Array.from(this.state.selectedTasks);
    }
    
    hasSelectedTasks() {
        return this.state.selectedTasks.size > 0;
    }
    
    getSelectedTaskCount() {
        return this.state.selectedTasks.size;
    }
    
    // Theme Methods
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskflow_theme', theme);
    }
    
    getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }
    
    // Cleanup
    destroy() {
        // Clear event listeners
        document.querySelectorAll('.nav-link').forEach(link => {
            link.removeEventListener('click', this.handleNavigation);
        });
        
        window.removeEventListener('resize', this.handleResize);
        
        // Clear state
        this.state = {
            selectedTasks: new Set(),
            sidebarCollapsed: false,
            currentFilter: null
        };
        
        console.log('UIManager destroyed');
    }
}