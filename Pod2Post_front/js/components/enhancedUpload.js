/* Pod2Post - Enhanced Upload Manager with Immediate Upload */

import UploadService from '../services/uploadService.js';

export class EnhancedUploadManager {
    constructor() {
        this.uploadService = new UploadService();
        this.uploadedFiles = {
            content: [],      // Content photos (pic endpoint)
            coverTop: null,   // Cover top (cdn endpoint)
            coverBottom: null, // Cover bottom (cdn endpoint)
            audio: null       // Audio file
        };
        this.uploadResults = {
            pic: null,
            cdn: null,
            audio: null
        };
        this.maxContentPhotos = 10;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.maxAudioSize = 100 * 1024 * 1024; // 100MB
    }

    /**
     * Handle file selection and immediate upload
     */
    async handleFileUpload(event, type) {
        const files = Array.from(event.target.files);
        
        if (!files.length) return false;
        
        // Show immediate feedback
        this.showUploadingStatus(type);
        
        try {
            if (type === 'content') {
                return await this.handleContentUpload(files);
            } else if (type === 'audio') {
                return await this.handleAudioUpload(files[0]);
            } else {
                return await this.handleCoverUpload(files[0], type);
            }
        } catch (error) {
            this.showErrorStatus(type, error.message);
            return false;
        }
    }

    /**
     * Handle content photos upload (pic endpoint)
     */
    async handleContentUpload(files) {
        // Validate files
        const validFiles = [];
        for (const file of files) {
            if (this.validateImageFile(file)) {
                validFiles.push(file);
            }
        }
        
        if (this.uploadedFiles.content.length + validFiles.length > this.maxContentPhotos) {
            throw new Error(`Maximum ${this.maxContentPhotos} content photos allowed`);
        }
        
        // Upload to server immediately
        const result = await this.uploadService.uploadPicImages(validFiles, (progress) => {
            this.updateUploadProgress('content', progress);
        });
        
        if (result.success) {
            this.uploadedFiles.content.push(...validFiles);
            this.uploadResults.pic = result.data;
            this.showSuccessStatus('content', validFiles.length);
            this.updateFilePreview('content');
            return true;
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    }

    /**
     * Handle cover photos upload (cdn endpoint)
     */
    async handleCoverUpload(file, type) {
        // Validate file
        if (!this.validateImageFile(file)) {
            return false;
        }
        
        // Upload to server immediately
        const result = await this.uploadService.uploadCdnImages([file], (progress) => {
            this.updateUploadProgress(type, progress);
        });
        
        if (result.success) {
            this.uploadedFiles[type] = file;
            
            // Store CDN result
            if (!this.uploadResults.cdn) {
                this.uploadResults.cdn = { files: [] };
            }
            this.uploadResults.cdn.files.push(...(result.data.uploadedFiles || []));
            
            this.showSuccessStatus(type, 1);
            this.updateFilePreview(type);
            return true;
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    }

    /**
     * Handle audio file upload
     */
    async handleAudioUpload(file) {
        // Validate file
        if (!this.validateAudioFile(file)) {
            return false;
        }
        
        // For audio, we store locally first (no immediate server upload)
        this.uploadedFiles.audio = file;
        this.uploadResults.audio = { file, uploaded: false };
        
        this.showSuccessStatus('audio', 1);
        this.updateFilePreview('audio');
        return true;
    }

    /**
     * Show uploading status with spinner
     */
    showUploadingStatus(type) {
        const statusElement = this.getStatusElement(type);
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="upload-status uploading">
                    <div class="spinner"></div>
                    <span>Uploading...</span>
                </div>
            `;
        }
    }

    /**
     * Show upload progress
     */
    updateUploadProgress(type, progress) {
        const statusElement = this.getStatusElement(type);
        if (statusElement && progress.progress !== undefined) {
            statusElement.innerHTML = `
                <div class="upload-status uploading">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.progress}%"></div>
                    </div>
                    <span>${progress.progress}%</span>
                </div>
            `;
        }
    }

    /**
     * Show success status
     */
    showSuccessStatus(type, fileCount) {
        const statusElement = this.getStatusElement(type);
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="upload-status success">
                    <i class="bi bi-check-circle-fill"></i>
                    <span>${fileCount} file(s) uploaded successfully</span>
                </div>
            `;
            
            // Clear status after 3 seconds
            setTimeout(() => {
                statusElement.innerHTML = '';
            }, 3000);
        }
    }

