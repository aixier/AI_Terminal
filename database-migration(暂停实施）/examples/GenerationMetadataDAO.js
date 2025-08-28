/**
 * GenerationMetadataDAO - 生成物元数据数据访问对象
 * 管理生成任务的完整元数据信息
 */

const BaseDAO = require('./BaseDAO');

class GenerationMetadataDAO extends BaseDAO {
  constructor() {
    super('generation_metadata');
  }

  /**
   * 创建元数据记录
   */
  async createMetadata(taskId, data) {
    const metadata = {
      task_id: taskId,
      user_id: data.userId,
      author_name: data.authorName || data.username,
      author_id: data.authorId || data.username,
      topic: data.topic,
      template_name: data.templateName,
      template_version: data.templateVersion || '1.0.0',
      generation_mode: data.generationMode || 'sync',
      generation_method: data.generationMethod || 'claude-direct',
      ai_model: data.aiModel || 'claude-3-opus',
      ai_provider: data.aiProvider || 'anthropic',
      
      // 参数记录
      input_params: data.inputParams || {},
      generated_params: data.generatedParams || {},
      prompt_template: data.promptTemplate || '',
      
      // 统计信息（初始值）
      total_files: 0,
      primary_file_type: null,
      total_size_bytes: 0,
      generation_duration_ms: null,
      
      // 版本控制
      version: 1,
      parent_task_id: data.parentTaskId || null,
      is_published: false,
      published_at: null,
      
      // 质量和反馈
      quality_score: null,
      review_status: 'pending',
      review_notes: null,
      user_feedback: null,
      
      // 标签和分类
      tags: data.tags || this.extractTags(data.topic),
      category: data.category || this.determineCategory(data.topic),
      language: data.language || 'zh-CN',
      style: data.style || null,
      
      // 时间戳
      expires_at: data.expiresAt || null
    };
    
    return this.create(metadata);
  }

  /**
   * 更新生成结果信息
   */
  async updateGenerationResult(taskId, resultData) {
    const metadata = await this.findOne({ task_id: taskId });
    
    if (!metadata) {
      throw new Error(`Metadata not found for task: ${taskId}`);
    }
    
    return this.update(metadata.id, {
      total_files: resultData.totalFiles || 0,
      primary_file_type: resultData.primaryFileType || null,
      total_size_bytes: resultData.totalSizeBytes || 0,
      generation_duration_ms: resultData.durationMs || null,
      review_status: resultData.success ? 'completed' : 'failed'
    });
  }

  /**
   * 按用户查询元数据
   */
  async findByUser(userId, options = {}) {
    const conditions = { user_id: userId };
    
    // 添加可选条件
    if (options.templateName) {
      conditions.template_name = options.templateName;
    }
    
    if (options.category) {
      conditions.category = options.category;
    }
    
    if (options.reviewStatus) {
      conditions.review_status = options.reviewStatus;
    }
    
    // 日期范围查询
    if (options.startDate && options.endDate) {
      conditions.created_at = {
        $gte: options.startDate,
        $lte: options.endDate
      };
    }
    
    // 标签查询
    if (options.tags && options.tags.length > 0) {
      // 这里需要特殊处理，因为tags是数组
      const allRecords = await this.findAll(conditions);
      return allRecords.filter(record => {
        return options.tags.some(tag => record.tags && record.tags.includes(tag));
      });
    }
    
    return this.findAll(conditions);
  }

  /**
   * 更新审核状态
   */
  async updateReviewStatus(taskId, status, notes, score) {
    const metadata = await this.findOne({ task_id: taskId });
    
    if (!metadata) {
      throw new Error(`Metadata not found for task: ${taskId}`);
    }
    
    const updateData = {
      review_status: status,
      review_notes: notes
    };
    
    if (score !== undefined && score !== null) {
      updateData.quality_score = score;
    }
    
    if (status === 'approved' && !metadata.published_at) {
      updateData.is_published = true;
      updateData.published_at = new Date().toISOString();
    }
    
    return this.update(metadata.id, updateData);
  }

  /**
   * 获取用户统计信息
   */
  async getStatistics(userId, period = 'all') {
    let dateFilter = {};
    const now = new Date();
    
    // 根据时间段设置过滤条件
    switch (period) {
      case 'day':
        dateFilter.created_at = {
          $gte: new Date(now - 24 * 60 * 60 * 1000).toISOString()
        };
        break;
      case 'week':
        dateFilter.created_at = {
          $gte: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
      case 'month':
        dateFilter.created_at = {
          $gte: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
      case 'year':
        dateFilter.created_at = {
          $gte: new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
    }
    
    const conditions = { user_id: userId, ...dateFilter };
    const allMetadata = await this.findAll(conditions);
    
    // 计算统计信息
    const stats = {
      period: period,
      total_generations: allMetadata.length,
      total_size: allMetadata.reduce((sum, m) => sum + (m.total_size_bytes || 0), 0),
      average_duration: allMetadata.length > 0
        ? Math.round(allMetadata.reduce((sum, m) => sum + (m.generation_duration_ms || 0), 0) / allMetadata.length)
        : 0,
      
      // 按状态统计
      status_breakdown: {
        pending: allMetadata.filter(m => m.review_status === 'pending').length,
        completed: allMetadata.filter(m => m.review_status === 'completed').length,
        approved: allMetadata.filter(m => m.review_status === 'approved').length,
        failed: allMetadata.filter(m => m.review_status === 'failed').length
      },
      
      // 模板使用统计
      templates_used: this.groupByCount(allMetadata, 'template_name'),
      
      // 分类统计
      categories: this.groupByCount(allMetadata, 'category'),
      
      // 成功率
      success_rate: allMetadata.length > 0
        ? (allMetadata.filter(m => m.review_status !== 'failed').length / allMetadata.length * 100).toFixed(2) + '%'
        : '0%',
      
      // 平均质量评分
      average_quality: this.calculateAverageQuality(allMetadata),
      
      // 热门标签
      popular_tags: this.extractPopularTags(allMetadata, 10),
      
      // 时间分布
      time_distribution: this.getTimeDistribution(allMetadata)
    };
    
    return stats;
  }

  /**
   * 智能标签提取
   */
  extractTags(topic) {
    const tags = [];
    
    // AI相关
    if (/AI|人工智能|机器学习|深度学习|神经网络|GPT|LLM|Claude/i.test(topic)) {
      tags.push('AI');
    }
    
    // 编程技术
    if (/编程|代码|开发|技术|算法|JavaScript|Python|Java|React|Vue|Node/i.test(topic)) {
      tags.push('技术');
    }
    
    // 科普教育
    if (/科普|知识|教程|入门|基础|学习|教育/i.test(topic)) {
      tags.push('科普');
    }
    
    // 生活相关
    if (/生活|日常|健康|美食|旅游|运动/i.test(topic)) {
      tags.push('生活');
    }
    
    // 商业相关
    if (/商业|经济|创业|管理|营销|金融/i.test(topic)) {
      tags.push('商业');
    }
    
    // 创意设计
    if (/设计|艺术|创意|美术|UI|UX|平面|视觉/i.test(topic)) {
      tags.push('创意');
    }
    
    // 如果没有匹配到任何标签，添加通用标签
    if (tags.length === 0) {
      tags.push('通用');
    }
    
    return tags;
  }

  /**
   * 智能分类判断
   */
  determineCategory(topic) {
    if (/技术|编程|开发|代码|算法|软件|硬件|IT/i.test(topic)) {
      return 'technology';
    }
    if (/生活|日常|健康|美食|旅游|家居|时尚/i.test(topic)) {
      return 'lifestyle';
    }
    if (/教育|学习|知识|科普|培训|考试/i.test(topic)) {
      return 'education';
    }
    if (/商业|经济|创业|管理|金融|投资/i.test(topic)) {
      return 'business';
    }
    if (/艺术|设计|创意|文化|音乐|电影/i.test(topic)) {
      return 'creative';
    }
    if (/科学|研究|实验|论文|学术/i.test(topic)) {
      return 'science';
    }
    if (/游戏|娱乐|动漫|电竞/i.test(topic)) {
      return 'entertainment';
    }
    
    return 'general';
  }

  /**
   * 按字段分组统计
   */
  groupByCount(array, field) {
    const grouped = {};
    
    array.forEach(item => {
      const value = item[field];
      if (value) {
        grouped[value] = (grouped[value] || 0) + 1;
      }
    });
    
    // 按数量排序
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
  }

  /**
   * 计算平均质量评分
   */
  calculateAverageQuality(metadata) {
    const scored = metadata.filter(m => m.quality_score !== null && m.quality_score !== undefined);
    
    if (scored.length === 0) {
      return 'N/A';
    }
    
    const average = scored.reduce((sum, m) => sum + m.quality_score, 0) / scored.length;
    return average.toFixed(2);
  }

  /**
   * 提取热门标签
   */
  extractPopularTags(metadata, limit = 10) {
    const tagCount = {};
    
    metadata.forEach(m => {
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * 获取时间分布
   */
  getTimeDistribution(metadata) {
    const distribution = {
      by_hour: {},
      by_day: {},
      by_month: {}
    };
    
    metadata.forEach(m => {
      if (m.created_at) {
        const date = new Date(m.created_at);
        
        // 按小时统计
        const hour = date.getHours();
        distribution.by_hour[hour] = (distribution.by_hour[hour] || 0) + 1;
        
        // 按星期统计
        const day = date.getDay();
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        distribution.by_day[dayNames[day]] = (distribution.by_day[dayNames[day]] || 0) + 1;
        
        // 按月份统计
        const month = date.getMonth() + 1;
        distribution.by_month[`${month}月`] = (distribution.by_month[`${month}月`] || 0) + 1;
      }
    });
    
    return distribution;
  }

  /**
   * 搜索元数据（支持关键词搜索）
   */
  async search(keyword, options = {}) {
    const allRecords = await this.findAll();
    
    return allRecords.filter(record => {
      // 搜索多个字段
      const searchFields = [
        record.topic,
        record.author_name,
        record.template_name,
        record.review_notes,
        record.user_feedback,
        ...(record.tags || [])
      ];
      
      const searchText = searchFields.join(' ').toLowerCase();
      return searchText.includes(keyword.toLowerCase());
    });
  }

  /**
   * 获取相似任务（用于推荐）
   */
  async findSimilarTasks(taskId, limit = 5) {
    const currentTask = await this.findOne({ task_id: taskId });
    
    if (!currentTask) {
      return [];
    }
    
    // 查找相同模板或相同分类的任务
    const similar = await this.findAll({
      $or: [
        { template_name: currentTask.template_name },
        { category: currentTask.category }
      ]
    });
    
    // 过滤掉当前任务，并按相似度排序
    return similar
      .filter(task => task.task_id !== taskId)
      .map(task => {
        // 计算相似度得分
        let score = 0;
        if (task.template_name === currentTask.template_name) score += 3;
        if (task.category === currentTask.category) score += 2;
        if (task.author_id === currentTask.author_id) score += 1;
        
        // 检查标签重叠
        const tagOverlap = (task.tags || []).filter(tag => 
          (currentTask.tags || []).includes(tag)
        ).length;
        score += tagOverlap;
        
        return { ...task, similarity_score: score };
      })
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }
}

module.exports = GenerationMetadataDAO;