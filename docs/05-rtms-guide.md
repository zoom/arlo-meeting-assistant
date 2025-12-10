# Real-Time Media Streams (RTMS) Implementation Guide

## Overview

Real-Time Media Streams (RTMS) allows Zoom Apps to receive live audio, video, and transcript data from ongoing meetings. This guide covers both implementation approaches: the official `@zoom/rtms` SDK and a custom WebSocket implementation.

## What is RTMS?

Realtime Media Streams (RTMS) is a data pipeline that gives your app access to live audio, video, and transcript data from Zoom meetings. Instead of having participant bots or automated clients in meetings, use RTMS apps to collect media data from meetings.

RTMS provides real-time access to:
- **Audio streams** - Raw PCM audio data (16-bit signed, 16kHz, mono)
  - Separated audio for individual and merged tracks
- **Video streams** - H.264 encoded video frames
  - High Definition (HD) video data with up to 30 Frames Per Second (FPS)
- **Transcripts** - Live transcription data with timestamps and speaker info
  - Diarized transcripts that include not only what was said but who said it and when
- **Meeting Events** - Signaling events, timestamps, and meeting metadata
- **Participant Events** - Notifications when participants join or leave meetings

### RTMS Benefits

RTMS apps improve the user experience because:
- Apps can auto-start when users join meetings
- Apps eliminate the need for bots or device software
- You can use REST APIs or the JavaScript (JS) SDK to start streams
- No visible "participant" in the meeting - streams are transparent to users

### RTMS Enablement

**IMPORTANT:** To enable RTMS, reach out to your Zoom account team. If you don't have an existing account team contact, fill out [this form](https://www.zoom.com/en/realtime-media-streams/#form) to reach out to the Zoom team and get started with RTMS.

### Stream Launch Methods

Streams can launch in three ways:

1. **Automatically** - Streams start when a user joins or hosts a meeting
2. **On-demand** - Using REST API calls that include the meeting ID
3. **From a Zoom App** - Using the `startRTMS()` method in the Zoom Apps SDK (covered in this guide)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Zoom Meeting                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Audio   │  │  Video   │  │Transcript│            │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘            │
└────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │
         │   Webhook   │             │
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
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    Convert to Files       │
         │  - WAV (audio)            │
         │  - MP4 (video)            │
         │  - TXT (transcripts)      │
         └───────────────────────────┘
```

## Prerequisites

1. **RTMS Enabled in Your Account:**
   - Contact your Zoom account team or fill out [this form](https://www.zoom.com/en/realtime-media-streams/#form)
   - Wait for RTMS to be enabled on your account

2. **Marketplace Configuration:**
   - **Granular Scopes Required** - Your app must use [Granular scopes](https://developers.zoom.us/docs/integrations/oauth-scopes-granular/). This is default for new apps, but older apps may need to be updated.
   - **RTMS Media Scopes** - Select scopes based on the media you need:
     - `meeting:read:meeting_audio` - For audio data
     - `meeting:read:meeting_video` - For video data
     - `meeting:read:meeting_transcript` - For transcript data
     - Note: RTMS scopes cannot be marked as optional. Only request the scopes you actually need.
   - **Event Subscriptions:**
     - Enable Event Subscriptions in General Features
     - Subscribe to: `meeting.rtms_started` and `meeting.rtms_stopped` (required)
     - Provide a publicly accessible Event notification endpoint URL
   - **(Optional) REST API Control:**
     - Add `meeting:update:participant_rtms_app_status` scope to start/stop RTMS via REST API

3. **Frontend SDK Capabilities (for in-meeting apps):**
   - `startRTMS` and `stopRTMS` in SDK config
   - Configure in Marketplace → Surface → Meetings → Zoom App SDK → Add APIs
   - Requires Zoom Desktop client version 6.5.5 or above

4. **System Requirements:**
   - ffmpeg installed (for audio/video conversion)
   - Node.js 14+
   - Publicly accessible HTTPS endpoint for webhooks

## Implementation Options

### Option 1: @zoom/rtms SDK (Recommended)

The official SDK provides a simplified interface for RTMS.

**Pros:**
- Official support from Zoom
- Simplified API
- Automatic stream management

**Cons:**
- Less control over low-level details
- Dependency on npm package

### Option 2: WebSocket Implementation

Custom WebSocket client for direct communication with Zoom's signaling servers.

**Pros:**
- Full control over stream handling
- No additional dependencies (except ws)
- Educational value

**Cons:**
- More complex implementation
- Manual protocol handling required

## SDK Implementation

### Project Structure

```
rtms/sdk/
├── index.js           # Main RTMS handler
├── package.json       # Dependencies
└── .env              # Configuration (inherited from root)
```

### Dependencies

**Reference:** `rtms/sdk/package.json`

```json
{
  "name": "rtms-sdk",
  "version": "1.0.0",
  "dependencies": {
    "@zoom/rtms": "^1.0.0",
    "dotenv": "^16.0.0"
  }
}
```

### Main Handler

**Reference:** `rtms/sdk/index.js`

```javascript
const rtms = require('@zoom/rtms').default
const { convertAudioDataToWav } = require('../utils/audio.js')
const { convertTranscriptData } = require('../utils/transcript.js')
const { convertVideoDataToMp4 } = require('../utils/video.js')

