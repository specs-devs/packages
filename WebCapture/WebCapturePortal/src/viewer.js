// SPECS Inc. 2027
// three.js view of a captured scene. Lens Studio and three.js share conventions (+Y up, right-handed,
// cameras look down -Z), and we keep Lens Studio's centimetres as scene units.
//
// The WebGL canvas is drawn into a 2D "composite" canvas together with titles and the watermark, so
// the preview and the exported video are the same picture.
import * as THREE from "three";
import {OrbitControls} from "three/addons/OrbitControls.js";
import {TransformControls} from "three/addons/TransformControls.js";
import {logoRect, logoSvg} from "./logo.js";
import {cropWindow, defaultFx, LOOKS, shotAt} from "./model.js";
import {VideoTrack, videoSupported, VIDEO_PROFILE, videoIntrinsics} from "./video.js";
import {quatFromRotVec, stabAt} from "./matchmove.js";
import {drawHandMask} from "./handseg.js";

function rgb(c) {
  const col = new THREE.Color();
  if (Array.isArray(c)) col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  else col.set(c || "#cccccc");
  return col;
}

/**
 * Text as the Lens draws it: a flat quad that belongs to the object, so it takes the object's position, rotation and
 * scale (turn the panel and its text turns with it; seen from the side it foreshortens). Editor labels use textSprite
 * instead, which always faces the camera because they are annotations, not part of the Lens.
 */
function textPlane(text, color, fontPx) {
  const sprite = textSprite(text, color, fontPx);
  const map = sprite.material.map;
  const w = map.image.width / 20;
  const h = map.image.height / 20; // ~ cm, as the sprite was
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({map, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: true, toneMapped: false})
  );
  sprite.material.dispose();
  mesh.userData.text = text;
  mesh.renderOrder = 1000; // draws over the meshes it sits on, but still hides behind nearer ones
  return mesh;
}

