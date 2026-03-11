import { useState } from 'react';
import { DrawResult, COLOR_MAP, ZODIAC_MAP, ELEMENT_MAP, getColorHex, getColorName } from '../utils/constants';
import LotteryBall from '../components/LotteryBall';

export default function DrawHistory({ draws }: { draws: DrawResult[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const filtered = search ? draws.filter(d => d.period.includes(search)) : draws;
  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);
  const latest = draws[0];

  return (
    <div className="space-y-6">
      {/* Latest Draw Hero */}
      {latest && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">🏆 最新开奖</h2>
              <p className="text-blue-200 mt-1">第 {latest.period} 期 · {latest.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2.5">
              {latest.numbers.map((n, i) => (
                <LotteryBall key={i} number={n} size="lg" />
              ))}
            </div>
            <span className="text-3xl font-black mx-1 opacity-60">+</span>
            <LotteryBall number={latest.special} size="lg" isSpecial />
            <div className="ml-4 bg-white/15 rounded-xl px-5 py-3 backdrop-blur-sm">
              <p className="text-sm opacity-80">特码信息</p>
              <p className="text-2xl font-black">{String(latest.special).padStart(2, '0')}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: getColorHex(COLOR_MAP[latest.special]) }}>
                  {getColorName(COLOR_MAP[latest.special])}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-xs font-bold">{ZODIAC_MAP[latest.special]}</span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-xs font-bold">{ELEMENT_MAP[latest.special]}</span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-xs font-bold">{Math.floor(latest.special / 10)}头{latest.special % 10}尾</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Count */}
      <div className="flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 搜索期号..."
          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white shadow-sm"
        />
        <span className="text-sm text-gray-400">共 {filtered.length} 期记录</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">期号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">正码</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">特码</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">波色</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">生肖</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">五行</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">头尾</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageData.map((draw, idx) => {
                const sp = draw.special;
                return (
                  <tr key={draw.period} className={`transition-colors hover:bg-blue-50/40 ${idx % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600">{draw.period}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{draw.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">{draw.numbers.map((n, i) => <LotteryBall key={i} number={n} size="sm" />)}</div>
                    </td>
                    <td className="px-4 py-3"><div className="flex justify-center"><LotteryBall number={sp} isSpecial /></div></td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs text-white font-bold" style={{ backgroundColor: getColorHex(COLOR_MAP[sp]) }}>
                        {getColorName(COLOR_MAP[sp])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{ZODIAC_MAP[sp]}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{ELEMENT_MAP[sp]}</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-gray-600">{Math.floor(sp / 10)}头{sp % 10}尾</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition-colors">
            ← 上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition-colors">
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
