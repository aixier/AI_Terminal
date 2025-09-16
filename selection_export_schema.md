# 选区导出数据Schema设计（简洁版）

## 格式说明
导出为JSON数组，每个对象包含被选中的HTML元素和覆盖率。

## Schema定义

```json
[
  {
    "selected_element": "string",              // 完整的HTML元素字符串
    "selection_coverage_percentage": "number"  // 选区覆盖元素的百分比 (0-100)
  }
]
```

## 字段说明

### selected_element
- **类型**: string
- **说明**: 被选中元素的完整HTML字符串
- **示例**: `"<div class=\"overview-number\" id=\"completed-tasks\">0</div>"`
- **用途**: 保留元素的所有属性、类名、ID和内容，便于大模型理解元素的完整结构

### selection_coverage_percentage
- **类型**: number
- **说明**: 选区覆盖该元素的百分比
- **范围**: 0-100
- **示例**: `75.5`
- **用途**: 表示用户涂抹区域占元素面积的比例，只有超过50%的元素才会被选中

## 示例输出

```json
[
  {
    "selected_element": "<div class=\"overview-number\" id=\"completed-tasks\">0</div>",
    "selection_coverage_percentage": 75.5
  },
  {
    "selected_element": "<h2 class=\"section-title\">Task Overview</h2>",
    "selection_coverage_percentage": 100
  },
  {
    "selected_element": "<button class=\"btn btn-primary\" onclick=\"addTask()\">Add New Task</button>",
    "selection_coverage_percentage": 52.3
  },
  {
    "selected_element": "<img src=\"/images/logo.png\" alt=\"Company Logo\" class=\"logo\">",
    "selection_coverage_percentage": 68.9
  },
  {
    "selected_element": "<p class=\"description\">This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>",
    "selection_coverage_percentage": 85.2
  }
]
```

## 优势

1. **极简设计**: 只包含最核心的两个信息
2. **直观易懂**: HTML字符串直接显示元素结构
3. **保留完整信息**: HTML包含所有属性、样式类和内容
4. **易于大模型处理**: 格式清晰，语义明确
5. **文件体积小**: 减少冗余信息，降低存储和传输成本

## 使用场景

- **UI元素识别**: 快速识别页面中被用户选中的元素
- **用户行为分析**: 分析用户关注的页面区域
- **自动化测试**: 记录测试中交互的元素
- **大模型训练**: 生成UI理解和交互的训练数据
- **页面分析报告**: 生成页面元素使用情况报告

## 实现细节

- **选中阈值**: 只有当涂抹区域覆盖元素50%以上时，元素才会被选中
- **不可见元素过滤**: 自动过滤`display:none`、`visibility:hidden`、`opacity:0`的元素
- **空元素过滤**: 自动过滤宽度或高度为0的元素
- **文件格式**: 导出为`.json`文件
- **文件命名**: `selected_elements_[时间戳].json`