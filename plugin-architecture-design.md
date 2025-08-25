# 插件化架构改造方案文档

## 1. 概述

### 1.1 改造目标
- 将现有的硬编码模板逻辑改造为插件化架构
- 解决前端展示文件夹/文件名不友好的问题
- 支持模板的动态加载和管理
- 为未来扩展到上千个模板做准备

### 1.2 现有模板分析
| 模板ID | 类型 | 输出文件 | 参数要求 | 特殊逻辑 |
|--------|------|----------|----------|----------|
| cardplanet-Sandra | 文件夹模板 | JSON | style, language, reference | 标准3参数 |
| cardplanet-Sandra-cover | 文件夹模板 | JSON | cover, style, language, reference | 4参数带封面 |
| cardplanet-Sandra-json | 文件夹模板 | HTML + JSON | cover, style, language, reference | 双文件输出 |
| daily-knowledge-card-template | 单文件模板 | JSON | topic | 简单模板 |

## 2. 插件架构设计

### 2.1 目录结构
```
terminal-backend/
├── src/
│   ├── plugins/
│   │   ├── core/                    # 插件核心系统
│   │   │   ├── PluginManager.js     # 插件管理器
│   │   │   ├── PluginLoader.js      # 插件加载器
│   │   │   ├── PluginRegistry.js    # 插件注册表
│   │   │   ├── PluginAPI.js         # 插件API接口
│   │   │   └── BasePlugin.js        # 插件基类
│   │   │
│   │   ├── templates/                # 模板插件目录
│   │   │   ├── cardplanet-sandra/
│   │   │   │   ├── manifest.json    # 插件清单
│   │   │   │   ├── index.js         # 插件入口
│   │   │   │   ├── locales/         # 多语言支持
│   │   │   │   │   ├── zh-CN.json
│   │   │   │   │   └── en-US.json
│   │   │   │   └── assets/          # 插件资源
│   │   │   │       ├── CLAUDE.md
│   │   │   │       ├── style_guide.md
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── cardplanet-sandra-cover/
│   │   │   ├── cardplanet-sandra-json/
│   │   │   └── daily-knowledge-card/
│   │   │
│   │   └── registry.json             # 插件注册信息
│   │
│   └── routes/
│       └── generate.js               # 改造后的生成路由
```

### 2.2 插件清单格式 (manifest.json)

```json
{
  "id": "cardplanet-sandra-json",
  "version": "1.0.0",
  "type": "template",
  "metadata": {
    "name": {
      "zh-CN": "卡片星球-Sandra双文件版",
      "en-US": "CardPlanet Sandra Dual Output"
    },
    "description": {
      "zh-CN": "生成HTML展示文件和JSON数据文件的收藏级卡片海报",
      "en-US": "Generate collectible card posters with HTML and JSON outputs"
    },
    "author": "AI Terminal Team",
    "icon": "cardplanet-icon.svg",
    "category": "artistic",
    "tags": ["poster", "card", "html", "json"],
    "preview": "preview.png"
  },
  "capabilities": {
    "templateType": "folder",
    "outputs": [
      {
        "type": "html",
        "pattern": "*_style.html",
        "required": true,
        "description": "HTML展示文件"
      },
      {
        "type": "json",
        "pattern": "*_data.json",
        "required": true,
        "description": "JSON数据文件"
      }
    ],
    "parameters": {
      "required": ["topic"],
      "optional": ["cover", "style", "language", "reference"],
      "schema": {
        "topic": {
          "type": "string",
          "description": "卡片主题",
          "placeholder": "请输入卡片主题"
        },
        "cover": {
          "type": "string",
          "description": "封面设计要求",
          "default": "auto"
        },
        "style": {
          "type": "string",
          "description": "视觉风格",
          "default": "modern"
        },
        "language": {
          "type": "string",
          "description": "语言",
          "enum": ["中文", "English"],
          "default": "中文"
        },
        "reference": {
          "type": "text",
          "description": "参考内容",
          "maxLength": 5000
        }
      }
    }
  },
  "config": {
    "timeout": 420000,
    "checkInterval": 1000,
    "priority": 10,
    "enabled": true
  },
  "hooks": {
    "beforePrompt": "preprocessParams",
    "afterPrompt": "postProcessPrompt",
    "onFileDetect": "detectFiles",
    "afterGenerate": "processOutput"
  },
  "dependencies": {
    "claudeVersion": ">=3.0.0",
    "nodeVersion": ">=16.0.0"
  }
}
```

### 2.3 插件接口定义

