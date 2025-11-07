# Changelog

All notable changes to ChatKut will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.0] - 2024-12-07

### ✅ Weeks 3-6 Complete - Full Frontend & Cloud Rendering

This marks the completion of the core ChatKut application with all major features implemented.

### Added - Week 6: Advanced Features

#### Undo/Redo System
- Full history tracking with snapshots (limit: 50)
- Keyboard shortcuts: `Cmd+Z` for undo, `Cmd+Shift+Z` for redo
- History panel UI showing all changes
- Snapshot restoration with version management
- **Files:** `convex/history.ts`, `components/editor/UndoRedo.tsx`

#### Remotion Player Integration
- Live composition preview with @remotion/player
- Dynamic component generation from Composition IR
- Support for all element types: video, audio, image, text, shape
- Animation rendering: scale, opacity, x/y transforms
- Keyframe interpolation with easing functions
- **Files:** `components/player/RemotionPreview.tsx`

#### Remotion Lambda (Cloud Rendering)
- Cloud rendering infrastructure setup
- Render job tracking and progress monitoring
- Cost estimation before rendering
- Codec selection: H.264, H.265, VP8, VP9, ProRes
- Quality settings (1-100%)
- Download completed renders
- **Files:** `lib/remotion/lambda.ts`, `convex/rendering.ts`, `components/rendering/RenderPanel.tsx`

### Added - Week 5: Composition Engine

#### Selector System
- Selector types: `byId`, `byLabel`, `byIndex`, `byType`
- Ambiguity detection and resolution
- Disambiguation UI for multiple matches
- Filter support for complex queries
- **Files:** `lib/composition-engine/selectors.ts`, `components/editor/Disambiguator.tsx`

#### Executor Engine
- Operations: add, update, delete, move
- Immutable IR updates
- Validation before execution
- Human-readable receipts
- Affected element tracking
- **Files:** `lib/composition-engine/executor.ts`, `convex/compositions.ts`

#### Utilities
- Element ID generation
- Timecode conversion (frames ↔ HH:MM:SS:FF)
- Overlap detection
- Easing functions
- Interpolation helpers
- **Files:** `lib/composition-engine/utils.ts`

### Added - Week 4: AI Integration

- Chat message handling via Convex actions
- Edit plan generation with GPT-4o
- Remotion code generation from IR
- Context building (assets, composition, history)
- Token usage & cost tracking
- Multi-model routing via Dedalus
- **Files:** Enhanced `convex/ai.ts` with all AI workflows

### Added - Week 3: Frontend UI

#### Design System
- Remotion-inspired dark theme (#0a0a0a background)
- Complete color palette (primary, neutral, success, warning, error, AI-specific)
- Typography system with Inter font
- Component tokens for consistent styling
- **Files:** `lib/design-system.ts`, `tailwind.config.ts`, `app/globals.css`

#### Core Components
- **Homepage** - Project listing with create modal
- **Chat Interface** - Real-time AI chat with edit plan previews
- **Video Upload** - TUS resumable uploads with drag-and-drop
- **HLS Player** - Cross-browser video playback with custom controls
- **Asset Library** - Grid view with filters and preview panel
- **Project Dashboard** - 3-panel layout (assets/preview/chat+render)
- **Files:** 15+ new React components

#### Convex Backend
- Project CRUD operations
- Composition management
- Asset tracking
- Chat message storage
- Real-time sync via Convex queries
- **Files:** `convex/projects.ts`, `convex/compositions.ts`, `convex/media.ts`

### Changed

- Updated project dashboard to integrate all new components
- Enhanced chat interface with disambiguator support
- Improved asset library with HLS preview integration
- Added collapsible panels for better UX

### Technical Details

- **Total Files Created/Modified:** 30+
- **React Components:** 15+
- **Convex Functions:** 40+ (queries/mutations/actions)
- **Lines of Code:** 5,000+
- **Dependencies Added:** Remotion, HLS.js, TUS.js, React Dropzone

---

## [0.2.0] - 2024-11-20

### Added - Week 1-2: Foundation

- Next.js 14 project setup with TypeScript
- Convex backend initialization
- Cloudflare Stream integration for video uploads
- Cloudflare R2 for object storage
- Dedalus AI integration (GPT-4o)
- Composition IR type definitions
- Basic project structure
- Environment configuration

### Technical Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Convex (real-time database & actions)
- **Media:** Cloudflare Stream, Cloudflare R2
- **AI:** Dedalus SDK (multi-model routing)
- **Video:** Remotion, Remotion Lambda

---

## [0.1.0] - 2024-11-15

### Initial Release

- Project concept and PRD
- Architecture design
- Implementation plan (8-week roadmap)
- Repository setup

---

## Roadmap - Post Week 6

### Phase 2: Polish & Production (Weeks 7-8)

#### Week 7: Authentication & Collaboration
- [ ] Clerk/Auth0 integration
- [ ] User profile management
- [ ] Team workspaces
- [ ] Sharing & permissions

#### Week 8: Advanced Editing
- [ ] Timeline UI for precise editing
- [ ] Keyframe editor
- [ ] Transition effects
- [ ] Audio waveforms
- [ ] Template marketplace

### Future Enhancements

- [ ] Export to social media formats (TikTok, Instagram, YouTube)
- [ ] AI-generated thumbnails
- [ ] Voice-to-text editing
- [ ] Auto-captions with Whisper
- [ ] Batch processing
- [ ] Plugin system
- [ ] Mobile app

---

## Contributing

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for development workflow.

## Documentation

- **[START_TESTING.md](START_TESTING.md)** - Quick start guide
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Comprehensive tests
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Feature breakdown
- **[CLAUDE.md](CLAUDE.md)** - Architecture guidance
