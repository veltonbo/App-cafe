#!/usr/bin/env python3
"""Fazenda 2E Python controller — shadow mode.

This process receives JSON lines from stdin and evaluates the critical irrigation
state without touching the relay. It is intentionally read-only while we compare
its decisions with the production Node controller.
"""
import json
import math
import sys
import time

MARKER = "__F2E_PY_CONTROLLER__"


def finite(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def vpd_kpa(temp_c, humidity):
    t = finite(temp_c)
    h = finite(humidity)
    if t is None or h is None:
        return None
    h = max(0.0, min(100.0, h))
    saturation = 0.6108 * math.exp((17.27 * t) / (t + 237.3))
    return round(saturation * (1.0 - h / 100.0), 3)


def evaluate(payload):
    now = int(time.time() * 1000)
    weather = payload.get("weather") or {}
    seconds = payload.get("seconds") or {}
    safety = payload.get("safety") or {}
    maintenance = payload.get("maintenance") or {}

    checked_at = int(finite(weather.get("checked_at")) or 0)
    weather_age_ms = max(0, now - checked_at) if checked_at else None
    linked = bool(weather.get("linked"))
    online = weather.get("online") is not False
    rain = bool(weather.get("rain_detected"))
    temperature = finite(weather.get("temperature"))
    humidity = finite(weather.get("humidity"))
    vpd = vpd_kpa(temperature, humidity)

    blocked_reason = None
    if safety.get("emergency_latched"):
        blocked_reason = "emergency"
    elif maintenance.get("active"):
        blocked_reason = "maintenance"
    elif not linked or not online:
        blocked_reason = "weather_unavailable"
    elif weather_age_ms is None or weather_age_ms > 30000:
        blocked_reason = "weather_stale"
    elif rain:
        blocked_reason = "rain"

    phase = str(seconds.get("phase") or "")
    relay = seconds.get("device_relay")
    should_force_off = bool(blocked_reason and (relay is True or phase in {"on", "starting_on"}))

    on_s = max(1, int(finite(seconds.get("on_seconds")) or 30))
    off_s = max(1, int(finite(seconds.get("off_seconds")) or 120))
    target_off = off_s
    confidence = "low"
    reason = "Sem leitura climática suficiente."
    if vpd is not None and weather_age_ms is not None and weather_age_ms <= 15000:
        confidence = "high"
        if vpd >= 3.2:
            target_off = max(45, round(off_s * 0.65))
            reason = "VPD muito alto; reduziria o intervalo."
        elif vpd >= 2.3:
            target_off = max(60, round(off_s * 0.80))
            reason = "VPD alto; reduziria o intervalo gradualmente."
        elif vpd <= 0.8:
            target_off = min(240, round(off_s * 1.20))
            reason = "VPD baixo; ampliaria o intervalo."
        else:
            reason = "Condição estável; manteria o ciclo atual."

    return {
        "ok": True,
        "mode": "shadow",
        "controls_output": False,
        "evaluated_at": now,
        "blocked_reason": blocked_reason,
        "should_force_off": should_force_off,
        "weather_age_ms": weather_age_ms,
        "rain_detected": rain,
        "temperature": temperature,
        "humidity": humidity,
        "vpd": vpd,
        "current_cycle": {"on_seconds": on_s, "off_seconds": off_s},
        "target_cycle": {"on_seconds": on_s, "off_seconds": target_off},
        "confidence": confidence,
        "reason": reason,
    }


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
            emit(request_id, evaluate(payload))
        except Exception as exc:
            emit(request_id, {"ok": False, "error": str(exc), "mode": "shadow", "controls_output": False})


if __name__ == "__main__":
    main()
