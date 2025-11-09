import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ProjectDashboard } from "./ProjectDashboard";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Server Component - handles data fetching with preloadQuery
 *
 * This follows Next.js 14+ pattern:
 * - Async server component for data fetching
 * - Await params promise
 * - Use preloadQuery for server-side Convex queries (with retry on network errors)
 * - Pass preloaded data to client component
 *
 * @see PRIORITIZED_IMPLEMENTATION_PLAN.md Task 2.2
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  // Await params in Next.js 14+
  const { id } = await params;
  const projectId = id as Id<"projects">;

  // Server-side parallel data fetching with preloadQuery
  // Retry up to 3 times on network timeouts (ETIMEDOUT, EHOSTUNREACH)
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const [preloadedProject, preloadedCompositions, preloadedAssets] = await Promise.all([
        preloadQuery(api.projects.get, { projectId }),
        preloadQuery(api.compositions.list, { projectId }),
        preloadQuery(api.media.listAssets, { projectId }),
      ]);

      return (
        <ProjectDashboard
          projectId={projectId}
          preloadedProject={preloadedProject}
          preloadedCompositions={preloadedCompositions}
          preloadedAssets={preloadedAssets}
        />
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network timeouts
      const isNetworkTimeout =
        error instanceof Error &&
        (error.message.includes('ETIMEDOUT') ||
         error.message.includes('EHOSTUNREACH') ||
         error.message.includes('fetch failed'));

      if (isNetworkTimeout && attempt < 3) {
        console.warn(`[ProjectPage] Network timeout on attempt ${attempt}, retrying...`);
        // Exponential backoff: 100ms, 200ms
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }

      // Not a network timeout or max retries reached, throw error
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("Failed to load project after 3 attempts");
}
