/* Pod2Post - Prompt Builder Service */

export class PromptBuilder {
    constructor() {
        // 基础提示词模板
        this.templates = {
            default: {
                base: `阅读[播客小红书图文卡片需求文档.md]，按文档要求使用[新闻感封面.md]和[内容页模板规范.md]，在[用户card路径]生成html和json文档。
需要使用的照片请遍历[photos]文件夹下的所有子目录寻找照片资源（比如照片、图片等文件夹），html图片资源使用绝对路径。
需要使用的其他素材在[CDN]文件夹中。`,
                hostPrefix: '本期主播：',
                guestPrefix: '本期嘉宾：',
                correctionPrefix: '名称修正：'
            },
            
            professional: {
                base: `按照专业播客制作标准，生成小红书图文卡片内容。
严格遵循[播客小红书图文卡片需求文档.md]的所有规范要求。
使用[新闻感封面.md]作为封面设计指导。
使用[内容页模板规范.md]作为内容页设计指导。
输出位置：[用户card路径]
输出格式：HTML和JSON双格式文档

资源路径说明：
- 照片资源：遍历[photos]文件夹及其所有子目录（包括"照片"、"图片"等命名的文件夹）
- CDN素材：从[CDN]文件夹获取
- HTML中的图片必须使用绝对路径引用`,
                hostPrefix: '【主播信息】',
                guestPrefix: '【嘉宾信息】',
                correctionPrefix: '【名称纠正规则】'
            },
            
            creative: {
                base: `创意制作播客可视化内容，生成适合小红书平台的精美图文卡片。
参考文档：[播客小红书图文卡片需求文档.md]、[新闻感封面.md]、[内容页模板规范.md]
重点要求：
1. 突出视觉设计美感
2. 确保文字内容的可读性
3. 保持品牌调性一致
输出到[用户card路径]，生成HTML和JSON格式。

图片资源获取：
- 从[photos]文件夹递归搜索所有图片
- 使用[CDN]文件夹中的装饰素材
- 所有路径使用绝对路径`,
                hostPrefix: '主持人：',
                guestPrefix: '特邀嘉宾：',
                correctionPrefix: '文字校正：'
            }
        };
        
        // 当前选中的模板
        this.currentTemplate = 'default';
        
        // 额外的提示词配置
        this.additionalPrompts = {
            style: '',
            tone: '',
            emphasis: '',
            customRules: []
        };
    }

    /**
     * 设置使用的模板
     */
    setTemplate(templateName) {
        if (this.templates[templateName]) {
            this.currentTemplate = templateName;
        }
    }

    /**
     * 构建完整的提示词
     */
    buildPrompt(params = {}) {
        const {
            hostNames = '',
            guestNames = '',
            corrections = [],
            episodeTitle = '',
            episodeDescription = '',
            customInstructions = '',
            template = this.currentTemplate
        } = params;
        
        // 获取基础模板
        const tmpl = this.templates[template] || this.templates.default;
        let prompt = tmpl.base;
        
        // 添加剧集信息
        if (episodeTitle || episodeDescription) {
            prompt += '\n\n【节目信息】\n';
            if (episodeTitle) {
                prompt += `节目标题：${episodeTitle}\n`;
            }
            if (episodeDescription) {
                prompt += `节目简介：${episodeDescription}\n`;
            }
        }
        
        // 添加主播和嘉宾信息
        if (hostNames || guestNames) {
            prompt += '\n\n【参与人员】\n';
            if (hostNames) {
                prompt += `${tmpl.hostPrefix}${this.formatNames(hostNames)}\n`;
            }
            if (guestNames) {
                prompt += `${tmpl.guestPrefix}${this.formatNames(guestNames)}\n`;
            }
        }
        
        // 添加名称修正
        if (corrections && corrections.length > 0) {
            prompt += `\n\n${tmpl.correctionPrefix}\n`;
            corrections.forEach(({ from, to }) => {
                if (from && to) {
                    prompt += `- 将"${from}"修正为"${to}"\n`;
                }
            });
        }
        
        // 添加风格和语调设置
        if (this.additionalPrompts.style || this.additionalPrompts.tone) {
            prompt += '\n\n【创作风格】\n';
            if (this.additionalPrompts.style) {
                prompt += `视觉风格：${this.additionalPrompts.style}\n`;
            }
            if (this.additionalPrompts.tone) {
                prompt += `文字语调：${this.additionalPrompts.tone}\n`;
            }
        }
        
        // 添加重点强调
        if (this.additionalPrompts.emphasis) {
            prompt += `\n\n【重点要求】\n${this.additionalPrompts.emphasis}\n`;
        }
        
        // 添加自定义规则
        if (this.additionalPrompts.customRules.length > 0) {
            prompt += '\n\n【额外规则】\n';
            this.additionalPrompts.customRules.forEach((rule, index) => {
                prompt += `${index + 1}. ${rule}\n`;
            });
        }
        
        // 添加用户自定义指令
        if (customInstructions) {
            prompt += `\n\n【特别指示】\n${customInstructions}\n`;
        }
        
        // 添加输出要求
        prompt += this.getOutputRequirements();
        
        return prompt;
    }

