@echo off
REM Launch browser with Startpage search and auto-trigger googlepeel extension
REM Usage: launch-googlepeel.bat "your search query"

set SEARCH_QUERY=%~1

if "%SEARCH_QUERY%"=="" (
    echo Usage: launch-googlepeel.bat "your search query"
    echo Example: launch-googlepeel.bat "MIT faculty computer science"
    pause
    exit /b 1
)

REM URL encode spaces as +
set SEARCH_QUERY=%SEARCH_QUERY: =+%

REM Build the URL with ext=googlepeel parameter
set URL=https://www.startpage.com/sp/search?query=%SEARCH_QUERY%^&ext=googlepeel

echo Opening: %URL%
start "" "%URL%"
