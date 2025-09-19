<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="dialogWidth"
    :fullscreen="isMobile"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="html-edit-modal"
    @opened="handleOpened"
    @closed="handleClosed"
  >
    <!-- 工具栏 -->
    <div class="edit-toolbar" :class="{ 'mobile-toolbar': isMobile }">
      <!-- 桌面端工具栏 -->
      <template v-if="!isMobile">
        <div class="tool-group">
          <el-button-group>
            <el-button
              v-for="tool in tools"
              :key="tool.mode"
              :type="toolActive && currentMode === tool.mode ? 'primary' : 'default'"
              @click="toggleTool(tool.mode)"
            >
              <el-icon><component :is="tool.icon" /></el-icon>
              {{ tool.label }}
            </el-button>
          </el-button-group>

          <el-divider direction="vertical" />

          <span v-if="toolActive" class="tool-status active">
            <el-icon><EditPen /></el-icon>
            工具已激活
          </span>
          <span v-else class="tool-status">
            <el-icon><View /></el-icon>
            浏览模式
          </span>
        </div>

        <div class="tool-group" v-if="toolActive && currentMode === 'paint'">
          <span class="tool-label">画笔大小:</span>
          <el-slider
            v-model="brushSize"
            :min="5"
            :max="50"
            :show-tooltip="true"
            style="width: 120px"
            @change="updateBrush"
          />
          <span class="brush-size-value">{{ brushSize }}px</span>
        </div>

        <div class="tool-group">
          <el-button @click="clearSelections" :icon="Delete">
            清除选区
          </el-button>
          <el-button @click="undoSelection" :icon="Back" :disabled="!canUndo">
            撤销
          </el-button>
          <el-button @click="handleManualReload" :icon="Refresh" type="success">
            刷新内容
          </el-button>
        </div>
      </template>

      <!-- 移动端工具栏 - 单行布局 -->
      <template v-else>
        <div class="mobile-toolbar-content">
          <!-- 单行工具栏 -->
          <div class="mobile-single-row">
            <!-- 选择工具 -->
            <div class="tool-group-inline">
              <button
                v-for="tool in tools"
                :key="tool.mode"
                :class="[
                  'mobile-tool-btn',
                  { 'active': toolActive && currentMode === tool.mode }
                ]"
                @click="toggleTool(tool.mode)"
                :title="tool.label"
              >
                <el-icon class="tool-icon">
                  <component :is="getToolIcon(tool.mode)" />
                </el-icon>
              </button>
            </div>

            <!-- 分隔线 -->
            <div class="mobile-divider"></div>

            <!-- 操作工具 -->
            <div class="tool-group-inline">
              <button
                class="mobile-tool-btn"
                @click="clearSelections"
                title="清除选区"
              >
                <el-icon class="tool-icon"><Close /></el-icon>
              </button>
              <button
                class="mobile-tool-btn"
                @click="undoSelection"
                :disabled="!canUndo"
                title="撤销"
              >
                <el-icon class="tool-icon"><ArrowLeft /></el-icon>
              </button>
              <button
                class="mobile-tool-btn refresh"
                @click="handleManualReload"
                title="刷新"
              >
                <el-icon class="tool-icon"><Refresh /></el-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- 画笔大小控制 -->
        <div v-if="toolActive && currentMode === 'paint'" class="mobile-brush-control">
          <span class="brush-label">笔刷大小</span>
          <div class="brush-slider-container">
            <input
              type="range"
              v-model="brushSize"
              :min="5"
              :max="50"
              @input="updateBrush"
              class="brush-slider"
            />
            <span class="brush-value">{{ brushSize }}px</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 主编辑区 -->
    <div class="edit-container">
      <!-- 左侧内容区 -->
      <div class="content-area">
        <div class="content-wrapper" ref="contentWrapperRef">
          <!-- HTML内容容器 -->
          <div class="html-container" ref="htmlContainerRef">
            <!-- 使用iframe渲染HTML内容 -->
            <iframe
              ref="iframeRef"
              class="content-iframe"
              :class="{ 'interactive': !toolActive }"
              sandbox="allow-same-origin allow-scripts"
              @load="handleIframeLoad"
            />

            <!-- 选择覆盖层 - 只在工具激活时显示 -->
            <SelectionOverlay
              v-if="toolActive"
              ref="selectionOverlayRef"
              :visible="overlayVisible && toolActive"
              :container="htmlContainerRef"
              :config="overlayConfig"
              @selection-start="handleSelectionStart"
              @selection-update="handleSelectionUpdate"
              @selection-complete="handleSelectionComplete"
              @selections-change="handleSelectionsChange"
            />
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="tips-bar" v-if="showTips">
          <el-icon><InfoFilled /></el-icon>
          <span>{{ currentTip }}</span>
        </div>
      </div>

      <!-- 右侧面板 -->
      <div class="side-panel" :class="{ 'is-mobile': isMobile }">
        <!-- 选中元素列表 - 移动端隐藏 -->
        <div v-if="!isMobile" class="panel-section">
          <div class="panel-header">
            <span>选中的元素 ({{ selectedElements.length }})</span>
            <el-button
              v-if="selectedElements.length > 0"
              size="small"
              text
              @click="clearSelections"
            >
              清空
            </el-button>
          </div>

          <div class="selected-list">
            <div
              v-if="selectedElements.length === 0"
              class="empty-state"
            >
              <el-empty description="暂无选中元素" :image-size="60" />
            </div>

            <div
              v-for="(item, index) in selectedElements"
              :key="item.id"
              class="selected-item"
              :class="{ active: activeElementIndex === index }"
              @click="setActiveElement(index)"
            >
              <div class="item-header">
                <span class="item-index">#{{ index + 1 }}</span>
                <el-tag size="small" type="info">
                  {{ item.element.tagName }}
                </el-tag>
                <span class="coverage-badge">
                  {{ (item.coverage * 100).toFixed(0) }}%
                </span>
              </div>
              <div class="item-content">
                {{ getElementPreview(item.element) }}
              </div>
              <el-button
                size="small"
                text
                type="danger"
                @click.stop="removeElement(index)"
              >
                移除
              </el-button>
            </div>
          </div>
        </div>

        <!-- 修改输入区 -->
        <div class="panel-section" :class="{ 'mobile-input-section': isMobile }">
          <!-- 桌面端显示标题 -->
          <div v-if="!isMobile" class="panel-header">
            <span>修改内容</span>
          </div>

          <div class="edit-form" :class="{ 'mobile-edit-form': isMobile }">
            <!-- 桌面端布局 -->
            <template v-if="!isMobile">
              <el-input
                v-model="editRequest"
                type="textarea"
                :rows="6"
                placeholder="请描述您想要的修改，例如：&#10;- 将标题改为...&#10;- 修改文字颜色为红色&#10;- 删除这段内容"
                :disabled="selectedElements.length === 0"
              />

              <div class="form-tips" v-if="selectedElements.length === 0">
                <el-icon><Warning /></el-icon>
                请先选择要修改的元素
              </div>
            </template>

            <!-- 移动端布局 - 输入框+发送按钮横向布局 -->
            <template v-else>
              <div class="mobile-input-container">
                <el-input
                  v-model="editRequest"
                  type="textarea"
                  :rows="2"
                  placeholder="请描述修改需求..."
                  :disabled="selectedElements.length === 0"
                  class="mobile-textarea"
                />
                <el-button
                  type="primary"
                  @click="handleApply"
                  :loading="isApplying"
                  :disabled="selectedElements.length === 0 || !editRequest.trim()"
                  class="mobile-send-btn"
                >
                  <el-icon><Position /></el-icon>
                </el-button>
              </div>

              <!-- 移动端提示信息 -->
              <div class="mobile-tips" v-if="selectedElements.length === 0">
                <el-icon><Warning /></el-icon>
                <span>请先选择要修改的元素</span>
              </div>
              <div class="mobile-tips success" v-else-if="selectedElements.length > 0">
                <el-icon><SuccessFilled /></el-icon>
                <span>已选中 {{ selectedElements.length }} 个元素</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 - 移动端隐藏 -->
    <template v-if="!isMobile" #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleApply" :loading="isApplying">
          应用修改
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { ElDialog, ElButton, ElButtonGroup, ElIcon, ElSlider, ElInput, ElTag, ElEmpty, ElMessage, ElDivider } from 'element-plus'
import {
  Edit, Delete, Back, InfoFilled, Warning, EditPen, View, Refresh, Position, SuccessFilled,
  Close, ArrowLeft, Brush, Grid, Select
} from '@element-plus/icons-vue'
import SelectionOverlay from '../SelectionOverlay/index.vue'
// import { HTMLSelectionAdapter } from '../SelectionOverlay/useSelectionOverlay'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  htmlContent: {
    type: String,
    default: ''  // 改为可选，优先使用htmlPath获取
  },
  htmlPath: {
    type: String,
    required: true  // 路径是必需的
  },
  fileId: {
    type: String,
    default: ''
  },
  folderId: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: '编辑HTML内容'
  },
  // 新增：是否自动获取最新内容
  autoFetch: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'apply', 'cancel', 'content-updated'])

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Refs
const contentWrapperRef = ref(null)
const htmlContainerRef = ref(null)
const iframeRef = ref(null)
const selectionOverlayRef = ref(null)

