# Contributing to ChatKut

Thank you for your interest in contributing to ChatKut! 🎬

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chatkut.git
   cd chatkut
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Set up environment**
   - Copy `.env.example` to `.env.local`
   - Add your API keys (Convex, Dedalus, Cloudflare)
5. **Start development servers**
   ```bash
   # Terminal 1
   npx convex dev

   # Terminal 2
   npm run dev
   ```

## 📋 Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

**Example:** `feature/timeline-ui` or `fix/upload-progress-bar`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add timeline UI component
fix: resolve upload progress bar bug
docs: update testing guide
refactor: simplify selector resolution
test: add unit tests for executor
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Update documentation if needed
5. Run type check: `npm run type-check`
6. Run linter: `npm run lint`
7. Push to your fork
8. Open a Pull Request with:
   - Clear description of changes
   - Screenshots/videos for UI changes
   - Link to related issues

## 🎯 Priority Areas

We especially welcome contributions in these areas:

### 1. Authentication & User Management
- Clerk or Auth0 integration
- User profiles
- Team workspaces
- Permissions system

### 2. Timeline UI
- Visual timeline editor
- Drag-and-drop clips
- Keyframe editing
- Snap-to-grid

### 3. AI Improvements
- More AI models via Dedalus
- Better edit plan generation
- Natural language understanding
- Voice commands

### 4. Template System
- Pre-built compositions
- Template marketplace
- Custom template creation
- Import/export templates

### 5. Export Features
- Social media formats (TikTok, Instagram, YouTube)
- Batch processing
- Auto-captions
- AI-generated thumbnails

## 🏗️ Architecture Guidelines

### Code Style

- **TypeScript** - Use strict mode, no `any` types
- **React** - Functional components with hooks
- **Convex** - Keep mutations pure, use actions for side effects
- **Remotion** - Follow Remotion best practices

### File Organization

```
app/              # Next.js pages
components/       # React components
  ├── chat/      # Chat-related
  ├── editor/    # Editor UI
  ├── player/    # Video players
  └── ...
convex/          # Backend functions
lib/             # Shared utilities
  ├── composition-engine/
  └── dedalus/
types/           # TypeScript types
```

### Component Guidelines

- Keep components small and focused
- Use TypeScript interfaces for props
- Add JSDoc comments for complex logic
- Follow design system tokens (`lib/design-system.ts`)

### Backend Guidelines

- Use Convex queries for reads, mutations for writes
- Keep actions for external API calls (AI, Cloudflare)
- Add error handling everywhere
- Log important operations

### Testing

- Unit tests for utilities
- Integration tests for complex flows
- E2E tests for critical paths

## 🐛 Bug Reports

Found a bug? [Open an issue](https://github.com/YOUR_USERNAME/chatkut/issues/new) with:

- Clear title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos
- Environment (OS, browser, Node version)

## 💡 Feature Requests

Have an idea? [Open an issue](https://github.com/YOUR_USERNAME/chatkut/issues/new) with:

- Clear description
- Use case / problem it solves
- Proposed solution (optional)
- Mockups (optional)

## 📖 Documentation

When adding features:

- Update README.md if needed
- Add JSDoc comments
- Update IMPLEMENTATION_SUMMARY.md
- Add examples to TESTING_GUIDE.md
- Update CHANGELOG.md

## 🔒 Security

Found a security issue? Please email **security@chatkut.com** instead of opening a public issue.

## ❓ Questions

- Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for setup help
- Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for architecture
- Ask in [GitHub Discussions](https://github.com/YOUR_USERNAME/chatkut/discussions)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution helps make ChatKut better. Thank you for being part of this project! ⭐
