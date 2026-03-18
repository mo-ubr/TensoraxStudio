@echo off
REM Git commit script for Tensorax Studio
REM This commits all changes and pushes to GitHub

git add .
git commit -m "tensorax: session checkpoint"
git push