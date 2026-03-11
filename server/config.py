# -*- coding: utf-8 -*-
"""配置文件 - Railway 部署版
在 Railway 面板的 Variables 中设置环境变量：
  SILICONFLOW_API_KEY=sk-xxx
"""

import os

# ============================================================
# 硅基流动 API 配置（从环境变量读取）
# ============================================================
SILICONFLOW_API_KEY = os.environ.get('SILICONFLOW_API_KEY', 'your_api_key_here')
SILICONFLOW_API_URL = os.environ.get('SILICONFLOW_API_URL', 'https://api.siliconflow.cn/v1/chat/completions')

# ============================================================
# AI 模型列表
# ============================================================
AI_MODELS = [
    {"id": "Qwen/Qwen2.5-7B-Instruct", "name": "Qwen2.5-7B", "free": True},
    {"id": "Pro/zai-org/GLM-4.7", "name": "GLM-4.7", "free": False},
    {"id": "moonshotai/Kimi-K2-Thinking", "name": "Kimi-K2", "free": False},
    {"id": "deepseek-ai/DeepSeek-V3.2", "name": "DeepSeek-V3.2", "free": False},
    {"id": "Pro/MiniMaxAI/MiniMax-M2.5", "name": "MiniMax-M2.5", "free": False},
    {"id": "Qwen/Qwen3-VL-32B-Instruct", "name": "Qwen3-VL", "free": False},
]

# ============================================================
# 数据源配置（只需要 history API，无需先获取最新期号）
# ============================================================
HISTORY_API_BASE = 'https://history.macaumarksix.com/history/macaujc2/expect/'
MACAUJC_API_URL = 'https://api.macaujc.org/api/opencode/2032'

# ============================================================
# 农历新年日期（用于动态计算生肖）
# ============================================================
CNY_DATES = {
    2020: (1, 25),   # 鼠
    2021: (2, 12),   # 牛
    2022: (2, 1),    # 虎
    2023: (1, 22),   # 兔
    2024: (2, 10),   # 龙
    2025: (1, 29),   # 蛇
    2026: (2, 17),   # 马
    2027: (2, 6),    # 羊
    2028: (1, 26),   # 猴
    2029: (2, 13),   # 鸡
    2030: (2, 3),    # 狗
    2031: (1, 23),   # 猪
    2032: (2, 11),   # 鼠
}

# ============================================================
# 服务配置
# ============================================================
SERVER_PORT = int(os.environ.get('PORT', 5000))
CACHE_DURATION = int(os.environ.get('CACHE_DURATION', 300))
REQUEST_TIMEOUT = 20
REQUEST_RETRIES = 3
MAX_DRAWS = 100
CONCURRENT_WORKERS = 10
DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'
