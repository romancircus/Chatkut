/**
 * MCP (Model Context Protocol) Security Proxy
 *
 * All MCP calls from the frontend MUST go through this backend proxy for security.
 * This is a placeholder implementation until Dedalus SDK supports MCP natively.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";

export const callMCPTool = action({
  args: {
    toolName: v.string(),
    parameters: v.optional(v.any()),
  },
  handler: async (ctx, { toolName, parameters }) => {
    // Placeholder: MCP integration not yet implemented
    throw new Error(
      "MCP integration pending Dedalus SDK support"
    );
  },
});