// Buffer to store audio and video data
const meetingData = {
  audio: [],
  video: [],
}

// Listen for webhook events
rtms.onWebhookEvent(async ({ event, payload }) => {
  console.log('Incoming webhook', event)

  if (event === 'meeting.rtms_started') {
    // Create RTMS client
    const client = new rtms.Client()

    // Handle audio data
    client.onAudioData((data, timestamp, metadata) => {
      console.log('onAudioData received at time:', timestamp)
      console.log('onAudioData metadata:', metadata)

      // Buffer audio data for later conversion
      meetingData.audio.push(data)
    })

    // Handle video data
    client.onVideoData((data, timestamp, metadata) => {
      console.log('onVideoData received at time:', timestamp)
      console.log('onVideoData metadata:', metadata)

      // Buffer video data for later conversion
      meetingData.video.push(data)
    })

    // Handle transcript data
    client.onTranscriptData((data, timestamp, metadata, user) => {
      console.log('onTranscriptData received at time:', timestamp)
      console.log('onTranscriptData metadata:', metadata)

      // Convert buffer to string
      const convertedData = data.toString('utf-8')

      // Save transcript immediately (don't buffer)
      convertTranscriptData(
        user.userName,
        timestamp,
        convertedData,
        payload.meeting_uuid
      )
    })

    // Join the RTMS session
    client.join(payload)
  }
  else if (event === 'meeting.rtms_stopped') {
    // Convert buffered audio to WAV
    if (meetingData.audio.length) {
      const audioBuffer = Buffer.concat(meetingData.audio)
      await convertAudioDataToWav(audioBuffer, payload)
      meetingData.audio = []
    }

    // Convert buffered video to MP4
    if (meetingData.video.length) {
      const videoBuffer = Buffer.concat(meetingData.video)
      const timestampFormatted = new Date().toISOString().replace(/[:.]/g, '-')
      await convertVideoDataToMp4(videoBuffer, payload, timestampFormatted)
      meetingData.video = []
    }
  }
})
```

### RTMS Client API

The `@zoom/rtms` SDK provides these methods:

**Client Creation:**
```javascript
const client = new rtms.Client()
```

**Event Listeners:**
```javascript
// Audio data callback
client.onAudioData((data, timestamp, metadata) => {
  // data: Buffer containing raw PCM audio
  // timestamp: Unix timestamp in milliseconds
  // metadata: { sampleRate, channels, bitsPerSample }
})

// Video data callback
client.onVideoData((data, timestamp, metadata) => {
  // data: Buffer containing H.264 video frame
  // timestamp: Unix timestamp in milliseconds
  // metadata: { width, height, frameRate }
})

