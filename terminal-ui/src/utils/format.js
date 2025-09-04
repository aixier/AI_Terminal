/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * 格式化日期时间
 */
export function formatDate(dateString) {
  if (!dateString) return '-'
  
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  
  // 今天
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getDate() === yesterday.getDate() && 
      date.getMonth() === yesterday.getMonth() && 
      date.getFullYear() === yesterday.getFullYear()) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 今年
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 其他
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * 获取文件类型
 */
export function getFileType(filename) {
  const ext = getFileExtension(filename)
  
  const typeMap = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
    // 文档
    pdf: 'document', doc: 'document', docx: 'document', 
    xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document',
    txt: 'document', md: 'document', rtf: 'document',
    // 代码
    js: 'code', ts: 'code', jsx: 'code', tsx: 'code',
    html: 'code', css: 'code', scss: 'code', less: 'code',
    json: 'code', xml: 'code', yaml: 'code', yml: 'code',
    py: 'code', java: 'code', cpp: 'code', c: 'code',
    // 压缩包
    zip: 'archive', rar: 'archive', '7z': 'archive', 
    tar: 'archive', gz: 'archive', bz2: 'archive',
    // 音频
    mp3: 'audio', wav: 'audio', flac: 'audio', 
    aac: 'audio', ogg: 'audio', wma: 'audio',
    // 视频
    mp4: 'video', avi: 'video', mkv: 'video', 
    mov: 'video', wmv: 'video', flv: 'video'
  }
  
  return typeMap[ext] || 'other'
}