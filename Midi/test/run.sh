#!/usr/bin/env bash
# Run the MIDI core unit tests. Requires node 22+ (built-in TS type-stripping).
# Behavior contract for the Midi.lspkg package. Must stay green.
set -euo pipefail
cd "$(dirname "$0")"

FILTER='ExperimentalWarning|--import|trace-warnings'
fail=0
total_pass=0
total_fail=0
files=(MidiParser.test.ts ClockTracker.test.ts SourceClockUnwrapper.test.ts BleMidiTransport.test.ts BleMidiFixtures.test.ts MidiTypes.test.ts MidiEventBuilder.test.ts LeafMidiInteractor.test.ts)
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
for t in "${files[@]}"; do
  echo "=== $t ==="
  # Capture the node process exit code independently of the display filter. A
  # crash AFTER a clean-looking "N passed, 0 failed" line must still fail the
  # run, so trust the exit code, not just the parsed summary.
  set +e
  node --experimental-strip-types --import ./_register.mjs "$t" > "$tmp" 2>&1
  rc=$?
  set -e
  grep -Ev "$FILTER" "$tmp" || true
  if [ "$rc" -ne 0 ]; then
    echo "!! $t exited non-zero ($rc)"
    fail=1
  fi
  # Each test file prints a trailing "N passed, M failed" summary. Parse it to
  # accumulate an aggregate. A missing summary means the file did not complete.
  line=$(grep -E '[0-9]+ passed, [0-9]+ failed' "$tmp" | tail -1 || true)
  if [ -z "$line" ]; then
    echo "!! $t produced no summary line (did not run to completion)"
    fail=1
    continue
  fi
  p=${line%% passed*}
  rest=${line#*passed, }
  f=${rest%% failed*}
  total_pass=$((total_pass + p))
  total_fail=$((total_fail + f))
  [ "$f" -ne 0 ] && fail=1
done
echo "=== TOTAL ==="
echo "${total_pass} passed, ${total_fail} failed across ${#files[@]} files"
exit $fail
