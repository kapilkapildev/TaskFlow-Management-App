// Local Storage and IndexedDB Management
export class StorageManager {
    constructor() {
        this.dbName = 'TaskFlowDB';
        this.dbVersion = 1;
        this.storeName = 'tasks';
        this.db = null;
        this.useIndexedDB = false;
    }
    
    async init() {
        console.log('Initializing StorageManager...');
        
        // Try to initialize IndexedDB first
        if (this.isIndexedDBSupported()) {
            try {
                await this.initIndexedDB();
                this.useIndexedDB = true;
                console.log('Using IndexedDB for storage');
                return;
            } catch (error) {
                console.warn('IndexedDB initialization failed, falling back to localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        if (this.isLocalStorageSupported()) {
            this.useIndexedDB = false;
            console.log('Using localStorage for storage');
        } else {
            throw new Error('No storage mechanism available');
        }
    }
    
    // IndexedDB Methods
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create tasks store
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('priority', 'priority', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                    store.createIndex('dueDate', 'dueDate', { unique: false });
                }
            };
        });
    }
    
    async saveTasksIndexedDB(tasks) {
        if (!this.db) throw new Error('IndexedDB not initialized');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();
            
            // Clear existing tasks
            store.clear();
            
            // Add all tasks
            tasks.forEach(task => {
                store.add(task);
            });
        });
    }
    
    async loadTasksIndexedDB() {
        if (!this.db) throw new Error('IndexedDB not initialized');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    }
    
    async clearTasksIndexedDB() {
        if (!this.db) throw new Error('IndexedDB not initialized');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    
    // localStorage Methods
    saveTasksLocalStorage(tasks) {
        try {
            const data = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                tasks: tasks
            };
            
            localStorage.setItem('taskflow_tasks', JSON.stringify(data));
            return Promise.resolve();
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return Promise.reject(error);
        }
    }
    
    loadTasksLocalStorage() {
        try {
            const data = localStorage.getItem('taskflow_tasks');
            if (!data) return Promise.resolve([]);
            
            const parsed = JSON.parse(data);
            
            // Validate data structure
            if (parsed && parsed.tasks && Array.isArray(parsed.tasks)) {
                return Promise.resolve(parsed.tasks);
            }
            
            return Promise.resolve([]);
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return Promise.resolve([]);
        }
    }
    
    clearTasksLocalStorage() {
        try {
            localStorage.removeItem('taskflow_tasks');
            return Promise.resolve();
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return Promise.reject(error);
        }
    }
    
    // Public Interface
    async saveTasks(tasks) {
        if (this.useIndexedDB) {
            return this.saveTasksIndexedDB(tasks);
        } else {
            return this.saveTasksLocalStorage(tasks);
        }
    }
    
    async loadTasks() {
        if (this.useIndexedDB) {
            return this.loadTasksIndexedDB();
        } else {
            return this.loadTasksLocalStorage();
        }
    }
    
    async clearTasks() {
        if (this.useIndexedDB) {
            return this.clearTasksIndexedDB();
        } else {
            return this.clearTasksLocalStorage();
        }
    }
    
    // Storage Information
    async getStorageInfo() {
        const info = {
            type: this.useIndexedDB ? 'IndexedDB' : 'localStorage',
            supported: true,
            size: null,
            quota: null
        };
        
        try {
            if (this.useIndexedDB && navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                info.size = estimate.usage;
                info.quota = estimate.quota;
            } else if (!this.useIndexedDB) {
                // Estimate localStorage usage
                const data = localStorage.getItem('taskflow_tasks');
                info.size = data ? new Blob([data]).size : 0;
                info.quota = this.getLocalStorageQuota();
            }
        } catch (error) {
            console.warn('Failed to get storage info:', error);
        }
        
        return info;
    }
    
    getLocalStorageQuota() {
        // Most browsers allow 5-10MB for localStorage
        // This is a rough estimate
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length;
                }
            }
            return total;
        } catch (error) {
            return null;
        }
    }
    
    // Backup and Restore
    async createBackup() {
        const tasks = await this.loadTasks();
        const storageInfo = await this.getStorageInfo();
        
        return {
            version: '1.0',
            createdAt: new Date().toISOString(),
            storageType: storageInfo.type,
            tasks: tasks,
            metadata: {
                taskCount: tasks.length,
                lastModified: tasks.length > 0 ? Math.max(...tasks.map(t => new Date(t.updatedAt))) : null
            }
        };
    }
    
    async restoreFromBackup(backupData) {
        if (!backupData || !backupData.tasks || !Array.isArray(backupData.tasks)) {
            throw new Error('Invalid backup data format');
        }
        
        // Validate tasks
        const validTasks = backupData.tasks.filter(task => {
            return (
                task.id &&
                task.title &&
                task.status &&
                task.priority &&
                task.createdAt &&
                task.updatedAt
            );
        });
        
        if (validTasks.length === 0) {
            throw new Error('No valid tasks found in backup');
        }
        
        // Save tasks
        await this.saveTasks(validTasks);
        
        return {
            restored: validTasks.length,
            skipped: backupData.tasks.length - validTasks.length
        };
    }
    
    // Utility Methods
    isIndexedDBSupported() {
        return (
            typeof window !== 'undefined' &&
            'indexedDB' in window &&
            indexedDB !== null &&
            typeof indexedDB.open === 'function'
        );
    }
    
    isLocalStorageSupported() {
        try {
            if (typeof window === 'undefined' || !('localStorage' in window)) {
                return false;
            }
            
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    // Migration Methods
    async migrateData(fromVersion, toVersion) {
        console.log(`Migrating data from version ${fromVersion} to ${toVersion}`);
        
        // For future use when data structure changes
        const tasks = await this.loadTasks();
        
        // Apply migrations based on version
        let migratedTasks = [...tasks];
        
        // Example migration (not needed for v1.0)
        if (fromVersion < 1.1) {
            migratedTasks = migratedTasks.map(task => ({
                ...task,
                // Add new fields or transform existing ones
            }));
        }
        
        // Save migrated data
        await this.saveTasks(migratedTasks);
        
        return migratedTasks;
    }
    
    // Cleanup Methods
    async cleanup() {
        try {
            // Remove old or corrupted data
            const tasks = await this.loadTasks();
            
            // Filter out invalid tasks
            const validTasks = tasks.filter(task => {
                return (
                    task &&
                    typeof task === 'object' &&
                    task.id &&
                    task.title &&
                    task.createdAt &&
                    task.updatedAt
                );
            });
            
            // Save cleaned data if changes were made
            if (validTasks.length !== tasks.length) {
                await this.saveTasks(validTasks);
                console.log(`Cleaned up ${tasks.length - validTasks.length} invalid tasks`);
            }
            
            return validTasks;
        } catch (error) {
            console.error('Failed to cleanup storage:', error);
            throw error;
        }
    }
}