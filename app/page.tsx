"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PlusIcon, FolderIcon, CalendarIcon, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    console.log("Creating project:", newProjectName);
    setIsCreating(true);
    try {
      console.log("Calling createProject mutation...");
      const projectId = await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      });
      console.log("Project created with ID:", projectId);

      // Navigate to the new project
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-800">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">ChatKut</h1>
              <p className="text-neutral-400">AI-Powered Video Editor</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="container mx-auto px-6 py-8">
        {!projects ? (
          <div className="flex items-center justify-center h-64">
            <LoaderIcon className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderIcon className="w-16 h-16 text-neutral-700 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No projects yet</h2>
            <p className="text-neutral-500 mb-6">
              Create your first project to get started
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project: any) => (
              <ProjectCard
                key={project._id}
                project={project}
                onClick={() => router.push(`/project/${project._id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Project Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Video Project"
                  className="input-base w-full"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="What's this project about?"
                  className="input-base w-full min-h-[100px] resize-none"
                  rows={4}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setIsCreating(false);
                    setNewProjectName("");
                    setNewProjectDescription("");
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={!newProjectName.trim() || isCreating}
                >
                  {isCreating ? (
                    <LoaderIcon className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Create Project"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

interface ProjectCardProps {
  project: any;
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "card cursor-pointer transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10",
        "group relative overflow-hidden"
      )}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-primary-500/0 group-hover:from-primary-500/5 group-hover:to-primary-500/10 transition-all duration-300" />

      {/* Content */}
      <div className="relative">
        <div className="aspect-video bg-neutral-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
          <FolderIcon className="w-12 h-12 text-neutral-600 group-hover:text-primary-500 transition-colors" />
        </div>

        <h3 className="text-lg font-semibold mb-2 truncate">{project.name}</h3>

        {project.description && (
          <p className="text-sm text-neutral-500 mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center text-xs text-neutral-600">
          <CalendarIcon className="w-3 h-3 mr-1" />
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
