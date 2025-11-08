"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { UndoIcon, RedoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UndoRedoProps {
  compositionId: Id<"compositions">;
}

/**
 * Undo/Redo UI Component with keyboard shortcuts
 */
export function UndoRedo({ compositionId }: UndoRedoProps) {
  const undoRedoState = useQuery(api.history.getUndoRedoState, {
    compositionId,
  });
  const undo = useMutation(api.history.undo);
  const history = useQuery(api.history.getHistory, { compositionId, limit: 10 });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z or Ctrl+Z for Undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoRedoState?.canUndo) {
          handleUndo();
        }
      }

      // Cmd+Shift+Z or Ctrl+Shift+Z for Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (undoRedoState?.canRedo) {
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoRedoState?.canUndo, undoRedoState?.canRedo]);

  const handleUndo = async () => {
    try {
      const result = await undo({ compositionId });
      if (result.success) {
        console.log(result.message);
      }
    } catch (error) {
      console.error("Undo failed:", error);
    }
  };

  const handleRedo = async () => {
    // TODO: Implement redo (need to track forward in history)
    console.log("Redo not yet implemented");
  };

  if (!undoRedoState) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Undo Button */}
      <button
        onClick={handleUndo}
        disabled={!undoRedoState.canUndo}
        className={cn(
          "p-2 rounded-lg transition-colors",
          undoRedoState.canUndo
            ? "hover:bg-neutral-800 text-neutral-300"
            : "text-neutral-600 cursor-not-allowed"
        )}
        title="Undo (Cmd+Z)"
      >
        <UndoIcon className="w-5 h-5" />
      </button>

      {/* Redo Button */}
      <button
        onClick={handleRedo}
        disabled={!undoRedoState.canRedo}
        className={cn(
          "p-2 rounded-lg transition-colors",
          undoRedoState.canRedo
            ? "hover:bg-neutral-800 text-neutral-300"
            : "text-neutral-600 cursor-not-allowed"
        )}
        title="Redo (Cmd+Shift+Z)"
      >
        <RedoIcon className="w-5 h-5" />
      </button>

      {/* History Count */}
      {undoRedoState.historyCount > 0 && (
        <span className="text-xs text-neutral-600">
          {undoRedoState.historyCount} change{undoRedoState.historyCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/**
 * History Panel - shows list of changes
 */
export function HistoryPanel({ compositionId }: UndoRedoProps) {
  const history = useQuery(api.history.getHistory, { compositionId, limit: 20 });
  const restoreSnapshot = useMutation(api.history.restoreSnapshot);

  const handleRestore = async (snapshotId: Id<"compositionHistory">) => {
    try {
      await restoreSnapshot({ compositionId, snapshotId });
    } catch (error) {
      console.error("Failed to restore snapshot:", error);
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="p-4 text-center text-neutral-500">
        <p className="text-sm">No history yet</p>
        <p className="text-xs mt-1">Changes will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 mb-3">History</h3>
      {history.map((snapshot: any, index: number) => (
        <button
          key={snapshot._id}
          onClick={() => handleRestore(snapshot._id)}
          className="w-full text-left p-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">{snapshot.description}</p>
              <p className="text-xs text-neutral-600 mt-1">
                {formatTimestamp(snapshot.timestamp)}
              </p>
            </div>
            {index === 0 && (
              <span className="text-xs text-primary-500 ml-2">Current</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than 1 minute
  if (diff < 60000) {
    return "Just now";
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }

  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }

  // More than 1 day
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
