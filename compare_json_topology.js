const fs = require('fs');
const path = require('path');

// 读取两个JSON文件
const file1Path = '/mnt/d/work/AI_Terminal/content (9).json';
const file2Path = '/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/马斯克/Musk_data.json';

const content1 = JSON.parse(fs.readFileSync(file1Path, 'utf8'));
const content2 = JSON.parse(fs.readFileSync(file2Path, 'utf8'));

// 递归获取所有键的路径
function getAllKeyPaths(obj, currentPath = '') {
  let paths = {};

  for (let key in obj) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    const value = obj[key];
    const type = Array.isArray(value) ? 'array' : typeof value;

    paths[fullPath] = {
      type: type,
      depth: fullPath.split('.').length,
      hasChildren: type === 'object' && value !== null && !Array.isArray(value),
      arrayLength: Array.isArray(value) ? value.length : undefined
    };

    if (type === 'object' && value !== null && !Array.isArray(value)) {
      const childPaths = getAllKeyPaths(value, fullPath);
      paths = { ...paths, ...childPaths };
    }
  }

  return paths;
}

// 获取两个文件的所有键路径
const paths1 = getAllKeyPaths(content1);
const paths2 = getAllKeyPaths(content2);

// 找出相同的键
const keys1 = Object.keys(paths1);
const keys2 = Object.keys(paths2);

// 分析相同键的差异
console.log('\n========================================');
console.log('JSON拓扑层级对比分析');
console.log('========================================\n');

console.log('文件1 (content (9).json) 结构概览:');
console.log('  - 顶层键数量:', Object.keys(content1).length);
console.log('  - 总键路径数:', keys1.length);
console.log('  - 最大深度:', Math.max(...keys1.map(k => paths1[k].depth)));

console.log('\n文件2 (Musk_data.json) 结构概览:');
console.log('  - 顶层键数量:', Object.keys(content2).length);
console.log('  - 总键路径数:', keys2.length);
console.log('  - 最大深度:', Math.max(...keys2.map(k => paths2[k].depth)));

// 寻找相同的键名（忽略路径）
const keyNames1 = new Set(keys1.map(k => k.split('.').pop()));
const keyNames2 = new Set(keys2.map(k => k.split('.').pop()));
const commonKeyNames = [...keyNames1].filter(k => keyNames2.has(k));

console.log('\n========================================');
console.log('相同键名的拓扑层级差异:');
console.log('========================================\n');

// 对每个相同的键名，找出它们在两个文件中的所有出现位置
commonKeyNames.sort().forEach(keyName => {
  const occurrences1 = keys1.filter(k => k.split('.').pop() === keyName);
  const occurrences2 = keys2.filter(k => k.split('.').pop() === keyName);

  if (occurrences1.length > 0 || occurrences2.length > 0) {
    console.log(`\n键名: "${keyName}"`);
    console.log('─'.repeat(40));

    console.log('在 content (9).json 中:');
    if (occurrences1.length === 0) {
      console.log('  [不存在]');
    } else {
      occurrences1.forEach(path => {
        const info = paths1[path];
        console.log(`  路径: ${path}`);
        console.log(`    - 深度: ${info.depth}`);
        console.log(`    - 类型: ${info.type}`);
        if (info.arrayLength !== undefined) {
          console.log(`    - 数组长度: ${info.arrayLength}`);
        }
      });
    }

    console.log('在 Musk_data.json 中:');
    if (occurrences2.length === 0) {
      console.log('  [不存在]');
    } else {
      occurrences2.forEach(path => {
        const info = paths2[path];
        console.log(`  路径: ${path}`);
        console.log(`    - 深度: ${info.depth}`);
        console.log(`    - 类型: ${info.type}`);
        if (info.arrayLength !== undefined) {
          console.log(`    - 数组长度: ${info.arrayLength}`);
        }
      });
    }
  }
});

// 特别分析 metadata 相关的差异
console.log('\n========================================');
console.log('特殊分析: metadata 相关键的层级差异');
console.log('========================================\n');

// content (9).json 中的 metadata
if (content1.social_content && content1.social_content.metadata) {
  console.log('content (9).json 中的 metadata:');
  console.log('  位置: social_content.metadata (深度2)');
  console.log('  内容:', JSON.stringify(content1.social_content.metadata, null, 2));
}

// Musk_data.json 中的 meta
if (content2.meta) {
  console.log('\nMusk_data.json 中的 meta:');
  console.log('  位置: meta (深度1)');
  console.log('  主要字段:', Object.keys(content2.meta).join(', '));
}

// 分析 content 键的差异
console.log('\n========================================');
console.log('特殊分析: content 键的结构差异');
console.log('========================================\n');

// content (9).json 中的 content
if (content1.social_content) {
  console.log('content (9).json:');
  console.log('  - post_content: 字符串类型');
  console.log('  - 位于: social_content.post_content');
  console.log('  - 内容长度:', content1.social_content.post_content?.length || 0, '字符');
}

// Musk_data.json 中的 content
console.log('\nMusk_data.json:');
console.log('  - content: 数组类型');
console.log('  - 出现在每个 card 对象中');
const cardContents = content2.cards?.filter(card => card.content) || [];
console.log('  - 包含content的卡片数:', cardContents.length);
if (cardContents.length > 0) {
  console.log('  - 第一个content数组长度:', cardContents[0].content.length);
}

console.log('\n========================================');
console.log('分析完成');
console.log('========================================');