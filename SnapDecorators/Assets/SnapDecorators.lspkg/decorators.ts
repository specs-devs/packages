/**
 * Specs Inc. 2026
 * TypeScript decorators for declarative event binding and dependency injection in Lens Studio.
 * Provides @bindStartEvent, @bindUpdateEvent, @bindDestroyEvent and others for clean event
 * handling, @memo for lazy-evaluated getters, @depends for component dependencies, and
 * @provider for parent component lookup with automatic error reporting.
 */
import { assert, verify } from "./assert";
import { reportError, spath } from "./debug";

/**
 * Decorator to bind a class method as the event handler for a scene event type for a component.
 * The event registration is injected so it runs right before onAwake. The target method can be async.
 */
function bindEvent(eventType: keyof EventNameMap) {
  return function bindEventDecorator(target: Function, context: ClassMethodDecoratorContext) {
    const methodName = context.name;

    context.addInitializer(function(this: BaseScriptComponent) {
      const targetMethod = (this as any)[methodName] as Function;
      const innerAwake = (this as any)["onAwake"] as (() => void) | undefined;

      (this as any)["onAwake"] = function bindEventAwake() {
        this.createEvent(eventType).bind((...args: any[]) => {
          const result = targetMethod.call(this, ...args);
          if (result instanceof Promise) {
            return result.catch(reportError);
          }
          return result;
        });
        innerAwake?.call(this);
      };
    });
  };
}

export function bindStartEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("OnStartEvent")(target, context);
}

export function bindEnableEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("OnEnableEvent")(target, context);
}

export function bindDisableEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("OnDisableEvent")(target, context);
}

export function bindUpdateEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("UpdateEvent")(target, context);
}

export function bindLateUpdateEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("LateUpdateEvent")(target, context);
}

export function bindDestroyEvent(target: Function, context: ClassMethodDecoratorContext) {
  return bindEvent("OnDestroyEvent")(target, context);
}

/**
 * Decorator for script component getters.
 */
export function memo(target: any, context: ClassGetterDecoratorContext) {
  const propertyKey = context.name;

  context.addInitializer(function(this: BaseScriptComponent) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), propertyKey);
    assert(
      descriptor && typeof descriptor.get === "function",
      "@memo can only be applied to getters"
    );
    assert(
      typeof descriptor.set === "undefined",
      "@memo cannot be applied to a getter with a setter"
    );

    const innerGetter = descriptor.get;
    Object.defineProperty(this, propertyKey, {
      get: function memoGetter(this: BaseScriptComponent) {
        const value = innerGetter.call(this);
        Object.defineProperty(this, propertyKey, { value });
        return value;
      },
      configurable: true,
      enumerable: true
    });
  });
}

/**
 * Decorator to define a script component field as an injected dependency, auto-initialized with a reference to a
 * component found on a parent node.
 */
export function depends(componentType: keyof ComponentNameMap) {
  return function dependsDecorator(target: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = context.name;

    context.addInitializer(function(this: BaseScriptComponent) {
      const component = this.sceneObject.getComponent(componentType);
      assert(
        component !== null,
        `@depends ${spath(this)}.${propertyKey.toString()} not found`
      );
      (this as any)[propertyKey] = component;
    });
  };
}

/**
 * Decorator to define a script component field as an injected dependency, auto-initialized with a reference to a
 * component above it on the same scene object.
 */
export function provider(componentType: keyof ComponentNameMap) {
  return function providerDecorator(target: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = context.name;

    context.addInitializer(function(this: BaseScriptComponent) {
      const component = getComponentInParent(this.sceneObject, componentType);
      assert(
        component !== null,
        `@provider ${spath(this)}.${propertyKey.toString()} not found`
      );
      (this as any)[propertyKey] = component;
    });
  };
}

function getComponentInParent(
  sceneObject: SceneObject,
  componentType: keyof ComponentNameMap
) {
  for (
    let node: SceneObject | null = sceneObject;
    node !== null;
    node = node.getParent()
  ) {
    const component = node.getComponent(componentType);
    if (component !== null) {
      return component;
    }
  }
  return null;
}
