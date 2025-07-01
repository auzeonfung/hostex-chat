#!/usr/bin/env bash
# Setup dependencies for Codex testing environment
set -euo pipefail

cd frontend
npm install
cd ../backend
npm install