// Transcript data callback
client.onTranscriptData((data, timestamp, metadata, user) => {
  // data: Buffer containing transcript text
  // timestamp: Unix timestamp in milliseconds
  // metadata: { language, isFinal }
  // user: { userId, userName }
})
```

**Join Session:**
```javascript
client.join(payload)
// payload: webhook payload from meeting.rtms_started event
```

## WebSocket Implementation

### Project Structure

```
rtms/websocket/
├── index.js                  # Express server
├── api/
│   ├── controller.js         # Webhook handlers
│   └── helper.js             # Signature generation
├── lib/
│   └── RtmsClient.js         # WebSocket client (optional)
└── package.json
```

### Express Server

**Reference:** `rtms/websocket/index.js`

```javascript
const express = require('express')
const { rtmsHandler } = require('./api/controller')

const app = express()

// Middleware
app.use(express.json())

// Webhook endpoint
app.post('/webhook', rtmsHandler)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`RTMS WebSocket server running on port ${PORT}`)
})
```

### Webhook Handler

**Reference:** `rtms/websocket/api/controller.js:32-49`

```javascript
const crypto = require('crypto')

function rtmsHandler(req, res) {
  console.log('RTMS Webhook received:', JSON.stringify(req.body, null, 2))

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

**Reference:** `rtms/websocket/api/controller.js:54-64`

Zoom sends a validation challenge when you configure the webhook URL:

```javascript
function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) {
    return res.sendStatus(400)
  }

  // Generate encrypted token using HMAC-SHA256
  const encryptedToken = crypto
    .createHmac('sha256', process.env.ZOOM_SECRET_TOKEN)
    .update(payload.plainToken)
    .digest('hex')

  console.log('Responding to Zoom URL validation challenge')

  return res.json({
    plainToken: payload.plainToken,
    encryptedToken,
  })
}
```

### RTMS Started Handler

**Reference:** `rtms/websocket/api/controller.js:69-72`

```javascript
function handleRtmsStarted({ meeting_uuid, rtms_stream_id, server_urls }) {
  console.log('RTMS started for meeting:', meeting_uuid)

  // Connect to Zoom's signaling WebSocket server
  connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls)
}
```

### WebSocket Connection

**Reference:** `rtms/websocket/api/controller.js:112-150`

```javascript
const WebSocket = require('ws')
const activeConnections = new Map()

function connectToSignalingWebSocket(meetingUUID, streamId, serverUrl) {
  const ws = new WebSocket(serverUrl)

  // Store connection for cleanup
  if (!activeConnections.has(meetingUUID)) {
    activeConnections.set(meetingUUID, {})
  }
  activeConnections.get(meetingUUID).signaling = ws

  ws.on('open', () => {
    console.log('Connected to signaling server for meeting:', meetingUUID)

    // Send handshake message
    const handshake = {
      msg_type: 1,  // SIGNALING_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUUID,
      rtms_stream_id: streamId,
      sequence: Math.floor(Math.random() * 1e9),
      signature: generateSignature(
        meetingUUID,
        streamId,
        process.env.ZOOM_APP_CLIENT_ID,
        process.env.ZOOM_APP_CLIENT_SECRET
      ),
    }

    ws.send(JSON.stringify(handshake))
    console.log('Sent signaling handshake')
  })

  ws.on('message', (data) => {
    const raw = data.toString()
    console.log('Signaling message received:', raw)

    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      console.warn('Failed to parse signaling message:', raw)
      return
    }

    handleSignalingMessage(msg, meetingUUID, streamId, ws)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })

  ws.on('close', () => {
    console.log('WebSocket closed for meeting:', meetingUUID)
  })
}
```

### Signature Generation

**Reference:** `rtms/websocket/api/helper.js`

```javascript
const crypto = require('crypto')

function generateSignature(meetingUUID, streamId, clientId, clientSecret) {
  const message = `${meetingUUID}:${streamId}:${clientId}`

  return crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex')
}

module.exports = { generateSignature }
```

### RTMS Stopped Handler

**Reference:** `rtms/websocket/api/controller.js:77-107`

```javascript
async function handleRtmsStopped(payload) {
  const meetingUUID = payload.meeting_uuid

  console.log('RTMS stopped for meeting:', meetingUUID)

  // Convert buffered audio to WAV
  if (meetingData.audio.length) {
    const audioBuffer = Buffer.concat(meetingData.audio)
    await convertAudioDataToWav(audioBuffer, payload)
    meetingData.audio = []
  }

  // Convert buffered video to MP4
  if (meetingData.video.length) {
    const videoBuffer = Buffer.concat(meetingData.video)
    const timestampFormatted = new Date().toISOString().replace(/[:.]/g, '-')
    await convertVideoDataToMp4(videoBuffer, payload, timestampFormatted)
    meetingData.video = []
  }

  // Close all WebSocket connections
  const connections = activeConnections.get(meetingUUID)
  if (connections) {
    Object.values(connections).forEach((socket) => {
      if (socket && typeof socket.close === 'function') {
        socket.close()
      }
    })

    activeConnections.delete(meetingUUID)
    console.log(`Closed all WebSocket connections for meeting ${meetingUUID}`)
  }
}
```

## Shared Utilities

### Audio Conversion

**Reference:** `rtms/utils/audio.js`

```javascript
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function convertAudioDataToWav(buffer, payload) {
  console.log('Converting data to WAV file...')

  // Setup paths
  const audioDir = path.join(__dirname, '../app', 'data/audio')
  const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
  const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${timestamp}_${safeMeetingUUID}`

  // Create directory if it doesn't exist
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }

  // Write raw PCM data
  const rawFile = path.join(audioDir, `${fileName}.raw`)
  const outputFile = path.join(audioDir, `${fileName}.wav`)

  fs.writeFileSync(rawFile, buffer)

  // Convert raw PCM to WAV using ffmpeg
  await convertRawToWav(rawFile, outputFile)
}

