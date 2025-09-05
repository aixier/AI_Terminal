<template>
  <!-- Startup Initializer -->
  <StartupInitializer 
    v-if="showInitializer"
    @initialization-complete="onInitializationComplete"
  />
  
  <!-- Main Content (hidden during initialization) -->
  <ResponsiveLayout v-else>
    <!-- 全局任务状态栏 -->
    <template #global-task-status>
      <GlobalTaskStatus
        :is-generating="isGenerating"
        :is-generating-html="Object.values(isGeneratingHtml).some(Boolean)"
        :generating-hint="generatingHint"
        :stream-count="0"
        :total-chars="0"
      />
    </template>
    
    <!-- Desktop Layout -->
    <template #desktop-layout>
      <div class="card-generator-layout">
        <!-- Left Sidebar -->
        <DesktopSidebar
          :username="currentUsername"
          :tabs="desktopTabs"
          :active-tab="activeDesktopTab"
          @logout="handleLogout"
          @update:active-tab="activeDesktopTab = $event"
        />

        <!-- Main Content Area -->
        <div class="main-area">
          <!-- AI Creation Page -->
          <AICreationPage
            v-if="activeDesktopTab === 'ai-creation'"
            :messages="chatMessages"
            :input-text="chatInputText"
            :is-generating="isGenerating"
            :placeholder="chatPlaceholder"
            :is-mobile="false"
            @send-message="handleSendMessage"
            @retry-generation="retryGeneration"
            @refresh-files="refreshCustomFiles"
            @stop-generation="handleStopGeneration"
            @clear-history="clearChatHistory"
            @update:input-text="chatInputText = $event"
          />
          
          <!-- Portfolio Page -->
          <PortfolioPage
            v-else-if="activeDesktopTab === 'portfolio'"
            :folders="cardFolders"
            :selected-folder="selectedFolderInfo"
            :selected-file="selectedCardInfo?.card"
            :generating-files="isGeneratingHtml"
            :file-filter="filterJsonFiles"
            :connection-status="connectionStatus"
            :preview-content="previewContent"
            :preview-type="previewType"
            :is-mobile="false"
            @refresh-folders="refreshCardFolders"
            @toggle-folder="handleToggleFolder"
            @select-file="handleSelectFile"
            @folder-context-menu="showFolderContextMenu"
            @file-context-menu="showCardContextMenu"
            @preview-file="previewHtmlFile"
            @download-file="downloadFile"
            @delete-file="deleteCardFile"
            @delete-folder="deleteFolderAction"
          />
          
          <!-- Terminal Page -->
          <TerminalPage
            v-else-if="activeDesktopTab === 'terminal' && shouldShowTerminal"
            :is-mobile="false"
            :terminal-key="terminalChatKey"
            :should-show-terminal="shouldShowTerminal"
            @open-terminal-page="openTerminalPage"
            @refresh-terminal="refreshMobileTerminal"
          />
        </div>
      </div>
    </template>
    
    <!-- Mobile Layout -->
    <template #mobile-layout>
      <div class="mobile-view-content">
        <!-- 移动端顶部用户信息栏 (固定在顶部) -->
        <div class="mobile-header-fixed">
          <UserHeader
            :username="currentUsername"
            :is-connected="isConnected"
            :is-mobile="true"
            @logout="handleLogout"
          />
        </div>
        
        <!-- Tab内容区域 -->
        <div class="mobile-tab-area">
          <!-- AI Creation Page -->
          <AICreationPage
            v-if="activeMobileTab === 'ai-creation'"
            :messages="chatMessages"
            :input-text="chatInputText"
            :is-generating="isGenerating"
            :placeholder="chatPlaceholder"
            :is-mobile="true"
            @send-message="handleSendMessage"
            @retry-generation="retryGeneration"
            @refresh-files="refreshCustomFiles"
            @stop-generation="handleStopGeneration"
            @clear-history="clearChatHistory"
            @update:input-text="chatInputText = $event"
          />
          
          <!-- Portfolio Page -->
          <PortfolioPage
            v-else-if="activeMobileTab === 'portfolio'"
            :folders="cardFolders"
            :selected-folder="selectedFolderInfo"
            :selected-file="selectedCardInfo?.card"
            :generating-files="isGeneratingHtml"
            :file-filter="filterJsonFiles"
            :preview-content="previewContent"
            :preview-type="previewType"
            :is-mobile="true"
            @refresh-folders="refreshCardFolders"
            @toggle-folder="handleToggleFolder"
            @select-file="handleSelectFile"
            @folder-context-menu="showFolderContextMenu"
            @file-context-menu="showCardContextMenu"
            @preview-file="previewHtmlFile"
            @download-file="downloadFile"
            @delete-file="deleteCardFile"
            @delete-folder="deleteFolderAction"
          />
          
          <!-- Terminal Page -->
          <TerminalPage
            v-else-if="activeMobileTab === 'terminal' && shouldShowTerminal"
            :is-mobile="true"
            :terminal-key="terminalChatKey"
            :should-show-terminal="shouldShowTerminal"
            @open-terminal-page="openTerminalPage"
            @refresh-terminal="refreshMobileTerminal"
          />
        </div>
        
        <!-- 底部导航 -->
        <MobileNavigation
          :tabs="mobileTabs"
          :active-tab="activeMobileTab"
          @update:active-tab="handleTabChange"
        />
      </div>
    </template>
  </ResponsiveLayout>
  
  <!-- Context Menus -->
  <ContextMenu
    v-if="contextMenu.visible"
    :visible="contextMenu.visible"
    :position="{ x: contextMenu.x, y: contextMenu.y }"
    :menu-items="contextMenu.items.map(item => ({
      key: item.action,
      text: item.label,
      icon: item.icon || '',
      disabled: false
    }))"
    @close="contextMenu.visible = false"
    @menu-click="(item) => handleContextMenuSelect(item.key)"
  />
  
  <!-- Share dialog moved to PortfolioPage.vue -->
  
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheckFilled, Plus, CopyDocument, Position } from '@element-plus/icons-vue'

