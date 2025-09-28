// API Client for Server Communication
export class ApiClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = this.getStoredToken();
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }
    
    getBaseURL() {
        // In development, use localhost
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // In production, use relative URLs or environment variable
        return window.TASKFLOW_API_URL || '/api';
    }
    
    getStoredToken() {
        try {
            return localStorage.getItem('taskflow_auth_token');
        } catch (error) {
            return null;
        }
    }
    
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('taskflow_auth_token', token);
        } else {
            localStorage.removeItem('taskflow_auth_token');
        }
    }
    
    getHeaders() {
        const headers = { ...this.defaultHeaders };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }
    
    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method,
            headers: this.getHeaders()
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        try {
            console.log(`API Request: ${method} ${url}`);
            
            const response = await fetch(url, config);
            
            // Handle authentication errors
            if (response.status === 401) {
                this.setToken(null);
                throw new ApiError('Authentication required', 401);
            }
            
            // Handle other errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new ApiError(
                    errorData.message || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }
            
            // Return response data
            const responseData = await response.json();
            console.log(`API Response: ${method} ${url} - Success`);
            
            return responseData;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            
            // Network or other errors
            console.error(`API Error: ${method} ${url}`, error);
            throw new ApiError(
                error.message || 'Network error',
                0,
                { originalError: error }
            );
        }
    }
    
    // Authentication Methods
    async login(credentials) {
        const response = await this.request('POST', '/auth/login', credentials);
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }
    
    async logout() {
        try {
            await this.request('POST', '/auth/logout');
        } catch (error) {
            // Ignore errors on logout
            console.warn('Logout request failed:', error);
        } finally {
            this.setToken(null);
        }
    }
    
    async refreshToken() {
        const response = await this.request('POST', '/auth/refresh');
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }
    
    // Task API Methods
    async getTasks(filters = {}) {
        const params = new URLSearchParams();
        
        Object.keys(filters).forEach(key => {
            if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
                params.append(key, filters[key]);
            }
        });
        
        const endpoint = `/tasks${params.toString() ? '?' + params.toString() : ''}`;
        
        try {
            const response = await this.request('GET', endpoint);
            return response.tasks || response || [];
        } catch (error) {
            // Return empty array if server is unavailable
            if (error.status === 0) {
                console.log('Server unavailable, working offline');
                return [];
            }
            throw error;
        }
    }
    
    async getTask(taskId) {
        const response = await this.request('GET', `/tasks/${taskId}`);
        return response.task || response;
    }
    
    async createTask(task) {
        const response = await this.request('POST', '/tasks', task);
        return response.task || response;
    }
    
    async updateTask(taskId, updates) {
        const response = await this.request('PUT', `/tasks/${taskId}`, updates);
        return response.task || response;
    }
    
    async deleteTask(taskId) {
        const response = await this.request('DELETE', `/tasks/${taskId}`);
        return response;
    }
    
    // Sync Methods
    async syncTasks(localTasks) {
        const response = await this.request('POST', '/sync', { tasks: localTasks });
        return response.tasks || response || [];
    }
    
    // Utility Methods
    async healthCheck() {
        try {
            const response = await this.request('GET', '/health');
            return response;
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }
    
    async getServerInfo() {
        try {
            const response = await this.request('GET', '/info');
            return response;
        } catch (error) {
            return { error: error.message };
        }
    }
    
    // File Upload Methods (for future use)
    async uploadFile(file, taskId = null) {
        const formData = new FormData();
        formData.append('file', file);
        
        if (taskId) {
            formData.append('taskId', taskId);
        }
        
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const url = `${this.baseURL}/upload`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            throw new ApiError(`Upload failed: ${error.message}`, 0);
        }
    }
    
    // Retry Logic for Failed Requests
    async requestWithRetry(method, endpoint, data = null, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.request(method, endpoint, data);
            } catch (error) {
                lastError = error;
                
                // Don't retry on authentication errors or client errors
                if (error.status >= 400 && error.status < 500) {
                    throw error;
                }
                
                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }
    
    // Batch Operations
    async batchCreateTasks(tasks) {
        const response = await this.request('POST', '/tasks/batch', { tasks });
        return response.tasks || [];
    }
    
    async batchUpdateTasks(updates) {
        const response = await this.request('PUT', '/tasks/batch', { updates });
        return response.tasks || [];
    }
    
    async batchDeleteTasks(taskIds) {
        const response = await this.request('DELETE', '/tasks/batch', { taskIds });
        return response;
    }
}

// Custom API Error Class
export class ApiError extends Error {
    constructor(message, status = 0, data = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
    
    get isNetworkError() {
        return this.status === 0;
    }
    
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
    
    get isClientError() {
        return this.status >= 400 && this.status < 500;
    }
    
    get isServerError() {
        return this.status >= 500;
    }
}