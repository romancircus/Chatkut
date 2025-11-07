"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { SendIcon, LoaderIcon } from "lucide-react";

interface ChatInterfaceProps {
  projectId: Id<"projects">;
}

export function ChatInterface({ projectId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get chat messages
  const messages = useQuery(api.ai.getChatMessages, { projectId, limit: 50 });

  // Send message mutation
  const sendMessage = useMutation(api.ai.sendChatMessage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      await sendMessage({
        projectId,
        message: userMessage,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages?.length === 0 && (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">
                Ask me to create or edit a video using natural language
              </p>
            </div>
          </div>
        )}

        {messages?.map((message) => (
          <ChatMessage
            key={message._id}
            role={message.role}
            content={message.content}
            editPlan={message.editPlan}
            receipt={message.receipt}
            timestamp={message.timestamp}
          />
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-neutral-500">
            <LoaderIcon className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="border-t border-neutral-800 p-4">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to create or edit..."
            className="input-base w-full resize-none min-h-[44px] max-h-[200px] pr-12"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "absolute right-2 bottom-2 p-2 rounded-lg transition-colors",
              input.trim() && !isLoading
                ? "bg-primary-500 hover:bg-primary-600 text-white"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            )}
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
        <p className="text-xs text-neutral-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  editPlan?: any;
  receipt?: string;
  timestamp: number;
}

function ChatMessage({
  role,
  content,
  editPlan,
  receipt,
  timestamp,
}: ChatMessageProps) {
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex flex-col space-y-2 animate-slide-up",
        role === "user" ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "rounded-lg p-4 max-w-[80%]",
          role === "user"
            ? "bg-primary-500 text-white"
            : "bg-neutral-800 text-neutral-100"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>

        {/* Edit Plan Preview */}
        {editPlan && role === "assistant" && (
          <div className="mt-3 pt-3 border-t border-neutral-700">
            <p className="text-xs text-neutral-400 mb-2">Edit Plan:</p>
            <div className="bg-neutral-900 rounded p-2 font-mono text-xs">
              <div>
                <span className="text-amber-400">Operation:</span>{" "}
                {editPlan.operation}
              </div>
              <div>
                <span className="text-amber-400">Selector:</span>{" "}
                {editPlan.selector?.type}
              </div>
            </div>
          </div>
        )}

        {/* Receipt */}
        {receipt && role === "assistant" && (
          <div className="mt-3 pt-3 border-t border-neutral-700">
            <div className="flex items-start space-x-2">
              <span className="text-success-DEFAULT">✓</span>
              <p className="text-sm text-neutral-300">{receipt}</p>
            </div>
          </div>
        )}

        <p className="text-xs mt-2 opacity-60">{formattedTime}</p>
      </div>
    </div>
  );
}
