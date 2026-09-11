#!/usr/bin/env python3
"""Fazenda 2E irrigation safety watchdog.

This process is intentionally conservative: it never turns irrigation ON.
It only enforces OFF when rain is detected, when a pulse exceeds its deadline,
or when the continuous controller state says the relay should not remain on.
The main Node controller can continue scheduling pulses while this watchdog
protects the physical output independently.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

STATE_FILE = Path(os.environ.get("IRRIGATION_STATE_FILE", "/data/viveiro-seconds.json"))
MARKER = "__F2E_PY_WATCHDOG__"


def emit(kind, **extra):
    payload = {"kind": kind, "at": int(time.time() * 1000), **extra}
    print(MARKER + json.dumps(payload, ensure_ascii=False, separators=(",", ":")), flush=True)


def read_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


class SessionSaver:
    def __init__(self, session):
        self.session = session

    def update_token(self, token_info):
        self.session["token_info"] = {
            key: token_info.get(key)
            for key in ("t", "uid", "expire_time", "access_token", "refresh_token")
        }


def build_manager(session):
    from tuya_sharing import Manager

    saver = SessionSaver(session)
    manager = Manager(
        session.get("client_id", "HA_3y9q4ak7g4ephrvke"),
        session["user_code"],
        session["terminal_id"],
        session["endpoint"],
        session["token_info"],
        saver,
    )
    return manager, saver


def find_device(manager, name):
    target = str(name or "").strip().lower()
    devices = list(manager.device_map.values())
    for device in devices:
        if str(getattr(device, "name", "")).strip().lower() == target:
            return device
    for device in devices:
        if target and target in str(getattr(device, "name", "")).strip().lower():
            return device
    return None


def status_map(device):
    raw = getattr(device, "status", None)
    return raw if isinstance(raw, dict) else {}


def relay_on(device):
    value = status_map(device).get("switch_1")
    return value is True


def rain_detected(device):
    status = status_map(device)
    for code, value in status.items():
        key = str(code).lower()
        text = str(value).strip().lower()
        if re.search(r"rain.*(state|sensor)|precip.*state|weather.*rain", key):
            if value is True or text in {"1", "true", "yes", "rain", "raining", "wet"}:
                return True
        if re.search(r"rain.*(rate|current)|precip.*rate|current.*rain", key):
            try:
                if float(value) > 0:
                    return True
            except (TypeError, ValueError):
                pass
        if key in {"rain", "rainfall", "precipitation"}:
            try:
                if float(value) > 0:
                    return True
            except (TypeError, ValueError):
                if text in {"1", "true", "yes", "rain", "raining", "wet"}:
                    return True
    return False


def force_off(manager, device, reason):
    if device is None:
        return False
    manager.send_commands(getattr(device, "id"), [{"code": "switch_1", "value": False}])
    emit("forced_off", reason=reason, device=str(getattr(device, "name", "Viveiro")))
    return True


def main():
    raw = sys.stdin.readline()
    if not raw:
        raise RuntimeError("Configuração inicial ausente.")
    cfg = json.loads(raw)
    session = cfg.get("session") or {}
    if not session:
        raise RuntimeError("Sessão Smart Life ausente.")

    viveiro_name = str(cfg.get("viveiro_name") or "Viveiro")
    weather_name = str(cfg.get("weather_name") or "Weather2-2")
    poll_seconds = max(2.0, min(15.0, float(cfg.get("poll_seconds") or 5.0)))
    stale_limit = max(10.0, min(120.0, float(cfg.get("weather_stale_seconds") or 25.0)))
    deadline_grace_ms = max(250, min(5000, int(cfg.get("deadline_grace_ms") or 1000)))

    manager, saver = build_manager(session)
    last_weather_ok = 0.0
    last_heartbeat = 0.0
    consecutive_errors = 0
    emit("started", mode="off_only", poll_seconds=poll_seconds)

    while True:
        started = time.monotonic()
        try:
            manager.update_device_cache()
            viveiro = find_device(manager, viveiro_name)
            weather = find_device(manager, weather_name)
            if viveiro is None:
                raise RuntimeError("Viveiro não encontrado no Smart Life.")
            if weather is None:
                raise RuntimeError("Weather2-2 não encontrada no Smart Life.")

            consecutive_errors = 0
            last_weather_ok = time.monotonic()
            state = read_state()
            on = relay_on(viveiro)
            now_ms = int(time.time() * 1000)

            if on and rain_detected(weather):
                force_off(manager, viveiro, "rain")
                time.sleep(0.4)
                manager.update_device_cache()
                continue

            expected_off_at = int(state.get("expected_off_at") or 0)
            if on and expected_off_at > 0 and now_ms >= expected_off_at + deadline_grace_ms:
                force_off(manager, viveiro, "pulse_deadline")
                time.sleep(0.4)
                manager.update_device_cache()
                continue

            phase = str(state.get("phase") or "")
            enabled = bool(state.get("enabled"))
            protected = {
                "weather_blocked", "weather_unavailable", "waiting_after_rain",
                "maintenance", "waiting_window", "emergency_stopped", "stopped"
            }
            if on and (not enabled or phase in protected):
                force_off(manager, viveiro, "state_requires_off")
                time.sleep(0.4)
                manager.update_device_cache()
                continue

            if time.monotonic() - last_heartbeat >= 60:
                emit("heartbeat", relay=on, phase=phase, enabled=enabled)
                last_heartbeat = time.monotonic()

        except Exception as exc:
            consecutive_errors += 1
            emit("error", error=str(exc), consecutive=consecutive_errors)
            state = read_state()
            phase = str(state.get("phase") or "")
            expected_off_at = int(state.get("expected_off_at") or 0)
            now_ms = int(time.time() * 1000)
            # Fail-safe only if the controller itself says a pulse is active and
            # weather has been unavailable long enough. We avoid blind ON/OFF flapping.
            weather_stale = last_weather_ok > 0 and time.monotonic() - last_weather_ok >= stale_limit
            if phase in {"on", "starting_on"} and weather_stale and expected_off_at and now_ms >= expected_off_at:
                try:
                    manager.update_device_cache()
                    viveiro = find_device(manager, viveiro_name)
                    if relay_on(viveiro):
                        force_off(manager, viveiro, "weather_unavailable_at_deadline")
                except Exception as nested:
                    emit("failsafe_error", error=str(nested))

        elapsed = time.monotonic() - started
        time.sleep(max(0.25, poll_seconds - elapsed))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        emit("fatal", error=str(exc))
        raise
