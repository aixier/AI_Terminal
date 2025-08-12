/**
 * Claude Code API - Node.js Example
 * Transform Claude Code into REST API with AI Terminal
 */

const axios = require('axios');
const EventSource = require('eventsource');

// Configuration
const API_BASE_URL = 'http://localhost:8082';

/**
 * Example 1: Non-Streaming API Call
 * Use this for batch processing or when you need complete response
 */
async function generateContentNonStreaming(topic) {
    console.log(`\n🚀 Generating content for: ${topic}`);
    
    try {
        const response = await axios.post(`${API_BASE_URL}/api/generate/card`, {
            topic: topic,
            templateName: 'daily-knowledge-card-template.md'
        });
        
        if (response.data.success) {
            console.log('✅ Generation successful!');
            console.log(`📁 File: ${response.data.data.fileName}`);
            console.log(`⏱️ Time: ${response.data.data.generationTime}ms`);
            console.log('📄 Content:', JSON.stringify(response.data.data.content, null, 2));
            return response.data.data;
        } else {
            console.error('❌ Generation failed:', response.data.message);
        }
    } catch (error) {
        console.error('❌ API Error:', error.message);
    }
}

/**
 * Example 2: Streaming API Call
 * Use this for real-time updates and progress tracking
 */
function generateContentStreaming(topic) {
    console.log(`\n🌊 Starting streaming generation for: ${topic}`);
    
    return new Promise((resolve, reject) => {
        const eventSource = new EventSource(
            `${API_BASE_URL}/api/generate/card/stream`,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send POST data via a workaround (or use fetch with ReadableStream)
            }
        );
        
        // For POST with EventSource, we need to use fetch
        fetch(`${API_BASE_URL}/api/generate/card/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic: topic,
                templateName: 'daily-knowledge-card-template.md'
            })
        }).then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        console.log('✅ Stream completed');
                        return;
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            const event = line.slice(6).trim();
                            console.log(`📢 Event: ${event}`);
                        } else if (line.startsWith('data:')) {
                            try {
                                const data = JSON.parse(line.slice(5));
                                handleStreamEvent(data);
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                    
                    processStream();
                });
            }
            
            processStream();
        }).catch(error => {
            console.error('❌ Stream Error:', error);
            reject(error);
        });
    });
}

function handleStreamEvent(data) {
    if (data.data) {
        // Output from Claude
        process.stdout.write(data.data);
    } else if (data.status) {
        // Status update
        console.log(`\n📊 Status: ${data.status}`);
    } else if (data.content) {
        // Final content
        console.log('\n✅ Generation complete!');
        console.log('📄 Final content received');
    }
}

/**
 * Example 3: Batch Processing
 * Generate multiple contents in parallel
 */
async function batchGenerate(topics) {
    console.log(`\n🔄 Batch generating ${topics.length} topics...`);
    
    const promises = topics.map(topic => 
        generateContentNonStreaming(topic)
    );
    
    try {
        const results = await Promise.all(promises);
        console.log(`\n✅ Batch generation complete! Generated ${results.length} items`);
        return results;
    } catch (error) {
        console.error('❌ Batch generation failed:', error);
    }
}

/**
 * Example 4: Custom Claude Command
 * Execute any Claude command via API
 */
async function executeClaudeCommand(command) {
    console.log(`\n🤖 Executing Claude command: ${command}`);
    
    try {
        const response = await axios.post(`${API_BASE_URL}/api/claude/execute`, {
            command: command,
            stream: false
        });
        
        console.log('✅ Command executed successfully');
        console.log('📄 Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Command failed:', error.message);
    }
}

/**
 * Example 5: Health Check
 * Monitor API status
 */
async function checkHealth() {
    try {
        const response = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ API Health:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ API is down:', error.message);
        return null;
    }
}

// Main execution
async function main() {
    console.log('🎯 Claude Code API Examples\n');
    console.log('================================\n');
    
    // Check API health
    await checkHealth();
    
    // Example 1: Single non-streaming generation
    await generateContentNonStreaming('JavaScript Promises');
    
    // Example 2: Streaming generation (commented out as it needs proper SSE setup)
    // await generateContentStreaming('Python Decorators');
    
    // Example 3: Batch processing
    await batchGenerate([
        'React Hooks',
        'Vue Composition API',
        'Angular Signals'
    ]);
    
    // Example 4: Custom command (if endpoint exists)
    // await executeClaudeCommand('Explain async/await in JavaScript');
}

// Run examples
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    generateContentNonStreaming,
    generateContentStreaming,
    batchGenerate,
    executeClaudeCommand,
    checkHealth
};