<template>
  <div class="recent-cards">
    <div class="cards-list">
      <div 
        v-for="card in recentCards" 
        :key="card.id"
        class="card-item"
        @click="openCard(card)"
      >
        <div class="card-thumbnail">
          <img :src="card.thumbnail" :alt="card.title" />
        </div>
        <div class="card-info">
          <div class="card-title">{{ card.title }}</div>
          <div class="card-time">{{ formatTime(card.createdAt) }}</div>
          <div class="card-status" :class="card.status">
            {{ getStatusText(card.status) }}
          </div>
        </div>
      </div>
    </div>
    
    <div class="no-cards" v-if="recentCards.length === 0">
      <el-icon><DocumentRemove /></el-icon>
      <span>暂无历史记录</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { DocumentRemove } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const recentCards = ref([
  {
    id: 1,
    title: 'Vue 3 开发技巧',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzQxYjg4MyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VnVlIDM8L3RleHQ+PC9zdmc+',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'completed'
  },
  {
    id: 2,
    title: '工作效率提升方法',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwNzhkNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pWI546HPC90ZXh0Pjwvc3ZnPg==',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed'
  },
  {
    id: 3,
    title: '设计思维基础',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmNDA4MCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+6K6+6K6hPC90ZXh0Pjwvc3ZnPg==',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: 'draft'
  }
])

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return '刚刚'
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

const getStatusText = (status) => {
  const statusMap = {
    completed: '已完成',
    draft: '草稿',
    generating: '生成中'
  }
  return statusMap[status] || status
}

const openCard = (card) => {
  ElMessage.info(`打开卡片: ${card.title}`)
}
</script>

<style scoped>
.recent-cards {
  display: flex;
  flex-direction: column;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: var(--fluent-space-sm);
}

.card-item {
  display: flex;
  gap: var(--fluent-space-sm);
  padding: var(--fluent-space-sm);
  background: rgba(255, 255, 255, 0.4);
  border-radius: var(--fluent-radius-medium);
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.card-item:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.card-thumbnail {
  width: 42px;
  height: 25px;
  border-radius: var(--fluent-radius-small);
  overflow: hidden;
  flex-shrink: 0;
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--fluent-font-size-xs);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-time {
  font-size: 10px;
  color: var(--fluent-neutral-tertiary);
  margin-bottom: 2px;
}

.card-status {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: var(--fluent-radius-small);
  display: inline-block;
}

.card-status.completed {
  background: rgba(16, 124, 16, 0.1);
  color: var(--fluent-success);
}

.card-status.draft {
  background: rgba(255, 170, 68, 0.1);
  color: var(--fluent-warning);
}

.card-status.generating {
  background: rgba(0, 120, 212, 0.1);
  color: var(--fluent-blue);
}

.no-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--fluent-space-xs);
  padding: var(--fluent-space-lg);
  color: var(--fluent-neutral-tertiary);
  font-size: var(--fluent-font-size-sm);
  text-align: center;
}

.no-cards el-icon {
  font-size: 24px;
  opacity: 0.5;
}
</style>