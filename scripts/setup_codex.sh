#!/usr/bin/env bash
# Setup dependencies for Codex testing environment
set -euo pipefail

cd frontend
pnpm install
cd ..
cd backend
pnpm install
