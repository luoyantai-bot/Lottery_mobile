export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
        <div className="text-6xl mb-4">🎰</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">澳门六合彩智能分析助手</h1>
        <p className="text-gray-500 mb-6">请通过 Flask 后端服务访问完整功能</p>

        <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3">
          <h3 className="font-bold text-gray-700 text-sm">🚀 启动方式</h3>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-gray-700">编辑配置文件</p>
                <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">server/config.py</code>
                <p className="text-gray-400 text-xs mt-1">填入你的硅基流动 API Key</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-gray-700">安装依赖并启动</p>
                <div className="bg-gray-800 text-green-400 rounded-lg p-3 text-xs mt-1 font-mono">
                  <div>cd server</div>
                  <div>pip install -r requirements.txt</div>
                  <div>python app.py</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-gray-700">浏览器打开</p>
                <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">http://localhost:5000</code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-xs text-gray-600">开奖大厅</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl mb-1">📈</div>
            <div className="text-xs text-gray-600">数据分析</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl mb-1">🤖</div>
            <div className="text-xs text-gray-600">AI策略助手</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          或在 Windows 上直接双击 <code className="bg-gray-100 px-1 rounded">start.bat</code> 一键启动
        </p>
      </div>
    </div>
  );
}