// 状态
const overlayVisible = ref(false)
const toolActive = ref(false)  // 工具是否激活
const currentMode = ref('paint')
const brushSize = ref(20)
const selectedElements = ref([])
const activeElementIndex = ref(-1)
const editRequest = ref('')
const isApplying = ref(false)
const showTips = ref(true)
const selectionHistory = ref([])

// 工具配置
const tools = [
  { mode: 'paint', label: '涂抹', icon: Edit, category: 'select' },
  { mode: 'rectangle', label: '矩形', icon: Edit, category: 'select' },
  { mode: 'lasso', label: '套索', icon: Edit, category: 'select' }
]

// 覆盖层配置
const overlayConfig = reactive({
  mode: 'paint',
  brush: {
    size: 20,
    opacity: 0.3,
    color: '#007AFF',
    shape: 'circle'
  },
  behavior: {
    multiSelect: true,
    autoComplete: false,
    magneticSnap: false
  },
  performance: {
    throttleMs: 8,    // 减少节流，提高响应速度
    sampleRate: 10    // 增加采样率
  },
  visual: {
    showCursor: true,
    showGrid: false,
    showCoordinates: true,
    showDimensions: false
  }
})

// 适配器
// let htmlAdapter = null

const isMobile = computed(() => {
  return window.innerWidth < 768
})

const dialogWidth = computed(() => {
  if (isMobile.value) return '100%'
  return window.innerWidth > 1400 ? '90%' : '1200px'
})

const currentTip = computed(() => {
  if (!toolActive.value) {
    return isMobile.value
      ? '点击工具按钮开始选择'
      : '当前为浏览模式，点击工具按钮激活选择功能'
  }
  if (selectedElements.value.length === 0) {
    return isMobile.value
      ? '用手指涂抹选择要编辑的内容'
      : '使用涂抹工具选择要编辑的内容'
  }
  return isMobile.value
    ? `已选中 ${selectedElements.value.length} 个元素，请输入修改需求`
    : `已选择 ${selectedElements.value.length} 个元素`
})

const canUndo = computed(() => {
  return selectionHistory.value.length > 0
})

// 获取工具图标
const getToolIcon = (mode) => {
  switch (mode) {
    case 'paint':
      return Brush
    case 'rectangle':
      return Grid
    case 'lasso':
      return Select
    default:
      return Edit
  }
}

// 方法
const handleOpened = async () => {
  await nextTick()

  console.log('[HtmlEditModal] Dialog opened')
  console.log('[HtmlEditModal] htmlPath:', props.htmlPath)
  console.log('[HtmlEditModal] autoFetch:', props.autoFetch)

  // 重置状态
  selectedElements.value = []
  // selections.value = []
  // historyStack.value = []
  // isPolling.value = false
  // currentTaskId.value = null

  // 决定如何获取内容
  let contentToShow = null

  if (props.autoFetch && props.htmlPath) {
    // 自动获取最新内容
    console.log('[HtmlEditModal] Auto-fetching content from path')
    lastFetchedPath.value = ''  // 清除缓存
    contentToShow = await fetchContentFromPath(true)
  } else if (props.htmlContent) {
    // 使用传入的内容
    console.log('[HtmlEditModal] Using provided htmlContent')
    contentToShow = props.htmlContent
    currentHtmlContent.value = props.htmlContent
  }

  // 设置iframe内容
  if (contentToShow && iframeRef.value) {
    updateIframeContent(contentToShow)
  }

  console.log('[HtmlEditModal] Modal opened, waiting for iframe load')
}

// iframe加载完成
const handleIframeLoad = async () => {
  console.log('[HtmlEditModal] Iframe loaded')

  // 如果有待显示的内容，现在显示
  if (currentHtmlContent.value && iframeRef.value) {
    const iframeDoc = iframeRef.value.contentDocument || iframeRef.value.contentWindow?.document
    if (iframeDoc && !iframeDoc.body.innerHTML) {
      // 只在iframe是空的时候才写入
      updateIframeContent(currentHtmlContent.value)
    }
  }

  await nextTick()
  overlayVisible.value = true

  // 初始化适配器
  if (selectionOverlayRef.value) {
    // htmlAdapter = new HTMLSelectionAdapter(selectionOverlayRef.value)
  }

  console.log('[HtmlEditModal] Overlay initialized')
}

const handleClosed = () => {
  overlayVisible.value = false
  toolActive.value = false
  clearSelections()
  editRequest.value = ''
  activeElementIndex.value = -1
}

const toggleTool = (mode) => {
  // 如果点击的是当前激活的工具，则取消激活
  if (toolActive.value && currentMode.value === mode) {
    toolActive.value = false
    console.log('工具已取消激活，进入浏览模式')
  } else {
    // 激活新工具或切换工具
    currentMode.value = mode
    overlayConfig.mode = mode
    toolActive.value = true
    console.log(`工具已激活: ${mode}`)
  }
}

