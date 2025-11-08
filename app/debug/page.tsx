"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function DebugPage() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string>("");

  return (
    <div className="p-8 bg-black text-white min-h-screen">
      <h1 className="text-2xl mb-4">Debug Page</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl mb-2">Environment Variables:</h2>
          <pre className="bg-gray-800 p-4 rounded">
            NEXT_PUBLIC_CONVEX_URL: {process.env.NEXT_PUBLIC_CONVEX_URL || "NOT SET"}
          </pre>
        </div>

        <div>
          <h2 className="text-xl mb-2">Convex Connection Status:</h2>
          <pre className="bg-gray-800 p-4 rounded">
            {projects === undefined ? "Loading..." :
             projects === null ? "Error connecting to Convex" :
             `Connected! Found ${projects.length} projects`}
          </pre>
        </div>

        {projects && projects.length > 0 && (
          <div>
            <h2 className="text-xl mb-2">Projects:</h2>
            <pre className="bg-gray-800 p-4 rounded overflow-auto">
              {JSON.stringify(projects, null, 2)}
            </pre>
          </div>
        )}

        <div>
          <h2 className="text-xl mb-2">Test Button Click:</h2>
          <button
            onClick={async () => {
              console.log("Test button clicked");
              alert("Button works! Check console for details.");
            }}
            className="bg-blue-500 px-4 py-2 rounded"
          >
            Test Button Click
          </button>
        </div>

        <div>
          <h2 className="text-xl mb-2">Test Create Project Mutation:</h2>
          <button
            onClick={async () => {
              setCreating(true);
              setResult("Creating...");
              try {
                console.log("Calling createProject mutation...");
                const projectId = await createProject({
                  name: `Test Project ${Date.now()}`,
                  description: "Debug test project"
                });
                console.log("Success! Project ID:", projectId);
                setResult(`✅ Success! Created project: ${projectId}`);
              } catch (error) {
                console.error("Error:", error);
                setResult(`❌ Error: ${error}`);
              } finally {
                setCreating(false);
              }
            }}
            disabled={creating}
            className="bg-green-500 px-4 py-2 rounded disabled:opacity-50"
          >
            {creating ? "Creating..." : "Test Create Project"}
          </button>
          {result && (
            <pre className="bg-gray-800 p-4 rounded mt-2">
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
