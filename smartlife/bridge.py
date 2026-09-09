#!/usr/bin/env python3
import json
import sys
import time

TOKEN_FIELDS = ("t", "uid", "expire_time", "access_token", "refresh_token")
MARKER = "__SMARTLIFE_JSON__"


def jsonable(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    if hasattr(value, "__dict__"):
        return {str(k): jsonable(v) for k, v in vars(value).items()}
    return str(value)


class SessionSaver:
    def __init__(self, session):
        self.session = session

    def update_token(self, token_info):
        self.session["token_info"] = {
            key: token_info.get(key) for key in TOKEN_FIELDS
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


def update_device_cache_resilient(manager, saver):
    try:
        manager.update_device_cache()
        return manager, saver
    except Exception as exc:
        message = str(exc).lower()
        if "sign invalid" not in message:
            raise

        # A SDK renova o token automaticamente perto do vencimento, mas uma
        # sessão que perdeu a rotação pode precisar de uma renovação forçada.
        # Tentamos uma vez antes de declarar que a autenticação precisa ser refeita.
        try:
            manager.customer_api.token_info.expire_time = 0
            manager.customer_api.refresh_access_token_if_need()
        except Exception:
            pass

        retry_manager, retry_saver = build_manager(saver.session)
        retry_manager.update_device_cache()
        return retry_manager, retry_saver


def find_device(manager, device_id=None, device_name=None):
    devices = list(manager.device_map.values())

    if device_id:
        for device in devices:
            if str(getattr(device, "id", "")) == str(device_id):
                return device

    target = str(device_name or "").strip().lower()
    if target:
        for device in devices:
            if str(getattr(device, "name", "")).strip().lower() == target:
                return device
        for device in devices:
            if target in str(getattr(device, "name", "")).strip().lower():
                return device

    return None


def device_payload(device):
    if device is None:
        return None
    fields = (
        "name", "id", "uuid", "product_id", "product_name", "category", "ip",
        "online", "support_local", "status", "function", "status_range",
        "local_strategy", "time_zone", "sub"
    )
    return {
        key: jsonable(getattr(device, key, None))
        for key in fields
    }


def main():
    payload = json.load(sys.stdin)
    session = payload.get("session")
    if not isinstance(session, dict):
        raise ValueError("Sessão Smart Life ausente.")

    manager, saver = build_manager(session)
    manager, saver = update_device_cache_resilient(manager, saver)

    action = str(payload.get("action") or "device")
    device = find_device(
        manager,
        payload.get("device_id"),
        payload.get("device_name"),
    )

    if action == "list":
        devices = [device_payload(x) for x in manager.device_map.values()]
        return {
            "ok": True,
            "devices": devices,
            "session": saver.session,
        }

    if device is None:
        names = [str(getattr(x, "name", "")) for x in manager.device_map.values()]
        raise ValueError(
            "Dispositivo não encontrado. Disponíveis: " + ", ".join(names)
        )

    if action == "command":
        commands = payload.get("commands")
        if not isinstance(commands, list) or not commands:
            raise ValueError("Nenhum comando informado.")
        manager.send_commands(getattr(device, "id"), commands)
        time.sleep(float(payload.get("confirm_delay", 0.7)))
        manager.update_device_cache()
        device = find_device(
            manager,
            getattr(device, "id", None),
            payload.get("device_name"),
        )

    return {
        "ok": True,
        "device": device_payload(device),
        "session": saver.session,
    }


try:
    result = main()
except Exception as exc:
    result = {"ok": False, "error": str(exc)}

print(MARKER + json.dumps(result, ensure_ascii=False, separators=(",", ":")))
