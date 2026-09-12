#!/usr/bin/env python3
import argparse
import base64
import io
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


def refresh_manager(manager, saver):
    try:
        manager.customer_api.token_info.expire_time = 0
        manager.customer_api.refresh_access_token_if_need()
    except Exception:
        pass
    return build_manager(saver.session)


def update_device_cache_resilient(manager, saver):
    try:
        manager.update_device_cache()
        return manager, saver
    except Exception as exc:
        if "sign invalid" not in str(exc).lower():
            raise
        retry_manager, retry_saver = refresh_manager(manager, saver)
        retry_manager.update_device_cache()
        return retry_manager, retry_saver


def send_commands_resilient(manager, saver, device_id, commands):
    try:
        manager.send_commands(device_id, commands)
        return manager, saver
    except Exception as exc:
        if "sign invalid" not in str(exc).lower():
            raise
        retry_manager, retry_saver = refresh_manager(manager, saver)
        retry_manager.send_commands(device_id, commands)
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
    return {key: jsonable(getattr(device, key, None)) for key in fields}


def handle(payload):
    action = str(payload.get("action") or "device")

    if action == "reauth_start":
        from tuya_sharing import LoginControl
        import qrcode
        user_code = str(payload.get("user_code") or "").strip()
        client_id = str(payload.get("client_id") or "HA_3y9q4ak7g4ephrvke").strip()
        if not user_code:
            raise ValueError("User Code do Smart Life não disponível.")
        response = LoginControl().qr_code(client_id, "haauthorize", user_code)
        if not response.get("success"):
            raise ValueError("Não foi possível gerar o QR do Smart Life: " + str(response.get("msg") or response.get("code") or "erro desconhecido"))
        token = str((response.get("result") or {}).get("qrcode") or "").strip()
        if not token:
            raise ValueError("Smart Life não retornou o token do QR.")
        qr_data = "tuyaSmart--qrLogin?token=" + token
        image = qrcode.make(qr_data)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return {"ok": True, "token": token, "qr_data": qr_data, "qr_image": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")}

    if action == "reauth_finish":
        from tuya_sharing import LoginControl
        user_code = str(payload.get("user_code") or "").strip()
        client_id = str(payload.get("client_id") or "HA_3y9q4ak7g4ephrvke").strip()
        token = str(payload.get("token") or "").strip()
        if not user_code or not token:
            raise ValueError("Dados de reconexão Smart Life incompletos.")
        authorized, info = LoginControl().login_result(token, client_id, user_code)
        if not authorized:
            return {"ok": True, "authorized": False, "error": str(info.get("msg") or "Autorização ainda não confirmada no Smart Life.")}
        token_info = {"t": info["t"], "uid": info["uid"], "expire_time": info["expire_time"], "access_token": info["access_token"], "refresh_token": info["refresh_token"]}
        return {"ok": True, "authorized": True, "session": {"client_id": client_id, "user_code": user_code, "terminal_id": info["terminal_id"], "endpoint": info["endpoint"], "token_info": token_info}}

    session = payload.get("session")
    if not isinstance(session, dict):
        raise ValueError("Sessão Smart Life ausente.")

    manager, saver = build_manager(session)
    manager, saver = update_device_cache_resilient(manager, saver)
    device = find_device(manager, payload.get("device_id"), payload.get("device_name"))

    if action == "list":
        return {"ok": True, "devices": [device_payload(x) for x in manager.device_map.values()], "session": saver.session}

    if device is None:
        names = [str(getattr(x, "name", "")) for x in manager.device_map.values()]
        raise ValueError("Dispositivo não encontrado. Disponíveis: " + ", ".join(names))

    if action == "command":
        commands = payload.get("commands")
        if not isinstance(commands, list) or not commands:
            raise ValueError("Nenhum comando informado.")
        manager, saver = send_commands_resilient(manager, saver, getattr(device, "id"), commands)
        time.sleep(float(payload.get("confirm_delay", 0.7)))
        manager, saver = update_device_cache_resilient(manager, saver)
        device = find_device(manager, getattr(device, "id", None), payload.get("device_name"))

    return {"ok": True, "device": device_payload(device), "session": saver.session}


def safe_handle(payload):
    try:
        return handle(payload)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def emit(result, request_id=None):
    envelope = result if request_id is None else {"request_id": request_id, "result": result}
    print(MARKER + json.dumps(envelope, ensure_ascii=False, separators=(",", ":")), flush=True)


def run_daemon():
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        request_id = None
        try:
            envelope = json.loads(line)
            request_id = envelope.get("request_id")
            payload = envelope.get("payload")
            if not isinstance(payload, dict):
                raise ValueError("Payload inválido.")
            emit(safe_handle(payload), request_id)
        except Exception as exc:
            emit({"ok": False, "error": str(exc)}, request_id)


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--daemon", action="store_true")
    args, _ = parser.parse_known_args()
    if args.daemon:
        run_daemon()
        return
    payload = json.load(sys.stdin)
    emit(safe_handle(payload))


main()
