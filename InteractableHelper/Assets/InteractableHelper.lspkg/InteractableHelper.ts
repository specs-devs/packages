/**
 * Specs Inc. 2026
 * Interactable helper component that simplifies setting up interactions with visual responses.
 * Provides easy configuration for hover, pinch, and trigger events with animation support.
 */
import { EasingData } from "./Scripts/EasingData"
import { EventResponseType } from "./Scripts/EventResponseType"
import { LSTween } from "LSTween.lspkg/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"
import Tween from "LSTween.lspkg/TweenJS/Tween"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

@component
export class InteractableHelper extends BaseScriptComponent
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Hover Enter Responses</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure responses when user starts hovering over the object</span>')

    @input
    onHoverEnter: EventResponseType[]

    @ui.separator
    @ui.separator
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Hover Exit Responses</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure responses when user stops hovering over the object</span>')

    @input
    onHoverExit: EventResponseType[]

    @ui.separator
    @ui.separator
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Pinch Down Responses</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure responses when user starts pinching the object</span>')

    @input
    onPinchDown: EventResponseType[]

    @ui.separator
    @ui.separator
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Pinch Up / Select Responses</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure responses when user releases pinch or selects the object</span>')

    @input
    onPinchUp_Select: EventResponseType[]
    
    private interactable: Interactable
    private hoverEnterCurrentIterationIndex = 0
    private hoverExitCurrentIterationIndex = 0
    private triggerDownCurrentIterationIndex = 0
    private triggerUpCurrentIterationIndex = 0
        
    onAwake() 
    {
        this.createEvent("OnStartEvent").bind(() =>
        {
            this.setupInteractableCallbacks()
        })

        let physicsCollider: ColliderComponent = this.getSceneObject().getComponent("ColliderComponent")
        if(isNull(physicsCollider))
        {
            physicsCollider = this.getSceneObject().createComponent("ColliderComponent")
        }

        //init iteration through children
        this.initIterateThroughChildren(this.onHoverEnter)
        this.initIterateThroughChildren(this.onHoverExit)
        this.initIterateThroughChildren(this.onPinchDown)
        this.initIterateThroughChildren(this.onPinchUp_Select)
    } 

    private setupInteractableCallbacks()
    {
        this.interactable = this.getSceneObject().getComponent(Interactable.getTypeName())
        if(isNull(this.interactable))
        {
            this.interactable = this.getSceneObject().createComponent(Interactable.getTypeName())
        }

        this.interactable.onHoverEnter(() =>
        {
            this.onHoverEnter.forEach((item) => 
            {
                if(!isNull(item.sceneObject))
                {
                    this.response(item, EventType.HoverEnter)
                }
                else
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing SceneObject in On Hover Enter Event. Assign SceneObject")
                }
                
            })
            this.hoverEnterCurrentIterationIndex ++
        })

        this.interactable.onHoverExit(() =>
        {
            this.onHoverExit.forEach((item) => 
            {
                if(!isNull(item.sceneObject))
                {
                    this.response(item, EventType.HoverExit)
                }
                else
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing SceneObject in On Hover Exit Event. Assign SceneObject")
                }
            })
            this.hoverExitCurrentIterationIndex ++
        })

        this.interactable.onTriggerStart(() =>
        {
            this.onPinchDown.forEach((item) =>
            {
                if(!isNull(item.sceneObject))
                {
                    this.response(item, EventType.TriggerDown)
                }
                else
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing SceneObject in On Pinch Down Event. Assign SceneObject")
                }  
            })
            this.triggerDownCurrentIterationIndex ++
        })

        this.interactable.onTriggerEnd(() =>
        {
            this.onPinchUp_Select.forEach((item) =>
            {
                if(!isNull(item.sceneObject))
                {
                    this.response(item, EventType.TriggerUp)
                }
                else
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing SceneObject in On Pinch Up Event. Assign SceneObject")
                }  
            })
            this.triggerUpCurrentIterationIndex ++
        })
    }

    public response(item: EventResponseType, eventType: EventType)
    {
        switch(item.eventResponseType)
        {
            case 0: {
                //set state
                const setStateDelayedCallback = this.createEvent("DelayedCallbackEvent")
                setStateDelayedCallback.bind(() => { this.setState(item) })
                setStateDelayedCallback.reset(item.delay)
                break
            }
            case 1:
                //toggle
                item.sceneObject.enabled = !item.sceneObject.enabled
                break
            case 2: 
                //iterate through children
                this.iterateThroughChildren(item, eventType)
                break
            case 3:
                //animate
                this.playTransformAnimations(item, eventType)
                break
            case 4:
                //play custom animation
                this.playCustomAnimation(item, eventType)
                break
            case 5:
                //material property animation
                this.playMaterialPropertyAnimation(item)
                break
            case 6:
                //material color animation
                this.changeColor(item)
                break
            case 7:
                //callback
                this.useCallback(item)
                break
            case 8:
                //blendshape
                this.animateBlendshape(item, eventType)
                break
            case 9:
                //play audio clip
                this.playAudioClip(item, eventType)
                break
            case 10:
                this.playVideoTexture(item)
                break
        }
    }

    private setState(item: EventResponseType)
    {
        switch(item.state)
        {
            case 0:
                //on
                item.sceneObject.enabled = true
                break
            case 1:
                //off
                item.sceneObject.enabled = false
                break
        }
    }

    private initIterateThroughChildren(itemsArray: EventResponseType[])
    {
        for(let i = 0; i < itemsArray.length; i++)
        {
            const item = itemsArray[i]

            if(item.eventResponseType == 2)
            {
                const children = item.sceneObject.children
                if(children.length == 0)
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + " needs " + item.sceneObject.name + " to contain children SceneObjects to iterate through. Add children SceneObjects to " + item.sceneObject.name)
                }
                children[0].enabled = true
                for(let i = 1; i < children.length; i++)
                {
                    children[i].enabled = false
                }
            }
        }
    } 

    private iterateThroughChildren(item: EventResponseType, eventType: EventType)
    {     
        const iterationIndex = this.setIterationIndex(eventType)
        
        const childrenList = item.sceneObject.children
        const currentIndexItem = childrenList[iterationIndex % childrenList.length]
        currentIndexItem.enabled = false

        const nextIndexItem = childrenList[(iterationIndex + 1) % childrenList.length]
        nextIndexItem.enabled = true
    }

    private playTransformAnimations(item: EventResponseType, eventType: EventType)
    {
        if(item.animations.length == 0) return

        for(let i = 0; i < item.animations.length; i++)
        {
            let tween: Tween
            const animationInfo = item.animations[i]

            switch(animationInfo.animationType)
            {
                case 0:
                    //move local
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.moveToLocal(item.sceneObject.getTransform(), animationInfo.endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.moveFromToLocal(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.moveFromToLocal(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    break
                case 1: 
                    //move global
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.moveToWorld(item.sceneObject.getTransform(), animationInfo.endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.moveFromToWorld(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.moveFromToWorld(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    break
                case 2:
                    //scale local
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.scaleToLocal(item.sceneObject.getTransform(), animationInfo.endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.scaleFromToLocal(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.scaleFromToLocal(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    break
                case 3:
                    //scale global
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.scaleToWorld(item.sceneObject.getTransform(), animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.scaleFromToWorld(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.scaleFromToWorld(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    break
                case 4:
                    //rotate local
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.rotateToLocalInDegrees(item.sceneObject.getTransform(), animationInfo.endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.rotateFromToLocalInDegrees(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.rotateFromToLocalInDegrees(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    
                    break
                case 5:
                    //rotate global
                    switch(animationInfo.playOption)
                    {
                        case 0:
                            //play from current value
                            tween = LSTween.rotateToWorldInDegrees(item.sceneObject.getTransform(), animationInfo.endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 1:
                            //play from set value
                            tween = LSTween.rotateFromToWorldInDegrees(item.sceneObject.getTransform(), animationInfo.startValue, animationInfo.endValue, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        case 2: {
                            //toggle
                            const iterationIndex = this.setIterationIndex(eventType)

                            let startVal, endVal
                            if(iterationIndex % 2 == 0)
                            {
                                startVal = animationInfo.a
                                endVal = animationInfo.b
                            }
                            if(iterationIndex % 2 == 1)
                            {
                                startVal = animationInfo.b
                                endVal = animationInfo.a
                            }
                            tween = LSTween.rotateFromToWorldInDegrees(item.sceneObject.getTransform(), startVal, endVal, animationInfo.animationDurationInSeconds * 1000.0)
                            break
                        }
                    }
                    break
            }
            
            tween.delay(animationInfo.delay * 1000.0)
            this.setEasing(tween, animationInfo.easingData)
            tween.onStart(() =>
            {
                if(animationInfo.doOnStart == true)
                {
                    if(animationInfo.onStartAction.actionType == 0)
                    {
                        //do callback
                        this.createMyCallback<any>(animationInfo.onStartAction.script, animationInfo.onStartAction.functionName)("a")
                    }

                    if(animationInfo.onStartAction.actionType == 1)
                    {
                        //set On Start
                        animationInfo.onStartAction.targetObjects.forEach((obj) =>
                        {
                            if(!isNull(obj.targetObject))
                            {
                                obj.targetObject.enabled = obj.setValue
                            }
                            else
                            {
                                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Start")
                            }
                        })
                    }
                }
            })
            tween.onComplete(() =>
            {
                if(animationInfo.doOnComplete == true)
                {
                    if(animationInfo.onCompleteAction.actionType == 0)
                    {
                        this.createMyCallback<any>(animationInfo.onCompleteAction.script, animationInfo.onCompleteAction.functionName)("a")
                    }

                    if(animationInfo.onCompleteAction.actionType == 1)
                    {
                        //set On Complete
                        animationInfo.onCompleteAction.targetObjects.forEach((obj) =>
                        {
                            if(!isNull(obj.targetObject))
                            {
                                obj.targetObject.enabled = obj.setValue
                            }
                            else
                            {
                                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Complete")
                            }
                        })
                    }
                }
            })
            tween.start()
        }
    }

    private playCustomAnimation(item: EventResponseType, eventType: EventType)
    {   
        const animationPlayer = item.sceneObject.getComponent("AnimationPlayer")
        if(isNull(animationPlayer))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + "is missing AnimationPlayer Component. SceneObject must contain AnimationPlayer Component.")
        }
        const animationClips: AnimationClip[] = animationPlayer.clips

        if(item.customAnimationData.iterateThroughAllClips == true)
        {
            let iterationIndex = this.setIterationIndex(eventType)

            const clipName: string = animationClips[iterationIndex % animationClips.length].name
            animationPlayer.playClipAt(clipName, 0.0)
            iterationIndex ++
        }
        else
        {
            if(item.customAnimationData.animationName === "")
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Animation Name.")
            }
            const clip = animationPlayer.getClip(item.customAnimationData.animationName)
            if(isNull(clip))
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": AnimationPlayer on " + item.sceneObject.name + " does not contain clip called " + item.customAnimationData.animationName + ". Provide correct Animation Name.")
            }
            else
            {
                clip.disabled = false
                animationPlayer.playClipAt(item.customAnimationData.animationName, 0.0)
            }
        }
    }

    private playMaterialPropertyAnimation(item: EventResponseType)
    {
        const renderMeshV = item.sceneObject.getComponent("RenderMeshVisual")
        if(isNull(renderMeshV))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + "is missing RenderMeshVisual Component. SceneObject must contain RenderMeshVisual Component.")
        }
        else
        {
            if(item.materialProperyData.propertyName === "")
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing Property Name. Provide Property Name.")
            }
            else
            {
                if(renderMeshV.mainMaterial.mainPass[item.materialProperyData.propertyName] === undefined)
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + ": MainMaterial " + renderMeshV.mainMaterial.name + " does not contain " + item.materialProperyData.propertyName + " property. Provide correct Property Name.")
                }
            }
        }

        if(renderMeshV.mainMaterial.name != "clonedMaterial")
        {
            const material_copy = renderMeshV.mainMaterial.clone()
            material_copy.name = "clonedMaterial"
            renderMeshV.mainMaterial = material_copy
        }

        let tween: Tween
        switch(item.materialProperyData.valueType)
        {
            case 0:
                //number
                tween = LSTween.shaderFloatPropertyFromTo(renderMeshV.mainMaterial.mainPass, item.materialProperyData.propertyName, item.materialProperyData.startFloatValue, item.materialProperyData.endFloatValue, item.materialProperyData.animationDurationInSeconds * 1000.0)
                break
            case 1:
                //vec3
                tween = LSTween.shaderVec3PropertyFromTo(renderMeshV.mainMaterial.mainPass, item.materialProperyData.propertyName, item.materialProperyData.startVec3Value, item.materialProperyData.endVec3Value, item.materialProperyData.animationDurationInSeconds * 1000.0)
                break
            case 2:
                //vec4
                tween = LSTween.shaderColorPropertyFromTo(renderMeshV.mainMaterial.mainPass, item.materialProperyData.propertyName, item.materialProperyData.startVec4Value, item.materialProperyData.endVec4Value, item.materialProperyData.animationDurationInSeconds * 1000.0)
                break
        }
        tween.delay(item.materialProperyData.delay * 1000.0)
        this.setEasing(tween, item.materialProperyData.easingData)
        tween.onStart(() =>
        {
            if(item.materialProperyData.doOnStart == true)
            {
                if(item.materialProperyData.onStartAction.actionType == 0)
                {
                    //do callback
                    this.createMyCallback<any>(item.materialProperyData.onStartAction.script, item.materialProperyData.onStartAction.functionName)("a")
                }

                if(item.materialProperyData.onStartAction.actionType == 1)
                {
                    //set On Start
                    item.materialProperyData.onStartAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Start")
                        }
                    })
                }
            }
        })
        tween.onComplete(() =>
        {
            if(item.materialProperyData.doOnComplete == true)
            {
                if(item.materialProperyData.onCompleteAction.actionType == 0)
                {
                    this.createMyCallback<any>(item.materialProperyData.onCompleteAction.script, item.materialProperyData.onCompleteAction.functionName)("a")
                }

                if(item.materialProperyData.onCompleteAction.actionType == 1)
                {
                    //set On Complete
                    item.materialProperyData.onCompleteAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Complete")
                        }
                    })
                }
            }
        })
        tween.start()
    }

    private changeColor(item: EventResponseType)
    {
        //image and mesh
        let meshVisual: any
        meshVisual = item.sceneObject.getComponent("MaterialMeshVisual")
        let tween: Tween
        if(!isNull(meshVisual))
        {
            const material_copy = meshVisual.mainMaterial.clone()
            meshVisual.mainMaterial = material_copy

            tween = LSTween.colorTo(meshVisual.mainMaterial, item.colorProperyData.endColor, item.colorProperyData.animationDurationInSeconds * 1000.0)
        }
        else
        {
            //text
            meshVisual = item.sceneObject.getComponent("Text")
            tween = LSTween.colorTextTo(meshVisual, item.colorProperyData.endColor, item.colorProperyData.animationDurationInSeconds * 1000.0)
        }
        if(isNull(meshVisual))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing MaterialMeshVisual Component. SceneObject must contain RenderMeshVisual or Text or Image Component.")
        }
        tween.delay(item.colorProperyData.delay * 1000.0)
        this.setEasing(tween, item.colorProperyData.easingData)
        tween.onStart(() =>
        {
            if(item.colorProperyData.doOnStart == true)
            {
                if(item.colorProperyData.onStartAction.actionType == 0)
                {
                    //do callback
                    this.createMyCallback<any>(item.colorProperyData.onStartAction.script, item.colorProperyData.onStartAction.functionName)("a")
                }

                if(item.colorProperyData.onStartAction.actionType == 1)
                {
                    //set On Start
                    item.colorProperyData.onStartAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Start")
                        }
                    })
                }
            }
        })
        tween.onComplete(() =>
        {
            if(item.colorProperyData.doOnComplete == true)
            {
                if(item.colorProperyData.onCompleteAction.actionType == 0)
                {
                    this.createMyCallback<any>(item.colorProperyData.onCompleteAction.script, item.colorProperyData.onCompleteAction.functionName)("a")
                }

                if(item.colorProperyData.onCompleteAction.actionType == 1)
                {
                    //set On Complete
                    item.colorProperyData.onCompleteAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Complete")
                        }
                    })
                }
            }
        })
        tween.start()
    }

    private useCallback(item: EventResponseType)
    {
        this.createMyCallback<any>(item.script, item.functionName)("")
    }

    private animateBlendshape(item: EventResponseType, eventType: EventType)
    {
        const blendShapeData = item.blendShapeData
        const renderMeshVisual = item.sceneObject.getComponent("RenderMeshVisual")
        if(isNull(renderMeshVisual))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing RenderMeshVisual Component. SceneObject must contain RenderMeshVisual Component.")
        }
        else
        {
            if(blendShapeData.blenshapeName === "")
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing BlendShape Name. Provide BlendShape Name.")
            }
            else
            {
                const blendShapeNames = renderMeshVisual.getBlendShapeNames()
                if(blendShapeNames.length < 0)
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " RenderMeshVisual does not contain BlendShapes.")
                }
                if(renderMeshVisual.getBlendShapeNames().includes(blendShapeData.blenshapeName) == false)
                {
                    throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " RenderMeshVisual does not contain BlendShape " + blendShapeData.blenshapeName + ". Provide correct BlendShape name.")
                }
            }
        }
        

        let tween: Tween
        switch(blendShapeData.playOption)
        {
            case 0:
                //play from current value
                tween = LSTween.blendShapeValueTo(renderMeshVisual, blendShapeData.blenshapeName, blendShapeData.endValue, blendShapeData.animationDurationInSeconds * 1000.0)
                break
            case 1:
                //play from set value
                tween = LSTween.blendShapeValueFromTo(renderMeshVisual, blendShapeData.blenshapeName, blendShapeData.startValue, blendShapeData.endValue, blendShapeData.animationDurationInSeconds * 1000.0)
                break
            case 2: {
                //toggle
                const iterationIndex = this.setIterationIndex(eventType)

                let startVal, endVal
                if(iterationIndex % 2 == 0)
                {
                    startVal = blendShapeData.a
                    endVal = blendShapeData.b
                }
                if(iterationIndex % 2 == 1)
                {
                    startVal = blendShapeData.b
                    endVal = blendShapeData.a
                }
                tween = LSTween.blendShapeValueFromTo(renderMeshVisual, blendShapeData.blenshapeName, startVal, endVal, blendShapeData.animationDurationInSeconds * 1000.0)
                break
            }
        }
        tween.delay(blendShapeData.delay * 1000.0)
        this.setEasing(tween, blendShapeData.easingData)
        tween.onStart(() =>
        {
            if(blendShapeData.doOnStart == true)
            {
                if(blendShapeData.onStartAction.actionType == 0)
                {
                    //do callback
                    this.createMyCallback<any>(blendShapeData.onStartAction.script, blendShapeData.onStartAction.functionName)("a")
                }

                if(blendShapeData.onStartAction.actionType == 1)
                {
                    //set On Start
                    blendShapeData.onStartAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Start")
                        }
                    })
                }
            }
        })
        tween.onComplete(() =>
        {
            if(blendShapeData.doOnComplete == true)
            {
                if(blendShapeData.onCompleteAction.actionType == 0)
                {
                    this.createMyCallback<any>(blendShapeData.onCompleteAction.script, blendShapeData.onCompleteAction.functionName)("a")
                }

                if(blendShapeData.onCompleteAction.actionType == 1)
                {
                    //set On Complete
                    blendShapeData.onCompleteAction.targetObjects.forEach((obj) =>
                    {
                        if(!isNull(obj.targetObject))
                        {
                            obj.targetObject.enabled = obj.setValue
                        }
                        else
                        {
                            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Animation Complete")
                        }
                    })
                }
            }
        })
        tween.start()
    }

    private playAudioClip(item: EventResponseType, eventType: EventType)
    {
        const audioComponent = item.sceneObject.getComponent("AudioComponent")
        if(isNull(audioComponent))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing AudioComponent. SceneObject must contain AudioComponent.")
        }
        else
        {
            switch(item.audioControl.audioControlBehavior)
            {
                case 0: {
                    //play
                    const playAudioDelayedCallback = this.createEvent("DelayedCallbackEvent")
                    playAudioDelayedCallback.bind(() => { audioComponent.play(1) })
                    playAudioDelayedCallback.reset(item.audioControl.delay)
                    break
                }
                case 1:
                    //play / stop
                    if(audioComponent.isPlaying())
                    {
                        audioComponent.stop(true)
                    }
                    else
                    {
                        audioComponent.play(1)
                    }
                    break
                case 2:
                    //play / pause
                    if(audioComponent.isPlaying() == false && audioComponent.isPaused() == false)
                    {
                        audioComponent.play(1)
                    }
                    else if(audioComponent.isPlaying())
                    {
                        audioComponent.pause()
                    }
                    else if(audioComponent.isPaused())
                    {
                        audioComponent.resume()
                    }
                    break
            }
        }
    }

    private playVideoTexture(item: EventResponseType)
    {
        const image = item.sceneObject.getComponent("Image")
        if(!isNull(image))
        {
            const videoTextureProvider: VideoTextureProvider = image.mainMaterial.mainPass.baseTex.control as VideoTextureProvider
            if(!isNull(videoTextureProvider))
            {
                const playVideoTextureDelayedCallback = this.createEvent("DelayedCallbackEvent")
                playVideoTextureDelayedCallback.bind(() => 
                {
                    if(videoTextureProvider.status != VideoStatus.Playing)
                    {
                        switch(item.videoTextureControl.videoTextureControlBehavior)
                        {
                            case 0:
                                videoTextureProvider.play(1)
                                break
                            case 1:
                                videoTextureProvider.play(-1)
                                break
                        }
                    }
                })
                playVideoTextureDelayedCallback.reset(item.videoTextureControl.delay)

                videoTextureProvider.onPlaybackReady.add(() =>
                {
                    if(item.videoTextureControl.doOnStart == true)
                    {
                        if(item.videoTextureControl.onStartAction.actionType == 0)
                        {
                            this.createMyCallback<any>(item.videoTextureControl.onStartAction.script, item.videoTextureControl.onStartAction.functionName)("a")
                        }

                        if(item.videoTextureControl.onStartAction.actionType == 1)
                        {
                            //set On Start
                            item.videoTextureControl.onStartAction.targetObjects.forEach((obj) =>
                            {
                                if(!isNull(obj.targetObject))
                                {
                                    obj.targetObject.enabled = obj.setValue
                                }
                                else
                                {
                                    throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Video Texture Start")
                                }
                            })
                        }
                    }
                })

                videoTextureProvider.onPlaybackDone.add(() =>
                {
                    if(item.videoTextureControl.doOnComplete == true)
                    {
                        if(item.videoTextureControl.onCompleteAction.actionType == 0)
                        {
                            this.createMyCallback<any>(item.videoTextureControl.onCompleteAction.script, item.videoTextureControl.onCompleteAction.functionName)("a")
                        }

                        if(item.videoTextureControl.onCompleteAction.actionType == 1)
                        {
                            //set On Complete
                            item.videoTextureControl.onCompleteAction.targetObjects.forEach((obj) =>
                            {
                                if(!isNull(obj.targetObject))
                                {
                                    obj.targetObject.enabled = obj.setValue
                                }
                                else
                                {
                                    throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provide Target Object to Set State on Video Texture Complete")
                                }
                            })
                        }
                    }
                })
            }
            else
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing video as its' Texture on Image Component. SceneObject must contain Image Component with video as its' Texture.")
            }
        }
        else
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + ": " + item.sceneObject.name + " is missing Image Component. SceneObject must contain Image Component with video as its' Texture.")
        }
    }

    private createMyCallback<T>(scriptComponent: ScriptComponent, functionName: string): (args: T) => void 
    {
        if(isNull(scriptComponent))
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing Script for Custom Callback. Assign Script")
        }
        if (scriptComponent === undefined) 
        {
            return () => 
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing Script for Custom Callback. Assign Script")
            }
        }
        if(functionName === "")
        {
            throw new Error("Interactable Helper on " + this.getSceneObject().name + " is missing Function Name for Custom Callback. Provide Function Name")
        }
        return (args) => 
        {
            if ((scriptComponent as any)[functionName]) 
            {
                (scriptComponent as any)[functionName](args)
            }
            else
            {
                throw new Error("Interactable Helper on " + this.getSceneObject().name + ": provided Script does not have " + functionName + " function. Check Function Name.")
            }
        }
    }

    private setIterationIndex(eventType: EventType) : number
    {
        let iterationIndex
        switch(eventType)
        {
            case EventType.HoverEnter:
                iterationIndex = this.hoverEnterCurrentIterationIndex
                break
            case EventType.HoverExit:
                iterationIndex = this.hoverExitCurrentIterationIndex
                break
            case EventType.TriggerDown:
                iterationIndex = this.triggerDownCurrentIterationIndex
                break
            case EventType.TriggerUp:
                iterationIndex = this.triggerUpCurrentIterationIndex
                break
        }
        return iterationIndex
    }

    private setEasing(tween: Tween, easingData: EasingData)
    {
        switch(easingData.easing)
        {
            case 0:
                tween.easing(Easing.Linear.None)
                break
            case 1:
                tween.easing(Easing.Linear.In)
                break
            case 2:
                tween.easing(Easing.Linear.Out)
                break
            case 3:
                tween.easing(Easing.Linear.InOut)
                break
            case 4:
                tween.easing(Easing.Quadratic.In)
                break
            case 5:
                tween.easing(Easing.Quadratic.Out)
                break
            case 6:
                tween.easing(Easing.Quadratic.InOut)
                break
            case 7:
                tween.easing(Easing.Cubic.In)
                break
            case 8:
                tween.easing(Easing.Cubic.Out)
                break
            case 9:
                tween.easing(Easing.Cubic.InOut)
                break
            case 10:
                tween.easing(Easing.Quartic.In)
                break
            case 11:
                tween.easing(Easing.Quartic.Out)
                break
            case 12:
                tween.easing(Easing.Quartic.InOut)
                break
            case 13:
                tween.easing(Easing.Quintic.In)
                break
            case 14:
                tween.easing(Easing.Quintic.Out)
                break
            case 15:
                tween.easing(Easing.Quintic.InOut)
                break
            case 16:
                tween.easing(Easing.Exponential.In)
                break
            case 17:
                tween.easing(Easing.Exponential.Out)
                break
            case 18:
                tween.easing(Easing.Exponential.InOut)
                break
            case 19:
                tween.easing(Easing.Circular.In)
                break
            case 20:
                tween.easing(Easing.Circular.Out)
                break
            case 21:
                tween.easing(Easing.Circular.InOut)
                break
            case 22:
                tween.easing(Easing.Elastic.In)
                break
            case 23:
                tween.easing(Easing.Elastic.Out)
                break
            case 24:
                tween.easing(Easing.Elastic.InOut)
                break
            case 25:
                tween.easing(Easing.Back.In)
                break
            case 26:
                tween.easing(Easing.Back.Out)
                break
            case 27:
                tween.easing(Easing.Back.InOut)
                break
            case 29:
                tween.easing(Easing.Bounce.In)
                break
            case 30:
                tween.easing(Easing.Bounce.Out)
                break
            case 31:
                tween.easing(Easing.Bounce.InOut)
                break
            case 32:
                tween.easing(Easing.Sinusoidal.In)
                break
            case 33:
                tween.easing(Easing.Sinusoidal.Out)
                break
            case 34:
                tween.easing(Easing.Sinusoidal.InOut)
                break
        }
    }
}

export enum EventType
{
    HoverEnter,
    HoverExit,
    TriggerDown,
    TriggerUp
}