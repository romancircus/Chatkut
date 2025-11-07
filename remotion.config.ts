/**
 * Remotion configuration
 *
 * This configures Remotion for use with Next.js and Lambda rendering.
 */

import { Config } from "@remotion/cli/config";

// Enable webpack caching for faster builds
Config.setCachingEnabled(true);

// Set concurrent renders (adjust based on your machine)
Config.setConcurrency(2);

// Configure for Next.js integration
Config.setPublicDir("./public");

// Timeout for rendering (in milliseconds)
Config.setDelayRenderTimeoutInMilliseconds(30000);

// Enable experimental features
Config.setChromiumDisableWebSecurity(true); // Needed for CORS with media files

// Lambda configuration (when we deploy)
Config.setAwsRegion(process.env.REMOTION_AWS_REGION || "us-east-1");
