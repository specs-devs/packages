#!/usr/bin/env python3
"""embed_permissions.py — declare ambient SnapOS permissions in a native module.

Lens Studio (5.23+) reads the `.snap.permissions` ELF section of a native library
and copies its tokens into the NativeLibraryAsset's Permissions, which end up in
the Lens manifest. SnapOS enforces INTERNET at the socket() syscall (eBPF filter):
a Lens whose manifest lacks it gets EACCES from socket(AF_INET, ...), so WebRTC/ICE
can never open a UDP port and the call never connects. INTERNET is an *ambient*
permission that the NDK's automatic embed step never adds (it only harvests the
annotated Specs* APIs), so the module has to declare it itself — this script
unions the given tokens into the section (creating it when absent) using the
NDK's llvm-objcopy, mirroring specs-perm-embed's format:
NUL-separated text, first token SNAP_PERMS_V1, then sorted permission ids.

Usage: embed_permissions.py <SPECSNDK_ROOT> <lib.so> PERMISSION [PERMISSION...]

Verify afterwards with:
    <SPECSNDK_ROOT>/sysroots/<host>/usr/bin/llvm-readelf -p .snap.permissions lib.so
"""
import glob
import os
import subprocess
import sys
import tempfile

MARKER = "SNAP_PERMS_V1"
SECTION = ".snap.permissions"


def find_host_tool(ndk_root, name):
    # Host sysroot (x86_64-specsndk-darwin21 / -linux / -mingw32), not the armv8a target one.
    for cand in sorted(glob.glob(os.path.join(ndk_root, "sysroots", "*", "usr", "bin", name))):
        if "armv8a" not in cand:
            return cand
    sys.exit(f"embed_permissions: {name} not found under {ndk_root}/sysroots/*/usr/bin")


def read_tokens(objcopy, so, tmpdir):
    """Existing tokens, or None when the section is absent."""
    dump = os.path.join(tmpdir, "existing.bin")
    scratch = os.path.join(tmpdir, "scratch.so")
    r = subprocess.run([objcopy, f"--dump-section={SECTION}={dump}", so, scratch], capture_output=True)
    if r.returncode != 0 or not os.path.exists(dump):
        return None
    raw = open(dump, "rb").read().decode("ascii", "replace")
    return [t for t in raw.split("\0") if t]


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    ndk_root, so, wanted = sys.argv[1], sys.argv[2], sys.argv[3:]
    objcopy = find_host_tool(ndk_root, "llvm-objcopy")
    with tempfile.TemporaryDirectory() as td:
        existing = read_tokens(objcopy, so, td)
        tokens = sorted(set(t for t in (existing or []) if t != MARKER) | set(wanted))
        payload = os.path.join(td, "perms.bin")
        with open(payload, "wb") as f:
            f.write(("\0".join([MARKER] + tokens) + "\0").encode("ascii"))
        if existing is not None:
            subprocess.run([objcopy, f"--remove-section={SECTION}", so], check=True)
        subprocess.run([objcopy, f"--add-section={SECTION}={payload}", so], check=True)
    state = "updated" if existing is not None else "created"
    print(f"embed_permissions: {os.path.basename(so)} {SECTION} {state} = {MARKER} {' '.join(tokens)}")


if __name__ == "__main__":
    main()
