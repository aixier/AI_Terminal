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
        :stream-count="allStreamMessages.length"
        :total-chars="totalMessageChars"
      />
    </template>
    
    <!-- Desktop Layout -->
    <template #desktop-layout>
      <div class="card-generator-layout">
    <!-- Connection Status Bar -->
    
    <!-- Left Sidebar - My Cards -->
    <div class="left-sidebar">
      <!-- User Info Section -->
      <div class="user-info-section">
        <div class="user-avatar">
          <span class="avatar-icon">👤</span>
        </div>
        <div class="user-details">
          <div class="username">{{ currentUsername }}</div>
          <button class="logout-btn" @click="handleLogout" title="退出登录">
            <span class="logout-icon">🚪</span>
            <span class="logout-text">退出</span>
          </button>
        </div>
      </div>
      
      <div class="sidebar-header">
        <span class="sidebar-title">我的卡片</span>
        <span v-if="isConnected" class="connection-indicator" title="已连接">
          🟢
        </span>
        <span v-else class="connection-indicator" title="未连接">
          🔴
        </span>
        <button class="refresh-btn" @click="refreshCardFolders" title="刷新">
          🔄
        </button>
      </div>
      <div class="folder-tree">
        <div 
          v-for="folder in cardFolders" 
          :key="folder.id"
          class="folder-container"
        >
          <div 
            class="folder-item"
            :class="{ 
              expanded: expandedFolders.includes(folder.id),
              selected: selectedFolderInfo?.id === folder.id
            }"
            @click="toggleFolder(folder.id)"
            @contextmenu.prevent="showFolderContextMenu($event, folder)"
          >
            <span class="folder-icon">{{ expandedFolders.includes(folder.id) ? '📂' : '📁' }}</span>
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">({{ filterJsonFiles(folder.cards).length + (folder.folders ? folder.folders.reduce((sum, sf) => sum + filterJsonFiles(sf.cards).length, 0) : 0) }})</span>
            <div class="folder-status">
              <span v-if="selectedFolderInfo?.id === folder.id" class="status-indicator selected">✓</span>
            </div>
          </div>
          
          <div v-if="expandedFolders.includes(folder.id)" class="cards-list">
            <!-- Render subfolders -->
            <div 
              v-for="subfolder in folder.subfolders" 
              :key="subfolder.id"
              class="folder-container subfolder"
            >
              <div 
                class="folder-item subfolder-item"
                :class="{ 
                  expanded: expandedFolders.includes(subfolder.id),
                  selected: selectedFolderInfo?.id === subfolder.id
                }"
                @click="toggleFolder(subfolder.id)"
                @contextmenu.prevent="showFolderContextMenu($event, subfolder)"
              >
                <span class="folder-icon">{{ expandedFolders.includes(subfolder.id) ? '📂' : '📁' }}</span>
                <span class="folder-name">{{ subfolder.name }}</span>
                <span class="folder-count">({{ filterJsonFiles(subfolder.cards).length }})</span>
              </div>
              
              <div v-if="expandedFolders.includes(subfolder.id)" class="cards-list subfolder-cards">
                <div 
                  v-for="card in filterJsonFiles(subfolder.cards)" 
                  :key="card.id"
                  class="card-item"
                  :class="{ active: selectedCard === card.id }"
                  @click="selectCard(card.id, subfolder.id)"
                  @contextmenu.prevent="showCardContextMenu($event, card, subfolder)"
                >
                  <span class="card-icon">
                    {{ getFileIcon(card.name) }}
                  </span>
                  <span class="card-name">{{ card.name }}</span>
                  <div class="card-status">
                    <span v-if="isGeneratingHtml[card.id]" class="status-indicator generating">⏳</span>
                    <span v-else-if="selectedCardInfo?.card.id === card.id" class="status-indicator selected">✓</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Render direct files -->
            <div 
              v-for="card in filterJsonFiles(folder.cards)" 
              :key="card.id"
              class="card-item"
              :class="{ active: selectedCard === card.id }"
              @click="selectCard(card.id, folder.id)"
              @contextmenu.prevent="showCardContextMenu($event, card, folder)"
            >
              <span class="card-icon">
                {{ getFileIcon(card.name) }}
              </span>
              <span class="card-name">{{ card.name }}</span>
              <div class="card-status">
                <span class="card-type">{{ getFileType(card.name) }}</span>
                <span v-if="isGeneratingHtml[card.id]" class="status-indicator generating">⏳</span>
                <span v-else-if="selectedCardInfo?.card.id === card.id" class="status-indicator selected">✓</span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="cardFolders.length === 0" class="empty-message">
          暂无卡片文件夹
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-area">
      <!-- Top: Card Preview Area -->
      <div class="preview-area">
        <div class="area-header">
          <div class="area-title">
            {{ selectedCard ? '卡片内容预览' : '生成结果预览' }}
            <span v-if="selectedCard && previewType" class="preview-type-tag">{{ previewType.toUpperCase() }}</span>
          </div>
          
          <!-- 顶部操作按钮栏 -->
          <div v-if="selectedCardInfo || selectedFolderInfo" class="top-action-bar">
            <div class="selected-item-info">
              <span class="selected-icon">
                {{ selectedFolderInfo ? (expandedFolders.includes(selectedFolderInfo.id) ? '📂' : '📁') : getFileIcon(selectedCardInfo?.card.name) }}
              </span>
              <span class="selected-name">
                {{ selectedFolderInfo ? selectedFolderInfo.name : selectedCardInfo?.card.name }}
              </span>
              <span v-if="!selectedFolderInfo" class="selected-type">
                {{ getFileType(selectedCardInfo?.card.name) }}
              </span>
            </div>
            
            <div class="action-buttons">
              <!-- 文件操作按钮 -->
              <template v-if="selectedCardInfo">
                <!-- HTML文件：只显示预览、下载、删除 -->
                <template v-if="selectedCardInfo.card.name.toLowerCase().endsWith('.html') || selectedCardInfo.card.name.toLowerCase().endsWith('.htm')">
                  <!-- 预览按钮 -->
                  <button 
                    class="action-btn primary"
                    @click="previewHtmlFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="预览"
                  >
                    <span class="btn-icon">👁️</span>
                    <span class="btn-text">预览</span>
                  </button>
                  
                  <!-- 下载按钮 -->
                  <button 
                    class="action-btn"
                    @click="downloadFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="下载"
                  >
                    <span class="btn-icon">⬇️</span>
                    <span class="btn-text">下载</span>
                  </button>
                  
                  <!-- 删除按钮 -->
                  <button 
                    class="action-btn danger"
                    @click="deleteCardFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="删除文件"
                  >
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">删除</span>
                  </button>
                </template>
                
                <!-- 非HTML文件：显示完整功能按钮 -->
                <template v-else>
                  <!-- 打开按钮 -->
                  <button 
                    class="action-btn primary"
                    @click="selectCard(selectedCardInfo.card.id, selectedCardInfo.folder.id)"
                    title="打开"
                  >
                    <span class="btn-icon">📄</span>
                    <span class="btn-text">打开</span>
                  </button>
                  
                  <!-- 生成HTML按钮 - 只对JSON文件显示 -->
                  <button 
                    v-if="selectedCardInfo.card.name.toLowerCase().endsWith('.json')"
                    class="action-btn"
                    @click="generateHtmlFromJson(selectedCardInfo.card, selectedCardInfo.folder)"
                    :disabled="isGeneratingHtml[selectedCardInfo.card.id]"
                    title="生成HTML"
                  >
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">{{ isGeneratingHtml[selectedCardInfo.card.id] ? '生成中' : '生成HTML' }}</span>
                  </button>
                  
                  <!-- 下载按钮 -->
                  <button 
                    class="action-btn"
                    @click="downloadFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="下载"
                  >
                    <span class="btn-icon">⬇️</span>
                    <span class="btn-text">下载</span>
                  </button>
                  
                  <!-- 重命名按钮 -->
                  <button 
                    class="action-btn"
                    @click="renameFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="重命名"
                  >
                    <span class="btn-icon">✏️</span>
                    <span class="btn-text">重命名</span>
                  </button>
                  
                  <!-- 删除按钮 -->
                  <button 
                    class="action-btn danger"
                    @click="deleteCardFile(selectedCardInfo.card, selectedCardInfo.folder)"
                    title="删除文件"
                  >
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">删除</span>
                  </button>
                </template>
              </template>
              
              <!-- 文件夹操作按钮 -->
              <template v-if="selectedFolderInfo">
                <!-- 刷新按钮 - 所有文件夹都可以刷新 -->
                <button 
                  class="action-btn"
                  @click="refreshCardFolders"
                  title="刷新"
                >
                  <span class="btn-icon">🔄</span>
                  <span class="btn-text">刷新</span>
                </button>
                
                <!-- 重命名按钮 - 所有文件夹都可以重命名 -->
                <button 
                  class="action-btn"
                  @click="renameFolder(selectedFolderInfo)"
                  title="重命名文件夹"
                >
                  <span class="btn-icon">✏️</span>
                  <span class="btn-text">重命名</span>
                </button>
                
                <!-- 删除按钮 - 所有文件夹都可以删除 -->
                <button 
                  class="action-btn danger"
                  @click="deleteFolder(selectedFolderInfo)"
                  title="删除文件夹"
                >
                  <span class="btn-icon">🗑️</span>
                  <span class="btn-text">删除</span>
                </button>
              </template>
              
              <!-- 取消选择按钮 - 当有选择时显示 -->
              <button 
                v-if="selectedCardInfo || selectedFolderInfo"
                class="action-btn secondary"
                @click="clearSelection"
                title="取消选择"
              >
                <span class="btn-icon">✖️</span>
                <span class="btn-text">取消选择</span>
              </button>
            </div>
          </div>
        </div>
        <!-- Tab 切换区域 -->
        <div v-if="previewType === 'iframe' && responseUrls.shareLink && responseUrls.originalUrl" class="preview-tabs">
          <div 
            class="preview-tab" 
            :class="{ active: activePreviewTab === 'shareLink' }"
            @click="switchPreviewTab('shareLink')"
          >
            <span class="tab-icon">🔗</span>
            <span class="tab-label">分享链接</span>
          </div>
          <div 
            class="preview-tab" 
            :class="{ active: activePreviewTab === 'originalUrl' }"
            @click="switchPreviewTab('originalUrl')"
          >
            <span class="tab-icon">📄</span>
            <span class="tab-label">原始HTML</span>
          </div>
        </div>
        <div class="preview-content">
          
          <!-- HTML内容直接渲染 -->
          <HtmlContentViewer
            v-if="previewType === 'html-content' && previewContent"
            :html-content="previewContent"
            :scale-mode="iframeScaleMode"
            :folder-name="currentGeneratedFolder"
            :template-name="currentTemplateName"
            @refresh="handleHtmlRefresh"
            class="html-content-viewer-container"
          />
          
          <!-- 使用智能URL预览组件（Web Components + 智能降级） -->
          <!-- 当有两个URL时，根据activePreviewTab切换显示 -->
          <SmartUrlPreview 
            v-else-if="(previewType === 'html' || previewType === 'iframe') && responseUrls.shareLink && responseUrls.originalUrl"
            :url="activePreviewTab === 'originalUrl' ? responseUrls.originalUrl : responseUrls.shareLink"
            :key="activePreviewTab"
          />
          
          <!-- 只有单个URL时的显示 -->
          <SmartUrlPreview 
            v-else-if="(previewType === 'html' || previewType === 'iframe') && previewContent"
            :url="previewContent"
          />
          
          <!-- JSON文件使用验证JSON查看器 -->
          <ValidatedJsonViewer 
            v-else-if="previewContent && previewType === 'json'"
            :data="previewContent"
            class="json-viewer-preview"
            @fixed="handleJsonFixed"
          />
          
          <!-- Markdown文件查看器 -->
          <SimpleMarkdownViewer
            v-else-if="previewContent && previewType === 'markdown'"
            :content="previewContent"
            class="markdown-viewer-preview"
          />
          
          <!-- 默认内容 -->
          <div v-else class="empty-state">
            {{ selectedCard ? '加载卡片内容...' : '等待生成卡片...' }}
          </div>
        </div>
      </div>

      <!-- Resizable Splitter -->
      <ResizableSplitter 
        v-if="shouldShowTerminal && showTerminal"
        direction="horizontal" 
        :min-size="120" 
        :max-size="Infinity"
        @resize="handleTerminalResize"
      />

      <!-- Bottom: Terminal Area (可折叠) - 仅default用户可见 -->
      <div v-if="shouldShowTerminal" class="terminal-area" :class="{ collapsed: !showTerminal }" :style="terminalStyle">
        <div class="terminal-header" @click="showTerminal = !showTerminal">
          <span class="terminal-title">
            <span class="terminal-toggle">{{ showTerminal ? '▼' : '▶' }}</span>
            terminal
          </span>
          <div class="terminal-actions" v-if="showTerminal">
            <!-- 桌面端操作：新窗口 / 刷新 移到标题右侧 -->
            <button class="terminal-action-btn" @click.stop="openTerminalPage" title="在新页面打开终端">🚀</button>
            <button class="terminal-action-btn" @click.stop="refreshTerminalChat" title="刷新终端">🔄</button>
            <!-- 原有流式状态指示器（保留条件显示） -->
            <div v-if="streamingStatus.isStreaming" class="streaming-indicator" style="margin-left:8px;">
              <span class="streaming-dot"></span>
              <span>接收中... ({{ Math.round(streamingStatus.bufferLength / 1024) }}KB)</span>
            </div>
          </div>
        </div>
        <div class="terminal-content" v-show="showTerminal">
          <!-- 嵌入式终端 -->
          <div class="embedded-terminal">
            <TerminalChat :key="terminalChatKey" />
          </div>
        </div>
      </div>
    </div>

    <!-- Right Sidebar - Style Templates & Input -->
    <div class="right-sidebar">
      <!-- Top: Style Templates -->
      <div class="style-templates">
        <div class="template-header">风格模板</div>
        <div class="template-list">
          <div 
            v-for="(template, index) in templates" 
            :key="index"
            class="template-item"
            :class="{ active: selectedTemplate === index }"
            @click="selectTemplate(index)"
          >
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
          </div>
        </div>
      </div>

      <!-- Upload Section - 临时隐藏模板管理功能 -->
      <!-- 
      <div class="upload-section">
        <div class="upload-header">模板管理</div>
        <div class="upload-actions">
          <button 
            class="upload-btn folder-btn"
            @click="uploadFolder"
            :disabled="isUploading"
            title="上传本地文件夹"
          >
            {{ isUploading ? '📤 上传中...' : '📁 上传文件夹' }}
          </button>
          
          <button 
            class="upload-btn file-btn"
            @click="uploadFiles"
            :disabled="isUploading"
            title="上传本地文件"
          >
            {{ isUploading ? '📤 上传中...' : '📄 上传文件' }}
          </button>
          
          <input 
            ref="fileInput" 
            type="file" 
            multiple 
            style="display: none" 
            @change="handleFileUpload"
          />
          <input 
            ref="folderInput" 
            type="file" 
            webkitdirectory 
            style="display: none" 
            @change="handleFolderUpload"
          />
        </div>
      </div>
      -->

      <!-- Stream Messages Display - 简化为字符计数 -->
      <div v-if="allStreamMessages.length > 0" class="stream-messages">
        <div class="stream-header">生成日志 ({{ totalMessageChars }}字符)</div>
        <div class="stream-content">
          <div class="stream-summary">
            共 {{ allStreamMessages.length }} 条消息，总计 {{ totalMessageChars }} 个字符
          </div>
        </div>
      </div>

      <!-- Bottom: Input & Create -->
      <div class="input-create-section">
        <!-- Optional Parameters Section -->
        <div class="optional-params">
          <div class="params-header">
            <span class="params-title">可选参数</span>
            <span class="params-hint">（点击启用）</span>
          </div>
          
          <!-- Style Parameter -->
          <div class="param-item">
            <label class="param-checkbox">
              <input type="checkbox" v-model="enableStyle" />
              <span>风格</span>
            </label>
            <input 
              v-if="enableStyle"
              v-model="customStyle"
              type="text"
              class="param-input"
              placeholder="输入风格，如：简约、中国风、科技感"
            />
          </div>
          
          <!-- Language Parameter -->
          <div class="param-item">
            <label class="param-checkbox">
              <input type="checkbox" v-model="enableLanguage" />
              <span>语言</span>
            </label>
            <input 
              v-if="enableLanguage"
              v-model="customLanguage"
              type="text"
              class="param-input"
              placeholder="输入语言，如：中文、英文、中英双语"
            />
          </div>
          
          <!-- Reference Parameter -->
          <div class="param-item">
            <label class="param-checkbox">
              <input type="checkbox" v-model="enableReference" />
              <span>参考</span>
            </label>
            <textarea 
              v-if="enableReference"
              v-model="customReference"
              class="param-textarea"
              rows="3"
              placeholder="输入参考内容，如背景信息、具体要求等"
            />
          </div>
        </div>
        
        <!-- Topic Input -->
        <div class="input-wrapper">
          <input 
            v-model="currentTopic"
            type="text"
            class="topic-input"
            placeholder="输入主题"
          />
          <button 
            class="create-btn"
            @click="generateCard"
            :disabled="!currentTopic.trim() || isGenerating"
          >
            {{ isGenerating ? '生成中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
      </div>
    </template>
    
    <!-- Mobile Layout -->
    <template #mobile-layout="slotProps">
      <div class="mobile-view-content">
        <!-- 移动端顶部用户信息栏 -->
        <div class="mobile-user-header">
          <div class="mobile-user-info">
            <span class="mobile-avatar-icon">👤</span>
            <span class="mobile-username">{{ currentUsername }}</span>
            <span v-if="isConnected" class="mobile-connection-status connected" title="已连接">🟢</span>
            <span v-else class="mobile-connection-status disconnected" title="未连接">🔴</span>
          </div>
          <button class="mobile-logout-btn" @click="handleLogout" title="退出登录">
            <span class="logout-icon">🚪</span>
            <span class="logout-text">退出</span>
          </button>
        </div>
        
        <!-- Tab内容区域 -->
        <div class="mobile-tab-area">
          <!-- AI创作 Tab - Chat Mode -->
          <div v-if="currentMobileTab === 'create'" class="mobile-tab-content create-tab-chat">
            <!-- 对话历史区域 -->
            <div class="chat-history" ref="chatContainer">
              <div 
                v-for="message in chatMessages" 
                :key="message.id"
                class="chat-message"
                :class="message.type"
              >
                <!-- 用户消息 -->
                <div v-if="message.type === 'user'" class="user-message">
                  <div class="message-bubble user-bubble">
                    {{ message.content }}
                  </div>
                  <div class="message-time">{{ formatMessageTime(message.timestamp) }}</div>
                </div>
                
                <!-- AI响应 -->
                <div v-else class="ai-message">
                  <div class="ai-avatar">🤖</div>
                  <div class="ai-response">
                    <!-- 生成中状态 -->
                    <div v-if="message.isGenerating" class="generating-message">
                      <div class="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                      <div class="generating-text">AI正在创作中...</div>
                    </div>
                    <!-- 生成完成的卡片 -->
                    <div v-else class="result-card">
                      <div class="card-header">
                        <span class="card-icon">{{ getTemplateIcon(message.template) }}</span>
                        <span class="card-title">{{ message.title || '生成结果' }}</span>
                      </div>
                      <div class="card-preview">
                        {{ message.content ? message.content.substring(0, 100) + '...' : '' }}
                      </div>
                      <div class="card-actions">
                        <button class="card-btn primary" @click="previewChatContent(message)">
                          👁️ 预览
                        </button>
                        <button class="card-btn" @click="saveChatContent(message)">
                          💾 保存
                        </button>
                        <button class="card-btn" @click="shareChatContent(message)">
                          🔗 分享
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 空状态提示 -->
              <div v-if="chatMessages.length === 0" class="chat-empty-state">
                <div class="empty-icon">💬</div>
                <div class="empty-text">开始你的AI创作之旅</div>
                <div class="empty-hint">选择一个模板或直接输入你的需求</div>
              </div>
            </div>
            
            <!-- 模板快选 + 输入区域 -->
            <div class="chat-input-section">
              <!-- 模板快选按钮 -->
              <div class="template-shortcuts">
                <button 
                  v-for="template in popularTemplates" 
                  :key="template.id"
                  class="shortcut-btn"
                  :class="{ active: selectedQuickTemplate === template.id }"
                  @click="selectQuickTemplate(template)"
                >
                  <span class="shortcut-icon">{{ template.icon }}</span>
                  <span class="shortcut-text">{{ template.name }}</span>
                </button>
                <button class="shortcut-btn more" @click="showAllTemplates">
                  更多...
                </button>
              </div>
              
              <!-- 输入框 -->
              <div class="input-container">
                <input
                  v-model="chatInputText"
                  class="chat-input"
                  placeholder="描述你的创作需求..."
                  @keydown.enter="sendChatMessage"
                />
                <button 
                  class="send-btn"
                  :disabled="!canSendMessage"
                  @click="sendChatMessage"
                >
                  <span v-if="isGenerating">⏳</span>
                  <span v-else>发送</span>
                </button>
              </div>
            </div>
          </div><!-- 关闭 create-tab-chat -->
        
        <!-- 文件 Tab -->
        <div v-else-if="currentMobileTab === 'files'" class="mobile-tab-content files-tab">
          <!-- Left Sidebar Content (My Cards) -->
          <div class="mobile-sidebar-header">
            <span class="sidebar-title">我的卡片</span>
            <button class="refresh-btn" @click="refreshCardFolders" title="刷新">🔄</button>
          </div>
          
          <!-- 文件操作栏（根据选中项动态显示按钮） -->
          <div v-if="selectedCardInfo || selectedFolderInfo" class="file-action-bar">
            <!-- 选中项信息 -->
            <div class="mobile-selected-info">
              <span class="selected-icon">
                {{ selectedFolderInfo ? (expandedFolders.includes(selectedFolderInfo.id) ? '📂' : '📁') : getFileIcon(selectedCardInfo?.card.name) }}
              </span>
              <span class="selected-name">
                {{ selectedFolderInfo ? selectedFolderInfo.name : selectedCardInfo?.card.name }}
              </span>
            </div>
            
            <!-- 动态操作按钮 -->
            <div class="mobile-action-buttons">
              <!-- 文件操作 -->
              <template v-if="selectedCardInfo">
                <!-- HTML文件：只显示预览、下载、删除 -->
                <template v-if="selectedCardInfo.card.name.toLowerCase().endsWith('.html') || selectedCardInfo.card.name.toLowerCase().endsWith('.htm')">
                  <!-- 预览按钮 -->
                  <button 
                    class="action-btn primary"
                    @click="previewHtmlFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    👁️ 预览
                  </button>
                  
                  <!-- 下载按钮 -->
                  <button 
                    class="action-btn"
                    @click="downloadFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    ⬇️ 下载
                  </button>
                  
                  <!-- 删除按钮 -->
                  <button 
                    class="action-btn danger"
                    @click="deleteCardFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    🗑️ 删除
                  </button>
                </template>
                
                <!-- 非HTML文件：显示完整功能按钮 -->
                <template v-else>
                  <!-- 打开按钮 -->
                  <button 
                    class="action-btn primary"
                    @click="selectCard(selectedCardInfo.card.id, selectedCardInfo.folder.id)"
                  >
                    📄 打开
                  </button>
                  
                  <!-- 生成HTML按钮 - 只对JSON文件显示 -->
                  <button 
                    v-if="selectedCardInfo.card.name.toLowerCase().endsWith('.json')"
                    class="action-btn"
                    @click="generateHtmlFromJson(selectedCardInfo.card, selectedCardInfo.folder)"
                    :disabled="isGeneratingHtml[selectedCardInfo.card.id]"
                  >
                    🔄 {{ isGeneratingHtml[selectedCardInfo.card.id] ? '生成中' : '生成HTML' }}
                  </button>
                  
                  <!-- 下载按钮 -->
                  <button 
                    class="action-btn"
                    @click="downloadFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    ⬇️ 下载
                  </button>
                  
                  <!-- 重命名按钮 -->
                  <button 
                    class="action-btn"
                    @click="renameFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    ✏️ 重命名
                  </button>
                  
                  <!-- 删除按钮 -->
                  <button 
                    class="action-btn danger"
                    @click="deleteCardFile(selectedCardInfo.card, selectedCardInfo.folder)"
                  >
                    🗑️ 删除
                  </button>
                </template>
              </template>
              
              <!-- 文件夹操作 -->
              <template v-if="selectedFolderInfo">
                <!-- 刷新按钮 -->
                <button 
                  class="action-btn"
                  @click="refreshCardFolders"
                >
                  🔄 刷新
                </button>
                
                <!-- 重命名按钮 -->
                <button 
                  class="action-btn"
                  @click="renameFolder(selectedFolderInfo)"
                >
                  ✏️ 重命名
                </button>
                
                <!-- 删除按钮 -->
                <button 
                  class="action-btn danger"
                  @click="deleteFolder(selectedFolderInfo)"
                >
                  🗑️ 删除
                </button>
              </template>
              
              <!-- 取消选择按钮 -->
              <button 
                class="action-btn secondary"
                @click="clearSelection"
              >
                ✖️ 取消
              </button>
            </div>
          </div>
          
          <div class="mobile-folder-tree">
            <div 
              v-for="folder in cardFolders" 
              :key="folder.id"
              class="folder-container"
            >
              <div 
                class="folder-item"
                :class="{ expanded: expandedFolders.includes(folder.id) }"
                @click="toggleFolder(folder.id)"
                @contextmenu.prevent="showFolderContextMenu($event, folder)"
              >
                <span class="folder-icon">{{ expandedFolders.includes(folder.id) ? '📂' : '📁' }}</span>
                <span class="folder-name">{{ folder.name }}</span>
                <span class="folder-count">({{ filterJsonFiles(folder.cards).length + (folder.folders ? folder.folders.reduce((sum, sf) => sum + filterJsonFiles(sf.cards).length, 0) : 0) }})</span>
                <button 
                  class="delete-folder-btn"
                  @click.stop="deleteFolder(folder)"
                  title="删除文件夹"
                >
                  🗑️
                </button>
              </div>
              
              <div v-if="expandedFolders.includes(folder.id)" class="cards-list">
                <!-- Render subfolders in mobile view -->
                <div 
                  v-for="subfolder in folder.subfolders" 
                  :key="subfolder.id"
                  class="folder-container subfolder"
                >
                  <div 
                    class="folder-item subfolder-item"
                    :class="{ expanded: expandedFolders.includes(subfolder.id) }"
                    @click="toggleFolder(subfolder.id)"
                    @contextmenu.prevent="showFolderContextMenu($event, subfolder)"
                  >
                    <span class="folder-icon">{{ expandedFolders.includes(subfolder.id) ? '📂' : '📁' }}</span>
                    <span class="folder-name">{{ subfolder.name }}</span>
                    <span class="folder-count">({{ filterJsonFiles(subfolder.cards).length }})</span>
                  </div>
                  
                  <div v-if="expandedFolders.includes(subfolder.id)" class="cards-list subfolder-cards">
                    <div 
                      v-for="card in filterJsonFiles(subfolder.cards)" 
                      :key="card.id"
                      class="card-item"
                      :class="{ active: selectedCard === card.id }"
                      @click="selectCard(card.id, subfolder.id)"
                      @contextmenu.prevent="showCardContextMenu($event, card, subfolder)"
                    >
                      <span class="card-icon">{{ getFileIcon(card.name) }}</span>
                      <span class="card-name">{{ card.name }}</span>
                      <div class="card-actions">
                        <button 
                          v-if="getFileIcon(card.name) === '📄' && !card.name.includes('-response')"
                          class="generate-html-btn"
                          @click.stop="generateHtmlForCard(card, subfolder)"
                          :disabled="isGeneratingHtml[card.id]"
                          :title="isGeneratingHtml[card.id] ? '生成中...' : '生成HTML页面'"
                        >
                          {{ isGeneratingHtml[card.id] ? '⏳' : '🎨' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Render direct files in mobile view -->
                <div 
                  v-for="card in filterJsonFiles(folder.cards)" 
                  :key="card.id"
                  class="card-item"
                  :class="{ active: selectedCard === card.id }"
                  @click="selectCard(card.id, folder.id)"
                  @contextmenu.prevent="showCardContextMenu($event, card, folder)"
                >
                  <span class="card-icon">{{ getFileIcon(card.name) }}</span>
                  <span class="card-name">{{ card.name }}</span>
                  <div class="card-actions">
                    <button 
                      class="delete-card-btn"
                      @click.stop="deleteCardFile(card, folder)"
                      title="删除文件"
                    >
                      ❌
                    </button>
                    <span class="card-type">{{ getFileType(card.name) }}</span>
                    <button 
                      v-if="card.name.toLowerCase().endsWith('.json')"
                      :id="`generate-html-btn-${card.id}`"
                      class="generate-html-btn"
                      @click.stop="generateHtmlFromJson(card, folder)"
                      :disabled="isGeneratingHtml[card.id]"
                      title="生成HTML"
                    >
                      <svg v-if="!isGeneratingHtml[card.id]" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                        <path d="M8.646 6.646a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L10.293 9 8.646 7.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                      <span v-else class="loading-spinner">⟳</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="cardFolders.length === 0" class="empty-message">
              暂无卡片文件夹
            </div>
          </div><!-- 关闭 mobile-folder-tree -->
        </div><!-- 关闭 files-tab -->
        
        <!-- Terminal Tab - 仅default用户可见 -->
        <div v-else-if="currentMobileTab === 'terminal' && shouldShowTerminal" class="mobile-tab-content terminal-tab">
          <!-- 移动端终端工具栏 -->
          <div class="mobile-terminal-toolbar">
            <button class="mobile-terminal-btn" @click="openTerminalPage" title="在新页面打开终端">
              🚀 新页面
            </button>
            <button class="mobile-terminal-btn" @click="refreshMobileTerminal" title="刷新终端">
              🔄 刷新
            </button>
          </div>
          
          <!-- 移动端聊天式终端 -->
          <div class="mobile-embedded-terminal">
            <TerminalChat :key="terminalChatMobileKey" />
          </div>
        </div><!-- 关闭 terminal-tab -->
      </div><!-- 关闭 mobile-tab-area -->
    </div><!-- 关闭 mobile-view-content -->
    </template>

    <!-- 全屏预览内容（覆盖层） -->
    <template #fullscreen-content>
      <div class="mobile-preview-content fill">
        
        <!-- 移动端预览Tab：分享链接 / 原始HTML -->
        <div
          v-if="previewType === 'html' || previewType === 'iframe'"
          class="mobile-preview-tabs"
        >
          <button
            class="mobile-preview-tab"
            :class="{ active: activePreviewTab === 'shareLink', disabled: !responseUrls.shareLink && !previewContent }"
            @click="responseUrls.shareLink || previewContent ? switchPreviewTab('shareLink') : null"
          >
            <span class="tab-icon">🔗</span>
            <span class="tab-label">分享链接</span>
          </button>
          <button
            class="mobile-preview-tab"
            :class="{ active: activePreviewTab === 'originalUrl', disabled: !responseUrls.originalUrl && !previewContent }"
            @click="responseUrls.originalUrl || previewContent ? switchPreviewTab('originalUrl') : null"
          >
            <span class="tab-icon">📄</span>
            <span class="tab-label">原始HTML</span>
          </button>
        </div>
        
        <div class="preview-body" v-if="!isGenerating">
          <HtmlContentViewer
            v-if="previewType === 'html-content' && previewContent"
            :html-content="previewContent"
            :scale-mode="iframeScaleMode"
            :is-mobile="device.isMobile.value"
            :folder-name="currentGeneratedFolder"
            :template-name="currentTemplateName"
            @refresh="handleHtmlRefresh"
            @openLink="handleOpenHtmlLink"
            class="html-content-viewer-container"
          />
          <SmartUrlPreview 
            v-else-if="(previewType === 'html' || previewType === 'iframe') && (responseUrls.shareLink || responseUrls.originalUrl || previewContent)"
            :url="activePreviewTab === 'originalUrl' ? (responseUrls.originalUrl || previewContent) : (responseUrls.shareLink || previewContent)"
            :key="activePreviewTab + (responseUrls.shareLink || responseUrls.originalUrl || previewContent)"
          />
          <ValidatedJsonViewer v-else-if="previewContent && previewType === 'json'" :data="previewContent" class="json-viewer-preview fill" />
          <SimpleMarkdownViewer v-else-if="previewContent && previewType === 'markdown'" :content="previewContent" class="markdown-viewer-preview fill" />
          <div v-else class="empty-state">暂无可预览内容</div>
        </div>
      </div>
    </template>
    
    <!-- Mobile Navigation -->
    <template #mobile-navigation>
      <TabNavigation :customTabs="filteredMobileTabs" />
    </template>
  </ResponsiveLayout>

  <!-- Context Menu -->
  <ContextMenu
    :visible="contextMenu.visible"
    :position="contextMenu.position"
    :menuItems="contextMenu.items"
    @menu-click="handleContextMenuClick"
    @close="closeContextMenu"
  />

</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import terminalAPI from '../api/terminal'
import cardGeneratorAPI from '../api/cardGenerator'
import sseService from '../services/sseService'
import ValidatedJsonViewer from '../components/ValidatedJsonViewer.vue'
import SmartUrlPreview from '../components/SmartUrlPreview.vue'
import HtmlContentViewer from '../components/HtmlContentViewer.vue'
import ResizableSplitter from '../components/ResizableSplitter.vue'
import SimpleMarkdownViewer from '../components/SimpleMarkdownViewer.vue'
import ResponsiveLayout from '../layouts/ResponsiveLayout.vue'
import TabNavigation from '../components/mobile/TabNavigation.vue'
import StartupInitializer from '../components/StartupInitializer.vue'
import ContextMenu from '../components/ContextMenu.vue'
import GlobalTaskStatus from '../components/GlobalTaskStatus.vue'
import { useDevice } from '../composables/useDevice.js'
import axios from '../api/config.js'
import { useLayoutStore, MOBILE_TABS } from '../store/layout.js'
import { useRouter } from 'vue-router'
import TerminalChat from '../components/mobile/TerminalChat.vue'

// Router
const router = useRouter()

// State
const showInitializer = ref(true)  // 显示初始化界面
const currentUsername = ref(localStorage.getItem('username') || 'Default User')
const currentTopic = ref('')
const isGenerating = ref(false)
const selectedTemplate = ref(0)
const selectedCard = ref(null)
const selectedFolder = ref(null)
// 新增：用于顶部操作栏的选择状态
const selectedCardInfo = ref(null) // { card, folder }
const selectedFolderInfo = ref(null) // folder object
// 当前生成的文件夹名称和模板名称（用于传递给 HtmlContentViewer）
const currentGeneratedFolder = ref('')
const currentTemplateName = ref('')

// 可选参数的启用状态和值
const enableStyle = ref(false)
const enableLanguage = ref(false)
const enableReference = ref(false)
const customStyle = ref('')
const customLanguage = ref('')
const customReference = ref('')
// Terminal相关refs已移除，现在使用独立终端页面
const cardFolders = ref([])
const templates = ref([])
const expandedFolders = ref([])
const streamingStatus = ref({
  isStreaming: false,
  bufferLength: 0
})
const previewContent = ref('')
const previewType = ref('')
const isGeneratingHtml = ref({})
const isLoadingPreview = ref(false) // 预览内容加载状态
const previewLoadingProgress = ref(0) // 预览加载进度
const showTerminal = ref(false) // Terminal默认折叠，点击标题可展开
const iframeScaleMode = ref('fit') // 'fit' or 'fill' - 默认适应模式，显示完整内容
const iframeSandbox = ref('allow-scripts allow-forms allow-popups allow-same-origin allow-storage-access-by-user-activation')
const generatingHint = ref('主题正在处理中，请稍候...')
const terminalHeight = ref(300) // 桌面端终端区域高度（可拖拽）

// 打开独立终端页面
const openTerminalPage = () => {
  // 在新窗口中打开终端页面
  window.open('/terminal', '_blank')
}

// 嵌入式终端相关
const terminalIframe = ref(null) // 已不使用iframe，保留变量避免引用报错
const mobileTerminalIframe = ref(null) // 同上
const terminalChatKey = ref(0)
const terminalChatMobileKey = ref(0)

// 刷新终端iframe
const refreshTerminal = () => {
  // 兼容旧函数名，不再刷新iframe
  refreshTerminalChat()
}

const refreshTerminalChat = () => {
  terminalChatKey.value++
  console.log('[Terminal] Terminal chat remounted')
}

// 刷新移动端终端iframe
const refreshMobileTerminal = () => {
  terminalChatMobileKey.value++
  console.log('[Terminal] Mobile terminal chat remounted')
}

// 新增：用于存储两种URL
const responseUrls = ref({
  shareLink: '',
  originalUrl: ''
})
const activePreviewTab = ref('shareLink') // 当前激活的tab

// ============ Chat Mode State Management ============
// 聊天消息数据结构
const chatMessages = ref([])
// 聊天输入状态
const chatInputText = ref('')
const isSending = ref(false)
// 快捷模板列表（移动端显示4-6个）
const popularTemplates = ref([
  { id: 'daily', icon: '📝', name: '日记' },
  { id: 'report', icon: '📊', name: '报告' },
  { id: 'email', icon: '✉️', name: '邮件' },
  { id: 'article', icon: '📄', name: '文章' },
  { id: 'social', icon: '📱', name: '动态' },
  { id: 'note', icon: '📋', name: '笔记' }
])
// 当前选中的快捷模板
const selectedQuickTemplate = ref(null)

// ============ Chat History Management Functions ============
// 添加用户消息到聊天历史
const addUserMessage = (content, template = null) => {
  const message = {
    id: `user_${Date.now()}`,
    type: 'user',
    content: content,
    template: template,
    timestamp: new Date()
  }
  chatMessages.value.push(message)
  return message
}

// 添加AI响应消息到聊天历史
const addAIMessage = (content = '', isGenerating = false, title = '', template = null) => {
  const message = {
    id: `ai_${Date.now()}`,
    type: 'ai',
    content: content,
    title: title,
    template: template,
    isGenerating: isGenerating,
    timestamp: new Date(),
    resultData: null // 存储完整的生成结果
  }
  chatMessages.value.push(message)
  return message
}

// 更新AI消息（用于流式生成）
const updateAIMessage = (messageId, updates) => {
  const index = chatMessages.value.findIndex(m => m.id === messageId)
  if (index !== -1) {
    chatMessages.value[index] = {
      ...chatMessages.value[index],
      ...updates
    }
  }
}

// 清空聊天历史
const clearChatHistory = () => {
  chatMessages.value = []
  chatInputText.value = ''
  selectedQuickTemplate.value = null
}

// 格式化时间显示
const formatMessageTime = (timestamp) => {
  const now = new Date()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  
  return timestamp.toLocaleDateString()
}

// 获取模板图标
const getTemplateIcon = (templateId) => {
  const template = popularTemplates.value.find(t => t.id === templateId)
  return template ? template.icon : '📄'
}

// 计算是否可以发送消息
const canSendMessage = computed(() => {
  return chatInputText.value.trim().length > 0 && !isSending.value && !isGenerating.value
})

// 滚动到最新消息
const scrollToLatestMessage = async () => {
  await nextTick()
  const chatContainer = document.querySelector('.chat-history')
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight
  }
}

// 保存聊天历史到本地存储（最多保存10条）
const saveChatHistoryToLocal = () => {
  const recentMessages = chatMessages.value.slice(-10)
  localStorage.setItem('chatHistory', JSON.stringify(recentMessages))
}

// 从本地存储恢复聊天历史
const restoreChatHistoryFromLocal = () => {
  const saved = localStorage.getItem('chatHistory')
  if (saved) {
    try {
      const messages = JSON.parse(saved)
      // 恢复时间戳为Date对象
      messages.forEach(msg => {
        msg.timestamp = new Date(msg.timestamp)
      })
      chatMessages.value = messages
    } catch (e) {
      console.error('Failed to restore chat history:', e)
    }
  }
}

// ============ Chat Mode Integration with Existing Generation ============
// 发送聊天消息（集成现有生成逻辑）
const sendChatMessage = async () => {
  if (!canSendMessage.value) return
  
  const userInput = chatInputText.value.trim()
  const selectedTemplateObj = selectedQuickTemplate.value || selectedTemplate.value
  
  // 添加用户消息
  addUserMessage(userInput, selectedTemplateObj)
  
  // 添加AI占位消息
  const aiMessage = addAIMessage('', true, '', selectedTemplateObj)
  
  // 清空输入框
  chatInputText.value = ''
  
  // 滚动到最新消息
  await scrollToLatestMessage()
  
  // 设置当前主题（用于现有生成逻辑）
  currentTopic.value = userInput
  
  try {
    // 调用现有的生成逻辑
    await generateCardForChat(aiMessage.id)
  } catch (error) {
    // 更新AI消息为错误状态
    updateAIMessage(aiMessage.id, {
      isGenerating: false,
      content: '生成失败，请重试',
      error: true
    })
    ElMessage.error('生成失败：' + error.message)
  }
  
  // 保存聊天历史
  saveChatHistoryToLocal()
}

// 为聊天模式修改的生成函数（基于现有generateCard）
const generateCardForChat = async (messageId) => {
  if (!currentTopic.value.trim() || isGenerating.value) return
  
  // 获取模板信息
  const templateIndex = selectedQuickTemplate.value ? 
    templates.value.findIndex(t => t.name.includes(selectedQuickTemplate.value)) : 
    selectedTemplate.value
    
  const templateObj = templates.value[templateIndex] || templates.value[0]
  const templateName = templateObj.fileName || 'daily-knowledge-card-template.md'
  
  // 保存当前模板名称
  currentTemplateName.value = templateName
  currentGeneratedFolder.value = currentTopic.value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  
  // 清理之前的内容
  previewContent.value = ''
  previewType.value = ''
  generatingHint.value = '正在准备生成...'
  streamMessages.value = []
  allStreamMessages.value = []
  
  isGenerating.value = true
  
  try {
    generatingHint.value = '正在连接服务...'
    
    // 使用 fetch API 处理 SSE 流
    const token = localStorage.getItem('token')
    const headers = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    // 构建请求体
    const requestBody = {
      topic: currentTopic.value.trim(),
      templateName
    }
    
    // 添加可选参数
    if (enableStyle.value && customStyle.value.trim()) {
      requestBody.style = customStyle.value.trim()
    }
    if (enableLanguage.value && customLanguage.value.trim()) {
      requestBody.language = customLanguage.value.trim()
    }
    if (enableReference.value && customReference.value.trim()) {
      requestBody.reference = customReference.value.trim()
    }
    
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-card/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            continue
          }
          
          try {
            const parsed = JSON.parse(data)
            
            // 添加到流消息
            streamMessages.value.push(parsed.content || '')
            allStreamMessages.value.push(parsed.content || '')
            
            // 累积完整内容
            if (parsed.content) {
              fullContent += parsed.content
              // 实时更新AI消息内容
              updateAIMessage(messageId, {
                content: fullContent,
                title: templateObj.title || '生成结果'
              })
            }
            
            // 更新生成提示
            if (parsed.status) {
              generatingHint.value = parsed.status
            }
          } catch (e) {
            console.error('Parse error:', e)
          }
        }
      }
    }
    
    // 生成完成
    ElMessage.success('卡片生成成功！')
    
    // 设置预览内容
    previewContent.value = fullContent
    previewType.value = 'json'
    
    // 更新AI消息为完成状态
    updateAIMessage(messageId, {
      isGenerating: false,
      content: fullContent,
      title: templateObj.title || '生成结果',
      resultData: {
        content: fullContent,
        template: templateName,
        folder: currentGeneratedFolder.value
      }
    })
    
    // 滚动到最新消息
    await scrollToLatestMessage()
    
    // 刷新文件列表
    await refreshCardFolders()
    
  } catch (error) {
    console.error('Generation error:', error)
    throw error
  } finally {
    isGenerating.value = false
    generatingHint.value = ''
  }
}

