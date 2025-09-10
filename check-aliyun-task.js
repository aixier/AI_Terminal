#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

const ALIYUN_API_KEY = process.env.ALIYUN_API_KEY;

async function checkTaskStatus(taskId) {
    if (!taskId) {
        console.error('请提供任务ID作为参数');
        console.log('用法: node check-aliyun-task.js <task-id>');
        return;
    }

    console.log(`\n检查阿里云任务状态: ${taskId}`);
    console.log('='.repeat(50));

    try {
        const response = await fetch(
            `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${ALIYUN_API_KEY}`
                }
            }
        );

        console.log(`响应状态: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        console.log('\n响应数据:');
        console.log(JSON.stringify(data, null, 2));

        if (data.output?.task_status) {
            console.log('\n任务状态:', data.output.task_status);
            
            if (data.output.task_status === 'FAILED') {
                console.log('失败原因:', data.output.message || '未知');
                console.log('错误代码:', data.output.code || '无');
            } else if (data.output.task_status === 'SUCCEEDED') {
                console.log('任务成功完成');
                if (data.output.results) {
                    console.log('结果URL:', data.output.results[0]?.transcription_url || '无');
                }
            }
        }

        // 如果有使用量信息
        if (data.usage) {
            console.log('\n使用量信息:');
            console.log(JSON.stringify(data.usage, null, 2));
        }

    } catch (error) {
        console.error('查询失败:', error.message);
    }
}

// 从命令行获取任务ID
const taskId = process.argv[2];
checkTaskStatus(taskId);