// const setMode = (mode) => {
//   currentMode.value = mode
//   overlayConfig.mode = mode
// }

const updateBrush = () => {
  overlayConfig.brush.size = brushSize.value
}

const handleSelectionStart = () => {
  console.log('Selection started')
}

const handleSelectionUpdate = () => {
  // 实时更新选区信息
}

const handleSelectionComplete = (selection) => {
  console.log('Selection complete:', selection)

  // 从iframe检测元素
  if (iframeRef.value) {
    const elements = detectElementsInIframe(selection)

    // 添加到选中列表
    elements.forEach(item => {
      const id = `element_${Date.now()}_${Math.random()}`
      selectedElements.value.push({
        id,
        ...item,
        selection
      })
    })

    // 保存到历史
    selectionHistory.value.push([...selectedElements.value])

    console.log(`已添加 ${elements.length} 个元素到选中列表`)
  }
}

const handleSelectionsChange = (selections) => {
  console.log('Selections changed:', selections)
}

const detectElementsInIframe = (selection) => {
  if (!iframeRef.value || !selection || !selection.bounds) {
    console.warn('无法检测元素: iframe或选区无效')
    return []
  }

  try {
    const iframe = iframeRef.value
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document

    if (!iframeDoc) {
      console.warn('无法访问iframe文档')
      return []
    }

    console.log(`开始检测元素 - 选区: ${selection.bounds.x},${selection.bounds.y} ${selection.bounds.width}x${selection.bounds.height}`)

    const elements = []
    const allElements = iframeDoc.querySelectorAll('*')
    console.log(`总元素数: ${allElements.length}`)

    allElements.forEach(element => {
      // 跳过不可见元素
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return
      }

      const rect = element.getBoundingClientRect()

      // 跳过没有大小的元素
      if (rect.width === 0 || rect.height === 0) {
        return
      }

      // 元素边界（使用getBoundingClientRect的坐标）
      const elementBounds = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }

      // 计算交集
      const intersection = getIntersection(selection.bounds, elementBounds)

      if (intersection) {
        const intersectionArea = intersection.width * intersection.height
        const elementArea = elementBounds.width * elementBounds.height

        // 计算覆盖率
        const coverage = intersectionArea / elementArea

        console.log(`元素 <${element.tagName}> 交集占比: ${(coverage * 100).toFixed(1)}%`)

        elements.push({
          element,
          coverage,
          intersectionArea,
          elementArea,
          bounds: {
            x: elementBounds.left,
            y: elementBounds.top,
            width: elementBounds.width,
            height: elementBounds.height
          },
          tag: element.tagName.toLowerCase(),
          id: element.id,
          classes: Array.from(element.classList),
          text: element.textContent?.slice(0, 100) || ''
        })
      }
    })

    // 按覆盖率排序
    elements.sort((a, b) => b.coverage - a.coverage)

    // 只取前5个元素
    const topElements = elements.slice(0, 5)

    console.log(`检测到 ${elements.length} 个有交集的元素，选择覆盖率最高的前 ${topElements.length} 个`)

    return topElements

  } catch (error) {
    console.error('检测元素时出错:', error)
    return []
  }
}

// 计算矩形交集（完全复制selection_test.html的逻辑）
const getIntersection = (bounds1, bounds2) => {
  // bounds1: 选区边界 {x, y, width, height}
  // bounds2: 元素边界 {left, top, right, bottom, width, height}

  const left = Math.max(bounds1.x, bounds2.left)
  const top = Math.max(bounds1.y, bounds2.top)
  const right = Math.min(bounds1.x + bounds1.width, bounds2.right)
  const bottom = Math.min(bounds1.y + bounds1.height, bounds2.bottom)

  // 如果没有交集
  if (left >= right || top >= bottom) {
    return null
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  }
}


const clearSelections = () => {
  selectedElements.value = []
  activeElementIndex.value = -1

  // 只在覆盖层存在且工具激活时清除
  if (selectionOverlayRef.value && toolActive.value) {
    selectionOverlayRef.value.clearSelections()
  }
}

const undoSelection = () => {
  if (selectionHistory.value.length > 0) {
    selectionHistory.value.pop()
    const prev = selectionHistory.value[selectionHistory.value.length - 1]
    selectedElements.value = prev ? [...prev] : []
  }
}

const setActiveElement = (index) => {
  activeElementIndex.value = index

  // 高亮显示元素
  const item = selectedElements.value[index]
  if (item && item.element) {
    highlightElement(item.element)
  }
}

