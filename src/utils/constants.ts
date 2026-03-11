// ==================== Types ====================
export interface DrawResult {
  period: string;
  date: string;
  numbers: number[];
  special: number;
}

export interface PredictionSource {
  id: string;
  name: string;
  url: string;
  lastUpdated: string;
  confidence: number;
  recommendedNumbers: number[];
  recommendedZodiacs: string[];
  recommendedColors: ('red' | 'blue' | 'green')[];
  analysis: string;
}

export interface AnalysisData {
  frequency: Map<number, number>;
  specialFrequency: Map<number, number>;
  colorStats: { red: number; blue: number; green: number };
  zodiacStats: Map<string, number>;
  elementStats: Map<string, number>;
  headStats: Map<number, number>;
  tailStats: Map<number, number>;
  missingCounts: Map<number, number>;
}

// ==================== Color Mapping ====================
const RED_NUMS = [1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46];
const BLUE_NUMS = [3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48];
const GREEN_NUMS = [5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49];

export const COLOR_MAP: Record<number, 'red' | 'blue' | 'green'> = {};
RED_NUMS.forEach(n => COLOR_MAP[n] = 'red');
BLUE_NUMS.forEach(n => COLOR_MAP[n] = 'blue');
GREEN_NUMS.forEach(n => COLOR_MAP[n] = 'green');

// ==================== 2025 Zodiac Mapping (蛇年) ====================
export const ZODIAC_MAP: Record<number, string> = {};
const ZODIAC_SEQ = ['蛇','龙','兔','虎','牛','鼠','猪','狗','鸡','猴','羊','马'];
for (let i = 1; i <= 49; i++) ZODIAC_MAP[i] = ZODIAC_SEQ[(i - 1) % 12];

export const ALL_ZODIACS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

// ==================== Five Elements Mapping ====================
export const ELEMENT_MAP: Record<number, string> = {};
const ELEM_GROUPS: Record<string, number[]> = {
  '金': [2,3,10,11,24,25,32,33,40,41],
  '木': [6,7,14,15,22,23,36,37,44,45],
  '水': [12,13,20,21,28,29,42,43],
  '火': [8,9,16,17,30,31,38,39,46,47],
  '土': [1,4,5,18,19,26,27,34,35,48,49],
};
Object.entries(ELEM_GROUPS).forEach(([e, nums]) => nums.forEach(n => ELEMENT_MAP[n] = e));
export const ALL_ELEMENTS = ['金','木','水','火','土'];

// ==================== Helpers ====================
export function getColorHex(c: 'red' | 'blue' | 'green'): string {
  return c === 'red' ? '#e74c3c' : c === 'blue' ? '#3498db' : '#27ae60';
}

export function getColorName(c: 'red' | 'blue' | 'green'): string {
  return c === 'red' ? '红波' : c === 'blue' ? '蓝波' : '绿波';
}

export function getElementEmoji(e: string): string {
  const m: Record<string, string> = { '金':'🪙','木':'🌳','水':'💧','火':'🔥','土':'⛰️' };
  return m[e] || '';
}

// ==================== Analysis ====================
export function analyzeDraws(draws: DrawResult[], count?: number): AnalysisData {
  const data = count ? draws.slice(0, count) : draws;
  const frequency = new Map<number, number>();
  const specialFrequency = new Map<number, number>();
  const colorStats = { red: 0, blue: 0, green: 0 };
  const zodiacStats = new Map<string, number>();
  const elementStats = new Map<string, number>();
  const headStats = new Map<number, number>();
  const tailStats = new Map<number, number>();

  for (let i = 1; i <= 49; i++) { frequency.set(i, 0); specialFrequency.set(i, 0); }
  ALL_ZODIACS.forEach(z => zodiacStats.set(z, 0));
  ALL_ELEMENTS.forEach(e => elementStats.set(e, 0));
  for (let i = 0; i <= 4; i++) headStats.set(i, 0);
  for (let i = 0; i <= 9; i++) tailStats.set(i, 0);

  data.forEach(draw => {
    [...draw.numbers, draw.special].forEach(n => frequency.set(n, (frequency.get(n) || 0) + 1));
    const sp = draw.special;
    specialFrequency.set(sp, (specialFrequency.get(sp) || 0) + 1);
    colorStats[COLOR_MAP[sp]]++;
    zodiacStats.set(ZODIAC_MAP[sp], (zodiacStats.get(ZODIAC_MAP[sp]) || 0) + 1);
    elementStats.set(ELEMENT_MAP[sp], (elementStats.get(ELEMENT_MAP[sp]) || 0) + 1);
    headStats.set(Math.floor(sp / 10), (headStats.get(Math.floor(sp / 10)) || 0) + 1);
    tailStats.set(sp % 10, (tailStats.get(sp % 10) || 0) + 1);
  });

  const missingCounts = new Map<number, number>();
  for (let i = 1; i <= 49; i++) {
    let m = 0;
    for (const draw of data) { if (draw.special === i) break; m++; }
    missingCounts.set(i, m);
  }

  return { frequency, specialFrequency, colorStats, zodiacStats, elementStats, headStats, tailStats, missingCounts };
}

export function generateAnalysisSummary(draws: DrawResult[]): string {
  const a = analyzeDraws(draws);
  const total = draws.length;

  const hot = [...a.specialFrequency.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10)
    .map(([n, c]) => `${String(n).padStart(2,'0')}(${c}次)`).join(', ');
  const cold = [...a.specialFrequency.entries()].sort((x, y) => x[1] - y[1]).slice(0, 10)
    .map(([n, c]) => `${String(n).padStart(2,'0')}(${c}次)`).join(', ');
  const miss = [...a.missingCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10)
    .map(([n, c]) => `${String(n).padStart(2,'0')}(遗漏${c}期)`).join(', ');

  const colorTxt = `红波${a.colorStats.red}次(${(a.colorStats.red/total*100).toFixed(1)}%), 蓝波${a.colorStats.blue}次(${(a.colorStats.blue/total*100).toFixed(1)}%), 绿波${a.colorStats.green}次(${(a.colorStats.green/total*100).toFixed(1)}%)`;

  const recent5 = draws.slice(0, 5).map(d =>
    `第${d.period}期: 正码[${d.numbers.map(n => String(n).padStart(2,'0')).join(',')}] 特码${String(d.special).padStart(2,'0')}(${getColorName(COLOR_MAP[d.special])}/${ZODIAC_MAP[d.special]}/${ELEMENT_MAP[d.special]})`
  ).join('\n');

  return `澳门六合彩最近${total}期数据分析摘要：

【最近5期开奖】
${recent5}

【特码热号TOP10】${hot}
【特码冷号TOP10】${cold}
【特码遗漏TOP10】${miss}
【特码波色分布】${colorTxt}
【特码生肖分布】${[...a.zodiacStats.entries()].map(([z, c]) => `${z}${c}次`).join(', ')}
【特码五行分布】${[...a.elementStats.entries()].map(([e, c]) => `${e}${c}次`).join(', ')}
【特码头数分布】${[...a.headStats.entries()].map(([h, c]) => `${h}头${c}次`).join(', ')}
【特码尾数分布】${[...a.tailStats.entries()].map(([t, c]) => `${t}尾${c}次`).join(', ')}`;
}
