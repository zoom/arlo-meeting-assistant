# Zoom Apps Development Documentation

This comprehensive documentation set provides detailed guidance for building Zoom Apps, extracted from this advanced reference implementation. Use these guides as context and reference when developing your own Zoom Apps with Claude Code.

## Documentation Structure

### 0. [Quick Start Guide](./00-quick-start.md)
**New to Zoom Apps?** - Get up and running in 30 minutes

**Topics covered:**
- Creating your first Zoom App in Marketplace
- Setting up your development environment
- Configuring ngrok and environment variables
- Installing and testing your app in Zoom client
- First successful app launch checklist
- Common setup issues and solutions

**Best for:** Complete beginners starting their first Zoom App project.

---

### 1. [Architecture Overview](./01-architecture-overview.md)
**Start here** - Understand the complete system architecture

**Topics covered:**
- Three-component architecture (Frontend, Backend, RTMS)
- Component communication patterns
- Data flow diagrams
- Project structure
- Deployment options
- Key features demonstrated

**Best for:** Getting a high-level understanding of how Zoom Apps work and how the pieces fit together.

---

### 2. [SDK Setup and Initialization](./02-sdk-setup.md)
**Essential foundation** - Learn how to configure the Zoom Apps SDK

**Topics covered:**
- SDK installation and loading
- Configuration with capabilities
- Running context detection
- User context management
- Event listener setup
- Configuration timeout handling
- Marketplace configuration

**Best for:** Setting up the SDK correctly before building features.

---

### 3. [Frontend Implementation Guide](./03-frontend-guide.md)
**Build the UI** - Create interactive Zoom App interfaces

**Topics covered:**
- React app structure
- SDK method invocation patterns
- OAuth implementation (3 flows)
- Multi-instance communication
- RTMS controls
- UI components and patterns
- Error handling
- Best practices

**Best for:** Building the user-facing parts of your Zoom App.

---

### 4. [Backend Authentication and API Guide](./04-backend-guide.md)
**Server-side logic** - Implement OAuth and API proxy

**Topics covered:**
- Express server setup
- OAuth 2.0 flows (web-based and in-client PKCE)
- Token storage and encryption
- Automatic token refresh
- Session management
- Zoom API proxy
- Security middleware
- Helper functions

**Best for:** Building secure backend services for your Zoom App.

---

### 5. [RTMS Implementation Guide](./05-rtms-guide.md)
**Real-time media** - Capture audio, video, and transcripts

**Topics covered:**
- RTMS overview and architecture
- SDK implementation (@zoom/rtms)
- WebSocket implementation
- Webhook handling
- Audio/video/transcript processing
- ffmpeg conversion
- Marketplace configuration
- Testing and troubleshooting

**Best for:** Building features that need access to meeting media streams.

---

### 6. [SDK Reference Guide](./06-sdk-reference.md)
**Complete API reference** - Look up SDK methods and structures

**Topics covered:**
- All SDK methods with examples
- Method parameters and return values
- Event listeners and data structures
- Common patterns
- Error codes
- Code examples

**Best for:** Quick reference when implementing specific SDK features.

---

### 7. [Security Best Practices](./07-security-guide.md)
**Stay secure** - Implement security correctly

**Topics covered:**
- OAuth security (CSRF, PKCE)
- Token management
- Data encryption
- Session security
- HTTP security headers
- Input validation
- Webhook security
- Secure coding practices
- Production checklist

**Best for:** Ensuring your Zoom App is secure and production-ready.

---

### 8. [REST API Integration Guide](./08-api-integration-guide.md)
**Make API calls** - Use Zoom REST APIs with OAuth tokens

**Topics covered:**
- OAuth token management lifecycle
- Making authenticated API calls from frontend
- Common in-meeting use cases
- Getting meeting info and participants
- Creating and updating meetings
- Pagination and error handling
- Rate limiting and retry strategies
- Required scopes by use case
- Best practices and caching
- Complete examples

**Best for:** Building Zoom Apps that make REST API calls on behalf of users.

---

### 9. [Development Workflow Guide](./09-development-workflow.md)
**Daily development** - Development practices and debugging

**Topics covered:**
- Daily development cycle and workflow
- Local development setup (Docker vs. manual)
- Managing ngrok and URL changes
- Hot reload and live development
- Testing in different contexts (meeting vs. main client)
- Debugging with DevTools
- Common development issues and solutions
- Testing strategies
- Performance optimization
- Version control best practices

**Best for:** Day-to-day development, debugging, and maintaining your Zoom App.

---

### Environment Variables Reference
See [.env.example](./.env.example) for a complete, commented reference of all environment variables with:
- Detailed explanations for each variable
- Where to get values
- Required vs. optional settings
- Development vs. production differences
- Security notes and generation commands

---

## Quick Start Guide

### For Complete Beginners