const highlightElement = (element) => {
  // 临时高亮效果
  const originalOutline = element.style.outline
  const originalOutlineOffset = element.style.outlineOffset
  const originalTransition = element.style.transition

  element.style.transition = 'all 0.3s ease'
  element.style.outline = '3px solid #007AFF'
  element.style.outlineOffset = '2px'

  // 滚动到元素位置
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })

  setTimeout(() => {
    element.style.outline = originalOutline || ''
    element.style.outlineOffset = originalOutlineOffset || ''
    setTimeout(() => {
      element.style.transition = originalTransition || ''
    }, 300)
  }, 2000)
}

const removeElement = (index) => {
  selectedElements.value.splice(index, 1)
  if (activeElementIndex.value >= selectedElements.value.length) {
    activeElementIndex.value = selectedElements.value.length - 1
  }
}

const getElementPreview = (element) => {
  const text = element.textContent?.trim()
  if (text) {
    return text.length > 50 ? text.substring(0, 50) + '...' : text
  }
  return `<${element.tagName.toLowerCase()}>`
}

// 存储当前的HTML内容和状态
const currentHtmlContent = ref('')
const contentLoading = ref(false)
const lastFetchedPath = ref('')
const contentVersion = ref(0)  // 用于强制刷新

// 监听内容的变化，通过路径获取
watch(() => props.htmlPath, async (newPath, oldPath) => {
  if (newPath && newPath !== oldPath && visible.value && props.autoFetch) {
    console.log('[HtmlEditModal] htmlPath changed, fetching new content')
    await fetchContentFromPath(true)
    if (currentHtmlContent.value) {
      updateIframeContent(currentHtmlContent.value)
    }
  }
})

// 监听对话框打开，获取最新内容
watch(visible, async (isVisible) => {
  if (isVisible && props.autoFetch && props.htmlPath) {
    console.log('[HtmlEditModal] Dialog opened, fetching latest content')
    // 强制重新获取
    lastFetchedPath.value = ''
    const content = await fetchContentFromPath(true)
    if (content) {
      updateIframeContent(content)
    }
  }
})

// 向后兼容：监听 htmlContent prop
watch(() => props.htmlContent, (newContent) => {
  if (newContent && visible.value && !props.autoFetch) {
    console.log('[HtmlEditModal] htmlContent prop changed')
    currentHtmlContent.value = newContent
    updateIframeContent(newContent)
  }
})

// 从路径获取最新内容
const fetchContentFromPath = async (forceFetch = false) => {
  if (!props.htmlPath) {
    console.warn('[HtmlEditModal] No htmlPath provided')
    return null
  }

  // 如果不强制获取且路径没变，使用缓存
  if (!forceFetch && props.htmlPath === lastFetchedPath.value && currentHtmlContent.value) {
    console.log('[HtmlEditModal] Using cached content')
    return currentHtmlContent.value
  }

  contentLoading.value = true
  try {
    const username = localStorage.getItem('username') || 'default'
    const timestamp = Date.now()
    const url = `/api/files/read?path=${encodeURIComponent(props.htmlPath)}&username=${username}&t=${timestamp}&v=${contentVersion.value}`

    console.log('[HtmlEditModal] Fetching content from:', url)

    const response = await fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.success && result.content) {
      // 更新内容和状态
      currentHtmlContent.value = result.content
      lastFetchedPath.value = props.htmlPath
      contentVersion.value++

      // 通知父组件
      emit('content-updated', result.content)

      console.log('[HtmlEditModal] Content fetched successfully')
      return result.content
    } else {
      throw new Error(result.error || 'Failed to fetch content')
    }
  } catch (error) {
    console.error('[HtmlEditModal] Failed to fetch content:', error)
    ElMessage.error(`获取内容失败: ${error.message}`)
    return null
  } finally {
    contentLoading.value = false
  }
}

// 更新iframe内容
const updateIframeContent = (content) => {
  if (!content || !iframeRef.value) return

  const iframeDoc = iframeRef.value.contentDocument || iframeRef.value.contentWindow?.document
  if (iframeDoc) {
    // 使用document.write方式更新
    iframeDoc.open()
    iframeDoc.write(content)
    iframeDoc.close()
    console.log('[HtmlEditModal] Iframe content updated')
  }
}

// 公开的重新加载方法
const reloadHtmlContent = async () => {
  console.log('[HtmlEditModal] Reloading HTML content')

  // 强制获取最新内容
  const content = await fetchContentFromPath(true)

  if (content) {
    // 更新iframe
    updateIframeContent(content)

    // 清除选择
    clearSelections()

    ElMessage.success('内容已刷新')
    return content
  }

  return null
}

const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