// 选择快捷模板
const selectQuickTemplate = (template) => {
  selectedQuickTemplate.value = template.id
  // 可以在输入框显示提示
  if (!chatInputText.value) {
    chatInputText.value = `帮我写一份${template.name}`
  }
}

// 预览聊天消息内容
const previewChatContent = (message) => {
  if (message.resultData) {
    previewContent.value = message.content
    previewType.value = 'json'
  }
}

// 保存聊天消息内容
const saveChatContent = async (message) => {
  if (!message.resultData) return
  
  try {
    // 调用现有的保存逻辑
    const folderName = message.resultData.folder
    const content = message.content
    
    // 这里可以调用现有的保存函数
    ElMessage.success('内容已保存到文件系统')
    await refreshCardFolders()
  } catch (error) {
    ElMessage.error('保存失败：' + error.message)
  }
}

// 分享聊天消息内容
const shareChatContent = async (message) => {
  if (!message.content) return
  
  try {
    // 复制到剪贴板
    await navigator.clipboard.writeText(message.content)
    ElMessage.success('内容已复制到剪贴板')
  } catch (error) {
    ElMessage.error('分享失败：' + error.message)
  }
}

// 显示所有模板（弹出完整列表）
const showAllTemplates = () => {
  // 可以显示一个模态框或者展开更多模板
  ElMessage.info('更多模板功能开发中...')
}

