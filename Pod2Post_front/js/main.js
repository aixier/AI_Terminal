/* Pod2Post - Main Application Entry Point */

import Navigation from './components/navigation.js';
import ProductFlow from './components/productFlow.js';
import Pod2PostAPI from './api/pod2post.js';
import config from '../config/config.js';

class Pod2PostApp {
    constructor() {
        this.navigation = null;
        this.productFlow = null;
        this.api = null;
        this.init();
    }

    async init() {
        try {
            // Initialize API
            this.api = new Pod2PostAPI(config.api);
            
            // Make API available globally for components
            window.pod2postAPI = this.api;
            
            // Initialize navigation
            this.navigation = new Navigation();
            
            // Load product flow template
            await this.loadProductFlowTemplate();
            
            // Initialize product flow
            this.productFlow = new ProductFlow();
            
            // Make product flow available globally
            window.productFlow = this.productFlow;
            
            // Setup global event handlers
            this.setupGlobalHandlers();
            
            // Initialize UI
            this.initializeUI();
            
            console.log('Pod2Post application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    async loadProductFlowTemplate() {
        try {
            const response = await fetch('templates/product-flow.html');
            const html = await response.text();
            
            const productFlowContainer = document.getElementById('productFlow');
            if (productFlowContainer) {
                productFlowContainer.innerHTML = html;
                productFlowContainer.classList.add('product-flow');
            }
        } catch (error) {
            console.error('Failed to load product flow template:', error);
        }
    }

    setupGlobalHandlers() {
        // Global upload manager access for inline handlers
        if (this.productFlow && this.productFlow.uploadManager) {
            window.uploadManager = this.productFlow.uploadManager;
        }
        
        // Setup file upload button handlers
        this.setupFileUploadHandlers();
        
        // Setup correction handlers
        this.setupCorrectionHandlers();
        
        // Handle browser back button
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view === 'home') {
                this.showHomePage();
            }
        });
    }

    setupFileUploadHandlers() {
        // Content photos
        const contentBtn = document.getElementById('contentUploadBtn');
        const contentInput = document.getElementById('contentFilesInput');
        if (contentBtn && contentInput) {
            contentBtn.addEventListener('click', () => contentInput.click());
            contentInput.addEventListener('change', (e) => {
                this.productFlow.uploadManager.handleFileUpload(e, 'content');
                this.productFlow.checkStepCompletion();
            });
        }

        // Cover top photo
        const coverTopBtn = document.getElementById('coverTopUploadBtn');
        const coverTopInput = document.getElementById('coverTopInput');
        if (coverTopBtn && coverTopInput) {
            coverTopBtn.addEventListener('click', () => coverTopInput.click());
            coverTopInput.addEventListener('change', (e) => {
                this.productFlow.uploadManager.handleFileUpload(e, 'coverTop');
                this.productFlow.checkStepCompletion();
            });
        }

        // Cover bottom photo
        const coverBottomBtn = document.getElementById('coverBottomUploadBtn');
        const coverBottomInput = document.getElementById('coverBottomInput');
        if (coverBottomBtn && coverBottomInput) {
            coverBottomBtn.addEventListener('click', () => coverBottomInput.click());
            coverBottomInput.addEventListener('change', (e) => {
                this.productFlow.uploadManager.handleFileUpload(e, 'coverBottom');
                this.productFlow.checkStepCompletion();
            });
        }

        // Audio file
        const audioBtn = document.getElementById('audioUploadBtn');
        const audioInput = document.getElementById('audioInput');
        if (audioBtn && audioInput) {
            audioBtn.addEventListener('click', () => audioInput.click());
            audioInput.addEventListener('change', (e) => {
                this.productFlow.uploadManager.handleFileUpload(e, 'audio');
                this.productFlow.checkStepCompletion();
            });
        }
    }

    setupCorrectionHandlers() {
        // Add correction button
        const addCorrectionBtn = document.getElementById('addCorrectionBtn');
        if (addCorrectionBtn) {
            addCorrectionBtn.addEventListener('click', () => {
                this.productFlow.addCorrection();
            });
        }

        // Remove correction buttons (delegated event handling)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('correction-remove')) {
                this.productFlow.removeCorrection(e.target);
            }
        });
    }

    initializeUI() {
        // Set initial theme
        this.applyTheme(config.ui.theme);
        
        // Enable/disable features based on config
        if (!config.features.enableDragDrop) {
            this.disableDragDrop();
        }
        
        // Setup smooth scroll if enabled
        if (config.ui.smoothScroll) {
            this.enableSmoothScroll();
        }
    }

    applyTheme(theme) {
        document.body.dataset.theme = theme;
    }

    disableDragDrop() {
        const uploadGroups = document.querySelectorAll('.upload-group');
        uploadGroups.forEach(group => {
            group.style.pointerEvents = 'none';
        });
    }

    enableSmoothScroll() {
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    showHomePage() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'block';
        if (productFlow) productFlow.classList.remove('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Public API methods
    async processWithRealAPI(formData) {
        if (!this.api) {
            throw new Error('API not initialized');
        }

        try {
            // Show processing UI
            this.productFlow.goToStep(4);
            
            // Submit to API with progress tracking
            const result = await this.api.generatePodcastCards(formData, (status, progress) => {
                this.updateProcessingProgress(status, progress);
            });
            
            // Show results
            this.displayResults(result);
            
        } catch (error) {
            console.error('API processing failed:', error);
            this.showError(error.message);
        }
    }

    updateProcessingProgress(status, progress) {
        const progressText = document.getElementById('progressText');
        const progressRing = document.getElementById('progressRing');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressText) progressText.textContent = `${progress}%`;
        
        if (progressRing) {
            const radius = 52;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (progress / 100) * circumference;
            progressRing.style.strokeDasharray = `${circumference - offset} ${circumference}`;
        }
        
        if (progressStatus) {
            const statusMessages = {
                'submitting': 'Submitting task...',
                'processing': 'Processing your podcast...',
                'retrieving': 'Retrieving generated cards...',
                'completed': 'Processing complete!',
                'error': 'An error occurred'
            };
            progressStatus.textContent = statusMessages[status] || status;
        }
    }

    displayResults(result) {
        const resultPreview = document.getElementById('resultPreview');
        if (!resultPreview) return;
        
        // Check if result has HTML content
        if (result.html) {
            resultPreview.innerHTML = `
                <iframe 
                    srcdoc="${this.escapeHtml(result.html)}"
                    style="width: 100%; height: 100%; border: none; border-radius: 16px;"
                    title="Generated Cards">
                </iframe>
            `;
        } else if (result.cards) {
            // Display individual cards
            this.displayCardGrid(result.cards);
        } else {
            resultPreview.innerHTML = '<p>No results available</p>';
        }
        
        // Move to results step
        this.productFlow.goToStep(5);
    }

    displayCardGrid(cards) {
        const resultPreview = document.getElementById('resultPreview');
        if (!resultPreview) return;
        
        const gridHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px;">
                ${cards.map(card => `
                    <div style="aspect-ratio: 3/4; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        ${card.image ? `<img src="${card.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `
                            <div style="padding: 20px;">
                                <h4>${card.title || 'Card'}</h4>
                                <p>${card.content || ''}</p>
                            </div>
                        `}
                    </div>
                `).join('')}
            </div>
        `;
        
        resultPreview.innerHTML = gridHtml;
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
            <h3 style="color: var(--danger-red); margin-bottom: 16px;">Error</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
            <button class="btn-primary" onclick="this.closest('.error-modal').remove()">OK</button>
        `;
        
        document.body.appendChild(modal);
    }

    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pod2postApp = new Pod2PostApp();
});

// Export for module usage
export default Pod2PostApp;