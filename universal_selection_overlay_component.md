# 通用选区覆盖层组件架构设计

## 组件定位
一个独立的、可复用的选区组件，可以覆盖在任何内容（HTML、图片、视频、文本等）上方，通过涂抹/框选等方式获取屏幕区域坐标。

## 核心架构

### 1. 组件层次结构
```
┌─────────────────────────────────────┐
│      SelectionOverlay Component     │  ← 独立组件层
├─────────────────────────────────────┤
│         Canvas Drawing Layer        │  ← 绘制层
├─────────────────────────────────────┤
│        Interaction Handler          │  ← 交互处理层
├─────────────────────────────────────┤
│   Content Container (任意内容)       │  ← 内容层
│   - HTML Document                   │
│   - Image Viewer                    │
│   - Video Player                    │
│   - Text Editor                     │
│   - PDF Viewer                      │
│   - ...                            │
└─────────────────────────────────────┘
```

### 2. 组件接口设计

```typescript
interface SelectionOverlay {
  // 核心配置
  config: SelectionConfig;

  // 生命周期
  mount(container: HTMLElement): void;
  unmount(): void;

  // 工具模式
  setTool(tool: SelectionTool): void;

  // 事件
  on(event: SelectionEvent, handler: Function): void;
  off(event: SelectionEvent, handler: Function): void;

  // 状态管理
  getSelections(): Selection[];
  clearSelections(): void;
  undo(): void;
  redo(): void;

  // 导出
  exportData(): SelectionData;
  importData(data: SelectionData): void;
}

interface SelectionConfig {
  // 基础配置
  mode: 'paint' | 'rectangle' | 'lasso' | 'polygon' | 'point';

  // 画笔配置
  brush: {
    size: number;
    opacity: number;
    color: string;
    shape: 'circle' | 'square';
  };

  // 行为配置
  behavior: {
    multiSelect: boolean;
    autoComplete: boolean;  // 自动闭合路径
    magneticSnap: boolean;  // 磁性吸附
  };

  // 性能配置
  performance: {
    throttleMs: number;
    sampleRate: number;
  };

  // 视觉配置
  visual: {
    showCursor: boolean;
    showGrid: boolean;
    showCoordinates: boolean;
    showDimensions: boolean;
  };
}

interface Selection {
  id: string;
  type: 'paint' | 'rectangle' | 'lasso' | 'polygon' | 'point';

  // 核心数据：屏幕坐标
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // 详细路径数据
  path?: Point[];

  // 像素级数据（可选）
  pixels?: Set<string>;

  // 元数据
  metadata: {
    timestamp: number;
    tool: string;
    brushSize?: number;
  };
}

interface Point {
  x: number;      // 屏幕坐标X
  y: number;      // 屏幕坐标Y
  pressure?: number; // 压感（如果支持）
  timestamp?: number;
}
```

### 3. 核心实现

