#!/usr/bin/env node

/**
 * 卡片结构分析脚本 - 无需浏览器
 * 直接分析HTML文件中的卡片元素结构
 */

const fs = require('fs').promises;
const path = require('path');

class CardStructureAnalyzer {
    constructor() {
        this.outputBase = '/mnt/d/work/AI_Terminal/extracted_cards';
        this.timestamp = Date.now();

        // 定义要查找的卡片选择器
        this.cardSelectors = [
            '.tutorial-card',
            '.content-card',
            '.cover-card',
            '.card-container',
            '[class*="card"]'
        ];
    }

    // 分析HTML文件
    async analyzeFile(htmlPath) {
        console.log(`\n📄 分析文件: ${path.basename(htmlPath)}`);
        console.log('='.repeat(50));

        try {
            // 读取HTML内容
            const content = await fs.readFile(htmlPath, 'utf8');

            // 统计信息
            const stats = {
                fileSize: content.length,
                hasImages: false,
                cardClasses: new Set(),
                cardCount: 0,
                patterns: []
            };

            // 查找图片
            const imgMatches = content.match(/<img[^>]*>/gi) || [];
            stats.hasImages = imgMatches.length > 0;
            console.log(`  • 图片数量: ${imgMatches.length}`);

            // 分析卡片类名模式
            console.log('\n  🔍 卡片类名分析:');

            // 查找tutorial-card
            const tutorialCards = (content.match(/class="[^"]*tutorial-card[^"]*"/gi) || []);
            if (tutorialCards.length > 0) {
                console.log(`    ✓ tutorial-card: ${tutorialCards.length} 个`);
                stats.cardClasses.add('tutorial-card');
                stats.cardCount += tutorialCards.length;

                // 提取完整类名
                tutorialCards.slice(0, 3).forEach(match => {
                    const className = match.replace(/class="([^"]*)"/, '$1');
                    console.log(`      - ${className}`);
                });
            }

            // 查找content-card
            const contentCards = (content.match(/class="[^"]*content-card[^"]*"/gi) || []);
            if (contentCards.length > 0) {
                console.log(`    ✓ content-card: ${contentCards.length} 个`);
                stats.cardClasses.add('content-card');
                stats.cardCount += contentCards.length;

                contentCards.slice(0, 3).forEach(match => {
                    const className = match.replace(/class="([^"]*)"/, '$1');
                    console.log(`      - ${className}`);
                });
            }

