# Lib

Shared utilities and core business logic.

## Structure

- **composition-engine/** - Plan-Execute-Patch editing system
  - `planner.ts` - Generate edit plans from user messages
  - `executor.ts` - Execute plans and apply AST patches
  - `selectors.ts` - Resolve element selectors
  - `compiler.ts` - Compile IR to Remotion code

- **dedalus/** - Dedalus SDK wrappers and multi-model routing

- **utils/** - General utility functions
