/**
 * WebGL 渲染器 - 桌面端高性能渲染
 * 使用WebGL进行GPU加速的文本渲染
 */

import { TerminalRenderer } from './TerminalRenderer.js'

export class WebGLRenderer extends TerminalRenderer {
  constructor(options = {}) {
    super(options)
    
    this.type = 'webgl'
    this.canvas = null
    this.gl = null
    
    // WebGL 特定配置
    this.enableWebGL2 = options.enableWebGL2 !== false
    this.enableTextAtlas = options.enableTextAtlas !== false
    this.maxTextures = 8 // 纹理单元数量
    
    // 着色器程序
    this.shaderProgram = null
    this.vertexShader = null
    self.fragmentShader = null
    
    // 缓冲区
    this.vertexBuffer = null
    this.indexBuffer = null
    this.textureCoordBuffer = null
    
    // 文字图集
    this.textAtlas = null
    this.atlasTexture = null
    this.charMap = new Map()
    
    // 渲染批次
    this.renderBatch = []
    this.maxBatchSize = 1000
    
    // WebGL状态
    this.initialized = false
  }
  
  /**
   * 初始化WebGL渲染器
   */
  initialize() {
    super.initialize()
    
    try {
      this.createCanvas()
      this.initWebGL()
      this.createShaders()
      this.createBuffers()
      
      if (this.enableTextAtlas) {
        this.createTextAtlas()
      }
      
      this.setupWebGLState()
      this.initialized = true
      
      this.emit('initialized')
    } catch (error) {
      console.error('[WebGLRenderer] Initialization failed:', error)
      this.emit('initializationFailed', error)
      throw error
    }
  }
  
  /**
   * 创建Canvas
   */
  createCanvas() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight
    
