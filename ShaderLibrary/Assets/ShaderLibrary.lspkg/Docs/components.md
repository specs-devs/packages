# ShaderLibrary materials and parameters

[← Agent usage index](../README.md)

## Use when

Read for all seven public graph/material families and exact paths.

## Material families

All paths below are under consumer prefix `ShaderLibrary.lspkg/`. There are no script exports and no package-defined @inputs/methods/events (the demo scaffolding in `Example/` below is not library API).

| Family | Material path | Example material | Graph path |
|---|---|---|---|
| Unlit | `Materials/Unlit/Unlit.mat` | `Materials/Unlit [EXAMPLE].mat` | `Materials/Unlit/unlit.graphShader` |
| Simple | `Materials/Simple/Simple.mat` | `Materials/Simple [EXAMPLE].mat` | `Materials/Simple/simple_glasses.graphShader` |
| Uber | `Materials/Uber/Uber.mat` | `Materials/Uber [EXAMPLE].mat` | `Materials/Uber/uber.graphShader` |
| Toon | `Materials/Toon/Toon.mat` | `Materials/Toon [EXAMPLE].mat` | `Materials/Toon/toon_spec.graphShader` |
| Matcap | `Materials/Matcap/Matcap.mat` | `Materials/Matcap [EXAMPLE].mat` | `Materials/Matcap/matcap_glasses.graphShader` |
| Rim Highlight | `Materials/Rim Highight/Rim Highlight.mat` | `Materials/Rim Highlight [EXAMPLE].mat` | `Materials/Rim Highight/rim_highlight_glasses.graphShader` |
| Outer Glow | `Materials/Outer Glow/Outer_Glow.mat` | `Materials/Outer_Glow [EXAMPLE].mat` | `Materials/Outer Glow/outer_glow.graphShader` |

`Meshes/Sphere.mesh` is used by the example prefab. `Textures/` includes Water_BaseColor, Lava_BaseColor/Emissive/NormalMap, Noise_Electro_A/B and sixteen `Textures/Matcaps/Matcap_*` variants. Assign through asset references; these are not loadShader string registry keys.

## Demo scaffolding (`Example/`)

Shipped with the package so the `ShaderLibrary__PLACE_IN_SCENE` prefab works on its own. Not part of the
ShaderLibrary API; reuse or delete them freely.

- `Example/GuideDismissPanel/GuideDismissPanel.ts` — on the prefab's `Guide` object (UIKit
  `Frame` + `OkButton`). Inputs: `buttonLabel` (default "Ok, I understood"),
  `hideUntilDismissed: SceneObject[]` (disabled while the guide shows, enabled on dismiss; in the
  prefab: the seven example groups, then `ExampleCarousel` last so the carousel re-shows only one
  example). Never list the prefab root there — it contains the guide.
