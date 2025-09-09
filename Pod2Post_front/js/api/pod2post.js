/* Pod2Post - API Service Module */

export class Pod2PostAPI {
    constructor(config = {}) {
        this.baseURL = config.baseURL || 'http://cardapi.paitongai.com';
        this.token = config.token || null;
        this.timeout = config.timeout || 30000;
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...defaultOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // User authentication
    async login(username, password) {
        const response = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    // Submit async card generation task
    async submitAsyncTask(data) {
        const formData = new FormData();
        
        // Add text fields
        formData.append('topic', data.topic || '');
        formData.append('cardTemplate', data.cardTemplate || 'default');
        formData.append('userType', data.userType || 'basic');
        formData.append('hostName', data.hostName || '');
        formData.append('guestName', data.guestName || '');
        
        // Add files
        if (data.files) {
            // Add content photos
            if (data.files.content && data.files.content.length > 0) {
                data.files.content.forEach((file, index) => {
                    formData.append(`contentPhoto${index}`, file);
                });
            }
            
            // Add cover photos
            if (data.files.coverTop) {
                formData.append('coverTopPhoto', data.files.coverTop);
            }
            if (data.files.coverBottom) {
                formData.append('coverBottomPhoto', data.files.coverBottom);
            }
            
            // Add audio file
            if (data.files.audio) {
                formData.append('audioFile', data.files.audio);
            }
        }
        
        // Add corrections if any
        if (data.corrections && data.corrections.length > 0) {
            formData.append('corrections', JSON.stringify(data.corrections));
        }

        const response = await fetch(`${this.baseURL}/api/generate/pod2post/async`, {
            method: 'POST',
            headers: {
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Query task status
    async queryTaskStatus(taskId) {
        return await this.request(`/api/generate/pod2post/status/${taskId}`, {
            method: 'GET'
        });
    }

    // Get generated content
    async getGeneratedContent(folderName) {
        return await this.request(`/api/generate/pod2post/content/${folderName}`, {
            method: 'GET'
        });
    }

    // Upload resources (photos, audio)
    async uploadResources(files, type = 'photos') {
        const formData = new FormData();
        
        if (Array.isArray(files)) {
            files.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });
        } else {
            formData.append('file', files);
        }
        
        formData.append('type', type);

        const response = await fetch(`${this.baseURL}/api/upload/resources`, {
            method: 'POST',
            headers: {
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Process audio transcription
    async transcribeAudio(audioFile, language = 'zh') {
        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('language', language);

        const response = await fetch(`${this.baseURL}/api/audio/transcribe`, {
            method: 'POST',
            headers: {
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Apply name corrections
    async applyCorrections(content, corrections) {
        return await this.request('/api/text/corrections', {
            method: 'POST',
            body: JSON.stringify({ content, corrections })
        });
    }

    // Generate cards from template
    async generateCards(data) {
        return await this.request('/api/generate/cards', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Poll for task completion
    async pollTaskStatus(taskId, maxAttempts = 60, interval = 5000) {
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const status = await this.queryTaskStatus(taskId);
                
                if (status.status === 'completed') {
                    return status;
                } else if (status.status === 'failed') {
                    throw new Error(status.error || 'Task failed');
                }
                
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, interval));
                attempts++;
            } catch (error) {
                console.error('Error polling task status:', error);
                attempts++;
                
                if (attempts >= maxAttempts) {
                    throw new Error('Max polling attempts reached');
                }
            }
        }
        
        throw new Error('Task timeout');
    }

    // Complete workflow: submit and wait for results
    async generatePodcastCards(data, onProgress) {
        try {
            // Step 1: Submit task
            if (onProgress) onProgress('submitting', 0);
            const submission = await this.submitAsyncTask(data);
            
            if (!submission.taskId) {
                throw new Error('No task ID received');
            }
            
            // Step 2: Poll for completion
            if (onProgress) onProgress('processing', 25);
            
            const pollWithProgress = async () => {
                let lastProgress = 25;
                const result = await this.pollTaskStatus(
                    submission.taskId,
                    60,
                    5000
                );
                
                // Update progress during polling
                const progressInterval = setInterval(() => {
                    if (lastProgress < 90) {
                        lastProgress += 5;
                        if (onProgress) onProgress('processing', lastProgress);
                    }
                }, 2000);
                
                // Clear interval when done
                clearInterval(progressInterval);
                
                return result;
            };
            
            const status = await pollWithProgress();
            
            // Step 3: Get content
            if (onProgress) onProgress('retrieving', 95);
            
            if (status.folderName) {
                const content = await this.getGeneratedContent(status.folderName);
                if (onProgress) onProgress('completed', 100);
                return content;
            }
            
            throw new Error('No folder name in completed task');
            
        } catch (error) {
            if (onProgress) onProgress('error', 0);
            throw error;
        }
    }
}

// Singleton instance for convenience
let apiInstance = null;

export function getAPI(config) {
    if (!apiInstance) {
        apiInstance = new Pod2PostAPI(config);
    }
    return apiInstance;
}

export default Pod2PostAPI;