// 终端功能已移至独立页面

// 上传相关状态  
const fileInput = ref(null)
const folderInput = ref(null)
const isUploading = ref(false)

// Stream messages state
const streamMessages = ref([]) // 存储最近的流消息
const allStreamMessages = ref([]) // 存储所有的流消息用于计数
const MAX_STREAM_MESSAGES = 5 // 最多显示5条消息

// 计算总字符数（基于所有消息）
const totalMessageChars = computed(() => {
  return allStreamMessages.value.reduce((total, msg) => total + (msg?.length || 0), 0)
})

// 添加消息的辅助函数
const addStreamMessage = (message) => {
  if (!message) return
  
  // 添加到所有消息列表（用于计数）
  allStreamMessages.value.push(message)
  
  // 添加到显示列表（保持最多5条）
  streamMessages.value.push(message)
  if (streamMessages.value.length > MAX_STREAM_MESSAGES) {
    streamMessages.value.shift()
  }
}

// 过滤掉JSON文件的辅助函数（default用户不过滤）
const filterJsonFiles = (cards) => {
  if (!cards) return []
  // default用户显示所有文件，不过滤
  if (currentUsername.value === 'default') {
    return cards
  }
  // 非default用户过滤掉JSON文件
  return cards.filter(card => !card.name.endsWith('.json'))
}

// 判断是否显示terminal面板（仅default用户可见）
const shouldShowTerminal = computed(() => {
  return currentUsername.value === 'default'
})

// 过滤移动端tabs（非default用户不显示terminal tab）
const filteredMobileTabs = computed(() => {
  if (currentUsername.value === 'default') {
    return [] // 返回空数组使用默认的所有tabs
  }
  
  // 非default用户过滤掉terminal tab，返回完整的tab配置对象
  const tabConfigs = [
    {
      key: MOBILE_TABS.CREATE,
      label: 'AI创作',
      icon: '📝',
      description: '模板选择和AI创作',
      badge: 0
    },
    {
      key: MOBILE_TABS.FILES,
      label: '作品集',
      icon: '📁',
      description: '作品文件管理',
      badge: 0
    }
    // 不包含MOBILE_TABS.TERMINAL
  ]
  
  return tabConfigs
})

// 过滤ANSI转义序列的函数
const stripAnsiCodes = (str) => {
  if (!str) return ''
  // 移除ANSI转义序列（颜色、光标移动等）
  return str
    .replace(/\x1b\[[0-9;]*m/g, '') // 颜色码
    .replace(/\x1b\[[0-9]*[A-Za-z]/g, '') // 光标控制
    .replace(/\x1b\]0;[^\x07]*\x07/g, '') // 窗口标题
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 控制字符
    .replace(/\[2K\[1A/g, '') // 清除行和上移
    .replace(/✻|✽|✶|\*|✢|·/g, '') // 动画字符
    .trim()
}

// SSE相关
let sseUnsubscribe = null
const isSSEConnected = ref(false)

// Terminal连接状态
let terminalInitialized = ref(false)

// 设备和布局检测
const device = useDevice()
const layoutStore = useLayoutStore()
const currentMobileTab = computed(() => layoutStore.activeMobileTab)

// WebSocket连接状态
// 连接状态逻辑已移除，终端现在通过iframe嵌入

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  items: [],
  target: null,
  targetType: null // 'folder' | 'file'
})


// Methods

// 右键菜单相关方法
const showFolderContextMenu = (event, folder) => {
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    items: [
      { key: 'rename', icon: '✏️', text: '重命名', disabled: false },
      { separator: true },
      { key: 'delete', icon: '🗑️', text: '删除文件夹', disabled: false },
      { separator: true },
      { key: 'refresh', icon: '🔄', text: '刷新', disabled: false }
    ],
    target: folder,
    targetType: 'folder'
  }
}

const showCardContextMenu = (event, card, folder) => {
  const isJsonFile = card.name.toLowerCase().endsWith('.json')
  const isHtmlFile = card.name.toLowerCase().endsWith('.html') || card.name.toLowerCase().endsWith('.htm')
  
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    items: [
      { key: 'open', icon: '📄', text: '打开', disabled: false },
      { key: 'rename', icon: '✏️', text: '重命名', disabled: false },
      { separator: true },
      { key: 'download', icon: '⬇️', text: '下载', disabled: false },
      { separator: true },
      ...(isJsonFile ? [{ key: 'generate-html', icon: '🔄', text: '生成HTML', disabled: isGeneratingHtml.value[card.id] }] : []),
      ...(isHtmlFile ? [{ key: 'preview', icon: '👁️', text: '预览', disabled: false }] : []),
      { separator: true },
      { key: 'delete', icon: '🗑️', text: '删除文件', disabled: false }
    ].filter(item => item !== null),
    target: { card, folder },
    targetType: 'file'
  }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

// 处理终端区域大小调整 - 已重定向到独立页面
const handleTerminalResize = (newHeight) => {
  // 桌面端自由调整终端高度
  terminalHeight.value = Math.max(120, Math.round(newHeight))
}

const handleContextMenuClick = (item) => {
  const { target, targetType } = contextMenu.value
  
  switch (item.key) {
    case 'rename':
      if (targetType === 'folder') {
        renameFolder(target)
      } else {
        renameFile(target.card, target.folder)
      }
      break
    case 'delete':
      if (targetType === 'folder') {
        deleteFolder(target)
      } else {
        deleteCardFile(target.card, target.folder)
      }
      break
    case 'refresh':
      refreshCardFolders()
      break
    case 'open':
      selectCard(target.card.id, target.folder.id)
      break
    case 'download':
      downloadFile(target.card, target.folder)
      break
    case 'generate-html':
      generateHtmlFromJson(target.card, target.folder)
      break
    case 'preview':
      previewHtmlFile(target.card, target.folder)
      break
  }
  
  closeContextMenu()
}

// 处理退出登录
const handleLogout = () => {
  ElMessageBox.confirm(
    '确定要退出登录吗？',
    '退出确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    
    // 终端服务已移至独立页面
    console.log('[Terminal] Terminal functionality moved to standalone page')
    
    // 断开SSE连接
    if (sseUnsubscribe) {
      sseUnsubscribe()
    }
    sseService.disconnect()
    
    ElMessage.success('已退出登录')
    
    // 跳转到登录页
    router.push('/login')
  }).catch(() => {
    // 用户取消退出
  })
}

// 重命名文件夹
const renameFolder = async (folder) => {
  try {
    const { value: newName } = await ElMessageBox.prompt(
      '请输入新的文件夹名称',
      '重命名文件夹',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: folder.name,
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return '文件夹名称不能为空'
          }
          if (value.trim() === folder.name) {
            return '新名称与原名称相同'
          }
          return true
        }
      }
    )

    if (newName && newName.trim() !== folder.name) {
      const response = await terminalAPI.renameFolder({
        oldPath: folder.path || folder.id,
        newName: newName.trim()
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
      console.error('重命名文件夹失败:', error)
      ElMessage.error('重命名失败: ' + error.message)
    }
  }
}

// 重命名文件
const renameFile = async (card, folder) => {
  try {
    const fileExt = card.name.substring(card.name.lastIndexOf('.'))
    const fileName = card.name.substring(0, card.name.lastIndexOf('.'))
    
    const { value: newName } = await ElMessageBox.prompt(
      '请输入新的文件名称（不包含扩展名）',
      '重命名文件',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: fileName,
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return '文件名称不能为空'
          }
          if (value.trim() === fileName) {
            return '新名称与原名称相同'
          }
          return true
        }
      }
    )

    if (newName && newName.trim() !== fileName) {
      const response = await terminalAPI.renameFile({
        oldPath: card.path,
        newName: newName.trim() + fileExt
      })
      
      if (response.success) {
        ElMessage.success('文件重命名成功')
        await refreshCardFolders()
        // 如果当前选中的是这个文件，清除选中状态
        if (selectedCard.value === card.id) {
          selectedCard.value = null
          previewContent.value = ''
          previewType.value = ''
        }
      } else {
        ElMessage.error(response.message || '重命名失败')
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重命名文件失败:', error)
      ElMessage.error('重命名失败: ' + error.message)
    }
  }
}

// 下载文件
const downloadFile = async (card, folder) => {
  try {
    // 获取文件内容
    const response = await terminalAPI.getCardContent(card.path)
    
    if (response.success) {
      // 创建下载链接
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content, null, 2)
      
      const blob = new Blob([content], { 
        type: card.name.endsWith('.json') ? 'application/json' : 'text/html' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = card.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      ElMessage.success('文件下载成功')
    } else {
      ElMessage.error(response.message || '下载失败')
    }
  } catch (error) {
    console.error('下载文件失败:', error)
    ElMessage.error('下载失败: ' + error.message)
  }
}

// 预览HTML文件
const previewHtmlFile = async (card, folder) => {
  try {
    const response = await terminalAPI.getCardContent(card.path)
    
    if (response.success) {
      previewContent.value = response.content
      previewType.value = 'html-content'
      selectedCard.value = card.id
      selectedFolder.value = folder.id
      ElMessage.success('HTML文件预览已加载')
      
      // 移动端触发全屏预览
      if (device.isMobile.value) {
        console.log('[Preview] HTML file loaded, opening fullscreen preview')
        layoutStore.toggleFullScreen('preview')
      }
    } else {
      ElMessage.error(response.message || '预览失败')
    }
  } catch (error) {
    console.error('预览HTML文件失败:', error)
    ElMessage.error('预览失败: ' + error.message)
  }
}

// 顶部操作栏辅助方法
const updateTopBarSelection = (id, folderId, type) => {
  // 清除之前的选择
  selectedCardInfo.value = null
  selectedFolderInfo.value = null
  
  if (type === 'card') {
    // 查找卡片和文件夹信息
    const folderInfo = findFolderById(folderId)
    const cardInfo = findCardById(id, folderId)
    
    if (folderInfo && cardInfo) {
      selectedCardInfo.value = {
        card: cardInfo,
        folder: folderInfo
      }
    }
  } else if (type === 'folder') {
    // 查找文件夹信息
    const folderInfo = findFolderById(id)
    if (folderInfo) {
      selectedFolderInfo.value = folderInfo
    }
  }
}

const clearSelection = () => {
  selectedCardInfo.value = null
  selectedFolderInfo.value = null
  selectedCard.value = null
  selectedFolder.value = null
  previewContent.value = ''
  previewType.value = ''
}

// 递归查找文件夹的辅助方法
const findFolderById = (folderId) => {
  const findFolderRecursive = (folders, targetId) => {
    for (const folder of folders) {
      if (folder.id === targetId) {
        return folder
      }
      if (folder.subfolders && folder.subfolders.length > 0) {
        const found = findFolderRecursive(folder.subfolders, targetId)
        if (found) return found
      }
    }
    return null
  }
  
  return findFolderRecursive(cardFolders.value, folderId)
}

// 递归查找卡片的辅助方法
const findCardById = (cardId, folderId) => {
  const folder = findFolderById(folderId)
  if (!folder) return null
  
  // 在直接文件中查找
  const directCard = folder.cards?.find(card => card.id === cardId)
  if (directCard) return directCard
  
  // 在子文件夹中查找
  if (folder.subfolders) {
    for (const subfolder of folder.subfolders) {
      const card = subfolder.cards?.find(card => card.id === cardId)
      if (card) return card
    }
  }
  
  return null
}

// 切换预览Tab
const switchPreviewTab = (tab) => {
  console.log('[Preview] Switching to tab:', tab)
  activePreviewTab.value = tab
  
  // 记录当前选择的URL
  const currentUrl = tab === 'originalUrl' ? responseUrls.value.originalUrl : responseUrls.value.shareLink
  console.log('[Preview] Current URL:', currentUrl)
}

// 上传相关方法

const uploadFiles = () => {
  fileInput.value?.click()
}

const uploadFolder = () => {
  folderInput.value?.click()
}

const handleFileUpload = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  isUploading.value = true
  
  try {
    await uploadFilesToFolder(Array.from(files))
    ElMessage.success(`成功上传 ${files.length} 个文件`)
    await loadTemplates()
  } catch (error) {
    console.error('文件上传失败:', error)
    ElMessage.error('文件上传失败')
  } finally {
    isUploading.value = false
    // 清空input，允许重复选择同一文件
    event.target.value = ''
  }
}