async function convertRawToWav(inputFile, outputFile) {
  // Raw PCM format: s16le (signed 16-bit little-endian)
  // Sample rate: 16000 Hz
  // Channels: 1 (mono)
  const command = `ffmpeg -y -f s16le -ar 16000 -ac 1 -i "${inputFile}" "${outputFile}"`

  try {
    await execAsync(command)
    console.log(`WAV file saved: ${outputFile}`)
  } catch (err) {
    console.error(`ffmpeg conversion failed for ${inputFile}`, err)
  } finally {
    // Always remove the raw file
    fs.unlinkSync(inputFile)
  }
}

module.exports = { convertAudioDataToWav }
```

### Video Conversion

**Reference:** `rtms/utils/video.js`

```javascript
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function convertVideoDataToMp4(buffer, payload, timestampFormatted) {
  console.log('Converting data to MP4 file...')

  // Setup paths
  const videoDir = path.join(__dirname, '../app', 'data/video')
  const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
  const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')
  const fileName = `${timestampFormatted}_${safeMeetingUUID}`

  // Create directory if it doesn't exist
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true })
  }

  // Write H.264 data
  const h264File = path.join(videoDir, `${fileName}.h264`)
  const outputFile = path.join(videoDir, `${fileName}.mp4`)

  fs.writeFileSync(h264File, buffer)

  // Convert H.264 to MP4 container using ffmpeg
  await convertH264ToMp4(h264File, outputFile)
}

async function convertH264ToMp4(inputFile, outputFile) {
  // -y: overwrite output file
  // -i: input file
  // -c:v copy: copy video codec without re-encoding
  const command = `ffmpeg -y -i "${inputFile}" -c:v copy "${outputFile}"`

  try {
    await execAsync(command)
    console.log(`MP4 file saved: ${outputFile}`)
  } catch (err) {
    console.error(`ffmpeg conversion failed for ${inputFile}`, err)
  } finally {
    // Always remove the H.264 file
    fs.unlinkSync(inputFile)
  }
}

module.exports = { convertVideoDataToMp4 }
```

### Transcript Processing

**Reference:** `rtms/utils/transcript.js`

```javascript
const fs = require('fs')
const path = require('path')

