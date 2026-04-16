#!/bin/sh
set -e

# Ensure data directories exist and are owned by deepreader
# (the volume mount may arrive as root-owned)
mkdir -p /data/library /data/vault
chown -R deepreader:deepreader /data

exec su-exec deepreader "$@"