    this.container.appendChild(this.canvas)
  }
  
  /**
   * 初始化WebGL上下文
   */
  initWebGL() {
    const contextOptions = {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    }
    
    // 尝试WebGL2
    if (this.enableWebGL2) {
      this.gl = this.canvas.getContext('webgl2', contextOptions)
    }
    
    // 回退到WebGL1
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', contextOptions) ||
                this.canvas.getContext('experimental-webgl', contextOptions)
    }
    
    if (!this.gl) {
      throw new Error('WebGL not supported')
    }
    
    console.log(`[WebGLRenderer] Using ${this.gl.constructor.name}`)
  }
  
  /**
   * 创建着色器程序
   */
  createShaders() {
    const vertexShaderSource = `
      ${this.gl instanceof WebGL2RenderingContext ? '#version 300 es' : ''}
      
      ${this.gl instanceof WebGL2RenderingContext ? 'in' : 'attribute'} vec2 a_position;
      ${this.gl instanceof WebGL2RenderingContext ? 'in' : 'attribute'} vec2 a_texCoord;
      ${this.gl instanceof WebGL2RenderingContext ? 'in' : 'attribute'} vec4 a_color;
      
      ${this.gl instanceof WebGL2RenderingContext ? 'out' : 'varying'} vec2 v_texCoord;
      ${this.gl instanceof WebGL2RenderingContext ? 'out' : 'varying'} vec4 v_color;
      
      uniform vec2 u_resolution;
      
      void main() {
        // 将像素坐标转换为裁剪空间坐标
        vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        
        v_texCoord = a_texCoord;
        v_color = a_color;
      }
    `
    
    const fragmentShaderSource = `
      ${this.gl instanceof WebGL2RenderingContext ? '#version 300 es' : ''}
      precision mediump float;
      
      ${this.gl instanceof WebGL2RenderingContext ? 'in' : 'varying'} vec2 v_texCoord;
      ${this.gl instanceof WebGL2RenderingContext ? 'in' : 'varying'} vec4 v_color;
      
      uniform sampler2D u_texture;
      
      ${this.gl instanceof WebGL2RenderingContext ? 'out vec4 outColor;' : ''}
      
      void main() {
        vec4 texColor = texture${this.gl instanceof WebGL2RenderingContext ? '' : '2D'}(u_texture, v_texCoord);
        ${this.gl instanceof WebGL2RenderingContext ? 'outColor' : 'gl_FragColor'} = v_color * texColor;
      }
    `
    
    this.vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER)
    this.fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER)
    
    this.shaderProgram = this.createProgram(this.vertexShader, this.fragmentShader)
    
    // 获取属性和uniform位置
    this.programInfo = {
      attribLocations: {
        position: this.gl.getAttribLocation(this.shaderProgram, 'a_position'),
        texCoord: this.gl.getAttribLocation(this.shaderProgram, 'a_texCoord'),
        color: this.gl.getAttribLocation(this.shaderProgram, 'a_color')
      },
      uniformLocations: {
        resolution: this.gl.getUniformLocation(this.shaderProgram, 'u_resolution'),
        texture: this.gl.getUniformLocation(this.shaderProgram, 'u_texture')
      }
    }
  }
  
  /**
   * 编译着色器
   */
  compileShader(source, type) {
    const shader = this.gl.createShader(type)
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new Error(`Shader compilation failed: ${error}`)
    }
    
    return shader
  }
  
  /**
   * 创建着色器程序
   */
  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      this.gl.deleteProgram(program)
      throw new Error(`Program linking failed: ${error}`)
    }
    
    return program
  }
  
  /**
   * 创建缓冲区
   */
  createBuffers() {
    // 顶点缓冲区
    this.vertexBuffer = this.gl.createBuffer()
    
    // 纹理坐标缓冲区
    this.textureCoordBuffer = this.gl.createBuffer()
    
    // 颜色缓冲区
    this.colorBuffer = this.gl.createBuffer()
    
    // 索引缓冲区
    this.indexBuffer = this.gl.createBuffer()
  }
  
  /**
   * 创建文字图集
   */
  createTextAtlas() {
    if (!this.enableTextAtlas) return
    
    const atlasSize = 512 // 图集尺寸
    const cellSize = 16 // 每个字符的尺寸
    const cols = Math.floor(atlasSize / cellSize)
    const rows = Math.floor(atlasSize / cellSize)
    
    // 创建Canvas用于生成图集
    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = atlasSize
    atlasCanvas.height = atlasSize
    const ctx = atlasCanvas.getContext('2d')
    
    // 设置字体
    ctx.font = this.getFont()
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'white'
    
    // 生成字符图集
    let charCode = 32 // 从空格开始
    for (let row = 0; row < rows && charCode < 127; row++) {
      for (let col = 0; col < cols && charCode < 127; col++) {
        const char = String.fromCharCode(charCode)
        const x = col * cellSize
        const y = row * cellSize
        
        // 清除背景
        ctx.clearRect(x, y, cellSize, cellSize)
        
        // 绘制字符
        ctx.fillText(char, x + 1, y + 1)
        
        // 记录字符位置
        this.charMap.set(char, {
          x: x / atlasSize,
          y: y / atlasSize,
          width: cellSize / atlasSize,
          height: cellSize / atlasSize
        })
        
        charCode++
      }
    }
    
    // 创建WebGL纹理
    this.atlasTexture = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.atlasTexture)
    
    // 上传图集数据
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      atlasCanvas
    )
    
    // 设置纹理参数
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }
  
  /**
   * 设置WebGL状态
   */
  setupWebGLState() {
    // 设置视口
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    
    // 启用混合
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
    
    // 设置清除颜色
    const bg = this.parseColor(this.theme.background)
    const [r, g, b] = this.hexToRgb(bg)
    this.gl.clearColor(r / 255, g / 255, b / 255, 1.0)
  }
  
  /**
   * 主渲染方法
   */
  render(viewport) {
    if (!this.initialized || !this.gl || !viewport) return
    
    const startTime = performance.now()
    
    try {
      // 清除画布
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
      
      // 使用着色器程序
      this.gl.useProgram(this.shaderProgram)
      
      // 设置uniform
      this.gl.uniform2f(this.programInfo.uniformLocations.resolution, this.canvas.width, this.canvas.height)
      
      // 绑定纹理
      if (this.atlasTexture) {
        this.gl.activeTexture(this.gl.TEXTURE0)
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.atlasTexture)
        this.gl.uniform1i(this.programInfo.uniformLocations.texture, 0)
      }
      
      // 渲染文本
      this.renderText(viewport)
      
      // 渲染光标
      this.renderCursor(viewport)
      
      const endTime = performance.now()
      this.lastRenderTime = endTime - startTime
      
    } catch (error) {
      console.error('[WebGLRenderer] Render error:', error)
      this.emit('renderError', error)
    }
  }
  
  /**
   * 渲染文本
   */
  renderText(viewport) {
    if (!viewport.lines || !this.enableTextAtlas) return
    
    this.renderBatch = []
    
    // 收集所有要渲染的字符
    viewport.lines.forEach((line, rowIndex) => {
      if (!line || !line.cells) return
      
      line.cells.forEach((cell, colIndex) => {
        if (!cell || !cell.char || cell.char === ' ') return
        
        const charInfo = this.charMap.get(cell.char)
        if (!charInfo) return
        
        const x = colIndex * this.cellWidth
        const y = rowIndex * this.cellHeight
        
        this.addCharToBatch(cell.char, x, y, cell.style, charInfo)
      })
    })
    
    // 渲染批次
    if (this.renderBatch.length > 0) {
      this.drawBatch()
    }
  }
  
  /**
   * 添加字符到渲染批次
   */
  addCharToBatch(char, x, y, style, charInfo) {
    const color = this.parseStyleColor(style)
    
    // 顶点数据 (两个三角形组成矩形)
    const vertices = [
      // 第一个三角形
      x, y,
      x + this.cellWidth, y,
      x, y + this.cellHeight,
      
      // 第二个三角形
      x + this.cellWidth, y,
      x + this.cellWidth, y + this.cellHeight,
      x, y + this.cellHeight
    ]
    
    // 纹理坐标
    const texCoords = [
      charInfo.x, charInfo.y,
      charInfo.x + charInfo.width, charInfo.y,
      charInfo.x, charInfo.y + charInfo.height,
      
      charInfo.x + charInfo.width, charInfo.y,
      charInfo.x + charInfo.width, charInfo.y + charInfo.height,
      charInfo.x, charInfo.y + charInfo.height
    ]
    
    // 颜色数据
    const colors = []
    for (let i = 0; i < 6; i++) {
      colors.push(...color)
    }
    
    this.renderBatch.push({
      vertices,
      texCoords,
      colors
    })
  }
  
  /**
   * 绘制批次
   */
  drawBatch() {
    if (this.renderBatch.length === 0) return
    
    // 合并所有批次数据
    const allVertices = []
    const allTexCoords = []
    const allColors = []
    
    this.renderBatch.forEach(batch => {
      allVertices.push(...batch.vertices)
      allTexCoords.push(...batch.texCoords)
      allColors.push(...batch.colors)
    })
    
    // 上传顶点数据
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(allVertices), this.gl.DYNAMIC_DRAW)
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.position)
    this.gl.vertexAttribPointer(this.programInfo.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0)
    
    // 上传纹理坐标
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(allTexCoords), this.gl.DYNAMIC_DRAW)
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.texCoord)
    this.gl.vertexAttribPointer(this.programInfo.attribLocations.texCoord, 2, this.gl.FLOAT, false, 0, 0)
    
    // 上传颜色数据
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(allColors), this.gl.DYNAMIC_DRAW)
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.color)
    this.gl.vertexAttribPointer(this.programInfo.attribLocations.color, 4, this.gl.FLOAT, false, 0, 0)
    
    // 绘制
    this.gl.drawArrays(this.gl.TRIANGLES, 0, allVertices.length / 2)
    
    // 清除批次
    this.renderBatch = []
  }
  
  /**
   * 渲染光标
   */
  renderCursor(viewport) {
    if (!viewport.cursor || !viewport.cursor.visible) return
    
    // 简化的光标渲染 - 使用纯色矩形
    const { x, y } = viewport.cursor
    const cursorX = x * this.cellWidth
    const cursorY = y * this.cellHeight
    
    // 这里可以实现光标的WebGL渲染
    // 为简化起见，暂时跳过
  }
  
  /**
   * 解析样式颜色
   */
  parseStyleColor(style) {
    const color = style && style.foreground ? 
      this.parseColor(style.foreground) : 
      this.theme.foreground
    
    const [r, g, b] = this.hexToRgb(color)
    return [r / 255, g / 255, b / 255, 1.0]
  }
  
  /**
   * 十六进制颜色转RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [255, 255, 255]
  }
  
  /**
   * 处理尺寸变化
   */
  onResize() {
    if (this.canvas && this.gl) {
      this.canvas.width = this.canvasWidth
      this.canvas.height = this.canvasHeight
      
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
  }
  
  /**
   * 处理主题变化
   */
  onThemeChange() {
    if (this.gl) {
      const bg = this.parseColor(this.theme.background)
      const [r, g, b] = this.hexToRgb(bg)
      this.gl.clearColor(r / 255, g / 255, b / 255, 1.0)
    }
    
    // 重新创建文字图集
    if (this.enableTextAtlas) {
      this.createTextAtlas()
    }
  }
  
  /**
   * 清空内容
   */
  clear() {
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
  }
  
  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.gl) {
      // 清理WebGL资源
      if (this.shaderProgram) {
        this.gl.deleteProgram(this.shaderProgram)
      }
      
      if (this.vertexShader) {
        this.gl.deleteShader(this.vertexShader)
      }
      
      if (this.fragmentShader) {
        this.gl.deleteShader(this.fragmentShader)
      }
      
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer)
      }
      
      if (this.textureCoordBuffer) {
        this.gl.deleteBuffer(this.textureCoordBuffer)
      }
      
      if (this.colorBuffer) {
        this.gl.deleteBuffer(this.colorBuffer)
      }
      
      if (this.indexBuffer) {
        this.gl.deleteBuffer(this.indexBuffer)
      }
      
      if (this.atlasTexture) {
        this.gl.deleteTexture(this.atlasTexture)
      }
    }
    
    // 清理Canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    
    super.destroy()
  }
  
  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      ...super.getMetrics(),
      webglVersion: this.gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
      textAtlas: this.enableTextAtlas,
      atlasChars: this.charMap.size,
      batchSize: this.renderBatch.length,
      maxBatchSize: this.maxBatchSize
    }
  }
}