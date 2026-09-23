#!/bin/sh
set -u
INTERVAL="${F2E_QA_INTERVAL_SECONDS:-60}"
while true; do
  cd /home/ubuntu/fazenda2e || exit 1
  F2E_QA_LIVE=1 F2E_QA_REPORT=/home/ubuntu/fazenda2e-data/quality-agent.json node scripts/quality-agent.mjs >> /home/ubuntu/fazenda2e-data/quality-agent.log 2>&1 || true
  sleep "$INTERVAL"
done
