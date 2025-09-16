/**
 * 卡片提取API路由
 * 提供HTML上传和卡片提取功能
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import CardExtractorService from '../services/cardExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 初始化服务
const cardExtractor = new CardExtractorService();
cardExtractor.initialize().catch(console.error);

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024  // 限制10MB
    },
    fileFilter: (req, file, cb) => {
        // 只接受HTML文件
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.html' || ext === '.htm') {
            cb(null, true);
        } else {
            cb(new Error('只支持HTML文件'), false);
        }
    }
});

/**
 * POST /api/extract-cards
 * 上传HTML文件并提取卡片
 */
router.post('/extract-cards', upload.single('html'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请上传HTML文件'
            });
        }

        // 获取HTML内容
        const htmlContent = req.file.buffer.toString('utf8');
        const fileName = req.file.originalname;

        console.log(`[CardExtractor] 开始处理文件: ${fileName}`);

        // 提取卡片
        const result = await cardExtractor.extractFromHTML(htmlContent, fileName);

        // 生成JSONL
        const jsonlContent = cardExtractor.generateJSONL(result.cards);

        // 根据请求参数决定返回格式
        const responseFormat = req.query.format || 'json';

        if (responseFormat === 'jsonl') {
            // 直接返回JSONL格式
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Content-Disposition', `attachment; filename="cards_${result.sessionId}.jsonl"`);
            res.send(jsonlContent);
        } else {
            // 返回JSON格式，包含元信息
            res.json({
                success: true,
                sessionId: result.sessionId,
                timestamp: result.timestamp,
                fileName: fileName,
                cardsCount: result.cardsCount,
                cards: result.cards,
                jsonl: jsonlContent
            });
        }

        console.log(`[CardExtractor] 成功提取 ${result.cardsCount} 个卡片`);

    } catch (error) {
        console.error('[CardExtractor] 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/extract-cards-raw
 * 直接POST HTML内容（不通过文件上传）
 */
router.post('/extract-cards-raw', express.text({ limit: '10mb', type: 'text/html' }), async (req, res) => {
    try {
        const htmlContent = req.body;

        if (!htmlContent) {
            return res.status(400).json({
                success: false,
                error: '请提供HTML内容'
            });
        }

        const fileName = req.headers['x-filename'] || 'upload.html';

        console.log(`[CardExtractor] 开始处理原始HTML: ${fileName}`);

        // 提取卡片
        const result = await cardExtractor.extractFromHTML(htmlContent, fileName);

        // 生成JSONL
        const jsonlContent = cardExtractor.generateJSONL(result.cards);

        // 根据请求参数决定返回格式
        const responseFormat = req.query.format || 'json';

        if (responseFormat === 'jsonl') {
            // 直接返回JSONL格式
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Content-Disposition', `attachment; filename="cards_${result.sessionId}.jsonl"`);
            res.send(jsonlContent);
        } else {
            // 返回JSON格式
            res.json({
                success: true,
                sessionId: result.sessionId,
                timestamp: result.timestamp,
                fileName: fileName,
                cardsCount: result.cardsCount,
                cards: result.cards,
                jsonl: jsonlContent
            });
        }

        console.log(`[CardExtractor] 成功提取 ${result.cardsCount} 个卡片`);

    } catch (error) {
        console.error('[CardExtractor] 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/extract-cards/health
 * 健康检查 - 必须在带参数的路由之前定义
 */
router.get('/extract-cards/health', async (req, res) => {
    try {
        // 测试Chrome是否可用
        const browser = await cardExtractor.launchBrowser();
        await browser.close();

        res.json({
            success: true,
            status: 'healthy',
            chromePath: cardExtractor.chromePath
        });

    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * DELETE /api/extract-cards/cleanup
 * 清理旧文件
 */
router.delete('/extract-cards/cleanup', async (req, res) => {
    try {
        const maxAge = parseInt(req.query.maxAge) || 24 * 60 * 60 * 1000;  // 默认24小时
        await cardExtractor.cleanupOldFiles(maxAge);

        res.json({
            success: true,
            message: `已清理超过 ${maxAge / 1000 / 60 / 60} 小时的文件`
        });

    } catch (error) {
        console.error('[CardExtractor] 清理失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/extract-cards/:sessionId/images/:imageFile
 * 获取卡片截图
 */
router.get('/extract-cards/:sessionId/images/:imageFile', async (req, res) => {
    try {
        const { imageFile } = req.params;

        // 安全检查：只允许访问PNG文件
        if (!imageFile.endsWith('.png')) {
            return res.status(403).json({
                success: false,
                error: '无效的文件类型'
            });
        }

        const imagePath = path.join(__dirname, '../data/extracted_cards/images', imageFile);

        // 检查文件是否存在
        await fs.access(imagePath);

        // 发送图片
        res.sendFile(imagePath);

    } catch (error) {
        console.error('[CardExtractor] 错误:', error);
        res.status(404).json({
            success: false,
            error: '图片不存在'
        });
    }
});

/**
 * GET /api/extract-cards/:sessionId
 * 获取之前提取的结果 - 必须在所有具体路径之后定义
 */
router.get('/extract-cards/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // 查找JSONL文件
        const outputDir = path.join(__dirname, '../data/extracted_cards');
        const files = await fs.readdir(outputDir);
        const jsonlFile = files.find(f => f.includes(sessionId) && f.endsWith('.jsonl'));

        if (!jsonlFile) {
            return res.status(404).json({
                success: false,
                error: '未找到提取结果'
            });
        }

        const jsonlPath = path.join(outputDir, jsonlFile);
        const jsonlContent = await fs.readFile(jsonlPath, 'utf8');

        // 解析JSONL
        const cards = jsonlContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));

        const responseFormat = req.query.format || 'json';

        if (responseFormat === 'jsonl') {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Content-Disposition', `attachment; filename="${jsonlFile}"`);
            res.send(jsonlContent);
        } else {
            res.json({
                success: true,
                sessionId: sessionId,
                cardsCount: cards.length,
                cards: cards,
                jsonl: jsonlContent
            });
        }

    } catch (error) {
        console.error('[CardExtractor] 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;