function convertTranscriptData(userName, timestamp, data, meetingUUID) {
  console.log('Saving transcript data...')

  // Setup paths
  const transcriptDir = path.join(__dirname, '../app', 'data/transcripts')
  const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

  // Create directory if it doesn't exist
  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true })
  }

  // Filename based on meeting UUID
  const fileName = `${safeMeetingUUID}.txt`
  const filePath = path.join(transcriptDir, fileName)

  // Format transcript entry
  const date = new Date(timestamp)
  const timeString = date.toISOString()
  const entry = `[${timeString}] ${userName}: ${data}\n`

  // Append to file
  fs.appendFileSync(filePath, entry)

  console.log(`Transcript saved: ${filePath}`)
}

module.exports = { convertTranscriptData }
```

## Frontend Integration

### Starting RTMS

**Reference:** `frontend/src/App.js:191-198`

```javascript
const handleStartRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('startRTMS')
    console.log('startRTMS success:', res)
    setRtmsMessage(`RTMS started successfully`)
  } catch (error) {
    console.error('startRTMS error:', error)
    setRtmsMessage(`RTMS error: ${error}`)
  }
}
```

### Stopping RTMS

**Reference:** `frontend/src/App.js:200-207`

```javascript
const handleStopRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('stopRTMS')
    console.log('stopRTMS success:', res)
    setRtmsMessage(`RTMS stopped successfully`)
  } catch (error) {
    console.error('stopRTMS error:', error)
    setRtmsMessage(`RTMS error: ${error}`)
  }
}
```

### UI Controls

```javascript
return (
  <div>
    {rtmsMessage && <p className='fw-bold'>{rtmsMessage}</p>}

    {runningContext === 'inMeeting' && (
      <div>
        <button onClick={handleStartRTMS}>Start RTMS</button>
        <button onClick={handleStopRTMS}>Stop RTMS</button>
      </div>
    )}
  </div>
)
```

## Marketplace Configuration

### Required Scopes

```
rtms:read    - Read RTMS data
rtms:write   - Control RTMS sessions
```

### Webhook Configuration

1. **Event Subscriptions:**
   - `meeting.rtms_started`
   - `meeting.rtms_stopped`
   - `endpoint.url_validation` (for webhook verification)

2. **Webhook Endpoint URL:**
   ```
   https://your-domain.com/webhook
   ```

3. **Secret Token:**
   - Generate a random secret token
   - Save it as `ZOOM_SECRET_TOKEN` environment variable

### SDK Capabilities

In Marketplace → Features → Zoom App SDK → Add APIs:
- `startRTMS`
- `stopRTMS`

## Deployment

### Docker Compose

**SDK Mode:**
```bash
docker-compose --profile sdk up --build
```

**WebSocket Mode:**
```bash
docker-compose up --build rtms-websocket
```

### Docker Configuration

```yaml
# docker-compose.yml
services:
  rtms-sdk:
    build: ./rtms/sdk
    environment:
      - ZOOM_APP_CLIENT_ID=${ZOOM_APP_CLIENT_ID}
      - ZOOM_APP_CLIENT_SECRET=${ZOOM_APP_CLIENT_SECRET}
    profiles:
      - sdk

  rtms-websocket:
    build: ./rtms/websocket
    ports:
      - "3002:3002"
    environment:
      - ZOOM_APP_CLIENT_ID=${ZOOM_APP_CLIENT_ID}
      - ZOOM_APP_CLIENT_SECRET=${ZOOM_APP_CLIENT_SECRET}
      - ZOOM_SECRET_TOKEN=${ZOOM_SECRET_TOKEN}
```

## Data Output

### Directory Structure

```
rtms/app/data/
├── audio/
│   └── 2025-05-15T13-42-21-123Z_abc123_meeting.wav
├── video/
│   └── 2025-05-15T13-42-21-123Z_abc123_meeting.mp4
└── transcripts/
    └── abc123_meeting.txt
```

### Audio Format

- **Format:** WAV (PCM)
- **Sample Rate:** 16 kHz
- **Channels:** 1 (mono)
- **Bit Depth:** 16-bit signed

### Video Format

- **Format:** MP4 (H.264)
- **Codec:** H.264
- **Container:** MP4

### Transcript Format

```
[2025-05-15T13:42:21.000Z] John Doe: Hello everyone
[2025-05-15T13:42:25.000Z] Jane Smith: Hi John
[2025-05-15T13:42:30.000Z] John Doe: Let's start the meeting
```

## Testing

### Test Webhook Locally

Use ngrok to expose your local server:

```bash
# Start ngrok
ngrok http 3002

