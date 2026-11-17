#!/usr/bin/env bash
#
# specs_enable_transparent_permissions.sh — let a Specs dev unit install a Lens that
# combines a sensor permission (microphone / camera) with INTERNET.
#
# SnapOS's permission manager refuses that combination outright while Transparent
# Permissions is disabled ("TAINT VIOLATION … with Transparent Permissions disabled"
# in journalctl, "PkgManagerError: Failed to set up permissions" in Lens Studio).
# With it enabled the install succeeds and the wearer gets a consent prompt for
# microphone + internet when the Lens launches (tap Allow — a denial is remembered).
#
# The switch is the system property below; the permission manager reads it once at
# start, so the service is restarted. The property persists across reboots.
#
# Works with the macOS default bash 3.2. Needs adb on PATH (brew install android-platform-tools).
#
# Usage:
#   bash scripts/specs_enable_transparent_permissions.sh            # every connected Specs
#   bash scripts/specs_enable_transparent_permissions.sh <serial>   # one device, e.g. 41402SR5Z61050020_app
set -eo pipefail

PROP="persist.snap.permissions.transparent_enabled"
SERVICE="snap_permissionmanager.service"

ADB="$(command -v adb || true)"
if [ -z "$ADB" ]; then
  for c in /opt/homebrew/bin/adb /usr/local/bin/adb "$HOME/Library/Android/sdk/platform-tools/adb"; do
    if [ -x "$c" ]; then ADB="$c"; break; fi
  done
fi
if [ -z "$ADB" ]; then
  echo "adb not found — install Android platform-tools (brew install android-platform-tools)." >&2
  exit 2
fi

devices=""
if [ $# -ge 1 ]; then
  devices="$1"
else
  # Each Specs shows up twice: <serial>_app (lens runtime) and <serial>_cv. Only _app matters.
  devices="$("$ADB" devices | awk '$1 ~ /_app$/ && $2 == "device" {print $1}')"
fi

if [ -z "$devices" ]; then
  echo "No Specs connected ('adb devices' shows no *_app entry). Plug the glasses in and retry." >&2
  "$ADB" devices
  exit 1
fi

status=0
for dev in $devices; do
  echo "== $dev"
  before="$("$ADB" -s "$dev" shell getprop "$PROP" | tr -d '\r')"
  echo "   $PROP was: ${before:-<unset>}"
  "$ADB" -s "$dev" shell setprop "$PROP" 1
  "$ADB" -s "$dev" shell systemctl restart "$SERVICE"
  sleep 2
  after="$("$ADB" -s "$dev" shell getprop "$PROP" | tr -d '\r')"
  active="$("$ADB" -s "$dev" shell systemctl is-active "$SERVICE" | tr -d '\r')"
  if [ "$after" = "1" ] && [ "$active" = "active" ]; then
    echo "   OK — Transparent Permissions enabled, $SERVICE $active."
    echo "   Now Send the Lens from Lens Studio and tap Allow on the glasses when it asks for microphone + internet."
  else
    echo "   FAILED — $PROP=$after, $SERVICE=$active" >&2
    status=1
  fi
done
exit $status
