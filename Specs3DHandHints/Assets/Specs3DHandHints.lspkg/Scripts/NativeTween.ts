/**
 * Specs Inc. 2026
 * NativeTween — self-contained procedural tween built on Lens Studio runtime
 * primitives ONLY. No package/library dependency (replaces LSTween).
 *
 * It reproduces the exact LSTween surface this package calls (LSTween.* factory
 * methods + a chainable Tween with delay/easing/onStart/onComplete/start/stop,
 * an `Easing` table, and a `mainGroup` shim) so call sites only swap their
 * import line.
 *
 * How it works: a single hidden "NativeTweenDriver" SceneObject hosts the
 * UpdateEvent / DelayedCallbackEvent that drive every tween. Each frame we
 * compute t = elapsed / duration, ease it, and write the interpolated value.
 *
 * FIRST PASS — a few runtime property names are best-effort and worth a quick
 * check in the editor (flagged with NOTE): Text fill color, blend-shape weight
 * get/setters, and material baseColor.
 */

// ─── Easing ──────────────────────────────────────────────────────────────────
export type EasingFunction = (t: number) => number;

function family(inFn: EasingFunction): { In: EasingFunction; Out: EasingFunction; InOut: EasingFunction } {
    return {
        In: inFn,
        Out: (t) => 1 - inFn(1 - t),
        InOut: (t) => (t < 0.5 ? inFn(2 * t) / 2 : 1 - inFn(2 - 2 * t) / 2),
    };
}

function bounceOut(t: number): number {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

const identity: EasingFunction = (t) => t;

export const Easing = {
    Linear: { None: identity, In: identity, Out: identity, InOut: identity },
    Quadratic: family((t) => t * t),
    Cubic: family((t) => t * t * t),
    Quartic: family((t) => t * t * t * t),
    Quintic: family((t) => t * t * t * t * t),
    Sinusoidal: family((t) => 1 - Math.cos((t * Math.PI) / 2)),
    Exponential: family((t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)))),
    Circular: family((t) => 1 - Math.sqrt(1 - t * t)),
    Back: family((t) => {
        const s = 1.70158;
        return t * t * ((s + 1) * t - s);
    }),
    Elastic: family((t) => {
        if (t === 0 || t === 1) return t;
        const p = 0.3;
        const s = p / 4;
        return -(Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1 - s) * (2 * Math.PI)) / p));
    }),
    Bounce: {
        In: (t: number) => 1 - bounceOut(1 - t),
        Out: bounceOut,
        InOut: (t: number) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2),
    },
};

// ─── Hidden driver (UpdateEvent / DelayedCallbackEvent host) ──────────────────
let _driver: ScriptComponent | null = null;
function driver(): ScriptComponent {
    if (_driver === null || isNull(_driver)) {
        const so = global.scene.createSceneObject("NativeTweenDriver");
        _driver = so.createComponent("Component.ScriptComponent") as ScriptComponent;
    }
    return _driver;
}

// ─── Interpolation helpers ────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
function lerpVec4(a: vec4, b: vec4, t: number): vec4 {
    return new vec4(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t), lerp(a.w, b.w, t));
}
function eulerDegToQuat(deg: vec3): quat {
    const k = Math.PI / 180;
    return quat.fromEulerVec(new vec3(deg.x * k, deg.y * k, deg.z * k));
}

// ─── Tween ────────────────────────────────────────────────────────────────────
export class Tween {
    private _durationSec: number;
    private _apply: (eased: number) => void;
    private _captureStart: (() => void) | null;
    private _ease: EasingFunction = Easing.Linear.None;
    private _delaySec = 0;
    private _onStart: (() => void) | null = null;
    private _onComplete: (() => void) | null = null;
    private _updateEvent: any = null;
    private _delayEvent: any = null;
    private _running = false;
    private _started = false;

    constructor(durationMs: number, apply: (eased: number) => void, captureStart: (() => void) | null = null) {
        this._durationSec = Math.max(0, durationMs / 1000);
        this._apply = apply;
        this._captureStart = captureStart;
    }

    delay(ms: number): Tween {
        this._delaySec = Math.max(0, ms / 1000);
        return this;
    }
    easing(fn: EasingFunction): Tween {
        if (fn) this._ease = fn;
        return this;
    }
    onStart(cb: () => void): Tween {
        this._onStart = cb;
        return this;
    }
    onComplete(cb: () => void): Tween {
        this._onComplete = cb;
        return this;
    }

    start(): Tween {
        if (this._started) return this;
        this._started = true;
        if (this._delaySec > 0) {
            const d: any = driver().createEvent("DelayedCallbackEvent");
            this._delayEvent = d;
            d.bind(() => this._begin());
            d.reset(this._delaySec);
        } else {
            this._begin();
        }
        return this;
    }

    private _begin(): void {
        if (this._captureStart) this._captureStart();
        if (this._onStart) this._onStart();
        this._running = true;
        const startTime = getTime();
        const ev: any = driver().createEvent("UpdateEvent");
        this._updateEvent = ev;
        ev.bind(() => {
            if (!this._running) return;
            const elapsed = getTime() - startTime;
            if (this._durationSec <= 0 || elapsed >= this._durationSec) {
                this._apply(this._ease(1));
                this._running = false;
                this._teardown();
                if (this._onComplete) this._onComplete();
                return;
            }
            this._apply(this._ease(elapsed / this._durationSec));
        });
    }

    stop(): Tween {
        this._running = false;
        this._teardown();
        return this;
    }

    private _teardown(): void {
        if (this._updateEvent) {
            driver().removeEvent(this._updateEvent);
            this._updateEvent = null;
        }
        if (this._delayEvent) {
            driver().removeEvent(this._delayEvent);
            this._delayEvent = null;
        }
    }
}

