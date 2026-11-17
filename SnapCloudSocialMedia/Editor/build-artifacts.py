"""Package the editor plugin and a shareable source-project ZIP.

This does not forge a native .lspkg; use export-package.js in Lens Studio for that.
"""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
destination = root / 'Dist'
destination.mkdir(exist_ok=True)
plugin = root / 'Plugins' / 'SnapCloudSocialMedia'
with zipfile.ZipFile(destination / 'SnapCloudSocialMediaPlugin.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(plugin.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(plugin))
with zipfile.ZipFile(destination / 'SnapCloudSocialMediaSource.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part in {'Dist', 'Cache', 'Support', 'Workspaces', 'PluginsUserPreferences', 'node_modules'} for part in relative.parts):
            continue
        if path.is_file() and path.name not in {'.env', 'proxy.config.json'} and not path.name.endswith('.private.json'):
            archive.write(path, Path(root.name) / relative)
print('Created source-project ZIP and editor-plugin ZIP in Dist/')
