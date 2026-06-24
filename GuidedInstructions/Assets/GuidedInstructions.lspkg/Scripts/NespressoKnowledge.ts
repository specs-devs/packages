/**
 * Specs Inc. 2026
 * Nespresso VertuoLine knowledge base for AR-guided maintenance assistance.
 * Extracted from official Nespresso VertuoLine User Manual and Descaling Guide.
 */

export interface MaintenanceStep {
  id: number
  title: string
  description: string
  phase: "preparation" | "descaling" | "rinsing" | "cleanup"
  warning?: string
  timeNote?: string
  /**
   * When the guidance panel shows this step, the AI short reply must stay on this topic.
   * (Stops the model from answering with unrelated manual text, e.g. brew/capsule ejection.)
   */
  assistantFocus?: string
}

export interface TroubleshootIssue {
  symptom: string
  fixes: string[]
}

// ─── Machine Overview ────────────────────────────────────────────────────────

export const MACHINE_INFO = {
  name: "Nespresso VertuoLine (Vertuo)",
  technology: "CentrifusionTM – spins the capsule at high speed to extract coffee",
  maintenanceSchedule: "Descale every 3 months or 300 capsules, whichever comes first",
  descalingDuration: "~20 minutes total",
  cleaningDuration: "~5 minutes (3 pump cycles)",
  autoOffTime: "9 minutes of non-use",
  requiredForDescaling: ["Official Nespresso Descaling Kit (1 packet)", "20 oz receptacle (x2)", "Damp cloth", "Protective surface under machine"],
}

// ─── Light / Button States ────────────────────────────────────────────────────

export const LIGHT_STATES = [
  { state: "Steady ON",             meaning: "Machine is ready to brew" },
  { state: "Blinking slow (heating)",meaning: "Machine is heating up (~15 sec)" },
  { state: "Blinking fast",         meaning: "Descaling or cleaning mode active" },
  { state: "Blink 1 + pause",       meaning: "Water tank empty – refill and press button" },
  { state: "Blink 2 + pause (loop)",meaning: "Error – try turn off/on; check capsule & lever" },
  { state: "Blink 3 times then steady", meaning: "Descaling alert – descale soon, few brews left" },
]

// ─── Safety Warnings ─────────────────────────────────────────────────────────

export const SAFETY_WARNINGS = [
  "Use ONLY the official Nespresso Descaling Kit. Vinegar or store-bought descalers damage the machine.",
  "Place a protective surface under the machine – descaling solution can discolor surfaces.",
  "Spill cleanup: remove solution immediately to avoid surface damage.",
  "Keep descaling solution away from children.",
  "Do not swallow or ingest the descaling solution.",
  "Eye contact: rinse immediately with plenty of water for 15 minutes and seek medical advice.",
  "Skin contact: descaling solution may be irritating.",
  "Do not fill the water tank during the descaling process.",
  "After descaling, wipe down the machine with a damp cloth.",
]

// ─── Descaling Steps (15 steps, ~20 min) ─────────────────────────────────────

