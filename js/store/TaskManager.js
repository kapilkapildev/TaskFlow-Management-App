// Task Management and Data Persistence
import { ApiClient } from './ApiClient.js';
import { StorageManager } from './StorageManager.js';

export class TaskManager {
    constructor() {
        this.tasks = [];
        this.apiClient = new ApiClient();
        this.storageManager = new StorageManager();
        this.eventListeners = {};
        this.isInitialized = false;
        this.lastSyncTime = null;
    }
    
    async init() {
        console.log('Initializing TaskManager...');
        
        // Initialize storage
        await this.storageManager.init();
        
        this.isInitialized = true;
        console.log('TaskManager initialized successfully');
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
    
    // Task CRUD Operations
    async createTask(taskData) {
        const task = {
            id: this.generateId(),
            title: taskData.title || '',
            description: taskData.description || '',
            category: taskData.category || '',
            priority: taskData.priority || 'Medium',
            status: taskData.status || 'todo',
            dueDate: taskData.dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Validate task
        if (!task.title.trim()) {
            throw new Error('Task title is required');
        }
        
        // Add to local tasks
        this.tasks.push(task);
        
        // Save to local storage
        await this.storageManager.saveTasks(this.tasks);
        
        // Sync with server
        try {
            await this.apiClient.createTask(task);
        } catch (error) {
            console.warn('Failed to sync task creation with server:', error);
        }
        
        // Emit events
        this.emit('taskCreated', task);
        this.emit('tasksUpdated', this.tasks);
        
        return task;
    }
    
    async updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }
        
        // Create updated task
        const updatedTask = {
            ...this.tasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        // Validate updated task
        if (!updatedTask.title.trim()) {
            throw new Error('Task title is required');
        }
        
        // Update in local tasks
        this.tasks[taskIndex] = updatedTask;
        
        // Save to local storage
        await this.storageManager.saveTasks(this.tasks);
        
        // Sync with server
        try {
            await this.apiClient.updateTask(taskId, updatedTask);
        } catch (error) {
            console.warn('Failed to sync task update with server:', error);
        }
        
        // Emit events
        this.emit('taskUpdated', updatedTask);
        this.emit('tasksUpdated', this.tasks);
        
        return updatedTask;
    }
    
    async deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }
        
        const deletedTask = this.tasks[taskIndex];
        
        // Remove from local tasks
        this.tasks.splice(taskIndex, 1);
        
        // Save to local storage
        await this.storageManager.saveTasks(this.tasks);
        
        // Sync with server
        try {
            await this.apiClient.deleteTask(taskId);
        } catch (error) {
            console.warn('Failed to sync task deletion with server:', error);
        }
        
        // Emit events
        this.emit('taskDeleted', deletedTask);
        this.emit('tasksUpdated', this.tasks);
        
