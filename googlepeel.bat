@echo off
setlocal enabledelayedexpansion


echo.

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE=Profile 18"
set "STATUS_FILE=%USERPROFILE%\Downloads\googlepeel_status.txt"
set "DOWNLOADS_CSV=%USERPROFILE%\Downloads\startpage_urls.csv"

rem Base paths - output in current directory
set "SCRIPT_DIR=%~dp0"
set "OUTPUT_BASE=%SCRIPT_DIR%Webpages"
set "PROGRESS_FILE=%SCRIPT_DIR%googlepeel_progress.txt"
set "TEMP_JSON=%SCRIPT_DIR%temp_json.txt"

rem Check if Chrome exists
if not exist "%CHROME%" (
    echo ERROR: Chrome not found at: %CHROME%   
    pause
    exit /b 1
)

rem Create output base directory
if not exist "%OUTPUT_BASE%" mkdir "%OUTPUT_BASE%"

rem Delete any leftover CSV from previous runs
if exist "%DOWNLOADS_CSV%" del /F /Q "%DOWNLOADS_CSV%"

rem Load progress (last processed position)
set "LAST_CONTINENT="
set "LAST_COUNTRY="
set "LAST_UNIVERSITY="
set "RESUME_MODE=0"

if exist "%PROGRESS_FILE%" (
    echo Found progress file. Resuming from last position...
    for /F "usebackq tokens=1,2,3 delims=|" %%A in ("%PROGRESS_FILE%") do (
        set "LAST_CONTINENT=%%A"
        set "LAST_COUNTRY=%%B"
        set "LAST_UNIVERSITY=%%C"
    )
    if not "!LAST_CONTINENT!"=="" (
        set "RESUME_MODE=1"
        echo   Last completed: !LAST_CONTINENT! / !LAST_COUNTRY! / !LAST_UNIVERSITY!
    )
    echo.
)

rem Counter for processed universities
set "TOTAL_COUNT=0"
set "SUCCESS_COUNT=0"
set "FAIL_COUNT=0"
set "SKIP_COUNT=0"
set "FOUND_RESUME_POINT=0"

rem If no progress file, start from beginning
if "!RESUME_MODE!"=="0" set "FOUND_RESUME_POINT=1"

echo Starting to process all universities....
echo Output directory: %OUTPUT_BASE%
echo.