```javascript
// BasePlugin.js
class BaseTemplatePlugin {
  constructor(manifest, pluginPath) {
    this.manifest = manifest;
    this.pluginPath = pluginPath;
    this.api = null; // 由PluginManager注入
  }

  // 生命周期方法
  async onLoad() {}
  async onActivate() {}
  async onDeactivate() {}
  async onUnload() {}

  // 核心方法
  async buildPrompt(params) {
    throw new Error('buildPrompt must be implemented');
  }

  async detectFiles(outputPath, options) {
    throw new Error('detectFiles must be implemented');
  }

  async validateOutput(files) {
    return { valid: true, errors: [] };
  }

  async processOutput(files) {
    return files;
  }

  // 参数处理
  async preprocessParams(params) {
    return params;
  }

  async generateParameters(topic) {
    // 可选：自动生成参数
    return {};
  }

  // 元数据方法
  getMetadata(locale = 'zh-CN') {
    return this.manifest.metadata;
  }

  getDisplayName(locale = 'zh-CN') {
    return this.manifest.metadata.name[locale] || this.manifest.metadata.name['en-US'];
  }

  getParameterSchema() {
    return this.manifest.capabilities.parameters;
  }

  getTimeoutConfig() {
    return {
      timeout: this.manifest.config.timeout || 30000,
      checkInterval: this.manifest.config.checkInterval || 1000
    };
  }
}
```

### 2.4 插件API接口

```javascript
// PluginAPI.js
class PluginAPI {
  constructor(pluginId, manager) {
    this.pluginId = pluginId;
    this.manager = manager;
  }

  // 文件系统访问
  async readAsset(filename) {
    // 读取插件assets目录下的文件
  }

  async getAssetPath(filename) {
    // 获取资源文件的完整路径
  }

  // 日志
  log(message, level = 'info') {
    console.log(`[Plugin:${this.pluginId}] ${message}`);
  }

  // 事件
  emit(event, data) {
    this.manager.emitPluginEvent(this.pluginId, event, data);
  }

  // 工具方法
  async executeCommand(command) {
    // 执行系统命令
  }

  async callClaude(prompt, options) {
    // 调用Claude API
  }
}
```

## 3. 前端展示改造

### 3.1 模板列表API响应格式

```javascript
// GET /api/templates
{
  "success": true,
  "templates": [
    {
      "id": "cardplanet-sandra-json",
      "displayName": "卡片星球-Sandra双文件版",
      "description": "生成HTML展示文件和JSON数据文件的收藏级卡片海报",
      "category": "artistic",
      "icon": "/api/templates/cardplanet-sandra-json/icon",
      "tags": ["poster", "card", "html", "json"],
      "outputs": ["html", "json"],
      "enabled": true,
      "version": "1.0.0"
    },
    {
      "id": "cardplanet-sandra-cover",
      "displayName": "卡片星球-Sandra封面版",
      "description": "带自定义封面的收藏级卡片海报",
      "category": "artistic",
      "icon": "/api/templates/cardplanet-sandra-cover/icon",
      "tags": ["poster", "card", "cover"],
      "outputs": ["json"],
      "enabled": true,
      "version": "1.0.0"
    }
    // ...
  ],
  "categories": [
    {
      "id": "artistic",
      "name": "艺术创作",
      "count": 3
    },
    {
      "id": "knowledge",
      "name": "知识卡片",
      "count": 1
    }
  ]
}
```

### 3.2 前端模板选择器改造

```javascript
// 前端组件示例
const TemplateSelector = () => {
  return (
    <div className="template-grid">
      {templates.map(template => (
        <div key={template.id} className="template-card">
          <img src={template.icon} alt={template.displayName} />
          <h3>{template.displayName}</h3>
          <p>{template.description}</p>
          <div className="template-tags">
            {template.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <div className="template-outputs">
            {template.outputs.map(output => (
              <span key={output} className="output-type">{output}</span>
            ))}
          </div>
          <button onClick={() => selectTemplate(template.id)}>
            选择此模板
          </button>
        </div>
      ))}
    </div>
  );
};
```

## 4. 核心系统改造

### 4.1 PluginManager实现要点

