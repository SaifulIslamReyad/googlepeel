@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Google Peel - Automated URL Collector
echo ========================================
echo.

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE=Profile 18"
set "STATUS_FILE=%USERPROFILE%\Downloads\googlepeel_status.txt"

rem URL encode the search query for Harvard faculty
set "ENCODED_QUERY=site:harvard.edu+%%28%%22faculty%%22+OR+%%22faculty+members%%22+OR+%%22academic+staff%%22+OR+%%22professor%%22+OR+%%22faculty+directory%%22+OR+%%22staff+directory%%22+OR+%%22people%%22+OR+%%22our+people%%22%%29"
set "GOOGLE_URL=https://www.google.com/search?q=%ENCODED_QUERY%#googlepeel"

rem Check if Chrome exists
if not exist "%CHROME%" (
    echo ERROR: Chrome not found at: %CHROME%
    pause
    exit /b 1
)

rem Initialize status file to "nothing"
echo nothing > "%STATUS_FILE%"
echo Status file created at: %STATUS_FILE%
echo.

echo [1/5] Launching Chrome with profile: %PROFILE%
echo Search URL: %GOOGLE_URL%
echo Extension will auto-trigger via URL hash (#googlepeel)
start "" "%CHROME%" --profile-directory="%PROFILE%" "%GOOGLE_URL%"

echo [2/5] Chrome launched. Extension will auto-trigger in 2 seconds...
timeout /t 2 /nobreak > nul

echo [3/5] Extension should now be running...

rem Update status to working
echo working > "%STATUS_FILE%"

echo [4/5] Extension triggered. Monitoring status...
echo.

rem Monitor the status file
call :MonitorStatus
goto :END

:MonitorStatus
    set "MAX_WAIT=180"
    set "ELAPSED=0"
    set "CHECK_INTERVAL=3"
    
    echo Status: Working...
    
    :CheckLoop
        timeout /t %CHECK_INTERVAL% /nobreak > nul
        set /a ELAPSED+=CHECK_INTERVAL
        
        rem Check if the CSV file exists in Downloads (indicates completion)
        set "CSV_FILE=%USERPROFILE%\Downloads\google_urls.csv"
        
        rem Get file modification time to detect new download
        for %%F in ("%CSV_FILE%") do set "FILE_TIME=%%~tF"
        
        rem Check if status file says done
        if exist "%STATUS_FILE%" (
            set /p CURRENT_STATUS=<"%STATUS_FILE%"
        )
        
        echo   Elapsed: !ELAPSED!s / %MAX_WAIT%s max - Checking for completion...
        
        rem Check if CSV was recently modified (within last 2 minutes means new download)
        if exist "%CSV_FILE%" (
            rem File exists, check if it was modified recently by comparing timestamps
            for /f "tokens=*" %%A in ('powershell -NoProfile -Command "(Get-Item '%CSV_FILE%').LastWriteTime -gt (Get-Date).AddSeconds(-!ELAPSED!)"') do set "IS_NEW=%%A"
            
            if "!IS_NEW!"=="True" (
                echo.
                echo ========================================
                echo [5/5] Status: DONE!
                echo ========================================
                echo.
                echo Google Peel has completed successfully!
                echo CSV file saved to: %CSV_FILE%
                echo done > "%STATUS_FILE%"
                echo.
                goto :EOF
            )
        )
        
        if !ELAPSED! GEQ %MAX_WAIT% (
            echo.
            echo ========================================
            echo WARNING: Timeout reached ^(%MAX_WAIT%s^)
            echo ========================================
            echo Extension may still be running.
            echo Please check Chrome manually.
            echo timeout > "%STATUS_FILE%"
            goto :EOF
        )
        
        goto CheckLoop

:END
echo.
echo ----------------------------------------
echo Process finished.
echo ----------------------------------------
echo.
echo Press any key to exit...
pause > nul
exit /b 0
