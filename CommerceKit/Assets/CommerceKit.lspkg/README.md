<p align="center">
  <img src="Docs/media/CommerceKit.png" width="250px" alt="CommerceKit"/>
</p>

# CommerceKit

CommerceKit manages a product catalog, non-consumable purchase flows and cached ownership for Specs. Its example prefab supplies a configured catalog and a purchase panel. Lens Studio uses an in-memory mock purchase path.

## Features

- Singleton access to catalog, product information and ownership.
- Product definitions with USD prices, display names and metadata.
- Device purchase flow and transaction acknowledgement.
- Editor mock purchases for the configured products.
- Purchase-panel example using UIKit.

## Usage

This section ships with the package and describes the installed package. Generic Lens scripting, scene construction and Specs spatial design live in CLAD skills; package-specific setup and APIs live here.

### Package identity

- Descriptor: `package.native` (package version and Lens Studio target are recorded there).
- Consumer import prefix: `CommerceKit.lspkg/`.
- Prefab entry point: `CommerceKit__PLACE_IN_SCENE.prefab`. The prefab is self-contained:
  it carries the guide panel ("Ok, I understood"), the example carousel, the product catalog and
  the two purchase panels (valid and missing product), so dropping it into a Specs scene with a
  Camera and SpectaclesInteractionKit gives the full demo. You don't need it to use CommerceKit in your own Lens.
- Demo scaffolding: `CommerceKit.lspkg/Example/` holds the scripts the prefab uses
  (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the CommerceKit API; see
  [components](Docs/components.md#demo-scaffolding-example).
- Declared companions: SpectaclesInteractionKit, SpectaclesUIKit, Utilities, SnapDecorators, Motion and Icons (see `package_dependencies.json`).

### Version and API status

Read [API status](Docs/api-status.md) before copying older recipes. ProductCatalog's inspector labels identify the service as Closed Beta and link to access requirements; this revision does not establish present service availability or publish eligibility.

### Applicability

Use CommerceKit for the native commerce flow. For a local experience with no payment, implement its own state instead of creating a commerce client. The editor mock confirms local UI behavior only.

### Related CLAD skills

[specs-build-ui](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-build-ui/SKILL.md) and [specs-interaction-recipes](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-interaction-recipes/SKILL.md) cover the project UI and hand interactions; [lens-api](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/lens-api/SKILL.md) covers generic component lifecycle; [specs-publish](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-publish/SKILL.md) covers publication.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first; catalog, units and mock rules.
- [API status](Docs/api-status.md): compatibility, service status and device gaps.
- [Components](Docs/components.md): inputs, defaults and public methods.
- [Examples](Docs/examples.md): initialization, product UI and guarded purchase calls.
- [Guide](Docs/guide.md): the previous README's catalog, multi-product and ownership workflows, corrected against this source.
- [Troubleshooting](Docs/troubleshooting.md): initialization, UI and transaction symptoms.

### Verification

1. Compile with the installed package's declarations and resolve every prefab input.
2. Dismiss the demo guide, inspect product name/price/status and drive an editor mock purchase.
3. Confirm ownership updates and repeated purchase requests do not create another transaction.
4. Reset Preview: mock ownership is in memory and should return to its initial state.
5. Device billing, cancellation, history and acknowledgement require dedicated authorized commerce QA; an editor mock cannot verify them.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->




