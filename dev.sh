#!/bin/bash
set -e
cd ~/Price-Monitor
source ~/.nvm/nvm.sh
nvm use 22 > /dev/null
npm run dev -- --hostname 0.0.0.0 --port 3000