**Start here if this is your first Zoom App:**

1. **[Quick Start Guide](./00-quick-start.md)** - Follow step-by-step to get your first app running (30 minutes)
2. **[Environment Variables Reference](./.env.example)** - Understand all configuration options
3. **[Development Workflow](./09-development-workflow.md)** - Learn daily development practices

### For New Zoom App Projects

1. **Read** [Architecture Overview](./01-architecture-overview.md) to understand the system
2. **Follow** [SDK Setup](./02-sdk-setup.md) to configure the SDK
3. **Build** using [Frontend Guide](./03-frontend-guide.md) and [Backend Guide](./04-backend-guide.md)
4. **Integrate APIs** with [REST API Integration Guide](./08-api-integration-guide.md)
5. **Secure** with [Security Best Practices](./07-security-guide.md)
6. **Reference** [SDK Reference](./06-sdk-reference.md) as needed

### For Specific Features

**Need OAuth?**
- [Frontend Guide - OAuth Implementation](./03-frontend-guide.md#oauth-implementation)
- [Backend Guide - OAuth 2.0 Implementation](./04-backend-guide.md#oauth-20-implementation)
- [Security Guide - OAuth Security](./07-security-guide.md#oauth-20-security)

**Need Real-Time Media?**
- [RTMS Implementation Guide](./05-rtms-guide.md)
- [Frontend Guide - RTMS Controls](./03-frontend-guide.md#rtms-controls)

**Need to Call Zoom REST APIs?**
- [REST API Integration Guide](./08-api-integration-guide.md)
- [Backend Guide - API Proxy](./04-backend-guide.md#zoom-api-integration)
- [Security Guide - Token Management](./07-security-guide.md#token-management)

**Need Multi-Instance Communication?**
- [Frontend Guide - Multi-Instance Communication](./03-frontend-guide.md#multi-instance-communication)
- [SDK Reference - App Collaboration](./06-sdk-reference.md#app-collaboration)

**Need Virtual Backgrounds?**
- [SDK Reference - Virtual Backgrounds](./06-sdk-reference.md#virtual-backgrounds)

**Need Recording Control?**
- [SDK Reference - Recording](./06-sdk-reference.md#recording)

## Using with Claude Code

When working with Claude Code on a new Zoom App project:

1. **Provide relevant documentation as context:**
   ```
   I'm building a Zoom App that needs [feature]. Please review the
   relevant sections from the documentation in docs-from-claude/[guide-name].md
   ```

2. **Reference specific implementations:**
   ```
   I need to implement OAuth. Please look at the patterns in
   docs-from-claude/03-frontend-guide.md and docs-from-claude/04-backend-guide.md
   ```

3. **Use for troubleshooting:**
   ```
   My RTMS webhook isn't working. Please check the webhook validation
   pattern in docs-from-claude/05-rtms-guide.md and help me debug
   ```

4. **Apply security patterns:**
   ```
   Review my OAuth implementation against the security best practices
   in docs-from-claude/07-security-guide.md
   ```

5. **Build API integrations:**
   ```
   I need to fetch meeting participants and display them in my app. Show me
   the pattern from docs-from-claude/08-api-integration-guide.md
   ```

6. **Complete feature implementation:**
   ```
   Help me build a feature that gets the user's upcoming meetings and displays
   them in a list. Use the patterns from docs-from-claude/08-api-integration-guide.md
   and docs-from-claude/03-frontend-guide.md
   ```

## Key Concepts

### Running Context
Zoom Apps can run in different contexts:
- `inMeeting` - Inside a Zoom meeting
- `inMainClient` - Zoom desktop/mobile client (not in meeting)
- `inWebinar` - Inside a Zoom webinar

Features available depend on the running context. See [SDK Setup - Running Context](./02-sdk-setup.md#running-context).

### Multi-Instance Communication
Zoom Apps can run simultaneously in the main client and in meetings. They need to communicate to stay synchronized. See [Frontend Guide - Multi-Instance Communication](./03-frontend-guide.md#multi-instance-communication).

### OAuth Flows
Three authentication patterns are supported:
1. **Web-Based OAuth** - Traditional redirect flow
2. **In-Client OAuth (PKCE)** - OAuth within Zoom client
3. **Guest Mode** - Unauthenticated access

See [Frontend Guide - OAuth Implementation](./03-frontend-guide.md#oauth-implementation).

### RTMS (Real-Time Media Streams)
Provides real-time access to:
- Audio streams (16-bit PCM, 16kHz, mono)
- Video streams (H.264 encoded)
- Live transcripts

See [RTMS Implementation Guide](./05-rtms-guide.md).

## Common Patterns

### Checking Feature Availability
```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()
const hasRTMS = supportedApis.includes('startRTMS')
```

### Conditional Rendering by Context
```javascript
{runningContext === 'inMeeting' && (
  <MeetingOnlyFeatures />
)}
```

### Generic SDK Method Invocation
```javascript
const invokeZoomAppsSdk = (api) => () => {
  const { name, options = null } = api
  zoomSdk[name](options)
    .then(response => console.log('Success:', response))
    .catch(error => console.error('Error:', error))
}
```

### Making REST API Calls
```javascript
async function callZoomAPI(endpoint) {
  const response = await fetch(`/zoom/api${endpoint}`)
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return await response.json()
}

// Get current user
const user = await callZoomAPI('/v2/users/me')

// Get meeting participants
const { meetingUUID } = await zoomSdk.getMeetingContext()
const participants = await callZoomAPI(`/v2/metrics/meetings/${meetingUUID}/participants`)
```

See [SDK Reference - Common Patterns](./06-sdk-reference.md#common-patterns) and [API Integration Guide](./08-api-integration-guide.md).

## Troubleshooting

### Getting Started Issues
- App won't load in Zoom
- Can't see DevTools
- ngrok problems
- **See:** [Quick Start - Troubleshooting](./00-quick-start.md#troubleshooting-quick-start)

### Development Issues
- Changes not appearing
- Hot reload not working
- Environment variable problems
- **See:** [Development Workflow - Common Issues](./09-development-workflow.md#common-development-issues)

### SDK Methods Not Working
- Check if capability is in `config()` capabilities array
- Verify capability is enabled in Marketplace
- Check running context (some methods only work in meetings)
- **See:** [SDK Setup - Debugging](./02-sdk-setup.md#debugging)

### OAuth Not Working
- Check backend is running and accessible
- Verify environment variables are set
- Ensure session is not expired
- **See:** [Backend Guide - Testing](./04-backend-guide.md#testing)

### API Calls Failing
- 401 Unauthorized
- 403 Forbidden
- Token refresh issues
- **See:** [API Integration Guide - Troubleshooting](./08-api-integration-guide.md#troubleshooting)

### Webhook Not Received
- Check webhook URL is publicly accessible
- Verify webhook events are configured in Marketplace
- Check signature validation
- **See:** [RTMS Guide - Troubleshooting](./05-rtms-guide.md#troubleshooting)

## Additional Resources

### Official Zoom Documentation
- [Zoom Apps Documentation](https://developers.zoom.us/docs/zoom-apps/)
- [Zoom Apps SDK Reference](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [Create a Zoom App Guide](https://developers.zoom.us/docs/zoom-apps/create/)
- [Zoom Apps Authentication](https://developers.zoom.us/docs/zoom-apps/authentication/)
- [Zoom App Context](https://developers.zoom.us/docs/zoom-apps/zoom-app-context/)
- [RTMS Documentation](https://developers.zoom.us/docs/rtms/)
- [RTMS SDK for Node.js](https://github.com/zoom/rtms)
- [Getting Started with RTMS Video](https://www.youtube.com/watch?v=Ag11LGA6H9I)
- [Zoom Marketplace](https://marketplace.zoom.us/)

### Sample Applications
- [Basic Zoom Apps JS sample](https://github.com/zoom/zoomapps-sample-js)
- [Advanced Zoom Apps sample](https://github.com/zoom/zoomapps-advancedsample-react) - The reference for this documentation
- [Custom Layout Zoom Apps sample](https://github.com/zoom/zoomapps-customlayout-js)
- [Collaborative text editor sample](https://github.com/zoom/zoomapps-texteditor-vuejs)
- [Serverless to-do list sample](https://github.com/zoom/zoomapps-serverless-vuejs)

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Zoom Apps Security Guidelines](https://developers.zoom.us/docs/zoom-apps/security/)

### Tools
- [ngrok](https://ngrok.com/) - Expose local server for development
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Test Content Security Policy
- [Security Headers](https://securityheaders.com/) - Test HTTP security headers

### Video Tutorials
- [How to Create a Zoom App](https://www.youtube.com/watch?v=otlyDxnU-RI)
- [Getting started with RTMS with the RTMS SDK for NodeJS](https://www.youtube.com/watch?v=Ag11LGA6H9I)
- [Add RTMS features to your Zoom app](https://www.youtube.com/watch?v=65PDk45Kxh4)

## Contributing

Found an error or want to improve these docs? This documentation is meant to be a living reference. Consider:

1. Adding more examples
2. Clarifying confusing sections
3. Adding troubleshooting tips
4. Updating for new SDK versions

## Version Information

These guides are based on:
- Zoom Apps SDK version: 0.16.0
- Node.js: 14+
- React: 17
- Express: 4.x

Check for updates to the SDK and adjust implementations accordingly.

## License

This documentation and the reference implementation are provided as-is for educational and reference purposes. Please review Zoom's terms of service and developer policies when building production Zoom Apps.
