# 简洁版选区导出数据Schema

## 格式说明
导出为JSON数组，每个对象只包含两个关键字段。

## Schema定义

```json
[
  {
    "selected_element": "string",              // 完整的HTML元素字符串
    "selection_coverage_percentage": "number"  // 选区覆盖百分比 (0-100)
  }
]
```

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
  },
  {
    "selected_element": "<input type=\"text\" class=\"form-control\" placeholder=\"Enter your name\" value=\"John Doe\">",
    "selection_coverage_percentage": 91.7
  },
  {
    "selected_element": "<a href=\"/about\" class=\"nav-link active\">About Us</a>",
    "selection_coverage_percentage": 63.4
  }
]
```

## 字段详解

### 1. selected_element
- **描述**: 被选中元素的完整HTML字符串
- **包含信息**:
  - HTML标签类型
  - 所有属性（id, class, href, src等）
  - 元素内容（文本、子元素）
  - 事件处理器（onclick等）
- **示例**: `"<button class=\"btn btn-primary\" onclick=\"addTask()\">Add New Task</button>"`

### 2. selection_coverage_percentage
- **描述**: 用户涂抹区域覆盖该元素的百分比
- **数值范围**: 0.0 - 100.0
- **精度**: 保留一位小数
- **选中条件**: ≥ 50%
- **示例**: `75.5` 表示涂抹区域覆盖了该元素75.5%的面积

## 优势

1. **极简设计**: 只包含最核心的两个信息
2. **直观易懂**: HTML字符串直接显示元素结构
3. **易于处理**: 大模型可以直接理解HTML内容
4. **文件更小**: 减少冗余信息，降低文件大小
5. **信息完整**: HTML字符串包含了元素的所有重要信息

## 使用场景

- 快速识别被选中的元素
- 分析用户选择行为
- 训练大模型理解UI元素
- 生成页面元素报告
- 自动化测试记录
- UI交互分析

## 技术实现

- **选中算法**: 计算涂抹区域与元素的交集面积
- **阈值设定**: 交集面积占元素总面积50%以上才被选中
- **元素过滤**: 自动过滤不可见和零尺寸元素
- **坐标系统**: 使用Canvas坐标系进行计算
- **导出格式**: JSON数组，UTF-8编码

## 文件信息

- **文件扩展名**: `.json`
- **MIME类型**: `application/json`
- **编码**: UTF-8
- **命名规则**: `selected_elements_[时间戳].json`
- **示例文件名**: `selected_elements_1703123456789.json`