# 封面模板系统

## 模板选择逻辑
1. 检查用户输入中的封面模板指定
2. 如无指定，默认使用"默认封面"
3. 严格按照用户指定的模板名称执行

## 模板1：默认封面

### 触发条件
- 默认选择（无指定时）
- 用户指定："默认封面"

### 字体配置
```css
/* IBM Plex Sans 几何无衬线字体声明 */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

/* 字体栈配置（优先级递减）*/
font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

### 字体来源
- **名称**：IBM Plex Sans
- **特征**：现代几何无衬线字体，具有清晰的可读性和科技感
- **来源**：Google Fonts 免费提供
- **链接**：https://fonts.google.com/specimen/IBM+Plex+Sans
- **使用许可**：开源免费商业使用

### 核心目标
封面是决定用户是否点击的关键，必须具有强吸引力和海报级视觉效果

### 标题长度处理规则

#### 中文标题分级处理
```css
/* 4-6字（低密度）：大字号海报效果 */
.cover-title-large {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 20px;
}

/* 7-12字（中密度）：平衡设计 */
.cover-title-medium {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 16px;
}

/* 13-18字（高密度）：紧凑排版 */
.cover-title-small {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 12px;
}

/* 19-29字（极简）：最小化装饰 */
.cover-title-compact {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 11px;
}

/* 30字+（极限）：极度压缩 */
.cover-title-ultra {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.1;
    margin-bottom: 8px;
}
```

#### 英文标题分级处理
```css
/* 1-2词（Brief）：超大字号 */
.cover-title-en-brief {
    font-size: 32-36px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 20px;
}

/* 3-4词（Standard）：标准设计 */
.cover-title-en-standard {
    font-size: 20-24px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 16px;
}

/* 5-8词（Medium）：中等布局 */
.cover-title-en-medium {
    font-size: 19-22px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 16px;
}

/* 9-11词（Long）：紧凑排版 */
.cover-title-en-long {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 12px;
}

/* 12-15词（Extra Long）：极限压缩 */
.cover-title-en-extra {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.1;
    margin-bottom: 8px;
}

/* 16词+（Ultra Long）：不建议使用，建议拆分为多张卡片 */
```

### SVG主视觉系统

#### 密度分级与SVG尺寸
```css
/* 低密度（6-8行内容）：大型主视觉 */
.cover-svg-large {
    height: 120px;
    margin-bottom: 20px;
}

/* 中密度（9-11行内容）：中型主视觉 */
.cover-svg-medium {
    height: 100px;
    margin-bottom: 16px;
}

/* 高密度（12行内容）：小型主视觉 */
.cover-svg-small {
    height: 80px;
    margin-bottom: 12px;
}

/* 极限压缩（超过12行）：微型主视觉 */
.cover-svg-mini {
    height: 60px;
    margin-bottom: 8px;
}
```

#### 主视觉设计原则
- **必须与主题深度关联**：不能使用抽象装饰图形
- **完全不使用Font Awesome图标**：纯自定义SVG设计
- **简洁胜过复杂**：10-15行SVG代码，意境优于复杂度
- **静态设计**：不使用任何动画效果（最终导出PNG图片）
- **风格融合**：SVG配色和设计语言必须与所选风格协调

### 辅助元素配置
```css
/* 副标题 */
.cover-subtitle {
    font-size: 14px;
    font-weight: 300;
    text-align: center;
    margin-bottom: 16px;
    color: var(--text-secondary);
}

/* 高亮重点信息 */
.cover-highlight {
    background: var(--accent-color);
    padding: 12px 20px;
    margin: 16px 0;
    text-align: center;
    font-weight: 500;
    font-size: 13px;
    transform: rotate(-1deg);
}

/* 底部描述文字 */
.cover-description {
    font-size: 12px;
    text-align: center;
    font-style: italic;
    margin-top: auto;
    color: var(--text-primary);
}

/* 装饰分割线 */
.cover-divider {
    width: 60px;
    height: 3px;
    background: var(--primary-color);
    margin: 16px auto;
}
```

### 布局容器配置
```css
/* 封面卡片专用样式 - 采用标准内容页布局 */
.cover-card .tutorial-card-content {
    padding: 20px 20px 30px 20px;  /* 标准内容页padding */
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 2;
}

.cover-card .tutorial-card-content > *:last-child {
    margin-bottom: 20px;  /* 最后元素强制底边距 */
}

