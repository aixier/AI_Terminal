/* Pod2Post - Product Flow Component */

import UploadManager from './upload.js';
import { ProcessingAnimation } from '../utils/animations.js';

export class ProductFlow {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.userType = 'basic';
        this.uploadManager = new UploadManager();
        this.processingAnimation = new ProcessingAnimation();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.uploadManager.setupDragAndDrop();
    }

    setupEventListeners() {
        // Step navigation buttons
        this.setupStepButtons();
        
        // User type selection
        this.setupUserTypeSelection();
        
        // Name inputs
        this.setupNameInputs();
        
        // CTA buttons
        this.setupCTAButtons();
    }

    setupStepButtons() {
        // Step 1 Next
        const step1Btn = document.getElementById('step1NextBtn');
        if (step1Btn) {
            step1Btn.addEventListener('click', () => this.goToStep(2));
        }

        // Step 2 Navigation
        const step2BackBtn = document.querySelector('#step2 .btn-secondary');
        const step2NextBtn = document.getElementById('step2NextBtn');
        if (step2BackBtn) {
            step2BackBtn.addEventListener('click', () => this.goToStep(1));
        }
        if (step2NextBtn) {
            step2NextBtn.addEventListener('click', () => this.goToStep(3));
        }

        // Step 3 Navigation
        const step3BackBtn = document.querySelector('#step3 .btn-secondary');
        const step3NextBtn = document.getElementById('step3NextBtn');
        if (step3BackBtn) {
            step3BackBtn.addEventListener('click', () => this.goToStep(2));
        }
        if (step3NextBtn) {
            step3NextBtn.addEventListener('click', () => this.goToStep(4));
        }

        // Step 5 Navigation
        const step5BackBtn = document.querySelector('#step5 .btn-secondary');
        const step5NextBtn = document.querySelector('#step5 .btn-primary');
        if (step5BackBtn) {
            step5BackBtn.addEventListener('click', () => this.goToStep(3));
        }
        if (step5NextBtn) {
            step5NextBtn.addEventListener('click', () => this.goToStep(6));
        }
    }

    setupUserTypeSelection() {
        const basicType = document.getElementById('basicType');
        const proType = document.getElementById('proType');
        
        if (basicType) {
            basicType.addEventListener('click', () => this.selectUserType('basic'));
        }
        if (proType) {
            proType.addEventListener('click', () => this.selectUserType('pro'));
        }
    }

    setupNameInputs() {
        const hostInput = document.getElementById('hostName');
        const guestInput = document.getElementById('guestName');
        
        if (hostInput) {
            hostInput.addEventListener('input', () => this.checkStepCompletion());
        }
        if (guestInput) {
            guestInput.addEventListener('input', () => this.checkStepCompletion());
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

    start() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'none';
        if (productFlow) productFlow.classList.add('active');
        
        // Reset to step 1
        this.goToStep(1);
    }

    goToStep(stepNumber) {
        // Validate step number
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
        
        // Handle special step logic
        this.handleStepTransition(stepNumber);
    }

    handleStepTransition(stepNumber) {
        switch(stepNumber) {
            case 4:
                this.startProcessing();
                break;
            case 5:
                this.loadResults();
                break;
            case 6:
                this.startFinalProcessing();
                break;
        }
    }

    selectUserType(type) {
        this.userType = type;
        
        // Update UI
        const basicType = document.getElementById('basicType');
        const proType = document.getElementById('proType');
        
        if (basicType) {
            basicType.classList.toggle('selected', type === 'basic');
        }
        if (proType) {
            proType.classList.toggle('selected', type === 'pro');
        }
        
        // Update cover bottom description
        this.updateCoverBottomDescription(type);
    }

    updateCoverBottomDescription(type) {
        const description = document.getElementById('coverBottomDescription');
        const examples = document.getElementById('coverBottomExamples');
        
        if (!description || !examples) return;
        
        if (type === 'basic') {
            description.textContent = 'Upload 1 photo that\'s already been background-removed (Basic users)';
            examples.innerHTML = `
                <div class="example-img">Basic: Pre-cut Image</div>
                <div class="example-img">With Background Removed</div>
            `;
        } else {
            description.textContent = 'Upload 1 photo for cover bottom (Pro users - we\'ll handle background removal)';
            examples.innerHTML = `
                <div class="example-img">Pro: Original Photo</div>
                <div class="example-img">We Remove Background</div>
            `;
        }
    }

    checkStepCompletion() {
        const step1Btn = document.getElementById('step1NextBtn');
        const step2Btn = document.getElementById('step2NextBtn');
        const step3Btn = document.getElementById('step3NextBtn');
        
        switch(this.currentStep) {
            case 1:
                if (step1Btn) {
                    step1Btn.disabled = !this.uploadManager.hasRequiredFiles(1);
                }
                break;
            case 2:
                if (step2Btn) {
                    step2Btn.disabled = !this.uploadManager.hasRequiredFiles(2);
                }
                break;
            case 3:
                if (step3Btn) {
                    const hostName = document.getElementById('hostName')?.value.trim();
                    const guestName = document.getElementById('guestName')?.value.trim();
                    step3Btn.disabled = !hostName || !guestName;
                }
                break;
        }
    }

    startProcessing() {
        this.processingAnimation.start(() => {
            // Auto advance to results after processing
            setTimeout(() => {
                this.goToStep(5);
            }, 2000);
        });
    }

    loadResults() {
        const resultPreview = document.getElementById('resultPreview');
        if (!resultPreview) return;
        
        // Load mock results for demo
        resultPreview.innerHTML = this.generateMockResultsHTML();
    }

    generateMockResultsHTML() {
        return `
            <iframe 
                src="data:text/html;charset=utf-8,${encodeURIComponent(this.getMockResultContent())}"
                style="width: 100%; height: 100%; border: none; border-radius: 16px;"
                title="Generated Cards Preview">
            </iframe>
        `;
    }

    getMockResultContent() {
        return `
            <html>
            <body style='margin:0;padding:20px;font-family:Inter,sans-serif;background:#f8f9fa;'>
                <h3 style='text-align:center;color:#333;margin-bottom:20px;'>Generated Podcast Cards Preview</h3>
                <div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;'>
                    <div style='aspect-ratio:3/4;background:linear-gradient(135deg,#FFE77B,#FFD700);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;color:#6B5D00;'>
                        <h4>Cover Card</h4>
                        <p>Episode title and guest info</p>
                    </div>
                    <div style='aspect-ratio:3/4;background:#fff;border-radius:16px;padding:20px;border:1px solid #e5e5e5;'>
                        <h4>Quote Card 1</h4>
                        <p style='font-style:italic;color:#666;'>Key quote from conversation...</p>
                    </div>
                    <div style='aspect-ratio:3/4;background:#fff;border-radius:16px;padding:20px;border:1px solid #e5e5e5;'>
                        <h4>Quote Card 2</h4>
                        <p style='font-style:italic;color:#666;'>Another insightful moment...</p>
                    </div>
                    <div style='aspect-ratio:3/4;background:#fff;border-radius:16px;padding:20px;border:1px solid #e5e5e5;'>
                        <h4>Quote Card 3</h4>
                        <p style='font-style:italic;color:#666;'>Final highlight...</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    startFinalProcessing() {
        // Simulate final processing
        setTimeout(() => {
            alert('Redirecting to sharing platform...');
            this.returnToHome();
        }, 3000);
    }

    returnToHome() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'block';
        if (productFlow) productFlow.classList.remove('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Reset flow
        this.reset();
    }

    reset() {
        this.currentStep = 1;
        this.userType = 'basic';
        this.uploadManager.reset();
        
        // Clear form inputs
        const hostName = document.getElementById('hostName');
        const guestName = document.getElementById('guestName');
        if (hostName) hostName.value = '';
        if (guestName) guestName.value = '';
        
        // Clear corrections
        const correctionList = document.getElementById('correctionList');
        if (correctionList) {
            correctionList.innerHTML = this.getDefaultCorrectionHTML();
        }
    }

    getDefaultCorrectionHTML() {
        return `
            <div class="correction-item">
                <span style="min-width: 60px; font-size: 14px;">Change</span>
                <input type="text" class="correction-input" placeholder="Incorrect name">
                <span style="min-width: 20px; text-align: center;">To</span>
                <input type="text" class="correction-input" placeholder="Correct name">
                <button class="file-remove" onclick="productFlow.removeCorrection(this)">×</button>
            </div>
        `;
    }

    addCorrection() {
        const correctionList = document.getElementById('correctionList');
        if (!correctionList) return;
        
        const newCorrection = document.createElement('div');
        newCorrection.className = 'correction-item';
        newCorrection.innerHTML = `
            <span style="min-width: 60px; font-size: 14px;">Change</span>
            <input type="text" class="correction-input" placeholder="Incorrect name">
            <span style="min-width: 20px; text-align: center;">To</span>
            <input type="text" class="correction-input" placeholder="Correct name">
            <button class="file-remove" onclick="productFlow.removeCorrection(this)">×</button>
        `;
        correctionList.appendChild(newCorrection);
    }

    removeCorrection(button) {
        button.closest('.correction-item').remove();
    }

    getFormData() {
        return {
            userType: this.userType,
            files: this.uploadManager.getUploadedFiles(),
            hostName: document.getElementById('hostName')?.value.trim(),
            guestName: document.getElementById('guestName')?.value.trim(),
            corrections: this.getCorrections()
        };
    }

    getCorrections() {
        const corrections = [];
        const correctionItems = document.querySelectorAll('.correction-item');
        
        correctionItems.forEach(item => {
            const inputs = item.querySelectorAll('.correction-input');
            if (inputs.length === 2) {
                const from = inputs[0].value.trim();
                const to = inputs[1].value.trim();
                if (from && to) {
                    corrections.push({ from, to });
                }
            }
        });
        
        return corrections;
    }
}

export default ProductFlow;