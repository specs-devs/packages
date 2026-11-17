# How the raymarcher works

[← Agent usage index](../README.md)

`Shaders/MetaballField.graphShader` is one custom-code node (Pixel stage) fed by material parameters. The GLSL is mirrored in `Shaders/MetaballField.glsl.md`.

## Signed distance fields and the smooth union

Each ball is a sphere SDF: `length(p - centre) - radius` (negative inside, positive outside, zero on the surface). A plain `min` of two SDFs gives two overlapping spheres. The polynomial smooth minimum

```glsl
float smin(float a, float b, float k) {
	float h = max(k - abs(a - b), 0.0) / k;
	return min(a, b) - h * h * k * 0.25;
}
```

pulls the surface outward wherever the two distances are within `k` of each other, which grows a smooth bridge between the balls — the metaball look. `k` is the `smoothness` parameter (object space); `MetaballField.smoothness` sets it to `smoothness × 2 × mean ball radius`.

## Sphere tracing

For each pixel the ray steps forward by the field's distance (always safe: nothing is closer than that), up to 32 steps, until the distance is below a small epsilon (hit) or the ray leaves the volume (miss → `discard`).

## The proxy volume

The mesh is a sphere that `MetaballField` moves and scales every frame to enclose the balls plus the blend band and `fitMargin`. The material draws only its **back faces** (`cullMode = Front`), and the shader intersects the ray with the bounding sphere analytically, so marching starts where the ray enters the volume — or at the eye when you stand inside it. Depth write is off (the back face's depth is not the goo's).

## Stereo

The ray origin is the eye of the view being rendered (`inverse(view) * (0,0,0,1)`), so each eye gets its own ray and the goo has correct depth. `eyeMode = 1` switches to the original orb's method (centre camera + `eyeOffset` cm per eye).

## Shading

Normal: 4-tap tetrahedral gradient of the field. Colour: each ball has a tint along `colorA → colorB` by index, mixed by proximity. Light: a key light fixed relative to the camera (up-right, toward you), wrapped diffuse, Blinn specular from `gloss`, a fresnel rim in `rimColor`, an iridescent hue shift from `iridescence`, plus scene point lights when present. `intensity` scales the result.

## Add your own SDF shape

Add a term to `fieldSdf` in the code node and blend it with `smin`, for example a torus around the first ball:

```glsl
float sdTorus(vec3 p, vec2 t) {
	vec2 q = vec2(length(p.xz) - t.x, p.y);
	return length(q) - t.y;
}
// in fieldSdf, before the wobble:
d = smin(d, sdTorus(p - ball0.xyz, vec2(ball0.w * 1.6, ball0.w * 0.3)), k);
```

Keep sizes in object space (relative to `boundRadius`/the ball radii), keep the shape inside the volume (raise `fitMargin` if it's clipped) and keep `MAX_STEPS` modest. Good references: Inigo Quilez's distance functions and smooth minimum articles.
