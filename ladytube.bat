chcp 65001 >nul
@echo off

rem [注意] echoは日本語で文末が終わらないようにしてください。エラーになります。

cd /d "%~dp0"

set "SYS_FOLDER=%~dp0.sys"

set NODEJS=node-v24.13.0-win-x64
set FFMPEG=ffmpeg-8.0.1-full_build-shared

rem setup.bat がダウンロードしたものを先に使い、無ければインストール済みのものを使う (v3.11.0)
set "PATH=%SYS_FOLDER%\%FFMPEG%\bin;%SYS_FOLDER%\%NODEJS%;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
	echo Node.js が見つかりません。setup.bat を実行してください。 
	goto :ERROR
)
if not exist "%~dp0server\node_modules" (
	echo 部品が入っていません。setup.bat を実行してください。 
	goto :ERROR
)
set "NODE_COMPILE_CACHE=%SYS_FOLDER%\.node-cache"

echo LadyTubeを開始します。 

rem ライブラリを切り替えるとサーバーは 75 で終わるので、起動し直す (server/ext/library.js)
set "LADYTUBE_RESTART=1"
set "OPEN_BROWSER=-browser"

:RUN
node server/index.js %OPEN_BROWSER%
if %errorlevel% equ 75 (
	set "OPEN_BROWSER="
	echo ライブラリを切り替えて再起動します。 
	goto :RUN
)

rem 画面の「LadyTube を終了」で終わったとき (終了コード 0) は窓を閉じる。エラーのときは止めて、メッセージを読めるようにする (v3.11.0)
if %errorlevel% equ 0 exit /b 0

:ERROR
pause
