@echo off
REM Quick commit and push with a custom message
REM Usage: push.bat "your commit message"
IF "%~1"=="" (
    git add -A && git commit -m "tensorax: quick update" && git push
) ELSE (
    git add -A && git commit -m "%~1" && git push
)
