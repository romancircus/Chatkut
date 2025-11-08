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
 * - Use preloadQuery for server-side Convex queries
 * - Pass preloaded data to client component
 *
 * @see PRIORITIZED_IMPLEMENTATION_PLAN.md Task 2.2
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  // Await params in Next.js 14+
  const { id } = await params;
  const projectId = id as Id<"projects">;

  // Server-side parallel data fetching with preloadQuery
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
}