const handleFolderUpload = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  isUploading.value = true
  
  try {
    await uploadFilesWithStructure(files)
    ElMessage.success(`成功上传文件夹，共 ${files.length} 个文件`)
    await loadTemplates()
  } catch (error) {
    console.error('文件夹上传失败:', error)
    ElMessage.error('文件夹上传失败')
  } finally {
    isUploading.value = false
    // 清空input，允许重复选择同一文件夹
    event.target.value = ''
  }
}

const uploadFilesWithStructure = async (files) => {
  // 按文件夹路径分组上传
  const folderGroups = {}
  
  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name
    const folderPath = relativePath.includes('/') 
      ? relativePath.substring(0, relativePath.lastIndexOf('/'))
      : ''
    
    if (!folderGroups[folderPath]) {
      folderGroups[folderPath] = []
    }
    folderGroups[folderPath].push(file)
  }
  
  // 为每个文件夹路径分别上传
  for (const [folderPath, groupFiles] of Object.entries(folderGroups)) {
    await uploadFilesToFolder(groupFiles, folderPath)
  }
}

const uploadFilesToFolder = async (files, folderPath = '') => {
  const formData = new FormData()
  
  for (const file of files) {
    formData.append('files', file)
  }
  
  if (folderPath) {
    formData.append('folderPath', folderPath)
  }
  
  const response = await axios.post('/upload/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  
  if (!response.data.success) {
    throw new Error(response.data.message || '文件上传失败')
  }
  
  return response.data
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 处理textarea输入，自动调整高度
const handleTextareaInput = (event) => {
  const textarea = event.target
  // 重置高度以获得正确的scrollHeight
  textarea.style.height = 'auto'
  // 设置新高度，最小2行，最大4行
  const lineHeight = 24
  const minHeight = lineHeight * 2
  const maxHeight = lineHeight * 4
  const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
  textarea.style.height = newHeight + 'px'
}

const generateCard = async () => {
  if (!currentTopic.value.trim() || isGenerating.value) return
  
  // 获取模板信息
  const templateObj = templates.value[selectedTemplate.value] || {}
  const templateName = templateObj.fileName || 'daily-knowledge-card-template.md'
  
  // 保存当前模板名称
  currentTemplateName.value = templateName
  // 清理主题名称用作文件夹名
  currentGeneratedFolder.value = currentTopic.value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  
  // 统一使用流式接口（移动端和桌面端都使用）
  // 这样可以接收所有EventStream消息进行实时显示和计数
  // Check if template is selected
  if (selectedTemplate.value === null || !templates.value[selectedTemplate.value]) {
    ElMessage.warning('请先选择一个模板')
    return
  }
  
  // Clear previous content
  previewContent.value = ''
  previewType.value = ''
  generatingHint.value = '正在准备生成...'
  streamMessages.value = [] // 清空之前的流消息
  allStreamMessages.value = [] // 清空所有消息记录
  
  isGenerating.value = true
  
  try {
    // Get selected template info
    const template = templates.value[selectedTemplate.value]
    const templateName = template.fileName || 'daily-knowledge-card-template.md'
    
    ElMessage.info('正在生成卡片...')
    generatingHint.value = '正在连接服务...'
    
    // 使用 fetch API 处理 SSE 流
    const token = localStorage.getItem('token')
    const headers = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    // 构建请求体，只包含启用的参数
    const requestBody = {
      topic: currentTopic.value.trim(),
      templateName
    }
    
    // 只在启用时才添加参数
    if (enableStyle.value && customStyle.value.trim()) {
      requestBody.style = customStyle.value.trim()
    }
    if (enableLanguage.value && customLanguage.value.trim()) {
      requestBody.language = customLanguage.value.trim()
    }
    if (enableReference.value && customReference.value.trim()) {
      requestBody.reference = customReference.value.trim()
    }
    
    const response = await fetch('/api/generate/card/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    generatingHint.value = '正在生成内容...'
    
    // 设置超时定时器（420秒/7分钟）- 适应cardplanet-Sandra模板
    const timeoutMs = 420000
    const startTime = Date.now()
    let lastEventType = ''
    let timeoutTimer = null
    
    // 设置超时定时器
    timeoutTimer = setTimeout(() => {
      reader.cancel()
      addStreamMessage(`生成超时，已等待${timeoutMs/1000}秒`)
      isGenerating.value = false
      ElMessage.error(`生成超时，已等待${timeoutMs/1000}秒`)
      
      // 超时后也延迟清空消息计数
      setTimeout(() => {
        streamMessages.value = []
        allStreamMessages.value = []
        generatingHint.value = ''
      }, 3000) // 3秒后清空
    }, timeoutMs)
    
    // 处理流式响应
    let buffer = ''
    try {
      while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      // 处理缓冲区中的完整消息
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个可能不完整的行
      
      for (const line of lines) {
        // 处理事件行
        if (line.startsWith('event: ')) {
          lastEventType = line.slice(7).trim()
          continue // SSE事件类型，继续处理下一行
        }
        
        // 处理数据行
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue // 跳过空数据
            
            const data = JSON.parse(jsonStr)
            
            // 根据不同的事件类型处理数据
            if (data.message) {
              // 添加消息到流消息列表
              addStreamMessage(data.message)
              generatingHint.value = data.message
            }
            
            // 处理特定事件
            if (data.topic) {
              addStreamMessage(`主题: ${data.topic}`)
            }
            
            // 处理status事件 - 包含step字段
            if (data.step) {
              const stepMessages = {
                'initializing_claude': '正在初始化Claude...',
                'claude_initialized': 'Claude初始化完成',
                'sending_command': '正在发送命令...',
                'command_sent': '命令已发送',
                'waiting_completion': '正在等待生成完成...'
              }
              const statusMsg = stepMessages[data.step] || `状态: ${data.step}`
              addStreamMessage(statusMsg)
              generatingHint.value = statusMsg
            }
            
            // 处理log事件 - 后端推送的日志消息
            if (lastEventType === 'log' && data.message) {
              addStreamMessage(data.message)
              generatingHint.value = data.message
            }
            
            // 修复：处理output事件 - backend发送的是 { data, timestamp }
            if (lastEventType === 'output' && data.data) {
              // 过滤ANSI转义序列
              const cleanOutput = stripAnsiCodes(data.data)
              if (cleanOutput && cleanOutput.length > 0 && 
                  !cleanOutput.includes('Genera') && // 过滤掉重复的生成动画
                  !cleanOutput.match(/^[✻✽✶*✢·]+$/)) { // 过滤纯动画字符
                // 只显示有意义的输出
                const outputMsg = cleanOutput.length > 100 
                  ? `Claude: ${cleanOutput.substring(0, 100)}...`
                  : `Claude: ${cleanOutput}`
                addStreamMessage(outputMsg)
              }
            }
            
            // 处理success或error事件
            if (lastEventType === 'success' && data) {
              clearTimeout(timeoutTimer) // 清除超时定时器
              ElMessage.success('卡片生成成功！')
              addStreamMessage('✅ 卡片生成成功')
              
              // 清空可选参数
              enableStyle.value = false
              enableLanguage.value = false
              enableReference.value = false
              customStyle.value = ''
              customLanguage.value = ''
              customReference.value = ''
              
              // 保存文件夹名称和模板名称
              if (data.sanitizedTopic) {
                currentGeneratedFolder.value = data.sanitizedTopic
              }
              if (data.templateName) {
                currentTemplateName.value = data.templateName
              }
              
              // 根据文件类型处理内容
              if (data.fileName && data.fileName.endsWith('.html')) {
                // HTML文件
                previewContent.value = data.content // HTML内容是字符串
                previewType.value = 'html-content'
                console.log('[GenerateCard] HTML file generated:', data.fileName)
              } else if (data.content) {
                // JSON文件
                previewContent.value = typeof data.content === 'string' 
                  ? data.content 
                  : JSON.stringify(data.content, null, 2)
                previewType.value = 'json'
                console.log('[GenerateCard] JSON file generated:', data.fileName)
              }
              
              generatingHint.value = '生成完成'
              
              // 刷新卡片列表
              await refreshCardFolders()
              
              // 移动端：切换到文件列表tab
              if (device.isMobile.value) {
                layoutStore.switchMobileTab(MOBILE_TABS.FILES)
              }
              
              // 生成完成后延迟清空消息计数（让用户看到最终统计）
              setTimeout(() => {
                streamMessages.value = []
                allStreamMessages.value = []
                generatingHint.value = ''
              }, 3000) // 3秒后清空
              
              isGenerating.value = false
              break
            } else if (lastEventType === 'error' && data.message) {
              clearTimeout(timeoutTimer) // 清除超时定时器
              ElMessage.error(data.message || '生成失败')
              addStreamMessage(`❌ ${data.message}`)
              generatingHint.value = '生成失败'
              
              // 错误时也延迟清空消息计数
              setTimeout(() => {
                streamMessages.value = []
                allStreamMessages.value = []
                generatingHint.value = ''
              }, 3000) // 3秒后清空
              
              isGenerating.value = false
              break
            }
          } catch (e) {
            console.error('[GenerateCard] Error parsing SSE data:', e, 'Line:', line)
          }
        }
      }
    }
    } finally {
      // 清理定时器
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
    }
    
  } catch (error) {
    console.error('[GenerateCard] Stream error:', error)
    ElMessage.error('生成失败: ' + error.message)
    isGenerating.value = false
    generatingHint.value = '生成异常'
    
    // 异常时也延迟清空消息计数
    setTimeout(() => {
      streamMessages.value = []
      allStreamMessages.value = []
      generatingHint.value = ''
    }, 3000) // 3秒后清空
    
    // 清除预览内容
    previewContent.value = ''
    previewType.value = ''
  }
}

// Smart Terminal initialization - only when needed
const initializeTerminalWhenNeeded = async () => {
  // 桌面端直接初始化
  if (device.isDesktop.value) {
    return await initializeTerminal()
  }
  
  // 移动端只在切换到Terminal Tab时初始化
  if (device.isMobile.value && layoutStore.activeMobileTab === 'terminal') {
    return await initializeTerminal()
  }
  
  // 其他情况延迟初始化
  console.log('[Terminal] Delaying terminal initialization for mobile device')
  return true
}

// Initialize Terminal (现在已重定向到独立终端页面)
const initializeTerminal = async () => {
  console.log('[Terminal] Terminal functionality moved to standalone page')
  terminalInitialized.value = true
  return true
}

// 手动重新连接 (现在重定向到独立终端页面)
const manualReconnect = async () => {
  console.log('[Terminal] Redirecting to standalone terminal page')
  openTerminalPage()
}

// Select template
const selectTemplate = (index) => {
  selectedTemplate.value = index
  console.log('Selected template:', templates.value[index])
}

// Toggle folder expand/collapse
const toggleFolder = (folderId) => {
  const index = expandedFolders.value.indexOf(folderId)
  if (index > -1) {
    expandedFolders.value.splice(index, 1)
  } else {
    expandedFolders.value.push(folderId)
  }
  
  // 更新顶部操作栏的选择状态
  updateTopBarSelection(folderId, null, 'folder')
}

// Select a card
const selectCard = (cardId, folderId) => {
  console.log('[CardGenerator] selectCard called:', { cardId, folderId })
  selectedCard.value = cardId
  selectedFolder.value = folderId
  
  // 更新顶部操作栏的选择状态
  updateTopBarSelection(cardId, folderId, 'card')
  
  // 移动端：预加载内容，但不自动触发全屏预览，等用户点击"预览"按钮
  // 桌面端：加载内容并在右侧预览区域显示
  if (device.isMobile.value) {
    console.log('[CardGenerator] Mobile: Pre-loading content for preview button')
    // 移动端也加载内容，但不切换到预览模式，让用户通过操作栏按钮控制
    loadCardContent(cardId, folderId)
  } else {
    console.log('[CardGenerator] Desktop: Loading content for preview area')
    loadCardContent(cardId, folderId)
  }
}

// Load card content
const loadCardContent = async (cardId, folderId) => {
  console.log('[LoadCardContent] Function started:', { cardId, folderId })
  try {
    // 清除之前的URL状态
    responseUrls.value = {
      shareLink: '',
      originalUrl: ''
    }
    
    console.log('[LoadCardContent] Looking for folder:', folderId)
    console.log('[LoadCardContent] Available folders:', cardFolders.value.map(f => ({ id: f.id, name: f.name })))
    console.log('[LoadCardContent] Target folderId:', folderId)
    console.log('[LoadCardContent] Full cardFolders data:', JSON.stringify(cardFolders.value, null, 2))
    
    // 详细检查每个文件夹的匹配情况
    cardFolders.value.forEach((f, index) => {
      console.log(`[LoadCardContent] Folder ${index}: id="${f.id}", name="${f.name}", matches folderId: ${f.id === folderId}`)
    })
    
    // 递归查找文件夹的函数
    const findFolderRecursive = (folders, targetId) => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return folder
        }
        if (folder.subfolders && folder.subfolders.length > 0) {
          const found = findFolderRecursive(folder.subfolders, targetId)
          if (found) return found
        }
      }
      return null
    }
    
    // 找到对应的文件夹 - 使用递归查找
    let folder = findFolderRecursive(cardFolders.value, folderId)
    let card = null
    
    console.log('[LoadCardContent] Found folder:', folder ? { id: folder.id, name: folder.name } : 'null')
    
    if (folder) {
      // 在找到的文件夹中查找卡片
      card = folder.cards?.find(c => c.id === cardId)
      console.log('[LoadCardContent] Card found:', card ? card.name : 'null')
    }
    
    if (!card) {
      console.log('[LoadCardContent] No card found, returning early')
      return
    }
    
    console.log('[CardContent] Loading card:', card.name, 'path:', card.path)
    
    // 根据文件扩展名确定预览类型
    const fileName = card.name.toLowerCase()
    console.log('[CardContent] File name (lowercase):', fileName)
    console.log('[CardContent] Checking file type conditions...')
    
    // 检查是否是响应文件
    if (fileName.includes('-response.json')) {
      console.log('[CardContent] Matched: Response JSON file')
      console.log('[CardContent] Detected response file:', card.name)
      
      try {
        // 读取响应文件
        console.log('[CardContent] Reading response file from:', card.path)
        const response = await terminalAPI.getCardContent(card.path)
        
        if (response && response.success) {
          console.log('[CardContent] Response file loaded successfully')
          
          const responseData = typeof response.content === 'string' 
            ? JSON.parse(response.content) 
            : response.content
          
          console.log('[CardContent] Response data keys:', Object.keys(responseData))
          
          // 查找 shareLink
          const shareLink = responseData.shareLink || 
                           responseData.metadata?.processedShareLink ||
                           responseData.originalResponse?.data?.shareLink
          
          // 查找 originalUrl
          const originalUrl = responseData.originalResponse?.data?.originalUrl || 
                             responseData.originalResponse?.data?.directViewUrl
          
          if (shareLink || originalUrl) {
            // 处理shareLink
            if (shareLink) {
              let shareUrl = shareLink
              // 替换域名
              shareUrl = shareUrl.replace(
                'engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
                'engagia-s3.paitongai.net'
              )
              responseUrls.value.shareLink = shareUrl
              console.log('[CardContent] Extracted share URL:', shareUrl)
            }
            
            // 处理originalUrl
            if (originalUrl) {
              responseUrls.value.originalUrl = originalUrl
              console.log('[CardContent] Extracted original URL:', originalUrl)
            }
            
            previewType.value = 'iframe'
            // 默认显示shareLink，如果没有则显示originalUrl
            previewContent.value = responseUrls.value.shareLink || responseUrls.value.originalUrl
            activePreviewTab.value = responseUrls.value.shareLink ? 'shareLink' : 'originalUrl'
            
            ElMessage.success('已加载响应链接预览')
            return
          } else {
            // 如果没有找到任何URL，显示JSON内容供调试
            console.log('[CardContent] No URLs found, showing JSON')
            previewType.value = 'json'
            previewContent.value = responseData
            ElMessage.info('响应文件中未找到预览链接，显示JSON内容')
          }
        } else {
          throw new Error('Failed to load response file')
        }
      } catch (error) {
        console.error('[CardContent] Failed to load response file:', error)
        previewType.value = 'json'
        previewContent.value = {
          error: '加载响应文件失败',
          message: error.message,
          file: card.name
        }
      }
    } else if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
      console.log('[CardContent] Matched: Markdown file')
      console.log('[CardContent] Loading Markdown file:', card.name)
      
      try {
        // 读取Markdown文件内容
        const response = await terminalAPI.getCardContent(card.path)
        
        if (response && response.success) {
          // 成功读取Markdown内容，使用markdown渲染模式
          previewType.value = 'markdown'
          previewContent.value = response.content
          console.log('[CardContent] Markdown content loaded successfully, length:', response.content.length)
        } else {
          console.warn('[CardContent] Failed to load Markdown content')
          previewType.value = 'text'
          previewContent.value = '无法加载Markdown文件'
        }
      } catch (error) {
        console.error('[CardContent] Error loading Markdown:', error)
        previewType.value = 'text'
        previewContent.value = '加载Markdown文件失败: ' + error.message
      }
    } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      console.log('[CardContent] Matched: HTML file')
      console.log('[CardContent] Loading HTML file:', card.name)
      
      try {
        // 尝试读取HTML文件内容
        const response = await terminalAPI.getCardContent(card.path)
        
        if (response && response.success) {
          // 成功读取HTML内容，使用内容渲染模式
          previewType.value = 'html-content'
          previewContent.value = response.content
          console.log('[CardContent] HTML content loaded successfully, length:', response.content.length)
        } else {
          // 读取失败，回退到URL模式
          console.warn('[CardContent] Failed to load HTML content, falling back to URL mode')
          previewType.value = 'html'
          const baseUrl = window.location.origin
          previewContent.value = `${baseUrl}/api/terminal/card/html/${folder.id}/${encodeURIComponent(card.name)}`
        }
      } catch (error) {
        console.error('[CardContent] Error loading HTML:', error)
        // 出错时回退到URL模式
        previewType.value = 'html'
        const baseUrl = window.location.origin
        previewContent.value = `${baseUrl}/api/terminal/card/html/${folder.id}/${encodeURIComponent(card.name)}`
      }
    } else if (fileName.endsWith('.json')) {
      console.log('[CardContent] Matched: Regular JSON file')
      previewType.value = 'json'
      // JSON文件：使用API读取文件内容
      try {
        console.log('[CardContent] Attempting to load JSON content from:', card.path)
        
        // 使用后端API读取卡片内容
        const response = await terminalAPI.getCardContent(card.path)
        
        if (response && response.success) {
          // 成功读取文件内容
          previewContent.value = response.content
          console.log('[CardContent] JSON content loaded successfully')
        } else {
          // API返回失败，显示卡片元信息
          console.warn('[CardContent] Failed to load content:', response?.message)
          previewContent.value = {
            title: card.name,
            path: card.path,
            folder: folder.name,
            loadTime: new Date().toISOString(),
            note: "无法加载文件内容，显示卡片元信息"
          }
        }
      } catch (error) {
        console.error('[CardContent] Failed to load JSON content:', error)
        // 显示错误信息和基本卡片数据
        previewContent.value = {
          title: card.name,
          path: card.path,
          folder: folder.name,
          error: "文件读取失败: " + error.message,
          loadTime: new Date().toISOString()
        }
      }
    } else {
      console.log('[CardContent] Matched: Other file type (fallback)')
      // 其他类型文件：显示基本信息
      previewType.value = 'html'
      previewContent.value = `data:text/html;charset=utf-8,
        <div style="padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; height: 100%;">
          <h2 style="color: #333; margin-bottom: 20px;">📄 ${card.name}</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #666; margin-bottom: 15px;">
              <strong>文件路径:</strong><br/>
              <code style="background: #f0f0f0; padding: 5px; border-radius: 3px; font-size: 12px; word-break: break-all;">
                ${card.path || 'N/A'}
              </code>
            </p>
            <p style="color: #666; margin-bottom: 15px;">
              <strong>主题:</strong> ${folder.name}
            </p>
            <p style="color: #666; margin-bottom: 15px;">
              <strong>类型:</strong> ${fileName.split('.').pop().toUpperCase()}文件
            </p>
            <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 3px solid #4a9eff;">
              <p style="color: #999; font-size: 14px;">
                💡 该文件由Claude AI根据模板生成<br/>
                暂不支持此文件类型的预览
              </p>
            </div>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <span style="color: #999; font-size: 12px;">加载时间: ${new Date().toLocaleString()}</span>
          </div>
        </div>`
    }
    
    ElMessage.success('卡片加载成功')
  } catch (error) {
    console.error('[LoadCardContent] ERROR in loadCardContent:', error)
    console.error('[LoadCardContent] Error stack:', error.stack)
    ElMessage.error('加载卡片失败: ' + error.message)
  }
  
  console.log('[LoadCardContent] Function completed')
}