- `Example/ExampleCarousel/ExampleCarousel.ts` — on the prefab's `ExampleCarousel` object: a
  Previous / Next panel with a minimize button that shows one example at a time. Inputs:
  `examples: SceneObject[]` (in the prefab: `Unlit`, `Simple`, `Uber`, `Toon`, `Matcap`,
  `Rim Highlight`, `Outer Glow`), `exampleInfo: string[]`, `steps: SceneObject[]`, `stepInfo: string[]`
  (one line per step, same order as `steps`; an empty entry falls back to the step's example info), `startIndex`,
  `previousLabel` / `nextLabel`, `examplesPushBack` (cm), `anchorExamples`, `startMinimized`,
  `extraPanelDrop` (cm).

All seven groups are authored at the same position, (0, −16, −120), so the carousel shows them
one at a time in the same spot.

## Render states

The same family render-state settings appear on base/example materials:

| Material family | Depth write/test | Cull | Blend |
|---|---|---|---|
| Unlit | true/true | Back | PremultipliedAlphaAuto |
| Simple | true/true | Back | PremultipliedAlphaAuto |
| Uber | true/true | Back | PremultipliedAlphaAuto |
| Toon | true/true | Back | Disabled |
| Matcap | true/true | Back | PremultipliedAlphaAuto |
| Rim Highlight | false/true | Back | Screen |
| Outer Glow | false/false | Front (`TwoSided: true`) | Screen |

All other materials are `TwoSided: false`. Material saved Properties override graph defaults; check the exact asset. Unlit's saved baseColor is approximately (0.754070,0.754086,0.754070,1). Runtime material writes should target a clone when values differ by object.

## Graph parameter index

This index covers named ScriptName ports. Texture2D/image ports select textures; color/float kinds are authored graph parameter templates and may be configured to scalar/vector channels. Do not infer a TS type solely from the graph node's four-element default record. Compiled variant determines actual mainPass property availability. Static switches need variant configuration in Inspector; generated dropdown/Tweak names are not a stable public API.


### Unlit

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `baseColor` | color | no | Specifies the base color (albedo) of the material if the 'Base Textre' is disabled.  Multiplied with the 'Base Texture' otherwise. |
| `opacityTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_EMISSIVE` | bool | yes | Enables the emissive texture. |
| `emissiveTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `emissiveColor` | color | no | Multiplies the existing emissive color.  Requires 'Enable Emissive' and/or 'Vertex Color' should be set to 'Emissive'. |
| `emissiveIntensity` | float | no | Multiplies the existing emissive color.  Requires 'Enable Emissive' and/or 'Vertex Color' should be set to 'Emissive'. |
| `ENABLE_RIM_HIGHLIGHT` | bool | yes | 'Rim highlight', aka. 'fake Fresnel effect'. |
| `rimColor` | color | no | Specifies the color of the rim highlight. |
| `rimIntensity` | float | no | Multiplied with 'Rim Color'. |
| `ENABLE_BASE_TEX` | bool | yes | Most materials use a base texture (albedo), but disabling it means the base texture will be considered white, and 'Base Color' will solely control the color. |
| `rimExponent` | float | no | Controls the tightness of the rim highlight. |
| `rimInvert` | bool | yes | Inverts the effect so it's brighter in the middle of the object and darker at the edge. |
| `rimTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_UV2` | bool | yes | Allows tiling and animation of texture coordinates. |
| `uv2Scale` | float | no | Allows tiling of textures. |
| `uv2Offset` | float | no | Allows shifting of textures, or controls the speed of scrolling if animation is enabled.  If animation is enabled, the speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will |
| `uv2EnableAnimation` | bool | yes | If this is enabled, the UV's will scroll. In this case the Offset specifies the speed of scrolling.  The speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will scroll throug |
| `baseTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_UV3` | bool | yes | Allows tiling and animation of texture coordinates. |
| `uv3Scale` | float | no | Allows tiling of textures. |
| `uv3Offset` | float | no | Allows shifting of textures, or controls the speed of scrolling if animation is enabled.  If animation is enabled, the speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will |
| `uv3EnableAnimation` | bool | yes | If this is enabled, the UV's will scroll. In this case the Offset specifies the speed of scrolling.  The speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will scroll throug |
| `ENABLE_RECOLOR` | bool | yes | Recolor replaces colors in the base texture.  This is useful for adding variety to assets, ex: recolor a red shirt with a green logo to a blue shirt with a black logo, or any other color com |
| `recolorRed` | color | no | Use selected material Inspector; no authored explanation. |
| `recolorGreen` | color | no | Use selected material Inspector; no authored explanation. |
| `recolorBlue` | color | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_OPACITY_TEX` | bool | yes | Normally, the Base Texture's alpha is taken as opacity. Enabling this allows you to define a separate greyscale opacity texture.  The 'Opacity Texture' value will be multiplied with the Base |

### Simple

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `baseColor` | color | no | Specifies the base color (albedo) of the material if the 'Base Textre' is disabled.  Multiplied with the 'Base Texture' otherwise. |
| `baseTexture` | bool | yes | Most materials use a base texture (albedo), but disabling it means the base texture will be considered white, and 'Base Color' will solely control the color. |
| `baseTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_RIM` | bool | yes | Use selected material Inspector; no authored explanation. |
| `ENABLE_ANIMATED_BASE` | bool | yes | Allows shifting of textures, or controls the speed of scrolling if animation is enabled. |
| `ENABLE_OPACITY_TEX` | bool | yes | Normally, the Base Texture's alpha is taken as opacity. Enabling this allows you to define a separate greyscale opacity texture.  The 'Opacity Texture' value will be multiplied with the Base |
| `ENABLE_ANIMATED` | bool | yes | Allows shifting of textures, or controls the speed of scrolling if animation is enabled. |
| `opacityScale` | float | no | Use selected material Inspector; no authored explanation. |
| `opacityTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `baseScale` | float | no | Use selected material Inspector; no authored explanation. |

### Uber

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `baseColor` | color | no | Specifies the base color (albedo) of the material if the 'Base Textre' is disabled.  Multiplied with the 'Base Texture' otherwise. |
| `matcapIntensity` | float | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_MATCAP_NORMAL` | bool | yes | Enables the normal map for the matcap reflection |
| `matcapNormal` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `rimColor` | color | no | Specifies the color of the rim highlight. |
| `rimIntensity` | float | no | Multiplied with 'Rim Color'. |
| `rimExponent` | float | no | Controls the tightness of the rim highlight. |
| `rimTex` | bool | yes | Allows the use of a texture to modulate the rim highlight color. |
| `ENABLE_RIM_INVERT` | bool | yes | Inverts the effect so it's brighter in the middle of the object and darker at the edge. |
| `ENABLE_BASE_TEX` | bool | yes | Most materials use a base texture (albedo), but disabling it means the base texture will be considered white, and 'Base Color' will solely control the color. |
| `rimColorTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_RECOLOR` | bool | yes | Recolor replaces colors in the base texture.  This is useful for adding variety to assets, ex: recolor a red shirt with a green logo to a blue shirt with a black logo, or any other color com |
| `recolorRed` | color | no | Use selected material Inspector; no authored explanation. |
| `recolorGreen` | color | no | Use selected material Inspector; no authored explanation. |
| `recolorBlue` | color | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_OPACITY_TEX` | bool | yes | Normally, the Base Texture's alpha is taken as opacity. Enabling this allows you to define a separate greyscale opacity texture.  The 'Opacity Texture' value will be multiplied with the Base |
| `opacityTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_EMISSIVE` | bool | yes | Enables the emissive texture. |
| `baseTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `emissiveTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `emissiveColor` | color | no | Multiplies the existing emissive color.  Requires 'Enable Emissive' and/or 'Vertex Color' should be set to 'Emissive'. |
| `emissiveIntensity` | float | no | Multiplies the existing emissive color.  Requires 'Enable Emissive' and/or 'Vertex Color' should be set to 'Emissive'. |
| `ENABLE_UV2` | bool | yes | Allows tiling and animation of texture coordinates. |
| `uv2Scale` | float | no | Allows tiling of textures. |
| `uv2Offset` | float | no | Allows shifting of textures, or controls the speed of scrolling if animation is enabled.  If animation is enabled, the speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will |
| `uv2EnableAnimation` | bool | yes | If this is enabled, the UV's will scroll. In this case the Offset specifies the speed of scrolling.  The speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will scroll throug |
| `ENABLE_UV3` | bool | yes | Allows tiling and animation of texture coordinates. |
| `uv3Scale` | float | no | Allows tiling of textures. |
| `uv3Offset` | float | no | Allows shifting of textures, or controls the speed of scrolling if animation is enabled.  If animation is enabled, the speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will |
| `uv3EnableAnimation` | bool | yes | If this is enabled, the UV's will scroll. In this case the Offset specifies the speed of scrolling.  The speed is 'Offset' UVs per second. So if 'Offset' is 2, the texture will scroll throug |
| `ENABLE_MATCAP` | bool | yes | Recolor replaces colors in the base texture.  This is useful for adding variety to assets, ex: recolor a red shirt with a green logo to a blue shirt with a black logo, or any other color com |
| `matcapTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |

### Toon

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `ENABLE_BASE_TEXTURE` | bool | yes | Use selected material Inspector; no authored explanation. |
| `baseTex` | image | no | Use selected material Inspector; no authored explanation. |
| `specularPositionY` | float | no | Use selected material Inspector; no authored explanation. |
| `baseColor` | color | no | Use selected material Inspector; no authored explanation. |
| `shadowIntensity` | float | no | Use selected material Inspector; no authored explanation. |
| `lineColor` | color | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_OPACITY_TEXTURE` | bool | yes | Use selected material Inspector; no authored explanation. |
| `opacityTexture` | image | no | Use selected material Inspector; no authored explanation. |
| `lineWeight` | float | no | Use selected material Inspector; no authored explanation. |
| `specularSize` | float | no | Use selected material Inspector; no authored explanation. |
| `specularPositionX` | float | no | Use selected material Inspector; no authored explanation. |

### Matcap

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `ENABLE_MATCAP` | bool | yes | Matcap - Projects a material capture (Matcap) texture using the object’s surface normal and camera orientation to simulate lighting and reflections. The effect rotates with the view, giving  |
| `matcapTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `matcapIntensity` | float | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_NORMAL` | bool | yes | Use selected material Inspector; no authored explanation. |
| `normalTex` | image | no | Use selected material Inspector; no authored explanation. |

### Rim Highlight

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `baseColor` | color | no | Specifies the base color (albedo) of the material if the 'Base Textre' is disabled.  Multiplied with the 'Base Texture' otherwise. |
| `rimTexture` | bool | yes | Most materials use a base texture (albedo), but disabling it means the base texture will be considered white, and 'Base Color' will solely control the color. |
| `scrollSpeed` | float | no | Use selected material Inspector; no authored explanation. |
| `baseTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_RIM` | bool | yes | Use selected material Inspector; no authored explanation. |
| `rimColor` | color | no | Use selected material Inspector; no authored explanation. |
| `rimInvert` | bool | no | Use selected material Inspector; no authored explanation. |
| `rimExponent` | float | no | Use selected material Inspector; no authored explanation. |
| `rimIntensity` | float | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_ANIMATED_BASE` | bool | yes | Allows shifting of textures, or controls the speed of scrolling if animation is enabled. |
| `baseScale` | float | no | Use selected material Inspector; no authored explanation. |
| `scrollDirection` | float | no | Use selected material Inspector; no authored explanation. |

### Outer Glow

Graph-authored named ports; static marks compile switches. Default node records are not selected material defaults.

| ScriptName | Graph parameter kind | Static | Meaning from authored tooltip |
|---|---|---|---|
| `baseColor` | color | no | Specifies the base color (albedo) of the material if the 'Base Textre' is disabled.  Multiplied with the 'Base Texture' otherwise. |
| `baseTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `glowFalloff` | float | no | Use selected material Inspector; no authored explanation. |
| `ENABLE_ANIMATED_BASE` | bool | yes | Use selected material Inspector; no authored explanation. |
| `ENABLE_OPACITY_TEX` | bool | yes | Normally, the Base Texture's alpha is taken as opacity. Enabling this allows you to define a separate greyscale opacity texture.  The 'Opacity Texture' value will be multiplied with the Base |
| `ENABLE_ANIMATED` | bool | yes | Use selected material Inspector; no authored explanation. |
| `opacityScale` | float | no | Use selected material Inspector; no authored explanation. |
| `opacityTex` | texture2d_object | no | Use selected material Inspector; no authored explanation. |
| `glowDistance` | float | no | Use selected material Inspector; no authored explanation. |
| `baseScale` | float | no | Use selected material Inspector; no authored explanation. |
