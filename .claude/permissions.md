# Claude Code Permissions Configuration

This file helps you configure automatic approvals for Claude Code operations in this repository.

## How to Grant Permissions

In Claude Code, you can grant permissions by typing commands in the chat. Here's what you should grant for this project:

### 1. File Operations (Already Auto-Approved)

These are already auto-approved by default:
- Read any file: `Read(///**)`
- Write any file: `Write(///**)`
- Edit any file: `Edit(///**)`

### 2. Command Execution

To avoid approval prompts for every command, you can pre-approve common commands:

```bash
# Development commands
/preapprove Bash(npm:*)
/preapprove Bash(npx:*)
/preapprove Bash(node:*)
/preapprove Bash(pnpm:*)
/preapprove Bash(yarn:*)

# Git commands
/preapprove Bash(git:*)

# File system operations
/preapprove Bash(mkdir:*)
/preapprove Bash(rm:*)
/preapprove Bash(cp:*)
/preapprove Bash(mv:*)
/preapprove Bash(touch:*)

# Package managers
/preapprove Bash(npm install:*)
/preapprove Bash(npm run:*)
/preapprove Bash(npx convex:*)
/preapprove Bash(npx remotion:*)

# Build and test
/preapprove Bash(npm run build:*)
/preapprove Bash(npm run dev:*)
/preapprove Bash(npm run test:*)
/preapprove Bash(npm run lint:*)
/preapprove Bash(npm run type-check:*)

# Deployment
/preapprove Bash(vercel:*)
/preapprove Bash(npx convex deploy:*)
```

### 3. File Pattern Operations

```bash
# TypeScript files
/preapprove Read(**/*.ts)
/preapprove Read(**/*.tsx)
/preapprove Write(**/*.ts)
/preapprove Write(**/*.tsx)
/preapprove Edit(**/*.ts)
/preapprove Edit(**/*.tsx)

# Configuration files
/preapprove Read(**/*.json)
/preapprove Read(**/*.yaml)
/preapprove Read(**/*.yml)
/preapprove Read(**/*.toml)
/preapprove Write(**/*.json)
/preapprove Write(**/*.yaml)
/preapprove Edit(**/*.json)
```

### 4. MCP Tools (If Available)

```bash
# Next.js DevTools MCP
/preapprove mcp__next-devtools__*

# Context7 MCP (for documentation)
/preapprove mcp__context7__*

# Convex MCP (if available)
/preapprove mcp__convex__*
```

## Quick Setup Commands

Copy and paste these commands into Claude Code to grant all permissions at once:

```bash
/preapprove Bash(npm:*)
/preapprove Bash(npx:*)
/preapprove Bash(node:*)
/preapprove Bash(git:*)
/preapprove Bash(mkdir:*)
/preapprove Bash(touch:*)
/preapprove Bash(npm install:*)
/preapprove Bash(npm run:*)
/preapprove Bash(npx convex:*)
/preapprove Bash(npx remotion:*)
/preapprove Bash(vercel:*)
```

## What Each Permission Allows

### `Bash(npm:*)` - NPM Commands
Allows Claude to run any npm command without asking for permission each time:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`
- etc.

### `Bash(npx:*)` - NPX Commands
Allows running npx commands, including:
- `npx convex dev`
- `npx convex deploy`
- `npx remotion lambda deploy`
- etc.

### `Bash(git:*)` - Git Commands
Allows all Git operations:
- `git add`
- `git commit`
- `git push`
- `git status`
- etc.

### File Operations
Already pre-approved by default, no action needed.

## Security Considerations

### Safe to Pre-Approve
- Read operations (always safe)
- npm/npx commands (standard development)
- Git operations (version control)
- File system operations in project directory

### Should NOT Pre-Approve
- Commands that modify system files outside project
- Commands that delete large amounts of data
- Commands that expose secrets or credentials
- Destructive git operations (force push, hard reset)

## Recommended Workflow

1. **Start Session**: Grant all permissions above at the start of your coding session
2. **During Development**: Claude can work without constant approval prompts
3. **Review Changes**: Always review git diffs before committing
4. **Revoke if Needed**: Type `/revoke <pattern>` to remove a permission

## Example Session Startup

When you start a new Claude Code session for ChatKut:

1. Open Claude Code
2. Navigate to this project directory
3. Paste these commands:
   ```
   /preapprove Bash(npm:*)
   /preapprove Bash(npx:*)
   /preapprove Bash(git:*)
   /preapprove Bash(npm install:*)
   /preapprove Bash(npm run:*)
   ```
4. Say: "Let's start implementing the ChatKut project following IMPLEMENTATION_PLAN.md"

Claude will now be able to work efficiently without interrupting you for approvals on common operations.

## Checking Current Permissions

To see what permissions are currently granted:
```
/permissions
```

To revoke a permission:
```
/revoke Bash(npm:*)
```

## Project-Specific Patterns

For this ChatKut project, you'll want to pre-approve:

```bash
# Convex operations
/preapprove Bash(npx convex dev:*)
/preapprove Bash(npx convex deploy:*)
/preapprove Bash(npx convex function:*)

# Remotion operations
/preapprove Bash(npx remotion:*)
/preapprove Bash(npx remotion lambda:*)
/preapprove Bash(npx remotion studio:*)

# Next.js operations
/preapprove Bash(npm run dev:*)
/preapprove Bash(npm run build:*)
/preapprove Bash(npm run start:*)

# Testing
/preapprove Bash(npm test:*)
/preapprove Bash(npm run test:*)
/preapprove Bash(npx playwright:*)
```

---

**Note**: These permissions are session-based and may need to be re-granted each time you start a new Claude Code session. Consider saving these commands in a note for quick access.