// Handle JSON fixed event
const handleJsonFixed = (fixedData) => {
  console.log('[CardGenerator] JSON data fixed:', fixedData)
  previewContent.value = fixedData
  ElMessage.success('JSON格式已修复')
}

// Handle JSON preview event
const handleJsonPreview = (jsonData) => {
  console.log('[CardGenerator] Preview JSON as card:', jsonData)
  // 可以在这里实现预览功能
  ElMessage.info('预览功能开发中...')
}

// Handle HTML refresh event
const handleHtmlRefresh = async () => {
  console.log('[CardGenerator] Refreshing HTML content')
  if (selectedCard.value && selectedFolder.value) {
    // 重新加载卡片内容
    await loadCardContent(selectedCard.value, selectedFolder.value)
  }
}

// Handle iframe load event
const onIframeLoad = (event) => {
  const iframe = event.target
  
  // Skip trying to access cross-origin content
  // Directly apply scaling for all iframes
  console.log('[CardGenerator] Iframe loaded, applying responsive scaling')
  
  // Apply scaling
  applyIframeScaling(iframe)
  
  // Add resize observer for responsive scaling
  observeIframeResize(iframe)
}

// Apply CSS transform scaling for iframes
const applyIframeScaling = (iframe) => {
  const wrapper = iframe.parentElement
  if (!wrapper) return
  
  // Get actual container dimensions
  const containerWidth = wrapper.offsetWidth
  const containerHeight = wrapper.offsetHeight
  
  // 使用固定的移动端视口作为基准
  const baseWidth = 375  // iPhone X width - 大多数响应式网站的设计基准
  const baseHeight = 812  // iPhone X height
  
  // Set iframe to base size
  iframe.style.width = `${baseWidth}px`
  iframe.style.height = `${baseHeight}px`
  
  // Calculate scale factors
  const scaleX = containerWidth / baseWidth
  const scaleY = containerHeight / baseHeight
  
  let scale
  if (iframeScaleMode.value === 'fill') {
    // Fill mode - 使用适合的缩放，确保内容可读
    // 不要过度放大，最大缩放2倍
    scale = Math.min(scaleX * 0.95, 2.0)
    wrapper.style.overflow = 'auto' // 允许滚动
  } else {
    // Fit mode - 完整显示内容
    scale = Math.min(scaleX, scaleY) * 0.9 // 留10%边距
    wrapper.style.overflow = 'hidden'
  }
  
  // Apply transform
  iframe.style.transform = `scale(${scale})`
  iframe.style.transformOrigin = 'top center'
  iframe.style.position = 'absolute'
  
  // Center horizontally
  const scaledWidth = baseWidth * scale
  const left = (containerWidth - scaledWidth) / 2
  
  iframe.style.left = `${Math.max(0, left)}px`
  iframe.style.top = '0px'
  
  // 调整wrapper高度以适应内容
  if (iframeScaleMode.value === 'fill') {
    const scaledHeight = baseHeight * scale
    wrapper.style.minHeight = `${scaledHeight}px`
  }
  
  console.log(`[CardGenerator] Scaling: ${scale.toFixed(2)} | Base: ${baseWidth}x${baseHeight} | Container: ${containerWidth}x${containerHeight} | Mode: ${iframeScaleMode.value}`)
}

// Toggle scale mode
const toggleScaleMode = () => {
  iframeScaleMode.value = iframeScaleMode.value === 'fit' ? 'fill' : 'fit'
  // Reapply scaling
  const iframe = document.querySelector('.preview-iframe')
  if (iframe) {
    applyIframeScaling(iframe)
  }
}

// Reset scale
const resetScale = () => {
  iframeScaleMode.value = 'fit'
  const iframe = document.querySelector('.preview-iframe')
  if (iframe) {
    applyIframeScaling(iframe)
  }
}

// Add resize observer to handle container size changes
const observeIframeResize = (iframe) => {
  const wrapper = iframe.parentElement
  if (!wrapper) return
  
  const resizeObserver = new ResizeObserver(() => {
    applyIframeScaling(iframe)
  })
  
  resizeObserver.observe(wrapper)
  
  // Store observer for cleanup
  iframe.dataset.resizeObserver = 'active'
}

// Generate HTML from JSON file and preview
const generateHtmlFromJson = async (card, folder) => {
  try {
    // 设置生成状态
    isGeneratingHtml.value[card.id] = true
    
    console.log('[GenerateHTML] Processing card:', card.name, 'from folder:', folder.name)
    
    // 检查是否存在已保存的响应文件
    const responseFileName = card.name.replace('.json', '-response.json')
    const responsePath = card.path.replace('.json', '-response.json')
    
    // 先尝试查找已存在的响应文件
    const existingResponseCard = folder.cards.find(c => c.name === responseFileName)
    
    if (existingResponseCard) {
      console.log('[GenerateHTML] Found existing response file:', responseFileName)
      ElMessage.info('发现已保存的响应，正在加载...')
      
      try {
        // 读取响应文件
        const responseData = await terminalAPI.getCardContent(existingResponseCard.path)
        if (responseData && responseData.success && responseData.content) {
          const savedResponse = typeof responseData.content === 'string' 
            ? JSON.parse(responseData.content) 
            : responseData.content
          
          const shareLink = savedResponse.shareLink || savedResponse.metadata?.processedShareLink
          const originalUrl = savedResponse.originalResponse?.data?.originalUrl || 
                            savedResponse.originalResponse?.data?.directViewUrl
          
          if (shareLink || originalUrl) {
            // 处理shareLink
            if (shareLink) {
              let shareUrl = shareLink
              // 替换域名
              shareUrl = shareUrl.replace(
                'engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
                'engagia-s3.paitongai.net'
              )
              responseUrls.value.shareLink = shareUrl
              console.log('[GenerateHTML] Using saved share URL:', shareUrl)
            }
            
            // 处理originalUrl
            if (originalUrl) {
              responseUrls.value.originalUrl = originalUrl
              console.log('[GenerateHTML] Using saved original URL:', originalUrl)
            }
            
            // 直接在iframe中加载预览
            previewType.value = 'iframe'
            previewContent.value = responseUrls.value.shareLink || responseUrls.value.originalUrl
            activePreviewTab.value = responseUrls.value.shareLink ? 'shareLink' : 'originalUrl'
            selectedCard.value = card.id
            
            ElMessage.success('已加载保存的预览链接！')
            return // 直接返回，不需要重新生成
          }
        }
      } catch (error) {
        console.warn('[GenerateHTML] Failed to load saved response, will regenerate:', error)
      }
    }
    
    // 显示加载提示
    ElMessage.info('正在生成预览链接...')
    
    // 读取JSON文件内容
    let jsonContent = null
    try {
      const response = await terminalAPI.getCardContent(card.path)
      if (response && response.success) {
        jsonContent = response.content
      } else {
        throw new Error('无法读取JSON文件内容')
      }
    } catch (error) {
      console.error('[GenerateHTML] Failed to read JSON file:', error)
      throw new Error('读取JSON文件失败: ' + error.message)
    }
    
    console.log('[GenerateHTML] JSON content loaded:', jsonContent)
    
    // 调用API生成HTML
    const generateResult = await cardGeneratorAPI.generateHtmlCard(jsonContent)
    
    // 输出完整的API响应用于调试
    console.log('[GenerateHTML] Complete API Response:', generateResult)
    console.log('[GenerateHTML] Response type:', typeof generateResult)
    console.log('[GenerateHTML] Response keys:', Object.keys(generateResult || {}))
    
    if (!generateResult.success) {
      throw new Error(generateResult.error || '生成HTML失败')
    }
    
    console.log('[GenerateHTML] HTML generated successfully')
    console.log('[GenerateHTML] Response data:', generateResult.data)
    console.log('[GenerateHTML] Data type:', typeof generateResult.data)
    console.log('[GenerateHTML] Data keys:', Object.keys(generateResult.data || {}))
    
    // 获取分享链接并替换域名
    let shareUrl = generateResult.data.shareLink
    let originalUrl = generateResult.data.originalUrl || generateResult.data.directViewUrl
    
    // 替换域名: engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run -> engagia-s3.paitongai.net
    shareUrl = shareUrl.replace(
      'engagia-s-cdmxfcdbwa.cn-hangzhou.fcapp.run',
      'engagia-s3.paitongai.net'
    )
    
    console.log('[GenerateHTML] Share URL with new domain:', shareUrl)
    console.log('[GenerateHTML] Original URL:', originalUrl)
    
    // 保存完整的原始响应，不做任何格式检查
    const responseToSave = {
      originalResponse: generateResult,  // 保存完整的原始响应
      shareLink: shareUrl,  // 处理后的分享链接
      generatedAt: new Date().toISOString(),
      sourceFile: card.name,
      metadata: {
        originalShareLink: generateResult.data?.shareLink,  // 原始链接
        processedShareLink: shareUrl  // 处理后的链接
      }
    }
    
    console.log('[GenerateHTML] Full response to save:', responseToSave)
    console.log('[GenerateHTML] Response path:', responsePath)
    
    // 保存响应文件到后端（不触发浏览器下载）
    const saveJson = JSON.stringify(responseToSave, null, 2)
    
    console.log('[GenerateHTML] Saving response to backend:', responsePath)
    
    // 直接通过后端API保存
    try {
      const saveResult = await terminalAPI.saveCardContent({
        path: responsePath,
        content: saveJson,
        type: 'response'
      })
      
      if (saveResult && saveResult.success) {
        console.log('[GenerateHTML] Response saved to server successfully')
        ElMessage.success(`响应已保存到: ${responseFileName}`)
        
        // 刷新文件夹列表以显示新文件
        await refreshCardFolders()
      } else {
        throw new Error(saveResult?.error || 'Save failed')
      }
    } catch (err) {
      console.error('[GenerateHTML] Failed to save response:', err)
      ElMessage.error(`保存响应失败: ${err.message}`)
      
      // 作为备选方案，输出到控制台
      console.log('[GenerateHTML] Response JSON for manual save:', saveJson)
    }
    
    
    // 保存两种URL
    responseUrls.value.shareLink = shareUrl
    responseUrls.value.originalUrl = originalUrl
    
    // 直接在iframe中加载预览
    previewType.value = 'iframe'
    previewContent.value = shareUrl
    activePreviewTab.value = 'shareLink' // 默认显示shareLink
    
    // 选中当前卡片
    selectedCard.value = card.id
    
    ElMessage.success('预览链接已生成！')
    
    // 安全地复制链接到剪贴板
    if (navigator.clipboard && document.hasFocus()) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        console.log('[GenerateHTML] Share link copied to clipboard:', shareUrl)
        ElMessage.success('链接已复制到剪贴板')
      } catch (err) {
        console.warn('[GenerateHTML] Could not copy link automatically:', err.message)
        ElMessage.info(`预览链接: ${shareUrl}`)
      }
    } else {
      ElMessage.info(`预览链接: ${shareUrl}`)
    }
    
  } catch (error) {
    console.error('[GenerateHTML] Error:', error)
    ElMessage.error('生成预览失败: ' + error.message)
  } finally {
    // 清除生成状态
    isGeneratingHtml.value[card.id] = false
  }
}


// Get file icon based on extension
const getFileIcon = (fileName) => {
  const lowerFileName = fileName.toLowerCase()
  
  // 特殊处理响应文件
  if (lowerFileName.includes('-response.json')) {
    return '🔗' // 链接图标，表示这是保存的响应
  }
  
  const ext = lowerFileName.split('.').pop()
  switch (ext) {
    case 'json':
      return '📋'
    case 'html':
    case 'htm':
      return '🌐'
    case 'md':
    case 'markdown':
      return '📝'
    default:
      return '📄'
  }
}

// Get file type display text
const getFileType = (fileName) => {
  const lowerFileName = fileName.toLowerCase()
  
  // 特殊处理响应文件
  if (lowerFileName.includes('-response.json')) {
    return 'RESP'
  }
  
  const ext = lowerFileName.split('.').pop()
  switch (ext) {
    case 'json':
      return 'JSON'
    case 'html':
    case 'htm':
      return 'HTML'
    case 'md':
    case 'markdown':
      return 'MD'
    default:
      return ext.toUpperCase()
  }
}

// Load user workspace structure (folders and files)
const loadCardFolders = async () => {
  try {
    // 调用新的统一API获取完整的workspace结构
    const response = await terminalAPI.getUserFolders()
    if (response && response.success && response.data) {
      // 处理新的数据结构
      const { rootFiles = [], folders = [] } = response.data
      
      // 将根目录文件作为一个特殊的文件夹显示（default用户不过滤，其他用户过滤掉.json文件）
      if (rootFiles.length > 0) {
        const filteredRootFiles = currentUsername.value === 'default' 
          ? rootFiles 
          : rootFiles.filter(file => !file.name.endsWith('.json'))
        if (filteredRootFiles.length > 0) {
          const rootFolder = {
            id: 'root-files',
            name: '根目录文件',
            type: 'folder',
            cards: filteredRootFiles.map(file => ({
              id: file.id,
              name: file.name,
              path: file.path,
              type: file.fileType || 'file',
              size: file.size,
              modified: file.modified
            }))
          }
          cardFolders.value = [rootFolder, ...folders.map(transformFolder)]
        } else {
          cardFolders.value = folders.map(transformFolder)
        }
      } else {
        cardFolders.value = folders.map(transformFolder)
      }
      
      // Auto-expand first folder
      if (cardFolders.value.length > 0 && !expandedFolders.value.includes(cardFolders.value[0].id)) {
        expandedFolders.value.push(cardFolders.value[0].id)
      }
      console.log('Loaded workspace structure from backend:', cardFolders.value)
      return
    }
  } catch (error) {
    console.error('Failed to load workspace structure from backend:', error)
  }
  
  // 如果API失败，至少显示空状态
  if (!cardFolders.value) {
    cardFolders.value = []
  }
}

// 转换文件夹结构以适配前端显示
const transformFolder = (folder) => {
  return {
    id: folder.path, // 使用完整路径作为文件夹ID: card/2019的人工智能
    name: folder.name,
    path: folder.path,
    type: 'folder',
    cards: folder.children ? folder.children
      .filter(item => {
        // default用户显示所有文件，其他用户过滤掉.json文件
        if (currentUsername.value === 'default') {
          return item.type === 'file'
        }
        return item.type === 'file' && !item.name.endsWith('.json')
      })
      .map(file => ({
        id: file.path, // 使用完整路径作为文件ID: card/2019的人工智能/2019_ai_dune_style.html
        name: file.name,
        path: file.path,
        type: file.fileType || 'file',
        size: file.size,
        modified: file.modified
      })) : [],
    // 递归处理子文件夹
    subfolders: folder.children ? folder.children.filter(item => item.type === 'folder').map(transformFolder) : []
  }
}

// 刷新卡片文件夹（从后端获取真实数据）
const refreshCardFolders = async () => {
  console.log('[RefreshFolders] Refreshing card folders from backend...')
  
  try {
    // 直接调用loadCardFolders来获取最新的后端数据
    await loadCardFolders()
    console.log('[RefreshFolders] Folders refreshed successfully')
    
    // 如果有当前主题，尝试展开对应的文件夹
    if (currentTopic.value) {
      const sanitizedTopic = currentTopic.value.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
      const folder = cardFolders.value.find(f => f.id === sanitizedTopic || f.name === currentTopic.value)
      
      if (folder && !expandedFolders.value.includes(folder.id)) {
        expandedFolders.value.push(folder.id)
      }
    }
    
    return true
  } catch (error) {
    console.error('[RefreshFolders] Failed to refresh folders:', error)
    ElMessage.error('刷新文件夹失败')
    return false
  }
}

// Load templates from public_template directory
const loadTemplates = async () => {
  try {
    console.log('[Templates] 🔄 Loading templates from public_template directory...')
    console.log('[Templates] Request URL: /upload/structure')
    
    const response = await axios.get('/upload/structure')
    console.log('[Templates] ✅ API Response received:', {
      success: response.success,
      hasData: !!response.data,
      dataLength: response.data?.length,
      message: response.message
    })
    console.log('[Templates] 📋 Full response:', response)
    
    // 🔍 Debug: Let's see what axios is actually returning
    console.log('[Templates] 🔍 DEBUG response structure:', Object.keys(response))
    console.log('[Templates] 🔍 DEBUG response.success:', response.success)
    console.log('[Templates] 🔍 DEBUG response.data type:', typeof response.data)
    console.log('[Templates] 🔍 DEBUG response.data Array?:', Array.isArray(response.data))
    
    if (response.success && response.data) {
      console.log('[Templates] 📄 Raw template data:', response.data)
      
      // 将文件和文件夹转换为模板格式
      const convertToTemplates = (items, baseName = '') => {
        const templates = []
        console.log(`[Templates] 🔄 Converting ${items.length} items to templates...`)
        
        for (const item of items) {
          const fullName = baseName ? `${baseName}/${item.name}` : item.name
          
          if (item.type === 'folder') {
            const template = {
              fileName: fullName,
              name: fullName,
              description: `文件夹模板 (${item.children?.length || 0}个文件)`,
              type: 'folder'
            }
            templates.push(template)
            console.log(`[Templates] 📁 Added folder template: ${fullName}`)
            
          } else if (item.type === 'file') {
            // 过滤掉.md后缀用于显示，但保留完整文件名用于API调用
            const displayName = item.name.endsWith('.md') 
              ? item.name.slice(0, -3)  // 移除.md后缀
              : item.name
            
            const template = {
              fileName: fullName,
              name: displayName,
              description: `文件模板 (${formatFileSize(item.size)})`,
              type: 'file'
            }
            templates.push(template)
            console.log(`[Templates] 📄 Added file template: ${displayName} (原文件: ${item.name})`)
          }
        }
        return templates
      }
      
      const processedTemplates = convertToTemplates(response.data)
      templates.value = processedTemplates
      
      console.log(`[Templates] ✅ Successfully loaded ${processedTemplates.length} templates:`)
      processedTemplates.forEach((template, index) => {
        console.log(`[Templates]   ${index + 1}. ${template.name} (${template.type})`)
      })
      
    } else {
      templates.value = []
      console.warn('[Templates] ⚠️ No templates found - response structure:', {
        success: response.success,
        hasData: !!response.data,
        responseKeys: Object.keys(response || {})
      })
    }
  } catch (error) {
    console.error('[Templates] ❌ Failed to load templates:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      url: error.config?.url
    })
    templates.value = []
  }
}