# Update webhook URL in Marketplace
https://your-ngrok-url.ngrok-free.app/webhook
```

### Verify Webhook

```bash
# Test URL validation
curl -X POST https://your-server.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "endpoint.url_validation",
    "payload": {
      "plainToken": "test_token"
    }
  }'
```

### Test RTMS Flow

1. Start your Zoom App in a meeting
2. Click "Start RTMS" button
3. Check server logs for webhook received
4. Speak in the meeting to generate audio/video/transcripts
5. Click "Stop RTMS" button
6. Check `rtms/app/data/` for generated files

## Implementation Experience & Learnings

This section documents real-world implementation experience and common issues encountered when building a production RTMS application.

### Actual Implementation Flow

Here's how RTMS actually works in practice (based on production implementation):

```
1. Frontend: User consents → zoomSdk.callZoomApi('startRTMS')
2. Zoom: Sends meeting.rtms_started webhook to backend
3. Backend: Forwards webhook to RTMS server
4. RTMS Server: Connects to stream via client.join()
5. RTMS Server: Receives transcript data in real-time
6. RTMS Server: Saves to disk: transcript_[uuid]_[timestamp].txt
7. Meeting ends or user stops: zoomSdk.callZoomApi('stopRTMS')
8. Zoom: Sends meeting.rtms_stopped webhook
9. RTMS Server: client.leave() and closes file
```

### Real Webhook Payload Structure

**Important:** Zoom sends **flat payloads**, not nested objects.

**meeting.rtms_started webhook:**
```javascript
{
  "event": "meeting.rtms_started",
  "payload": {
    "meeting_uuid": "2nUlQ6YaRx2O3wB+ErH3ug==",  // NOT payload.object.uuid
    "rtms_stream_id": "stream-id-here",
    "server_urls": "wss://rtms-server.zoom.us"
  }
}
```

**Common mistake:** Expecting `payload.object.uuid` (doesn't exist). Use `payload.meeting_uuid` instead.

### Package Version Issues

**@zoom/rtms SDK:**
- **Actual version:** `0.0.4` (as of 2024-11-24)
- **Not available:** `1.0.0` (documentation may show this incorrectly)
- **Installation:** `npm install @zoom/rtms@^0.0.4`

### Platform Compatibility

**Docker considerations:**
- **@zoom/rtms** contains native bindings requiring specific architecture
- **Required platform:** `linux/amd64` (x86_64)
- **Won't work:** Alpine Linux (no prebuilt binaries for musl libc)
- **Solution:** Use `node:18-slim` (Debian-based) with `--platform=linux/amd64`

**Dockerfile example:**
```dockerfile
FROM --platform=linux/amd64 node:18-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

### ES Modules Requirement

**@zoom/rtms is ES module only:**
```json
{
  "type": "module"  // Required in package.json
}
```

**Code must use:**
```javascript
import rtms from '@zoom/rtms';  // NOT require()
```

**__dirname polyfill needed:**
```javascript
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### Volume Mounting with node_modules

**Problem:** Docker volume mounts overwrite node_modules directory.

**Solution:** Add anonymous volume exclusion:
```yaml
volumes:
  - ./rtms/sdk:/app
  - /app/node_modules  # Preserve node_modules from build