rem Loop through each continent folder (Africa, Asia, Europe, etc.)
for /D %%C in ( "%SCRIPT_DIR%Europe" "%SCRIPT_DIR%North America" "%SCRIPT_DIR%Oceania" "%SCRIPT_DIR%South America" "%SCRIPT_DIR%Africa" "%SCRIPT_DIR%Asia") do (
    if exist "%%C" (
        set "CONTINENT=%%~nxC"
        
        rem Loop through each country JSON file in the continent
        for %%F in ("%%C\*.json") do (
            set "COUNTRY_FILE=%%~nF"
            echo.
            echo Processing: !CONTINENT! / !COUNTRY_FILE!
            
            rem Use PowerShell to parse JSON and extract university data
            powershell -Command "$jsonContent = Get-Content '%%F' -Raw | ConvertFrom-Json; foreach ($entry in $jsonContent) { $universityName = $entry.university.'University Name'; $domain = $entry.university.Domain; if ($domain -and $domain -ne 'N/A' -and $universityName) { Write-Output \"$universityName,$domain\" } }" > "%TEMP_JSON%"
            
            rem Process the extracted data
            for /F "usebackq tokens=1,* delims=," %%A in ("%TEMP_JSON%") do (
                set "UNIVERSITY_NAME=%%A"
                set "DOMAIN=%%B"
                
                rem Skip empty lines
                if not "!DOMAIN!"=="" (
                    set /a TOTAL_COUNT+=1
                    
                    rem Clean domain for folder (domains are already clean, just need basic validation)
                    set "CLEAN_DOMAIN=!DOMAIN!"
                    
                    rem Replace any remaining invalid path characters (domains shouldn't have these, but just in case)
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:/=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:\=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN::=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:?=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:"=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:<=-!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:>=_!"
                    set "CLEAN_DOMAIN=!CLEAN_DOMAIN:|=_!"
                    
                    rem Check if we need to skip to resume point
                    if "!RESUME_MODE!"=="1" if "!FOUND_RESUME_POINT!"=="0" (
                        if "!CONTINENT!"=="!LAST_CONTINENT!" if "!COUNTRY_FILE!"=="!LAST_COUNTRY!" if "!CLEAN_DOMAIN!"=="!LAST_UNIVERSITY!" (
                            set "FOUND_RESUME_POINT=1"
                            echo Found resume point: !DOMAIN!
                            echo Continuing from next university...
                            echo.
                        ) else (
                            set /a SKIP_COUNT+=1
                        )
                    )
                    
                    rem Only process if we've found resume point or not in resume mode
                    if "!FOUND_RESUME_POINT!"=="1" (
                        rem Create output directory structure
                        set "OUTPUT_PATH=!OUTPUT_BASE!\!CONTINENT!\!COUNTRY_FILE!\!CLEAN_DOMAIN!"
                        set "OUTPUT_FILE=!OUTPUT_PATH!\search_urls.csv"
                        
                        rem Check if already processed (skip if output file exists)
                        if exist "!OUTPUT_FILE!" (
                            echo [SKIP] !DOMAIN! - Already processed
                            set /a SKIP_COUNT+=1
                        ) else (
                            echo.
                            echo ========================================
                            echo [!TOTAL_COUNT!] !CONTINENT! / !COUNTRY_FILE!
                            echo ========================================
                            echo University: !UNIVERSITY_NAME!
                            echo Domain: !DOMAIN!
                            echo Output: !OUTPUT_PATH!
                            echo.
                            
                            rem Create output directory with error checking
                            if not exist "!OUTPUT_PATH!" (
                                echo Creating folder: !OUTPUT_PATH!
                                md "!OUTPUT_PATH!" 2>nul
                            )
                            
                            rem Verify folder creation and process only if successful
                            if exist "!OUTPUT_PATH!" (
                                rem Build the search query with the domain (without ext=googlepeel)
                                set "ENCODED_QUERY=site:!DOMAIN!+%%28%%22faculty%%22+OR+%%22faculty+members%%22+OR+%%22academic+staff%%22+OR+%%22professor%%22+OR+%%22faculty+directory%%22+OR+%%22staff+directory%%22+OR+%%22people%%22+OR+%%22our+people%%22%%29"
                                set "Search_URL=https://www.startpage.com/do/search?q=!ENCODED_QUERY!"
                                
                                
                                rem Delete any leftover CSV from previous runs
                                if exist "%DOWNLOADS_CSV%" del /F /Q "%DOWNLOADS_CSV%"
                                
                                rem Initialize status file
                                echo nothing > "%STATUS_FILE%"
                                
                                rem Launch Chrome with flags to prevent restore prompt
                                echo [1/5] Launching Chrome...
                                start "" "%CHROME%" --profile-directory="%PROFILE%" --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-features=SessionRestore --no-first-run --disable-restore-session-state "!Search_URL!"
                                
                                rem Wait for page to load
                                timeout /t 3 /nobreak > nul
                                echo [2/5] Page loaded, triggering extension with CTRL+G...
                                
                                rem Send CTRL+G keystroke to trigger googlepeel extension
                                powershell -Command "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 500; [System.Windows.Forms.SendKeys]::SendWait('^g')"
                                
                                rem Update status to working
                                echo working > "%STATUS_FILE%"
                                echo [3/5] Extension running...
                                
                                rem Monitor for completion and save progress
                                call :MonitorStatus "!OUTPUT_PATH!" "!CLEAN_DOMAIN!" "!CONTINENT!" "!COUNTRY_FILE!"
                            ) else (
                                echo ERROR: Failed to create output folder!
                                echo Path: !OUTPUT_PATH!
                                set /a FAIL_COUNT+=1
                            )
                        )
                    )
                )
            )
            
            rem Clean up temporary file
            if exist "%TEMP_JSON%" del /F /Q "%TEMP_JSON%"
        )
    )
)

rem All done - delete progress file, clean up temp files and close Chrome
if exist "%PROGRESS_FILE%" del /F /Q "%PROGRESS_FILE%"
if exist "%TEMP_JSON%" del /F /Q "%TEMP_JSON%"

rem Final cleanup - close all Chrome instances
echo Closing Chrome...
taskkill /F /IM chrome.exe /T > nul 2>&1

goto :END

:MonitorStatus
    set "CURRENT_OUTPUT_PATH=%~1"
    set "CURRENT_CLEAN_NAME=%~2"
    set "CURRENT_CONTINENT=%~3"
    set "CURRENT_COUNTRY=%~4"
    set "MAX_WAIT=180"
    set "ELAPSED=0"
    set "CHECK_INTERVAL=3"
    
    :CheckLoop
        timeout /t %CHECK_INTERVAL% /nobreak > nul
        set /a ELAPSED+=CHECK_INTERVAL
        
        echo [4/5] Waiting... !ELAPSED!s / %MAX_WAIT%s
        
        rem Check if the CSV file exists in Downloads folder
        if exist "%DOWNLOADS_CSV%" (
            rem Get file size
            for %%F in ("%DOWNLOADS_CSV%") do set "FILE_SIZE=%%~zF"
            
            rem If file size > 0, extension has completed
            if !FILE_SIZE! GTR 0 (
                echo [5/5] DONE! File size: !FILE_SIZE! bytes
                
                rem Wait a moment to ensure file is fully written
                timeout /t 1 /nobreak > nul
                
                rem Debug output
                echo.
                echo DEBUG: Source file: %DOWNLOADS_CSV%
                echo DEBUG: Destination folder: !CURRENT_OUTPUT_PATH!
                echo DEBUG: Full destination: !CURRENT_OUTPUT_PATH!\search_urls.csv
                
                rem Force create destination folder with all parent directories
                if not exist "!CURRENT_OUTPUT_PATH!" (
                    echo Creating folder structure...
                    md "!CURRENT_OUTPUT_PATH!" 2>nul
                    if !ERRORLEVEL! NEQ 0 (
                        echo ERROR: Failed to create folder ii
                        echo Trying alternative method...
                        mkdir "!CURRENT_OUTPUT_PATH!"
                    )
                )
                
                rem Verify folder was created
                if exist "!CURRENT_OUTPUT_PATH!" (
                    echo Folder confirmed: YES
                ) else (
                    echo Folder confirmed: NO - FAILED TO CREATE
                )
                
                rem Copy file to the output path then delete original
                echo Copying file...
                copy /Y "%DOWNLOADS_CSV%" "!CURRENT_OUTPUT_PATH!\search_urls.csv"
                set "COPY_ERROR=!ERRORLEVEL!"
                
                if !COPY_ERROR! NEQ 0 (
                    echo ERROR: Copy command failed with error code: !COPY_ERROR!
                )
                
                if exist "!CURRENT_OUTPUT_PATH!\search_urls.csv" (
                    rem Delete the original from Downloads
                    del /F /Q "%DOWNLOADS_CSV%"
                    echo SUCCESS: Saved to !CURRENT_OUTPUT_PATH!\search_urls.csv
                    set /a SUCCESS_COUNT+=1
                    
                    rem Save progress after successful completion
                    echo !CURRENT_CONTINENT!^|!CURRENT_COUNTRY!^|!CURRENT_CLEAN_NAME!> "%PROGRESS_FILE%"
                ) else (
                    echo ERROR: File was NOT copied successfully
                    echo Source exists: 
                    if exist "%DOWNLOADS_CSV%" (echo   YES) else (echo   NO)
                    echo Destination folder exists:
                    if exist "!CURRENT_OUTPUT_PATH!" (echo   YES) else (echo   NO)
                    set /a FAIL_COUNT+=1
                )
                echo.
                
                rem Close the current tab using taskkill to close the window (not terminate)
                echo Closing current Chrome tab...
                taskkill /IM chrome.exe /T > nul 2>&1
                
                rem Brief wait before next university
                timeout /t 1 /nobreak > nul
                
                echo done > "%STATUS_FILE%"
                echo.
                goto :EOF
            )
        )
        
        if !ELAPSED! GEQ %MAX_WAIT% (
            echo TIMEOUT: Extension did not complete in %MAX_WAIT%s
            echo Closing Chrome and moving to next...
            set /a FAIL_COUNT+=1
            
            rem Save progress even on timeout so we can skip this one
            echo !CURRENT_CONTINENT!^|!CURRENT_COUNTRY!^|!CURRENT_CLEAN_NAME!> "%PROGRESS_FILE%"
            
            rem Close Chrome window
            taskkill /IM chrome.exe /T > nul 2>&1
            timeout /t 1 /nobreak > nul
            
            echo timeout > "%STATUS_FILE%"
            echo.
            goto :EOF
        )
        
        goto CheckLoop

:END
echo.
echo ========================================
echo ..............COMPLETE..................
echo ========================================
echo.
echo Total Universities: %TOTAL_COUNT%
echo Skipped (already done): %SKIP_COUNT%
echo Successful: %SUCCESS_COUNT%
echo Failed/Timeout: %FAIL_COUNT%
echo.
echo Output Location: %OUTPUT_BASE%
echo.
echo Press any key to exit...
pause > nul
exit /b 0
