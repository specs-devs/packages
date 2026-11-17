# Snap Cloud Social Media

New extracted package; keep SnapCloudExamples and other packages unchanged.
Runtime sources and native assets live under Assets/SnapCloudSocialMedia.lspkg.
The editor panel is in Plugins/SnapCloudSocialMedia; the publishing proxy is in Proxy.

Run `cd Proxy && npm test` and `python3 Editor/verify-assets.py` for local verification.
Provider HTTP is mocked in tests; tests must not create real posts.
SocialConfig.js in the editor plugin is generated from runtime SocialConfig.ts;
regenerate it whenever the public configuration contract changes.
Never put client secrets, provider tokens or a service-role key in Lens assets.
Use Lens Studio MCP/CLAD for editor operations and native package export.
Filesystem validation does not replace preview, export/reimport or live API tests.
