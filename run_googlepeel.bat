@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Google Peel - Automated URL Collector
echo ========================================
echo.

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE=Profile 18"

rem CSV output path (you can customize this)
set "CSV_OUTPUT_PATH=D:\extensions\googlepeel"
set "CSV_FILE=%CSV_OUTPUT_PATH%\google_urls.csv"

rem Create output directory if it doesn't exist
if not exist "%CSV_OUTPUT_PATH%" (
    echo Creating output directory: %CSV_OUTPUT_PATH%
    mkdir "%CSV_OUTPUT_PATH%"
    echo.
)

rem URL encode the search query for Harvard faculty
set "ENCODED_QUERY=site:harvard.edu+%%28%%22faculty%%22+OR+%%22faculty+members%%22+OR+%%22academic+staff%%22+OR+%%22professor%%22+OR+%%22faculty+directory%%22+OR+%%22staff+directory%%22+OR+%%22people%%22+OR+%%22our+people%%22%%29"
set "GOOGLE_URL=https://www.google.com/search?q=%ENCODED_QUERY%#googlepeel"

rem Check if Chrome exists
if not exist "%CHROME%" (
    echo ERROR: Chrome not found at: %CHROME%
    pause
    exit /b 1
)

echo [1/5] Launching Chrome with profile: %PROFILE%
echo Search URL: %GOOGLE_URL%
echo Extension will auto-trigger via URL hash (#googlepeel)
start "" "%CHROME%" --profile-directory="%PROFILE%" "%GOOGLE_URL%"

echo [2/5] Chrome launched. Extension will auto-trigger in 2 seconds...
timeout /t 2 /nobreak > nul

echo [3/5] Extension should now be running...

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
        
        echo   Elapsed: !ELAPSED!s / %MAX_WAIT%s max - Checking for completion...
        
        rem Check if the CSV file exists in Downloads folder first
        set "DOWNLOADS_CSV=%USERPROFILE%\Downloads\google_urls.csv"
        
        if exist "%DOWNLOADS_CSV%" (
            rem Get file size
            for %%F in ("%DOWNLOADS_CSV%") do set "FILE_SIZE=%%~zF"
            
            rem If file size > 0, extension has completed
            if !FILE_SIZE! GTR 0 (
                echo.
                echo ========================================
                echo [5/5] Status: DONE!
                echo ========================================
                echo.
                echo Google Peel has completed successfully!
                echo Moving CSV file from Downloads to: %CSV_OUTPUT_PATH%
                
                rem Move file to the configured output path
                move /Y "%DOWNLOADS_CSV%" "%CSV_FILE%" > nul
                
                if exist "%CSV_FILE%" (
                    echo CSV file saved to: %CSV_FILE%
                    echo File size: !FILE_SIZE! bytes
                ) else (
                    echo Warning: File was downloaded but could not be moved
                    echo CSV file location: %DOWNLOADS_CSV%
                )
                
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
