# Real-Time Media Streams (RTMS) Integration

## Overview

Real-Time Media Streams (RTMS) allows Zoom Apps to receive live audio, video, and transcript data from ongoing meetings. This guide covers both the official `@zoom/rtms` SDK and custom WebSocket implementations.

## What is RTMS?

RTMS is a data pipeline that gives your app access to live audio, video, and transcript data from Zoom meetings.

RTMS provides real-time access to:
- **Audio streams** - Raw PCM audio data (16-bit signed, 16kHz, mono)
- **Video streams** - H.264 encoded video frames (up to 30 FPS)
- **Transcripts** - Live transcription with timestamps and speaker info
- **Meeting Events** - Signaling events and meeting metadata
- **Participant Events** - Join/leave notifications

### RTMS Benefits

- Apps can auto-start when users join meetings
- Eliminates the need for bots or device software
- No visible "participant" in the meeting
- Works with REST APIs or JavaScript SDK

### RTMS Enablement

**IMPORTANT:** To enable RTMS, reach out to your Zoom account team or fill out [this form](https://www.zoom.com/en/realtime-media-streams/#form).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Zoom Meeting                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Audio   │  │  Video   │  │Transcript│            │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘            │
└────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │
         └─────────────┴─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    meeting.rtms_started   │
         │    Webhook Event          │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    RTMS Server            │
         │  - Connect to stream      │
         │  - Buffer audio/video     │
         │  - Save transcripts       │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    meeting.rtms_stopped   │
         │    Webhook Event          │
         └───────────────────────────┘
```

## Prerequisites

1. **RTMS Enabled** - Contact your Zoom account team
2. **Marketplace Configuration:**
   - Granular scopes enabled
   - RTMS media scopes selected:
     - `meeting:read:meeting_audio`
     - `meeting:read:meeting_video`
     - `meeting:read:meeting_transcript`
   - Event subscriptions for `meeting.rtms_started` and `meeting.rtms_stopped`
3. **Frontend SDK Capabilities:**
   - `startRTMS` and `stopRTMS` in SDK config
4. **System Requirements:**
   - ffmpeg installed (for audio/video conversion)
   - Node.js 14+
   - Publicly accessible HTTPS endpoint for webhooks

## SDK Implementation

### Dependencies

```json
{
  "dependencies": {
    "@zoom/rtms": "^1.0.0",
    "dotenv": "^16.0.0"
  }
}
```

**Note:** v1.0 uses a class-based `rtms.Client()` API (one client per meeting). Logging is configured via `ZM_RTMS_LOG_LEVEL` env var instead of `configureLogger()`.

### Main Handler

```javascript
import rtms from '@zoom/rtms'
import { convertAudioDataToWav } from './utils/audio.js'
import { convertTranscriptData } from './utils/transcript.js'

const meetingData = {
  audio: [],
  video: [],
}

rtms.onWebhookEvent(async ({ event, payload }) => {
  console.log('Incoming webhook', event)

  if (event === 'meeting.rtms_started') {
    const client = new rtms.Client()

    client.onAudioData((data, timestamp, metadata) => {
      console.log('Audio received at:', timestamp)
      meetingData.audio.push(data)
    })

    client.onVideoData((data, timestamp, metadata) => {
      console.log('Video received at:', timestamp)
      meetingData.video.push(data)
    })

    client.onTranscriptData((data, timestamp, metadata, user) => {
      const text = data.toString('utf-8')
      convertTranscriptData(user.userName, timestamp, text, payload.meeting_uuid)
    })

    client.join(payload)
  }
  else if (event === 'meeting.rtms_stopped') {
    if (meetingData.audio.length) {
      const audioBuffer = Buffer.concat(meetingData.audio)
      await convertAudioDataToWav(audioBuffer, payload)
      meetingData.audio = []
    }

    if (meetingData.video.length) {
      const videoBuffer = Buffer.concat(meetingData.video)
      await convertVideoDataToMp4(videoBuffer, payload)
      meetingData.video = []
    }
  }
})
```

### RTMS Client API

```javascript
const client = new rtms.Client()

// Audio data callback
client.onAudioData((data, timestamp, metadata) => {
  // data: Buffer containing raw PCM audio
  // metadata: { sampleRate, channels, bitsPerSample }
})

// Video data callback
client.onVideoData((data, timestamp, metadata) => {
  // data: Buffer containing H.264 video frame
  // metadata: { width, height, frameRate }
})

// Transcript data callback
client.onTranscriptData((data, timestamp, metadata, user) => {
  // data: Buffer containing transcript text
  // user: { userId, userName }
})

// Join session
client.join(payload)
```

## WebSocket Implementation

### Express Server

```javascript
const express = require('express')
const { rtmsHandler } = require('./api/controller')

const app = express()
app.use(express.json())
app.post('/webhook', rtmsHandler)

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`RTMS server running on port ${PORT}`)
})
```

### Webhook Handler

```javascript
const crypto = require('crypto')