export const DESCALING_STEPS: MaintenanceStep[] = [
  {
    id: 1,
    phase: "preparation",
    title: "Prepare descaling solution",
    description: "Fill the water tank with 1 packet of descaling solution and half a tank of water. Mix gently.",
    assistantFocus:
      "Descaling prep only: official descaler packet + fresh water to half a tank, swirl to mix. Do not talk about ejecting a spent coffee capsule or closing the head after a brew—that is normal brewing, not this step.",
  },
  {
    id: 2,
    phase: "preparation",
    title: "Empty capsule container & drip tray",
    description: "With machine plugged in, empty the capsule container and drip tray, then place both back onto the machine.",
    assistantFocus: "Empty the used-capsule bin and drip tray, rinse if needed, and click both back in place.",
  },
  {
    id: 3,
    phase: "preparation",
    title: "Power on & wait for steady light",
    description: "Leave the lever in the unlocked position. Press and release the button once, then wait for a steady (non-blinking) light – machine is ready.",
    assistantFocus: "Lever unlocked, one short press, then wait for a solid (not blinking) ready light.",
  },
  {
    id: 4,
    phase: "descaling",
    title: "Enter descaling mode – Part 1",
    description: "Press and HOLD the button until the steady light turns OFF first, then starts blinking QUICKLY. Takes ~7 seconds. Don't release too early.",
    assistantFocus: "Long-press the button until the light goes off then blinks fast (~7 s)—don't release early.",
  },
  {
    id: 5,
    phase: "descaling",
    title: "Lock lever → unlock lever",
    description: "Turn the lever LEFT to lock it, then turn it back to the FRONT to unlock it. You have 45 seconds to complete Steps 5 and 6.",
    warning: "Steps 5 and 6 must BOTH be completed within 45 seconds!",
    assistantFocus: "Within 45 s with step 6: lock lever left, then swing lever back to front/unlock.",
  },
  {
    id: 6,
    phase: "descaling",
    title: "Confirm descaling mode – Part 2",
    description: "Press and HOLD the button again until the light turns OFF and then starts blinking quickly again. Must finish within 45 seconds of Step 5.",
    warning: "Must be completed within 45 seconds of Step 5!",
    assistantFocus: "Second long hold: light off, then fast blink again—still inside the 45 s window from step 5.",
  },
  {
    id: 7,
    phase: "descaling",
    title: "Lock the lever",
    description: "Lock the lever. The light should still be blinking FAST – this confirms descaling mode is active. If not blinking fast, start over from Step 3.",
    assistantFocus: "Lock the lever; fast blink should continue—means descaling mode is active.",
  },
  {
    id: 8,
    phase: "descaling",
    title: "Start descaling cycle",
    description: "Place a 20 oz receptacle under the spout. Press and release the button once to begin. Light blinks continuously; machine dispenses solution intermittently.",
    assistantFocus: "~20 oz container under coffee outlet; single press starts pumping descaling solution.",
  },
  {
    id: 9,
    phase: "descaling",
    title: "Wait for solution to finish",
    description: "Machine goes silent when solution is exhausted. Discard the used solution from the receptacle, then place the EMPTY receptacle back under the spout.",
    assistantFocus: "Wait until it stops; pour out the used descaler; put the empty container back under the spout.",
  },
  {
    id: 10,
    phase: "rinsing",
    title: "Rinse tank & start rinse cycle",
    description: "Rinse the water tank. Refill with 2/3 fresh water and place back on the machine. Press and release the button to start the rinsing process.",
    assistantFocus: "Rinse tank thoroughly, refill about 2/3 with clean water, replace tank, one press to rinse.",
  },
  {
    id: 11,
    phase: "rinsing",
    title: "Wait for rinse to complete",
    description: "Machine will stop making noise when the water tank is completely empty. Discard the rinse water from the receptacle.",
    assistantFocus: "Let it run until quiet and the tank is empty; empty the catch bowl.",
  },
  {
    id: 12,
    phase: "rinsing",
    title: "Exit rinsing mode",
    description: "Once the water tank is empty, press and HOLD the button until the blinking light becomes STEADY. Takes ~7 seconds. This exits descaling mode.",
    assistantFocus: "Long-hold until the blinking becomes a steady light (~7 s) to exit descaling/rinse mode.",
  },
  {
    id: 13,
    phase: "cleanup",
    title: "Refill water tank",
    description: "Fill the water tank with fresh water and place it back onto the machine.",
    assistantFocus: "Fill with fresh drinking water for normal use and seat the tank.",
  },
  {
    id: 14,
    phase: "cleanup",
    title: "Clean capsule container & drip tray",
    description: "Empty and rinse the capsule container and drip tray, then reinsert them into the machine.",
    assistantFocus: "Post-descale: rinse capsule bucket and drip tray and reinstall.",
  },
  {
    id: 15,
    phase: "cleanup",
    title: "Final wipe-down & rest",
    description: "Wipe down the machine with a damp cloth. Let the machine rest for 10 minutes. The machine is now ready for use.",
    timeNote: "Rest 10 minutes before brewing",
    assistantFocus: "Wipe the machine with a damp cloth; wait 10 minutes before brewing again.",
  },
]

// ─── Troubleshooting ─────────────────────────────────────────────────────────

export const TROUBLESHOOTING: TroubleshootIssue[] = [
  {
    symptom: "No light on button – machine doesn't start",
    fixes: [
      "Machine auto-turned off – press button or unlock lever.",
      "Check outlet, plug, voltage, and fuse.",
      "Check water tank is filled.",
    ],
  },
  {
    symptom: "No coffee and no water flowing",
    fixes: [
      "Descale if needed (see descaling guide).",
      "Open machine head to eject capsule, then run a cleaning cycle.",
    ],
  },
  {
    symptom: "Coffee is not hot enough",
    fixes: ["Descale the machine.", "Preheat cup with hot water from the tap."],
  },
  {
    symptom: "Light blinks 1 time then pauses repeatedly",
    fixes: ["Water tank is empty – fill it and press button.", "Check lever is properly locked."],
  },
  {
    symptom: "Light blinks 2 times then pauses repeatedly – machine not running",
    fixes: [
      "Check capsule is correctly inserted and lever is locked.",
      "Press button 3 seconds to turn OFF, then press again to turn ON.",
      "If stuck in descaling mode: hold button for at least 7 seconds to exit.",
      "Unplug for 10 seconds, plug back in, press button to turn ON.",
    ],
  },
  {
    symptom: "Light blinks 3 times then goes steady – descaling alert",
    fixes: ["Machine is requesting descaling. You have a few brews left before it becomes mandatory."],
  },
  {
    symptom: "Machine blinks and won't stop (stuck in descaling mode)",
    fixes: [
      "Hold the button for at least 7 seconds to exit descaling mode.",
      "Turn machine OFF (hold 3 sec), wait 20 min, turn back ON.",
    ],
  },
  {
    symptom: "Coffee grounds in cup",
    fixes: ["Run the cleaning procedure twice. See Cleaning section."],
  },
  {
    symptom: "Leakage or unusual coffee flow",
    fixes: ["Check the water tank is correctly positioned on the machine."],
  },
]

