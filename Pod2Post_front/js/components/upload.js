/* Pod2Post - Upload Component */

export class UploadManager {
    constructor() {
        this.uploadedFiles = {
            content: [],
            coverTop: null,
            coverBottom: null,
            audio: null
        };
        this.maxContentPhotos = 10;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.maxAudioSize = 100 * 1024 * 1024; // 100MB
    }

    triggerFileUpload(type) {
        const inputMap = {
            'content': 'contentFilesInput',
            'coverTop': 'coverTopInput',
            'coverBottom': 'coverBottomInput',
            'audio': 'audioInput'
        };
        
        const input = document.getElementById(inputMap[type]);
        if (input) input.click();
    }

    handleFileUpload(event, type) {
        const files = event.target.files;
        
        if (type === 'content') {
            return this.handleContentUpload(files);
        } else {
            return this.handleSingleFileUpload(files[0], type);
        }
    }

    handleContentUpload(files) {
        // Check max photos limit
        if (this.uploadedFiles.content.length + files.length > this.maxContentPhotos) {
            alert(`Maximum ${this.maxContentPhotos} content photos allowed`);
            return false;
        }
        
        // Validate and add files
        for (let i = 0; i < files.length; i++) {
            if (this.validateImageFile(files[i])) {
                this.uploadedFiles.content.push(files[i]);
            }
        }
        
        this.updateFilePreview('content');
        return true;
    }

    handleSingleFileUpload(file, type) {
        if (!file) return false;
        
        // Validate based on type
        let isValid = false;
        if (type === 'audio') {
            isValid = this.validateAudioFile(file);
        } else {
            isValid = this.validateImageFile(file);
        }
        
        if (isValid) {
            this.uploadedFiles[type] = file;
            this.updateFilePreview(type);
            return true;
        }
        
        return false;
    }

    validateImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return false;
        }
        
        if (file.size > this.maxFileSize) {
            alert('Image file size must be less than 5MB');
            return false;
        }
        
        return true;
    }

    validateAudioFile(file) {
        if (!file.type.includes('audio') && !file.name.endsWith('.mp3')) {
            alert('Please upload an MP3 audio file');
            return false;
        }
        
        if (file.size > this.maxAudioSize) {
            alert('Audio file size must be less than 100MB');
            return false;
        }
        
        return true;
    }

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

    updateContentPreview(preview) {
        preview.innerHTML = '';
        this.uploadedFiles.content.forEach((file, index) => {
            const thumbnail = this.createThumbnail(file, () => this.removeFile('content', index));
            preview.appendChild(thumbnail);
        });
    }

    updateAudioPreview(preview) {
        if (!this.uploadedFiles.audio) {
            preview.innerHTML = '';
            return;
        }
        
        preview.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; justify-content: center; padding: 16px; background: var(--cream-light); border-radius: 12px;">
                <i class="bi bi-music-note-beamed" style="font-size: 24px; color: #FFD700;"></i>
                <span style="font-weight: 500;">${this.uploadedFiles.audio.name}</span>
                <button class="file-remove" onclick="uploadManager.removeFile('audio')">×</button>
            </div>
        `;
    }

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

    createThumbnail(file, onRemove) {
        const div = document.createElement('div');
        div.className = 'file-thumbnail';
        
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
        
        div.appendChild(img);
        div.appendChild(removeBtn);
        
        return div;
    }

    removeFile(type, index = null) {
        if (type === 'content' && index !== null) {
            this.uploadedFiles.content.splice(index, 1);
        } else {
            this.uploadedFiles[type] = null;
        }
        
        this.updateFilePreview(type);
        
        // Trigger validation check
        if (window.productFlow) {
            window.productFlow.checkStepCompletion();
        }
    }

    setupDragAndDrop() {
        const uploadGroups = document.querySelectorAll('.upload-group');
        
        uploadGroups.forEach(group => {
            group.addEventListener('dragover', (e) => {
                e.preventDefault();
                group.classList.add('dragover');
            });
            
            group.addEventListener('dragleave', (e) => {
                e.preventDefault();
                group.classList.remove('dragover');
            });
            
            group.addEventListener('drop', (e) => {
                e.preventDefault();
                group.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                const groupId = group.id;
                
                // Determine upload type
                let uploadType = this.getUploadTypeFromGroupId(groupId);
                
                if (uploadType) {
                    this.handleDroppedFiles(files, uploadType);
                }
            });
        });
    }

    getUploadTypeFromGroupId(groupId) {
        const typeMap = {
            'contentPhotos': 'content',
            'coverTopPhoto': 'coverTop',
            'coverBottomPhoto': 'coverBottom',
            'audioUpload': 'audio'
        };
        return typeMap[groupId] || null;
    }

    handleDroppedFiles(files, uploadType) {
        const event = { target: { files } };
        this.handleFileUpload(event, uploadType);
        
        // Trigger validation
        if (window.productFlow) {
            window.productFlow.checkStepCompletion();
        }
    }

    getUploadedFiles() {
        return this.uploadedFiles;
    }

    hasRequiredFiles(step) {
        switch(step) {
            case 1:
                return this.uploadedFiles.content.length > 0 && 
                       this.uploadedFiles.coverTop && 
                       this.uploadedFiles.coverBottom;
            case 2:
                return this.uploadedFiles.audio !== null;
            default:
                return false;
        }
    }

    reset() {
        this.uploadedFiles = {
            content: [],
            coverTop: null,
            coverBottom: null,
            audio: null
        };
    }
}

export default UploadManager;