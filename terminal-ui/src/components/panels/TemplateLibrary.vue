<template>
  <div class="template-library">
    <div class="library-grid">
      <div 
        v-for="template in templates" 
        :key="template.id"
        class="template-thumbnail"
        @click="selectTemplate(template)"
      >
        <div class="thumbnail-image">
          <img :src="template.thumbnail" :alt="template.name" />
        </div>
        <div class="thumbnail-info">
          <div class="template-name">{{ template.name }}</div>
          <div class="template-category">{{ template.category }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const templates = ref([
  { 
    id: 1, 
    name: '商务风格', 
    category: '商务',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGY5ZmYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjMDA3OGQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5ZWG5Yqh6aOO5qC8PC90ZXh0Pjwvc3ZnPg==' 
  },
  { 
    id: 2, 
    name: '创意设计', 
    category: '设计',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iYSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZmNDA4MCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2ZmODA0MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWImeavjeivv+orqTwvdGV4dD48L3N2Zz4=' 
  },
  { 
    id: 3, 
    name: '教育学习', 
    category: '教育',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGZkZjQiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjMTA3YzEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pWZ6IKy5a2m5LmgPC90ZXh0Pjwvc3ZnPg==' 
  },
  { 
    id: 4, 
    name: '科技风格', 
    category: '科技',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxNTFlMjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjMDBmZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+56eR5oqA6aOO5qC8PC90ZXh0Pjwvc3ZnPg==' 
  }
])

const selectTemplate = (template) => {
  ElMessage.success(`已选择模板: ${template.name}`)
}
</script>

<style scoped>
.template-library {
  display: flex;
  flex-direction: column;
}

.library-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--fluent-space-sm);
}

.template-thumbnail {
  cursor: pointer;
  transition: all var(--fluent-duration-normal) var(--fluent-easing);
}

.template-thumbnail:hover {
  transform: translateY(-2px);
}

.thumbnail-image {
  width: 100%;
  height: 60px;
  border-radius: var(--fluent-radius-medium);
  overflow: hidden;
  margin-bottom: var(--fluent-space-xs);
}

.thumbnail-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-info {
  text-align: center;
}

.template-name {
  font-size: var(--fluent-font-size-xs);
  font-weight: 600;
  color: var(--fluent-neutral-primary);
  margin-bottom: 2px;
}

.template-category {
  font-size: 10px;
  color: var(--fluent-neutral-tertiary);
}
</style>