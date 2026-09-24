# Provider research notes

These notes record the external API facts used for the Google image and ElevenLabs worker design.

## Google image generation

Google's current Gemini API documentation states that Imagen is a legacy image-generation model and is no longer available through the Gemini API; Google directs developers to Nano Banana for image generation and editing. Official sources:

- https://ai.google.dev/gemini-api/docs/imagen
- https://ai.google.dev/gemini-api/docs/image-generation

The worker should therefore treat `google-imagen` as a compatibility/provider label only and use a currently supported Google image-generation endpoint configured by the operator. Do not claim that the old Imagen Gemini endpoint is active.

## ElevenLabs

ElevenLabs documents text-to-speech through the Text-to-Speech Convert API. The API returns audio and authenticates with the `xi-api-key` header. Official sources:

- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/api

The worker uses the documented REST shape: `POST /v1/text-to-speech/{voice_id}` with a JSON body containing text and model/output settings, then stores the returned audio bytes as a M.O.S.A.N.G. media asset.
