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
    <div class="edit-toolbar">
      <div class="tool-group">
        <el-button-group>
          <el-button
            v-for="tool in tools"
            :key="tool.mode"
            :type="currentMode === tool.mode ? 'primary' : 'default'"
            @click="setMode(tool.mode)"
          >
            <el-icon><component :is="tool.icon" /></el-icon>
            {{ tool.label }}
          </el-button>
        </el-button-group>
      </div>

      <div class="tool-group" v-if="currentMode === 'paint'">
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
      </div>
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
              sandbox="allow-same-origin"
              @load="handleIframeLoad"
            />

            <!-- 选择覆盖层 -->
            <SelectionOverlay
              ref="selectionOverlayRef"
              :visible="overlayVisible"
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
        <!-- 选中元素列表 -->
        <div class="panel-section">
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
        <div class="panel-section">
          <div class="panel-header">
            <span>修改内容</span>
          </div>

          <div class="edit-form">
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
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
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
import { ElDialog, ElButton, ElButtonGroup, ElIcon, ElSlider, ElInput, ElTag, ElEmpty, ElMessage } from 'element-plus'
import { Edit, Delete, Back, InfoFilled, Warning } from '@element-plus/icons-vue'
import SelectionOverlay from '../SelectionOverlay/index.vue'
import { HTMLSelectionAdapter } from '../SelectionOverlay/useSelectionOverlay'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  htmlContent: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '编辑HTML内容'
  }
})

const emit = defineEmits(['update:modelValue', 'apply', 'cancel'])

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
  { mode: 'paint', label: '涂抹', icon: Edit },
  { mode: 'rectangle', label: '矩形', icon: Edit },
  { mode: 'lasso', label: '套索', icon: Edit }
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
let htmlAdapter = null

const isMobile = computed(() => {
  return window.innerWidth < 768
})

const dialogWidth = computed(() => {
  if (isMobile.value) return '100%'
  return window.innerWidth > 1400 ? '90%' : '1200px'
})

const currentTip = computed(() => {
  if (selectedElements.value.length === 0) {
    return '使用涂抹工具选择要编辑的内容'
  }
  return `已选择 ${selectedElements.value.length} 个元素`
})

const canUndo = computed(() => {
  return selectionHistory.value.length > 0
})

// 方法
const handleOpened = async () => {
  await nextTick()

  // 设置iframe内容
  if (iframeRef.value && props.htmlContent) {
    const iframeDoc = iframeRef.value.contentDocument || iframeRef.value.contentWindow.document
    iframeDoc.open()
    iframeDoc.write(props.htmlContent)
    iframeDoc.close()
  }

  console.log('Modal opened, waiting for iframe load')
}

// iframe加载完成
const handleIframeLoad = async () => {
  console.log('Iframe loaded')

  await nextTick()
  overlayVisible.value = true

  // 初始化适配器
  if (selectionOverlayRef.value) {
    htmlAdapter = new HTMLSelectionAdapter(selectionOverlayRef.value)
  }

  console.log('Overlay initialized')
}

const handleClosed = () => {
  overlayVisible.value = false
  clearSelections()
  editRequest.value = ''
  activeElementIndex.value = -1
}

const setMode = (mode) => {
  currentMode.value = mode
  overlayConfig.mode = mode
}

const updateBrush = () => {
  overlayConfig.brush.size = brushSize.value
}

const handleSelectionStart = (event) => {
  console.log('Selection started:', event)
}

const handleSelectionUpdate = (event) => {
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

  if (selectionOverlayRef.value) {
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

const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

const handleApply = async () => {
  if (selectedElements.value.length === 0) {
    ElMessage.warning('请先选择要修改的元素')
    return
  }

  if (!editRequest.value.trim()) {
    ElMessage.warning('请输入修改内容')
    return
  }

  isApplying.value = true

  try {
    // 准备数据
    const data = {
      elements: selectedElements.value.map(item => ({
        tagName: item.element.tagName,
        className: item.element.className,
        id: item.element.id,
        html: item.element.outerHTML,
        coverage: item.coverage
      })),
      request: editRequest.value,
      timestamp: Date.now()
    }

    // 触发应用事件
    emit('apply', data)

    // 关闭对话框
    visible.value = false

    ElMessage.success('修改请求已提交')
  } catch (error) {
    console.error('Apply error:', error)
    ElMessage.error('提交失败，请重试')
  } finally {
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
</script>

<style scoped>
.html-edit-modal :deep(.el-dialog__body) {
  padding: 0;
  height: calc(100vh - 140px);
  max-height: 700px;
  display: flex;
  flex-direction: column;
}

.edit-toolbar {
  padding: 15px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
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
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fafafa;
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
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  border-left: none;
  border-top: 1px solid #e0e0e0;
  z-index: 100;
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
  -webkit-box-orient: vertical;
}

.edit-form {
  padding: 15px;
}

.form-tips {
  margin-top: 10px;
  padding: 10px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ad6800;
}

.dialog-footer {
  display: flex;
  gap: 10px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .edit-container {
    flex-direction: column;
  }

  .content-area {
    height: 60%;
  }

  .side-panel {
    height: 40%;
  }

  .html-container {
    max-width: 100%;
  }

  .content-iframe {
    height: 400px;
  }
}
</style>