// Import page components
import AICreationPage from './pages/AICreationPage.vue'
import PortfolioPage from './pages/PortfolioPage.vue'
import TerminalPage from './pages/TerminalPage.vue'

// Navigation Components
import DesktopSidebar from './components/DesktopSidebar.vue'
import UserHeader from './components/UserHeader.vue'
import MobileNavigation from './components/MobileNavigation.vue'

// Import composables
import { useAsyncCardGeneration } from './composables/useAsyncCardGeneration.js'
import { useFileOperations } from './composables/useFileOperations'
import { useChatHistory } from './composables/useChatHistory'

// Import other components
import StartupInitializer from '../../components/StartupInitializer.vue'
import ResponsiveLayout from '../../layouts/ResponsiveLayout.vue'
import GlobalTaskStatus from '../../components/GlobalTaskStatus.vue'
// import TabNavigation from '../../components/mobile/TabNavigation.vue' // 已替换为 MobileNavigation
import ContextMenu from '../../components/ContextMenu.vue'

// Import services and APIs
import sseService from '../../services/sseService'
import terminalAPI from '../../api/terminal'
import * as asyncCardApi from '../../api/asyncCardGeneration'

// Router
const router = useRouter()

// ============ Initialization State ============
const showInitializer = ref(true)
const currentUsername = computed(() => localStorage.getItem('username') || '')

// ============ Generation Mode ============
// 仅使用异步模式

// ============ Page Navigation State ============
const activeDesktopTab = ref('ai-creation')
const activeMobileTab = ref('ai-creation')

// Desktop tabs configuration
const desktopTabs = computed(() => {
  const tabs = [
    { key: 'ai-creation', label: 'AI创作', icon: '✨' },
    { key: 'portfolio', label: '作品集', icon: '📂' }
  ]
  
  // Only show terminal tab for default user
  if (shouldShowTerminal.value) {
    tabs.push({ key: 'terminal', label: 'Terminal', icon: '💻' })
  }
  
  return tabs
})

// Mobile tabs configuration
const mobileTabs = computed(() => {
  const tabs = [
    { key: 'ai-creation', label: 'AI创作', icon: '✨' },
    { key: 'portfolio', label: '作品集', icon: '📂' }
  ]
  
  // Only show terminal tab for default user
  if (shouldShowTerminal.value) {
    tabs.push({ key: 'terminal', label: 'Terminal', icon: '💻' })
  }
  
  return tabs
})

