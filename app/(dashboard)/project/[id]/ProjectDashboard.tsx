"use client";

import { useQuery, Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { VideoUpload } from "@/components/upload/VideoUpload";
import { AssetLibrary } from "@/components/library/AssetLibrary";
import { RemotionPreview } from "@/components/player/RemotionPreview";
import { UndoRedo } from "@/components/editor/UndoRedo";
import { RenderPanel } from "@/components/rendering/RenderPanel";
import { PanelLeftIcon, UploadIcon, FolderIcon, PanelRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectDashboardProps {
  projectId: Id<"projects">;
  preloadedProject: Preloaded<typeof api.projects.get>;
  preloadedCompositions: Preloaded<typeof api.compositions.list>;
  preloadedAssets: Preloaded<typeof api.media.listAssets>;
}

/**
 * Client Component - handles interactivity
 *
 * Uses preloaded data from server component for initial render,
 * then subscribes to real-time updates via usePreloadedQuery.
 *
 * Benefits:
 * - Faster initial page load (data fetched on server)
 * - Better SEO (content in initial HTML)
 * - Real-time updates (Convex subscriptions)
 */
export function ProjectDashboard({
  projectId,
  preloadedProject,
  preloadedCompositions,
  preloadedAssets,
}: ProjectDashboardProps) {
  const [leftPanel, setLeftPanel] = useState<"upload" | "library">("library");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Use preloaded data with real-time subscriptions
  const project = usePreloadedQuery(preloadedProject);
  const compositions = usePreloadedQuery(preloadedCompositions);
  const assets = usePreloadedQuery(preloadedAssets);

  const compositionId = compositions?.[0]?._id;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Left Sidebar - Assets/Upload */}
      <div
        className={cn(
          "border-r border-neutral-800 transition-all duration-300",
          isLeftPanelOpen ? "w-80" : "w-0"
        )}
      >
        {isLeftPanelOpen && (
          <div className="flex flex-col h-full w-80">
            {/* Panel Tabs */}
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setLeftPanel("library")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2",
                  leftPanel === "library"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-400 hover:text-neutral-300"
                )}
              >
                <FolderIcon className="w-4 h-4" />
                <span>Library</span>
              </button>
              <button
                onClick={() => setLeftPanel("upload")}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2",
                  leftPanel === "upload"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-400 hover:text-neutral-300"
                )}
              >
                <UploadIcon className="w-4 h-4" />
                <span>Upload</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {leftPanel === "library" && <AssetLibrary projectId={projectId} />}
              {leftPanel === "upload" && (
                <div className="p-4">
                  <VideoUpload
                    projectId={projectId}
                    onUploadComplete={() => setLeftPanel("library")}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-neutral-800 flex items-center px-4">
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="btn-ghost p-2 mr-4"
          >
            <PanelLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-neutral-500">{project.description}</p>
            )}
          </div>
          {/* Undo/Redo */}
          {compositionId && <UndoRedo compositionId={compositionId} />}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="btn-ghost p-2 ml-4"
          >
            <PanelRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Split View: Preview + Chat + Render */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview Panel */}
          <div className="flex-1 flex items-center justify-center p-6 bg-neutral-900">
            {compositionId ? (
              <RemotionPreview
                compositionId={compositionId}
                className="w-full max-w-4xl"
              />
            ) : (
              <div className="text-center text-neutral-500">
                <p className="text-lg font-medium">No Composition Yet</p>
                <p className="text-sm mt-2">
                  Start chatting to create your first composition
                </p>
              </div>
            )}
          </div>

          {/* Chat Panel */}
          <div className="w-96 flex flex-col border-l border-neutral-800">
            <ChatInterface projectId={projectId} />
          </div>

          {/* Render Panel */}
          {compositionId && isRightPanelOpen && (
            <div className="w-80">
              <RenderPanel
                compositionId={compositionId}
                projectId={projectId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
