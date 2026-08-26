"""
runbooks/registry.py — Pre-approved runbook definitions.
The AI can ONLY propose runbooks that appear in ALLOWED_RUNBOOKS.
The executor maps each name to a concrete HTTP call — no arbitrary shell.
"""
from __future__ import annotations
import os

KARTIFY_URL = os.getenv("KARTIFY_URL", "http://localhost:4000")
KARTIFY_ADMIN_KEY = os.getenv("KARTIFY_ADMIN_KEY", "admin123")

ALLOWED_RUNBOOKS: dict[str, dict] = {
    "restart_backend": {
        "description": "Recover Kartify by calling the /admin/recover endpoint (clears in-memory failure flag).",
        "risk": "LOW",
        "auto_approve": True,
        "executor": "http_hook",
        "method": "POST",
        "url": f"{KARTIFY_URL}/admin/recover",
        "headers": {"x-admin-key": KARTIFY_ADMIN_KEY},
    },
    # Stubs — registered for UI display but disabled for hackathon
    "clear_cache": {
        "description": "Flush application cache layer.",
        "risk": "LOW",
        "auto_approve": True,
        "executor": "stub",
    },
    "rollback_deployment": {
        "description": "Roll back to the previous git commit and restart.",
        "risk": "MEDIUM",
        "auto_approve": False,
        "executor": "stub",
    },
}


def get_runbook(name: str) -> dict | None:
    """Return runbook config or None if not in allowlist."""
    return ALLOWED_RUNBOOKS.get(name)


def is_allowed(name: str) -> bool:
    return name in ALLOWED_RUNBOOKS
