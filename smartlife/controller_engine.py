#!/usr/bin/env python3
"""Fazenda 2E irrigation decision/timing engine.

The Node service remains the API/session/Smart Life transport layer. This Python
process is the authority for cycle timing and safety decisions so UI/report work
cannot change pulse deadlines.
"""
import json
import math
import sys
import time

MARKER = "__F2E_PY_ENGINE__"


def finite(value, default=None):
    try:
        n = float(value)
        return n if math.isfinite(n) else default
    except (TypeError, ValueError):
        return default


def clamp_int(value, low, high, default):
    n = finite(value, default)
    return max(low, min(high, int(round(n))))


def decide(payload):
    now = int(finite(payload.get("now"), int(time.time() * 1000)))
    phase = str(payload.get("phase") or "ready")
    enabled = bool(payload.get("enabled", True))
    schedule_inside = bool(payload.get("schedule_inside", False))
    weather_usable = bool(payload.get("weather_usable", False))
    raining = bool(payload.get("raining", False))
    emergency = bool(payload.get("emergency", False))
    maintenance = bool(payload.get("maintenance", False))
    on_s = clamp_int(payload.get("on_seconds"), 1, 300, 30)
    off_s = clamp_int(payload.get("off_seconds"), 1, 900, 120)

    blocked = None
    if not enabled:
        blocked = "disabled"
    elif emergency:
        blocked = "emergency"
    elif maintenance:
        blocked = "maintenance"
    elif not schedule_inside:
        blocked = "outside_schedule"
    elif not weather_usable:
        blocked = "weather_unavailable"
    elif raining:
        blocked = "rain"

    result = {
        "ok": True,
        "engine": "python_primary_v1",
        "evaluated_at": now,
        "phase": phase,
        "blocked_reason": blocked,
        "on_seconds": on_s,
        "off_seconds": off_s,
    }

    if blocked:
        result.update({
            "action": "force_off",
            "relay_wanted": False,
            "reason": blocked,
        })
        return result

    if phase in {"ready", "starting", "off_due"}:
        result.update({
            "action": "turn_on",
            "relay_wanted": True,
            "reason": "cycle_ready",
        })
        return result

    if phase in {"on", "starting_on"}:
        started_at = int(finite(payload.get("relay_on_at"), now))
        deadline = started_at + on_s * 1000
        result.update({
            "action": "keep_on" if now < deadline else "turn_off",
            "relay_wanted": now < deadline,
            "off_deadline_at": deadline,
            "remaining_ms": max(0, deadline - now),
            "reason": "pulse_active" if now < deadline else "pulse_deadline",
        })
        return result

    if phase in {"off", "interval"}:
        off_at = int(finite(payload.get("relay_off_at"), now))
        deadline = off_at + off_s * 1000
        result.update({
            "action": "wait" if now < deadline else "turn_on",
            "relay_wanted": False if now < deadline else True,
            "next_on_at": deadline,
            "remaining_ms": max(0, deadline - now),
            "reason": "interval_active" if now < deadline else "interval_complete",
        })
        return result

    result.update({"action": "wait", "relay_wanted": False, "reason": "unknown_phase"})
    return result


def emit(request_id, result):
    print(MARKER + json.dumps({"request_id": request_id, "result": result}, ensure_ascii=False, separators=(",", ":")), flush=True)


def main():
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        request_id = None
        try:
            envelope = json.loads(line)
            request_id = envelope.get("request_id")
            payload = envelope.get("payload") or {}
            emit(request_id, decide(payload))
        except Exception as exc:
            emit(request_id, {"ok": False, "error": str(exc), "engine": "python_primary_v1"})


if __name__ == "__main__":
    main()
