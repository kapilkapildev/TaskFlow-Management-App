// Filter and Search Management System
export class FilterManager {
    constructor() {
        this.taskManager = null;
        this.uiManager = null;
        this.filters = {
            search: '',
            status: '',
            category: '',
            priority: '',
            sortBy: 'updatedAt-desc'
        };
        this.eventListeners = {};
    }
    
    init(taskManager, uiManager) {
        this.taskManager = taskManager;
        this.uiManager = uiManager;
        
        this.setupEventListeners();
        console.log('FilterManager initialized');
    }
    
    setupEventListeners() {
        // Listen for filter updates from UI
        document.addEventListener('filterUpdate', (e) => {
            this.handleFilterUpdate(e.detail);
        });
        
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.setSearch(e.target.value);
            }, 300));
        }
        
        // Filter selects
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.setStatusFilter(e.target.value);
        });
        
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            this.setCategoryFilter(e.target.value);
        });
        
        document.getElementById('priorityFilter')?.addEventListener('change', (e) => {
            this.setPriorityFilter(e.target.value);
        });
        
        document.getElementById('sortBy')?.addEventListener('change', (e) => {
            this.setSortBy(e.target.value);
        });
    }
    
    // Event Management
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
    
    // Filter Setters
    setSearch(query) {
        if (this.filters.search === query) return;
        
        this.filters.search = query;
        this.updateSearchUI(query);
        this.emitFiltersChanged();
    }
    
    setStatusFilter(status) {
        if (this.filters.status === status) return;
        
        this.filters.status = status;
        this.updateStatusUI(status);
        this.emitFiltersChanged();
    }
    
    setCategoryFilter(category) {
        if (this.filters.category === category) return;
        
        this.filters.category = category;
        this.updateCategoryUI(category);
        this.emitFiltersChanged();
    }
    
    setPriorityFilter(priority) {
        if (this.filters.priority === priority) return;
        
        this.filters.priority = priority;
        this.updatePriorityUI(priority);
        this.emitFiltersChanged();
    }
    
    setSortBy(sortBy) {
        if (this.filters.sortBy === sortBy) return;
        
        this.filters.sortBy = sortBy;
        this.updateSortUI(sortBy);
        this.emitFiltersChanged();
    }
    
    setFilters(newFilters) {
        let hasChanges = false;
        
        Object.keys(newFilters).forEach(key => {
            if (this.filters[key] !== newFilters[key]) {
                this.filters[key] = newFilters[key];
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
            this.updateAllFilterUI();
            this.emitFiltersChanged();
        }
    }
    
    clearAllFilters() {
        const clearedFilters = {
            search: '',
            status: '',
            category: '',
            priority: '',
            sortBy: 'updatedAt-desc'
        };
        
        this.setFilters(clearedFilters);
    }
    
    // Filter Application
    getFilteredTasks() {
        if (!this.taskManager) return [];
        
        let tasks = this.taskManager.getTasks();
        
        // Apply search filter
        if (this.filters.search) {
            tasks = this.applySearchFilter(tasks, this.filters.search);
        }
        
        // Apply status filter
        if (this.filters.status) {
            tasks = tasks.filter(task => task.status === this.filters.status);
        }
        
        // Apply category filter
        if (this.filters.category) {
            tasks = tasks.filter(task => task.category === this.filters.category);
        }
        
        // Apply priority filter
        if (this.filters.priority) {
            tasks = tasks.filter(task => task.priority === this.filters.priority);
        }
        
        // Apply sorting
        if (this.filters.sortBy) {
            tasks = this.applySorting(tasks, this.filters.sortBy);
        }
        
        return tasks;
    }
    
    applySearchFilter(tasks, query) {
        if (!query.trim()) return tasks;
        
        const searchTerms = query.toLowerCase().trim().split(/\s+/);
        
        return tasks.filter(task => {
            const searchableText = [
                task.title,
                task.description,
                task.category
            ].filter(Boolean).join(' ').toLowerCase();
            
            // All search terms must match (AND logic)
            return searchTerms.every(term => 
                searchableText.includes(term)
            );
        });
    }
    
    applySorting(tasks, sortBy) {
        const sortedTasks = [...tasks];
        
        switch (sortBy) {
            case 'createdAt-desc':
                return sortedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            case 'createdAt-asc':
                return sortedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            case 'updatedAt-desc':
                return sortedTasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            case 'updatedAt-asc':
                return sortedTasks.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
            
            case 'dueDate-asc':
                return sortedTasks.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                });
            
            case 'dueDate-desc':
                return sortedTasks.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return -1;
                    if (!b.dueDate) return 1;
                    return new Date(b.dueDate) - new Date(a.dueDate);
                });
            
            case 'priority-high':
                const priorityOrderHigh = { High: 3, Medium: 2, Low: 1 };
                return sortedTasks.sort((a, b) => {
                    const aPriority = priorityOrderHigh[a.priority] || 0;
                    const bPriority = priorityOrderHigh[b.priority] || 0;
                    return bPriority - aPriority;
                });
            
            case 'priority-low':
                const priorityOrderLow = { High: 1, Medium: 2, Low: 3 };
                return sortedTasks.sort((a, b) => {
                    const aPriority = priorityOrderLow[a.priority] || 0;
                    const bPriority = priorityOrderLow[b.priority] || 0;
                    return bPriority - aPriority;
                });
            
            case 'title-asc':
                return sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
            
            case 'title-desc':
                return sortedTasks.sort((a, b) => b.title.localeCompare(a.title));
            
            default:
                return sortedTasks;
        }
    }
    
    // UI Updates
    updateSearchUI(query) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value !== query) {
            searchInput.value = query;
        }
    }
    
    updateStatusUI(status) {
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter && statusFilter.value !== status) {
            statusFilter.value = status;
        }
        
        // Update sidebar navigation
        document.querySelectorAll('[data-filter]').forEach(link => {
            link.classList.toggle('active', link.dataset.filter === status || (!status && link.dataset.filter === 'all'));
        });
    }
    
    updateCategoryUI(category) {
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter && categoryFilter.value !== category) {
            categoryFilter.value = category;
        }
        
        // Update sidebar category navigation
        document.querySelectorAll('[data-category]').forEach(link => {
            link.classList.toggle('active', link.dataset.category === category);
        });
    }
    
    updatePriorityUI(priority) {
        const priorityFilter = document.getElementById('priorityFilter');
        if (priorityFilter && priorityFilter.value !== priority) {
            priorityFilter.value = priority;
        }
        
        // Update sidebar priority navigation
        document.querySelectorAll('[data-priority]').forEach(link => {
            link.classList.toggle('active', link.dataset.priority === priority);
        });
    }
    
    updateSortUI(sortBy) {
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect && sortSelect.value !== sortBy) {
            sortSelect.value = sortBy;
        }
    }
    
    updateAllFilterUI() {
        this.updateSearchUI(this.filters.search);
        this.updateStatusUI(this.filters.status);
        this.updateCategoryUI(this.filters.category);
        this.updatePriorityUI(this.filters.priority);
        this.updateSortUI(this.filters.sortBy);
    }
    
    // Event Handlers
    handleFilterUpdate(filterData) {
        if (filterData.filter) {
            this.setStatusFilter(filterData.filter === 'all' ? '' : filterData.filter);
        }
        
        if (filterData.category) {
            this.setCategoryFilter(filterData.category);
        }
        
        if (filterData.priority) {
            this.setPriorityFilter(filterData.priority);
        }
    }
    
    emitFiltersChanged() {
        this.emit('filtersChanged', { ...this.filters });
        
        // Update URL if needed (for bookmarking filters)
        this.updateURL();
    }
    
    // URL Management
    updateURL() {
        if (!window.history || !window.history.pushState) return;
        
        const params = new URLSearchParams();
        
        Object.keys(this.filters).forEach(key => {
            if (this.filters[key]) {
                params.set(key, this.filters[key]);
            }
        });
        
        const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
        
        try {
            window.history.replaceState({ filters: this.filters }, '', url);
        } catch (error) {
            console.warn('Failed to update URL:', error);
        }
    }
    
    loadFiltersFromURL() {
        if (!window.location.search) return;
        
        try {
            const params = new URLSearchParams(window.location.search);
            const urlFilters = {};
            
            Object.keys(this.filters).forEach(key => {
                const value = params.get(key);
                if (value) {
                    urlFilters[key] = value;
                }
            });
            
            if (Object.keys(urlFilters).length > 0) {
                this.setFilters(urlFilters);
            }
        } catch (error) {
            console.warn('Failed to load filters from URL:', error);
        }
    }
    
    // Filter Statistics
    getFilterStats() {
        const allTasks = this.taskManager ? this.taskManager.getTasks() : [];
        const filteredTasks = this.getFilteredTasks();
        
        return {
            total: allTasks.length,
            filtered: filteredTasks.length,
            hidden: allTasks.length - filteredTasks.length,
            hasActiveFilters: this.hasActiveFilters(),
            activeFilterCount: this.getActiveFilterCount()
        };
    }
    
    hasActiveFilters() {
        return Object.keys(this.filters).some(key => {
            if (key === 'sortBy') return false; // Sorting is not considered an active filter
            return Boolean(this.filters[key]);
        });
    }
    
    getActiveFilterCount() {
        return Object.keys(this.filters).filter(key => {
            if (key === 'sortBy') return false;
            return Boolean(this.filters[key]);
        }).length;
    }
    
    // Quick Filters
    showOnlyOverdue() {
        const now = new Date();
        const overdueTasks = this.taskManager.getTasks().filter(task => {
            return task.dueDate && new Date(task.dueDate) < now && task.status !== 'done';
        });
        
        // This would require a custom filter implementation
        // For now, we can just set a high priority filter as a workaround
        this.setPriorityFilter('High');
        this.setSortBy('dueDate-asc');
    }
    
    showDueToday() {
        const today = new Date().toDateString();
        // Similar to above, would need custom filter implementation
        this.setSortBy('dueDate-asc');
    }
    
    showRecentlyUpdated() {
        this.setSortBy('updatedAt-desc');
        this.clearOtherFilters(['sortBy']);
    }
    
    clearOtherFilters(keep = []) {
        const clearedFilters = { ...this.filters };
        
        Object.keys(clearedFilters).forEach(key => {
            if (!keep.includes(key)) {
                clearedFilters[key] = key === 'sortBy' ? 'updatedAt-desc' : '';
            }
        });
        
        this.setFilters(clearedFilters);
    }
    
    // Utility Methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    getFilters() {
        return { ...this.filters };
    }
    
    // Cleanup
    destroy() {
        // Clear event listeners
        this.eventListeners = {};
        
        // Reset filters
        this.filters = {
            search: '',
            status: '',
            category: '',
            priority: '',
            sortBy: 'updatedAt-desc'
        };
        
        console.log('FilterManager destroyed');
    }
}