// 初始化SSE连接
const initSSE = () => {
  console.log('[SSE] Initializing SSE connection...')
  
  // 连接SSE
  sseService.connect()
  
  // 监听文件系统变化事件
  sseUnsubscribe = sseService.on('filesystem:changed', async (data) => {
    console.log('[SSE] Filesystem changed:', data)
    
    // 如果不在生成过程中，刷新文件夹列表
    if (!isGenerating.value) {
      console.log('[SSE] Refreshing folders due to filesystem change...')
      await loadCardFolders()
    }
  })
  
  // 监听文件添加事件，用于检测生成完成
  sseService.on('file:added', async (data) => {
    console.log('[SSE] File added:', data)
    
    // 检查是否是JSON文件
    if (data.path && data.path.endsWith('.json')) {
      const fileName = data.path.split('/').pop() || data.path.split('\\').pop()
      
      // 如果正在生成过程中，检查是否是主题文件夹下的JSON文件
      if (isGenerating.value) {
        const sanitizedTopic = currentTopic.value.trim().replace(/[\/\\:*?"<>|]/g, '_')
        const userCardPath = `${CARDS_BASE_PATH}/${sanitizedTopic}`
        
        // 检查文件路径是否包含当前主题文件夹
        if (data.path.includes(sanitizedTopic)) {
          console.log('[SSE] Generated JSON file detected:', data.path)
          generatingHint.value = '生成完成！'
          
          // 清除超时定时器
          if (window.generationTimeout) {
            clearTimeout(window.generationTimeout)
            window.generationTimeout = null
          }
          
          // 标记生成完成
          isGenerating.value = false
          
          // 刷新文件夹列表
          await loadCardFolders()
          
          // 自动选择新生成的文件夹
          const newFolder = cardFolders.value.find(f => f.id === sanitizedTopic)
          if (newFolder) {
            selectedFolder.value = newFolder
            await loadCardsInFolder(newFolder)
            
            // 如果是非response后缀的JSON文件，自动触发生成HTML
            if (!fileName.includes('-response.json')) {
              console.log('[SSE] Auto-triggering HTML generation for:', fileName)
              
              // 找到对应的卡片
              const card = newFolder.cards.find(c => c.name === fileName)
              if (card) {
                // 检查是否已经存在对应的response文件
                const baseName = card.name.replace('.json', '')
                const responseFileName = `${baseName}-response.json`
                const hasResponseFile = newFolder.cards.some(c => c.name === responseFileName)
                
                if (hasResponseFile) {
                  console.log('[SSE] Response file already exists, skipping auto-generation:', responseFileName)
                } else {
                  // 延迟一秒后自动触发按钮点击
                  setTimeout(() => {
                    const button = document.getElementById(`generate-html-btn-${card.id}`)
                    if (button && !button.disabled) {
                      console.log('[SSE] Triggering generate HTML button for:', card.name)
                      button.click()
                      ElMessage.info('正在自动生成HTML预览...')
                    }
                  }, 1000)
                }
              }
            }
          }
          
          ElMessage.success('卡片生成成功！')
        }
      }
      // 如果不在生成过程中，但是收到了非response后缀的JSON文件
      else if (!fileName.includes('-response.json')) {
        console.log('[SSE] Non-response JSON file detected:', fileName)
        
        // 刷新文件夹列表
        await loadCardFolders()
        
        // 查找包含这个文件的文件夹
        for (const folder of cardFolders.value) {
          const card = folder.cards?.find(c => c.path === data.path)
          if (card) {
            console.log('[SSE] Found card in folder:', folder.name)
            
            // 检查是否已经存在对应的response文件
            const baseName = card.name.replace('.json', '')
            const responseFileName = `${baseName}-response.json`
            const hasResponseFile = folder.cards.some(c => c.name === responseFileName)
            
            if (hasResponseFile) {
              console.log('[SSE] Response file already exists, skipping auto-generation:', responseFileName)
            } else {
              // 自动触发按钮点击
              setTimeout(() => {
                const button = document.getElementById(`generate-html-btn-${card.id}`)
                if (button && !button.disabled) {
                  console.log('[SSE] Triggering generate HTML button for:', card.name)
                  button.click()
                  ElMessage.info(`正在为 ${card.name} 自动生成HTML预览...`)
                }
              }, 1000)
            }
            break
          }
        }
      }
    }
  })
  
  // 监听连接状态
  sseService.on('connected', () => {
    console.log('[SSE] Connected to SSE stream')
    isSSEConnected.value = true
    ElMessage.success('实时同步已连接')
  })
  
  sseService.on('disconnected', () => {
    console.log('[SSE] Disconnected from SSE stream')
    isSSEConnected.value = false
  })
  
  sseService.on('error', (error) => {
    console.error('[SSE] Error:', error)
    ElMessage.warning('实时同步连接异常')
  })
  
  sseService.on('connection:failed', (data) => {
    console.error('[SSE] Connection failed:', data)
    ElMessage.error('实时同步连接失败，将使用定时刷新')
    
    // 如果SSE失败，启用备用的定时刷新
    startFallbackRefresh()
  })
}

// 备用的定时刷新（当SSE不可用时）
let fallbackRefreshInterval = null
const startFallbackRefresh = () => {
  if (fallbackRefreshInterval) return
  
  fallbackRefreshInterval = setInterval(async () => {
    if (!isGenerating.value && !isSSEConnected.value) {
      console.log('[FallbackRefresh] Refreshing folders...')
      await loadCardFolders()
    }
  }, 10000) // 10秒刷新一次
  
  console.log('[FallbackRefresh] Started')
}

// 停止备用刷新
const stopFallbackRefresh = () => {
  if (fallbackRefreshInterval) {
    clearInterval(fallbackRefreshInterval)
    fallbackRefreshInterval = null
    console.log('[FallbackRefresh] Stopped')
  }
}

// 检查并自动生成缺失的HTML
const checkAndGenerateMissingHtml = async () => {
  console.log('[AutoGenerate] Checking for missing HTML files...')
  
  for (const folder of cardFolders.value) {
    // 等待一下让DOM更新
    await new Promise(resolve => setTimeout(resolve, 100))
    
    for (const card of folder.cards || []) {
      // 只处理非response的JSON文件
      if (card.name.endsWith('.json') && !card.name.includes('-response.json')) {
        // 检查是否已经存在response文件
        const baseName = card.name.replace('.json', '')
        const responseFileName = `${baseName}-response.json`
        const hasResponseFile = folder.cards.some(c => c.name === responseFileName)
        
        if (!hasResponseFile) {
          console.log('[AutoGenerate] Missing response file for:', card.name)
          
          // 触发生成HTML按钮
          const button = document.getElementById(`generate-html-btn-${card.id}`)
          if (button && !button.disabled) {
            console.log('[AutoGenerate] Triggering generate HTML button for:', card.name)
            button.click()
            
            // 等待一会儿再处理下一个，避免同时生成太多
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
    }
  }
  
  console.log('[AutoGenerate] Check completed')
}

// 删除文件夹
const deleteFolder = async (folder) => {
  try {
    const cardCount = folder.cards?.length || 0
    const countText = cardCount > 0 ? `包含 ${cardCount} 个文件` : '空文件夹'
    
    const confirmResult = await ElMessageBox.confirm(
      `确定要删除文件夹 "${folder.name}" 吗？\n\n📁 ${countText}\n⚠️  此操作不可恢复，所有文件都将被永久删除。`,
      '删除文件夹确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        dangerouslyUseHTMLString: false
      }
    )
    
    if (confirmResult === 'confirm') {
      ElMessage.info('正在删除文件夹...')
      
      const result = await terminalAPI.deleteCard(folder.path)
      
      if (result.success) {
        ElMessage.success(`文件夹 "${folder.name}" 已删除`)
        
        // 如果删除的是当前选中的文件夹，清除选中状态
        if (selectedFolder.value === folder.id) {
          selectedFolder.value = null
          selectedCard.value = null
          previewContent.value = ''
          previewType.value = ''
          responseUrls.value = { shareLink: '', originalUrl: '' }
        }
        
        // 刷新文件夹列表
        await refreshCardFolders()
      } else {
        ElMessage.error('删除失败：' + (result.message || '未知错误'))
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[DeleteFolder] Error:', error)
      ElMessage.error('删除失败：' + error.message)
    }
  }
}

// 删除文件
const deleteCardFile = async (card, folder) => {
  try {
    const fileType = card.name.toLowerCase().endsWith('.json') ? 'JSON配置文件' : 
                    (card.name.toLowerCase().endsWith('.html') || card.name.toLowerCase().endsWith('.htm')) ? 'HTML网页文件' : '文件'
    const folderInfo = folder ? `来自文件夹: ${folder.name}` : ''
    
    const confirmResult = await ElMessageBox.confirm(
      `确定要删除文件 "${card.name}" 吗？\n\n📄 类型: ${fileType}\n📁 ${folderInfo}\n⚠️  此操作不可恢复。`,
      '删除文件确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        dangerouslyUseHTMLString: false
      }
    )
    
    if (confirmResult === 'confirm') {
      ElMessage.info('正在删除文件...')
      
      const result = await terminalAPI.deleteCard(card.path)
      
      if (result.success) {
        ElMessage.success(`文件 "${card.name}" 已删除`)
        
        // 如果删除的是当前选中的文件，清除选中状态
        if (selectedCard.value === card.id) {
          selectedCard.value = null
          previewContent.value = ''
          previewType.value = ''
          responseUrls.value = { shareLink: '', originalUrl: '' }
        }
        
        // 刷新文件夹列表
        await refreshCardFolders()
      } else {
        ElMessage.error('删除失败：' + (result.message || '未知错误'))
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[DeleteCard] Error:', error)
      ElMessage.error('删除失败：' + error.message)
    }
  }
}

// Watch for mobile tab changes to initialize terminal when needed
watch(() => layoutStore.activeMobileTab, async (newTab, oldTab) => {
  console.log('[Terminal] Mobile tab changed:', { from: oldTab, to: newTab, isMobile: device.isMobile.value })
  
  if (newTab === 'terminal' && device.isMobile.value) {
    console.log('[Terminal] Switching to terminal tab, ensuring proper state...')
    
    try {
      await nextTick() // Wait for DOM update
      
      // 如果terminal未初始化，则初始化
      if (!terminalInitialized.value) {
        console.log('[Terminal] Terminal not initialized, initializing now...')
        await initializeTerminal()
      } else {
        // Terminal功能已移至独立页面
        console.log('[Terminal] Terminal functionality moved to standalone page')
      }
    } catch (err) {
      console.error('[CardGenerator] Mobile terminal state recovery failed:', err)
    }
  }
}, { immediate: false })

// 处理初始化完成事件
const onInitializationComplete = async (result) => {
  console.log('[CardGenerator] Initialization complete:', result)
  
  if (result.success || result.skipped) {
    
    // 隐藏初始化界面
    showInitializer.value = false
    
    // 终端功能已移至独立页面，无需初始化
    await nextTick()
    terminalInitialized.value = true
    
    // 加载数据
    await loadCardFolders()
    loadTemplates()
    
    // 初始化SSE实时同步
    initSSE()
    
    // 延迟检查并自动生成缺失的HTML
    setTimeout(() => {
      checkAndGenerateMissingHtml()
    }, 3000)
  }
}

// Initialize
onMounted(async () => {
  console.log('[CardGenerator] mounted. device:', device.deviceType.value, 'mobile?', device.isMobile.value, 'tab:', currentMobileTab.value)
  console.log('[CardGenerator] Component mounted, showing initializer...')
  
  // 更新当前用户名
  const storedUsername = localStorage.getItem('username')
  if (storedUsername) {
    currentUsername.value = storedUsername
    console.log('[CardGenerator] Current user:', storedUsername)
  }
  
  // 初始化界面会处理所有的初始化流程
  // 不再在这里直接初始化
  
  // 加载风格模板
  await loadTemplates()
  
  // 恢复聊天历史
  restoreChatHistoryFromLocal()
})


// Cleanup
onUnmounted(() => {
  console.log('[CardGenerator] unmounted')
  console.log('[CardGenerator] Component unmounting, cleaning up...')
  
  // 断开SSE连接
  if (sseUnsubscribe) {
    sseUnsubscribe()
  }
  sseService.disconnect()
  
  // 停止备用刷新
  stopFallbackRefresh()
  
  // 清理终端
  // terminalService cleanup moved to terminal API
  console.log('[CardGenerator] Component unmounted and cleaned up')
})

watch(currentMobileTab, (to, from) => {
  console.log('[CardGenerator] currentMobileTab changed:', { from, to })
})

// 是否可预览（选中的卡片）
const canPreviewSelected = computed(() => {
  if (!selectedCard.value || !selectedFolder.value) return false
  const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
  const card = folder?.cards?.find(c => c.id === selectedCard.value)
  if (!card) return false
  const name = (card.name || '').toLowerCase()
  return name.endsWith('-response.json') || name.endsWith('.html') || name.endsWith('.htm') || previewType.value || responseUrls.value.shareLink
})

// 区分文件类型（移动/PC 共用）
const isPlainJsonSelected = computed(() => {
  const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
  const card = folder?.cards?.find(c => c.id === selectedCard.value)
  if (!card) return false
  const name = (card.name || '').toLowerCase()
  return name.endsWith('.json') && !name.includes('-response.json')
})
const isResponseJsonSelected = computed(() => {
  const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
  const card = folder?.cards?.find(c => c.id === selectedCard.value)
  if (!card) return false
  return (card.name || '').toLowerCase().includes('-response.json')
})
const isHtmlSelected = computed(() => {
  const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
  const card = folder?.cards?.find(c => c.id === selectedCard.value)
  if (!card) return false
  const name = (card.name || '').toLowerCase()
  return name.endsWith('.html') || name.endsWith('.htm')
})

const isMarkdownSelected = computed(() => {
  const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
  const card = folder?.cards?.find(c => c.id === selectedCard.value)
  if (!card) return false
  const name = (card.name || '').toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown')
})

// 计算终端区域样式
const terminalStyle = computed(() => {
  if (!showTerminal.value) {
    return { height: '48px' }
  }
  // 桌面端按拖拽高度渲染；移动端不使用该区域
  return { height: terminalHeight.value + 'px' }
})

// 预览状态日志函数
const logPreviewState = (context) => {
  console.log(`[Preview] ${context}:`, {
    previewType: previewType.value,
    hasPreviewContent: !!previewContent.value,
    contentLength: typeof previewContent.value === 'string' ? previewContent.value.length : 'non-string',
    responseUrls: responseUrls.value,
    activeTab: activePreviewTab.value
  })
}

const handlePreviewSelected = async () => {
  console.log('[Preview] handlePreviewSelected:start', { 
    selectedCard: selectedCard.value, 
    selectedFolder: selectedFolder.value 
  })
  
  // 设置加载状态
  isLoadingPreview.value = true
  previewLoadingProgress.value = 0
  
  try {
    // 详细调试信息
    console.log('[Preview] Available folders:', cardFolders.value.map(f => ({ id: f.id, name: f.name, cardCount: f.cards?.length })))
    
    // 递归查找文件夹的函数
    const findFolderRecursive = (folders, targetId) => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return folder
        }
        if (folder.subfolders && folder.subfolders.length > 0) {
          const found = findFolderRecursive(folder.subfolders, targetId)
          if (found) return found
        }
      }
      return null
    }
    
    const folder = findFolderRecursive(cardFolders.value, selectedFolder.value)
    console.log('[Preview] Found folder:', folder ? { id: folder.id, name: folder.name, cardCount: folder.cards?.length } : null)
    
    if (folder && folder.cards) {
      console.log('[Preview] Cards in folder:', folder.cards.map(c => ({ id: c.id, name: c.name })))
    }
    
    const card = folder?.cards?.find(c => c.id === selectedCard.value)
    console.log('[Preview] Found card:', card ? { id: card.id, name: card.name, path: card.path } : null)
    
    if (!card) { 
      console.warn('[Preview] Card selection debug:', {
        selectedCard: selectedCard.value,
        selectedFolder: selectedFolder.value,
        folderFound: !!folder,
        folderCards: folder?.cards?.length || 0,
        availableCardIds: folder?.cards?.map(c => c.id) || []
      })
      ElMessage.warning('请先选择一个文件')
      return 
    }
    
    const name = (card.name || '').toLowerCase()
    console.log('[Preview] detect file', { name, cardPath: card.path })
    
    // 显示加载进度
    previewLoadingProgress.value = 20
    ElMessage.info(`正在加载 ${card.name}...`)

    // 先加载内容（如果还没有加载的话）
    if (!previewContent.value) {
      console.log('[Preview] No preview content, loading card content first')
      previewLoadingProgress.value = 40
      
      await loadCardContent(card.id, folder.id)
      
      console.log('[Preview] After loading card content:', { 
        hasContent: !!previewContent.value, 
        previewType: previewType.value,
        contentType: typeof previewContent.value
      })
      
      previewLoadingProgress.value = 70
    }

    // 统一移动端预览交互：所有文件类型都使用全屏预览
    if (name.includes('-response.json')) {
      console.log('[Preview] branch: response.json → preview')
      previewLoadingProgress.value = 85
      
      try {
        // 验证response.json内容
        if (!previewContent.value) {
          throw new Error('Response文件内容为空')
        }
        
        // 验证是否有有效的URL数据
        if (previewType.value !== 'iframe' && !responseUrls.value.shareLink && !responseUrls.value.originalUrl) {
          throw new Error('Response文件中未找到有效的预览链接')
        }
        
        // 所有验证通过，标记解析成功
        previewLoadingProgress.value = 100
        ElMessage.success('Response文件解析成功，正在打开预览')
        
        // 只有在所有验证都通过的情况下才触发预览
        if (device.isMobile.value) {
          console.log('[Preview] All validations passed, opening fullscreen preview')
          layoutStore.toggleFullScreen('preview')
        }
        
      } catch (error) {
        console.error('[Preview] Response file processing failed:', error)
        let errorMessage = 'Response文件预览失败'
        if (error.message.includes('为空')) {
          errorMessage = 'Response文件内容为空，可能文件损坏或未完整生成'
        } else if (error.message.includes('未找到有效的预览链接')) {
          errorMessage = 'Response文件中缺少预览链接信息，请重新生成HTML'
        } else {
          errorMessage = `Response文件处理错误: ${error.message}`
        }
        ElMessage.error(errorMessage)
        return
      }
      
      logPreviewState('after load response.json')
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      console.log('[Preview] branch: html → preview')
      previewLoadingProgress.value = 80
      
      try {
        // HTML文件需要特殊处理和验证
        if (!previewContent.value || !previewType.value?.includes('html')) {
          ElMessage.info('正在加载HTML文件...')
          await loadCardContent(card.id, folder.id)
        }
        
        // 验证HTML内容
        if (!previewContent.value) {
          throw new Error('HTML文件内容为空')
        }
        
        // 验证HTML内容格式
        if (typeof previewContent.value === 'string' && previewContent.value.length > 0) {
          // 简单验证HTML标签
          if (!previewContent.value.includes('<html') && !previewContent.value.includes('<div') && !previewContent.value.includes('<body')) {
            console.warn('[Preview] HTML content may not be valid HTML format')
          }
          console.log('[Preview] HTML content validation passed, length:', previewContent.value.length)
        } else {
          throw new Error('HTML文件内容格式错误')
        }
        
        // 验证previewType
        if (!previewType.value || !previewType.value.includes('html')) {
          throw new Error(`HTML预览类型错误: ${previewType.value}`)
        }
        
        // 所有验证通过，标记解析成功
        previewLoadingProgress.value = 100
        ElMessage.success('HTML文件解析成功，正在打开预览')
        
        // 只有在所有验证都通过的情况下才触发预览
        if (device.isMobile.value) {
          console.log('[Preview] HTML validation successful, opening fullscreen preview')
          layoutStore.toggleFullScreen('preview')
        }
        
      } catch (error) {
        console.error('[Preview] HTML processing failed:', error)
        let errorMessage = 'HTML文件预览失败'
        if (error.message.includes('内容为空')) {
          errorMessage = 'HTML文件内容为空，可能文件未完整保存或已损坏'
        } else if (error.message.includes('内容格式错误')) {
          errorMessage = 'HTML文件格式不正确，请检查文件内容'
        } else if (error.message.includes('预览类型错误')) {
          errorMessage = 'HTML文件类型识别失败，请重新加载文件'
        } else {
          errorMessage = `HTML文件处理错误: ${error.message}`
        }
        ElMessage.error(errorMessage)
        return
      }
      
      logPreviewState('after load html')
    } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
      console.log('[Preview] branch: markdown → preview')
      previewLoadingProgress.value = 90
      
      // MD文件通常加载很快，但也需要验证
      if (!previewContent.value || previewType.value !== 'markdown') {
        ElMessage.warning('Markdown内容尚未加载，请稍候...')
        return
      }
      
      // Markdown文件验证成功，标记解析成功
      previewLoadingProgress.value = 100
      ElMessage.success('Markdown文件解析成功，正在打开预览')
      
      // 只有在验证通过的情况下才触发预览
      if (device.isMobile.value) {
        console.log('[Preview] Markdown validation successful, opening fullscreen preview')
        layoutStore.toggleFullScreen('preview')
      }
      
      logPreviewState('after load markdown')
    } else if (name.endsWith('.json')) {
      console.log('[Preview] branch: json → view JSON in fullscreen')
      previewLoadingProgress.value = 80
      
      try {
        // JSON文件需要特殊处理和验证
        if (!previewContent.value || previewType.value !== 'json') {
          ElMessage.info('正在解析JSON文件...')
          await loadCardContent(card.id, folder.id)
        }
        
        // 验证JSON内容
        if (!previewContent.value) {
          throw new Error('JSON文件内容为空')
        }
        
        // 尝试解析JSON以验证格式
        if (typeof previewContent.value === 'string') {
          try {
            JSON.parse(previewContent.value)
            console.log('[Preview] JSON format validation passed')
          } catch (parseError) {
            throw new Error(`JSON格式错误: ${parseError.message}`)
          }
        }
        
        // 确保previewType被正确设置
        if (previewType.value !== 'json') {
          previewType.value = 'json'
        }
        
        // 所有验证通过，标记解析成功  
        previewLoadingProgress.value = 100
        ElMessage.success('JSON文件解析成功，正在打开预览')
        
        // 只有在所有验证都通过的情况下才触发预览
        if (device.isMobile.value) {
          console.log('[Preview] JSON validation successful, opening fullscreen preview')
          layoutStore.toggleFullScreen('preview')
        }
        
      } catch (error) {
        console.error('[Preview] JSON processing failed:', error)
        let errorMessage = 'JSON文件预览失败'
        if (error.message.includes('内容为空')) {
          errorMessage = 'JSON文件内容为空，可能文件未完整生成或已损坏'
        } else if (error.message.includes('JSON格式错误')) {
          errorMessage = `JSON格式不正确: ${error.message.split(': ')[1] || '语法错误'}`
        } else if (error.message.includes('解析')) {
          errorMessage = '无法解析JSON文件，请检查文件格式是否正确'
        } else {
          errorMessage = `JSON文件处理错误: ${error.message}`
        }
        ElMessage.error(errorMessage)
        return
      }
      
      logPreviewState('after load json')
    } else {
      console.log('[Preview] unsupported file type')
      ElMessage.info('该文件不支持预览')
    }
  } catch (e) {
    console.error('[Preview] Failed:', e)
    ElMessage.error(`预览失败: ${e.message}`)
  } finally {
    // 清理加载状态
    isLoadingPreview.value = false
    previewLoadingProgress.value = 0
  }
}

// 仅预览原始JSON - 保留给桌面端或特殊需要时使用
const viewJsonSelected = async () => {
  try {
    const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
    const card = folder?.cards?.find(c => c.id === selectedCard.value)
    if (!card) return
    const name = (card.name || '').toLowerCase()
    if (!name.endsWith('.json') || name.includes('-response.json')) return
    console.log('[Preview] viewJsonSelected')
    // 确保内容已加载
    if (!previewContent.value) {
      await loadCardContent(card.id, folder.id)
    }
    previewType.value = 'json'
    if (device.isMobile.value) {
      layoutStore.toggleFullScreen('preview')
    }
    logPreviewState('after viewJsonSelected')
  } catch (e) {
    console.error('[Preview] viewJsonSelected error', e)
  }
}

// 从选中的普通JSON生成预览
const generateFromSelectedJson = async () => {
  try {
    const folder = cardFolders.value.find(f => f.id === selectedFolder.value)
    const card = folder?.cards?.find(c => c.id === selectedCard.value)
    if (!card) return
    console.log('[Preview] generateFromSelectedJson')
    await generateHtmlFromJson(card, folder)
    if (device.isMobile.value) {
      layoutStore.toggleFullScreen('preview')
    }
    logPreviewState('after generateFromSelectedJson')
  } catch (e) {
    console.error('[Preview] generateFromSelectedJson error', e)
  }
}

const copyLink = async (which) => {
  try {
    const url = which === 'share' ? responseUrls.value.shareLink : responseUrls.value.originalUrl
    console.log('[Preview] copyLink', which, url)
    if (!url) { ElMessage.info('暂无该链接'); return }
    await navigator.clipboard.writeText(url)
    ElMessage.success('链接已复制')
  } catch (e) {
    console.log('[Preview] copyLink error', which, e)
    ElMessage.info('复制失败，请手动复制')
  }
}

const openLink = (which) => {
  const url = which === 'share' ? responseUrls.value.shareLink : responseUrls.value.originalUrl
  console.log('[Preview] openLink', which, url)
  if (!url) { ElMessage.info('暂无该链接'); return }
  window.open(url, '_blank')
}

// 处理HtmlContentViewer的打开新窗口请求
const handleOpenHtmlLink = () => {
  try {
    // 优先打开分享链接，如果没有则打开原始链接
    let linkToOpen = responseUrls.value.shareLink || responseUrls.value.originalUrl
    
    // 如果没有预设链接，为当前选中的HTML文件构建直接访问链接
    if (!linkToOpen && selectedCard.value && selectedFolder.value) {
      // 递归查找文件夹
      const findFolderRecursive = (folders, targetId) => {
        for (const folder of folders) {
          if (folder.id === targetId) {
            return folder
          }
          if (folder.subfolders && folder.subfolders.length > 0) {
            const found = findFolderRecursive(folder.subfolders, targetId)
            if (found) return found
          }
        }
        return null
      }
      
      const folder = findFolderRecursive(cardFolders.value, selectedFolder.value)
      const card = folder?.cards?.find(c => c.id === selectedCard.value)
      
      if (card && card.name.toLowerCase().endsWith('.html')) {
        // 构建HTML文件的直接访问URL
        // 格式: /api/terminal/card/html/:folderId/:fileName
        // 需要提取folderId的相对路径部分
        const folderPath = selectedFolder.value.replace(/^.*\/workspace\//, '') // 移除前缀，保留card/xxx部分
        linkToOpen = `/api/terminal/card/html/${encodeURIComponent(folderPath)}/${encodeURIComponent(card.name)}`
        console.log('[Open] Generated HTML link:', linkToOpen)
      }
    }
    
    if (linkToOpen) {
      window.open(linkToOpen, '_blank')
      ElMessage.success('已在新窗口打开HTML页面')
    } else {
      ElMessage.warning('暂无可打开的HTML链接')
    }
  } catch (e) {
    console.error('[Open] HTML link open failed:', e)
    ElMessage.error('打开失败，请稍后重试')
  }
}
</script>

<style scoped>
/* Connection Status Bar */
/* 连接状态相关CSS已移除，终端现在通过iframe嵌入 */
.card-generator-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #1a1a1a;
  color: #e0e0e0;
  position: relative;
  font-family: 'Microsoft YaHei', sans-serif;
  overflow: hidden;  /* 防止滚动条 */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Left Sidebar */
.left-sidebar {
  width: 240px;
  min-width: 240px;
  max-width: 240px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-right: 1px solid #2d2d2d;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* User Info Section */
.user-info-section {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #252525;
  border-bottom: 1px solid #2d2d2d;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  font-size: 20px;
  filter: grayscale(0.2);
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.logout-btn:hover {
  background: #ff4444;
  border-color: #ff4444;
  color: white;
}

.logout-icon {
  font-size: 14px;
}

.logout-text {
  font-weight: 500;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #2d2d2d;
  background: #252525;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #cccccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.refresh-btn {
  background: transparent;
  border: none;
  color: #888;
  padding: 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.refresh-btn:hover {
  background: #2a2a2a;
  color: #4a9eff;
}

.folder-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

.folder-tree::-webkit-scrollbar {
  width: 6px;
}

.folder-tree::-webkit-scrollbar-track {
  background: transparent;
}

.folder-tree::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.folder-tree::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.folder-container {
  display: flex;
  flex-direction: column;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  user-select: none;
  margin-bottom: 2px;
  position: relative;
  max-width: calc(100vw - 40px);
}

.folder-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.delete-folder-btn {
  background: transparent;
  border: none;
  color: #888;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  margin-left: auto;
  opacity: 0;
}

.folder-item:hover .delete-folder-btn {
  opacity: 1;
}

.delete-folder-btn:hover {
  background: #ff4444;
  color: white;
}

.folder-item.expanded {
  background: transparent;
}

.folder-item.selected {
  background: rgba(74, 158, 255, 0.15);
  border-left: 3px solid #4a9eff;
}

/* Subfolder styling */
.subfolder {
  margin-left: 10px;
}

.subfolder-item {
  font-size: 13px;
  padding: 5px 8px;
}

.subfolder-cards {
  margin-left: 8px;
}

.folder-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.folder-name {
  flex: 1;
  color: #e0e0e0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100vw - 200px);
}

.folder-count {
  color: #666;
  font-size: 11px;
  background: #2a2a2a;
  padding: 1px 5px;
  border-radius: 10px;
}

.cards-list {
  margin-left: 12px;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.card-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 13px;
  cursor: pointer;
  position: relative;
  max-width: calc(100vw - 60px);
}

.card-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.card-item.active {
  background: rgba(74, 158, 255, 0.15);
  border-left: 3px solid #4a9eff;
}

.card-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #4a9eff;
  border-radius: 2px;
}

/* 移动端增强选中状态高亮 - 绿色主题 */
@media (max-width: 768px) {
  .card-item.active {
    background: linear-gradient(90deg, #065f46 0%, #1f2937 100%) !important;
    border: 2px solid #10b981 !important;
    border-left: 4px solid #34d399 !important;
    color: #6ee7b7 !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
    transform: translateX(4px) !important;
    position: relative !important;
  }
  
  .card-item.active::before {
    content: '▶' !important;
    position: absolute !important;
    left: -8px !important;
    color: #34d399 !important;
    font-size: 12px !important;
    animation: pulse 1.5s infinite !important;
  }
  
  .card-item.active .card-name {
    color: #d1fae5 !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
  }
  
  .card-item.active .card-icon {
    filter: brightness(1.5) saturate(1.3) drop-shadow(0 0 4px rgba(52, 211, 153, 0.5)) !important;
    transform: scale(1.1) !important;
  }
  
  .card-item.active .card-type {
    background: #10b981 !important;
    color: white !important;
    border-color: #10b981 !important;
  }
}

/* 桌面端也增强选中状态 - 绿色主题 */
.card-item.active {
  background: linear-gradient(90deg, #047857 0%, #2a2a2a 100%);
  border-left: 3px solid #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transform: translateX(2px);
}

.card-item.active .card-name {
  color: #6ee7b7;
}

.card-item.active .card-icon {
  filter: brightness(1.3) saturate(1.2);
}

.card-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.card-name {
  color: #d0d0d0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: calc(100vw - 220px);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 新的状态样式 */
.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.folder-status {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-right: 8px;
}

.status-indicator {
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: bold;
}

.status-indicator.selected {
  background: #4a9eff;
  color: white;
  animation: pulse 1.5s infinite;
}

.status-indicator.generating {
  color: #ffa500;
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.delete-card-btn {
  background: transparent;
  border: none;
  color: #888;
  padding: 0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  opacity: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-item:hover .delete-card-btn {
  opacity: 1;
}

.delete-card-btn:hover {
  color: #ff4444;
  transform: scale(1.2);
}

.card-type {
  color: #888;
  font-size: 10px;
  padding: 2px 5px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 3px;
  text-transform: uppercase;
  line-height: 1;
}

.generate-html-btn {
  background: transparent;
  color: #4a9eff;
  border: 1px solid #4a9eff;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  width: 20px;
  opacity: 0;
}

.card-item:hover .generate-html-btn {
  opacity: 1;
}

.generate-html-btn:hover {
  background: #4a9eff;
  color: white;
}

.generate-html-btn:active {
  transform: scale(0.95);
}

.generate-html-btn:disabled {
  background: transparent;
  border-color: #555;
  color: #555;
  cursor: not-allowed;
}

.loading-spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
  font-size: 14px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-message {
  text-align: center;
  color: #666;
  padding: 20px;
  font-size: 13px;
}

/* Main Area */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 0; /* 移除gap，让splitter紧贴 */
  min-width: 0; /* 防止flex子元素撑开 */
  max-width: calc(100vw - 560px); /* 左侧240px + 右侧320px */
  min-height: 0; /* 防止flex子元素超出容器 */
}

.preview-area,
.terminal-area {
  background: #252525;
  border: 1px solid #333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* 允许被压缩 */
}

.preview-area {
  flex: 1;
  min-height: 80px; /* 允许更小，但保底 */
  margin-bottom: 8px; /* 与splitter保持一点距离 */
}

.terminal-area.collapsed {
  height: 48px !important; /* 只显示header */
}

.terminal-area:not(.collapsed) {
  transition: none; /* 禁用transition，让拖拽更流畅 */
  margin-top: 8px; /* 与splitter保持一点距离 */
}

.terminal-area {
  flex-shrink: 0; /* 防止终端区域被压缩 */
  min-height: 0;
}

/* 更新后的区域头部样式 */
.area-header {
  background: #2a2a2a;
  border-bottom: 1px solid #333;
}

.area-title {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

/* 顶部操作栏样式 */
.top-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: #333;
  border-top: 1px solid #444;
}

.selected-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #e0e0e0;
}

.selected-icon {
  font-size: 16px;
}

.selected-name {
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-type {
  background: #555;
  color: #ccc;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 400;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #555;
  color: #e0e0e0;
}

.action-btn:hover:not(:disabled) {
  background: #666;
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: #4a9eff;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #3a8eef;
}

.action-btn.danger {
  background: #f56565;
  color: white;
}

.action-btn.danger:hover:not(:disabled) {
  background: #e55555;
}

.action-btn.secondary {
  background: #666;
  color: #ccc;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #777;
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-weight: 500;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .top-action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px;
  }
  
  .selected-item-info {
    justify-content: center;
    padding: 4px 0;
  }
  
  .action-buttons {
    justify-content: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .action-btn {
    flex: 0 0 auto;
    min-width: 80px;
    justify-content: center;
    padding: 6px 8px;
    font-size: 11px;
  }
}

.preview-type-tag {
  background: #4a9eff;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  cursor: pointer;
  user-select: none;
}

.terminal-header:hover {
  background: #303030;
}

.terminal-toggle {
  display: inline-block;
  margin-right: 8px;
  transition: transform 0.2s;
}

.terminal-status-mini {
  margin-left: 10px;
  font-size: 12px;
  color: #888;
}

.claude-status {
  font-size: 13px;
  color: #888;
}

.terminal-title {
  font-size: 14px;
  font-weight: 500;
}

.terminal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}


.preview-content {
  flex: 1;
  position: relative;
  overflow: hidden; /* 防止内容溢出 */
  display: flex;
  flex-direction: column;
}


.stream-msg-item {
  color: #c9d1d9;
  font-size: 11px;
  line-height: 1.5;
  padding: 4px 8px;
  margin: 2px 0;
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid rgba(74, 158, 255, 0.3);
  word-break: break-all;
  white-space: pre-wrap;
}

.stream-messages-mini::-webkit-scrollbar {
  width: 4px;
}

.stream-messages-mini::-webkit-scrollbar-track {
  background: transparent;
}

.stream-messages-mini::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.json-viewer-preview {
  flex: 1;
  overflow: hidden;
}

.html-content-viewer-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.iframe-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  overflow: hidden;
}

.preview-iframe {
  background: white;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.iframe-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.scale-toggle-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(74, 158, 255, 0.9);
  color: white;
  border: 1px solid #4a9eff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.scale-reset-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.scale-toggle-btn:hover {
  background: rgba(74, 158, 255, 1);
  transform: scale(1.05);
}

.scale-reset-btn:hover {
  background: #4a9eff;
  border-color: #4a9eff;
  transform: scale(1.1);
}

.scale-toggle-btn:active,
.scale-reset-btn:active {
  transform: scale(0.95);
}

.empty-state {
  color: #666;
  font-size: 14px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.json-viewer-preview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}

.markdown-viewer-preview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #1e1e1e;
}

.terminal-content {
  flex: 1;
  background: #0c0c0c;
  overflow: hidden;
  padding: 10px;
  text-align: left;
}

/* Terminal Engine container styles */
.terminal-content {
  background-color: #000000;
  height: 100%;
}

/* Terminal redirect styles */
.terminal-redirect {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
}

.redirect-content {
  text-align: center;
  max-width: 300px;
}

.redirect-content h3 {
  color: #333;
  margin-bottom: 16px;
  font-size: 20px;
}

.redirect-content p {
  color: #666;
  margin-bottom: 24px;
  line-height: 1.5;
}

.terminal-redirect-btn {
  background: linear-gradient(135deg, #007ACC, #005999);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.3);
}

.terminal-redirect-btn:hover {
  background: linear-gradient(135deg, #005999, #003d66);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.4);
}

.terminal-redirect-btn:active {
  transform: translateY(0);
}

/* Right Sidebar */
.right-sidebar {
  width: 320px;
  min-width: 320px;
  flex-shrink: 0;
  background: #252525;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Style Templates */
.style-templates {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #333;
  overflow: hidden;
}

.template-header {
  padding: 15px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.template-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.template-item {
  padding: 12px 15px;
  margin-bottom: 8px;
  background: #2a2a2a;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  background: #333;
  border-color: #444;
}

.template-item.active {
  background: #3a3a3a;
  border-color: #4a9eff;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

/* Upload Section */
.upload-section {
  border-bottom: 1px solid #333;
  background: #252525;
}

.upload-header {
  padding: 15px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.upload-actions {
  padding: 15px 20px;
  display: flex;
  gap: 10px;
  flex-direction: column;
}

.upload-btn {
  padding: 10px 15px;
  background: #3a3a3a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.upload-btn:hover {
  background: #444;
  border-color: #555;
}

.folder-btn:hover {
  background: #3a4a2a;
  border-color: #5a7a3a;
}

.file-btn:hover {
  background: #2a3a4a;
  border-color: #3a5a7a;
}


/* Dialog Styles */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  padding: 20px;
  border-bottom: 1px solid #444;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #444;
  color: #fff;
}

.dialog-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4a9eff;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
  font-family: 'Monaco', 'Consolas', monospace;
}

.dialog-footer {
  padding: 20px;
  border-top: 1px solid #444;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn.secondary {
  background: #3a3a3a;
  color: #ccc;
  border: 1px solid #555;
}

.btn.secondary:hover {
  background: #444;
  color: #fff;
}

.btn.primary {
  background: #4a9eff;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #3a8eef;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Input & Create Section */
.stream-messages {
  background: #1e1e1e;
  border-top: 1px solid #333;
  max-height: 200px;
  overflow-y: auto;
}

.stream-header {
  padding: 10px 15px;
  background: #2a2a2a;
  color: #888;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #333;
}

.stream-content {
  padding: 10px;
}

.stream-message {
  padding: 5px 10px;
  margin-bottom: 5px;
  background: #252525;
  border-radius: 4px;
  color: #ccc;
  font-size: 13px;
  font-family: 'Monaco', 'Consolas', monospace;
  line-height: 1.4;
  word-break: break-word;
}

.stream-message:last-child {
  margin-bottom: 0;
}

.input-create-section {
  padding: 20px;
  background: #2a2a2a;
}

/* Optional Parameters Styles */
.optional-params {
  margin-bottom: 20px;
  padding: 15px;
  background: #1e1e1e;
  border-radius: 6px;
  border: 1px solid #333;
}

.params-header {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.params-title {
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
}

.params-hint {
  color: #888;
  font-size: 12px;
}

.param-item {
  margin-bottom: 12px;
}

.param-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  user-select: none;
}

.param-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.param-checkbox span {
  color: #d0d0d0;
  font-size: 13px;
}

.param-input,
.param-textarea {
  width: 100%;
  padding: 8px 12px;
  background: #252525;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  transition: border-color 0.2s;
}

.param-input::placeholder,
.param-textarea::placeholder {
  color: #666;
}

.param-input:focus,
.param-textarea:focus {
  outline: none;
  border-color: #4a9eff;
  background: #2a2a2a;
}

.param-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.input-wrapper {
  display: flex;
  gap: 10px;
}

.topic-input {
  flex: 1;
  padding: 10px 15px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
}

.topic-input::placeholder {
  color: #666;
}

.topic-input:focus {
  outline: none;
  border-color: #4a9eff;
}

.create-btn {
  padding: 10px 30px;
  background: #4a9eff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  font-weight: 500;
}

.create-btn:hover:not(:disabled) {
  background: #3a8eef;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 流式状态指示器 */
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid #4a9eff;
  border-radius: 4px;
  font-size: 12px;
  color: #4a9eff;
  animation: pulse 1.5s ease-in-out infinite;
}

.streaming-dot {
  width: 8px;
  height: 8px;
  background: #4a9eff;
  border-radius: 50%;
  animation: blink 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@keyframes blink {
  0%, 50%, 100% {
    opacity: 1;
  }
  25%, 75% {
    opacity: 0.3;
  }
}

/* HTML链接对话框样式 */
:deep(.html-links-dialog) {
  .el-message-box__content {
    padding: 20px;
  }
  
  a {
    word-break: break-all;
    display: inline-block;
  }
  
  a:hover {
    text-decoration: underline;
  }
}

/* 预览 Tab 样式 */
.preview-tabs {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  height: 42px;
  gap: 2px;
}

.preview-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 4px 4px 0 0;
  color: #888;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  user-select: none;
}

.preview-tab:hover {
  background: #333;
  color: #ccc;
}

.preview-tab.active {
  background: #252525;
  color: #4a9eff;
  border-bottom: 2px solid #4a9eff;
}

.preview-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: #252525;
}

.tab-icon {
  font-size: 14px;
}

.tab-label {
  white-space: nowrap;
}

/* 服务器选择器容器 */
.server-selector-container {
  position: absolute;
  top: 10px;
  right: 340px; /* 右侧栏宽度320px + 20px间距 */
  z-index: 100;
}

/* ===========================
   移动端优化样式
   =========================== */

.mobile-create-container {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: left; /* 强制左对齐 */
  align-items: stretch; /* 内容占满宽度，避免居中 */
}

/* 模板选择区域左对齐 */
.mobile-template-section,
.mobile-template-grid,
.template-header,
.mobile-input-section,
.input-row {
  text-align: left;
}

/* 移动端模板卡片样式 */
.mobile-template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  position: relative;
}

.mobile-template-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.mobile-template-card.active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%) !important;
  border: 2px solid #10b981 !important;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3) !important;
  transform: scale(1.02) !important;
}

.mobile-template-card .template-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.mobile-template-card.active .template-icon {
  filter: brightness(1.3) drop-shadow(0 0 8px rgba(16, 185, 129, 0.6));
}

.mobile-template-card .template-info {
  flex: 1;
  min-width: 0;
}

.mobile-template-card .template-name {
  font-size: 15px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.mobile-template-card.active .template-name {
  color: #34d399 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.mobile-template-card .template-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.3;
}

.mobile-template-card.active .template-desc {
  color: #6ee7b7 !important;
}

.mobile-template-card .template-check {
  display: none; /* 隐藏勾号 */
}

/* 文件 Tab 列表左对齐 */
.mobile-folder-tree,
.folder-container,
.folder-item,
.cards-list,
.card-item,
.file-action-bar,
.mobile-sidebar-header {
  text-align: left;
}

/* Tab 容器不居中内容 */
.mobile-tab-content.create-tab,
.mobile-tab-content.files-tab {
  display: block;
  text-align: left;
}

/* 适配极窄屏，保持左对齐 */
@media (max-width: 400px) {
  .mobile-create-container,
  .mobile-folder-tree { text-align: left; }
}

.mobile-input-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.input-label {
  font-size: 16px;
  font-weight: 600;
  color: #58a6ff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-topic-input {
  flex: 1;
}

.mobile-create-btn {
  height: 44px;
  padding: 0 16px;
  border-radius: 8px;
}

.mobile-create-btn.bordered {
  border:1px solid #58a6ff;
  background: transparent;
  color:#58a6ff;
}

.mobile-topic-input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.1);
}

.mobile-topic-input::placeholder {
  color: #8b949e;
}

.mobile-quick-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.quick-action-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 8px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 60px;
}

.quick-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f0f6fc;
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 18px;
}

.btn-text {
  font-size: 11px;
  font-weight: 500;
}

/* 移动端滚动条优化 */
.mobile-template-grid::-webkit-scrollbar {
  width: 4px;
}

.mobile-template-grid::-webkit-scrollbar-track {
  background: transparent;
}

.mobile-template-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* 确保移动端Tab内容不被顶部用户栏和底部导航遮挡 */
.mobile-tab-content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 60px; /* 为底部导航留出空间 */
}

/* 移动端响应式优化 */
@media (max-width: 400px) {
  .mobile-create-container {
    padding: 12px;
    gap: 16px;
  }
  
  .mobile-input-section {
    padding: 12px;
  }
  
  .mobile-topic-input {
    font-size: 14px;
    padding: 12px;
  }
  
  .mobile-create-btn {
    padding: 12px 20px;
    font-size: 14px;
  }
  
  .template-name {
    font-size: 13px;
  }
  
  .template-desc {
    font-size: 11px;
  }
}

/* 文件操作栏 */
.file-action-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  background: linear-gradient(135deg, rgba(74, 158, 255, 0.15) 0%, rgba(34, 197, 94, 0.12) 100%);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  margin: 8px 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mobile-selected-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  color: #ffffff;
  border-left: 4px solid #4a9eff;
}

.mobile-selected-info .selected-icon {
  font-size: 16px;
}

.mobile-selected-info .selected-name {
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-action-buttons .action-btn {
  padding: 10px 16px;
  background: linear-gradient(135deg, #3a3f4a 0%, #2a2f3a 100%);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #ffffff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  flex: 0 1 auto;
  min-width: fit-content;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.mobile-action-buttons .action-btn:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
}

.mobile-action-buttons .action-btn.primary { 
  background: linear-gradient(135deg, #4a9eff 0%, #0366d6 100%);
  border-color: #4a9eff; 
  color: #fff;
  box-shadow: 0 3px 8px rgba(74, 158, 255, 0.4);
}

.mobile-action-buttons .action-btn.danger { 
  background: linear-gradient(135deg, #f85149 0%, #da3633 100%);
  border-color: #f85149; 
  color: #fff;
  box-shadow: 0 3px 8px rgba(248, 81, 73, 0.4);
}

.mobile-action-buttons .action-btn.secondary { 
  background: linear-gradient(135deg, #8b949e 0%, #6a737d 100%);
  border-color: #8b949e; 
  color: #fff;
  box-shadow: 0 3px 8px rgba(139, 148, 158, 0.3);
}

.mobile-action-buttons .action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mobile-action-buttons .action-btn.primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(74, 158, 255, 0.5);
}

.mobile-action-buttons .action-btn.danger:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(248, 81, 73, 0.5);
}

.mobile-action-buttons .action-btn.secondary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(139, 148, 158, 0.4);
}


/* 移动端用户信息栏样式 */
.mobile-user-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(22,27,34,0.98), rgba(22,27,34,0.95));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.mobile-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-avatar-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.mobile-username {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
}

.mobile-connection-status {
  font-size: 10px;
}

.mobile-connection-status.connected {
  color: #4ade80;
}

.mobile-connection-status.disconnected {
  color: #ef4444;
}

.mobile-logout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.mobile-logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.mobile-logout-btn .logout-icon {
  font-size: 14px;
}

.mobile-logout-btn .logout-text {
  font-weight: 500;
}

/* Tab内容区域调整，避免被顶部用户栏遮挡 */
.mobile-tab-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.mobile-view-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 输入置底 */
.sticky-bottom { position: sticky; bottom: 0; padding-bottom: calc(var(--spacing-mobile-safe-area, env(safe-area-inset-bottom)) + 6px); background: linear-gradient(180deg, rgba(22,27,34,0), rgba(22,27,34,.9) 30%); backdrop-filter: blur(6px); }

/* 让全屏预览内容铺满可视区域 */
.fill { position: absolute; inset: 0; }
.mobile-preview-content.fill { 
  background: #0d1117; 
  overflow: hidden; 
  display: flex; 
  flex-direction: column;
  width: 100%;
  height: 100vh;
}
.mobile-preview-content.fill :deep(iframe),
.mobile-preview-content.fill :deep(webview) { 
  width: 100%; 
  height: 100%; 
  border: 0; 
  flex: 1;
}
.json-viewer-preview.fill { 
  position: absolute; 
  inset: 0; 
  overflow: auto; 
  background: #0d1117;
}

/* 移动端HTML预览优化 */
.mobile-preview-content .html-content-viewer-container {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  flex: 1;
}

.mobile-preview-content .html-content-viewer-container :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none !important;
}

/* 移动端Markdown预览优化 */
.mobile-preview-content .markdown-viewer-preview.fill {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 16px;
  background: #0d1117;
  color: #c9d1d9;
  line-height: 1.6;
}

.mobile-preview-content .markdown-viewer-preview.fill :deep(h1),
.mobile-preview-content .markdown-viewer-preview.fill :deep(h2),
.mobile-preview-content .markdown-viewer-preview.fill :deep(h3) {
  color: #f0f6fc;
  margin-top: 24px;
  margin-bottom: 16px;
}

.mobile-preview-content .markdown-viewer-preview.fill :deep(p) {
  margin-bottom: 16px;
}

.mobile-preview-content .markdown-viewer-preview.fill :deep(pre) {
  background: #161b22;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
}

.mobile-preview-content .markdown-viewer-preview.fill :deep(code) {
  background: #161b22;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 14px;
}

/* 加载进度条样式 */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
  border-radius: 8px;
  margin-bottom: 8px;
}

