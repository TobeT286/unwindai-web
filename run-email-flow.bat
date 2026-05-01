@echo off
cd /d "%~dp0"
if not exist logs mkdir logs
node agents/flows/email-flow.js >> logs\email-flow.log 2>&1
