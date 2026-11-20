chcp 65001 >nul
@echo off

rem [注意] echoは日本語で文末が終わらないようにしてください。エラーになります。

cd /d "%~dp0"

echo LadyTubeのセットアップを行います。 
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

rem ダウンロードしたものが無く、インストール済みの Node が 20 から 25 なら、それを使う (v3.11.0)
rem 範囲は better-sqlite3 12 が動く版。Node の大きな版を上げたら、このセットアップをやり直す
set "NODE_MAJOR=0"
if not exist "%SYS_FOLDER%\%NODEJS%" (
	for /f "tokens=1 delims=v." %%v in ('node -v 2^>nul') do set "NODE_MAJOR=%%v"
)
set "USE_SYSTEM_NODE="
if %NODE_MAJOR% geq 20 if %NODE_MAJOR% leq 25 set "USE_SYSTEM_NODE=1"
if defined USE_SYSTEM_NODE echo インストール済みの Node.js v%NODE_MAJOR% を使います。 

if not defined USE_SYSTEM_NODE if not exist "%SYS_FOLDER%\%NODEJS%" (
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

rem ダウンロードしたものが無く、インストール済みの ffmpeg と ffprobe があり、使う形式 (libx264 と libwebp) に対応していれば、それを使う (v3.11.0)
set "USE_SYSTEM_FFMPEG="
if not exist "%SYS_FOLDER%\%FFMPEG%" (
	rem 動かせない ffmpeg をパイプの左に置くとバッチごと止まるので、パイプを使わずファイルに書いて調べる (v3.11.0)
	ffprobe -version >nul 2>nul && ffmpeg -hide_banner -encoders >"%SYS_FOLDER%\encoders.txt" 2>nul && findstr /c:"libx264" "%SYS_FOLDER%\encoders.txt" >nul && findstr /c:"libwebp" "%SYS_FOLDER%\encoders.txt" >nul && set "USE_SYSTEM_FFMPEG=1"
	del "%SYS_FOLDER%\encoders.txt" >nul 2>nul
)
if defined USE_SYSTEM_FFMPEG echo インストール済みの FFmpeg を使います。 

if not defined USE_SYSTEM_FFMPEG if not exist "%SYS_FOLDER%\%FFMPEG%" (
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
call "%~dp0ladytube.bat"
exit

:ERROR_MKDIR
echo このフォルダーには書き込みできません。デスクトップやドキュメントフォルダーなどの書き込める場所にフォルダーを移動してください。 
echo.

:ERROR
echo セットアップでエラーが発生しました。 
pause
