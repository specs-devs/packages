# MetaballField shader source

Source of truth for the custom-code node in `MetaballField.graphShader` (node "Metaball Field", Pixel stage).
If the graph ever needs rebuilding: create a Shader Graph with one **Custom Code** node (Stage: Pixel), paste the code
below, add one **Float Parameter** node per `input_*` (Channels: `xyzw` for the `ball*` vec4s, `rgb` for the
colours, `x` for floats) with the **Script Name** equal to the input name, connect each to its port, and connect
`color` to the Shader output's **Final Color**.

Material settings (`MetaballField.mat`): Blend Mode Normal (opaque output, misses are discarded), Depth Test on,
Depth Write off, Cull Mode Front (back faces), Two-Sided off. `MetaballField.ts` also sets these on its clone.

| Parameter | Channels | Default | Notes |
| --- | --- | --- | --- |
| `ball0`…`ball7` | xyzw | 0,0,0,0 | xyz centre (object space), w radius; 0 = off |
| `boundRadius` | x | 1 | usable proxy-sphere radius (object space) |
| `smoothness` | x | 0.2 | smooth-union band (object space) |
| `rippleScale` | x | 0.2 | ripple size (object space) |
| `wobble` | x | 0 | ripple strength |
| `intensity` | x | 1 | brightness |
| `colorA` / `colorB` / `rimColor` | rgb | Bubblegum | tints / rim |
| `gloss` | x | 0.7 | specular |
| `iridescence` | x | 0.4 | hue shift |
| `eyeMode` / `eyeOffset` | x | 0 / 3.25 | ray origin mode / manual eye offset (cm) |