/* SVG容器居中显示 */
.cover-svg-container {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 标题居中对齐 */
.cover-title {
    text-align: center;
    color: var(--text-primary);
}
```

### 内容密度控制系统

#### 密度等级判断
| 密度等级 | 中文字数 | 英文词数 | 总行数范围 | SVG高度 | 标题字号 | 元素间距 | 风险等级 |
|---------|---------|---------|----------|---------|---------|----------|----------|
| 低密度 | 4-6字 | 1-2词 | 6-8行 | 120px | 28-36px | 1.5-2rem | 低 |
| 中密度 | 7-12字 | 3-8词 | 9-11行 | 100px | 19-24px | 1-1.5rem | 低 |
| 高密度 | 13-18字 | 9-11词 | 12行 | 80px | 17-20px | 0.5-1rem | 中 |
| 极简 | 19-29字 | 12-15词 | 压缩布局 | 60px | 15-18px | 最小间距 | 高 |
| 极限 | 30字+ | 16词+ | 危险区 | 60px | 16px以下 | 极度压缩 | 高-需拆分 |

#### 内容控制原则
- **严格12行上限**：保证可读性和视觉平衡
- **根据密度调整**：内容越多，图形越小，间距越紧
- **保证完整显示**：所有内容必须在卡片范围内
- **避免信息过载**：宁可简洁有力，不可内容超限

### 品牌水印系统
```css
/* Logo水印统一规范 */
.card-watermark {
    position: absolute;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 30px;
    opacity: 0.3;
    z-index: 1;
    pointer-events: none;
}
```

#### 水印配色融合
- **Logo文件路径**：`/Users/sandra/Downloads/cursor/post/cardplanet_logo.svg`
- **配色协调**：Logo颜色需与当前风格配色协调
- **渐变应用**：使用渐变色与卡片整体风格融合
- **避免冲突**：不使用原logo的默认配色

### 风格继承与融合规则
**核心原则**：封面模板提供结构布局，style_guide.md提供视觉风格，两者融合生成最终封面

#### 风格继承机制
1. **配色继承**：
   - 主色调：使用所选风格的主配色系统
   - 背景色：采用所选风格的背景色方案
   - 文字色：使用所选风格的文字色系
   - 装饰色：使用所选风格的点缀色或辅助色

2. **视觉语言继承**：
   - SVG图形：体现所选风格的几何语言和设计特征
   - 设计感受：反映所选风格的情感基调和设计哲学
   - 视觉层次：遵循所选风格的空间处理方式

3. **模板特性保持**：
   - 字体选择：严格使用IBM Plex Sans几何字体
   - 布局结构：保持海报式居中对称布局
   - 元素比例：维持响应式密度分级系统

#### 具体融合示例
- **康定斯基构成主义 + 模板1** = 几何抽象SVG + IBM Plex Sans + 红蓝黄配色系统
- **莫奈印象派 + 模板1** = 自然形态SVG + 温柔字体渲染 + 水彩配色
- **Apple文档风 + 模板1** = 简洁线性图形 + 清晰字体 + 系统蓝配色

### 配色要求
- **基本原则**：严格使用style_guide.md中所选风格的配色系统
- **严禁使用**：
  - 灰色（#808080及类似）- 显得消极、缺乏生机
  - 黑色 - 封面严禁使用（即使作为背景）
- **必须保证**：
  - 明亮、温暖的色调提升点击欲望
  - 确保文字与背景有强烈对比度（WCAG AA级标准）
  - 所有颜色选择在所选风格配色范围内

### 氛围要求
- **积极向上**：即使主题偏暗也要营造正面感受
- **点击欲望**：要有让人想点击的视觉吸引力
- **文字突出**：标题要醒目易读，避免低对比度
- **平衡节制**：引发好奇而非视觉轰炸

### 响应式处理
- **容器尺寸**：3:4比例，aspect-ratio控制
- **边界安全**：确保所有文字在可视区域内
- **溢出控制**：`overflow: hidden`
- **底部安全区**：`padding-bottom: 30px`
- **最后元素边距**：`margin-bottom: 20px`

### 特殊处理规则
#### 超长标题处理
- **30字+中文**：建议拆分为多张卡片，如必须单张则使用极限压缩模式
- **15词+英文**：不建议使用，强烈建议拆分
- **极限模式**：SVG 60px，标题16px以下，行高1.1，去除装饰元素

#### 内容饱和时调整
- **自动降级**：内容多时自动从低密度降为中/高密度
- **图形缩放**：主视觉元素按密度等级自动调整尺寸
- **间距压缩**：元素间距按密度分级自动调整
- **装饰简化**：高密度时减少装饰元素，保证核心信息突出

## 模板2：小红书封面

### 触发条件
- 用户指定："小红书封面"

### 字体配置
```css
/* 纳米老宋字体声明 */
@font-face {
    font-family: 'NanoOldSong';
    src: local('纳米老宋'), local('NanoOldSong');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

/* 字体栈配置（优先级递减）*/
font-family: "NanoOldSong", "纳米老宋", "SimSun", "宋体", "Source Han Serif CN", "Source Han Serif SC", "Noto Serif CJK SC", serif;
```

### 字体来源
- **名称**：纳米老宋 (NanoOldSong)
- **特征**：基于汇文明朝体制作的补充字体，具有典雅的宋体风格
- **来源链接**：https://www.100font.com/thread-951.htm
- **GitHub**：https://github.com/Hansha2011/NanoOldSong
- **下载链接**：https://pan.quark.cn/s/aacc47c6cc76
- **使用许可**：免费商业使用

### 核心排版参数
- **字号**：30px
- **字重**：400 (normal)
- **行高**：1.5
- **字间距**：0.03em
- **对齐方式**：left（左对齐）
- **文字阴影**：根据风格背景调整，确保可读性

### 标题长度处理规则

#### 20字以内（标准配置）
```css
.template-title {
    font-size: 30px;
    line-height: 1.5;
    letter-spacing: 0.03em;
}
```

#### 超出20字自适应规则
```css
/* 21-25字：缩小字号，调整行高 */
.template-title.long {
    font-size: 26px;
    line-height: 1.4;
    letter-spacing: 0.02em;
}

/* 26-30字：进一步缩小 */
.template-title.extra-long {
    font-size: 24px;
    line-height: 1.3;
    letter-spacing: 0.01em;
}

/* 超过30字：最小配置 */
.template-title.max-long {
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: 0;
}
```

### 断句换行逻辑
- **语义完整**：按意群分行，避免破坏词汇完整性
- **行长均匀**：每行5-8字，保持视觉平衡
- **最大行数**：不超过5行
- **示例分行**：
  ```
  那些在深夜里
  让人泪流满面的
  温柔诗句总是能够
  治愈疲惫的心灵
  ```

### 辅助文字配置
```css
/* 副标题 */
.subtitle {
    font-size: 11px;
    font-style: italic;
    letter-spacing: 0.08em;
    margin-bottom: 25px;
    text-align: left;
}

/* 作者署名 */
.author {
    font-size: 11px;
    margin-top: auto;
    align-self: flex-start;
}
```

### 作者署名生成机制
**适用范围**：仅针对模板2（小红书封面模板）

#### 署名优先级规则
1. **用户指定署名（最高优先级）**
   - 用户在提示词中明确指定署名时，直接使用用户提供的署名
   - 识别关键词：「署名」、「署名用」、「署名写」、「作者」等
   - 示例：
     - "生成封面，署名用@张三" → 使用@张三
     - "封面署名@产品经理小王" → 使用@产品经理小王
     - "作者写@AI研究员" → 使用@AI研究员

2. **智能推测署名（用户未指定时）**
   - 根据标题主题内容智能生成合适的署名
   - 推测规则：
     * **AI/科技/技术主题** → @AI思考者、@科技观察家、@技术专家
     * **心理/成长/情感主题** → @心理咨询师、@成长导师、@情感分析师
     * **文化/艺术/文学主题** → @文化学者、@艺术爱好者、@文学评论家
     * **生活方式/美学主题** → @生活美学家、@品味达人、@生活观察者
     * **教育/学习主题** → @教育工作者、@学习导师、@知识分享者
     * **商业/职场主题** → @商业观察家、@职场导师、@创业者

3. **通用默认署名（兜底机制）**
   - 当无法明确推测主题时，使用通用署名
   - 默认选项：@内容创作者、@思考者、@分享达人

#### 实现逻辑示例
```javascript
// 伪代码示例
function generateAuthorName(userInput, title) {
    // 第一优先级：检查用户是否指定署名
    const userSignature = extractUserSignature(userInput);
    if (userSignature) {
        return userSignature;
    }
    
    // 第二优先级：根据主题智能推测
    const theme = analyzeTheme(title);
    return getThemeBasedSignature(theme);
}

function getThemeBasedSignature(theme) {
    const signatures = {
        'ai_tech': ['@AI思考者', '@科技观察家', '@技术专家'],
        'psychology': ['@心理咨询师', '@成长导师', '@情感分析师'],
        'culture_art': ['@文化学者', '@艺术爱好者', '@文学评论家'],
        'lifestyle': ['@生活美学家', '@品味达人', '@生活观察者'],
        'education': ['@教育工作者', '@学习导师', '@知识分享者'],
        'business': ['@商业观察家', '@职场导师', '@创业者'],
        'default': ['@内容创作者', '@思考者', '@分享达人']
    };
    
    return signatures[theme] ? 
           signatures[theme][0] : 
           signatures['default'][0];
}
```

#### 注意事项
- 署名格式统一使用@开头
- 署名长度控制在2-6个汉字内
- 避免使用过于具体的个人化信息
- 保持署名与主题内容的相关性

### 布局容器配置
```css
/* 封面卡片专用样式 - 覆盖通用内容页设置 */
.cover-card .tutorial-card-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 40px 30px 30px 30px;  /* 封面专用：上40px 左右30px 下30px */
    position: relative;
    z-index: 2;
    box-sizing: border-box;
    /* 不设置text-align，让子元素的text-align: left生效 */
}

.cover-card .tutorial-card-content > *:last-child {
    margin-bottom: 20px;  /* 确保底部安全边距 */
}

.cover-title {
    margin-bottom: 20px;
    text-align: left;
}

.cover-subtitle {
    text-align: left;
}

.cover-author {
    text-align: left;
}
```

### 装饰元素规范
- **装饰图形**：根据所选风格添加相应的SVG装饰元素
- **位置**：右上角，60px × 60px区域
- **透明度**：0.2-0.4之间，不干扰文字阅读
- **样式**：与风格保持一致

### 风格继承与融合规则
**核心原则**：封面模板提供结构布局，style_guide.md提供视觉风格，两者融合生成最终封面

#### 风格继承机制
1. **配色继承**：
   - 背景色：使用所选风格的主配色或背景色
   - 文字色：使用所选风格的文字色系
   - 装饰色：使用所选风格的点缀色或辅助色
   - **示例**：Apple风格封面2 = 纳米老宋字体 + Apple配色(#FAFAFA背景 + #333文字 + #007AFF点缀)

2. **视觉语言继承**：
   - 装饰图形：使用所选风格的几何语言和图形特征
   - 设计感受：体现所选风格的情感基调和设计哲学
   - 视觉层次：遵循所选风格的排版和空间处理方式

3. **模板特性保持**：
   - 字体选择：严格遵循模板规定（如封面2的纳米老宋）
   - 布局结构：严格遵循模板的排版逻辑
   - 元素比例：保持模板规定的字号、间距、位置关系

#### 具体融合示例
- **Apple风格 + 封面2** = 干净几何装饰 + 纳米老宋横版布局 + 系统蓝配色
- **莫奈风格 + 封面1** = 水彩装饰元素 + Font Awesome图标 + 印象派配色
- **康定斯基风格 + 封面2** = 抽象几何图形 + 纳米老宋字体 + 构成主义配色

### 配色要求
- **基本原则**：严格使用style_guide.md中所选风格的配色系统
- **禁止自创**：不得脱离所选风格自行设计配色方案
- **对比度**：确保WCAG AA级标准，在所选风格配色范围内调整
- **文字颜色**：根据所选风格的配色选择深色或浅色，保证清晰可读
- **阴影处理**：必要时添加文字阴影，但颜色要符合所选风格

### 响应式处理
- **容器尺寸**：3:4比例，300px × 400px
- **边界安全**：确保所有文字在可视区域内
- **溢出控制**：`overflow: hidden`
- **底部安全区**：`padding-bottom: 30px`

## 通用要求

### 内容组织
- 封面是卡片1，必须吸引眼球
- 内容不超过12行（严格上限）
- 最后元素margin-bottom: 20px

### CSS关键设置
```css
.tutorial-card {
  aspect-ratio: 3/4;
  overflow: hidden;
}

.tutorial-card-content {
  padding: 20px 20px 30px 20px;
  height: 100%;
  box-sizing: border-box;
}

.tutorial-card-content > *:last-child {
  margin-bottom: 20px;
}
```