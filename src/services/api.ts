import { DrawResult, PredictionSource } from '../utils/constants';

// ==================== 后端 API 配置 ====================
// 如果从 Flask 提供服务（同源），使用相对路径
// 如果本地开发（vite dev），使用 localhost:5000
function getBaseUrl(): string {
  const loc = window.location;
  // 如果是 file:// 协议（双击打开），提示用户
  if (loc.protocol === 'file:') {
    return 'http://localhost:5000';
  }
  // 如果当前就是在 Flask 服务上（端口5000 或同源），用相对路径
  if (loc.port === '5000') {
    return '';
  }
  // 开发模式（vite dev server 通常是 5173）
  return 'http://localhost:5000';
}

const BACKEND_URL = getBaseUrl();

async function apiFetch(path: string, options?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) return resp;
  } catch {
    /* backend unavailable */
  }
  return null;
}

// ==================== 健康检查 ====================
export async function checkBackendHealth(): Promise<{ available: boolean; aiConfigured: boolean }> {
  try {
    const resp = await apiFetch('/api/health');
    if (resp) {
      const data = await resp.json();
      return { available: true, aiConfigured: data.ai_configured };
    }
  } catch { /* ignore */ }
  return { available: false, aiConfigured: false };
}

// ==================== 获取开奖数据 ====================
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateMockDraws(count: number): DrawResult[] {
  const draws: DrawResult[] = [];
  const base = new Date('2025-06-15');
  const rand = seededRandom(20250615);

  for (let i = 0; i < count; i++) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const period = `2025${String(168 - i).padStart(3, '0')}`;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const pool: number[] = [];
    for (let j = 1; j <= 49; j++) pool.push(j);
    const picked: number[] = [];
    for (let j = 0; j < 7; j++) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    draws.push({ period, date: dateStr, numbers: picked.slice(0, 6).sort((a, b) => a - b), special: picked[6] });
  }
  return draws;
}

let cachedDraws: DrawResult[] = [];
let cachedSource = '';

export async function getDrawHistory(forceRefresh = false): Promise<{ draws: DrawResult[]; source: string }> {
  if (cachedDraws.length > 0 && !forceRefresh) return { draws: cachedDraws, source: cachedSource };

  // 尝试后端 API
  const resp = await apiFetch(`/api/draws?count=100&force=${forceRefresh}`);
  if (resp) {
    try {
      const json = await resp.json();
      if (json.success && json.data && json.data.length > 0) {
        cachedDraws = json.data.slice(0, 100);
        cachedSource = json.source || '后端服务 (实时)';
        return { draws: cachedDraws, source: cachedSource };
      }
    } catch { /* parse error */ }
  }

  // 回退到模拟数据
  cachedDraws = generateMockDraws(100);
  cachedSource = '模拟数据（后端未连接）';
  return { draws: cachedDraws, source: cachedSource };
}

// ==================== 获取预测数据 ====================
function generateMockPredictions(): PredictionSource[] {
  const rand = seededRandom(7777);
  const pick = <T,>(arr: T[], n: number): T[] => {
    const s = [...arr]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    return s.slice(0, n);
  };
  const rNums = (n: number) => { const s = new Set<number>(); while (s.size < n) s.add(Math.floor(rand() * 49) + 1); return [...s].sort((a, b) => a - b); };
  const zodiacs = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  const colors: ('red' | 'blue' | 'green')[] = ['red', 'blue', 'green'];

  return [
    { id: 'macaujc', name: '澳门彩票网', url: 'https://macaujc.com', lastUpdated: '2025-06-15 18:30', confidence: 72,
      recommendedNumbers: rNums(8), recommendedZodiacs: pick(zodiacs, 3), recommendedColors: pick(colors, 2),
      analysis: '根据近50期特码走势分析，大号（25-49）出现概率较高，建议关注3头、4头号码。' },
    { id: 'site2', name: '六合宝典', url: 'https://example2.com', lastUpdated: '2025-06-15 17:45', confidence: 68,
      recommendedNumbers: rNums(6), recommendedZodiacs: pick(zodiacs, 4), recommendedColors: pick(colors, 1),
      analysis: '本期推荐关注冷号回补，遗漏值超过15期的号码有较高出现概率。' },
    { id: 'site3', name: '马会资讯网', url: 'https://example3.com', lastUpdated: '2025-06-15 16:20', confidence: 75,
      recommendedNumbers: rNums(7), recommendedZodiacs: pick(zodiacs, 3), recommendedColors: pick(colors, 2),
      analysis: '综合分析近100期数据，特码出现在1-24区间的概率为52%，本期看好小号。' },
    { id: 'site4', name: '港澳研究院', url: 'https://example4.com', lastUpdated: '2025-06-15 19:00', confidence: 65,
      recommendedNumbers: rNums(5), recommendedZodiacs: pick(zodiacs, 2), recommendedColors: pick(colors, 1),
      analysis: '根据独家算法模型，本期特码大概率落在偶数区间。' },
    { id: 'site5', name: '澳彩数据中心', url: 'https://example5.com', lastUpdated: '2025-06-15 15:10', confidence: 70,
      recommendedNumbers: rNums(6), recommendedZodiacs: pick(zodiacs, 3), recommendedColors: pick(colors, 2),
      analysis: '基于概率统计和趋势分析，本期特码波色看好红波和绿波交替。' },
  ];
}

export async function getPredictions(): Promise<{ predictions: PredictionSource[]; fromBackend: boolean }> {
  const resp = await apiFetch('/api/predictions');
  if (resp) {
    try {
      const json = await resp.json();
      if (json.success && json.data && json.data.length > 0) {
        return { predictions: json.data, fromBackend: true };
      }
    } catch { /* parse error */ }
  }
  return { predictions: generateMockPredictions(), fromBackend: false };
}

// ==================== AI 对话 ====================
export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }

export const AI_MODELS = [
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B', free: true },
  { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B', free: true },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B', free: false },
  { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', free: false },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama-3.1-8B', free: true },
];

export async function chatWithAI(
  messages: ChatMessage[],
  model: string
): Promise<string> {
  const resp = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, includeData: true }),
  });

  if (!resp) {
    throw new Error('后端服务未启动，请先运行 python server/app.py');
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || 'AI 请求失败');
  }

  return data.reply || '无法获取回复';
}