    /**
     * 格式化名字列表
     */
    formatNames(names) {
        if (typeof names === 'string') {
            // 处理逗号、顿号或空格分隔的名字
            return names.replace(/[,，、\s]+/g, '、');
        } else if (Array.isArray(names)) {
            return names.join('、');
        }
        return names;
    }

    /**
     * 获取输出要求
     */
    getOutputRequirements() {
        return `

【输出要求】
1. 生成完整的HTML文件，包含所有样式和脚本
2. 生成对应的JSON数据文件
3. 确保所有图片路径为绝对路径
4. HTML必须在现代浏览器中完美显示
5. 支持移动端响应式布局
6. 包含分享功能的meta标签`;
    }

    /**
     * 设置风格
     */
    setStyle(style) {
        this.additionalPrompts.style = style;
    }

    /**
     * 设置语调
     */
    setTone(tone) {
        this.additionalPrompts.tone = tone;
    }

    /**
     * 设置重点
     */
    setEmphasis(emphasis) {
        this.additionalPrompts.emphasis = emphasis;
    }

    /**
     * 添加自定义规则
     */
    addCustomRule(rule) {
        if (rule && !this.additionalPrompts.customRules.includes(rule)) {
            this.additionalPrompts.customRules.push(rule);
        }
    }

    /**
     * 清除自定义规则
     */
    clearCustomRules() {
        this.additionalPrompts.customRules = [];
    }

    /**
     * 获取预设的风格选项
     */
    getStyleOptions() {
        return [
            { value: 'modern', label: '现代简约' },
            { value: 'magazine', label: '杂志风格' },
            { value: 'artistic', label: '艺术创意' },
            { value: 'business', label: '商务专业' },
            { value: 'warm', label: '温暖亲切' },
            { value: 'tech', label: '科技感' }
        ];
    }

    /**
     * 获取预设的语调选项
     */
    getToneOptions() {
        return [
            { value: 'professional', label: '专业严谨' },
            { value: 'casual', label: '轻松随意' },
            { value: 'humorous', label: '幽默风趣' },
            { value: 'inspiring', label: '励志激昂' },
            { value: 'storytelling', label: '故事叙述' },
            { value: 'educational', label: '知识科普' }
        ];
    }

    /**
     * 生成示例提示词
     */
    generateExample() {
        return this.buildPrompt({
            hostNames: '李静、养鸡',
            guestNames: '戴军、艳艳',
            episodeTitle: '第100期：科技改变生活',
            episodeDescription: '探讨人工智能对日常生活的影响',
            corrections: [
                { from: 'AI', to: '人工智能' },
                { from: 'APP', to: '应用程序' }
            ],
            customInstructions: '请特别突出科技感，使用蓝色系配色方案'
        });
    }

    /**
     * 验证提示词
     */
    validatePrompt(prompt) {
        const issues = [];
        
        // 检查长度
        if (prompt.length < 50) {
            issues.push('提示词过短，建议添加更多细节');
        }
        
        if (prompt.length > 5000) {
            issues.push('提示词过长，可能影响处理效率');
        }
        
        // 检查必要元素
        if (!prompt.includes('[photos]') && !prompt.includes('照片')) {
            issues.push('未提及照片资源路径');
        }
        
        if (!prompt.includes('[CDN]') && !prompt.includes('素材')) {
            issues.push('未提及CDN素材路径');
        }
        
        if (!prompt.includes('html') && !prompt.includes('HTML')) {
            issues.push('未明确要求生成HTML格式');
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }

    /**
     * 导出配置
     */
    exportConfig() {
        return {
            template: this.currentTemplate,
            additionalPrompts: { ...this.additionalPrompts }
        };
    }

    /**
     * 导入配置
     */
    importConfig(config) {
        if (config.template) {
            this.setTemplate(config.template);
        }
        if (config.additionalPrompts) {
            this.additionalPrompts = { ...config.additionalPrompts };
        }
    }
}

export default PromptBuilder;