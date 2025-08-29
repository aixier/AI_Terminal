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
        :stream-count="streamMessages.length"
        :total-chars="totalChars"
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
        <!-- 移动端顶部用户信息栏 -->
        <UserHeader
          :username="currentUsername"
          :is-connected="isConnected"
          :is-mobile="true"
          @logout="handleLogout"
        />
        
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
    :x="contextMenu.x"
    :y="contextMenu.y"
    :items="contextMenu.items"
    @close="contextMenu.visible = false"
    @select="handleContextMenuSelect"
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
import { useCardGeneration } from './composables/useCardGeneration'
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
import axios from 'axios'

// Router
const router = useRouter()

// ============ Initialization State ============
const showInitializer = ref(true)
const currentUsername = ref(localStorage.getItem('username') || 'Guest')

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
  isGenerating, 
  generatingHint, 
  streamMessages, 
  totalChars,
  startGeneration, 
  processStream, 
  stopGeneration 
} = useCardGeneration()

const { 
  downloadFile, 
  deleteFile, 
  previewHtmlFile,
  getFileContent 
} = useFileOperations()

const {
  messages: chatMessages,
  addUserMessage,
  addAIMessage,
  updateMessage,
  clearHistory: clearChatHistory,
  restoreFromLocal: restoreChatHistory
} = useChatHistory()

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
  if (isMobile.value && activeTab.value === 'portfolio') {
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
  // 处理新的消息格式：{message, template, style, language, reference}
  let message, currentTemplate, style, language, reference
  
  if (typeof messageData === 'string') {
    // 兼容旧格式
    message = messageData
    currentTemplate = null
  } else {
    // 新格式：从ChatInputPanel传来的对象
    message = messageData.message
    currentTemplate = messageData.template
    style = messageData.style
    language = messageData.language
    reference = messageData.reference
  }
  
  if (!message || isGenerating.value) return
  
  addUserMessage(message, currentTemplate)
  const aiMessage = addAIMessage('', true, '', currentTemplate)
  chatInputText.value = ''
  
  // 构建完整的API参数
  const params = {
    topic: message,
    templateName: currentTemplate 
      ? currentTemplate.fileName 
      : 'daily-knowledge-card-template.md',
    token: currentUsername.value  // 页面调用必传
  }
  
  // 添加可选参数（只在有值时传递）
  if (style) params.style = style
  if (language) params.language = language  
  if (reference) params.reference = reference
  
  console.log('[CardGenerator] API params:', params)
  
  const response = await startGeneration(params)
  if (response) {
    await processStream(response, 
      (chunk) => {
        updateMessage(aiMessage.id, {
          content: (aiMessage.content || '') + chunk
        })
      },
      (allChunks) => {
        // 打印完整的流式响应数据，确认格式
        console.log('[CardGenerator] 完整流式响应数据:', allChunks)
        console.log('[CardGenerator] 合并后的内容:', allChunks.join(''))
        
        // 尝试解析最后一个chunk看是否是JSON格式的完整响应
        const lastChunk = allChunks[allChunks.length - 1]
        console.log('[CardGenerator] 最后一个chunk:', lastChunk)
        
        let parsedResponse = null
        let finalResultData = null
        
        try {
          parsedResponse = JSON.parse(lastChunk)
          console.log('[CardGenerator] 解析的JSON响应:', parsedResponse)
          
          // 按照API文档格式解析：data.content是真正的内容
          if (parsedResponse && parsedResponse.data) {
            finalResultData = {
              type: 'html',
              content: parsedResponse.data.content,
              topic: parsedResponse.data.topic,
              fileName: parsedResponse.data.fileName,
              templateName: parsedResponse.data.templateName,
              generationTime: parsedResponse.data.generationTime,
              apiId: parsedResponse.data.apiId
            }
            console.log('[CardGenerator] 格式化后的resultData:', finalResultData)
          }
        } catch (e) {
          console.log('[CardGenerator] 非JSON格式，直接作为HTML内容')
        }
        
        // 如果没有解析成功，使用原有逻辑作为后备
        if (!finalResultData) {
          finalResultData = {
            type: 'html',
            content: allChunks.join(''),
            fileName: `generated_${Date.now()}.html`
          }
        }
        
        updateMessage(aiMessage.id, {
          isGenerating: false,
          resultData: finalResultData
        })
        refreshCardFolders()
      }
    )
  } else {
    updateMessage(aiMessage.id, {
      isGenerating: false,
      error: true,
      content: '生成失败，请重试'
    })
  }
}

const retryGeneration = async (errorMessage) => {
  console.log('Retry generation for:', errorMessage)
}

// ============ Context Menu Methods ============
const showFolderContextMenu = (event, folder) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items: [
      { label: '新建文件夹', action: 'create-folder' },
      { label: '重命名', action: 'rename-folder' },
      { label: '删除', action: 'delete-folder' }
    ],
    context: { type: 'folder', data: folder }
  }
}

const showCardContextMenu = (event, card, folder) => {
  const items = []
  
  if (isHtmlFile(card.name)) {
    items.push(
      { label: '预览', action: 'preview' },
      { label: '分享小红书', action: 'share-xhs' },
      { label: '下载', action: 'download' },
      { label: '删除', action: 'delete' }
    )
  } else {
    items.push(
      { label: '打开', action: 'open' },
      { label: '重命名', action: 'rename' },
      { label: '下载', action: 'download' },
      { label: '删除', action: 'delete' }
    )
  }
  
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items,
    context: { type: 'file', data: { card, folder } }
  }
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
      case 'create-folder':
        console.log('Create folder:', folder)
        break
      case 'rename-folder':
        console.log('Rename folder:', folder)
        break
      case 'delete-folder':
        console.log('Delete folder:', folder)
        break
    }
  }
  
  contextMenu.value.visible = false
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
}

/* 移动端样式 */
.mobile-view-content {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Mobile user header styles moved to UserHeader.vue */

.mobile-tab-area {
  flex: 1;
  overflow: hidden;
  margin-bottom: 60px; /* 为底部导航栏预留空间 */
}

/* Share dialog styles moved to ShareDialog.vue */
</style>