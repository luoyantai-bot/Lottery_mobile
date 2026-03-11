@echo off
chcp 65001 >nul
echo ========================================
echo   澳门六合彩AI助手 - 启动中...
echo ========================================
echo.

cd /d "%~dp0server"

echo 正在安装依赖...
pip install -r requirements.txt -q

echo.
echo 启动服务...
python app.py

pause
