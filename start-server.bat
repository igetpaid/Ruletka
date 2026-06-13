@echo off
title Roulette Server
echo Starting server on http://localhost:8080
echo Press Ctrl+C to stop.
echo.
python -m http.server 8080 --bind 0.0.0.0