// ─── Cleaning (quick reference, distinct from descaling) ─────────────────────

export const CLEANING_STEPS = [
  "Empty capsule container and drip tray. Do NOT insert a capsule.",
  "Fill water tank with fresh water.",
  "Turn machine ON, wait for steady light.",
  "Press the button 3 times within 2 seconds to start cleaning.",
  "Light blinks quickly during cleaning (~5 minutes, 3 pump cycles).",
  "To pause: press button once (light goes steady). Press again to resume.",
  "Machine stops automatically when done.",
]

/**
 * Text prepended to the user utterance so Gemini knows which descaling step the AR panel shows.
 * See AI_RESPONSE_POLICY in GeminiAPI (must stay aligned with this block).
 */
export function formatGuidanceContextForPrompt(step: MaintenanceStep): string {
  const focus =
    step.assistantFocus != null && step.assistantFocus.length > 0 ? step.assistantFocus : step.description
  let block =
    `[Active Nespresso Vertuo DESCALING guide – Step ${step.id}/${DESCALING_STEPS.length}]\n` +
    `Phase: ${step.phase}\n` +
    `Title: ${step.title}\n` +
    `Details: ${step.description}`
  if (step.warning) block += `\nWarning: ${step.warning}`
  if (step.timeNote) block += `\nTime note: ${step.timeNote}`
  block += `\nAssistant focus (your JSON "message" must match this topic only): ${focus}`
  return block
}

/** Extra system-instruction rules; appended after the knowledge base in GeminiAPI. */
export const AI_RESPONSE_POLICY =
  "\n\n=== AI RESPONSE POLICY (CRITICAL) ===\n" +
  "The user message may start with a block in square brackets: [Active Nespresso Vertuo DESCALING guide – Step X/15] ...\n" +
  "That block is AUTHORITATIVE: the AR glasses already show this step to the user.\n\n" +
  "For the JSON field \"message\" (max 175 characters):\n" +
  "• Paraphrase ONLY the active step (title, details, warning if relevant). Do not contradict the on-screen step.\n" +
  "• If the user says \"what next?\", \"help\", or similar, answer strictly from that step—not from other manual sections.\n" +
  "• Do NOT give generic coffee-brewing tips (e.g. closing the head to eject a spent Vertuo capsule after a brew) during Steps 1–15 unless that exact action is part of THIS step's text.\n" +
  "• Troubleshooting entries (capsule ejection, no water flow, etc.) are for \"message\" ONLY when the user clearly describes that problem, or when there is NO [Active ... DESCALING guide] block in the message.\n" +
  "• JSON \"currentStep\": prefer the step number from the [Active ...] block when the scene matches that procedure; otherwise infer from image + question.\n" +
  "=== END AI RESPONSE POLICY ===\n"

// ─── System Prompt Builder ────────────────────────────────────────────────────

export function buildSystemPromptContext(): string {
  let ctx = "\n\n=== NESPRESSO VERTUO KNOWLEDGE BASE ===\n"

  ctx += `Machine: ${MACHINE_INFO.name}\n`
  ctx += `Technology: ${MACHINE_INFO.technology}\n`
  ctx += `Maintenance: ${MACHINE_INFO.maintenanceSchedule}\n`
  ctx += `Required for descaling: ${MACHINE_INFO.requiredForDescaling.join(", ")}\n\n`

  ctx += "BUTTON / LIGHT STATES:\n"
  LIGHT_STATES.forEach((l) => {
    ctx += `  ${l.state}: ${l.meaning}\n`
  })

  ctx += "\nSAFETY WARNINGS:\n"
  SAFETY_WARNINGS.forEach((w) => {
    ctx += `  - ${w}\n`
  })

  ctx += `\nDESCALING STEPS (${DESCALING_STEPS.length} steps, ~20 min):\n`
  DESCALING_STEPS.forEach((step) => {
    ctx += `  Step ${step.id} [${step.phase.toUpperCase()}] – ${step.title}: ${step.description}`
    if (step.warning) ctx += ` ⚠ ${step.warning}`
    if (step.timeNote) ctx += ` ⏱ ${step.timeNote}`
    ctx += "\n"
  })

  ctx += "\nTROUBLESHOOTING:\n"
  TROUBLESHOOTING.forEach((issue) => {
    ctx += `  Problem: ${issue.symptom}\n`
    issue.fixes.forEach((fix) => {
      ctx += `    → ${fix}\n`
    })
  })

  ctx += "\nQUICK CLEANING (not descaling):\n"
  CLEANING_STEPS.forEach((step, i) => {
    ctx += `  ${i + 1}. ${step}\n`
  })

  ctx += "=== END NESPRESSO KNOWLEDGE BASE ===\n"
  return ctx
}
