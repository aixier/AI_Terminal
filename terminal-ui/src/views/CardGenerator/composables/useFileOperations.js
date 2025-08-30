import { ElMessage, ElMessageBox } from 'element-plus'

export function useFileOperations() {
  
  // 下载文件
  const downloadFile = async (file, folder) => {
    try {
      console.log('[downloadFile] Starting download for:', { file, folder })
      
      // 验证参数
      if (!file || !file.name || !file.path) {
        throw new Error('文件信息不完整')
      }
      
      const username = localStorage.getItem('username') || 'default'
      
      // 将绝对路径转换为相对于workspace的路径
      let relativePath = file.path
      const workspacePrefix = `/app/data/users/${username}/workspace/`
      if (relativePath.startsWith(workspacePrefix)) {
        relativePath = relativePath.substring(workspacePrefix.length)
      }
      
      console.log('[downloadFile] Using relative path:', relativePath)
      
      // 获取文件内容
      const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`)
      
      if (!response.ok) {
        throw new Error(`获取文件失败: ${response.status}`)
      }
      
      const data = await response.json()
      
      // 创建下载
      const blob = new Blob([data.content], { 
        type: getContentType(file.name)
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      ElMessage.success('下载成功')
    } catch (error) {
      console.error('Download error:', error)
      ElMessage.error('下载失败: ' + error.message)
    }
  }
  
  // 获取文件MIME类型
  const getContentType = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop()
    const mimeTypes = {
      'html': 'text/html',
      'htm': 'text/html',
      'json': 'application/json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'css': 'text/css',
      'js': 'application/javascript',
      'pdf': 'application/pdf'
    }
    return mimeTypes[ext] || 'text/plain'
  }
  
  // 删除文件
  const deleteFile = async (file, folder) => {
    try {
      await ElMessageBox.confirm(
        `确定要删除文件 "${file.name}" 吗？`,
        '确认删除',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
      
      // 验证参数
      if (!file || !file.path) {
        throw new Error('文件信息不完整')
      }
      
      const username = localStorage.getItem('username') || 'default'
      
      // 将绝对路径转换为相对于workspace的路径
      let relativePath = file.path
      const workspacePrefix = `/app/data/users/${username}/workspace/`
      if (relativePath.startsWith(workspacePrefix)) {
        relativePath = relativePath.substring(workspacePrefix.length)
      }
      
      console.log('[deleteFile] Using relative path:', relativePath)
      
      const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`)
      }
      
      ElMessage.success('删除成功')
      return true
    } catch (error) {
      if (error !== 'cancel') {
        console.error('Delete error:', error)
        ElMessage.error('删除失败: ' + error.message)
      }
      return false
    }
  }
  
  // 重命名文件
  const renameFile = async (file, folder, newName) => {
    try {
      const response = await fetch(`/api/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderId: folder.id,
          oldName: file.name,
          newName: newName
        })
      })
      
      if (!response.ok) {
        throw new Error('重命名失败')
      }
      
      ElMessage.success('重命名成功')
      return true
    } catch (error) {
      console.error('Rename error:', error)
      ElMessage.error('重命名失败: ' + error.message)
      return false
    }
  }
  
  // 预览HTML文件
  const previewHtmlFile = async (file) => {
    try {
      const username = localStorage.getItem('username') || 'default'
      
      // 将绝对路径转换为相对于workspace的路径
      let relativePath = file.path
      const workspacePrefix = `/app/data/users/${username}/workspace/`
      if (relativePath.startsWith(workspacePrefix)) {
        relativePath = relativePath.substring(workspacePrefix.length)
      }
      
      console.log('[previewHtmlFile] Using relative path:', relativePath)
      
      const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`)
      
      if (!response.ok) {
        throw new Error('获取文件内容失败')
      }
      
      const data = await response.json()
      
      // 创建预览窗口
      const previewWindow = window.open('', '_blank')
      if (previewWindow) {
        previewWindow.document.open()
        previewWindow.document.write(data.content)
        previewWindow.document.close()
      } else {
        ElMessage.warning('请允许弹出窗口以预览文件')
      }
    } catch (error) {
      console.error('Preview error:', error)
      ElMessage.error('预览失败: ' + error.message)
    }
  }
  
  // 获取文件内容
  const getFileContent = async (file) => {
    try {
      const username = localStorage.getItem('username') || 'default'
      
      // 将绝对路径转换为相对于workspace的路径
      let relativePath = file.path
      const workspacePrefix = `/app/data/users/${username}/workspace/`
      if (relativePath.startsWith(workspacePrefix)) {
        relativePath = relativePath.substring(workspacePrefix.length)
      }
      
      console.log('[getFileContent] Using relative path:', relativePath)
      
      const response = await fetch(`/api/workspace/${username}/file/${encodeURIComponent(relativePath)}`)
      
      if (!response.ok) {
        throw new Error('获取文件内容失败')
      }
      
      const data = await response.json()
      return data.content
    } catch (error) {
      console.error('Get content error:', error)
      ElMessage.error('获取文件内容失败: ' + error.message)
      return null
    }
  }
  
  // 创建文件夹
  const createFolder = async (parentFolder, folderName) => {
    try {
      const response = await fetch(`/api/folders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: parentFolder?.id,
          name: folderName
        })
      })
      
      if (!response.ok) {
        throw new Error('创建文件夹失败')
      }
      
      ElMessage.success('文件夹创建成功')
      return true
    } catch (error) {
      console.error('Create folder error:', error)
      ElMessage.error('创建文件夹失败: ' + error.message)
      return false
    }
  }
  
  // 删除文件夹
  const deleteFolder = async (folder) => {
    try {
      await ElMessageBox.confirm(
        `确定要删除文件夹 "${folder.name}" 及其所有内容吗？`,
        '确认删除',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
      
      const response = await fetch(`/api/folders/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderId: folder.id
        })
      })
      
      if (!response.ok) {
        throw new Error('删除文件夹失败')
      }
      
      ElMessage.success('文件夹删除成功')
      return true
    } catch (error) {
      if (error !== 'cancel') {
        console.error('Delete folder error:', error)
        ElMessage.error('删除文件夹失败: ' + error.message)
      }
      return false
    }
  }
  
  return {
    downloadFile,
    deleteFile,
    renameFile,
    previewHtmlFile,
    getFileContent,
    createFolder,
    deleteFolder
  }
}