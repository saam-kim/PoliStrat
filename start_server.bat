@echo off
cd /d "%~dp0"
echo PoliStrat local server starting at http://127.0.0.1:8000/index.html
echo Keep this window open while using the game.
python -m http.server 8000