            // 查找cover-card
            const coverCards = (content.match(/class="[^"]*cover-card[^"]*"/gi) || []);
            if (coverCards.length > 0) {
                console.log(`    ✓ cover-card: ${coverCards.length} 个`);
                stats.cardClasses.add('cover-card');
                stats.cardCount += coverCards.length;

                coverCards.slice(0, 3).forEach(match => {
                    const className = match.replace(/class="([^"]*)"/, '$1');
                    console.log(`      - ${className}`);
                });
            }

            // 查找其他card类
            const otherCards = (content.match(/class="[^"]*\bcard\b[^"]*"/gi) || []);
            const uniqueCardClasses = new Set();
            otherCards.forEach(match => {
                const className = match.replace(/class="([^"]*)"/, '$1');
                if (!className.includes('tutorial-card') &&
                    !className.includes('content-card') &&
                    !className.includes('cover-card')) {
                    uniqueCardClasses.add(className);
                }
            });

            if (uniqueCardClasses.size > 0) {
                console.log(`    ✓ 其他card类: ${uniqueCardClasses.size} 种`);
                Array.from(uniqueCardClasses).slice(0, 5).forEach(className => {
                    console.log(`      - ${className}`);
                });
            }

            // 分析网格容器
            console.log('\n  📊 容器结构分析:');
            const gridContainers = content.match(/class="[^"]*grid[^"]*"/gi) || [];
            if (gridContainers.length > 0) {
                console.log(`    • 网格容器: ${gridContainers.length} 个`);
                gridContainers.slice(0, 3).forEach(match => {
                    const className = match.replace(/class="([^"]*)"/, '$1');
                    console.log(`      - ${className}`);
                });
            }

            // 分析样式特征
            console.log('\n  🎨 样式特征:');
            const hasAspectRatio = content.includes('aspect-ratio');
            const hasFlexbox = content.includes('flex') || content.includes('grid');
            const hasBoxShadow = content.includes('box-shadow') || content.includes('shadow');

            console.log(`    • 使用aspect-ratio: ${hasAspectRatio ? '是' : '否'}`);
            console.log(`    • 使用Flexbox/Grid: ${hasFlexbox ? '是' : '否'}`);
            console.log(`    • 使用阴影效果: ${hasBoxShadow ? '是' : '否'}`);

            // 提取示例HTML片段
            console.log('\n  📝 示例卡片HTML片段:');
            const cardExamples = [];

            // 提取第一个tutorial-card
            const tutorialMatch = content.match(/<div[^>]*class="[^"]*tutorial-card[^"]*"[^>]*>[\s\S]{0,500}/i);
            if (tutorialMatch) {
                const snippet = tutorialMatch[0].substring(0, 200) + '...';
                console.log('\n    [tutorial-card示例]');
                console.log('    ' + snippet.replace(/\n/g, '\n    '));
                cardExamples.push({ type: 'tutorial-card', html: tutorialMatch[0] });
            }

            // 提取第一个content-card
            const contentMatch = content.match(/<div[^>]*class="[^"]*content-card[^"]*"[^>]*>[\s\S]{0,500}/i);
            if (contentMatch) {
                const snippet = contentMatch[0].substring(0, 200) + '...';
                console.log('\n    [content-card示例]');
                console.log('    ' + snippet.replace(/\n/g, '\n    '));
                cardExamples.push({ type: 'content-card', html: contentMatch[0] });
            }

            // 保存分析结果
            await this.saveAnalysis(htmlPath, stats, cardExamples);

            return stats;

        } catch (error) {
            console.error(`  ❌ 分析失败: ${error.message}`);
            return null;
        }
    }

    // 保存分析结果
    async saveAnalysis(htmlPath, stats, examples) {
        await fs.mkdir(this.outputBase, { recursive: true });

        const baseName = path.basename(htmlPath, '.html');
        const analysisPath = path.join(
            this.outputBase,
            `${baseName}_analysis_${this.timestamp}.json`
        );

        const analysis = {
            file: htmlPath,
            timestamp: new Date().toISOString(),
            stats: {
                ...stats,
                cardClasses: Array.from(stats.cardClasses)
            },
            examples: examples.map(ex => ({
                type: ex.type,
                htmlSnippet: ex.html.substring(0, 1000)
            }))
        };

        await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');
        console.log(`\n  💾 分析结果已保存: ${analysisPath}`);

        // 生成JSONL格式（模拟）
        const jsonlPath = path.join(
            this.outputBase,
            `${baseName}_${this.timestamp}.jsonl`
        );

        const jsonlLines = examples.map((ex, index) => {
            return JSON.stringify({
                card_img: `${this.outputBase}/images/card_${this.timestamp}_${String(index).padStart(3, '0')}.png`,
                card_element: ex.html
            });
        });

        if (jsonlLines.length > 0) {
            await fs.writeFile(jsonlPath, jsonlLines.join('\n'), 'utf8');
            console.log(`  💾 JSONL已生成: ${jsonlPath}`);
        }
    }

    // 批量分析
    async analyzeAll(files) {
        console.log('='.repeat(60));
        console.log('🔍 卡片结构分析器（无需浏览器）');
        console.log('='.repeat(60));

        const results = [];

        for (const file of files) {
            try {
                await fs.access(file);
                const stats = await this.analyzeFile(file);
                if (stats) {
                    results.push({
                        file: path.basename(file),
                        cardCount: stats.cardCount,
                        cardTypes: Array.from(stats.cardClasses)
                    });
                }
            } catch (error) {
                console.error(`\n❌ 无法访问文件: ${file}`);
            }
        }

        // 总结
        console.log('\n' + '='.repeat(60));
        console.log('📊 分析总结:');
        console.log('='.repeat(60));

        let totalCards = 0;
        results.forEach(result => {
            console.log(`\n  📄 ${result.file}`);
            console.log(`     • 卡片数量: ${result.cardCount}`);
            console.log(`     • 卡片类型: ${result.cardTypes.join(', ') || '未识别'}`);
            totalCards += result.cardCount;
        });

        console.log(`\n  🎯 总计: ${totalCards} 个卡片`);
        console.log(`  📁 输出目录: ${this.outputBase}`);
        console.log('='.repeat(60));

        return results;
    }
}

// 主函数
async function main() {
    const testFiles = [
        '/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/AI创作趋势/ai_creation_trends_style.html',
        '/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/pod_demo/content_ossurl.html',
        '/mnt/d/work/AI_Terminal/terminal-backend/data/users/default/workspace/card/马斯克/Musk_style.html'
    ];

    const files = process.argv.length > 2 ? process.argv.slice(2) : testFiles;

    const analyzer = new CardStructureAnalyzer();
    await analyzer.analyzeAll(files);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CardStructureAnalyzer;