// ============ File Management State ============
const cardFolders = ref([])
const selectedCard = ref(null)
const selectedCardInfo = ref(null)
const selectedFolderInfo = ref(null)
const previewContent = ref('')
const previewType = ref('')
const isGeneratingHtml = ref({})

// ============ Template State ============
// 模板状态已移动到ChatInputPanel组件管理

// ============ Connection State ============
const isConnected = ref(false)
const connectionStatus = computed(() => {
  return isConnected.value 
    ? { icon: '🟢', text: '已连接' }
    : { icon: '🔴', text: '未连接' }
})

// ============ Template Availability ============
// 模板可用性检查移动到ChatInputPanel组件

// ============ Mobile State ============
const shouldShowTerminal = computed(() => currentUsername.value === 'default')
const terminalChatKey = ref(0)

// 检测是否为移动端
const isMobile = ref(false)

const updateMobileState = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= 768
  }
}

// ============ Context Menu State ============
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  context: null
})

// Share state moved to PortfolioPage.vue

// ============ Use Composables ============
const {
  messages: chatMessages,
  addUserMessage,
  addAIMessage,
  updateMessage,
  clearHistory: clearChatHistory,
  restoreFromLocal: restoreChatHistory,
  getUnfinishedGeneration
} = useChatHistory()

// 异步生成composable - 传入updateMessage回调
const { 
  isGenerating, 
  generatingStatus: generatingHint, 
  pollingAttempts,
  pollingProgress,
  estimatedTimeLeft,
  formatTimeLeft,
  currentTaskId,
  startAsyncGeneration, 
  stopGeneration,
  refreshStatus,
  recoverGenerationState,
  clearGenerationState
} = useAsyncCardGeneration(updateMessage)

const { 
  downloadFile, 
  deleteFile, 
  previewHtmlFile,
  getFileContent 
} = useFileOperations()

// ============ Chat State ============
const chatInputText = ref('')
const chatPlaceholder = computed(() => {
  return '描述你的创作需求...'
})

// ============ Initialization Methods ============
const onInitializationComplete = () => {
  showInitializer.value = false
  initialize()
}

const initialize = async () => {
  await refreshCardFolders()
  restoreChatHistory()
  setupSSEConnection()
  
  // 恢复生成状态（如果有）
  await recoverGenerationStateOnLoad()
}

// 恢复生成状态
const recoverGenerationStateOnLoad = async () => {
  try {
    console.log('[CardGenerator] 检查是否有未完成的生成任务...')
    
    // 从聊天历史中获取未完成的生成任务
    const unfinishedGeneration = getUnfinishedGeneration()
    
    if (!unfinishedGeneration) {
      console.log('[CardGenerator] 没有未完成的生成任务')
      return
    }
    
    console.log('[CardGenerator] 发现未完成的生成任务:', unfinishedGeneration)
    const result = await recoverGenerationState(unfinishedGeneration)
    
    if (result) {
      console.log('[CardGenerator] 恢复的生成结果:', result)
      
      // 如果任务已完成，更新消息
      if (result.allFiles || result.files) {
        updateMessage(unfinishedGeneration.message.id, {
          isGenerating: false,
          resultData: result,
          content: '任务已完成（从上次会话恢复）',
          generationState: null
        })
        ElMessage.success('之前的生成任务已完成')
      } else {
        // 任务仍在进行中，UI会自动更新
        ElMessage.info('正在恢复之前的生成任务...')
      }
    }
  } catch (error) {
    console.error('[CardGenerator] 恢复生成状态失败:', error)
    // 静默失败，不影响用户体验
  }
}

// ============ Template Methods ============
const loadTemplates = async () => {
  // 模板加载逻辑移动到ChatInputPanel组件
  console.log('[Templates] Template loading moved to ChatInputPanel component')
}

// 模板选择处理已移动到ChatInputPanel组件

