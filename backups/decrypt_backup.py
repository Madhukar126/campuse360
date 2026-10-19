#!/usr/bin/env python3
"""Verify/decrypt an application data export locally. Never connects to a database."""
import argparse
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def decrypt(backup_path, key_path):
    encrypted_bytes = Path(backup_path).read_bytes()
    recovery = json.loads(Path(key_path).read_text(encoding="utf-8"))
    if recovery.get("format") != "campus360-recovery-key/v1":
        raise ValueError("Unsupported recovery key format")
    if hashlib.sha256(encrypted_bytes).hexdigest() != recovery["backup_sha256"]:
        raise ValueError("Backup checksum does not match this recovery key")
    envelope = json.loads(encrypted_bytes)
    if (envelope.get("format"), envelope.get("algorithm"), envelope.get("compression")) != (
        "campus360-encrypted-backup/v1", "AES-256-GCM", "gzip"
    ):
        raise ValueError("Unsupported backup format")
    header = {k: envelope[k] for k in ("format", "algorithm", "compression", "metadata")}
    metadata = header["metadata"]
    if metadata["backup_id"] != recovery["backup_id"]:
        raise ValueError("Recovery key belongs to another backup")
    key = base64.b64decode(recovery["key_b64"], validate=True)
    nonce = base64.b64decode(envelope["nonce_b64"], validate=True)
    ciphertext = base64.b64decode(envelope["ciphertext_b64"], validate=True)
    if len(key) != 32 or len(nonce) != 12:
        raise ValueError("Invalid key or nonce length")
    compressed = AESGCM(key).decrypt(nonce, ciphertext, canonical(header))
    plaintext = gzip.decompress(compressed)
    if len(plaintext) != metadata["payload_bytes"]:
        raise ValueError("Payload length mismatch")
    if hashlib.sha256(plaintext).hexdigest() != metadata["payload_sha256"]:
        raise ValueError("Payload checksum mismatch")
    payload = json.loads(plaintext)
    if payload.get("format") != "campus360-app-data/v1":
        raise ValueError("Unsupported application data format")
    if payload["project_ref"] != metadata["project_ref"] or payload["exported_at"] != metadata["exported_at"]:
        raise ValueError("Snapshot metadata mismatch")
    counts = {name: value["count"] for name, value in payload["tables"].items()}
    if counts != metadata["row_counts"]:
        raise ValueError("Table inventory mismatch")
    if any(value["count"] != len(value["rows"]) for value in payload["tables"].values()):
        raise ValueError("Table row count mismatch")
    return plaintext, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    parser.add_argument("--key-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, help="Write sensitive decrypted JSON; refuses to overwrite an existing file")
    args = parser.parse_args()
    try:
        plaintext, counts = decrypt(args.backup, args.key_file)
        if args.output:
            fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as output:
                output.write(plaintext)
        print(f"Verified {len(counts)} application tables and {sum(counts.values())} rows.")
        if args.output:
            print("Decrypted JSON saved to the requested local path.")
    except (ValueError, KeyError, TypeError, OSError, InvalidTag) as error:
        parser.exit(1, "Verification failed; no database was changed. " + type(error).__name__ + "\n")


if __name__ == "__main__":
    main()
