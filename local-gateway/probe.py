#!/usr/bin/env python3
"""
Teste SOMENTE LEITURA dos dispositivos configurados em config.json.
Por segurança, este script NÃO envia comandos.
"""
import json
from pathlib import Path
import tinytuya

CONFIG = Path(__file__).with_name("config.json")

if not CONFIG.exists():
    raise SystemExit("Crie local-gateway/config.json a partir de config.example.json.")

cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
devices = cfg.get("devices") or []

if not devices:
    raise SystemExit("Nenhum dispositivo configurado.")

for item in devices:
    name = item.get("name") or item.get("id") or "Dispositivo"
    print("\n===", name, "===")
    try:
        d = tinytuya.Device(
            item["id"],
            item["ip"],
            item["local_key"],
            version=float(item.get("version", 3.3)),
        )
        d.set_socketPersistent(False)
        status = d.status()
        print(json.dumps(status, indent=2, ensure_ascii=False))
    except Exception as exc:
        print("FALHA:", exc)
