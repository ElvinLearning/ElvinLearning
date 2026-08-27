@echo off
REM ---------------------------------------------------------------
REM  Cardio Surfer - run it locally on Windows.
REM  Double-click this file. It starts a small web server in this
REM  folder and opens the game in your default browser.
REM
REM  Browsers only allow camera access on https:// OR on localhost,
REM  which is why the game needs a server and won't work if you just
REM  double-click index.html.
REM
REM  Close this black window when you're done to stop the server.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"
set PORT=8080

where py >nul 2>nul && goto :usepy
where python >nul 2>nul && goto :usepython
where node >nul 2>nul && goto :usenode

echo.
echo   Couldn't find Python or Node.js on this PC.
echo.
echo   Install either one (python.org or nodejs.org) and run this
echo   again, or open the hosted URL from README.md instead.
echo.
pause
exit /b 1

:usepy
echo Serving on http://localhost:%PORT%/  (close this window to stop)
start "" http://localhost:%PORT%/
py -m http.server %PORT%
exit /b

:usepython
echo Serving on http://localhost:%PORT%/  (close this window to stop)
start "" http://localhost:%PORT%/
python -m http.server %PORT%
exit /b

:usenode
echo Serving on http://localhost:%PORT%/  (close this window to stop)
start "" http://localhost:%PORT%/
npx --yes http-server -p %PORT% -c-1 .
exit /b
