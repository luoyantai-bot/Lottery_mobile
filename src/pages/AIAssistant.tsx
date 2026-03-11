import { useState, useRef, useEffect } from 'react';
import { DrawResult, COLOR_MAP, ZODIAC_MAP, ELEMENT_MAP, getColorHex, getColorName } from '../utils/constants';
import { chatWithAI, ChatMessage, AI_MODELS } from '../services/api';
import LotteryBall from '../components/LotteryBall';

interface Msg { role: 'user' | 'assistant'; content: string; ts: Date; }

export default function AIAssistant({ draws, backendAvailable }: { draws: DrawResult[]; backendAvailable: boolean }) {
  const [model, setModel] = useState(AI_MODELS[0].id);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (content: string) => {
    if (!content.trim() || loading) return;
    setMessages(p => [...p, { role: 'user', content, ts: new Date() }]);
    setInput('');
    setLoading(true);
    try {
      const hist: ChatMessage[] = [
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content },
      ];
      const reply = await chatWithAI(hist, model);
      setMessages(p => [...p, { role: 'assistant', content: reply, ts: new Date() }]);
    } catch (e: any) {
      setMessages(p => [...p, { role: 'assistant', content: `❌ 错误：${e.message}`, ts: new Date() }]);
    } finally { setLoading(false); }
  };

  const toggle = (n: number) => {
    setSelected(p => p.includes(n) ? p.filter(x => x !== n) : p.length >= 10 ? p : [...p, n].sort((a, b) => a - b));
  };

  const analyzeSelected = () => {
    if (!selected.length) return;
    const info = selected.map(n => `${String(n).padStart(2, '0')}(${getColorName(COLOR_MAP[n])}/${ZODIAC_MAP[n]}/${ELEMENT_MAP[n]})`).join('、');
    send(`我选了以下号码作为特码候选：${info}。请从频率、遗漏值、波色、生肖、五行、头尾等多个维度综合分析这些号码，给出你的推荐排序和理由，并指出需要注意的风险。`);
  };

  const quickQs = [
    '下一期特码最可能开什么波色？请给出数据支持。',
    '目前遗漏值最大的号码有哪些？值得追号吗？',
    '从生肖角度分析，下一期哪些生肖最值得关注？',
    '请推荐5个最有潜力的特码号码，给出详细理由。',
    '最近10期有什么明显的走势规律和趋势？',
    '从五行和头尾角度看，下一期应该关注什么？',
  ];

  return (
    <div className="space-y-4">
      {/* Backend Status */}
      {!backendAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm">⚠️ 后端服务未连接</h3>
          <p className="text-xs text-amber-600 mt-1">AI 功能需要后端服务支持，请按以下步骤启动：</p>
          <div className="mt-2 bg-gray-900 text-green-400 rounded-xl p-3 font-mono text-xs space-y-1">
            <p><span className="text-gray-500">$</span> cd server</p>
            <p><span className="text-gray-500">$</span> pip install -r requirements.txt</p>
            <p><span className="text-gray-500">$</span> <span className="text-yellow-300"># 先编辑 config.py 填入你的硅基流动 API Key</span></p>
            <p><span className="text-gray-500">$</span> python app.py</p>
          </div>
          <p className="text-xs text-amber-500 mt-2">启动后端后刷新页面即可使用 AI 功能</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel */}
        <div className="space-y-4">
          {/* Number Picker */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">🎯 选号分析（最多10个）</h3>
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {Array.from({ length: 49 }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => toggle(n)}
                  className={`w-full aspect-square rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-150 ${
                    selected.includes(n) ? 'ring-2 ring-yellow-400 ring-offset-1 scale-110 text-white shadow-lg' : 'text-white opacity-50 hover:opacity-90'
                  }`} style={{ backgroundColor: getColorHex(COLOR_MAP[n]) }}>
                  {String(n).padStart(2, '0')}
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-1.5">{selected.map(n => <LotteryBall key={n} number={n} size="sm" />)}</div>
                <button onClick={analyzeSelected} disabled={loading || !backendAvailable}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-sm font-bold shadow-sm transition-all">
                  🤖 AI 分析这些号码
                </button>
                <button onClick={() => setSelected([])} className="w-full py-1.5 text-gray-400 text-xs hover:text-gray-600">清空选号</button>
              </div>
            )}
          </div>

          {/* Quick Questions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-bold text-sm mb-3">💡 快捷提问</h3>
            <div className="space-y-1.5">
              {quickQs.map((q, i) => (
                <button key={i} onClick={() => send(q)} disabled={loading || !backendAvailable}
                  className="w-full text-left px-3 py-2.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-xs text-gray-600 transition-colors disabled:opacity-40 leading-relaxed">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">💬 AI 策略对话</h3>
            <div className="flex items-center gap-2">
              <select value={model} onChange={e => setModel(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none">
                {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}{m.free ? ' ✨免费' : ' 💰付费'}</option>)}
              </select>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-red-500">清空对话</button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-300 py-16">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-base font-medium text-gray-400">澳门六合彩 AI 分析助手</p>
                <p className="text-sm mt-2 text-gray-300">
                  {backendAvailable
                    ? '从左侧选号让我分析，使用快捷提问，或直接输入问题'
                    : '请先启动后端服务以使用 AI 功能'}
                </p>
                <p className="text-xs mt-4 text-gray-300">已加载最近 {draws.length} 期开奖数据作为分析基础</p>
                {backendAvailable && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-700 font-medium">后端已连接 · AI 就绪</span>
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-800 border border-gray-100'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  <div className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {m.ts.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                  <div className="flex items-center gap-2.5 text-gray-400">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span className="text-sm">AI 正在分析数据...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={backendAvailable ? '输入你的问题，例如：帮我分析下一期特码的走势...' : '请先启动后端服务...'}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm"
                disabled={loading || !backendAvailable} />
              <button onClick={() => send(input)} disabled={loading || !input.trim() || !backendAvailable}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 font-bold text-sm shadow-sm transition-all">
                发送
              </button>
            </div>
            <p className="text-[10px] text-gray-300 mt-2 text-center">⚠️ AI 分析仅供参考，彩票本质是随机事件，请理性投注</p>
          </div>
        </div>
      </div>
    </div>
  );
}