function textSprite(text, color, fontPx) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const lines = String(text || "")
    .split("\n")
    .slice(0, 6);
  const size = Math.max(20, Math.min(96, Math.round(fontPx || 48)));
  const font = "500 " + size + "px Inter, system-ui, -apple-system, sans-serif";
  ctx.font = font;
  const pad = Math.round(size * 0.5);
  const w = Math.max(64, ...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  const lineH = Math.round(size * 1.25);
  canvas.width = Math.ceil(w);
  canvas.height = lines.length * lineH + pad * 2;
  ctx.font = font;
  ctx.fillStyle = color || "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(size * 0.18);
  lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, pad + i * lineH));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthWrite: false, depthTest: false}));
  sprite.scale.set(canvas.width / 20, canvas.height / 20, 1); // ~ cm
  sprite.userData.text = text;
  sprite.renderOrder = 1000; // text always draws over the meshes it sits on (no z-fighting)
  return sprite;
}

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Builds a BufferGeometry from a recorded mesh asset {p, n?, u?, i?} (base64 little-endian arrays). */
export function geometryFromAsset(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(b64ToBuffer(a.p)), 3));
  if (a.n) g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(b64ToBuffer(a.n)), 3));
  if (a.u) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(b64ToBuffer(a.u)), 2));
  if (a.i) g.setIndex(new THREE.BufferAttribute(new Uint32Array(b64ToBuffer(a.i)), 1));
  if (!a.n) g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class Viewer {
  constructor(container) {
    this.container = container;
    this.gl = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.gl,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.fx = defaultFx();
    this.autoFloorY = 0;
    // The shadow plane: a unit square (lying flat) scaled to its size, the catcher for cast shadows, plus an
    // alignment grid that only shows while you move it.
    this.shadowPlane = new THREE.Group();
    this.floorCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({color: 0x000000, opacity: 0.55})
    );
    this.floorCatcher.rotation.x = -Math.PI / 2;
    this.floorCatcher.receiveShadow = true;
    this.shadowPlane.add(this.floorCatcher);
    this.alignGrid = new THREE.Group();
    const grid = new THREE.GridHelper(1, 10, 0xffd600, 0xffd600);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.material.depthTest = false;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({color: 0xffd600, transparent: true, opacity: 0.12, depthTest: false, side: THREE.DoubleSide})
    );
    fill.rotation.x = -Math.PI / 2;
    this.alignGrid.add(grid, fill);
    this.alignGrid.renderOrder = 900;
    this.alignGrid.visible = false;
    this.shadowPlane.add(this.alignGrid);
    this.shadowPlane.visible = false;
    this.aligning = false;
    this.onPlaneChange = null;
    this.composite = document.createElement("canvas");
    this.composite.className = "viewport-canvas";
    this.ctx = this.composite.getContext("2d");
    container.appendChild(this.composite);

    this.scene = new THREE.Scene();
    this.root = new THREE.Group(); // capture origin
    this.scene.add(this.root);
    this.grid = new THREE.GridHelper(600, 60, 0x5a6070, 0x2c3038);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.6;
    this.scene.add(this.grid);
    this.originMarker = new THREE.AxesHelper(12);
    this.scene.add(this.originMarker);
    this.lights = new THREE.Group();
    this.scene.add(this.lights);
    this.scene.add(this.shadowPlane);

    this.orbitCamera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 20000);
    this.orbitCamera.position.set(120, 110, 180);
    this.lensCamera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 20000);
    this.shotCamera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 20000);
    this.controls = new OrbitControls(this.orbitCamera, this.composite);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 20, 0);
    this.transform = new TransformControls(this.orbitCamera, this.composite);
    this.transform.setSpace("world");
    this.transform.setSize(0.8);
    this.transform.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
    });
    this.scene.add(this.transform.getHelper());
    this.planeTransform = new TransformControls(this.orbitCamera, this.composite);
    this.planeTransform.setSpace("world");
    this.planeTransform.setSize(0.9);
    this.planeTransform.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
      this.planeDragging = !!e.value;
    });
    this.planeTransform.addEventListener("objectChange", () => this.planeMoved());
    this.scene.add(this.planeTransform.getHelper());
    this.planeTransform.getHelper().visible = false;

    this.objects = new Map();
    this.assets = null; // recording.assets: {meshes, textures}
    this.textureCache = new Map();
    this.geometryCache = new Map();
    this.background = null; // {t: [], images: [HTMLImageElement|null]}
    this.cameraMode = "orbit";
    this.look = LOOKS.studio;
    this.showLabels = false;
    this.logo = {on: true, color: "white", place: "bottom-right", size: 0.18};
    this.logoImages = {};
    this.titles = [];
    this.selected = null;
    this.onSelect = null;
    this.onOffsetDrag = null;
    this.lensMarker = this.makeLensMarker();
    this.scene.add(this.lensMarker);
    this.setLook("studio");
    this.fixedSize = null; // {width, height} while exporting

    this.composite.addEventListener("pointerdown", (e) => this.pick(e));
    this.transform.addEventListener("objectChange", () => this.dragged());
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  makeLensMarker() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5, 3),
      new THREE.MeshStandardMaterial({color: 0xffd600, roughness: 0.4})
    );
    g.add(body);
    const lens = new THREE.Mesh(
      new THREE.ConeGeometry(4, 10, 20),
      new THREE.MeshStandardMaterial({color: 0xffd600, transparent: true, opacity: 0.35})
    );
    lens.rotation.x = -Math.PI / 2;
    lens.position.z = -6;
    g.add(lens);
    g.visible = false;
    return g;
  }

  setLook(name, background) {
    this.lookName = name;
    this.lookBackground = background;
    this.look = LOOKS[name] || LOOKS.studio;
    this.background = background || this.look.background;
    this.background2 = background || this.look.background2;
    this.grid.visible = !!this.look.grid && !this.backgroundFrames;
    this.lights.clear();
    const shadowsOn = this.fx.shadows.on && this.look.style !== "wire";
    const dl = this.fx.light;
    if (dl && dl.on) {
      // The user's own directional light: one key light plus a fill that grows with softness (soft = less contrast
      // between the lit and the unlit side). It also gives the shadow plane its direction and softness.
      const soft = Math.max(0, Math.min(1, dl.softness));
      const intensity = Math.max(0, dl.intensity);
      this.lights.add(new THREE.HemisphereLight(0xffffff, 0x404050, 0.25 + soft * 1.5));
      const key = new THREE.DirectionalLight(new THREE.Color(dl.color || "#ffffff"), intensity);
      const az = (dl.rotation * Math.PI) / 180;
      const el = (Math.max(1, Math.min(90, dl.height)) * Math.PI) / 180;
      key.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(400);
      if (shadowsOn) {
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        const c = key.shadow.camera;
        c.left = c.bottom = -220;
        c.right = c.top = 220;
        c.near = 10;
        c.far = 1200;
        key.shadow.radius = 1 + soft * 7;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.6;
      }
      this.lights.add(key);
      this.floorCatcher.material.opacity = this.fx.shadows.strength;
      this.applyPlane(shadowsOn);
      this.renderer.shadowMap.enabled = shadowsOn;
      this.renderer.shadowMap.needsUpdate = true;
      for (const entry of this.objects.values()) this.styleEntry(entry);
      return;
    }
    const amb = new THREE.HemisphereLight(0xffffff, 0x404050, this.look.light === "flat" ? 2.2 : 1.1);
    this.lights.add(amb);
    if (this.look.light !== "flat" || shadowsOn) {
      const key = new THREE.DirectionalLight(
        0xffffff,
        this.look.light === "sun" ? 2.6 : this.look.light === "flat" ? 1.0 : 1.8
      );
      const az = (this.fx.shadows.azimuth * Math.PI) / 180,
        el = (this.fx.shadows.elevation * Math.PI) / 180;
      key.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(400);
      if (shadowsOn) {
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        const c = key.shadow.camera;
        c.left = c.bottom = -220;
        c.right = c.top = 220;
        c.near = 10;
        c.far = 1200;
        key.shadow.radius = 1 + this.fx.shadows.softness * 7;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.6;
      }
      this.lights.add(key);
      if (this.look.light === "rim" || this.look.light === "soft") {
        const rim = new THREE.DirectionalLight(0x9fc4ff, this.look.light === "rim" ? 2.0 : 0.6);
        rim.position.set(-200, 120, -220);
        this.lights.add(rim);
      }
    }
    this.floorCatcher.material.opacity = this.fx.shadows.strength;
    this.applyPlane(shadowsOn);
    this.renderer.shadowMap.enabled = shadowsOn;
    this.renderer.shadowMap.needsUpdate = true;
    for (const entry of this.objects.values()) this.styleEntry(entry);
  }

  /** Puts the shadow plane where edits.fx.shadows.plane says (or flat at the lowest point while it is unset). */
  applyPlane(shadowsOn) {
    const pl = this.fx.shadows.plane;
    if (pl && !this.planeDragging) {
      this.shadowPlane.position.set(pl.p[0], pl.p[1] + 0.05, pl.p[2]);
      this.shadowPlane.quaternion.set(pl.q[0], pl.q[1], pl.q[2], pl.q[3]);
      this.shadowPlane.scale.set(pl.s, pl.s, pl.s);
    } else if (!pl) {
      this.shadowPlane.position.set(0, this.autoFloorY + 0.05, 0);
      this.shadowPlane.quaternion.identity();
      this.shadowPlane.scale.set(400, 400, 400);
    }
    this.shadowPlane.visible = !!shadowsOn || this.aligning;
    this.floorCatcher.visible = !!shadowsOn;
  }

  /** The plane as stored in the edits, read from the current gizmo state. */
  planePose() {
    const g = this.shadowPlane;
    return {
      p: [g.position.x, g.position.y - 0.05, g.position.z].map((v) => Math.round(v * 100) / 100),
      q: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w].map((v) => Math.round(v * 10000) / 10000),
      s: Math.round(g.scale.x * 10) / 10
    };
  }

  planeMoved() {
    // Keep the scale uniform (a square plane), then report it.
    const g = this.shadowPlane;
    g.scale.set(g.scale.x, g.scale.x, g.scale.x);
    this.fx.shadows.plane = this.planePose();
    if (this.onPlaneChange) this.onPlaneChange(this.fx.shadows.plane);
  }

  /**
   * If the plane's centre is not on screen, put it where the camera looks: on the floor at the lowest height of the
   * scene (or in front of the camera when looking up), so there is always something to grab.
   */
  centerPlaneInView() {
    const cam = this.activeCamera(this.lastShots, this.lastT || 0);
    cam.updateMatrixWorld(true);
    const ndc = this.shadowPlane.position.clone().project(cam);
    if (ndc.z < 1 && Math.abs(ndc.x) < 0.85 && Math.abs(ndc.y) < 0.85) return;
    const origin = cam.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const y = this.shadowPlane.position.y;
    let target;
    if (dir.y < -0.05) {
      const t = (y - origin.y) / dir.y;
      target = origin.clone().addScaledVector(dir, Math.min(t, 600));
      target.y = y;
    } else {
      target = origin.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 120);
      target.y = y;
    }
    this.shadowPlane.position.copy(target);
    this.fx.shadows.plane = this.planePose();
    if (this.onPlaneChange) this.onPlaneChange(this.fx.shadows.plane);
  }

  /** Shows the alignment grid and gizmo (or hides them). Mode: translate | rotate | scale. */
  setAligning(on, mode) {
    this.aligning = !!on;
    this.alignGrid.visible = this.aligning;
    if (this.aligning) {
      if (!this.fx.shadows.plane) {
        // Start from where the shadow would be now, so the first drag is relative to something sensible.
        this.fx.shadows.plane = this.planePose();
        this.fx.shadows.plane.s = Math.max(60, this.fx.shadows.plane.s / 4);
        this.applyPlane(true);
        if (this.onPlaneChange) this.onPlaneChange(this.fx.shadows.plane);
      }
      this.shadowPlane.visible = true;
      this.centerPlaneInView();
      this.planeTransform.attach(this.shadowPlane);
      this.planeTransform.setMode(mode || "translate");
    } else {
      this.planeTransform.detach();
      this.applyPlane(this.fx.shadows.on);
    }
  }

  /** Applies edits.fx (shadows are rebuilt with the look's lights). `floorY` is the auto floor in cm. */
  setFx(fx, floorY) {
    this.fx = fx;
    if (floorY != null) this.autoFloorY = floorY;
    this.setLook(this.lookName || "studio", this.lookBackground);
  }

  /** Sets the recording's meshes, textures and background frames (all optional). */
  setAssets(rec) {
    this.aspect = rec && rec.meta && rec.meta.aspect > 0 ? rec.meta.aspect : null;
    // The real color camera (Specs): the scene is drawn through its field of view, position and principal point.
    this.calib = rec && rec.meta && rec.meta.camera && rec.meta.camera.focal ? rec.meta.camera : null;
    this.resize();
    this.assets = (rec && rec.assets) || null;
    this.textureCache.clear();
    this.geometryCache.clear();
    const bg = rec && rec.background;
    this.backgroundFrames = null;
    if (this.videoTrack) {
      this.videoTrack.close();
      this.videoTrack = null;
    }
    this.videoNote = "";
    // The camera video is the zoomed NDK crop: project the virtual content the same way
    this.hasVideo = !!(bg && bg.video);
    this.vprofile = this.hasVideo ? Object.assign({}, VIDEO_PROFILE) : null;
    if (bg && bg.video && bg.video.batches && bg.video.batches.length) {
      if (videoSupported()) {
        const track = new VideoTrack(bg.video);
        track.setShift(this.videoShift || 0);
        this.videoTrack = track;
        track.init().then((ok) => {
          if (!ok && this.videoTrack === track) {
            this.videoNote = "This browser cannot decode the recording's H.265 video (use a recent Chrome or Safari).";
            this.videoTrack = null;
          }
        });
      } else this.videoNote = "This browser has no WebCodecs: the recording's H.265 video cannot play.";
    }
    this.enhanced = new Map(); // frame index -> improved Image
    this.useEnhanced = true;
    if (bg && bg.frames && bg.frames.length && bg.t && bg.t.length === bg.frames.length) {
      const images = bg.frames.map((src) => {
        const img = new Image();
        img.src = src;
        img.decode().catch(() => {}); // decode now, not on the first frame that draws it (that stutters)
        return img;
      });
      this.backgroundFrames = {t: bg.t, images};
    }
  }

  /**
   * How the virtual layer meets the camera, as on the glasses: "device" adds the AR light to a dimmed camera (the display
   * is additive: black is transparent), "natural" paints it over the picture. `opacity` fades the virtual layer.
   */
  setDevice(d) {
    this.device = Object.assign({mode: "device", opacity: 1, tint: 0.6, solid: 0.35, hands: true}, d || {});
  }

  /** Hand landmarks per video frame from detectHands(), or null: the real hand is drawn over the virtual layer. */
  setHands(hands) {
    this.hands = hands && hands.frames ? hands : null;
  }

  /** The camera video's projection ({zoom, panX, panY}); null or empty = the NDK default. No video: plain calibration. */
  setVideoProfile(profile) {
    this.vprofile = this.videoTrack || this.hasVideo ? Object.assign({}, VIDEO_PROFILE, profile || {}) : null;
  }

  /** The Lock-to-environment correction ({t, v, strength, on}) or null; applied to the Lens camera's rotation. */
  setStab(stab) {
    this.stab = stab && stab.on !== false && stab.t && stab.t.length ? stab : null;
  }

  /**
   * The time to pose the scene at when the camera video shows source time t: the timestamp of the video frame on screen.
   * The video steps at its own frame rate; posing the virtual camera between frames makes objects lead the picture.
   */
  sceneTime(t) {
    const tr = this.videoTrack;
    if (!tr || !tr.ready || !tr.times.length) return t;
    return tr.times[tr.nearestIndex(t)];
  }

  setVideoShift(seconds) {
    if (this.videoTrack) this.videoTrack.setShift(seconds);
    this.videoShift = seconds;
  }

  backgroundAt(t) {
    if (this.videoTrack) return this.videoTrack.frameAt(t);
    const b = this.backgroundFrames;
    if (!b) return null;
    let lo = 0,
      hi = b.t.length - 1,
      ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (b.t[mid] <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (this.useEnhanced && this.enhanced) {
      // The AI-improved frame for this time, or the nearest improved one before it.
      for (let i = ans; i >= 0; i--) {
        const e = this.enhanced.get(i);
        if (e && e.complete && e.naturalWidth) return e;
      }
    }
    // Fall back to the nearest decoded earlier frame while a later one is still loading.
    for (let i = ans; i >= 0; i--) if (b.images[i].complete && b.images[i].naturalWidth) return b.images[i];
    return null;
  }

  textureFor(id) {
    if (!id || !this.assets || !this.assets.textures || !this.assets.textures[id]) return null;
    if (this.textureCache.has(id)) return this.textureCache.get(id);
    const tex = new THREE.TextureLoader().load(this.assets.textures[id], () => this.renderer.shadowMap.needsUpdate = true);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.flipY = true; // Lens Studio UVs start bottom-left, like GL
    this.textureCache.set(id, tex);
    return tex;
  }

  geometryFor(desc) {
    if (!desc.meshId || !this.assets || !this.assets.meshes || !this.assets.meshes[desc.meshId]) return null;
    if (!this.geometryCache.has(desc.meshId)) this.geometryCache.set(desc.meshId, geometryFromAsset(this.assets.meshes[desc.meshId]));
    return this.geometryCache.get(desc.meshId);
  }

  clear() {
    this.transform.detach();
    for (const entry of this.objects.values()) this.root.remove(entry.group);
    this.objects.clear();
    this.selected = null;
  }

  makeEntry(desc) {
    const group = new THREE.Group();
    group.userData.id = desc.id;
    let geometry = this.geometryFor(desc);
    const real = !!geometry;
    const b = real ? null : desc.bounds;
    const size = b
      ? [Math.max(0.5, b[3] - b[0]), Math.max(0.5, b[4] - b[1]), Math.max(0.5, b[5] - b[2])]
      : [10, 10, 10];
    const center = b ? [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] : [0, 0, 0];
    if (!real) switch (desc.primitive) {
      case "box":
      case "mesh":
        geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(Math.max(size[0], size[1], size[2]) / 2, 32, 16);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, size[1], 32);
        break;
      case "plane":
        geometry = new THREE.PlaneGeometry(size[0], size[1]);
        break;
      default:
        geometry = null;
    }
    const entry = {
      id: desc.id,
      desc,
      group,
      mesh: null,
      edges: null,
      sprite: null,
      label: null,
      text: null,
      color: null
    };
    if (desc.primitive === "panel") {
      this.buildPanel(entry, desc);
      this.root.add(group);
      this.objects.set(desc.id, entry);
      this.styleEntry(entry);
      return entry;
    }
    if (geometry) {
      const m = (desc.materials && desc.materials[0]) || null;
      const map = m ? this.textureFor(m.tex) : null;
      const matOpts = {
        color: rgb(desc.color),
        map,
        roughness: m && m.roughness != null ? m.roughness : 0.55,
        metalness: m && m.metalness != null ? m.metalness : 0.05,
        side: desc.primitive === "plane" || (m && m.twoSided) ? THREE.DoubleSide : THREE.FrontSide,
        transparent: !!(m && m.alpha === "blend"),
        alphaTest: m && m.alpha === "mask" ? 0.5 : 0
      };
      entry.mesh = new THREE.Mesh(
        geometry,
        m && m.unlit ? new THREE.MeshBasicMaterial(matOpts) : new THREE.MeshStandardMaterial(matOpts)
      );
      entry.real = real;
      entry.mesh.position.set(center[0], center[1], center[2]);
      entry.mesh.userData.id = desc.id;
      entry.mesh.castShadow = true;
      entry.mesh.receiveShadow = true;
      group.add(entry.mesh);
      entry.edges = new THREE.LineSegments(
        real ? new THREE.BufferGeometry() : new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.18})
      );
      entry.edges.position.copy(entry.mesh.position);
      group.add(entry.edges);
    } else if (desc.primitive === "empty") {
      entry.axes = null;
      const axes = new THREE.AxesHelper(5);
      group.add(axes);
      entry.axes = axes;
    }
    if (desc.primitive === "text") this.setText(entry, desc.text || desc.name);
    this.root.add(group);
    this.objects.set(desc.id, entry);
    this.styleEntry(entry);
    return entry;
  }

  /** A flat rounded rectangle (a UI panel / button / dot of the Lens): size and radius in cm, RGBA colour, optional border. */
  buildPanel(entry, desc) {
    const w = Math.max(0.1, (desc.size && desc.size[0]) || 10);
    const h = Math.max(0.1, (desc.size && desc.size[1]) || 10);
    const r = Math.max(0, Math.min(desc.radius != null ? desc.radius : 1, w / 2, h / 2));
    const shape = new THREE.Shape();
    const x0 = -w / 2;
    const y0 = -h / 2;
    shape.moveTo(x0 + r, y0);
    shape.lineTo(x0 + w - r, y0);
    shape.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x0 + w, y0 + h - r);
    shape.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x0 + r, y0 + h);
    shape.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x0, y0 + r);
    shape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    const geometry = new THREE.ShapeGeometry(shape, 24);
    const c = desc.color || [1, 1, 1, 1];
    const order = 900 + (desc.layer || 0) * 10;
    const material = new THREE.MeshBasicMaterial({
      color: rgb(c),
      transparent: true,
      opacity: c[3] != null ? c[3] : 1,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });
    entry.mesh = new THREE.Mesh(geometry, material);
    entry.mesh.renderOrder = order;
    entry.mesh.userData.id = desc.id;
    entry.real = true;
    entry.group.add(entry.mesh);
    if (desc.border) {
      const pts = shape.getPoints(24).map((v) => new THREE.Vector3(v.x, v.y, 0));
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: rgb(desc.border),
          transparent: true,
          opacity: desc.border[3] != null ? desc.border[3] : 1,
          depthTest: false
        })
      );
      line.renderOrder = order + 1;
      entry.group.add(line);
    }
    entry.edges = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0})
    );
    entry.group.add(entry.edges);
  }

  styleEntry(entry) {
    if (entry.axes) entry.axes.visible = this.cameraMode === "orbit" && !this.fixedSize;
    if (!entry.mesh) return;
    const wire = this.look.style === "wire";
    entry.mesh.material.wireframe = wire;
    entry.edges.material.opacity = wire ? 0 : entry === this.selected && this.cameraMode === "orbit" ? 0.9 : 0;
    entry.edges.material.color.set(entry === this.selected ? 0xffd600 : 0xffffff);
  }

  setText(entry, text) {
    if (entry.text === text) return;
    entry.text = text;
    if (entry.sprite) {
      entry.group.remove(entry.sprite);
      entry.sprite.material.map.dispose();
      entry.sprite.geometry.dispose();
    }
    entry.sprite = textPlane(text, "#ffffff", entry.desc && entry.desc.textSize ? entry.desc.textSize * 0.8 : 48);
    entry.sprite.userData.id = entry.id;
    entry.group.add(entry.sprite);
  }

  setLabel(entry, label) {
    if (!this.showLabels) {
      if (entry.label) entry.label.visible = false;
      return;
    }
    if (!entry.label || entry.label.userData.text !== label) {
      if (entry.label) entry.group.remove(entry.label);
      entry.label = textSprite(label, "#ffd600");
      entry.label.scale.multiplyScalar(0.35);
      entry.label.position.set(0, 9, 0);
      entry.group.add(entry.label);
    }
    entry.label.visible = true;
  }

  /** Shows a frame from model.frameAt / frameFromSnapshot. */
  update(frame) {
    const seen = new Set();
    for (const o of frame.objects) {
      seen.add(o.id);
      const entry = this.objects.get(o.id) || this.makeEntry(o.desc);
      const p = o.pose;
      entry.group.position.set(p[0], p[1], p[2]);
      entry.group.quaternion.set(p[3], p[4], p[5], p[6]);
      entry.group.scale.set(p[7] || 1, p[8] || 1, p[9] || 1);
      entry.group.visible = o.visible;
      entry.basePose = p;
      const key = JSON.stringify(o.color);
      if (entry.mesh && entry.color !== key) {
        entry.mesh.material.color.copy(rgb(o.color));
        entry.color = key;
      }
      if (o.desc.primitive === "text" && o.text != null) this.setText(entry, o.text);
      this.setLabel(entry, o.label);
    }
    for (const [id, entry] of this.objects) if (!seen.has(id)) entry.group.visible = false;
    if (frame.camera) {
      const c = frame.camera;
      this.lensCamera.position.set(c[0], c[1], c[2]);
      this.lensCamera.quaternion.set(c[3], c[4], c[5], c[6]);
      this.lensCamera.fov = c[7] || 60;
      if (this.calib) {
        // The recorded pose is the device's; the physical camera sits offset from it and may be turned.
        const k = this.calib;
        const off = new THREE.Vector3(k.p[0], k.p[1], k.p[2]).applyQuaternion(this.lensCamera.quaternion);
        this.lensCamera.position.add(off);
        this.lensCamera.quaternion.multiply(new THREE.Quaternion(k.q[0], k.q[1], k.q[2], k.q[3]));
        const vi = videoIntrinsics(k, this.vprofile);
        this.lensCamera.fov = (2 * Math.atan(k.resolution[1] / (2 * vi.focal[1])) * 180) / Math.PI;
      }
      if (this.stab) {
        // Rotate the virtual camera by what the picture did beyond the head pose (video clock = source time - shift).
        const r = stabAt(this.stab, frame.t - (this.videoShift || 0));
        const g = this.stab.strength == null ? 1 : this.stab.strength;
        const q = quatFromRotVec([r[0] * g, r[1] * g, r[2] * g]);
        this.lensCamera.quaternion.multiply(new THREE.Quaternion(q[0], q[1], q[2], q[3]));
      }
      this.updateLensProjection();
      this.lensMarker.position.copy(this.lensCamera.position);
      this.lensMarker.quaternion.copy(this.lensCamera.quaternion);
      this.lensMarker.userData.hasCamera = true;
    } else {
      this.lensMarker.userData.hasCamera = false;
    }
  }

  /** Projection of the recorded camera, with the principal point shifted to where the real lens has it. */
  updateLensProjection() {
    const cam = this.lensCamera;
    if (this.calib) cam.aspect = this.calib.resolution[0] / this.calib.resolution[1];
    cam.updateProjectionMatrix();
    if (this.calib) {
      const k = this.calib;
      // x_ndc offset at the optical axis = 2*cx/w - 1 (and the same for y, image y runs downwards); three's
      // projection matrix stores it, negated, in elements 8 and 9.
      const vi = videoIntrinsics(k, this.vprofile);
      cam.projectionMatrix.elements[0] = (2 * vi.focal[0]) / k.resolution[0];
      cam.projectionMatrix.elements[5] = (2 * vi.focal[1]) / k.resolution[1];
      cam.projectionMatrix.elements[8] = 1 - 2 * vi.cx;
      cam.projectionMatrix.elements[9] = 2 * vi.cy - 1;
      const win = this.cropWin();
      if (win) {
        // Show only the crop window of the full frame: scale and shift the projection in NDC.
        const e = cam.projectionMatrix.elements;
        const sx = 1 / (win.u1 - win.u0);
        const sy = 1 / (win.v1 - win.v0);
        const tx = -(win.u0 + win.u1 - 1) * sx;
        const ty = (win.v0 + win.v1 - 1) * sy;
        e[0] *= sx;
        e[8] = sx * e[8] - tx;
        e[5] *= sy;
        e[9] = sy * e[9] - ty;
      }
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
  }

  /** Output format: {preset ratio, fit, zoom, panX, panY}; null = follow the recording as before. */
  setOutput(out) {
    this.output = out || null;
    this.outAspect = out && out.ratio ? out.ratio : null;
    this.resize();
  }

  /** The window of the source frame the output shows (0..1), null when there is nothing to crop (no calibration). */
  cropWin() {
    if (!this.calib || !this.output || !this.output.ratio || !this.width || !this.height) return null;
    const src = this.calib.resolution[0] / this.calib.resolution[1];
    return cropWindow(src, this.width / this.height, {
      mode: this.output.fit,
      zoom: this.output.zoom,
      panX: this.output.panX,
      panY: this.output.panY
    });
  }

  /** Frames the orbit camera on the given bounds [minx,miny,minz,maxx,maxy,maxz]. */
  frameBounds(b) {
    const c = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
    const r = Math.max(30, Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2);
    this.controls.target.copy(c);
    this.orbitCamera.position.copy(c.clone().add(new THREE.Vector3(r * 1.4, r * 1.0, r * 2.0)));
    this.controls.update();
  }

  /** Current orbit view as a shot key: eye xyz + target xyz. */
  currentShot(t) {
    const e = this.orbitCamera.position,
      tg = this.controls.target;
    return {t, pose: [e.x, e.y, e.z, tg.x, tg.y, tg.z], fov: this.orbitCamera.fov};
  }

  activeCamera(shots, t) {
    if (this.cameraMode === "recorded") return this.lensCamera;
    if (this.cameraMode === "shots" && shots && shots.length) {
      const s = shotAt(shots, t);
      this.shotCamera.position.set(s.pose[0], s.pose[1], s.pose[2]);
      this.shotCamera.lookAt(s.pose[3], s.pose[4], s.pose[5]);
      this.shotCamera.fov = s.fov || 50;
      return this.shotCamera;
    }
    return this.orbitCamera;
  }

  select(id) {
    const prev = this.selected;
    this.selected = id ? this.objects.get(id) || null : null;
    if (prev) this.styleEntry(prev);
    if (this.selected) {
      this.styleEntry(this.selected);
      if (this.cameraMode === "orbit") this.transform.attach(this.selected.group);
    } else this.transform.detach();
  }

  pick(e) {
    if (this.transform.dragging || e.button !== 0 || this.cameraMode !== "orbit") return;
    const rect = this.composite.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.orbitCamera);
    const targets = [];
    for (const entry of this.objects.values())
      if (entry.group.visible) targets.push(entry.mesh || entry.sprite || entry.group);
    const hit = ray.intersectObjects(targets.filter(Boolean), false)[0];
    if (hit) {
      const id = hit.object.userData.id;
      this.select(id);
      if (this.onSelect) this.onSelect(id);
    }
  }

  dragged() {
    if (!this.selected || !this.selected.basePose || !this.onOffsetDrag) return;
    const p = this.selected.group.position,
      b = this.selected.basePose;
    const delta = [p.x - b[0], p.y - b[1], p.z - b[2]];
    this.selected.basePose = [p.x, p.y, p.z].concat(b.slice(3));
    this.onOffsetDrag(this.selected.id, delta);
  }

  /**
   * The camera picture with the Cold-Warm tint (fx.warmth, -1..1) applied, or the picture itself when neutral. The tint
   * is a soft-light wash (orange for warm, blue for cold), so highlights and shadows keep their detail; it is applied
   * to the picture only, never to the virtual layer drawn on top.
   */
  warmed(image) {
    const w = this.fx && this.fx.warmth ? Math.max(-1, Math.min(1, this.fx.warmth)) : 0;
    if (!image || Math.abs(w) < 0.02) return image;
    const iw = image.naturalWidth || image.displayWidth || image.width;
    const ih = image.naturalHeight || image.displayHeight || image.height;
    if (!iw || !ih) return image;
    const k = Math.min(1, 1280 / iw);
    const c = this.warmCanvas || (this.warmCanvas = document.createElement("canvas"));
    const cw = Math.round(iw * k);
    const ch = Math.round(ih * k);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const x = c.getContext("2d");
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
    x.drawImage(image, 0, 0, cw, ch);
    x.globalCompositeOperation = "soft-light";
    x.globalAlpha = Math.abs(w) * 0.75;
    x.fillStyle = w > 0 ? "#ff8a1f" : "#1f8fff";
    x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
    return c;
  }

  /** The logo bitmap for one colour (drawn from the vector, cached). */
  logoImage(color) {
    if (!this.logoImages[color]) {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logoSvg(color === "black" ? "#000000" : "#f3f3f3"));
      this.logoImages[color] = img;
    }
    return this.logoImages[color];
  }

  resize() {
    let w, h;
    let dpr = 1;
    if (this.fixedSize) {
      w = this.fixedSize.width;
      h = this.fixedSize.height;
    } else {
      const r = this.container.getBoundingClientRect();
      w = Math.max(320, Math.floor(r.width));
      h = Math.max(180, Math.floor(r.height));
      const shape = this.outAspect || this.aspect;
      if (shape) {
        // Replay in the output's shape (letterboxed); the crop window keeps the background and 3D registered.
        h = Math.min(h, Math.floor(w / shape));
        w = Math.floor(h * shape);
      }
      dpr = Math.min(2, window.devicePixelRatio || 1); // sharp on retina screens
    }
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    this.width = bw;
    this.height = bh;
    this.renderer.setSize(bw, bh, false);
    this.composite.width = bw;
    this.composite.height = bh;
    if (!this.fixedSize) {
      // The CSS size must match the layout size, or the browser stretches the bitmap.
      this.composite.style.width = w + "px";
      this.composite.style.height = h + "px";
      this.composite.style.margin = "auto";
      this.composite.style.display = "block";
    }
    for (const cam of [this.orbitCamera, this.lensCamera, this.shotCamera]) {
      cam.aspect = bw / bh;
      if (cam === this.lensCamera && this.calib) this.updateLensProjection();
      else cam.updateProjectionMatrix();
    }
  }

  /**
   * A shadow around the virtual objects, drawn from their own silhouette before they are drawn (Capture Studio's
   * look): a cast shadow (angle, distance, softness, strength), a tight contact shadow, and the "pop" plate.
   */
  drawObjectShadows(ctx, canFilter) {
    const os = this.fx.objectShadow;
    const pop = this.fx.pop;
    const shadowOn = os && os.on && (os.strength > 0.001 || os.contact > 0.001);
    const popOn = pop && pop.opacity > 0.001;
    if (!shadowOn && !popOn) return;
    const w = this.width;
    const h = this.height;
    if (!this.silh) {
      this.silh = document.createElement("canvas");
      this.silhCtx = this.silh.getContext("2d");
    }
    if (this.silh.width !== w || this.silh.height !== h) {
      this.silh.width = w;
      this.silh.height = h;
    }
    const sc = this.silhCtx;
    sc.globalCompositeOperation = "copy";
    sc.drawImage(this.gl, 0, 0);
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = "#000";
    sc.fillRect(0, 0, w, h);
    sc.globalCompositeOperation = "source-over";
    const k = h / 1080;
    const blur = (px) => (canFilter ? "blur(" + Math.max(0.5, px) + "px)" : "none");
    ctx.save();
    if (popOn) {
      ctx.filter = blur(pop.feather * k);
      ctx.globalAlpha = Math.min(1, pop.opacity);
      const r = pop.spread * k;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.drawImage(this.silh, Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.drawImage(this.silh, 0, 0);
    }
    if (shadowOn) {
      const a = (os.angle * Math.PI) / 180;
      if (os.strength > 0.001) {
        ctx.filter = blur(os.softness * k);
        ctx.globalAlpha = Math.min(0.95, os.strength);
        ctx.drawImage(this.silh, Math.cos(a) * os.distance * k, Math.sin(a) * os.distance * k);
      }
      if (os.contact > 0.001) {
        ctx.filter = blur(4 * k);
        ctx.globalAlpha = Math.min(1, os.contact);
        ctx.drawImage(this.silh, 0, 0);
      }
    }
    ctx.restore();
  }

  /** Renders the 3D view + overlays. `titles`: [{text, position, size}]. */
  /** A scratch canvas the size of the frame, for the shadow and hand layers. */
  layerScratch(name) {
    this.scratch = this.scratch || {};
    let c = this.scratch[name];
    if (!c || c.width !== this.width || c.height !== this.height) {
      c = document.createElement("canvas");
      c.width = this.width;
      c.height = this.height;
      this.scratch[name] = c;
    }
    return c;
  }

  render(shots, t, titles) {
    this.lastShots = shots;
    this.lastT = t;
    if (this.controls.enabled) this.controls.update();
    const cam = this.activeCamera(shots, t);
    if (cam === this.lensCamera && this.calib) this.updateLensProjection();
    else {
      cam.aspect = this.width / this.height;
      cam.updateProjectionMatrix();
    }
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, this.background);
    gradient.addColorStop(1, this.background2);
    this.transform.getHelper().visible = !!this.transform.object && this.cameraMode === "orbit" && !this.fixedSize;
    // Camera POV (and every export) shows only the captured scene: no axes, grid, lens marker or gizmo.
    const pov = this.cameraMode !== "orbit" || !!this.fixedSize;
    this.originMarker.visible = !pov && this.cameraMode === "orbit";
    const handles = this.aligning && !this.fixedSize;
    this.planeTransform.camera = cam;
    this.planeTransform.getHelper().visible = handles;
    this.alignGrid.visible = handles;
    for (const entry of this.objects.values()) {
      if (entry.axes) entry.axes.visible = !pov;
      if (entry.edges) entry.edges.visible = !pov;
    }
    this.grid.visible = !pov && !!this.look.grid && !this.backgroundFrames && !this.videoTrack;
    this.lensMarker.visible = !pov && this.lensMarker.userData.hasCamera === true;
    this.renderer.render(this.scene, cam);
    const ctx = this.ctx;
    const fx = this.fx;
    const grade = [];
    if (fx.exposure !== 1) grade.push("brightness(" + fx.exposure + ")");
    if (fx.contrast !== 1) grade.push("contrast(" + fx.contrast + ")");
    if (fx.saturation !== 1) grade.push("saturate(" + fx.saturation + ")");
    const canFilter = "filter" in ctx;
    const dev = this.device || {mode: "natural", opacity: 1, tint: 1, hands: false};
    const additive = dev.mode === "device";
    const gradeFilter = canFilter && grade.length ? grade.join(" ") : "";
    const worldFilter = (gradeFilter + (additive && dev.tint < 0.999 ? " brightness(" + dev.tint + ")" : "")).trim();
    ctx.filter = canFilter && worldFilter ? worldFilter : "none";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const bgImage = this.warmed(this.backgroundAt(t));
    let cover = null;
    if (bgImage) {
      const iw = bgImage.naturalWidth || bgImage.displayWidth || bgImage.width;
      const ih = bgImage.naturalHeight || bgImage.displayHeight || bgImage.height;
      const win = this.cropWin();
      if (win) {
        // The frame's place on the canvas, so the crop window fills it.
        const kx = this.width / (win.u1 - win.u0);
        const ky = this.height / (win.v1 - win.v0);
        const x = -win.u0 * kx;
        const y = -win.v0 * ky;
        if (win.fit) {
          // bars: a blurred, dimmed copy of the picture fills them
          const k = Math.max(this.width / iw, this.height / ih);
          const prev = ctx.filter;
          ctx.filter = canFilter ? "blur(" + Math.round(this.height / 30) + "px) brightness(0.55)" : "none";
          ctx.drawImage(bgImage, (this.width - iw * k) / 2, (this.height - ih * k) / 2, iw * k, ih * k);
          ctx.filter = prev;
        }
        ctx.drawImage(bgImage, x, y, kx, ky);
        cover = {x, y, w: kx, h: ky};
      } else {
        // "cover": fill the frame, crop the overflow (the Lens camera feed is shown the same way in Preview).
        const k = Math.max(this.width / iw, this.height / ih);
        const w = iw * k, h = ih * k;
        ctx.drawImage(bgImage, (this.width - w) / 2, (this.height - h) / 2, w, h);
        cover = {x: (this.width - w) / 2, y: (this.height - h) / 2, w, h};
      }
    }
    ctx.filter = canFilter && gradeFilter ? gradeFilter : "none";
    this.drawObjectShadows(ctx, canFilter);
    // The virtual layer: opacity, and on the glasses' additive display a soft shadow under it and light added to the world.
    ctx.globalAlpha = dev.opacity;
    if (additive) {
      const sc = this.layerScratch("shadow");
      const sctx = sc.getContext("2d");
      sctx.clearRect(0, 0, sc.width, sc.height);
      sctx.filter = canFilter ? "blur(" + Math.max(2, Math.round(this.height / 80)) + "px) brightness(0)" : "none";
      sctx.drawImage(this.gl, 0, 0);
      ctx.globalAlpha = dev.opacity * 0.55;
      ctx.drawImage(sc, 0, this.height * 0.008);
      // Solidity: dim the camera picture behind the virtual content (its own outline, in black) before the light is
      // added. 0 = purely additive (see-through), 1 = nothing of the real world shows through the objects.
      const solid = Math.max(0, Math.min(1, dev.solid == null ? 0.35 : dev.solid));
      if (solid > 0.01) {
        sctx.clearRect(0, 0, sc.width, sc.height);
        sctx.filter = canFilter ? "brightness(0)" : "none";
        sctx.drawImage(this.gl, 0, 0);
        sctx.filter = "none";
        ctx.globalAlpha = dev.opacity * solid;
        ctx.drawImage(sc, 0, 0);
      }
      ctx.globalAlpha = dev.opacity;
      ctx.globalCompositeOperation = "lighter";
    }
    ctx.drawImage(this.gl, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // Hands in front: the camera's own pixels of the hand, over the virtual layer.
    if (bgImage && cover && dev.hands && this.hands && this.videoTrack && this.videoTrack.ready) {
      const idx = this.videoTrack.nearestIndex(t);
      const hs = this.hands.frames[idx] || this.hands.frames[idx - 1] || this.hands.frames[idx + 1];
      if (hs) {
        const hc = this.layerScratch("hands");
        const hctx = hc.getContext("2d");
        hctx.clearRect(0, 0, hc.width, hc.height);
        hctx.globalCompositeOperation = "source-over";
        hctx.filter = canFilter ? "blur(" + Math.max(1, Math.round(this.height / 220)) + "px)" : "none";
        drawHandMask(hctx, hs, cover.x, cover.y, cover.w, cover.h);
        hctx.filter = canFilter && worldFilter ? worldFilter : "none";
        hctx.globalCompositeOperation = "source-in";
        hctx.drawImage(bgImage, cover.x, cover.y, cover.w, cover.h);
        hctx.filter = "none";
        hctx.globalCompositeOperation = "source-over";
        ctx.drawImage(hc, 0, 0);
        if (dev.handsDebug && !this.fixedSize) {
          // detection check: the hand mask in green over the picture
          const dc = this.layerScratch("handsdbg");
          const dctx = dc.getContext("2d");
          dctx.clearRect(0, 0, dc.width, dc.height);
          drawHandMask(dctx, hs, cover.x, cover.y, cover.w, cover.h);
          dctx.globalCompositeOperation = "source-in";
          dctx.fillStyle = "#33ff88";
          dctx.fillRect(0, 0, dc.width, dc.height);
          dctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 0.45;
          ctx.drawImage(dc, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
    }
    if (canFilter && fx.glow > 0) {
      // Glow: a blurred, brightened copy added on top ("screen"), so highlights bleed softly.
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(1, fx.glow);
      ctx.filter = "blur(" + Math.round(this.height / 90) + "px) brightness(1.25)" + (grade.length ? " " + grade.join(" ") : "");
      ctx.drawImage(this.gl, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.filter = "none";
    if (fx.vignette > 0) {
      const r = Math.hypot(this.width, this.height) / 2;
      const vg = ctx.createRadialGradient(this.width / 2, this.height / 2, r * 0.45, this.width / 2, this.height / 2, r);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0," + (0.85 * fx.vignette).toFixed(3) + ")");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const scale = this.height / 1080;
    for (const title of titles || []) {
      const size = Math.round((title.size || 64) * scale);
      ctx.font = "700 " + size + "px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const y =
        title.position === "top"
          ? this.height * 0.12
          : title.position === "center"
            ? this.height * 0.5
            : this.height * 0.86;
      ctx.lineWidth = Math.max(2, size / 10);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(title.text, this.width / 2, y);
      ctx.fillStyle = title.color || "#ffffff";
      ctx.fillText(title.text, this.width / 2, y);
    }
    if (this.logo && this.logo.on) {
      const img = this.logoImage(this.logo.color === "black" ? "black" : "white");
      if (img && img.complete && img.naturalWidth) {
        const r = logoRect(this.width, this.height, this.logo);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, r.x, r.y, r.w, r.h);
      }
    }
  }
}