// ============ File Management Methods ============
const loadCardFolders = async () => {
  console.log('[LoadFolders v3.65] 📁 Starting to load card folders...')
  console.log('[LoadFolders v3.65] Current username:', currentUsername.value)
  
  try {
    const response = await terminalAPI.getUserFolders()
    console.log('[LoadFolders v3.65] API Response:', response)
    
    if (response && response.success && response.data) {
      const { rootFiles = [], folders = [] } = response.data
      console.log('[LoadFolders v3.65] Root files count:', rootFiles.length)
      console.log('[LoadFolders v3.65] Folders count:', folders.length)
      console.log('[LoadFolders v3.65] Raw folders data:', folders)
      
      if (rootFiles.length > 0) {
        const filteredRootFiles = currentUsername.value === 'default' 
          ? rootFiles 
          : rootFiles.filter(file => !file.name.endsWith('.json'))
        console.log('[LoadFolders v3.65] Filtered root files:', filteredRootFiles)
        
        if (filteredRootFiles.length > 0) {
          const rootFolder = {
            id: 'root-files',
            name: '根目录文件',
            type: 'folder',
            cards: filteredRootFiles.map(file => ({
              id: file.id || file.path,
              name: file.name,
              path: file.path,
              type: file.fileType || 'file',
              size: file.size,
              modified: file.modified
            })),
            subfolders: []
          }
          cardFolders.value = [rootFolder, ...folders.map(transformFolder)]
        } else {
          cardFolders.value = folders.map(transformFolder)
        }
      } else {
        cardFolders.value = folders.map(transformFolder)
      }
      
      console.log('[LoadFolders v3.65] ✅ Final cardFolders structure:', cardFolders.value)
      console.log('[LoadFolders v3.65] Total folders loaded:', cardFolders.value.length)
      cardFolders.value.forEach((folder, index) => {
        console.log(`[LoadFolders v3.65] Folder ${index}: ${folder.name}, files: ${folder.cards?.length || 0}, subfolders: ${folder.subfolders?.length || 0}`)
      })
      return
    }
  } catch (error) {
    console.error('[LoadFolders v3.65] ❌ Failed to load workspace structure:', error)
    ElMessage.error('加载文件夹失败')
  }
  
  if (!cardFolders.value) {
    cardFolders.value = []
    console.log('[LoadFolders v3.65] Set empty folders array')
  }
}

const transformFolder = (folder) => {
  console.log('[TransformFolder v3.65] Processing folder:', folder)
  
  const transformed = {
    id: folder.path || folder.id || folder.name,
    name: folder.name,
    path: folder.path,
    type: 'folder',
    cards: folder.children ? folder.children
      .filter(item => {
        if (currentUsername.value === 'default') {
          return item.type === 'file'
        }
        return item.type === 'file' && !item.name.endsWith('.json')
      })
      .map(file => ({
        id: file.path || file.id,
        name: file.name,
        path: file.path,
        type: file.fileType || 'file',
        size: file.size,
        modified: file.modified
      })) : [],
    subfolders: folder.children ? folder.children.filter(item => item.type === 'folder').map(transformFolder) : []
  }
  
  console.log(`[TransformFolder v3.65] Transformed: ${transformed.name} - ${transformed.cards.length} files, ${transformed.subfolders.length} subfolders`)
  return transformed
}

const refreshCardFolders = async () => {
  console.log('[RefreshFolders] Refreshing card folders from backend...')
  try {
    await loadCardFolders()
    console.log('[RefreshFolders] Folders refreshed successfully')
    return true
  } catch (error) {
    console.error('[RefreshFolders] Failed to refresh folders:', error)
    return false
  }
}

const filterJsonFiles = (files) => {
  return files.filter(file => {
    const name = file.name.toLowerCase()
    return name.endsWith('.json') || name.endsWith('.html') || 
           name.endsWith('.htm') || name.endsWith('.txt')
  })
}

const handleToggleFolder = (folderId) => {
  console.log('Toggle folder:', folderId)
  
  // 在移动端点击作品集文件夹时自动刷新文件列表
  if (isMobile.value && activeMobileTab.value === 'portfolio') {
    console.log('Mobile portfolio folder toggle - refreshing folders')
    refreshCardFolders()
  }
}

const handleSelectFile = async (file, folder) => {
  selectedCard.value = file.id
  selectedCardInfo.value = { card: file, folder }
  
  const content = await getFileContent(file)
  if (content) {
    previewContent.value = content
    previewType.value = getFileType(file.name)
  }
}

const deleteCardFile = async (file, folder) => {
  const success = await deleteFile(file, folder)
  if (success) {
    refreshCardFolders()
    if (selectedCard.value === file.id) {
      selectedCard.value = null
      selectedCardInfo.value = null
      previewContent.value = ''
    }
  }
}

// ============ Chat Methods ============
const handleSendMessage = async (messageData) => {
  // 处理新的消息格式：{message, template, style, language, reference, mode, references}
  let message, currentTemplate, style, language, reference, mode, references
  
  if (typeof messageData === 'string') {
    // 兼容旧格式
    message = messageData
    currentTemplate = null
  } else {
    // 新格式：从ChatInputPanel传来的对象
    message = messageData.message
    currentTemplate = messageData.template  // 完整模板对象，用于显示
    style = messageData.style
    language = messageData.language
    reference = messageData.reference
    mode = messageData.mode  // 自定义模式标识
    references = messageData.references  // 素材引用数组
  }
  
  if (!message || isGenerating.value) return
  
  // 检查用户是否已登录（需要有token）
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  
  if (!token || !username) {
    ElMessage.warning('请先登录后再使用AI创作功能')
    router.push('/login')
    return
  }
  
  addUserMessage(message, currentTemplate)
  
  // 构建完整的API参数
  const params = {
    topic: message,
    token: token  // 使用实际的token
  }
  
  // 自定义模式不使用模板
  if (mode === 'custom') {
    // 自定义模式：不设置 templateName，让后端识别为自定义模式
    params.mode = mode
    if (references && references.length > 0) {
      params.references = references  // 素材引用数组
    }
  } else {
    // 模板模式：设置模板名称
    params.templateName = messageData.templateName || (currentTemplate 
      ? currentTemplate.fileName 
      : 'daily-knowledge-card-template.md')  // 默认使用快速模板
  }
  
  // 添加其他可选参数（只在有值时传递）
  if (style) params.style = style
  if (language) params.language = language  
  if (reference) params.reference = reference
  
  // 创建AI消息时就包含初始的生成状态
  const initialGenerationState = {
    taskId: null, // 还没有taskId，稍后会更新
    params: params,
    pollingAttempts: 0,
    maxAttempts: 100,
    status: '准备生成...'
  }
  
  const aiMessage = addAIMessage('', true, '', currentTemplate, initialGenerationState)
  chatInputText.value = ''
  
  console.log('[CardGenerator] API params:', params)
  console.log('[CardGenerator] Using token:', token)
  console.log('[CardGenerator] Using async generation mode')
  console.log('[CardGenerator] AI Message ID:', aiMessage.id)
  console.log('[CardGenerator] AI Message isGenerating:', aiMessage.isGenerating)
  console.log('[CardGenerator] All messages after add:', chatMessages.value)
  
  // 使用异步模式生成，传入messageId
  const result = await startAsyncGeneration(params, aiMessage.id)
  if (result) {
    const finalResultData = {
      type: result.type,
      content: result.content,
      topic: result.topic,
      fileName: result.fileName,
      templateName: params.templateName,
      allFiles: result.allFiles,
      generatedAt: result.generatedAt,
      // 自定义模式支持
      mode: params.mode,
      folderName: result.folderName,
      files: result.files,
      totalFiles: result.totalFiles,
      mayHaveMore: result.mayHaveMore
    }
    
    updateMessage(aiMessage.id, {
      isGenerating: false,
      resultData: finalResultData
    })
    refreshCardFolders()
  } else {
    // 异步生成失败
    updateMessage(aiMessage.id, {
      isGenerating: false,
      content: '生成失败，请重试',
      error: true
    })
  }
}

const retryGeneration = async (errorMessage) => {
  console.log('Retry generation for:', errorMessage)
}

