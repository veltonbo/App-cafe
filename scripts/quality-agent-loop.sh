#!/bin/sh
set -u
INTERVAL="${F2E_QA_INTERVAL_SECONDS:-60}"
DEEP_EVERY="${F2E_QA_DEEP_EVERY:-15}"
N=0
while true; do
  cd /home/ubuntu/fazenda2e || exit 1
  N=$((N+1))
  if [ "$N" -ge "$DEEP_EVERY" ]; then
    F2E_QA_LIVE=1 F2E_QA_FAST=0 F2E_QA_NOTIFY=1 F2E_QA_REPORT=/home/ubuntu/fazenda2e-data/quality-agent.json node scripts/quality-agent.mjs >> /home/ubuntu/fazenda2e-data/quality-agent.log 2>&1 || true
    N=0
  else
    F2E_QA_LIVE=1 F2E_QA_FAST=1 F2E_QA_NOTIFY=0 F2E_QA_REPORT=/home/ubuntu/fazenda2e-data/quality-agent.json node scripts/quality-agent.mjs >> /home/ubuntu/fazenda2e-data/quality-agent.log 2>&1 || true
  fi
  sleep "$INTERVAL"
done