// 轮询任务状态
const pollTaskStatus = async (taskId) => {
  let retryCount = 0
  const maxRetries = 150 // 最多轮询150次（5分钟）- 匹配后端5分钟超时
  const pollInterval = 2000 // 每2秒查询一次

  const checkStatus = async () => {
    try {
      console.log(`[HtmlEditModal] Polling status for task: ${taskId}`)
      const response = await fetch(`/api/html/status/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log(`[HtmlEditModal] Response status: ${response.status}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`[HtmlEditModal] Status data:`, data)

      // 更新进度（如果需要显示进度条）
      if (data.progress !== undefined) {
        // updateProgressBar(data.progress)
      }

      if (data.status === 'completed') {
        ElMessage.success('修改已完成，正在重新加载...')

        // 清空之前的选择
        selectedElements.value = []
        editRequest.value = ''

        // 重置绘制数据
        if (currentMode.value === 'brush') {
          overlayConfig.brush.drawnPixels.clear()
        }

        // 直接重新加载HTML内容到iframe
        await reloadHtmlContent()

        // 触发应用成功事件，让父组件也更新
        emit('apply', {
          status: 'completed',
          taskId,
          htmlPath: props.htmlPath,
          needReload: true  // 标记需要重新加载
        })

        // 重置应用状态
        isApplying.value = false

        // 不立即关闭对话框，让用户可以继续编辑
        // visible.value = false

        return true
      } else if (data.status === 'failed') {
        ElMessage.error(`修改失败: ${data.error || '未知错误'}`)
        isApplying.value = false
        return true
      } else if (retryCount >= maxRetries) {
        ElMessage.warning('修改超时，请稍后查看结果')
        isApplying.value = false
        return true
      }

      // 继续轮询
      retryCount++
      setTimeout(checkStatus, pollInterval)
      return false

    } catch (error) {
      console.error(`[HtmlEditModal] Status check failed for task ${taskId}:`, error)
      console.error(`[HtmlEditModal] Error details:`, {
        message: error.message,
        stack: error.stack,
        retryCount
      })

      // 网络错误重试
      if (retryCount < 3) {
        retryCount++
        console.log(`[HtmlEditModal] Retrying status check (${retryCount}/3) in ${pollInterval * 2}ms`)
        setTimeout(checkStatus, pollInterval * 2)
      } else {
        ElMessage.error(`网络错误，无法查询任务状态: ${error.message}`)
        isApplying.value = false
      }
      return true
    }
  }

  // 开始轮询
  checkStatus()
}

// 手动刷新按钮处理
const handleManualReload = async () => {
  ElMessage.info('正在刷新内容...')
  const success = await reloadHtmlContent()
  if (success) {
    ElMessage.success('内容已刷新')
  } else {
    ElMessage.error('刷新失败，请重试')
  }
}

