/**
 * Test action to verify Convex environment variables are set correctly
 *
 * Usage:
 *   Call this action from Convex dashboard or via client to verify
 *   all required environment variables are accessible from Convex cloud.
 *
 * Expected: All variables should show "✅ SET"
 * If any show "❌ MISSING", run: npx convex env set VARIABLE_NAME "value"
 */

import { action } from "./_generated/server";

export const testEnvironmentVariables = action({
  handler: async () => {
    console.log("[testEnvVars] Testing Convex environment variable access...");

    const requiredVars = [
      // Cloudflare Stream
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_STREAM_API_TOKEN",

      // Cloudflare R2
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_BUCKET_NAME",

      // Cloudflare Webhook
      "CLOUDFLARE_WEBHOOK_SECRET",

      // Dedalus AI
      "DEDALUS_API_KEY",
    ];

    const optionalVars = [
      // Remotion Lambda (optional - only if using cloud rendering)
      "REMOTION_AWS_REGION",
      "REMOTION_FUNCTION_NAME",
      "REMOTION_AWS_ACCESS_KEY_ID",
      "REMOTION_AWS_SECRET_ACCESS_KEY",
    ];

    const results: {
      required: Record<string, { status: "SET" | "MISSING"; hasValue: boolean }>;
      optional: Record<string, { status: "SET" | "MISSING"; hasValue: boolean }>;
      summary: {
        requiredCount: number;
        requiredSet: number;
        requiredMissing: number;
        optionalCount: number;
        optionalSet: number;
        allRequiredSet: boolean;
      };
    } = {
      required: {},
      optional: {},
      summary: {
        requiredCount: requiredVars.length,
        requiredSet: 0,
        requiredMissing: 0,
        optionalCount: optionalVars.length,
        optionalSet: 0,
        allRequiredSet: false,
      },
    };

    // Test required variables
    console.log("\n=== REQUIRED ENVIRONMENT VARIABLES ===");
    for (const varName of requiredVars) {
      const value = process.env[varName];
      const hasValue = !!value;
      const status = hasValue ? "SET" : "MISSING";

      results.required[varName] = { status, hasValue };

      if (hasValue) {
        results.summary.requiredSet++;
        console.log(`✅ ${varName}: SET (${value.substring(0, 10)}...)`);
      } else {
        results.summary.requiredMissing++;
        console.error(`❌ ${varName}: MISSING`);
        console.error(`   → Run: npx convex env set ${varName} "your-value"`);
      }
    }

    // Test optional variables
    console.log("\n=== OPTIONAL ENVIRONMENT VARIABLES ===");
    for (const varName of optionalVars) {
      const value = process.env[varName];
      const hasValue = !!value;
      const status = hasValue ? "SET" : "MISSING";

      results.optional[varName] = { status, hasValue };

      if (hasValue) {
        results.summary.optionalSet++;
        console.log(`✅ ${varName}: SET (${value.substring(0, 10)}...)`);
      } else {
        console.log(`⚠️  ${varName}: NOT SET (optional - only needed for Remotion Lambda)`);
      }
    }

    results.summary.allRequiredSet = results.summary.requiredMissing === 0;

    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(`Required: ${results.summary.requiredSet}/${results.summary.requiredCount} set`);
    console.log(`Optional: ${results.summary.optionalSet}/${results.summary.optionalCount} set`);

    if (results.summary.allRequiredSet) {
      console.log("\n✅ SUCCESS: All required environment variables are set!");
      console.log("Your Convex backend is ready for:");
      console.log("  - Video uploads (Cloudflare Stream)");
      console.log("  - File storage (Cloudflare R2)");
      console.log("  - Webhook processing (Cloudflare)");
      console.log("  - AI chat/planning (Dedalus)");
    } else {
      console.error("\n❌ FAILED: Some required environment variables are missing!");
      console.error(`Missing ${results.summary.requiredMissing} variable(s).`);
      console.error("\nTo fix:");
      console.error("1. Run the missing 'npx convex env set' commands above");
      console.error("2. Run this test again to verify");
      console.error("\nSee .env.example for detailed setup instructions.");
    }

    return results;
  },
});

/**
 * Quick test for a single environment variable
 *
 * Usage example:
 *   testSingleVar({ varName: "CLOUDFLARE_ACCOUNT_ID" })
 */
export const testSingleVar = action({
  args: {},
  handler: async (_ctx, args: { varName: string }) => {
    const { varName } = args;
    const value = process.env[varName];

    console.log(`[testEnvVars:single] Testing: ${varName}`);

    if (value) {
      console.log(`✅ ${varName} is SET`);
      console.log(`   Value preview: ${value.substring(0, 20)}...`);
      return { status: "SET", varName, preview: value.substring(0, 20) };
    } else {
      console.error(`❌ ${varName} is MISSING`);
      console.error(`   Run: npx convex env set ${varName} "your-value"`);
      return { status: "MISSING", varName };
    }
  },
});
