@echo off
chcp 65001 > nul
title เหมียวน่ารัก - โปรแกรมตัดต่อวิดีโอ TikTok 3:4

echo ============================================================
echo   🐱 เหมียวน่ารัก - โปรแกรมตัดต่อวิดีโอ TikTok 3:4
echo   ระบบตัดต่อวิดีโออัจฉริยะ AI + Manual ซับคำสำคัญ (Keywords) Real-Time
echo ============================================================
echo.
echo กำลังเริ่มต้นระบบ เหมียวน่ารัก...
echo กำลังเปิดเบราว์เซอร์ไปที่ http://localhost:3350
echo.

start http://localhost:3350
node server.js

pause
