/* Pod2Post - Navigation Component */

export class Navigation {
    constructor() {
        this.navbar = document.getElementById('navbar');
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Logo click - return to home
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.addEventListener('click', () => this.goToHome());
        }

        // Navigation links smooth scroll
        const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                this.scrollToSection(targetId);
            });
        });
    }

    goToHome() {
        const mainPage = document.querySelector('.main-page');
        const productFlow = document.getElementById('productFlow');
        
        if (mainPage) mainPage.style.display = 'block';
        if (productFlow) productFlow.classList.remove('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    showDashboard() {
        // Placeholder for dashboard functionality
        alert('Dashboard functionality coming soon!');
    }
}

export default Navigation;