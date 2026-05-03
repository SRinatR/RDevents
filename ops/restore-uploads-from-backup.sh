#!/usr/bin/env bash
set -euo pipefail
ARCHIVE="${1:?archive required}"
tar -xzf "$ARCHIVE" -C /
