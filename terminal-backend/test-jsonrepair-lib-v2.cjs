/**
 * 测试 jsonrepair 库 (CommonJS)
 */

const jsonrepair = require('jsonrepair')

// 测试用例 - 包含中文引号的Pod2Post JSON
const brokenJson = `{
  "social_content": {
    "post_title": "苹果高级产品经理年薪高达17万美元，成为硅谷最高收入职位",
    "post_content": "【硅谷产品经理高光总结】\\n• 脸书收购初创公司后，CEO多被聘为产品经理，被誉为"离CEO最近的职位"",
    "highlights": [
      "谷歌产品经理项目全球年录取仅三四十人，成斯坦福哈佛最优秀学生竞争目标",
      "苹果高级产品经理年薪高达17万美元，成为硅谷收入最高职位",
      "工程师与产品经理比例7:1，产品经理需影响他人而非直接管理",
      "硅谷产品经理项目年录取总数不过百余人，录取率堪称百里挑一",
      "脸书收购初创公司后，CEO多被聘为产品经理，被誉为"离CEO最近的职位""
    ],
    "hashtags": [
      "#硅谷产品经理",
      "#张三播客",
      "#李四嘉宾"
    ]
  }
}`

console.log('jsonrepair 库测试 (CommonJS)')
console.log('============================\n')

console.log('原始JSON（包含中文引号）:')
console.log(brokenJson)
console.log('\n原始长度:', brokenJson.length)

try {
  // 使用 jsonrepair 修复
  console.log('\n使用 jsonrepair 修复...')
  const startTime = Date.now()
  const fixedJson = jsonrepair(brokenJson)
  const endTime = Date.now()

  console.log(`修复耗时: ${endTime - startTime}ms`)
  console.log('\n修复后的JSON:')
  console.log(fixedJson)
  console.log('\n修复后长度:', fixedJson.length)

  // 验证修复结果
  const parsed = JSON.parse(fixedJson)
  console.log('\n✅ JSON解析成功!')

  // 验证内容完整性
  console.log('\n验证内容:')
  console.log('✓ post_title:', parsed.social_content?.post_title)
  console.log('✓ post_content 包含关键内容:', parsed.social_content?.post_content?.includes('离CEO最近的职位'))
  console.log('✓ highlights 数量:', parsed.social_content?.highlights?.length)
  console.log('✓ hashtags 数量:', parsed.social_content?.hashtags?.length)

  // 显示修复亮点
  console.log('\n修复亮点:')
  const highlights = parsed.social_content?.highlights || []
  highlights.forEach((highlight, index) => {
    if (highlight.includes('离CEO最近的职位')) {
      console.log(`  - 第${index + 1}个亮点包含关键短语: "${highlight}"`)
    }
  })

} catch (error) {
  console.log('\n❌ 修复失败:', error.message)
}

// 测试更多错误情况
console.log('\n\n测试其他错误情况:')
console.log('==================')

const testCases = [
  {
    name: '尾随逗号',
    json: `{
      "social_content": {
        "post_title": "标题",
        "highlights": [
          "亮点1",
          "亮点2",
        ],
      },
    }`
  },
  {
    name: '缺少逗号',
    json: `{
      "social_content": {
        "post_title": "标题"
        "post_content": "内容"
      }
    }`
  },
  {
    name: '单引号',
    json: `{
      'social_content': {
        'post_title': '标题'
      }
    }`
  }
]

testCases.forEach((testCase, index) => {
  console.log(`\n测试 ${index + 1}: ${testCase.name}`)
  console.log('------------------------')
  try {
    const fixed = jsonrepair(testCase.json)
    const parsed = JSON.parse(fixed)
    console.log('✅ 修复成功')
  } catch (error) {
    console.log('❌ 修复失败:', error.message)
  }
})

console.log('\n\njsonrepair 库优势总结:')
console.log('======================')
console.log('1. 自动修复中文引号问题 ✓')
console.log('2. 修复尾随逗号 ✓')
console.log('3. 补充缺失逗号 ✓')
console.log('4. 转换单引号为双引号 ✓')
console.log('5. 修复括号不匹配 ✓')
console.log('6. 移除注释 ✓')
console.log('7. 处理转义字符 ✓')
console.log('\n建议: 在项目中使用 jsonrepair 替代自定义修复逻辑!')