import type { GenerationRequest, GeneratedMedia, VoiceProvider } from './types.js'

export class ElevenLabsProvider implements VoiceProvider {
  async synthesize(request: GenerationRequest): Promise<GeneratedMedia> {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) throw new Error('ElevenLabs provider is not configured: set ELEVENLABS_API_KEY')
    const voiceId = request.voiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID
    if (!voiceId) throw new Error('ElevenLabs requires voiceId or ELEVENLABS_DEFAULT_VOICE_ID')

    const modelId = request.model ?? process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2'
    const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT ?? 'mp3_44100_128'
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { accept: 'audio/mpeg', 'content-type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text: request.prompt, model_id: modelId }),
    })
    if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: 'audio/mpeg',
      filename: `elevenlabs-${Date.now()}.mp3`,
      metadata: { provider: 'elevenlabs', model: modelId, voiceId, outputFormat },
    }
  }
}
