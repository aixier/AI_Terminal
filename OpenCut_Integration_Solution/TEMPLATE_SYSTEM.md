# AI Terminal Template System

## Overview

The AI Terminal template system provides a flexible framework for generating different types of content cards using AI models. Templates define the structure, style, and generation process for various content formats.

## Template Architecture

```
Template System
├── Template Registry (JSONL)
├── Template Files (.md)
├── Template Processor
├── AI Model Integration
└── Output Generator
```

## Template Registry

Templates are registered in `/terminal-backend/data/template-registry.jsonl`:

```json
{
  "id": "template-identifier",
  "version": "1.0",
  "description": "Template description",
  "name": "Display name",
  "outputType": "html|json",
  "outputCount": 4,
  "triggerFile": "json|null",
  "waitForTrigger": true|false
}
```

### Registry Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique template identifier |
| `version` | string | Template version |
| `description` | string | Human-readable description |
| `name` | string | Display name for UI |
| `outputType` | string | Primary output format (html/json) |
| `outputCount` | number | Expected number of output files |
| `triggerFile` | string | File type that triggers generation |
| `waitForTrigger` | boolean | Whether to wait for trigger file |

## Built-in Templates

### 1. Daily Knowledge Card Template
```json
{
  "id": "daily-knowledge-card-template.md",
  "version": "1.0",
  "description": "Knowledge card generation with 4 styles",
  "name": "Quick",
  "outputType": "html",
  "outputCount": 4,
  "triggerFile": "json",
  "waitForTrigger": true
}
```

**Features:**
- Generates 4 different styled HTML cards
- JSON-triggered generation
- Quick processing time
- Multiple visual styles

**Use Cases:**
- Educational content
- Daily tips and facts
- Knowledge sharing
- Quick reference cards

### 2. Card Planet Sandra Template
```json
{
  "id": "cardplanet-Sandra-json",
  "version": "1.0",
  "description": "Card Planet design style, dual file output",
  "name": "Premium",
  "outputType": "html",
  "outputCount": 1,
  "triggerFile": null,
  "waitForTrigger": false
}
```

**Features:**
- Premium design quality
- Single comprehensive output
- Direct generation without triggers
- Professional styling

**Use Cases:**
- Marketing materials
- Product showcases
- Portfolio items
- Professional presentations

## Creating Custom Templates

### Template Structure

```markdown
# Template Name

## Configuration
- Output: html/json
- Count: number of files
- Style: visual style definition

## Prompt Structure
{{topic}} - User provided topic
{{style}} - Style parameters
{{language}} - Language preference
{{reference}} - Reference materials

## Generation Instructions
1. Step-by-step generation process
2. Content requirements
3. Formatting rules
4. Quality standards

## Output Format
Define the exact structure of generated content
```

### Example Custom Template

```markdown
# Social Media Card Template

## Configuration
- Output: html
- Count: 3
- Style: modern, minimalist

## Prompt Structure
Create social media cards for the topic: {{topic}}
Style requirements: {{style}}
Target platform: {{platform}}

## Generation Instructions
1. Generate engaging headline (max 60 chars)
2. Create compelling description (max 160 chars)
3. Include relevant hashtags (5-10)
4. Apply platform-specific formatting

## Output Format
<div class="social-card">
  <h1>{{headline}}</h1>
  <p>{{description}}</p>
  <div class="hashtags">{{hashtags}}</div>
</div>
```

## Template Processing Flow

```
1. Template Selection
   ↓
2. Parameter Injection
   ↓
3. AI Model Processing
   ↓
4. Content Generation
   ↓
5. Format Validation
   ↓
6. File Output
```

### 1. Template Selection

```javascript
// Select template based on user request
const template = await templateRegistry.getTemplate(templateName);
if (!template) {
  template = await templateRegistry.getDefaultTemplate();
}
```

### 2. Parameter Injection

```javascript
// Inject user parameters into template
const processedPrompt = template.prompt
  .replace('{{topic}}', userInput.topic)
  .replace('{{style}}', userInput.style || template.defaultStyle)
  .replace('{{language}}', userInput.language || 'en');
```

### 3. AI Model Processing

```javascript
// Send to AI model for processing
const aiResponse = await aiService.generate({
  model: template.model || 'claude-3',
  prompt: processedPrompt,
  maxTokens: template.maxTokens || 4000,
  temperature: template.temperature || 0.7
});
```

### 4. Content Generation

```javascript
// Generate output files based on template
const outputs = await generateOutputs(aiResponse, template);
```

## Template Variables

### System Variables
- `{{timestamp}}` - Current timestamp
- `{{user}}` - Current user
- `{{sessionId}}` - Session identifier
- `{{taskId}}` - Task identifier

### User Variables
- `{{topic}}` - Main topic/subject
- `{{style}}` - Style preferences
- `{{language}}` - Language setting
- `{{reference}}` - Reference content
- `{{metadata}}` - Additional metadata