.loading-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.loading-text {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
  min-width: 80px;
  text-align: right;
}

/* 移动端预览Tabs */
.mobile-preview-tabs {
  display: flex;
  align-items: center;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  height: 42px;
  padding: 0 8px;
  gap: 6px;
}
.mobile-preview-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid transparent;
  background: transparent;
  color: #8b949e;
  border-radius: 6px 6px 0 0;
  font-size: 13px;
}
.mobile-preview-tab.active {
  background: #0d1117;
  color: #58a6ff;
  border-color: #30363d;
  border-bottom-color: #0d1117;
}
.mobile-preview-tab.disabled {
  opacity: .5;
}
.preview-body { 
  flex: 1; 
  position: relative; 
  overflow: hidden; 
  width: 100%; 
  height: 100%;
}

/* 修复移动端预览容器样式 */
.mobile-preview-content .preview-body {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.mobile-preview-content .preview-body > *:not(.html-content-viewer-container) {
  flex: 1;
  width: 100%;
  height: 100%;
}

/* 移动端浮动输入区域 */
.mobile-floating-input {
  position: fixed;
  bottom: 70px; /* 在底部导航栏上方 */
  left: 12px;
  right: 12px;
  z-index: 1000;
  pointer-events: none; /* 允许点击穿透到下方内容 */
}

.floating-input-container {
  background: rgba(22, 27, 34, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(88, 166, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  pointer-events: auto; /* 恢复容器内的点击事件 */
  overflow: hidden;
}

.floating-input-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}


.input-emoji {
  font-size: 16px;
}

.input-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
}

.floating-input-content {
  padding: 12px 16px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.mobile-topic-textarea {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 14px;
  color: #f0f6fc;
  font-size: 15px;
  line-height: 24px;
  resize: none;
  outline: none;
  transition: all 0.2s ease;
  min-height: 48px;
  max-height: 96px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.mobile-topic-textarea::placeholder {
  color: rgba(240, 246, 252, 0.5);
}

.mobile-topic-textarea:focus {
  border-color: #58a6ff;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
}

.mobile-floating-create-btn {
  padding: 12px 20px;
  background: linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-height: 48px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.3);
}

.mobile-floating-create-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1f6feb 0%, #0969da 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(88, 166, 255, 0.4);
}

.mobile-floating-create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.2);
}

