/* Pod2Post - Configuration */

export const config = {
    // API Configuration
    api: {
        baseURL: window.location.hostname === 'localhost' 
            ? 'http://localhost:8083'
            : 'http://cardapi.paitongai.com',
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000
    },

    // Upload Limits
    upload: {
        maxContentPhotos: 10,
        maxPhotoSize: 5 * 1024 * 1024, // 5MB
        maxAudioSize: 100 * 1024 * 1024, // 100MB
        acceptedImageFormats: ['image/jpeg', 'image/png', 'image/webp'],
        acceptedAudioFormats: ['audio/mpeg', 'audio/mp3']
    },

    // Processing Configuration
    processing: {
        pollingInterval: 5000, // 5 seconds
        maxPollingAttempts: 60, // 5 minutes max
        animationSpeed: 100 // ms per progress unit
    },

    // UI Configuration
    ui: {
        theme: 'light',
        animations: true,
        smoothScroll: true,
        showNotifications: true
    },

    // Feature Flags
    features: {
        enableProMode: true,
        enableCorrections: true,
        enableDragDrop: true,
        enableAutoSave: false,
        enableAnalytics: false
    },

    // Card Templates
    templates: [
        { id: 'default', name: 'Default Template', description: 'Clean and modern design' },
        { id: 'cardplanet-Sandra-json', name: 'Card Planet Sandra', description: 'Professional podcast cards' },
        { id: 'minimal', name: 'Minimal', description: 'Simple and elegant' },
        { id: 'bold', name: 'Bold', description: 'Eye-catching and vibrant' }
    ],

    // Default Values
    defaults: {
        userType: 'basic',
        template: 'cardplanet-Sandra-json',
        language: 'zh'
    },

    // External Resources
    resources: {
        fontAwesome: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        bootstrapIcons: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
        interFont: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
    },

    // Development Settings
    dev: {
        mockAPI: false,
        debugMode: false,
        logLevel: 'info'
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    config.dev.debugMode = true;
    config.dev.logLevel = 'debug';
}

export default config;