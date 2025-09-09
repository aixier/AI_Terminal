/* Pod2Post - Enhanced Product Flow with Immediate Upload */

import EnhancedUploadManager from './enhancedUpload.js';
import UploadService from '../services/uploadService.js';
import PromptBuilder from '../services/promptBuilder.js';
import { ProcessingAnimation } from '../utils/animations.js';

export class EnhancedProductFlow {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.userType = 'basic';
        
        // Initialize services
        this.uploadManager = new EnhancedUploadManager();
        this.uploadService = new UploadService();
        this.promptBuilder = new PromptBuilder();
        this.processingAnimation = new ProcessingAnimation();
        
        // Form data
        this.formData = {
            hostNames: '',
            guestNames: '',
            episodeTitle: '',
            episodeDescription: '',
            corrections: [],
            customInstructions: ''
        };
        
        // Task info
        this.taskId = null;
        this.folderName = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupImmediateUpload();
    }

    setupEventListeners() {
        // Step navigation
        this.setupStepButtons();
        
        // User type selection
        this.setupUserTypeSelection();
        
        // Name inputs
        this.setupNameInputs();
        
        // CTA buttons
        this.setupCTAButtons();
        
        // Corrections
        this.setupCorrections();
    }

    setupImmediateUpload() {
        // Content photos with immediate upload
        const contentInput = document.getElementById('contentFilesInput');
        if (contentInput) {
            contentInput.addEventListener('change', async (e) => {
                await this.uploadManager.handleFileUpload(e, 'content');
                this.checkStepCompletion();
            });
        }

        // Cover top with immediate upload
        const coverTopInput = document.getElementById('coverTopInput');
        if (coverTopInput) {
            coverTopInput.addEventListener('change', async (e) => {
                await this.uploadManager.handleFileUpload(e, 'coverTop');
                this.checkStepCompletion();
            });
        }

        // Cover bottom with immediate upload
        const coverBottomInput = document.getElementById('coverBottomInput');
        if (coverBottomInput) {
            coverBottomInput.addEventListener('change', async (e) => {
                await this.uploadManager.handleFileUpload(e, 'coverBottom');
                this.checkStepCompletion();
            });
        }

        // Audio file
        const audioInput = document.getElementById('audioInput');
        if (audioInput) {
            audioInput.addEventListener('change', async (e) => {
                await this.uploadManager.handleFileUpload(e, 'audio');
                this.checkStepCompletion();
            });
        }
    }

    setupStepButtons() {
        // Step 1 Next
        const step1Btn = document.getElementById('step1NextBtn');
        if (step1Btn) {
            step1Btn.addEventListener('click', () => {
                if (this.validateStep1()) {
                    this.goToStep(2);
                }
            });
        }

        // Step 2 Next
        const step2Btn = document.getElementById('step2NextBtn');
        if (step2Btn) {
            step2Btn.addEventListener('click', () => {
                if (this.validateStep2()) {
                    this.goToStep(3);
                }
            });
        }

        // Step 3 Generate
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.startGeneration();
            });
        }

        // Step 5 Download/Share
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadResults();
            });
        }

        // Step 6 Finish
        const finishBtn = document.getElementById('finishBtn');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                this.finishProcess();
            });
        }
    }

    setupUserTypeSelection() {
        const basicType = document.getElementById('basicType');
        const proType = document.getElementById('proType');
        
        if (basicType) {
            basicType.addEventListener('click', () => {
                this.selectUserType('basic');
            });
        }
        
        if (proType) {
            proType.addEventListener('click', () => {
                this.selectUserType('pro');
            });
        }
    }

    selectUserType(type) {
        this.userType = type;
        
        // Update UI
        document.querySelectorAll('.user-type-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        const selectedElement = type === 'basic' ? 
            document.getElementById('basicType') : 
            document.getElementById('proType');
            
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // Update prompt builder template
        this.promptBuilder.setTemplate(type === 'pro' ? 'professional' : 'default');
    }

    setupNameInputs() {
        const hostInput = document.getElementById('hostNameInput');
        const guestInput = document.getElementById('guestNameInput');
        
        if (hostInput) {
            hostInput.addEventListener('input', (e) => {
                this.formData.hostNames = e.target.value;
                this.checkStepCompletion();
            });
        }
        
        if (guestInput) {
            guestInput.addEventListener('input', (e) => {
                this.formData.guestNames = e.target.value;
                this.checkStepCompletion();
            });
        }
    }

    setupCTAButtons() {
        const ctaButtons = document.querySelectorAll('.cta-primary');
        ctaButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.start();
            });
        });
    }

    setupCorrections() {
        const addBtn = document.getElementById('addCorrectionBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addCorrection();
            });
        }
    }

    addCorrection() {
        const correctionList = document.getElementById('correctionList');
        if (!correctionList) return;
        
        const correctionItem = document.createElement('div');
        correctionItem.className = 'correction-item';
        correctionItem.innerHTML = `
            <span>Change</span>
            <input type="text" class="correction-input correction-from" placeholder="Incorrect name">
            <span>To</span>
            <input type="text" class="correction-input correction-to" placeholder="Correct name">
            <button class="correction-remove" onclick="this.parentElement.remove()">×</button>
        `;
        
        correctionList.appendChild(correctionItem);
    }

    getCorrections() {
        const corrections = [];
        const items = document.querySelectorAll('.correction-item');
        
        items.forEach(item => {
            const from = item.querySelector('.correction-from')?.value;
            const to = item.querySelector('.correction-to')?.value;
            
            if (from && to) {
                corrections.push({ from, to });
            }
        });
        
        return corrections;
    }

    start() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'none';
        if (productFlow) productFlow.classList.add('active');
        
        this.goToStep(1);
    }

    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > this.totalSteps) return;
        
        // Hide all steps
        for (let i = 1; i <= this.totalSteps; i++) {
            const step = document.getElementById(`step${i}`);
            const dot = document.getElementById(`dot${i}`);
            
            if (step) step.style.display = 'none';
            if (dot) dot.classList.remove('active');
        }
        
        // Show current step
        const currentStepEl = document.getElementById(`step${stepNumber}`);
        const currentDot = document.getElementById(`dot${stepNumber}`);
        
        if (currentStepEl) currentStepEl.style.display = 'block';
        if (currentDot) currentDot.classList.add('active');
        
        this.currentStep = stepNumber;
        
        // Special handling for processing step
        if (stepNumber === 4) {
            this.startProcessing();
        }
    }

    validateStep1() {
        const hasFiles = this.uploadManager.hasRequiredFiles(1);
        if (!hasFiles) {
            alert('Please upload all required photos before proceeding');
            return false;
        }
        return true;
    }

    validateStep2() {
        const hasAudio = this.uploadManager.hasRequiredFiles(2);
        if (!hasAudio) {
            alert('Please upload an audio file before proceeding');
            return false;
        }
        return true;
    }

    checkStepCompletion() {
        // Check step 1 completion
        if (this.currentStep === 1) {
            const step1Btn = document.getElementById('step1NextBtn');
            if (step1Btn) {
                step1Btn.disabled = !this.uploadManager.hasRequiredFiles(1);
            }
        }
        
        // Check step 2 completion
        if (this.currentStep === 2) {
            const step2Btn = document.getElementById('step2NextBtn');
            if (step2Btn) {
                step2Btn.disabled = !this.uploadManager.hasRequiredFiles(2);
            }
        }
        
        // Check step 3 completion
        if (this.currentStep === 3) {
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn) {
                generateBtn.disabled = !this.formData.hostNames && !this.formData.guestNames;
            }
        }
    }

    async startGeneration() {
        try {
            // Build prompt
            const prompt = this.promptBuilder.buildPrompt({
                hostNames: this.formData.hostNames,
                guestNames: this.formData.guestNames,
                corrections: this.getCorrections(),
                episodeTitle: this.formData.episodeTitle,
                episodeDescription: this.formData.episodeDescription,
                customInstructions: this.formData.customInstructions
            });
            
            // Validate prompt
            const validation = this.promptBuilder.validatePrompt(prompt);
            if (!validation.valid) {
                console.warn('Prompt validation issues:', validation.issues);
            }
            
            // Move to processing step
            this.goToStep(4);
            
            // Submit task
            const result = await this.uploadService.submitGenerationTask({
                prompt,
                hostName: this.formData.hostNames,
                guestNames: this.formData.guestNames,
                corrections: this.getCorrections()
            });
            
            if (result.success) {
                this.taskId = result.taskId;
                this.folderName = result.folderName;
                
                // Start polling for completion
                await this.waitForCompletion();
            } else {
                throw new Error(result.error || 'Task submission failed');
            }
            
        } catch (error) {
            console.error('Generation failed:', error);
            this.showError(error.message);
        }
    }

    async waitForCompletion() {
        try {
            const result = await this.uploadService.waitForCompletion(
                this.taskId,
                (progress) => this.updateProgress(progress)
            );
            
            if (result.success) {
                // Get results
                const content = await this.uploadService.getResults(this.folderName);
                
                if (content.success) {
                    this.displayResults(content.data);
                    this.goToStep(5);
                } else {
                    throw new Error('Failed to get results');
                }
            }
            
        } catch (error) {
            console.error('Processing failed:', error);
            this.showError(error.message);
        }
    }

    updateProgress(progress) {
        const progressRing = document.getElementById('progressRing');
        const progressText = document.getElementById('progressText');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressText) {
            progressText.textContent = `${progress.progress || 0}%`;
        }
        
        if (progressRing) {
            const radius = 52;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - ((progress.progress || 0) / 100) * circumference;
            progressRing.style.strokeDasharray = `${circumference - offset} ${circumference}`;
        }
        
        if (progressStatus) {
            progressStatus.textContent = this.getStatusMessage(progress.status);
        }
    }

    getStatusMessage(status) {
        const messages = {
            'submitting': 'Submitting task...',
            'processing': 'Processing your podcast...',
            'retrieving': 'Retrieving generated cards...',
            'completed': 'Processing complete!',
            'error': 'An error occurred'
        };
        return messages[status] || status;
    }

    startProcessing() {
        // This is handled by startGeneration
    }

    displayResults(data) {
        const resultPreview = document.getElementById('resultPreview');
        if (!resultPreview) return;
        
        if (data.content?.base64Html || data.content?.originalHtml) {
            const htmlContent = data.content.base64Html || data.content.originalHtml;
            resultPreview.innerHTML = `
                <iframe 
                    srcdoc="${this.escapeHtml(htmlContent)}"
                    style="width: 100%; height: 100%; border: none; border-radius: 16px;"
                    title="Generated Cards">
                </iframe>
            `;
        } else if (data.content?.base64HtmlOssUrl) {
            // If content is too large and stored in OSS
            resultPreview.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h3>Cards Generated Successfully!</h3>
                    <p>The generated content is ready for download.</p>
                    <a href="${data.content.base64HtmlOssUrl}" 
                       target="_blank" 
                       class="btn-primary"
                       style="display: inline-block; margin-top: 20px;">
                        Download HTML File
                    </a>
                </div>
            `;
        }
        
        // Store results for download
        this.generatedContent = data;
    }

    downloadResults() {
        if (!this.generatedContent) return;
        
        // If we have OSS URL, open it
        if (this.generatedContent.content?.base64HtmlOssUrl) {
            window.open(this.generatedContent.content.base64HtmlOssUrl, '_blank');
        } else if (this.generatedContent.content?.base64Html) {
            // Create blob and download
            const blob = new Blob([this.generatedContent.content.base64Html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `podcast-cards-${Date.now()}.html`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    finishProcess() {
        // Show completion message
        this.goToStep(6);
        
        // Reset after delay
        setTimeout(() => {
            this.reset();
            this.goToHome();
        }, 3000);
    }

    goToHome() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'block';
        if (productFlow) productFlow.classList.remove('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showError(message) {
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 400px;
        `;
        
        modal.innerHTML = `
            <h3 style="color: #e74c3c; margin-bottom: 16px;">Error</h3>
            <p style="color: #666; margin-bottom: 24px;">${message}</p>
            <button class="btn-primary" onclick="this.closest('.error-modal').remove()">OK</button>
        `;
        
        document.body.appendChild(modal);
    }

    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    reset() {
        this.currentStep = 1;
        this.uploadManager.reset();
        this.formData = {
            hostNames: '',
            guestNames: '',
            episodeTitle: '',
            episodeDescription: '',
            corrections: [],
            customInstructions: ''
        };
        this.taskId = null;
        this.folderName = null;
        this.generatedContent = null;
    }
}

export default EnhancedProductFlow;