```javascript
class UniversalSelectionOverlay {
  constructor(config = {}) {
    this.config = { ...defaultConfig, ...config };
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.selections = [];
    this.currentPath = [];
    this.isDrawing = false;
    this.tool = null;
    this.eventHandlers = new Map();
  }

  mount(container) {
    this.container = container;
    this.setupCanvas();
    this.bindEvents();
    this.setTool(new PaintTool(this.config.brush));
  }

  setupCanvas() {
    // 创建透明覆盖层Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'auto';
    this.canvas.style.zIndex = '9999';

    // 匹配容器尺寸
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // 监听容器尺寸变化
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(this.container);
  }

  bindEvents() {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.handleStart.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleEnd.bind(this));

    // 触摸事件
    this.canvas.addEventListener('touchstart', this.handleStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleEnd.bind(this));

    // 指针事件（统一处理）
    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', this.handleStart.bind(this));
      this.canvas.addEventListener('pointermove', this.handleMove.bind(this));
      this.canvas.addEventListener('pointerup', this.handleEnd.bind(this));
    }
  }

  handleStart(event) {
    const point = this.getPointFromEvent(event);
    this.isDrawing = true;
    this.currentPath = [point];

    if (this.tool) {
      this.tool.onStart(point, this.ctx);
    }

    this.emit('selectionStart', { point });
  }

  handleMove(event) {
    if (!this.isDrawing) return;

    const point = this.getPointFromEvent(event);
    this.currentPath.push(point);

    if (this.tool) {
      this.tool.onMove(point, this.ctx);
    }

    // 实时反馈当前选区
    this.emit('selectionUpdate', {
      bounds: this.calculateBounds(this.currentPath),
      path: this.currentPath
    });
  }

  handleEnd(event) {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    const point = this.getPointFromEvent(event);
    this.currentPath.push(point);

    if (this.tool) {
      this.tool.onEnd(point, this.ctx);
    }

    // 创建选区对象
    const selection = this.createSelection();
    this.selections.push(selection);

    // 触发完成事件，返回屏幕坐标区域
    this.emit('selectionComplete', selection);
  }

  getPointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();

    // 获取相对于Canvas的坐标
    let clientX, clientY;

    if (event.touches) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // 转换为Canvas坐标（考虑缩放）
    const x = (clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (clientY - rect.top) * (this.canvas.height / rect.height);

    // 获取压感（如果支持）
    const pressure = event.pressure || 1.0;

    return {
      x: Math.round(x),
      y: Math.round(y),
      pressure,
      timestamp: Date.now()
    };
  }

  createSelection() {
    const bounds = this.calculateBounds(this.currentPath);

    return {
      id: `selection_${Date.now()}`,
      type: this.config.mode,
      bounds,
      path: [...this.currentPath],
      pixels: this.tool ? this.tool.getPixels() : null,
      metadata: {
        timestamp: Date.now(),
        tool: this.config.mode,
        brushSize: this.config.brush.size
      }
    };
  }

  calculateBounds(path) {
    if (path.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // 考虑画笔大小
    const offset = this.config.mode === 'paint' ? this.config.brush.size / 2 : 0;

    for (const point of path) {
      minX = Math.min(minX, point.x - offset);
      minY = Math.min(minY, point.y - offset);
      maxX = Math.max(maxX, point.x + offset);
      maxY = Math.max(maxY, point.y + offset);
    }

    return {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY)
    };
  }

  // 事件系统
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  // 获取选区数据（纯坐标）
  getSelections() {
    return this.selections.map(sel => ({
      id: sel.id,
      bounds: sel.bounds,
      path: sel.path
    }));
  }

  // 导出为不同格式
  exportData(format = 'json') {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      viewport: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      selections: this.selections
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'svg':
        return this.exportAsSVG(data);
      case 'binary':
        return this.exportAsBinary(data);
      default:
        return data;
    }
  }
}
```

### 4. 工具插件系统

```javascript
// 工具基类
class SelectionTool {
  onStart(point, ctx) {}
  onMove(point, ctx) {}
  onEnd(point, ctx) {}
  getPixels() { return null; }
}

// 涂抹工具
class PaintTool extends SelectionTool {
  constructor(brushConfig) {
    super();
    this.brushConfig = brushConfig;
    this.pixels = new Set();
  }

  onStart(point, ctx) {
    ctx.globalAlpha = this.brushConfig.opacity;
    ctx.fillStyle = this.brushConfig.color;
    this.drawBrush(point, ctx);
  }

  onMove(point, ctx) {
    this.drawBrush(point, ctx);
  }

  drawBrush(point, ctx) {
    const radius = this.brushConfig.size / 2;

    if (this.brushConfig.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillRect(
        point.x - radius,
        point.y - radius,
        this.brushConfig.size,
        this.brushConfig.size
      );
    }

    // 记录覆盖的像素
    this.recordPixels(point, radius);
  }

  recordPixels(center, radius) {
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        if (x * x + y * y <= radius * radius) {
          const px = Math.round(center.x + x);
          const py = Math.round(center.y + y);
          this.pixels.add(`${px},${py}`);
        }
      }
    }
  }

  getPixels() {
    return this.pixels;
  }
}

// 矩形工具
class RectangleTool extends SelectionTool {
  constructor() {
    super();
    this.startPoint = null;
  }

  onStart(point, ctx) {
    this.startPoint = point;
  }

  onMove(point, ctx) {
    // 清除并重绘矩形
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const width = point.x - this.startPoint.x;
    const height = point.y - this.startPoint.y;

    ctx.strokeRect(this.startPoint.x, this.startPoint.y, width, height);
  }
}

// 套索工具
class LassoTool extends SelectionTool {
  constructor() {
    super();
    this.path = [];
  }

  onStart(point, ctx) {
    this.path = [point];
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  onMove(point, ctx) {
    this.path.push(point);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  onEnd(point, ctx) {
    // 自动闭合路径
    ctx.closePath();
    ctx.stroke();
  }
}
```