// 处理终止生成
const handleStopGeneration = () => {
  console.log('[CardGenerator] Stopping generation...')
  
  // 1. 停止异步生成（清理轮询等）
  if (stopGeneration) {
    stopGeneration()
  }
  
  // 2. 找到并删除正在生成的消息
  const generatingMessage = chatMessages.value.find(m => m.isGenerating)
  if (generatingMessage) {
    console.log('[CardGenerator] Removing generating message:', generatingMessage.id)
    // 删除生成中的消息
    chatMessages.value = chatMessages.value.filter(m => m.id !== generatingMessage.id)
  }
  
  // 3. 重置生成状态
  isGenerating.value = false
  
  // 4. 清空输入框（可选）
  // chatInputText.value = ''
  
  ElMessage.success('已终止生成')
}

// 刷新自定义模式的文件列表
const refreshCustomFiles = async (message) => {
  console.log('[RefreshFiles] Refreshing files for message:', message)
  
  if (!message.resultData || !message.resultData.folderName) {
    console.error('[RefreshFiles] No folder name in message')
    return
  }
  
  // 设置刷新状态
  updateMessage(message.id, { isRefreshing: true })
  
  try {
    // 调用刷新API
    const result = await asyncCardApi.refreshGeneratedFiles(message.resultData.folderName)
    
    if (result.success && result.data) {
      console.log('[RefreshFiles] Found files:', result.data.files)
      
      // 更新消息，添加新发现的文件
      const updatedResultData = {
        ...message.resultData,
        files: result.data.files,
        totalFiles: result.data.totalFiles,
        status: result.data.status,
        mayHaveMore: result.data.mayHaveMore,
        lastRefreshed: new Date().toISOString()
      }
      
      // 如果有文件，设置第一个为主要文件
      if (result.data.files && result.data.files.length > 0) {
        const htmlFile = result.data.files.find(f => f.fileType === 'html')
        const primaryFile = htmlFile || result.data.files[0]
        updatedResultData.primaryFile = primaryFile
        updatedResultData.type = primaryFile.fileType || 'file'
      }
      
      updateMessage(message.id, {
        isRefreshing: false,
        resultData: updatedResultData
      })
      
      // 显示提示
      const newFileCount = result.data.totalFiles - (message.resultData.totalFiles || 0)
      if (newFileCount > 0) {
        ElMessage.success(`发现 ${newFileCount} 个新文件`)
      } else {
        ElMessage.info('暂无新文件')
      }
      
      // 刷新文件夹列表
      refreshCardFolders()
      
    } else {
      updateMessage(message.id, { isRefreshing: false })
      ElMessage.warning('刷新失败，请重试')
    }
  } catch (error) {
    console.error('[RefreshFiles] Error refreshing files:', error)
    updateMessage(message.id, { isRefreshing: false })
    ElMessage.error('刷新失败：' + error.message)
  }
}

// ============ Context Menu Methods ============
const showFolderContextMenu = (event, folder) => {
  console.log('[showFolderContextMenu] Triggered for folder:', folder)
  console.log('[showFolderContextMenu] Event:', event)
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items: [
      { label: '重命名', action: 'rename-folder', icon: '✏️' },
      { label: '删除', action: 'delete-folder', icon: '🗑️', danger: true }
    ],
    context: { type: 'folder', data: folder }
  }
  console.log('[showFolderContextMenu] Context menu set:', contextMenu.value)
}

const showCardContextMenu = (event, card, folder) => {
  console.log('[showCardContextMenu] Triggered for card:', card)
  console.log('[showCardContextMenu] Event:', event)
  const items = []
  
  if (isHtmlFile(card.name)) {
    items.push(
      { label: '预览', action: 'preview', icon: '👁️' },
      { label: '分享小红书', action: 'share-xhs', icon: '📤' },
      { label: '下载', action: 'download', icon: '⬇️' },
      { label: '删除', action: 'delete', icon: '🗑️', danger: true }
    )
  } else {
    items.push(
      { label: '下载', action: 'download', icon: '⬇️' },
      { label: '删除', action: 'delete', icon: '🗑️', danger: true }
    )
  }
  
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items,
    context: { type: 'file', data: { card, folder } }
  }
  console.log('[showCardContextMenu] Context menu set:', contextMenu.value)
}

