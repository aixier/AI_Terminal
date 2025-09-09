/* Pod2Post - Animation Utilities */

export class ProcessingAnimation {
    constructor() {
        this.progress = 0;
        this.interval = null;
        this.radius = 52;
        this.circumference = 2 * Math.PI * this.radius;
    }

    start(onComplete) {
        this.reset();
        
        const progressRing = document.getElementById('progressRing');
        const progressText = document.getElementById('progressText');
        const progressStatus = document.getElementById('progressStatus');
        
        if (!progressRing || !progressText || !progressStatus) {
            console.warn('Processing animation elements not found');
            if (onComplete) onComplete();
            return;
        }

        const steps = ['progressStep1', 'progressStep2', 'progressStep3', 'progressStep4'];
        const statusTexts = [
            'Processing audio transcript...',
            'Extracting key quotes...',
            'Designing visual layouts...',
            'Generating final cards...'
        ];
        
        let stepIndex = 0;
        
        this.interval = setInterval(() => {
            this.progress += 2;
            
            // Update progress ring
            const offset = this.circumference - (this.progress / 100) * this.circumference;
            progressRing.style.strokeDasharray = `${this.circumference - offset} ${this.circumference}`;
            progressText.textContent = this.progress + '%';
            
            // Update step progress
            if (this.progress === 25 || this.progress === 50 || this.progress === 75) {
                this.updateStep(steps, stepIndex, statusTexts, progressStatus);
                stepIndex++;
            }
            
            // Complete animation
            if (this.progress >= 100) {
                this.complete(steps, progressStatus, onComplete);
            }
        }, 100);
    }

    updateStep(steps, stepIndex, statusTexts, progressStatus) {
        // Mark previous step complete
        if (stepIndex > 0) {
            const prevStep = document.getElementById(steps[stepIndex - 1]);
            if (prevStep) {
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
                const icon = prevStep.querySelector('i');
                if (icon) icon.className = 'bi bi-check-circle-fill';
            }
        }
        
        // Activate current step
        if (stepIndex < steps.length) {
            const currentStep = document.getElementById(steps[stepIndex]);
            if (currentStep) {
                currentStep.classList.add('active');
            }
            progressStatus.textContent = statusTexts[stepIndex];
        }
    }

    complete(steps, progressStatus, onComplete) {
        clearInterval(this.interval);
        
        // Mark last step complete
        const lastStep = document.getElementById(steps[steps.length - 1]);
        if (lastStep) {
            lastStep.classList.remove('active');
            lastStep.classList.add('completed');
            const icon = lastStep.querySelector('i');
            if (icon) icon.className = 'bi bi-check-circle-fill';
        }
        
        progressStatus.textContent = 'Processing complete!';
        
        if (onComplete) {
            onComplete();
        }
    }

    reset() {
        this.progress = 0;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Reset all progress steps
        const steps = ['progressStep1', 'progressStep2', 'progressStep3', 'progressStep4'];
        steps.forEach((stepId, index) => {
            const step = document.getElementById(stepId);
            if (step) {
                step.classList.remove('completed', 'active');
                if (index === 0) {
                    step.classList.add('active');
                }
                const icon = step.querySelector('i');
                if (icon) icon.className = 'bi bi-circle';
            }
        });
        
        // Reset progress ring
        const progressRing = document.getElementById('progressRing');
        if (progressRing) {
            progressRing.style.strokeDasharray = '0 327';
        }
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = '0%';
        }
    }
}

export class LoadingSpinner {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    show(message = 'Loading...') {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="loading-spinner"></div>
            <p style="text-align: center; color: var(--text-secondary); margin-top: 20px;">
                ${message}
            </p>
        `;
    }

    hide() {
        if (!this.container) return;
        this.container.innerHTML = '';
    }
}

export class SmoothScroll {
    static to(element, options = {}) {
        const defaults = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        const settings = { ...defaults, ...options };
        
        if (element instanceof HTMLElement) {
            element.scrollIntoView(settings);
        } else if (typeof element === 'string') {
            const el = document.querySelector(element);
            if (el) el.scrollIntoView(settings);
        }
    }

    static toTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

export default {
    ProcessingAnimation,
    LoadingSpinner,
    SmoothScroll
};