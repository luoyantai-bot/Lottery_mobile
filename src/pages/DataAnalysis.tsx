import { useState, useMemo } from 'react';
import { DrawResult, analyzeDraws, COLOR_MAP, ALL_ZODIACS, getColorHex, getColorName } from '../utils/constants';
import LotteryBall from '../components/LotteryBall';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ELEM_COLORS: Record<string, string> = { '金': '#D4A017', '木': '#2E7D32', '水': '#1565C0', '火': '#E53935', '土': '#6D4C41' };

type Tab = 'overview' | 'frequency' | 'attributes';

export default function DataAnalysis({ draws }: { draws: DrawResult[] }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<20 | 50 | 100>(100);
  const analysis = useMemo(() => analyzeDraws(draws, range), [draws, range]);

  /* ─── OVERVIEW ─── */
  const renderOverview = () => {
    const hot = [...analysis.specialFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const cold = [...analysis.specialFrequency.entries()].sort((a, b) => a[1] - b[1]).slice(0, 10);
    const topMiss = [...analysis.missingCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

    return (
      <div className="space-y-5">
        {/* Color cards */}
        <div className="grid grid-cols-3 gap-4">
          {(['red', 'blue', 'green'] as const).map(c => (
            <div key={c} className="rounded-2xl p-5 text-white shadow-lg" style={{ backgroundColor: getColorHex(c) }}>
              <div className="text-base font-bold opacity-90">{getColorName(c)}</div>
              <div className="text-4xl font-black mt-1">{analysis.colorStats[c]}</div>
              <div className="text-sm opacity-75 mt-0.5">{(analysis.colorStats[c] / range * 100).toFixed(1)}% · 共{range}期</div>
            </div>
          ))}
        </div>

        {/* Hot */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">🔥 热号 TOP10<span className="text-xs font-normal text-gray-400">（特码出现次数最多）</span></h3>
          <div className="flex flex-wrap gap-4">
            {hot.map(([n, c]) => (
              <div key={n} className="flex flex-col items-center gap-1.5">
                <LotteryBall number={n} size="md" />
                <span className="text-xs font-bold text-red-500">{c}次</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cold */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-blue-600 mb-4 flex items-center gap-2">❄️ 冷号 TOP10<span className="text-xs font-normal text-gray-400">（特码出现次数最少）</span></h3>
          <div className="flex flex-wrap gap-4">
            {cold.map(([n, c]) => (
              <div key={n} className="flex flex-col items-center gap-1.5">
                <LotteryBall number={n} size="md" />
                <span className="text-xs font-bold text-blue-500">{c}次</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-amber-600 mb-4 flex items-center gap-2">⏳ 遗漏值排行<span className="text-xs font-normal text-gray-400">（距上次开出特码的期数）</span></h3>
          <div className="grid grid-cols-5 gap-2.5">
            {topMiss.map(([n, m]) => (
              <div key={n} className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl">
                <LotteryBall number={n} size="sm" />
                <span className="text-sm font-mono font-bold text-amber-600">{m}期</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ─── FREQUENCY ─── */
  const renderFrequency = () => {
    const allData = Array.from({ length: 49 }, (_, i) => ({
      num: String(i + 1).padStart(2, '0'), count: analysis.frequency.get(i + 1) || 0, fill: getColorHex(COLOR_MAP[i + 1]),
    }));
    const spData = Array.from({ length: 49 }, (_, i) => ({
      num: String(i + 1).padStart(2, '0'), count: analysis.specialFrequency.get(i + 1) || 0, fill: getColorHex(COLOR_MAP[i + 1]),
    }));

    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold mb-4">📊 所有号码出现频率（正码+特码）</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="num" fontSize={9} interval={0} angle={-90} textAnchor="end" height={50} tick={{ fill: '#888' }} />
                <YAxis fontSize={11} tick={{ fill: '#888' }} />
                <Tooltip formatter={(v: any) => [`${v} 次`, '出现']} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>{allData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold mb-4">🎯 特码出现频率</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="num" fontSize={9} interval={0} angle={-90} textAnchor="end" height={50} tick={{ fill: '#888' }} />
                <YAxis fontSize={11} tick={{ fill: '#888' }} />
                <Tooltip formatter={(v: any) => [`${v} 次`, '特码']} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>{spData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  /* ─── ATTRIBUTES ─── */
  const renderAttributes = () => {
    const colorPie = (['red', 'blue', 'green'] as const).map(c => ({ name: getColorName(c), value: analysis.colorStats[c], fill: getColorHex(c) }));
    const elemPie = [...analysis.elementStats.entries()].map(([n, v]) => ({ name: n, value: v, fill: ELEM_COLORS[n] }));
    const zodiacBar = ALL_ZODIACS.map(z => ({ name: z, count: analysis.zodiacStats.get(z) || 0 }));
    const headBar = [0, 1, 2, 3, 4].map(h => ({ name: `${h}头`, count: analysis.headStats.get(h) || 0 }));
    const tailBar = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => ({ name: `${t}尾`, count: analysis.tailStats.get(t) || 0 }));

    const renderPieLabel = (p: any) => {
      const RADIAN = Math.PI / 180;
      const r = p.innerRadius + (p.outerRadius - p.innerRadius) * 0.5;
      const x = p.cx + r * Math.cos(-p.midAngle * RADIAN);
      const y = p.cy + r * Math.sin(-p.midAngle * RADIAN);
      return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{`${p.name} ${(p.percent * 100).toFixed(0)}%`}</text>;
    };

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold mb-2">🎨 波色分布（特码）</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={colorPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={renderPieLabel} labelLine={false}>
                  {colorPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold mb-2">🌟 五行分布（特码）</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={elemPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={renderPieLabel} labelLine={false}>
                  {elemPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold mb-4">🐲 生肖分布（特码）</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zodiacBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#555' }} />
                <YAxis fontSize={11} tick={{ fill: '#888' }} />
                <Tooltip />
                <Bar dataKey="count" name="出现次数" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold mb-4">🔢 头数分布（特码）</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headBar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" name="出现次数" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold mb-4">🔢 尾数分布（特码）</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tailBar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" name="出现次数" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: '📋 总览' },
    { id: 'frequency', label: '📊 频率分析' },
    { id: 'attributes', label: '🏷️ 属性分析' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400">分析范围：</span>
          {([20, 50, 100] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>
              最近{r}期
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && renderOverview()}
      {tab === 'frequency' && renderFrequency()}
      {tab === 'attributes' && renderAttributes()}
    </div>
  );
}