```

### Frontend SDK Calls

**Starting RTMS:**
```javascript
await zoomSdk.callZoomApi('startRTMS');
// NOT: zoomSdk.startRTMS()
```

**Stopping RTMS:**
```javascript
await zoomSdk.callZoomApi('stopRTMS');
// NOT: zoomSdk.stopRTMS()
```

### Transcript Data Format

**Received as Buffer, must convert to UTF-8:**
```javascript
client.onTranscriptData((data, timestamp, metadata, user) => {
  const text = data.toString('utf-8');  // Convert Buffer to string
  const userName = user?.userName || 'Unknown';
  const date = new Date(timestamp);

  // Format: [timestamp] userName: text
  const line = `[${date.toISOString()}] ${userName}: ${text}\n`;
  stream.write(line);
});
```

### Webhook Forwarding Architecture

**Why forward from backend to RTMS server:**
- Zoom webhooks must go to publicly accessible URL (backend)
- Backend validates signatures and processes events
- RTMS server may be internal/private, not exposed
- Backend forwards specific RTMS webhooks to RTMS server

**Implementation:**
```javascript
// Backend receives webhook from Zoom
app.post('/api/webhooks/zoom', async (req, res) => {
  if (req.body.event === 'meeting.rtms_started') {
    // Forward to RTMS server
    await fetch('http://rtms-server:3002/webhook', {
      method: 'POST',
      body: JSON.stringify({
        event: 'meeting.rtms_started',
        payload: req.body.payload
      })
    });
  }
});

// RTMS server receives forwarded webhook
app.post('/webhook', async (req, res) => {
  const { event, payload } = req.body;
  if (event === 'meeting.rtms_started') {
    await handleRTMSStarted(payload);
  }
});
```

### State Management with RTMS

**Track active connections:**
```javascript
const activeClients = new Map();

// On start
activeClients.set(meeting_uuid, {
  client,
  stream,
  filename
});

// On stop
const { client, stream } = activeClients.get(meeting_uuid);
await client.leave();
stream.end();
activeClients.delete(meeting_uuid);
```

**Graceful shutdown:**
```javascript
process.on('SIGINT', async () => {
  for (const [uuid, { client, stream }] of activeClients.entries()) {
    await client.leave();
    stream.end();
  }
  activeClients.clear();
  process.exit(0);
});
```

### Consent Workflow Integration

**RTMS should start only with unanimous consent:**
```javascript
// Track consent status
const consentState = {
  participants: [...],
  unanimousConsent: false,
  rtmsStatus: 'stopped'  // 'stopped' | 'running' | 'paused'
};

// Start RTMS when unanimous consent achieved
if (consentState.unanimousConsent && !rtmsRunning) {
  await zoomSdk.callZoomApi('startRTMS');
}

// Pause when new participant joins
if (newParticipantJoined && rtmsRunning) {
  await zoomSdk.callZoomApi('stopRTMS');
  rtmsStatus = 'paused';
  rtmsPausedReason = 'New participant joined: ' + participant.name;
}
```

### Debugging Tips

**Enable verbose logging:**
```javascript
console.log('📦 RTMS Started Webhook - Full Payload:');
console.log(JSON.stringify(payload, null, 2));
```

**Check what's actually received:**
```javascript
client.onTranscriptData((data, timestamp, metadata, user) => {
  console.log('📝 Transcript:', {
    text: data.toString('utf-8'),
    timestamp,
    user: user?.userName,
    metadata
  });
});
```

**Verify connection:**
```javascript
await client.join({...});
console.log('✅ Connected to RTMS stream successfully');
```

### Performance Considerations

**File I/O:**
- Use `fs.createWriteStream()` for continuous writing
- Set `flags: 'a'` for append mode
- Buffer writes in chunks, don't write every character

**Memory Management:**
- Don't store all transcript data in memory
- Write to disk as data arrives
- Close streams when done

**Network:**
- RTMS uses WebSocket - expect network variability
- Implement reconnection logic for stream interruptions
- Handle disconnect gracefully

### Production Considerations

**File Storage:**
```javascript
// Organize by date and meeting
const date = new Date().toISOString().split('T')[0];  // 2024-11-24
const filename = `${date}/transcript_${meeting_uuid}_${timestamp}.txt`;
```

**Cleanup Policies:**
- Implement automatic file deletion after X days
- Compress old transcripts
- Move to cloud storage (S3, etc.)

**Error Handling:**
```javascript
try {
  await client.join({...});
} catch (error) {
  console.error('❌ Failed to start RTMS:', error.message);
  // Notify user, log to monitoring service
  // Don't crash the server
}
```

**Monitoring:**
- Track active RTMS connections
- Monitor disk usage
- Alert on connection failures
- Log all RTMS events

## Troubleshooting

### Issue: Webhook not received

- Check webhook URL is publicly accessible
- Verify webhook events are configured in Marketplace
- Check server logs for incoming requests

### Issue: ffmpeg not found

```bash
# Install ffmpeg
# Ubuntu/Debian
apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
choco install ffmpeg
```

### Issue: Empty audio/video files

- Verify meeting participants have audio/video enabled
- Check console logs for data reception
- Ensure ffmpeg conversion is successful

### Issue: WebSocket connection fails

- Verify client ID and secret are correct
- Check signature generation
- Review WebSocket error messages

### Issue: Webhook payload parsing error (COMMON)

**Symptom:**
```
❌ Invalid rtms_started payload - Missing data:
   meetingUUID: undefined
