@echo off
rem Startet den Deckbox Creator lokal (Doppelklick). Fenster offen lassen, solange das Tool genutzt wird.
cd /d "%~dp0"
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8765"
python -m http.server 8765