### 5. 使用示例

```javascript
// 1. 在HTML内容上使用
const htmlContainer = document.getElementById('html-viewer');
const htmlSelector = new UniversalSelectionOverlay({
  mode: 'paint',
  brush: { size: 20, opacity: 0.3, color: '#FF0000' }
});

htmlSelector.mount(htmlContainer);

htmlSelector.on('selectionComplete', (selection) => {
  console.log('选中区域坐标:', selection.bounds);
  // 可以进一步处理，如获取该区域下的DOM元素
  const elements = getElementsInBounds(selection.bounds);
});

// 2. 在图片上使用
const imageContainer = document.getElementById('image-viewer');
const imageSelector = new UniversalSelectionOverlay({
  mode: 'rectangle'
});

imageSelector.mount(imageContainer);

imageSelector.on('selectionComplete', (selection) => {
  console.log('图片选中区域:', selection.bounds);
  // 可以进一步处理，如裁剪图片
  cropImage(selection.bounds);
});

// 3. 在视频上使用
const videoContainer = document.getElementById('video-player');
const videoSelector = new UniversalSelectionOverlay({
  mode: 'lasso'
});

videoSelector.mount(videoContainer);

videoSelector.on('selectionComplete', (selection) => {
  console.log('视频帧选中区域:', selection.bounds);
  // 可以进一步处理，如提取视频片段
  extractVideoRegion(selection.bounds, getCurrentFrame());
});

// 4. 在PDF上使用
const pdfContainer = document.getElementById('pdf-viewer');
const pdfSelector = new UniversalSelectionOverlay({
  mode: 'paint',
  brush: { size: 10, opacity: 0.5, color: '#FFFF00' }
});

pdfSelector.mount(pdfContainer);

pdfSelector.on('selectionComplete', (selection) => {
  console.log('PDF选中区域:', selection.bounds);
  // 可以进一步处理，如提取文本
  extractPDFText(selection.bounds, getCurrentPage());
});
```

### 6. 集成适配器

```javascript
// 针对不同内容类型的适配器
class ContentAdapter {
  constructor(selectionOverlay, contentType) {
    this.overlay = selectionOverlay;
    this.contentType = contentType;
  }
}

// HTML适配器
class HTMLAdapter extends ContentAdapter {
  constructor(selectionOverlay) {
    super(selectionOverlay, 'html');
  }

  getElementsInSelection(selection) {
    const elements = [];
    const allElements = document.querySelectorAll('*');

    allElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (this.isIntersecting(selection.bounds, rect)) {
        elements.push({
          element,
          coverage: this.calculateCoverage(selection, rect)
        });
      }
    });

    return elements;
  }

  isIntersecting(bounds, rect) {
    return !(bounds.x + bounds.width < rect.left ||
             bounds.x > rect.right ||
             bounds.y + bounds.height < rect.top ||
             bounds.y > rect.bottom);
  }
}

// 图片适配器
class ImageAdapter extends ContentAdapter {
  constructor(selectionOverlay, imageElement) {
    super(selectionOverlay, 'image');
    this.image = imageElement;
  }

  getImageData(selection) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = selection.bounds.width;
    canvas.height = selection.bounds.height;

    ctx.drawImage(
      this.image,
      selection.bounds.x, selection.bounds.y,
      selection.bounds.width, selection.bounds.height,
      0, 0,
      selection.bounds.width, selection.bounds.height
    );

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

// 视频适配器
class VideoAdapter extends ContentAdapter {
  constructor(selectionOverlay, videoElement) {
    super(selectionOverlay, 'video');
    this.video = videoElement;
  }

  captureFrame(selection) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = selection.bounds.width;
    canvas.height = selection.bounds.height;

    ctx.drawImage(
      this.video,
      selection.bounds.x, selection.bounds.y,
      selection.bounds.width, selection.bounds.height,
      0, 0,
      selection.bounds.width, selection.bounds.height
    );

    return canvas.toDataURL('image/png');
  }
}
```

