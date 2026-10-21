#!/bin/bash
set -e
cd ~/Price-Monitor
source ~/.nvm/nvm.sh
nvm use 22
npm install
echo "Setup done. Run ./dev.sh"
