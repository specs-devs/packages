/**
 * Specs Inc. 2026
 * Gemini API component for the Depth Cache Spectacles lens.
 */
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {AI_RESPONSE_POLICY, buildSystemPromptContext} from "./NespressoKnowledge"

const GEMINI_MODEL = "gemini-2.5-pro"

const SYSTEM_MESSAGE =
  "You are an AI assistant inside augmented reality glasses, helping the user with tasks including Nespresso VertuoLine maintenance.\n" +
  buildSystemPromptContext() +
  AI_RESPONSE_POLICY +
  "\nReturn bounding boxes as a JSON array with labels. " +
  "Your answer must be a JSON object with these keys: 'message', 'data', and 'currentStep'.\n" +
  "  'message': a short, helpful response (max 175 characters).\n" +
  "  'data': array of bounding box objects (label + coordinates). " +
  "    Set showArrow to true most of the time, especially for task steps.\n" +
  "  'currentStep': integer 1–15 if you detect the user is performing a specific Nespresso descaling step, otherwise 0.\n" +
  "    Detect the step from the camera view AND the user's question together.\n" +
  "Never return masks or code fencing. Limit to 25 objects. " +
  "Don't label anything over 20 feet away. Don't duplicate labels. " +
  "For how-to tasks you may label Step #1, Step #2, etc. on relevant objects.\n"

@component
export class GeminiAPI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">GeminiAPI – Gemini vision API integration</span><br/><span style="color: #94A3B8; font-size: 11px;">Sends camera frames to Gemini and parses bounding box responses.</span>')
  @ui.separator

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy)")
  enableLoggingLifecycle: boolean = false

  private logger: Logger

  onAwake() {
    this.logger = new Logger("GeminiAPI", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")
  }

  makeGeminiRequest(texture: Texture, userQuery: string, callback: (any) => void) {
    Base64.encodeTextureAsync(
      texture,
      (base64String) => {
        this.logger.info("Making image request...")
        this.sendGeminiChat(userQuery, base64String, texture, callback)
      },
      () => {
        this.logger.error("Image encoding failed!")
      },
      CompressionQuality.HighQuality,
      EncodingType.Png
    )
  }

  sendGeminiChat(request: string, image64: string, texture: Texture, callback: (response: any) => void) {
    const respSchema: GeminiTypes.Common.Schema = {
      type: "object",
      properties: {
        message: {type: "string"},
        currentStep: {type: "number"},
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              boundingBox: {
                type: "array",
                items: {type: "number"}
              },
              label: {type: "string"},
              useArrow: {type: "boolean"}
            },
            required: ["boundingBox", "label", "useArrow"]
          }
        }
      },
      required: ["message", "currentStep", "data"]
    }

    const reqObj: GeminiTypes.Models.GenerateContentRequest = {
      model: GEMINI_MODEL,
      type: "generateContent",
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: image64
                }
              },
              {
                text: request
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_MESSAGE
            }
          ]
        },
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json",
          response_schema: respSchema
        }
      }
    }

    this.logger.debug(JSON.stringify(reqObj.body))

    Gemini.models(reqObj)
      .then((response) => {
        const responseObj = JSON.parse(response.candidates[0].content.parts[0].text)
        this.onGeminiResponse(responseObj, texture, callback)
      })
      .catch((error) => {
        this.logger.error("Gemini error: " + error)
        if (callback != null) {
          callback({
            points: [],
            lines: [],
            aiMessage: "reponse error..."
          })
        }
      })
  }

  private onGeminiResponse(responseObj: any, texture: Texture, callback: (response: any) => void) {
    const geminiResult = {
      points: [],
      aiMessage: "no response",
      detectedStep: 0
    }

    this.logger.info("GEMINI RESPONSE: " + responseObj.message)
    geminiResult.aiMessage = responseObj.message
    geminiResult.detectedStep = typeof responseObj.currentStep === "number" ? responseObj.currentStep : 0
    if (geminiResult.detectedStep > 0) {
      this.logger.info("DETECTED STEP: " + geminiResult.detectedStep)
    }
    try {
      const data = responseObj.data
      this.logger.debug("Data: " + JSON.stringify(data))
      this.logger.info("POINT LENGTH: " + data.length)
      for (let i = 0; i < data.length; i++) {
        const centerPoint = this.boundingBoxToPixels(data[i].boundingBox, texture.getWidth(), texture.getHeight())
        const lensStudioPoint = {
          pixelPos: centerPoint,
          label: data[i].label,
          showArrow: data[i].useArrow
        }
        geminiResult.points.push(lensStudioPoint)
      }
    } catch (error) {
      this.logger.error("Error parsing points!: " + error)
    }
    if (callback != null) {
      callback(geminiResult)
    }
  }

  private boundingBoxToPixels(boxPoints: any, width: number, height: number): vec2 {
    const x1 = MathUtils.remap(boxPoints[1], 0, 1000, 0, width)
    const y1 = MathUtils.remap(boxPoints[0], 0, 1000, height, 0)
    const topLeft = new vec2(x1, height - y1)
    const x2 = MathUtils.remap(boxPoints[3], 0, 1000, 0, width)
    const y2 = MathUtils.remap(boxPoints[2], 0, 1000, height, 0)
    const bottomRight = new vec2(x2, height - y2)
    const center = topLeft.add(bottomRight).uniformScale(0.5)
    return center
  }
}
