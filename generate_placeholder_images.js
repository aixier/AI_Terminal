#!/usr/bin/env node

/**
 * 生成占位图片的脚本
 * 为已识别的卡片创建占位图片文件
 * 用于验证流程，实际截图需要浏览器环境
 */

const fs = require('fs').promises;
const path = require('path');

class PlaceholderImageGenerator {
    constructor() {
        this.outputBase = '/mnt/d/work/AI_Terminal/extracted_cards';
        this.imageDir = path.join(this.outputBase, 'images');
    }

    // 创建一个简单的SVG占位图
    createPlaceholderSVG(width, height, text, index) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
    <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="24" fill="#666" text-anchor="middle">
        卡片 #${index + 1}
    </text>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#999" text-anchor="middle">
        ${text}
    </text>
    <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="14" fill="#999" text-anchor="middle">
        ${width} × ${height}
    </text>
    <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="12" fill="#ccc" text-anchor="middle">
        占位图片 - 需要浏览器环境生成实际截图
    </text>
</svg>`;
    }

    // 分析JSONL文件并生成占位图
    async processJSONL(jsonlFile) {
        const baseName = path.basename(jsonlFile, '.jsonl');
        console.log(`\n📄 处理: ${baseName}`);

        try {
            // 读取JSONL文件
            const content = await fs.readFile(jsonlFile, 'utf8');

            // 解析JSONL（可能是单行JSON）
            let cards = [];
            try {
                // 尝试作为单个JSON解析
                cards = [JSON.parse(content)];
            } catch {
                // 尝试作为多行JSONL解析
                const lines = content.split('\n').filter(line => line.trim());
                cards = lines.map(line => JSON.parse(line));
            }

            console.log(`  找到 ${cards.length} 个卡片`);

            // 为每个卡片生成占位图
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const imagePath = card.card_img;
                const fileName = path.basename(imagePath);

                // 从HTML提取卡片类型
                let cardType = 'unknown';
                if (card.card_element.includes('tutorial-card')) {
                    cardType = 'tutorial-card';
                } else if (card.card_element.includes('content-card')) {
                    cardType = 'content-card';
                } else if (card.card_element.includes('cover-card')) {
                    cardType = 'cover-card';
                }

                // 根据卡片类型设置尺寸
                let width = 375;
                let height = 500;
                if (cardType === 'cover-card') {
                    width = 375;
                    height = 500;
                }

                // 创建SVG内容
                const svgContent = this.createPlaceholderSVG(width, height, cardType, i);

                // 保存SVG文件（临时，用作占位）
                const svgPath = path.join(this.imageDir, fileName.replace('.png', '.svg'));
                await fs.writeFile(svgPath, svgContent, 'utf8');

                console.log(`    ✓ 生成占位图: ${fileName.replace('.png', '.svg')}`);
            }

            return cards.length;

        } catch (error) {
            console.error(`  ❌ 处理失败: ${error.message}`);
            return 0;
        }
    }

    // 主执行方法
    async generate() {
        console.log('='.repeat(60));
        console.log('🖼️  占位图片生成器');
        console.log('='.repeat(60));

        // 创建图片目录
        await fs.mkdir(this.imageDir, { recursive: true });
        console.log(`\n✓ 创建目录: ${this.imageDir}`);

        // 查找所有JSONL文件
        const files = await fs.readdir(this.outputBase);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        console.log(`\n找到 ${jsonlFiles.length} 个JSONL文件`);

        let totalImages = 0;

        // 处理每个JSONL文件
        for (const jsonlFile of jsonlFiles) {
            const fullPath = path.join(this.outputBase, jsonlFile);
            const count = await this.processJSONL(fullPath);
            totalImages += count;
        }

        // 列出生成的文件
        console.log('\n' + '='.repeat(60));
        console.log('📊 生成完成');
        console.log('='.repeat(60));

        const imageFiles = await fs.readdir(this.imageDir);
        console.log(`\n✅ 已生成 ${imageFiles.length} 个占位图片`);
        console.log(`📁 位置: ${this.imageDir}`);

        if (imageFiles.length > 0) {
            console.log('\n生成的文件：');
            for (const file of imageFiles.slice(0, 5)) {
                console.log(`  • ${file}`);
            }
            if (imageFiles.length > 5) {
                console.log(`  ... 还有 ${imageFiles.length - 5} 个文件`);
            }
        }

        console.log('\n⚠️  注意：这些是SVG占位图片');
        console.log('    实际的PNG截图需要使用Puppeteer或Playwright生成');
        console.log('='.repeat(60));
    }
}

// 创建真实大小的占位PNG（使用Node.js Canvas）
async function createPNGPlaceholder() {
    console.log('\n尝试创建PNG占位图...');

    try {
        // 尝试使用canvas包（如果已安装）
        const { createCanvas } = require('canvas');

        const canvas = createCanvas(375, 500);
        const ctx = canvas.getContext('2d');

        // 绘制背景
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 375, 500);

        // 绘制边框
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(1, 1, 373, 498);

        // 绘制文字
        ctx.fillStyle = '#666';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('占位图片', 187, 250);

        return canvas.toBuffer('image/png');

    } catch (e) {
        console.log('  Canvas包未安装，使用SVG占位图');
        console.log('  如需PNG格式，请安装: npm install canvas');
        return null;
    }
}

// 主函数
async function main() {
    const generator = new PlaceholderImageGenerator();

    try {
        await generator.generate();

        // 尝试创建一个示例PNG
        const pngBuffer = await createPNGPlaceholder();
        if (pngBuffer) {
            const examplePath = path.join(generator.imageDir, 'example.png');
            await fs.writeFile(examplePath, pngBuffer);
            console.log('\n✓ 创建示例PNG: example.png');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PlaceholderImageGenerator;