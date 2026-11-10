chcp 65001 >nul
@echo off

rem [注意] echoは日本語で文末が終わらないようにしてください。エラーになります。

cd /d "%~dp0"

echo WomanLiveのセットアップを行います。 
echo.
echo 必要な部品をネットからダウンロードします。 
echo ファイアウォールの警告が出る場合は許可してください。
echo.
echo 何かキーを押すと開始します。 
echo セットアップをやめる場合は、このターミナルを閉じてください。 

pause >nul


echo 作業フォルダーを確認中... 

set "SYS_FOLDER=%~dp0.sys"

if not exist "%SYS_FOLDER%" (
	echo "%SYS_FOLDER%" フォルダーを作成します... 
    mkdir "%SYS_FOLDER%"
	if not exist "%SYS_FOLDER%" (
		goto :ERROR_MKDIR
	)	
)


echo NodeJSを確認中... 

set ARCHIVE=7z

set NODEJS=node-v24.13.0-win-x64
set NODEJS_FILE=%NODEJS%.%ARCHIVE%
set URL=https://nodejs.org/dist/v24.13.0/node-v24.13.0-win-x64.%ARCHIVE%

if not exist "%SYS_FOLDER%\%NODEJS%" (
	if not exist "%SYS_FOLDER%\%NODEJS_FILE%" (
	    echo NodeJSをダウンロード中... 
	    curl -L %URL% -o "%SYS_FOLDER%\%NODEJS_FILE%"
		if %errorlevel% neq 0 goto :ERROR
	)
	
    echo NodeJSを展開中... 
	tar -xf "%SYS_FOLDER%\%NODEJS_FILE%" -C "%SYS_FOLDER%"
	if %errorlevel% neq 0 goto :ERROR
)

echo FFmpegを確認中...

set FFMPEG=ffmpeg-8.0.1-full_build-shared
set FFMPEG_FILE=%FFMPEG%.%ARCHIVE%
set FFMPEG_URL=https://github.com/GyanD/codexffmpeg/releases/download/8.0.1/ffmpeg-8.0.1-full_build-shared.%ARCHIVE%

if not exist "%SYS_FOLDER%\%FFMPEG%" (
	if not exist "%SYS_FOLDER%\%FFMPEG_FILE%" (
	    echo FFmpegをダウンロード中...
	    curl -L %FFMPEG_URL% -o "%SYS_FOLDER%\%FFMPEG_FILE%"
		if %errorlevel% neq 0 goto :ERROR
	)
	
    echo FFmpegを展開中...
	tar -xf "%SYS_FOLDER%\%FFMPEG_FILE%" -C "%SYS_FOLDER%"
	if %errorlevel% neq 0 goto :ERROR
)


echo 部品をダウンロード中... 

set "PATH=%SYS_FOLDER%\%FFMPEG%\bin;%SYS_FOLDER%\%NODEJS%;%PATH%"
set "npm_config_cache=%SYS_FOLDER%\.npm-cache"
set "NODE_COMPILE_CACHE=%SYS_FOLDER%\.node-cache"

cd server
call npm ci --omit=dev
if %errorlevel% neq 0 goto :ERROR

echo セットアップが完了しました。 

cd ..\
echo WomanLiveを開始します。 

node server/index.js -browser

pause
exit

:ERROR_MKDIR
echo このフォルダーには書き込みできません。デスクトップやドキュメントフォルダーなどの書き込める場所にフォルダーを移動してください。 
echo.

:ERROR
echo セットアップでエラーが発生しました。 
pause