```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.registry = new PluginRegistry();
  }

  async initialize() {
    // 扫描插件目录
    const pluginDirs = await this.scanPluginDirectory();
    
    // 加载所有插件
    for (const dir of pluginDirs) {
      await this.loadPlugin(dir);
    }
  }

  async loadPlugin(pluginPath) {
    // 1. 读取manifest.json
    const manifest = await this.readManifest(pluginPath);
    
    // 2. 验证manifest
    this.validateManifest(manifest);
    
    // 3. 加载插件代码
    const PluginClass = require(path.join(pluginPath, 'index.js'));
    
    // 4. 创建插件实例
    const plugin = new PluginClass(manifest, pluginPath);
    
    // 5. 注入API
    plugin.api = new PluginAPI(manifest.id, this);
    
    // 6. 调用生命周期方法
    await plugin.onLoad();
    
    // 7. 注册插件
    this.plugins.set(manifest.id, plugin);
    this.registry.register(manifest);
    
    console.log(`Plugin loaded: ${manifest.id} v${manifest.version}`);
  }

  async getPlugin(templateId) {
    const plugin = this.plugins.get(templateId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${templateId}`);
    }
    return plugin;
  }

  async executePlugin(templateId, method, ...args) {
    const plugin = await this.getPlugin(templateId);
    if (!plugin[method]) {
      throw new Error(`Method ${method} not found in plugin ${templateId}`);
    }
    return await plugin[method](...args);
  }

  getTemplateList(locale = 'zh-CN') {
    return Array.from(this.plugins.values()).map(plugin => ({
      id: plugin.manifest.id,
      displayName: plugin.getDisplayName(locale),
      description: plugin.manifest.metadata.description[locale],
      category: plugin.manifest.metadata.category,
      icon: `/api/templates/${plugin.manifest.id}/icon`,
      tags: plugin.manifest.metadata.tags,
      outputs: plugin.manifest.capabilities.outputs.map(o => o.type),
      enabled: plugin.manifest.config.enabled,
      version: plugin.manifest.version
    }));
  }
}
```

### 4.2 改造后的generate.js核心逻辑

```javascript
// generate.js 改造后的核心逻辑
router.post('/generate/card', async (req, res) => {
  const { topic, templateName, ...params } = req.body;
  
  try {
    // 1. 获取插件
    const plugin = await pluginManager.getPlugin(templateName);
    
    // 2. 预处理参数
    const processedParams = await plugin.preprocessParams({
      topic,
      ...params
    });
    
    // 3. 构建提示词
    const prompt = await plugin.buildPrompt(processedParams);
    
    // 4. 获取超时配置
    const { timeout, checkInterval } = plugin.getTimeoutConfig();
    
    // 5. 执行Claude
    await apiTerminalService.executeClaude(apiId, prompt);
    
    // 6. 文件检测
    const files = await plugin.detectFiles(userCardPath, {
      timeout,
      checkInterval
    });
    
    // 7. 验证输出
    const validation = await plugin.validateOutput(files);
    if (!validation.valid) {
      throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 8. 后处理
    const processedFiles = await plugin.processOutput(files);
    
    // 9. 返回结果
    res.json({
      success: true,
      files: processedFiles,
      template: {
        id: plugin.manifest.id,
        name: plugin.getDisplayName(),
        version: plugin.manifest.version
      }
    });
    
  } catch (error) {
    console.error(`Plugin execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 新增：获取模板列表API
router.get('/templates', (req, res) => {
  const locale = req.query.locale || 'zh-CN';
  const templates = pluginManager.getTemplateList(locale);
  
  res.json({
    success: true,
    templates,
    categories: getCategories(templates)
  });
});

// 新增：获取模板详情API
router.get('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const locale = req.query.locale || 'zh-CN';
  
  try {
    const plugin = await pluginManager.getPlugin(id);
    res.json({
      success: true,
      template: {
        id: plugin.manifest.id,
        displayName: plugin.getDisplayName(locale),
        description: plugin.manifest.metadata.description[locale],
        parameters: plugin.getParameterSchema(),
        outputs: plugin.manifest.capabilities.outputs,
        config: plugin.manifest.config
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: `Template not found: ${id}`
    });
  }
});
```

## 5. 插件实现示例

### 5.1 cardplanet-sandra-json插件实现

```javascript
// templates/cardplanet-sandra-json/index.js
const BaseTemplatePlugin = require('../../core/BasePlugin');
const path = require('path');
const fs = require('fs/promises');

class CardPlanetSandraJsonPlugin extends BaseTemplatePlugin {
  async onLoad() {
    this.api.log('CardPlanet Sandra JSON plugin loaded');
  }

  async preprocessParams(params) {
    // 自动生成缺失的参数
    if (!params.style || !params.language || !params.reference) {
      const generated = await this.generateParameters(params.topic);
      return {
        ...params,
        cover: params.cover || generated.cover || '自动生成',
        style: params.style || generated.style,
        language: params.language || generated.language,
        reference: params.reference || generated.reference || ''
      };
    }
    return params;
  }

  async buildPrompt(params) {
    const { topic, cover, style, language, reference } = params;
    
    // 获取模板文件路径
    const claudePath = await this.api.getAssetPath('CLAUDE.md');
    const userCardPath = params.outputPath;
    
    return `你是一位海报设计师，要为"${topic}"创作一套收藏级卡片海报作品。

创作重点：
- 把每张卡片当作独立的艺术海报设计
- 深挖主题的趣味性和视觉潜力
- 用细节和创意打动人心
- 必须同时生成HTML和JSON两个文件

封面：${cover}
风格：${style}
语言：${language}
参考：${reference}

从${claudePath}文档开始，按其指引阅读全部6个文档获取创作框架。
特别注意：必须按照html_generation_workflow.md中的双文件输出规范，
同时生成HTML文件（主题英文名_style.html）和JSON文件（主题英文名_data.json）。
生成的文件保存在[${userCardPath}]`;
  }

  async detectFiles(outputPath, options) {
    const { timeout = 420000, checkInterval = 1000 } = options;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const files = await fs.readdir(outputPath);
          const htmlFiles = files.filter(f => f.endsWith('.html'));
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          
          // 必须两个文件都存在
          if (htmlFiles.length > 0 && jsonFiles.length > 0) {
            clearInterval(interval);
            
            const result = [];
            
            // 读取HTML文件
            for (const htmlFile of htmlFiles) {
              const content = await fs.readFile(
                path.join(outputPath, htmlFile), 
                'utf-8'
              );
              result.push({
                fileName: htmlFile,
                path: path.join(outputPath, htmlFile),
                content,
                fileType: 'html'
              });
            }
            
            // 读取JSON文件
            for (const jsonFile of jsonFiles) {
              const content = await fs.readFile(
                path.join(outputPath, jsonFile), 
                'utf-8'
              );
              try {
                result.push({
                  fileName: jsonFile,
                  path: path.join(outputPath, jsonFile),
                  content: JSON.parse(content),
                  fileType: 'json'
                });
              } catch (e) {
                result.push({
                  fileName: jsonFile,
                  path: path.join(outputPath, jsonFile),
                  content,
                  fileType: 'json',
                  parseError: true
                });
              }
            }
            
            resolve(result);
          }
          
          // 超时检查
          if (Date.now() - startTime > timeout) {
            clearInterval(interval);
            reject(new Error('File generation timeout'));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, checkInterval);
    });
  }

  async validateOutput(files) {
    const errors = [];
    
    // 检查是否有HTML文件
    const htmlFiles = files.filter(f => f.fileType === 'html');
    if (htmlFiles.length === 0) {
      errors.push('Missing HTML output file');
    }
    
    // 检查是否有JSON文件
    const jsonFiles = files.filter(f => f.fileType === 'json');
    if (jsonFiles.length === 0) {
      errors.push('Missing JSON output file');
    }
    
    // 检查JSON是否解析成功
    const jsonWithError = jsonFiles.filter(f => f.parseError);
    if (jsonWithError.length > 0) {
      errors.push('JSON parse error in output files');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async generateParameters(topic) {
    // 调用Claude生成参数
    const prompt = `为"${topic}"这个主题生成创作参数...`;
    const result = await this.api.callClaude(prompt, { timeout: 30000 });
    
    // 解析结果
    try {
      return JSON.parse(result);
    } catch (e) {
      return {
        cover: '自动生成',
        style: 'modern',
        language: '中文',
        reference: ''
      };
    }
  }
}

module.exports = CardPlanetSandraJsonPlugin;
```

## 6. 优势与收益

### 6.1 技术优势
- **解耦性**：模板逻辑与核心系统完全分离
- **可扩展性**：新增模板只需添加插件，无需修改核心代码
- **可维护性**：每个插件独立维护，降低复杂度
- **可测试性**：插件可独立测试
- **热更新**：支持不重启更新插件

### 6.2 用户体验提升
- **友好展示**：模板有清晰的名称、描述、图标
- **分类管理**：支持按类别、标签筛选
- **参数提示**：明确的参数说明和验证
- **多语言支持**：界面可切换语言
- **预览功能**：可预览模板效果

### 6.3 运维优势
- **版本管理**：每个插件独立版本控制
- **灰度发布**：可按需启用/禁用插件
- **监控统计**：可统计各插件使用情况
- **错误隔离**：插件错误不影响系统

## 7. 迁移策略

### 7.1 阶段一：基础架构搭建（1周）
- 实现插件核心系统
- 创建插件基类和API
- 搭建插件加载机制

### 7.2 阶段二：模板迁移（1周）
- 将4个现有模板改造为插件
- 保持向后兼容
- 测试验证

### 7.3 阶段三：前端改造（3天）
- 实现新的模板选择界面
- 对接新的API
- 优化用户体验

### 7.4 阶段四：优化完善（持续）
- 性能优化
- 功能增强
- 文档完善

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 插件加载性能 | 启动变慢 | 懒加载、缓存机制 |
| 插件冲突 | 系统不稳定 | 沙箱隔离、依赖管理 |
| 向后兼容 | 旧接口失效 | 保留兼容层、渐进式迁移 |
| 插件质量 | 用户体验差 | 审核机制、测试规范 |

## 9. 总结

插件化架构改造将为AI Terminal带来：
1. **更好的扩展性**：轻松支持上千个模板
2. **更友好的体验**：清晰的模板展示和选择
3. **更低的维护成本**：模块化管理
4. **更强的生态能力**：支持第三方开发

这是一个战略性的架构升级，为产品的长期发展奠定基础。