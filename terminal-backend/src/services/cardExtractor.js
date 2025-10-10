/**
 * 智能卡片提取服务
 * 自动识别HTML中的卡片元素并截图
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CardExtractorService {
    constructor() {
        // 输出目录配置
        this.outputBase = path.join(__dirname, '../data/extracted_cards');
        this.tempDir = path.join(__dirname, '../data/temp');

        // Chrome配置（Docker环境）
        this.chromePath = process.env.CHROME_BIN || '/usr/bin/chromium-browser';

        // 卡片识别规则
        this.cardPatterns = {
            // 类名模式（优先级从高到低）
            classPatterns: [
                { pattern: /^tutorial-card$/, weight: 1.0 },
                { pattern: /^content-card$/, weight: 1.0 },
                { pattern: /^cover-card$/, weight: 1.0 },
                { pattern: /^card-container$/, weight: 0.9 },
                // 添加Pod2Post常用的卡片样式
                { pattern: /\bstyle[1-5]\b/i, weight: 0.8 },
                { pattern: /\bstyle\d+-\w+/i, weight: 0.8 },
                { pattern: /\bcard\b/i, weight: 0.7 },
                { pattern: /\bpanel\b/i, weight: 0.5 },
                { pattern: /\btile\b/i, weight: 0.5 },
                { pattern: /\bitem\b/i, weight: 0.4 }
            ],

            // 结构特征
            structuralFeatures: {
                minWidth: 200,
                minHeight: 250,
                maxWidth: 800,
                maxHeight: 1200,
                aspectRatios: [
                    { ratio: 0.75, tolerance: 0.1 },  // 3:4
                    { ratio: 1.33, tolerance: 0.1 },  // 4:3
                    { ratio: 1.0, tolerance: 0.1 },   // 1:1
                    { ratio: 1.77, tolerance: 0.15 }  // 16:9
                ]
            }
        };
    }

    /**
     * 初始化服务
     */
    async initialize() {
        // 创建必要的目录
        await fs.mkdir(this.outputBase, { recursive: true });
        await fs.mkdir(path.join(this.outputBase, 'images'), { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
    }

    /**
     * 从HTML内容提取卡片
     * @param {string} htmlContent - HTML内容
     * @param {string} fileName - 原始文件名
     * @returns {Promise<Object>} 提取结果
     */
    async extractFromHTML(htmlContent, fileName = 'upload.html') {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const timestamp = Date.now();

        let browser;
        let tempHtmlPath;

        try {
            // 保存HTML到临时文件
            tempHtmlPath = path.join(this.tempDir, `${sessionId}_${fileName}`);
            await fs.writeFile(tempHtmlPath, htmlContent, 'utf8');

            // 启动浏览器
            browser = await this.launchBrowser();
            const page = await browser.newPage();

            // 设置视口（降低像素比以减少资源消耗）
            await page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1  // 降低像素比
            });

            // 注入字体样式以确保中文显示
            await page.addStyleTag({
                content: `
                    * {
                        font-family: 'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC',
                                     'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif !important;
                    }
                `
            });

            // 设置更长的默认导航超时（适应慢速OSS访问）
            page.setDefaultNavigationTimeout(300000); // 5分钟
            page.setDefaultTimeout(300000); // 5分钟

            // 设置页面的额外HTTP头，可能有助于OSS资源加载
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            });

            // 增加页面的资源加载设置
            await page.setBypassCSP(true);  // 绕过CSP限制

            // 监听页面的console输出
            page.on('console', msg => console.log('[Browser Console]:', msg.text()));

            // 监听页面错误
            page.on('pageerror', err => console.log('[Page Error]:', err.message));

            // 监听请求失败
            page.on('requestfailed', request => {
                console.log('[Request Failed]:', request.url(), request.failure().errorText);
            });

            console.log('[CardExtractor] Starting page load...');

            // 加载HTML - 使用更宽松的策略
            try {
                await page.goto(`file://${tempHtmlPath}`, {
                    waitUntil: 'domcontentloaded',  // 只等待DOM加载
                    timeout: 30000  // 30秒超时
                });
                console.log('[CardExtractor] DOM loaded successfully');

                // 等待图片加载，但设置合理的超时
                const imageLoadResult = await Promise.race([
                    page.evaluate(() => {
                        return new Promise((resolve) => {
                            const images = Array.from(document.images);
                            const totalImages = images.length;

                            console.log(`Total images found: ${totalImages}`);

                            if (totalImages === 0) {
                                resolve({ total: 0, loaded: 0, errors: 0 });
                                return;
                            }

                            let checkCount = 0;
                            const maxChecks = 120; // 增加到120次（120秒），给予充足的图片加载时间

                            const checkStatus = () => {
                                checkCount++;
                                const currentLoaded = images.filter(img => img.complete && img.naturalHeight > 0).length;
                                const currentErrors = images.filter(img => img.complete && img.naturalHeight === 0).length;

                                console.log(`Check ${checkCount}: ${currentLoaded} loaded, ${currentErrors} failed, ${totalImages - currentLoaded - currentErrors} pending`);

                                // 如果所有图片都处理完，或已加载80%（提高要求确保完整加载），或检查次数达到上限
                                // 对于OSS图片，等待大部分加载完成
                                if (currentLoaded + currentErrors >= totalImages ||
                                    currentLoaded >= totalImages * 0.8 ||
                                    checkCount >= maxChecks) {
                                    resolve({ total: totalImages, loaded: currentLoaded, errors: currentErrors });
                                } else {
                                    setTimeout(checkStatus, 1000);
                                }
                            };

                            // 立即检查一次
                            checkStatus();
                        });
                    }),
                    // 强制超时保护（增加到120秒，确保图片有足够时间加载）
                    new Promise((resolve) => {
                        setTimeout(() => {
                            console.log('[CardExtractor] Force timeout after 120 seconds - proceeding with card detection');
                            resolve({ total: -1, loaded: -1, errors: -1, timeout: true });
                        }, 120000);
                    })
                ]);

                console.log(`[CardExtractor] Image load result:`, imageLoadResult);

            } catch (err) {
                console.log('[CardExtractor] Page load error:', err.message);
            }

            // 等待更长时间确保渲染完成（特别是对于包含大量图片的页面）
            console.log('[CardExtractor] Waiting for rendering...');
            await new Promise(resolve => setTimeout(resolve, 5000));  // 增加到5秒
            console.log('[CardExtractor] Rendering wait complete, proceeding to card detection...');

            // 识别卡片
            console.log('[CardExtractor] Starting card detection...');

            let cardsData;
            try {
                // 使用超时包装evaluate
                cardsData = await Promise.race([
                    page.evaluate((patterns) => {
                        console.log('[Card Detection] Starting simplified evaluation...');
                        const candidates = [];

                        // 只查找最具体的选择器（包含Pod2Post的卡片类型）
                        const cardElements = document.querySelectorAll('.card-container, .tutorial-card, .content-card, .cover-card');
                        console.log(`[Card Detection] Found ${cardElements.length} card elements with primary selectors`);

                        // 如果没找到，尝试更通用的选择器
                        let elements = Array.from(cardElements);
                        if (elements.length === 0) {
                            elements = Array.from(document.querySelectorAll('[class*="card"]')).slice(0, 20); // 限制数量
                            console.log(`[Card Detection] Using fallback selector, found ${elements.length} elements`);
                        }

                        elements.forEach(element => {
                            // 跳过不可见元素
                            const style = window.getComputedStyle(element);
                            if (style.display === 'none' ||
                                style.visibility === 'hidden' ||
                                parseFloat(style.opacity) === 0) {
                                return;
                            }

                            // 跳过特定标签
                            if (['BODY', 'HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META'].includes(element.tagName)) {
                                return;
                            }

                            const rect = element.getBoundingClientRect();

                            // 跳过太小的元素（但保留合理的卡片尺寸）
                            if (rect.width < 100 || rect.height < 100) {
                                // 特殊处理：如果类名明确包含card，降低尺寸要求
                                if (!/card|cover|content/i.test(element.className)) {
                                    return;
                                }
                            }

                            // 计算得分
                            let score = 0;
                            const className = element.className || '';

                            // 类名匹配
                            patterns.classPatterns.forEach(rule => {
                                const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
                                if (pattern.test(className)) {
                                    score += rule.weight * 40;
                                }
                            });

                            // 尺寸检查
                            if (rect.width >= patterns.structuralFeatures.minWidth &&
                                rect.height >= patterns.structuralFeatures.minHeight &&
                                rect.width <= patterns.structuralFeatures.maxWidth &&
                                rect.height <= patterns.structuralFeatures.maxHeight) {
                                score += 20;
                            }

                            // 内容检查
                            if (element.children.length > 0) score += 10;
                            if (element.textContent.trim().length > 20) score += 10;
                            if (element.querySelector('img')) score += 5;
                            if (element.querySelector('h1, h2, h3, h4, h5, h6')) score += 5;

                            if (score >= 25) {  // 降低阈值，提高检测灵敏度
                                candidates.push({
                                    score: score,
                                    className: className,
                                    tagName: element.tagName,
                                    rect: {
                                        x: rect.x,
                                        y: rect.y,
                                        width: rect.width,
                                        height: rect.height
                                    },
                                    html: element.outerHTML,
                                    hasImage: !!element.querySelector('img'),
                                    hasTitle: !!element.querySelector('h1, h2, h3, h4, h5, h6'),
                                    textLength: element.textContent.trim().length
                                });
                            }
                        });

                    // 排序
                    candidates.sort((a, b) => b.score - a.score);

                    // 限制最多处理前15个卡片（确保能提取所有11张卡片）
                    const topCandidates = candidates.slice(0, 15);

                    // 去重（去除嵌套的元素）
                    const filtered = [];
                    topCandidates.forEach(candidate => {
                        let isNested = false;
                        for (const existing of filtered) {
                            if (candidate.rect.x >= existing.rect.x &&
                                candidate.rect.y >= existing.rect.y &&
                                (candidate.rect.x + candidate.rect.width) <= (existing.rect.x + existing.rect.width) &&
                                (candidate.rect.y + candidate.rect.height) <= (existing.rect.y + existing.rect.height) &&
                                candidate !== existing) {
                                isNested = true;
                                break;
                            }
                        }
                        if (!isNested) {
                            filtered.push(candidate);
                        }
                    });

                    console.log(`[Card Detection] Found ${filtered.length} cards after filtering`);
                    return filtered;
                }, this.cardPatterns),
                    // 120秒超时保护（给予充足时间处理复杂页面和大量图片）
                    new Promise((resolve) => {
                        setTimeout(() => {
                            console.log('[CardExtractor] Card detection timeout after 120 seconds');
                            resolve([]);
                        }, 120000);
                    })
                ]);
            } catch (err) {
                console.log('[CardExtractor] Card detection error:', err.message);
                cardsData = [];
            }

            // 截图并保存每个卡片
            const results = [];
            for (let i = 0; i < cardsData.length; i++) {
                const card = cardsData[i];

                // 生成文件名
                const imageFileName = `card_${timestamp}_${sessionId}_${String(i).padStart(3, '0')}.png`;
                const imagePath = path.join(this.outputBase, 'images', imageFileName);

                // 截图
                await page.screenshot({
                    path: imagePath,
                    clip: {
                        x: card.rect.x,
                        y: card.rect.y,
                        width: card.rect.width,
                        height: card.rect.height
                    }
                });

                // 构建结果
                results.push({
                    card_img: imagePath,
                    card_element: card.html
                });
            }

            await browser.close();

            // 删除临时文件
            await fs.unlink(tempHtmlPath).catch(() => {});

            return {
                success: true,
                sessionId: sessionId,
                timestamp: timestamp,
                fileName: fileName,
                cardsCount: results.length,
                cards: results
            };

        } catch (error) {
            if (browser) await browser.close();
            if (tempHtmlPath) await fs.unlink(tempHtmlPath).catch(() => {});

            throw new Error(`卡片提取失败: ${error.message}`);
        }
    }

    /**
     * 启动浏览器
     */
    async launchBrowser() {
        const options = {
            headless: 'new',  // 使用新的 headless 模式
            protocolTimeout: 300000,  // 增加协议超时到5分钟
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-background-networking',
                '--disable-sync',
                '--metrics-recording-only',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080',
                '--start-maximized',
                // Docker 容器特定参数
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                // 增加内存和资源限制以避免ERR_INSUFFICIENT_RESOURCES
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--max-http-connections=100',
                '--max-http-connections-per-host=32',  // 增加每个主机的连接数
                // 增加资源限制和网络优化，解决ERR_INSUFFICIENT_RESOURCES
                '--max-old-space-size=4096',  // 增加V8堆内存到4GB
                '--js-flags=--max-old-space-size=4096',
                '--disable-features=IsolateOrigins',  // 允许跨域
                '--disable-site-isolation-trials',
                '--disable-web-security',  // 允许跨域资源
                '--allow-running-insecure-content',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--aggressive-cache-discard',
                '--disable-blink-features=AutomationControlled'  // 避免被检测为自动化
            ],
            // 添加更多配置以确保在容器中正常运行
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        };

        // 检查是否在 Docker 容器中运行
        let isDocker = process.env.DOCKER_ENV === 'true';
        try {
            await fs.access('/.dockerenv');
            isDocker = true;
        } catch {
            // 不在 Docker 中
        }

        // 优先使用环境变量中的路径
        if (process.env.CHROME_BIN) {
            options.executablePath = process.env.CHROME_BIN;
            console.log(`[CardExtractor] Using Chrome from env: ${process.env.CHROME_BIN}`);
        } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log(`[CardExtractor] Using Chrome from Puppeteer env: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        } else {
            // 尝试检测 Chrome/Chromium 路径
            const possiblePaths = [
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                this.chromePath
            ];

            for (const chromePath of possiblePaths) {
                try {
                    await fs.access(chromePath);
                    options.executablePath = chromePath;
                    console.log(`[CardExtractor] Found Chrome at: ${chromePath}`);
                    break;
                } catch {
                    // 继续尝试下一个路径
                }
            }
        }

        if (!options.executablePath) {
            console.warn('[CardExtractor] No Chrome executable found, using Puppeteer default');
        }

        try {
            console.log('[CardExtractor] Launching browser with options:', {
                ...options,
                args: options.args.slice(0, 5) + '...'  // 只显示前5个参数
            });

            const browser = await puppeteer.launch(options);
            console.log('[CardExtractor] Browser launched successfully');
            return browser;
        } catch (error) {
            console.error('[CardExtractor] Failed to launch browser:', error.message);

            // 如果失败，尝试最小配置
            console.log('[CardExtractor] Retrying with minimal configuration...');
            const minimalOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: options.executablePath
            };

            return await puppeteer.launch(minimalOptions);
        }
    }

    /**
     * 生成JSONL格式输出
     * @param {Array} cards - 卡片数组
     * @returns {string} JSONL格式字符串
     */
    generateJSONL(cards) {
        return cards.map(card => JSON.stringify(card)).join('\n');
    }

    /**
     * 保存结果到文件
     * @param {Object} result - 提取结果
     * @returns {Promise<string>} JSONL文件路径
     */
    async saveResults(result) {
        const jsonlFileName = `cards_${result.timestamp}_${result.sessionId}.jsonl`;
        const jsonlPath = path.join(this.outputBase, jsonlFileName);

        const jsonlContent = this.generateJSONL(result.cards);
        await fs.writeFile(jsonlPath, jsonlContent, 'utf8');

        return jsonlPath;
    }

    /**
     * 清理旧文件
     * @param {number} maxAge - 最大保留时间（毫秒）
     */
    async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) {  // 默认24小时
        const now = Date.now();

        // 清理图片
        const imageDir = path.join(this.outputBase, 'images');
        const images = await fs.readdir(imageDir);

        for (const image of images) {
            const filePath = path.join(imageDir, image);
            const stats = await fs.stat(filePath);
            if (now - stats.mtime.getTime() > maxAge) {
                await fs.unlink(filePath).catch(() => {});
            }
        }

        // 清理JSONL文件
        const jsonlFiles = await fs.readdir(this.outputBase);
        for (const file of jsonlFiles) {
            if (file.endsWith('.jsonl')) {
                const filePath = path.join(this.outputBase, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath).catch(() => {});
                }
            }
        }
    }
}

export default CardExtractorService;