// ─── mainGroup shim (LSTween used TweenJS groups for bulk-cancel) ─────────────
export const mainGroup = {
    remove(t: Tween | null): void {
        if (t) t.stop();
    },
};

// ─── LSTween factory (native-backed) ──────────────────────────────────────────
export class LSTween {
    // Position
    static moveToLocal(t: Transform, end: vec3, ms: number): Tween {
        let s: vec3;
        return new Tween(ms, (e) => t.setLocalPosition(vec3.lerp(s, end, e)), () => (s = t.getLocalPosition()));
    }
    static moveFromToLocal(t: Transform, start: vec3, end: vec3, ms: number): Tween {
        return new Tween(ms, (e) => t.setLocalPosition(vec3.lerp(start, end, e)));
    }
    static moveToWorld(t: Transform, end: vec3, ms: number): Tween {
        let s: vec3;
        return new Tween(ms, (e) => t.setWorldPosition(vec3.lerp(s, end, e)), () => (s = t.getWorldPosition()));
    }
    static moveFromToWorld(t: Transform, start: vec3, end: vec3, ms: number): Tween {
        return new Tween(ms, (e) => t.setWorldPosition(vec3.lerp(start, end, e)));
    }

    // Scale
    static scaleToLocal(t: Transform, end: vec3, ms: number): Tween {
        let s: vec3;
        return new Tween(ms, (e) => t.setLocalScale(vec3.lerp(s, end, e)), () => (s = t.getLocalScale()));
    }
    static scaleFromToLocal(t: Transform, start: vec3, end: vec3, ms: number): Tween {
        return new Tween(ms, (e) => t.setLocalScale(vec3.lerp(start, end, e)));
    }
    static scaleToWorld(t: Transform, end: vec3, ms: number): Tween {
        let s: vec3;
        return new Tween(ms, (e) => t.setWorldScale(vec3.lerp(s, end, e)), () => (s = t.getWorldScale()));
    }
    static scaleFromToWorld(t: Transform, start: vec3, end: vec3, ms: number): Tween {
        return new Tween(ms, (e) => t.setWorldScale(vec3.lerp(start, end, e)));
    }

    // Rotation (euler degrees in, quaternion slerp under the hood)
    static rotateToLocalInDegrees(t: Transform, endDeg: vec3, ms: number): Tween {
        let s: quat;
        const end = eulerDegToQuat(endDeg);
        return new Tween(ms, (e) => t.setLocalRotation(quat.slerp(s, end, e)), () => (s = t.getLocalRotation()));
    }
    static rotateFromToLocalInDegrees(t: Transform, startDeg: vec3, endDeg: vec3, ms: number): Tween {
        const s = eulerDegToQuat(startDeg);
        const end = eulerDegToQuat(endDeg);
        return new Tween(ms, (e) => t.setLocalRotation(quat.slerp(s, end, e)));
    }
    static rotateToWorldInDegrees(t: Transform, endDeg: vec3, ms: number): Tween {
        let s: quat;
        const end = eulerDegToQuat(endDeg);
        return new Tween(ms, (e) => t.setWorldRotation(quat.slerp(s, end, e)), () => (s = t.getWorldRotation()));
    }
    static rotateFromToWorldInDegrees(t: Transform, startDeg: vec3, endDeg: vec3, ms: number): Tween {
        const s = eulerDegToQuat(startDeg);
        const end = eulerDegToQuat(endDeg);
        return new Tween(ms, (e) => t.setWorldRotation(quat.slerp(s, end, e)));
    }

    // Shader / material-pass properties
    static shaderFloatPropertyFromTo(pass: any, prop: string, from: number, to: number, ms: number): Tween {
        return new Tween(ms, (e) => (pass[prop] = lerp(from, to, e)));
    }
    static shaderVec3PropertyFromTo(pass: any, prop: string, from: vec3, to: vec3, ms: number): Tween {
        return new Tween(ms, (e) => (pass[prop] = vec3.lerp(from, to, e)));
    }
    static shaderColorPropertyFromTo(pass: any, prop: string, from: vec4, to: vec4, ms: number): Tween {
        return new Tween(ms, (e) => (pass[prop] = lerpVec4(from, to, e)));
    }

    // Colors
    static colorTo(material: Material, end: vec4, ms: number): Tween {
        let s: vec4;
        // NOTE: assumes the standard material exposes mainPass.baseColor (vec4).
        return new Tween(
            ms,
            (e) => (material.mainPass.baseColor = lerpVec4(s, end, e)),
            () => (s = material.mainPass.baseColor)
        );
    }
    static colorTextTo(text: Text, end: vec4, ms: number): Tween {
        let s: vec4;
        // NOTE: Text fill color is text.textFill.color (vec4) on current Text API.
        return new Tween(
            ms,
            (e) => (text.textFill.color = lerpVec4(s, end, e)),
            () => (s = text.textFill.color)
        );
    }

    // Blend shapes
    static blendShapeValueTo(rmv: any, name: string, end: number, ms: number): Tween {
        let s: number;
        // NOTE: RenderMeshVisual.get/setBlendShapeWeight(name[, value]).
        return new Tween(ms, (e) => rmv.setBlendShapeWeight(name, lerp(s, end, e)), () => (s = rmv.getBlendShapeWeight(name)));
    }
    static blendShapeValueFromTo(rmv: any, name: string, start: number, end: number, ms: number): Tween {
        return new Tween(ms, (e) => rmv.setBlendShapeWeight(name, lerp(start, end, e)));
    }

    // Pure timer (no value) — used as a sequencing/delay tween.
    static rawTween(ms: number): Tween {
        return new Tween(ms, () => {});
    }
}