### 7. 高级特性

```javascript
// 选区管理器
class SelectionManager {
  constructor(overlay) {
    this.overlay = overlay;
    this.history = [];
    this.historyIndex = -1;
    this.groups = new Map();
  }

  // 分组管理
  createGroup(name) {
    this.groups.set(name, []);
  }

  addToGroup(groupName, selection) {
    if (this.groups.has(groupName)) {
      this.groups.get(groupName).push(selection);
    }
  }

  // 选区运算
  union(sel1, sel2) {
    // 合并两个选区
    return this.mergeBounds(sel1.bounds, sel2.bounds);
  }

  intersection(sel1, sel2) {
    // 计算交集
    return this.getIntersection(sel1.bounds, sel2.bounds);
  }

  difference(sel1, sel2) {
    // 计算差集
    return this.getDifference(sel1.bounds, sel2.bounds);
  }

  // 智能选区
  autoSelect(point, threshold = 0.8) {
    // 基于点击位置自动扩展选区
    // 可以结合图像识别、边缘检测等算法
  }

  // 磁性吸附
  snapToEdges(selection, snapDistance = 10) {
    // 将选区吸附到最近的边缘
  }
}

// 性能优化器
class PerformanceOptimizer {
  constructor(overlay) {
    this.overlay = overlay;
    this.frameRequest = null;
    this.lastUpdate = 0;
  }

  throttledUpdate(callback, fps = 60) {
    const now = Date.now();
    const delay = 1000 / fps;

    if (now - this.lastUpdate >= delay) {
      callback();
      this.lastUpdate = now;
    }
  }

  optimizeForLargeContent() {
    // 使用虚拟化技术
    // 只渲染可见区域
    // 使用 Web Worker 处理计算密集型任务
  }
}
```

## 组件特性

### 核心功能
1. **通用性**：可覆盖任何内容类型
2. **独立性**：不依赖底层内容结构
3. **坐标输出**：提供标准屏幕坐标
4. **多种工具**：涂抹、矩形、套索、多边形等
5. **实时反馈**：绘制过程实时可视化

### 扩展性
1. **插件式工具**：可自定义选择工具
2. **适配器模式**：针对不同内容的处理
3. **事件驱动**：完整的事件生命周期
4. **数据导出**：支持多种格式导出

### 性能优化
1. **Canvas离屏渲染**
2. **路径简化算法**
3. **节流防抖处理**
4. **增量更新机制**
5. **Web Worker计算**

## 使用场景

1. **网页元素选择**：选中HTML元素进行操作
2. **图片区域标注**：标记图片特定区域
3. **视频帧分析**：选择视频特定区域分析
4. **PDF文本提取**：选中PDF区域提取文本
5. **截图工具**：选择屏幕区域截图
6. **OCR识别**：选择区域进行文字识别
7. **UI自动化测试**：记录操作区域坐标

## 技术优势

1. **零侵入**：不修改原始内容
2. **轻量级**：纯JavaScript实现
3. **跨平台**：支持桌面和移动端
4. **高性能**：优化的渲染管线
5. **易集成**：简单的API接口