function rtmsHandler(req, res) {
  const { event, payload } = req.body

  switch (event) {
    case 'endpoint.url_validation':
      return handleUrlValidation(payload, res)

    case 'meeting.rtms_started':
      handleRtmsStarted(payload)
      return res.sendStatus(200)

    case 'meeting.rtms_stopped':
      handleRtmsStopped(payload)
      return res.sendStatus(200)

    default:
      return res.sendStatus(200)
  }
}
```

### URL Validation

```javascript
function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) {
    return res.sendStatus(400)
  }

  const encryptedToken = crypto
    .createHmac('sha256', process.env.ZOOM_SECRET_TOKEN)
    .update(payload.plainToken)
    .digest('hex')

  return res.json({
    plainToken: payload.plainToken,
    encryptedToken,
  })
}
```

### Signature Generation

```javascript
function generateSignature(meetingUUID, streamId, clientId, clientSecret) {
  const message = `${meetingUUID}:${streamId}:${clientId}`

  return crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex')
}
```

## Frontend Integration

### Starting RTMS

```javascript
const handleStartRTMS = async () => {
  try {
    await zoomSdk.callZoomApi('startRTMS')
    console.log('RTMS started')
  } catch (error) {
    console.error('RTMS error:', error)
  }
}
```

### Stopping RTMS

```javascript
const handleStopRTMS = async () => {
  try {
    await zoomSdk.callZoomApi('stopRTMS')
    console.log('RTMS stopped')
  } catch (error) {
    console.error('RTMS error:', error)
  }
}
```

### UI Controls

```javascript
return (
  <div>
    {runningContext === 'inMeeting' && (
      <div>
        <button onClick={handleStartRTMS}>Start RTMS</button>
        <button onClick={handleStopRTMS}>Stop RTMS</button>
      </div>
    )}
  </div>
)
```

## Audio Conversion

```javascript
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function convertAudioDataToWav(buffer, payload) {
  const audioDir = path.join(__dirname, 'data/audio')
  const meetingUUID = payload.meeting_uuid.replace(/[^a-zA-Z0-9]/g, '_')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }

  const rawFile = path.join(audioDir, `${timestamp}_${meetingUUID}.raw`)
  const outputFile = path.join(audioDir, `${timestamp}_${meetingUUID}.wav`)

  fs.writeFileSync(rawFile, buffer)

  // Convert raw PCM to WAV
  const command = `ffmpeg -y -f s16le -ar 16000 -ac 1 -i "${rawFile}" "${outputFile}"`

  try {
    await execAsync(command)
    console.log(`WAV saved: ${outputFile}`)
  } catch (err) {
    console.error('ffmpeg conversion failed:', err)
  } finally {
    fs.unlinkSync(rawFile)
  }
}
```

## Transcript Processing

```javascript
function convertTranscriptData(userName, timestamp, text, meetingUUID) {
  const transcriptDir = path.join(__dirname, 'data/transcripts')
  const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true })
  }

  const fileName = `${safeMeetingUUID}.txt`
  const filePath = path.join(transcriptDir, fileName)

  const date = new Date(timestamp)
  const entry = `[${date.toISOString()}] ${userName}: ${text}\n`

  fs.appendFileSync(filePath, entry)
}
```

## Webhook Payload Structure

**IMPORTANT:** Zoom sends **flat payloads**, not nested objects.

```javascript
// meeting.rtms_started webhook:
{
  "event": "meeting.rtms_started",
  "payload": {
    "meeting_uuid": "2nUlQ6YaRx2O3wB+ErH3ug==",  // NOT payload.object.uuid
    "rtms_stream_id": "stream-id-here",
    "server_urls": "wss://rtms-server.zoom.us"
  }
}
```

## Platform Compatibility

**Docker considerations:**
- `@zoom/rtms` contains native bindings
- Requires `linux/amd64` (x86_64)
- Won't work on Alpine Linux
- Use `node:18-slim` (Debian-based)

```dockerfile
FROM --platform=linux/amd64 node:18-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

## ES Modules Requirement

`@zoom/rtms` is ES module only:

```json
{
  "type": "module"
}
```

```javascript
import rtms from '@zoom/rtms';  // NOT require()

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

## Data Output Formats

### Audio Format
- **Format:** WAV (PCM)
- **Sample Rate:** 16 kHz
- **Channels:** 1 (mono)
- **Bit Depth:** 16-bit signed

### Video Format
- **Format:** MP4 (H.264)
- **Codec:** H.264

### Transcript Format
```
[2025-05-15T13:42:21.000Z] John Doe: Hello everyone
[2025-05-15T13:42:25.000Z] Jane Smith: Hi John
```

## Troubleshooting

### Webhook not received
- Check webhook URL is publicly accessible
- Verify webhook events are configured in Marketplace
- Check server logs

### @zoom/rtms package not found
```
npm error notarget No matching version found for @zoom/rtms@^1.0.0
```
**Solution:** Ensure you have access to the npm registry. The stable v1.0 release is available as `@zoom/rtms@^1.0.0`.

### ARM64 / Alpine Linux compatibility
```
No prebuilt binaries found (target=9 runtime=napi arch=arm64)
```
**Solution:** Use x86_64 Debian-based image

### ES Module error
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```
**Solution:** Add `"type": "module"` to package.json

### Empty transcript files
**Causes:**
- No one spoke during RTMS session
- Zoom transcription not enabled
- Language not supported

## Best Practices

1. **Buffer Management:** Don't store excessive data in memory
2. **Error Handling:** Implement robust error handling for network issues
3. **Cleanup:** Always cleanup WebSocket connections
4. **Security:** Validate webhook signatures
5. **Storage:** Implement file cleanup policies

## Next Steps

- [SDK Reference](./08-sdk-reference.md) - SDK method reference
- [Security Best Practices](./07-security.md) - Security considerations
- [Backend OAuth](./04-backend-oauth.md) - OAuth and API proxy