```

**Cause:** Expecting nested structure `payload.object.uuid` but Zoom sends flat `payload.meeting_uuid`.

**Solution:**
```javascript
// WRONG:
const meetingUUID = payload.object?.uuid;

// CORRECT:
const meetingUUID = payload.meeting_uuid;
const rtmsStreamId = payload.rtms_stream_id;
const serverUrls = payload.server_urls;
```

### Issue: @zoom/rtms package not found

**Symptom:**
```
npm error notarget No matching version found for @zoom/rtms@^1.0.0
```

**Solution:** Use actual version:
```bash
npm install @zoom/rtms@^0.0.4
```

### Issue: ARM64 / Alpine Linux compatibility

**Symptom:**
```
No prebuilt binaries found (target=9 runtime=napi arch=arm64 platform=linux)
```

**Solution:** Use x86_64 Debian-based image:
```dockerfile
FROM --platform=linux/amd64 node:18-slim  # NOT alpine
```

### Issue: ES Module error

**Symptom:**
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

**Solution:**
1. Add to package.json: `"type": "module"`
2. Convert all `require()` to `import`
3. Add `__dirname` polyfill if needed

### Issue: node_modules missing after volume mount

**Symptom:**
```
Cannot find module '@zoom/rtms'
```

**Solution:** Add anonymous volume in docker-compose.yml:
```yaml
volumes:
  - ./rtms/sdk:/app
  - /app/node_modules  # Preserve from build
```

### Issue: RTMS webhook received but no connection

**Symptom:** Webhook logs show success, but no transcript data arrives.

**Debugging steps:**
1. Check RTMS server logs for connection attempt
2. Verify Client ID and Secret are correct in environment
3. Check stream connection logs:
   ```
   ✅ Connected to RTMS stream successfully
   ```
4. Speak in meeting to generate transcript data
5. Check if `onTranscriptData` handler is called

**Common causes:**
- Client ID/Secret mismatch
- Meeting hasn't started generating transcripts yet
- Transcription not enabled in meeting settings

### Issue: Empty transcript files

**Symptom:** File created but contains only headers, no transcript data.

**Causes:**
1. No one spoke during RTMS session
2. Zoom transcription not enabled
3. Language not supported for transcription
4. Short meeting duration (transcripts take time to generate)

**Solution:**
- Verify meeting settings have transcription enabled
- Speak clearly for several seconds
- Check Zoom language support for transcription

### Issue: RTMS server port conflict

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution:**
```bash
# Find process using port
lsof -i :3002
# Kill process or change port
docker-compose down
docker-compose up
```

## Best Practices

1. **Buffer Management:** Don't store excessive data in memory, convert and save periodically
2. **Error Handling:** Implement robust error handling for network issues
3. **Cleanup:** Always cleanup WebSocket connections and file handles
4. **Security:** Never expose webhook endpoints without validation
5. **Storage:** Implement file cleanup policies to prevent disk overflow

## Next Steps

- [SDK Reference and Structures](./06-sdk-reference.md) - SDK method reference
- [Security Best Practices](./07-security-guide.md) - Security considerations
- [Backend Authentication](./04-backend-guide.md) - OAuth and API proxy