const handleApply = async () => {
  console.log('[HtmlEditModal] handleApply called')
  console.log('[HtmlEditModal] props.htmlPath:', props.htmlPath)
  console.log('[HtmlEditModal] props.fileId:', props.fileId)
  console.log('[HtmlEditModal] props.folderId:', props.folderId)
  console.log('[HtmlEditModal] selectedElements:', selectedElements.value.length)

  if (selectedElements.value.length === 0) {
    ElMessage.warning('请先选择要修改的元素')
    return
  }

  if (!editRequest.value.trim()) {
    ElMessage.warning('请输入修改内容')
    return
  }

  if (!props.htmlPath) {
    console.error('[HtmlEditModal] htmlPath is missing!')
    console.log('[HtmlEditModal] All props:', props)
    ElMessage.warning('缺少文件路径信息')
    return
  }

  isApplying.value = true

  try {
    // 将绝对路径转换为相对于workspace的路径
    const username = localStorage.getItem('username') || 'default'
    let relativePath = props.htmlPath

    // 移除路径前缀，只保留相对于workspace的部分
    const workspacePrefix = `/app/data/users/${username}/workspace/`
    if (relativePath.startsWith(workspacePrefix)) {
      relativePath = relativePath.substring(workspacePrefix.length)
    }

    console.log('[HtmlEditModal] Using relative path:', relativePath)

    // 准备请求数据
    const requestData = {
      htmlPath: relativePath,  // 使用相对路径
      fileId: props.fileId,
      folderId: props.folderId,
      elements: selectedElements.value.map(item => ({
        selected_element: item.element.outerHTML,
        selection_coverage_percentage: item.coverage * 100  // 转换为百分比
      })),
      request: editRequest.value,
      timestamp: Date.now()
    }

    // 调用后端API
    const response = await fetch('/api/html/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    const result = await response.json()

    if (result.success) {
      // 开始轮询任务状态
      pollTaskStatus(result.taskId)

      ElMessage.info({
        message: '修改任务已提交，正在处理中...',
        duration: 3000
      })
    } else {
      throw new Error(result.error || '提交失败')
    }
  } catch (error) {
    console.error('提交修改失败:', error)
    ElMessage.error('提交失败，请重试')
    isApplying.value = false
  }
}

// Watch
watch(currentMode, (newMode) => {
  overlayConfig.mode = newMode
})

watch(brushSize, (newSize) => {
  overlayConfig.brush.size = newSize
})

// 监听htmlContent变化，重新初始化（用于修改完成后重新加载）
watch(() => props.htmlContent, (newContent, oldContent) => {
  if (newContent && newContent !== oldContent && visible.value) {
    // 清空选择
    selectedElements.value = []
    editRequest.value = ''

    // 重置绘制数据
    if (currentMode.value === 'brush' && overlayConfig.brush?.drawnPixels) {
      overlayConfig.brush.drawnPixels.clear()
    }

    // 更新 iframe 内容
    const iframe = document.querySelector('.html-preview iframe')
    if (iframe) {
      iframe.srcdoc = ''
      setTimeout(() => {
        iframe.srcdoc = newContent
        console.log('[HtmlEditModal] Iframe content updated with new content')
      }, 100)
    }

    console.log('[HtmlEditModal] HTML content reloaded, selections cleared')
    ElMessage.info('内容已更新，选择已清空')
  }
})
</script>

<style scoped>
.html-edit-modal :deep(.el-dialog__body) {
  padding: 0;
  height: calc(100vh - 140px);
  max-height: 700px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-default, #161b22);
  position: relative;
  overflow: hidden;
}

.html-edit-modal :deep(.el-dialog) {
  background: var(--color-bg-default, #161b22);
  border: 1px solid var(--color-border-default, #30363d);
}

.html-edit-modal :deep(.el-dialog__header) {
  background: var(--color-bg-default, #161b22);
  border-bottom: 1px solid var(--color-border-default, #30363d);
  color: var(--color-text-primary, #f0f6fc);
}

.html-edit-modal :deep(.el-dialog__title) {
  color: var(--color-text-primary, #f0f6fc);
}

.html-edit-modal :deep(.el-dialog__headerbtn) {
  color: var(--color-text-secondary, #8b949e);
}

.html-edit-modal :deep(.el-dialog__headerbtn):hover {
  color: var(--color-text-primary, #f0f6fc);
}

.edit-toolbar {
  padding: 15px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

/* 移动端工具栏样式 - 与深色主题统一 */
.edit-toolbar.mobile-toolbar {
  padding: 12px 16px;
  background: var(--color-bg-default, #161b22);
  border-bottom: 1px solid var(--color-border-default, #30363d);
  min-height: auto;
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

.mobile-toolbar-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-single-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.tool-group-inline {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mobile-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border-default, #30363d);
  flex-shrink: 0;
}


.mobile-tool-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--color-border-default, #30363d);
  background: var(--color-bg-subtle, #21262d);
  color: var(--color-text-secondary, #8b949e);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.mobile-tool-btn:hover:not(:disabled) {
  background: var(--color-bg-muted, #262c36);
  border-color: var(--color-border-muted, #373e47);
  color: var(--color-text-primary, #f0f6fc);
}

.mobile-tool-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.mobile-tool-btn.active {
  background: var(--color-accent-emphasis, #0969da);
  border-color: var(--color-accent-emphasis, #0969da);
  color: white;
  box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.3);
}

.mobile-tool-btn.refresh {
  background: var(--color-success-emphasis, #1a7f37);
  border-color: var(--color-success-emphasis, #1a7f37);
  color: white;
}

.mobile-tool-btn.refresh:hover {
  background: var(--color-success-muted, #2ea043);
}

.mobile-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

/* 画笔控制样式 */
.mobile-brush-control {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-bg-subtle, #21262d);
  border-radius: 6px;
  border: 1px solid var(--color-border-default, #30363d);
}

.brush-label {
  font-size: 12px;
  color: var(--color-text-secondary, #8b949e);
  min-width: 56px;
}

.brush-slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.brush-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border-default, #30363d);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.brush-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent-emphasis, #0969da);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.brush-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent-emphasis, #0969da);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.brush-value {
  font-size: 12px;
  color: var(--color-text-primary, #f0f6fc);
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-label {
  font-size: 14px;
  color: #666;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
}

.tool-status.active {
  color: #007AFF;
  background: #e6f7ff;
  font-weight: 500;
}

.brush-size-value {
  min-width: 40px;
  text-align: center;
  font-weight: bold;
  color: #333;
}

.edit-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  height: 100%;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-canvas, #0d1117);
}

.content-wrapper {
  flex: 1;
  position: relative;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.html-container {
  position: relative;
  width: 100%;
  max-width: 900px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
}

.content-iframe {
  width: 100%;
  height: 600px;
  border: none;
  display: block;
  background: white;
  pointer-events: none;  /* 默认禁用交互 */
}

/* 非激活状态下允许交互 */
.content-iframe.interactive {
  pointer-events: auto;
  overflow: auto;
}

.tips-bar {
  padding: 10px 15px;
  background: #e6f7ff;
  border-top: 1px solid #91d5ff;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #0050b3;
}

.side-panel {
  width: 350px;
  background: white;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-panel.is-mobile {
  width: 100%;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  height: auto;
  min-height: 100px;
  max-height: 150px;
  border-left: none;
  border-top: 1px solid var(--color-border-default, #30363d);
  z-index: 10;
  background: var(--color-bg-default, #161b22);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
}

.panel-section {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header {
  padding: 12px 15px;
  background: #fafafa;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
}

.selected-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  max-height: 300px;
}

.empty-state {
  padding: 20px;
  text-align: center;
}

.selected-item {
  padding: 10px;
  margin-bottom: 8px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.selected-item:hover {
  background: #e6f7ff;
  border-color: #40a9ff;
}

.selected-item.active {
  background: #e6f7ff;
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24,144,255,0.2);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-index {
  font-weight: bold;
  color: #666;
}

.coverage-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: #52c41a;
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
}

.item-content {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.edit-form {
  padding: 15px;
}

.form-tips {
  margin-top: 10px;
  padding: 8px 10px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ad6800;
}

.dialog-footer {
  display: flex;
  gap: 10px;
}

/* 移动端输入区样式 - 深色主题 */
.mobile-input-section {
  border-bottom: none;
  background: var(--color-bg-default, #161b22);
}

.mobile-edit-form {
  padding: 12px 16px;
  background: var(--color-bg-default, #161b22);
}

.mobile-input-container {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.mobile-textarea {
  flex: 1;
}

.mobile-textarea :deep(.el-textarea__inner) {
  background: var(--color-bg-subtle, #21262d);
  border: 1px solid var(--color-border-default, #30363d);
  color: var(--color-text-primary, #f0f6fc);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.4;
  resize: none;
}

.mobile-textarea :deep(.el-textarea__inner):focus {
  border-color: var(--color-accent-emphasis, #0969da);
  box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.3);
}

.mobile-textarea :deep(.el-textarea__inner)::placeholder {
  color: var(--color-text-placeholder, #656d76);
}

.mobile-send-btn {
  height: 60px;
  min-width: 44px;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--color-accent-emphasis, #0969da);
  border: none;
  color: white;
  transition: all 0.2s ease;
}

.mobile-send-btn:hover:not(:disabled) {
  background: var(--color-accent-muted, #0850c5);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(9, 105, 218, 0.3);
}

.mobile-send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.mobile-send-btn:disabled {
  background: var(--color-btn-inactive-bg, #21262d);
  color: var(--color-btn-inactive-text, #656d76);
  cursor: not-allowed;
}

.mobile-tips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--color-attention-subtle, #fff8c5);
  color: var(--color-attention-fg, #9a6700);
  border: 1px solid var(--color-attention-muted, #d4a72c);
}

.mobile-tips.success {
  background: var(--color-success-subtle, #dafbe1);
  color: var(--color-success-fg, #1a7f37);
  border-color: var(--color-success-muted, #4ac26b);
}

.mobile-tips .el-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .edit-container {
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: calc(100vh - 220px); /* 减去头部和底部高度 */
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    position: relative;
    -webkit-overflow-scrolling: touch;
  }

  .html-container {
    position: relative;
    width: 100%;
    height: auto;
    min-height: 500px;
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    background: white;
  }

  .content-iframe {
    width: 100%;
    height: 600px;
    min-height: 500px;
    border: none;
    display: block;
    background: white;
  }

  .side-panel {
    height: auto;
    min-height: 100px;
    max-height: 150px;
  }

  /* 移动端对话框优化 */
  .html-edit-modal :deep(.el-dialog__body) {
    height: calc(100vh - 50px); /* 减去header高度 */
    max-height: calc(100vh - 50px);
    background: var(--color-bg-default, #161b22);
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    position: relative;
  }

  .html-edit-modal :deep(.el-dialog) {
    margin: 0;
    max-width: 100vw;
    border-radius: 0;
    background: var(--color-bg-default, #161b22);
  }

  .html-edit-modal :deep(.el-dialog__header) {
    background: var(--color-bg-default, #161b22);
    border-bottom: 1px solid var(--color-border-default, #30363d);
    padding: 12px 16px;
    position: sticky;
    top: 0;
    z-index: 11;
  }

  /* 隐藏提示栏节省空间 */
  .tips-bar {
    display: none;
  }
}
</style>