/* 确保列表内容不被浮动输入框遮挡 */
.mobile-tab-content.create-tab {
  padding-bottom: 160px; /* 为浮动输入框预留空间 */
}

/* 移动端响应式调整 */
@media (max-width: 400px) {
  .mobile-floating-input {
    left: 8px;
    right: 8px;
    bottom: 65px;
  }
  
  .floating-input-container {
    border-radius: 14px;
  }
  
  .floating-input-content {
    padding: 10px 12px 14px;
    gap: 10px;
  }
  
  .mobile-topic-textarea {
    font-size: 14px;
    padding: 10px 12px;
  }
  
  .mobile-floating-create-btn {
    padding: 10px 16px;
    font-size: 13px;
  }
}

/* 嵌入式终端样式 */
.terminal-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3a3a3a;
}

.terminal-action-btn {
  padding: 4px 12px;
  background: #404040;
  border: 1px solid #555;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.terminal-action-btn:hover {
  background: #505050;
  border-color: #666;
}

.embedded-terminal {
  flex: 1;
  min-height: 200px;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
}

/* 终端iframe样式 */
.terminal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #1e1e1e;
  min-height: 200px;
}

/* 移动端终端样式 */
.mobile-terminal-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3a3a3a;
}

.mobile-terminal-btn {
  padding: 6px 12px;
  background: #404040;
  border: 1px solid #555;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-terminal-btn:hover {
  background: #505050;
  border-color: #666;
}

.mobile-embedded-terminal {
  flex: 1;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
}

.mobile-terminal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #1e1e1e;
  flex: 1;
}

/* 确保移动端终端标签页填满空间 */
.terminal-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* New: make mobile slot root stretch to full height */
.mobile-view-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* New: ensure each mobile tab content fills and is flex container */
.mobile-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Desktop: allow inner flex to scroll correctly */
@media (min-width: 1024px) {
  .terminal-content { display: flex; flex-direction: column; min-height: 0; }
  .embedded-terminal { flex: 1; min-height: 0; position: relative; }
}

/* ============ Mobile Chat Mode Styles ============ */
.create-tab-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

/* 对话历史区域 */
.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  padding-bottom: 20px;
}

/* 聊天消息容器 */
.chat-message {
  margin-bottom: 16px;
}

/* 用户消息 */
.user-message {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-bubble {
  background: #4a9eff;
  color: white;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.message-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  margin-right: 4px;
}

/* AI消息 */
.ai-message {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.ai-response {
  flex: 1;
  max-width: 85%;
}

/* 生成中状态 */
.generating-message {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 8px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #4a9eff;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-10px);
  }
}

.generating-text {
  color: #666;
  font-size: 14px;
}

/* 结果卡片 */
.result-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.card-preview {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 12px;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.card-btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.card-btn.primary {
  background: #4a9eff;
  color: white;
  border-color: #4a9eff;
}

.card-btn.primary:hover {
  background: #3a8ef6;
}

/* 空状态 */
.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #999;
}

/* 输入区域 */
.chat-input-section {
  background: white;
  border-top: 1px solid #e2e8f0;
  padding: 0;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

/* 模板快选 */
.template-shortcuts {
  display: flex;
  gap: 8px;
  padding: 12px;
  overflow-x: auto;
  border-bottom: 1px solid #f0f0f0;
  scrollbar-width: none;
}

.template-shortcuts::-webkit-scrollbar {
  display: none;
}

.shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 12px;
  white-space: nowrap;
  min-width: 60px;
  cursor: pointer;
  transition: all 0.2s;
}

.shortcut-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.shortcut-btn.active {
  border-color: #4a9eff;
  background: #f0f8ff;
  color: #4a9eff;
}

.shortcut-btn.more {
  background: #f8fafc;
  border-style: dashed;
  color: #999;
}

.shortcut-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.shortcut-text {
  font-size: 11px;
}

/* 输入框容器 */
.input-container {
  display: flex;
  gap: 8px;
  padding: 12px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #4a9eff;
}

.send-btn {
  padding: 8px 20px;
  background: #4a9eff;
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #3a8ef6;
}

.send-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
</style>