### Computed Variables
- `{{wordCount}}` - Word count
- `{{readingTime}}` - Estimated reading time
- `{{difficulty}}` - Content difficulty level
- `{{keywords}}` - Extracted keywords

## Advanced Template Features

### Conditional Generation

```javascript
// Template with conditions
{
  "id": "conditional-template",
  "conditions": [
    {
      "if": "language == 'zh'",
      "then": {
        "outputCount": 2,
        "style": "chinese-traditional"
      }
    },
    {
      "if": "topic.includes('technical')",
      "then": {
        "outputCount": 1,
        "format": "markdown"
      }
    }
  ]
}
```

### Multi-Stage Generation

```javascript
// Template with multiple generation stages
{
  "id": "multi-stage-template",
  "stages": [
    {
      "name": "research",
      "prompt": "Research the topic: {{topic}}",
      "output": "research.json"
    },
    {
      "name": "outline",
      "prompt": "Create outline based on {{research}}",
      "output": "outline.json"
    },
    {
      "name": "content",
      "prompt": "Generate content from {{outline}}",
      "output": "content.html"
    }
  ]
}
```

### Template Inheritance

```javascript
// Child template inheriting from parent
{
  "id": "child-template",
  "extends": "parent-template",
  "overrides": {
    "outputCount": 6,
    "style": "enhanced"
  }
}
```

## Template API Integration

### Register Template

```javascript
POST /api/templates/register
{
  "id": "custom-template",
  "name": "Custom Template",
  "content": "template content...",
  "config": {
    "outputType": "html",
    "outputCount": 3
  }
}
```

### Update Template

```javascript
PUT /api/templates/:templateId
{
  "name": "Updated Name",
  "config": {
    "outputCount": 5
  }
}
```

### Delete Template

```javascript
DELETE /api/templates/:templateId
```

### Test Template

```javascript
POST /api/templates/:templateId/test
{
  "topic": "Test topic",
  "parameters": {
    "style": "modern"
  }
}
```

## Template Styling

### CSS Variables

```css
/* Template CSS variables */
:root {
  --card-bg: #ffffff;
  --card-text: #333333;
  --card-accent: #007bff;
  --card-border: #e0e0e0;
  --card-shadow: rgba(0,0,0,0.1);
}
```

### Responsive Design

```css
/* Mobile-first responsive design */
.card-container {
  width: 100%;
  max-width: 600px;
}

@media (min-width: 768px) {
  .card-container {
    max-width: 800px;
  }
}
```

### Theme Support

```javascript
// Template theme configuration
{
  "themes": {
    "light": {
      "background": "#ffffff",
      "text": "#333333"
    },
    "dark": {
      "background": "#1a1a1a",
      "text": "#ffffff"
    }
  }
}
```

## Template Performance

### Caching Strategy

```javascript
// Template caching for performance
const templateCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

function getCachedTemplate(templateId) {
  const cached = templateCache.get(templateId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.template;
  }
  return null;
}
```

### Lazy Loading

```javascript
// Lazy load template resources
async function loadTemplateResources(templateId) {
  const resources = await import(`./templates/${templateId}/resources.js`);
  return resources.default;
}
```

### Optimization Tips

1. **Minimize Template Size**: Keep templates concise
2. **Cache Static Content**: Cache unchanging parts
3. **Async Processing**: Use async generation for heavy templates
4. **Resource Bundling**: Bundle CSS/JS with templates
5. **CDN Distribution**: Serve static assets from CDN

## Template Best Practices

### 1. Naming Conventions
- Use kebab-case for template IDs
- Descriptive names that indicate purpose
- Version numbers for major changes

### 2. Documentation
- Document all variables
- Provide usage examples
- Include sample outputs

### 3. Error Handling
- Validate input parameters
- Provide fallback values
- Clear error messages

### 4. Testing
- Unit tests for processing logic
- Integration tests with AI models
- Visual regression tests for HTML output

### 5. Versioning
- Semantic versioning (major.minor.patch)
- Backward compatibility
- Migration guides for breaking changes

## Troubleshooting

### Common Issues

1. **Template Not Found**
   - Check template ID spelling
   - Verify registry file exists
   - Ensure template is registered

2. **Generation Timeout**
   - Increase timeout settings
   - Optimize template prompts
   - Check AI service status

3. **Invalid Output**
   - Validate template syntax
   - Check variable replacements
   - Review AI model responses

4. **Performance Issues**
   - Enable template caching
   - Reduce output complexity
   - Use async generation

### Debug Mode

```javascript
// Enable template debug mode
const debugConfig = {
  logPrompts: true,
  logResponses: true,
  saveIntermediateFiles: true,
  verboseErrors: true
};
```

## Migration Guide

### Migrating from v1 to v2

```javascript
// Old format (v1)
{
  "template": "old-template",
  "output": "html"
}

// New format (v2)
{
  "id": "old-template-v2",
  "version": "2.0",
  "outputType": "html",
  "outputCount": 1
}
```

### Batch Migration Script

```bash
# Migrate all templates to new format
node scripts/migrate-templates.js --from v1 --to v2
```