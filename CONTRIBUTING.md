# Contributing to Arlo Meeting Assistant

Thank you for your interest in contributing to Arlo Meeting Assistant! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful, inclusive, and constructive in all interactions.

### Our Standards

- **Be Respectful**: Treat everyone with respect and consideration
- **Be Inclusive**: Welcome diverse perspectives and experiences
- **Be Constructive**: Focus on what is best for the community
- **Be Professional**: Maintain professionalism in all communications

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- ngrok (for local Zoom App testing)
- A Zoom account with developer access

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/arlo-meeting-assistant.git
   cd arlo-meeting-assistant
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/arlo-meeting-assistant.git
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Zoom credentials and generate secrets
   ```

5. **Start services**:
   ```bash
   docker-compose up --build
   ```

6. **Run database migrations**:
   ```bash
   docker-compose exec backend npx prisma migrate dev
   ```

7. **Verify setup**:
   - Backend: http://localhost:3000/health
   - Frontend: http://localhost:3001
   - Database: `docker-compose exec backend npx prisma studio`

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features (if used)
- `feature/your-feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates

### Creating a Feature Branch

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create a new feature branch
git checkout -b feature/my-new-feature
```

### Making Changes

1. **Write clear, focused commits**:
   ```bash
   git add .
   git commit -m "feat: add real-time notification system

   - Implement WebSocket notification channel
   - Add notification UI component
   - Update API to broadcast events"
   ```

2. **Commit message format**:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, semicolons, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Build process or auxiliary tool changes

3. **Keep commits atomic**: Each commit should represent one logical change

4. **Test your changes** thoroughly before pushing

### Staying Up to Date

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase your feature branch
git rebase upstream/main
```

## Pull Request Process

### Before Submitting

- [ ] Run the test suite (when available)
- [ ] Update documentation if needed
- [ ] Add comments to complex code sections
- [ ] Check for console errors and warnings
- [ ] Verify database migrations work correctly
- [ ] Test in both development and Docker environments

### Submitting a Pull Request

1. **Push your branch**:
   ```bash
   git push origin feature/my-new-feature
   ```

2. **Create a Pull Request** on GitHub with:
   - Clear title summarizing the change
   - Detailed description of what and why
   - Screenshots/GIFs for UI changes
   - Link to related issues

3. **PR Description Template**:
   ```markdown
   ## Summary
   Brief description of what this PR does

   ## Changes
   - Specific change 1
   - Specific change 2

   ## Testing
   - [ ] Tested locally with Docker
   - [ ] Tested in Zoom App
   - [ ] Database migrations verified
   - [ ] No console errors

   ## Screenshots
   (if applicable)

   ## Related Issues
   Closes #123
   ```

### Review Process

- Maintainers will review your PR within 3-5 business days
- Address feedback by pushing new commits to your branch
- Once approved, a maintainer will merge your PR
- After merge, you can delete your feature branch

## Coding Standards

### JavaScript/Node.js

- Use **ES6+** features where appropriate
- Use `const` by default, `let` when reassignment is needed
- Use **async/await** over raw Promises
- Use **template literals** for string interpolation
- **Destructure** objects and arrays when it improves readability

### Code Style

```javascript
// ✅ Good
const getUserMeetings = async (userId) => {
  const meetings = await prisma.meeting.findMany({
    where: { ownerId: userId },
    orderBy: { startTime: 'desc' },
  });

  return meetings;
};

// ❌ Avoid
function getUserMeetings(userId) {
  return prisma.meeting.findMany({where: {ownerId: userId}, orderBy: {startTime: 'desc'}}).then(meetings => {
    return meetings
  })
}
```

### Error Handling

```javascript
// ✅ Always handle errors
try {
  const result = await riskyOperation();
  res.json({ result });
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({
    error: 'Operation failed',
    message: error.message
  });
}
```

### API Routes

- Use **RESTful conventions**
- Return appropriate **HTTP status codes**
- Include **error messages** in responses
- Use **middleware** for authentication
- Add **comments** for complex logic

### React Components

- Use **functional components** with hooks
- Keep components **focused and small**
- Extract **reusable logic** into custom hooks
- Use **prop-types** or TypeScript for type checking
- Follow the **existing component structure**

## Testing Guidelines

### Manual Testing Checklist

When testing your changes:

1. **Backend API**:
   - [ ] Health endpoint responds
   - [ ] Authentication flow works
   - [ ] API endpoints return correct data
   - [ ] Error cases handled properly

2. **Frontend**:
   - [ ] Zoom App loads correctly
   - [ ] OAuth flow completes
   - [ ] UI renders without errors
   - [ ] WebSocket connection establishes

3. **RTMS Integration**:
   - [ ] RTMS starts successfully
   - [ ] Transcripts appear in real-time
   - [ ] Segments save to database
   - [ ] WebSocket broadcasts work

4. **Database**:
   - [ ] Migrations apply cleanly
   - [ ] Data persists correctly
   - [ ] Relationships work as expected

### Automated Tests (Coming Soon)

We're working on adding automated tests. In the meantime:
- Manually test all affected functionality
- Check for console errors
- Verify database queries work correctly

## Documentation

### When to Update Docs

Update documentation when you:
- Add a new API endpoint
- Change environment variables
- Modify database schema
- Add new features
- Change setup/deployment process

### Documentation Locations

- **README.md** - Quick start and overview
- **CLAUDE.md** - Project instructions for Claude Code
- **/docs/** - Detailed guides and references
- **Code comments** - Complex logic explanations
- **API endpoints** - JSDoc comments on routes

### Writing Good Documentation

```javascript
/**
 * GET /api/meetings/:id/transcript
 *
 * Retrieve transcript segments for a specific meeting.
 * Results are paginated and can be filtered by time range.
 *
 * @param {string} id - Meeting UUID
 * @query {number} from_ms - Start time filter (milliseconds)
 * @query {number} to_ms - End time filter (milliseconds)
 * @query {number} limit - Max results (default: 100)
 * @query {string} after_seq - Cursor for pagination
 *
 * @returns {Object} segments - Array of transcript segments
 * @returns {string} cursor - Pagination cursor
 */
router.get('/:id/transcript', async (req, res) => {
  // Implementation
});
```

## Questions?

- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security@yourproject.com for security issues

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- Project README (for major features)

Thank you for contributing to Arlo Meeting Assistant! 🎉
