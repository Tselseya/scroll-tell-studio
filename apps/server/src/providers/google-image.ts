import type { GenerationRequest, GeneratedMedia, ImageProvider } from './types.js'

function readBase64(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

export class GoogleImageProvider implements ImageProvider {
  async generate(request: GenerationRequest): Promise<GeneratedMedia> {
    const apiKey = process.env.GOOGLE_IMAGE_API_KEY ?? process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('Google image provider is not configured: set GOOGLE_IMAGE_API_KEY')

    const model = request.model ?? process.env.GOOGLE_IMAGE_MODEL ?? 'gemini-2.5-flash-image'
    const configuredUrl = process.env.GOOGLE_IMAGE_API_URL
    const url = configuredUrl ?? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    const body = configuredUrl
      ? {
          instances: [{ prompt: request.prompt }],
          parameters: { sampleCount: 1, aspectRatio: request.aspectRatio ?? '1:1' },
        }
      : {
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: request.aspectRatio ?? '1:1' } },
        }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(configuredUrl ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Google image provider returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
    const payload = await response.json() as any
    const base64 = readBase64(payload?.predictions?.[0]?.bytesBase64Encoded)
      ?? readBase64(payload?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData?.data)?.inlineData?.data)
      ?? readBase64(payload?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inline_data?.data)?.inline_data?.data)
    if (!base64) throw new Error('Google image provider returned no image bytes')

    return {
      bytes: Buffer.from(base64, 'base64'),
      mimeType: 'image/png',
      filename: `google-image-${Date.now()}.png`,
      metadata: { provider: 'google', model, aspectRatio: request.aspectRatio ?? '1:1' },
    }
  }
}
