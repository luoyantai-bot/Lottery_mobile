# 🎰 澳门六合彩智能分析助手

## Railway 一键部署

### 步骤 1：推送到 GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 步骤 2：Railway 部署
1. 打开 [railway.app](https://railway.app)
2. 点击 **New Project → Deploy from GitHub repo**
3. 选择你的仓库
4. Railway 会自动检测 Python 项目并部署

### 步骤 3：设置环境变量
在 Railway 项目面板中，点击 **Variables**，添加：

| 变量名 | 值 | 必须 |
|--------|-----|------|
| `SILICONFLOW_API_KEY` | `sk-你的密钥` | ✅ |
| `SILICONFLOW_API_URL` | `https://api.siliconflow.cn/v1/chat/completions` | 可选（有默认值） |
| `CACHE_DURATION` | `300` | 可选（缓存秒数） |

### 步骤 4：访问
Railway 会自动分配一个 `xxx.railway.app` 域名，打开即可使用。

---

## 本地开发

```bash
cd server
pip install -r requirements.txt
# 设置环境变量（或直接编辑 config.py）
export SILICONFLOW_API_KEY=sk-xxx
python app.py
# 浏览器打开 http://localhost:5000
```

## 功能模块

- 📋 **开奖大厅** - 最新100期真实开奖记录
- 📈 **数据分析** - 热号冷号/频率图表/波色生肖五行分布
- 🤖 **AI策略助手** - 多维度购买建议 + 自选分析 + 自由对话
- 💰 **庄家助手** - 复式投注风险评估 + AI分析报告
