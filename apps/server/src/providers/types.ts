export type GenerationRequest = {
  provider: string
  prompt: string
  model?: string
  aspectRatio?: string
  durationSeconds?: number
  voiceId?: string
  contentItemId?: string
  inputAssetIds?: string[]
}

export type GeneratedMedia = {
  bytes: Buffer
  mimeType: string
  filename: string
  metadata?: Record<string, unknown>
}

export interface ImageProvider {
  generate(request: GenerationRequest): Promise<GeneratedMedia>
}

export interface VoiceProvider {
  synthesize(request: GenerationRequest): Promise<GeneratedMedia>
}
