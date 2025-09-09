/* Pod2Post - Upload Service with Immediate Upload */

import config from '../../config/config.js';

export class UploadService {
    constructor() {
        this.baseURL = config.api.baseURL;
        this.token = config.api.token || 'lijing-token-2025-pod2post';
        this.uploadStatus = {
            pic: { uploaded: false, files: [], loading: false },
            cdn: { uploaded: false, files: [], loading: false },
            audio: { uploaded: false, file: null, loading: false }
        };
    }

    /**
     * Upload images to /api/generate/pod2post/pic endpoint
     */
    async uploadPicImages(files, onProgress) {
        return this.uploadImages('/api/generate/pod2post/pic', files, 'pic', onProgress);
    }

    /**
     * Upload images to /api/generate/pod2post/cdn endpoint
     */
    async uploadCdnImages(files, onProgress) {
        return this.uploadImages('/api/generate/pod2post/cdn', files, 'cdn', onProgress);
    }

    /**
     * Generic image upload handler
     */
    async uploadImages(endpoint, files, type, onProgress) {
        try {
            this.uploadStatus[type].loading = true;
            
            const formData = new FormData();
            
            // Add files to FormData
            for (const file of files) {
                formData.append('images', file);
            }
            
            // Add clearBase64 parameter
            formData.append('clearBase64', 'true');
            
            // Call progress callback
            if (onProgress) {
                onProgress({ type, status: 'uploading', progress: 0 });
            }
            
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || `Upload failed: ${response.status}`);
            }
            
            if (result.success) {
                this.uploadStatus[type] = {
                    uploaded: true,
                    files: result.data.uploadedFiles || [],
                    loading: false
                };
                
                if (onProgress) {
                    onProgress({ 
                        type, 
                        status: 'completed', 
                        progress: 100,
                        data: result.data 
                    });
                }
                
                return { success: true, data: result.data };
            } else {
                throw new Error(result.message || 'Upload failed');
            }
            
        } catch (error) {
            this.uploadStatus[type].loading = false;
            
            if (onProgress) {
                onProgress({ 
                    type, 
                    status: 'error', 
                    error: error.message 
                });
            }
            
            console.error(`Upload ${type} failed:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Submit async generation task
     */
    async submitGenerationTask(params) {
        const { prompt, hostName, guestNames, corrections } = params;
        
        try {
            const response = await fetch(`${this.baseURL}/api/generate/pod2post/async`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: this.buildPrompt(prompt, hostName, guestNames, corrections),
                    token: this.token
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || `Task submission failed: ${response.status}`);
            }
            
            if (result.success) {
                return {
                    success: true,
                    taskId: result.data.taskId,
                    folderName: result.data.folderName
                };
            } else {
                throw new Error(result.message || 'Task submission failed');
            }
            
        } catch (error) {
            console.error('Task submission failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build prompt with host/guest names and corrections
     */
    buildPrompt(basePrompt, hostName, guestNames, corrections) {
        let prompt = basePrompt || this.getDefaultPrompt();
        
        // Add host and guest information
        if (hostName || guestNames) {
            prompt += '\n';
            if (hostName) {
                prompt += `本期主播：${hostName}。`;
            }
            if (guestNames) {
                prompt += `本期嘉宾：${guestNames}。`;
            }
        }
        
        // Add name corrections
        if (corrections && corrections.length > 0) {
            prompt += '\n名称修正：\n';
            corrections.forEach(corr => {
                if (corr.from && corr.to) {
                    prompt += `- 将"${corr.from}"修正为"${corr.to}"\n`;
                }
            });
        }
        
        return prompt;
    }

    /**
     * Get default prompt template
     */
    getDefaultPrompt() {
        return `阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md]，在[用户card路径]生成html和json文档。
需要使用的照片请遍历[photos]文件夹下的所有子目录寻找照片资源（比如照片、图片等文件夹），html图片资源使用绝对路径。
需要使用的其他素材在[CDN]文件夹中。`;
    }

    /**
     * Query task status
     */
    async queryTaskStatus(taskId) {
        try {
            const response = await fetch(`${this.baseURL}/api/generate/pod2post/status/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Status query failed: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Status query failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get generation results
     */
    async getResults(folderName) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/generate/pod2post/content/${folderName}?token=${this.token}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Get results failed: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Get results failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Poll for task completion
     */
    async waitForCompletion(taskId, onProgress, maxWaitTime = 1800000) {
        const startTime = Date.now();
        const pollingInterval = 3000;
        
        return new Promise((resolve, reject) => {
            const poll = async () => {
                if (Date.now() - startTime > maxWaitTime) {
                    reject(new Error('Task timeout'));
                    return;
                }
                
                const result = await this.queryTaskStatus(taskId);
                
                if (result.success && result.data) {
                    const status = result.data.status;
                    const progress = result.data.progress || 0;
                    
                    if (onProgress) {
                        onProgress({
                            status,
                            progress,
                            phases: result.data.phases
                        });
                    }
                    
                    if (status === 'completed') {
                        resolve({ success: true, data: result.data });
                    } else if (status === 'failed' || status === 'error') {
                        reject(new Error(result.data.error?.message || 'Task failed'));
                    } else {
                        setTimeout(poll, pollingInterval);
                    }
                } else {
                    setTimeout(poll, pollingInterval);
                }
            };
            
            poll();
        });
    }

    /**
     * Reset upload status
     */
    resetStatus() {
        this.uploadStatus = {
            pic: { uploaded: false, files: [], loading: false },
            cdn: { uploaded: false, files: [], loading: false },
            audio: { uploaded: false, file: null, loading: false }
        };
    }

    /**
     * Get current upload status
     */
    getUploadStatus() {
        return this.uploadStatus;
    }
}

export default UploadService;