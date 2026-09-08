#!/usr/bin/env python3
"""
Descoberta SOMENTE LEITURA de dispositivos Tuya na rede local.
Não liga/desliga nenhum equipamento.
"""
import json
import tinytuya

print("Procurando dispositivos Tuya na rede local...")
devices = tinytuya.deviceScan(verbose=False, maxretry=3)
print(json.dumps(devices, indent=2, ensure_ascii=False))
