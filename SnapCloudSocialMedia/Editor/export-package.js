// ExecuteEditorCode async function body. Run by absolute path through CLAD/MCP
// with this example project loaded. Native export is an editor operation.
const model = pluginSystem.findInterface(Editor.Model.IModel);
if (!model.project || Editor.isNull(model.project)) throw new Error('Open SnapCloudSocialMedia first');
const am = model.project.assetManager;
const source = new Editor.Model.SourcePath(new Editor.Path('SnapCloudSocialMedia.lspkg/package.native'), Editor.Model.SourceRootDirectory.Assets);
const meta = am.getFileMeta(source);
if (!meta || Editor.isNull(meta)) throw new Error('Package descriptor has not imported yet');
const FS = await import('LensStudio:FileSystem');
const output = model.project.projectDirectory.appended(new Editor.Path('Dist'));
FS.createDir(output, {recursive: true});
const pluginZip = output.appended(new Editor.Path('SnapCloudSocialMediaPlugin.zip'));
if (!FS.exists(pluginZip)) throw new Error('Run python3 Editor/build-artifacts.py before native export');
meta.primaryAsset.version = new Editor.Assets.Version(0, 1, 0, '');
const options = new Editor.Model.ExportOptions();
options.packagePolicy = Editor.Assets.PackagePolicy.CanBeUnpackedTransparent;
options.pluginsToInclude = [pluginZip];
// Dependencies are referenced in package_dependencies.json. The native exporter
// resolves them; do not manufacture a ZIP and rename it .lspkg.
const actions = pluginSystem.findInterface(Editor.IPackageActions);
const destination = output.appended(new Editor.Path('SnapCloudSocialMedia.lspkg'));
actions.exportPackage(meta.primaryAsset, destination, options);
return {exported: destination.toString(), pluginIncluded: pluginZip.toString(), previewVerified: false};