const handleContextMenuSelect = (action) => {
  const { context } = contextMenu.value
  
  if (context.type === 'file') {
    const { card, folder } = context.data
    switch (action) {
      case 'preview':
        previewHtmlFile(card)
        break
      case 'share-xhs':
        shareToXiaohongshu(card, folder)
        break
      case 'download':
        downloadFile(card, folder)
        break
      case 'delete':
        deleteCardFile(card, folder)
        break
      case 'open':
        handleSelectFile(card, folder)
        break
    }
  } else if (context.type === 'folder') {
    const folder = context.data
    switch (action) {
      case 'rename-folder':
        renameFolderAction(folder)
        break
      case 'delete-folder':
        deleteFolderAction(folder)
        break
    }
  }
  
  contextMenu.value.visible = false
}

// ============ Folder Operations ============
const renameFolderAction = async (folder) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的文件夹名称', '重命名文件夹', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: folder.name,
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '文件夹名称不能为空'
        }
        if (value.includes('/') || value.includes('\\')) {
          return '文件夹名称不能包含特殊字符'
        }
        return true
      }
    })
    
    if (value && value !== folder.name) {
      const response = await terminalAPI.renameFolder({
        oldPath: folder.path,
        newName: value.trim()
      })
      
      if (response.success) {
        ElMessage.success('文件夹重命名成功')
        await refreshCardFolders()
      } else {
        ElMessage.error(response.message || '重命名失败')
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Rename folder error:', error)
      ElMessage.error('重命名操作失败')
    }
  }
}

const deleteFolderAction = async (folder) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件夹 "${folder.name}" 吗？该操作将删除文件夹内的所有文件。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await terminalAPI.deleteFolder({
      path: folder.path
    })
    
    if (response.success) {
      ElMessage.success('文件夹删除成功')
      // 如果删除的是当前选中的文件夹，清除选中状态
      if (selectedFolderInfo.value?.path === folder.path) {
        selectedFolderInfo.value = null
        selectedCardInfo.value = null
      }
      await refreshCardFolders()
    } else {
      ElMessage.error(response.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete folder error:', error)
      ElMessage.error('删除操作失败')
    }
  }
}

// ============ SSE Connection ============
const setupSSEConnection = () => {
  sseService.connect()
  
  sseService.on('connected', () => {
    isConnected.value = true
    console.log('SSE connected')
  })
  
  sseService.on('file-update', () => {
    refreshCardFolders()
  })
  
  sseService.on('disconnected', () => {
    isConnected.value = false
    console.log('SSE disconnected')
  })
}

// Share methods moved to PortfolioPage.vue

// ============ Utility Methods ============
const isHtmlFile = (filename) => {
  const name = filename.toLowerCase()
  return name.endsWith('.html') || name.endsWith('.htm')
}

const getFileType = (filename) => {
  const ext = filename.split('.').pop().toUpperCase()
  return ext
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  router.push('/login')
}


const openTerminalPage = () => {
  window.open('/terminal', '_blank')
}

const refreshMobileTerminal = () => {
  terminalChatKey.value++
  console.log('[Terminal] Mobile terminal chat refreshed')
}

const handleTabChange = (newTab) => {
  console.log('[CardGenerator] Tab changed to:', newTab)
  activeMobileTab.value = newTab
}

// ============ Lifecycle ============
onMounted(() => {
  if (!showInitializer.value) {
    initialize()
  }
  
  updateMobileState()
  window.addEventListener('resize', updateMobileState)
})

onUnmounted(() => {
  sseService.disconnect()
  stopGeneration()
  
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateMobileState)
  }
})
</script>

<style scoped>
.card-generator-layout {
  display: flex;
  height: 100vh;
  background: #f0f2f5;
}

/* Desktop layout styles moved to DesktopSidebar.vue */

.main-area {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}


/* 移动端样式 */
.mobile-view-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
}

/* Mobile user header styles moved to UserHeader.vue */

/* 固定头部容器 */
.mobile-header-fixed {
  position: fixed; /* 改为fixed确保始终在顶部 */
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100; /* 提高z-index确保在其他内容之上 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.mobile-tab-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-top: 50px; /* 为固定头部留出空间 */
  /* 不需要 margin-bottom，因为 ResponsiveLayout 已经处理了底部导航栏的空间 */
}

/* Share dialog styles moved to ShareDialog.vue */
</style>