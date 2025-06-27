#!/usr/bin/env bash
# Setup dependencies for Codex testing environment
set -euo pipefail

apt-get update
apt-get install -y nodejs npm
cd frontend
npm install
