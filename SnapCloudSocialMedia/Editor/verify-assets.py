"""Static source integrity checks; does not claim an editor/preview pass."""
from pathlib import Path
import json
import re
import zipfile

root = Path(__file__).resolve().parent.parent
package = root / 'Assets' / 'SnapCloudSocialMedia.lspkg'
uid = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
known = {'00000000-0000-0000-0000-000000000000'}

def ids(text):
    return set(re.findall(r'!<[^>\n]+/(' + uid + r')>', text)) | set(re.findall(r'(?:PrimaryAsset|[A-Za-z0-9_]+): !<reference> (' + uid + r')', text))

for file in (root / 'Assets').rglob('*'):
    if file.is_file() and file.suffix in {'.meta', '.prefab', '.scene', '.native', '.mat', '.renderTarget', '.micaudio'}:
        known |= ids(file.read_text())
archives = {}
for file in (root / 'Packages').glob('*.lspkg'):
    with zipfile.ZipFile(file) as archive:
        archives[file.name] = set(archive.namelist())
        for name in archive.namelist():
            if name.endswith(('.meta', '.prefab', '.native')):
                known |= ids(archive.read(name).decode('utf8'))

for file in [root / 'Assets' / 'Scene.scene', package / 'SnapCloudSocialMedia__PLACE_IN_SCENE.prefab', package / 'package.native']:
    text = file.read_text()
    references = set(re.findall(r'!<(?:reference(?:\.[^>]+)?|MappingBased\.[^>]+)> (' + uid + r')', text))
    missing = references - known
    if missing:
        raise SystemExit(f'Unresolved asset references in {file.name}: {sorted(missing)}')
    owned = set(re.findall(r'!<own> (' + uid + r')', text)) - {'00000000-0000-0000-0000-000000000000'}
    definitions = set(re.findall(r'^- !<[^>\n]+/(' + uid + r')>', text, re.M))
    if owned - definitions:
        raise SystemExit(f'Missing owned records in {file.name}: {sorted(owned - definitions)}')

for file in (package / 'Scripts').glob('*.ts'):
    text = file.read_text()
    for name in re.findall(r"requireAsset\(['\"]([^'\"]+)['\"]\)", text):
        if not (file.parent / name).resolve().is_file():
            raise SystemExit(f'Missing required asset: {file.name}: {name}')
    for name in re.findall(r"from ['\"]([^'\"]+)['\"]", text):
        if name.startswith('.'):
            if not (file.parent / (name + '.ts')).resolve().is_file():
                raise SystemExit(f'Missing local module: {file.name}: {name}')
        elif '.lspkg/' in name:
            archive, relative = name.split('/', 1)
            if not any('Package/Assets/' + relative + suffix in archives.get(archive, set()) for suffix in ('.ts', '.js', '.d.ts')):
                raise SystemExit(f'Missing dependency module: {file.name}: {name}')

config = json.loads((package / 'social.config.json').read_text())
assert config['demoMode'] is True, 'Distributed example must default to demo mode'
assert len(config['destinations']) == 7
assert set(config['destinations']) == {p.stem for p in (package / 'Icons').glob('*.png')}
scene_id = re.search(r'^sceneId: (.+)$', (root / 'SnapCloudSocialMedia.esproj').read_text(), re.M)[1]
assert (root / 'Assets' / 'Scene.scene').read_text().startswith(f'- !<Scene/{scene_id}>')
assert json.loads((root / 'Plugins' / 'SnapCloudSocialMedia' / 'module.json').read_text())['main'] == 'main.js'
print('Static checks passed: scene/prefab references, owned records, dependency imports, required assets, seven icons, demo config, manifest and plugin entry point.')