        return deletedTask;
    }
    
    // Task Queries
    getTasks() {
        return [...this.tasks];
    }
    
    getTask(taskId) {
        return this.tasks.find(t => t.id === taskId);
    }
    
    getTasksByStatus(status) {
        return this.tasks.filter(t => t.status === status);
    }
    
    getTasksByCategory(category) {
        return this.tasks.filter(t => t.category === category);
    }
    
    getTasksByPriority(priority) {
        return this.tasks.filter(t => t.priority === priority);
    }
    
    searchTasks(query) {
        if (!query.trim()) return this.tasks;
        
        const searchTerm = query.toLowerCase().trim();
        
        return this.tasks.filter(task => {
            return (
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.category && task.category.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // Data Loading and Syncing
    async loadTasks() {
        console.log('Loading tasks from local storage...');
        
        try {
            // Load from local storage first
            const localTasks = await this.storageManager.loadTasks();
            this.tasks = localTasks || [];
            
            console.log(`Loaded ${this.tasks.length} tasks from local storage`);
            
            this.emit('tasksUpdated', this.tasks);
            
            return this.tasks;
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.tasks = [];
            return this.tasks;
        }
    }
    
    async syncWithServer() {
        console.log('Syncing with server...');
        
        try {
            // Get server tasks
            const serverTasks = await this.apiClient.getTasks();
            
            // Merge with local tasks (server wins on conflicts)
            const mergedTasks = this.mergeTasks(this.tasks, serverTasks);
            
            // Update local tasks
            this.tasks = mergedTasks;
            
            // Save merged tasks to local storage
            await this.storageManager.saveTasks(this.tasks);
            
            this.lastSyncTime = new Date();
            
            console.log(`Synced ${this.tasks.length} tasks with server`);
            
            this.emit('tasksUpdated', this.tasks);
            
            return this.tasks;
        } catch (error) {
            console.warn('Server sync failed:', error);
            throw error;
        }
    }
    
    mergeTasks(localTasks, serverTasks) {
        const taskMap = new Map();
        
        // Add local tasks first
        localTasks.forEach(task => {
            taskMap.set(task.id, task);
        });
        
        // Override with server tasks (server wins)
        serverTasks.forEach(task => {
            const localTask = taskMap.get(task.id);
            
            if (!localTask) {
                // New task from server
                taskMap.set(task.id, task);
            } else {
                // Conflict resolution: most recently updated wins
                const serverUpdated = new Date(task.updatedAt);
                const localUpdated = new Date(localTask.updatedAt);
                
                if (serverUpdated >= localUpdated) {
                    taskMap.set(task.id, task);
                } else {
                    // Local version is newer, keep it but sync to server
                    this.apiClient.updateTask(task.id, localTask).catch(err => {
                        console.warn('Failed to sync newer local task:', err);
                    });
                }
            }
        });
        
        return Array.from(taskMap.values());
    }
    
    // Sorting and Filtering Utilities
    sortTasks(tasks, sortBy) {
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
                const priorityOrder = { High: 3, Medium: 2, Low: 1 };
                return sortedTasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
            
            case 'priority-low':
                const priorityOrderLow = { High: 1, Medium: 2, Low: 3 };
                return sortedTasks.sort((a, b) => priorityOrderLow[b.priority] - priorityOrderLow[a.priority]);
            
            case 'title-asc':
                return sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
            
            case 'title-desc':
                return sortedTasks.sort((a, b) => b.title.localeCompare(a.title));
            
            default:
                return sortedTasks;
        }
    }
    
    filterTasks(tasks, filters) {
        let filteredTasks = [...tasks];
        
        // Status filter
        if (filters.status) {
            filteredTasks = filteredTasks.filter(task => task.status === filters.status);
        }
        
        // Category filter
        if (filters.category) {
            filteredTasks = filteredTasks.filter(task => task.category === filters.category);
        }
        
        // Priority filter
        if (filters.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
        }
        
        // Search filter
        if (filters.search) {
            filteredTasks = this.searchTasks(filteredTasks, filters.search);
        }
        
        return filteredTasks;
    }
    
    searchTasks(tasks, query) {
        if (!query.trim()) return tasks;
        
        const searchTerm = query.toLowerCase().trim();
        
        return tasks.filter(task => {
            return (
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.category && task.category.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // Statistics
    getTaskStats() {
        const total = this.tasks.length;
        const byStatus = {
            todo: this.tasks.filter(t => t.status === 'todo').length,
            inProgress: this.tasks.filter(t => t.status === 'inProgress').length,
            done: this.tasks.filter(t => t.status === 'done').length
        };
        
        const byPriority = {
            high: this.tasks.filter(t => t.priority === 'High').length,
            medium: this.tasks.filter(t => t.priority === 'Medium').length,
            low: this.tasks.filter(t => t.priority === 'Low').length
        };
        
        const categories = [...new Set(this.tasks.map(t => t.category).filter(Boolean))];
        
        const overdueTasks = this.tasks.filter(task => {
            if (!task.dueDate) return false;
            return new Date(task.dueDate) < new Date();
        }).length;
        
        const dueTodayTasks = this.tasks.filter(task => {
            if (!task.dueDate) return false;
            const today = new Date().toDateString();
            return new Date(task.dueDate).toDateString() === today;
        }).length;
        
        return {
            total,
            byStatus,
            byPriority,
            categories: categories.length,
            overdue: overdueTasks,
            dueToday: dueTodayTasks,
            completionRate: total > 0 ? Math.round((byStatus.done / total) * 100) : 0
        };
    }
    
    // Utility Methods
    generateId() {
        return 'task_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    clearLocalData() {
        this.tasks = [];
        this.storageManager.clearTasks();
        this.emit('tasksUpdated', this.tasks);
    }
    
    // Export/Import
    exportTasks() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            tasks: this.tasks
        };
    }
    
    async importTasks(data) {
        if (!data || !data.tasks || !Array.isArray(data.tasks)) {
            throw new Error('Invalid import data format');
        }
        
        // Validate tasks
        const validTasks = data.tasks.filter(task => {
            return task.id && task.title && typeof task.title === 'string';
        });
        
        if (validTasks.length === 0) {
            throw new Error('No valid tasks found in import data');
        }
        
        // Merge with existing tasks (avoid duplicates)
        const existingIds = new Set(this.tasks.map(t => t.id));
        const newTasks = validTasks.filter(task => !existingIds.has(task.id));
        
        // Add new tasks
        this.tasks.push(...newTasks);
        
        // Save to local storage
        await this.storageManager.saveTasks(this.tasks);
        
        // Emit events
        this.emit('tasksUpdated', this.tasks);
        
        return {
            imported: newTasks.length,
            skipped: validTasks.length - newTasks.length
        };
    }
}