```glsl
// Metaball Field: raymarched smooth-union spheres inside a proxy sphere mesh.
// Up to 8 balls; each is xyz = centre in the mesh's object space, w = radius (0 = off).
// All sizes are in the proxy mesh's object space; MetaballField.ts converts from cm every frame.
input_vec4 ball0;
input_vec4 ball1;
input_vec4 ball2;
input_vec4 ball3;
input_vec4 ball4;
input_vec4 ball5;
input_vec4 ball6;
input_vec4 ball7;
input_float boundRadius;
input_float smoothness;
input_float rippleScale;
input_float wobble;
input_float intensity;
input_vec3 colorA;
input_vec3 colorB;
input_vec3 rimColor;
input_float gloss;
input_float iridescence;
input_float eyeMode;
input_float eyeOffset;

output_vec4 color;

#define MAX_STEPS 32

// Polynomial smooth minimum (k in object units): blends the two surfaces over a band of width k.
float smin(float a, float b, float k)
{
	float h = max(k - abs(a - b), 0.0) / max(k, 1e-5);
	return min(a, b) - h * h * k * 0.25;
}

float ballSdf(vec3 p, vec4 b)
{
	// Off balls are pushed far away so they never win the union.
	return b.w > 0.0 ? length(p - b.xyz) - b.w : 1e5;
}

float fieldSdf(vec3 p)
{
	float k = smoothness;
	float d = ballSdf(p, ball0);
	d = smin(d, ballSdf(p, ball1), k);
	d = smin(d, ballSdf(p, ball2), k);
	d = smin(d, ballSdf(p, ball3), k);
	d = smin(d, ballSdf(p, ball4), k);
	d = smin(d, ballSdf(p, ball5), k);
	d = smin(d, ballSdf(p, ball6), k);
	d = smin(d, ballSdf(p, ball7), k);
	if (wobble > 0.0) {
		// Cheap travelling ripples, scaled to the field so they look the same at any size.
		float gTime = system.getTimeElapsed();
		vec3 q = p / max(rippleScale, 1e-5) * 2.2;
		d += wobble * rippleScale * 0.08 * sin(q.x + gTime * 1.7) * sin(q.y * 1.3 + gTime * 1.1) * sin(q.z * 0.9 + gTime * 1.3);
	}
	return d;
}

vec3 fieldNormal(vec3 p, float eps)
{
	// Tetrahedral 4-tap gradient.
	vec2 e = vec2(1.0, -1.0) * eps;
	return normalize(
		e.xyy * fieldSdf(p + e.xyy) +
		e.yyx * fieldSdf(p + e.yyx) +
		e.yxy * fieldSdf(p + e.yxy) +
		e.xxx * fieldSdf(p + e.xxx));
}

// Colour of the surface point: each ball has its own tint along colorA → colorB, mixed by proximity.
vec3 ballTint(vec3 p)
{
	float w0 = ball0.w > 0.0 ? 1.0 / (pow(max(length(p - ball0.xyz) - ball0.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w1 = ball1.w > 0.0 ? 1.0 / (pow(max(length(p - ball1.xyz) - ball1.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w2 = ball2.w > 0.0 ? 1.0 / (pow(max(length(p - ball2.xyz) - ball2.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w3 = ball3.w > 0.0 ? 1.0 / (pow(max(length(p - ball3.xyz) - ball3.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w4 = ball4.w > 0.0 ? 1.0 / (pow(max(length(p - ball4.xyz) - ball4.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w5 = ball5.w > 0.0 ? 1.0 / (pow(max(length(p - ball5.xyz) - ball5.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w6 = ball6.w > 0.0 ? 1.0 / (pow(max(length(p - ball6.xyz) - ball6.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float w7 = ball7.w > 0.0 ? 1.0 / (pow(max(length(p - ball7.xyz) - ball7.w, 0.0) + 0.02 * boundRadius, 2.0)) : 0.0;
	float sum = w0 + w1 + w2 + w3 + w4 + w5 + w6 + w7;
	float t = (w1 * 1.0 + w2 * 2.0 + w3 * 3.0 + w4 * 4.0 + w5 * 5.0 + w6 * 6.0 + w7 * 7.0) / max(sum, 1e-5) / 7.0;
	return mix(colorA, colorB, t);
}

vec3 eyePositionWorld()
{
	if (eyeMode > 0.5) {
		// Proto fallback: centre camera + a manual per-eye offset (eyeOffset cm).
		float side = (float(system.getStereoViewIndex()) - 0.5) * 2.0;
		return system.getCameraPosition() + system.getCameraRight() * side * eyeOffset;
	}
	// Default: the eye of the view being rendered (per-eye in stereo).
	return (system.getMatrixViewInverse() * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
}

void main()
{
	float gTime = system.getTimeElapsed();
	mat4 worldInv = system.getMatrixWorldInverse();
	vec3 ro = (worldInv * vec4(eyePositionWorld(), 1.0)).xyz;
	vec3 rd = normalize(system.getSurfacePositionObjectSpace() - ro);

	// Clip the ray to the bounding sphere (the proxy mesh), so we only march where the field can be.
	float R = max(boundRadius, 1e-4);
	float b = dot(ro, rd);
	float c = dot(ro, ro) - R * R;
	float disc = b * b - c;
	if (disc <= 0.0) {
		discard;
	}
	float sq = sqrt(disc);
	float tNear = max(-b - sq, 0.0);
	float tFar = -b + sq;

	float eps = 0.0015 * R;
	float t = tNear;
	bool hit = false;
	for (int i = 0; i < MAX_STEPS; i++) {
		float d = fieldSdf(ro + rd * t);
		if (d < eps) {
			hit = true;
			break;
		}
		t += d;
		if (t > tFar) {
			break;
		}
	}
	if (!hit) {
		discard;
	}

	vec3 p = ro + rd * t;
	vec3 nObj = fieldNormal(p, 0.01 * R);
	vec3 n = normalize((system.getMatrixWorld() * vec4(nObj, 0.0)).xyz);
	vec3 pW = (system.getMatrixWorld() * vec4(p, 1.0)).xyz;
	vec3 v = normalize(eyePositionWorld() - pW);

	// Camera-relative key light (up-right, slightly in front), so the look is the same wherever you stand.
	vec3 l = normalize(system.getCameraUp() * 0.8 + system.getCameraRight() * 0.5 - system.getCameraForward() * 0.6);
	vec3 h = normalize(l + v);
	float ndl = max(dot(n, l), 0.0);
	float ndv = clamp(dot(n, v), 0.0, 1.0);
	float fres = pow(1.0 - ndv, 3.0);

	vec3 base = ballTint(p);
	vec3 iri = 0.5 + 0.5 * cos(6.2831 * (fres * 1.2 + n.y * 0.25 + vec3(0.0, 0.33, 0.67) + gTime * 0.04));
	base = mix(base, base * 0.5 + iri * 0.8, iridescence * (0.35 + 0.65 * fres));

	float wrap = 0.3 + 0.7 * ndl;
	float specPow = mix(8.0, 160.0, gloss);
	float spec = pow(max(dot(n, h), 0.0), specPow) * (0.15 + gloss * 1.6);
	vec3 col = base * wrap + vec3(spec) + rimColor * fres * 1.4;

	// Scene lights add to the key light when present (e.g. a point light parked near the field).
	for (int i = 0; i < system.getPointLightCount(); i++) {
		vec3 lp = normalize(system.getPointLightPosition(i) - pW);
		col += base * max(dot(n, lp), 0.0) * system.getPointLightColor(i) * system.getPointLightIntensity(i) * 0.5;
	}

	color = vec4(col * intensity, 1.0);
}
```
