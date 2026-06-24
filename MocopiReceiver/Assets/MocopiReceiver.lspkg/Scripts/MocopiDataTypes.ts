/**
 * Specs Inc. 2026
 * Type definitions for mocopi motion capture data protocol. Defines the structure for skeleton
 * definitions, frame data, bones, and connection statistics used throughout the mocopi integration.
 */

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface MocopiBone {
  id: number
  name: string
  parent_id: number
  rotation: Quaternion
  position: Vector3
}

export interface SkeletonDefinition {
  type: "skeleton_definition"
  timestamp: string
  num_bones: number
  bones: MocopiBone[]
}

export interface FrameData {
  type: "frame_data"
  timestamp: string
  frame_id: number
  bones: MocopiBone[]
  raw_data?: string
  data_length?: number
}

export type MocopiMessage = SkeletonDefinition | FrameData

export const MOCOPI_BONE_NAMES = [
  "root", "torso_1", "torso_2", "torso_3", "torso_4", "torso_5", "torso_6", "torso_7",
  "neck_1", "neck_2", "head",
  "l_shoulder", "l_up_arm", "l_low_arm", "l_hand",
  "r_shoulder", "r_up_arm", "r_low_arm", "r_hand",
  "l_up_leg", "l_low_leg", "l_foot", "l_toes",
  "r_up_leg", "r_low_leg", "r_foot", "r_toes"
]

export interface ConnectionStats {
  connected: boolean
  framesReceived: number
  lastFrameTime: number
  averageFPS: number
  reconnectAttempts: number
}