    /**
     * Show error status
     */
    showErrorStatus(type, message) {
        const statusElement = this.getStatusElement(type);
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="upload-status error">
                    <i class="bi bi-exclamation-circle-fill"></i>
                    <span>${message}</span>
                </div>
            `;
            
            // Clear status after 5 seconds
            setTimeout(() => {
                statusElement.innerHTML = '';
            }, 5000);
        }
    }

    /**
     * Get status element for type
     */
    getStatusElement(type) {
        const statusMap = {
            'content': 'contentUploadStatus',
            'coverTop': 'coverTopUploadStatus',
            'coverBottom': 'coverBottomUploadStatus',
            'audio': 'audioUploadStatus'
        };
        return document.getElementById(statusMap[type]);
    }

    /**
     * Validate image file
     */
    validateImageFile(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Please upload an image file');
        }
        
        if (file.size > this.maxFileSize) {
            throw new Error('Image file size must be less than 5MB');
        }
        
        return true;
    }

    /**
     * Validate audio file
     */
    validateAudioFile(file) {
        if (!file.type.includes('audio') && !file.name.endsWith('.mp3')) {
            throw new Error('Please upload an MP3 audio file');
        }
        
        if (file.size > this.maxAudioSize) {
            throw new Error('Audio file size must be less than 100MB');
        }
        
        return true;
    }

    /**
     * Update file preview
     */
    updateFilePreview(type) {
        const previewMap = {
            'content': 'contentPreview',
            'coverTop': 'coverTopPreview',
            'coverBottom': 'coverBottomPreview',
            'audio': 'audioPreview'
        };
        
        const preview = document.getElementById(previewMap[type]);
        if (!preview) return;
        
        if (type === 'content') {
            this.updateContentPreview(preview);
        } else if (type === 'audio') {
            this.updateAudioPreview(preview);
        } else {
            this.updateImagePreview(preview, type);
        }
    }

    /**
     * Update content photos preview
     */
    updateContentPreview(preview) {
        preview.innerHTML = '';
        this.uploadedFiles.content.forEach((file, index) => {
            const thumbnail = this.createThumbnail(file, () => this.removeFile('content', index));
            preview.appendChild(thumbnail);
        });
    }

    /**
     * Update audio preview
     */
    updateAudioPreview(preview) {
        if (!this.uploadedFiles.audio) {
            preview.innerHTML = '';
            return;
        }
        
        preview.innerHTML = `
            <div class="audio-preview">
                <i class="bi bi-music-note-beamed"></i>
                <span>${this.uploadedFiles.audio.name}</span>
                <button class="file-remove" onclick="window.enhancedUploadManager.removeFile('audio')">×</button>
            </div>
        `;
    }

    /**
     * Update single image preview
     */
    updateImagePreview(preview, type) {
        preview.innerHTML = '';
        if (this.uploadedFiles[type]) {
            const thumbnail = this.createThumbnail(
                this.uploadedFiles[type], 
                () => this.removeFile(type)
            );
            preview.appendChild(thumbnail);
        }
    }

    /**
     * Create thumbnail element
     */
    createThumbnail(file, onRemove) {
        const div = document.createElement('div');
        div.className = 'file-thumbnail uploaded';
        
        const img = document.createElement('img');
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = onRemove;
        
        // Add upload success indicator
        const successBadge = document.createElement('div');
        successBadge.className = 'upload-badge';
        successBadge.innerHTML = '<i class="bi bi-cloud-check-fill"></i>';
        
        div.appendChild(img);
        div.appendChild(removeBtn);
        div.appendChild(successBadge);
        
        return div;
    }

    /**
     * Remove file
     */
    removeFile(type, index = null) {
        if (type === 'content' && index !== null) {
            this.uploadedFiles.content.splice(index, 1);
            // Note: We don't remove from server, just from local list
        } else {
            this.uploadedFiles[type] = null;
        }
        
        this.updateFilePreview(type);
        
        // Trigger validation check
        if (window.productFlow) {
            window.productFlow.checkStepCompletion();
        }
    }

    /**
     * Get upload results for final submission
     */
    getUploadResults() {
        return this.uploadResults;
    }

    /**
     * Check if all required files are uploaded
     */
    hasRequiredFiles(step) {
        switch(step) {
            case 1:
                // Check if files are uploaded to server
                return this.uploadResults.pic !== null && 
                       this.uploadResults.cdn !== null;
            case 2:
                return this.uploadedFiles.audio !== null;
            default:
                return false;
        }
    }

    /**
     * Reset all uploads
     */
    reset() {
        this.uploadedFiles = {
            content: [],
            coverTop: null,
            coverBottom: null,
            audio: null
        };
        this.uploadResults = {
            pic: null,
            cdn: null,
            audio: null
        };
        this.uploadService.resetStatus();
    }
}

export default EnhancedUploadManager;