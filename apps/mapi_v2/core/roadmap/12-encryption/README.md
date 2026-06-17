# Módulo `12-encryption` (core) — cifrado simétrico

> Pieza de **substrato** del core (infra, no dominio). Cifra/descifra strings con AES-256-GCM. La usan los plugins que guardan secretos: intuit (tokens), bancos (credenciales), api-keys. Cripto = infraestructura del core (modelo WordPress: el core provee la cripto; los plugins la consumen).

> **Arquitectura:** [`../../../README.md`](../../../README.md) · **Decisiones:** [`../README.md`](../README.md) · **Diferidos:** [`../BACKLOG.md`](../BACKLOG.md).

## Qué resuelve

Que ningún plugin guarde secretos en claro ni reinvente cripto. Un solo `EncryptionService` (`@Global`) que cualquier plugin inyecta.

## Alcance

| Pieza             | Ubicación         | Qué es                                                    |
| ----------------- | ----------------- | --------------------------------------------------------- |
| EncryptionService | `core/encryption` | `encrypt`/`decrypt` AES-256-GCM (formato `iv:authTag:ct`) |
| EncryptionModule  | `core/encryption` | `@Global`, exporta el service                             |
| config            | `core/config`     | `ENCRYPTION_KEY` (32 bytes base64) validado al boot       |

## Compatibilidad con mapi

El formato (`aes-256-gcm`, `iv:authTag:ciphertext` en base64) es **idéntico al de mapi**, a propósito: la migración de tokens reales del prod viejo (intuit v0.2.0) los desencripta con la misma `ENCRYPTION_KEY`. (D-core-026)

## Versiones

| Versión | Estado | Tema                                    |
| ------- | ------ | --------------------------------------- |
| v0.3.0  | ✅     | EncryptionService (AES-256-GCM) en core |
