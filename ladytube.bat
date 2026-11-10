chcp 65001 >nul
@echo off

rem [注意] echoは日本語で文末が終わらないようにしてください。エラーになります。

cd /d "%~dp0"

set "SYS_FOLDER=%~dp0.sys"

if not exist "%SYS_FOLDER%" (
	echo "%SYS_FOLDER%" が見つかりません。セットアップしなおしてください。 
	goto :ERROR
)

set NODEJS=node-v24.13.0-win-x64
set FFMPEG=ffmpeg-8.0.1-full_build-shared

set "PATH=%SYS_FOLDER%\%FFMPEG%\bin;%SYS_FOLDER%\%NODEJS%;%PATH%"
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

pause
