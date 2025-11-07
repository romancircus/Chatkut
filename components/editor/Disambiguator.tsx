"use client";

import { useState } from "react";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisambiguationOption {
  elementId: string;
  label: string;
  description: string;
}

interface DisambiguatorProps {
  /** Array of options to choose from */
  options: DisambiguationOption[];
  /** Callback when user selects an option */
  onSelect: (elementId: string) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** The original user message that caused ambiguity */
  userMessage?: string;
}

/**
 * Disambiguator UI Component
 *
 * Shows when an AI edit plan selector matches multiple elements
 * and the user needs to clarify which one they meant.
 */
export function Disambiguator({
  options,
  onSelect,
  onCancel,
  userMessage,
}: DisambiguatorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="card border border-amber-500/30 bg-amber-500/5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start space-x-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-500 text-lg">?</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-400 mb-1">
            Which element did you mean?
          </h3>
          {userMessage && (
            <p className="text-sm text-neutral-400">
              Your request: "{userMessage}"
            </p>
          )}
        </div>
      </div>

      {/* Options Grid */}
      <div className="space-y-2 mb-4">
        {options.map((option) => (
          <button
            key={option.elementId}
            onClick={() => setSelectedId(option.elementId)}
            className={cn(
              "w-full text-left p-4 rounded-lg border-2 transition-all",
              selectedId === option.elementId
                ? "border-primary-500 bg-primary-500/10"
                : "border-neutral-700 hover:border-neutral-600 bg-neutral-900"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium mb-1">{option.label}</p>
                <p className="text-sm text-neutral-500">{option.description}</p>
              </div>
              {selectedId === option.elementId && (
                <CheckCircleIcon className="w-5 h-5 text-primary-500 flex-shrink-0 ml-3" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <XCircleIcon className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedId}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2",
            selectedId
              ? "bg-primary-500 hover:bg-primary-600 text-white"
              : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
          )}
        >
          <CheckCircleIcon className="w-4 h-4" />
          <span>Confirm</span>
        </button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-neutral-600 mt-3 text-center">
        Select the element you want to edit, then click Confirm
      </p>
    </div>
  );
}

/**
 * Inline Disambiguator (for chat interface)
 */
export function InlineDisambiguator({
  options,
  onSelect,
  onCancel,
}: Omit<DisambiguatorProps, "userMessage">) {
  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium text-amber-400">
        Multiple matches found - which one?
      </p>
      <div className="space-y-1">
        {options.map((option) => (
          <button
            key={option.elementId}
            onClick={() => onSelect(option.elementId)}
            className="w-full text-left px-3 py-2 rounded bg-neutral-900 hover:bg-neutral-800 transition-colors text-sm"
          >
            <span className="font-medium">{option.label}</span>
            <span className="text-neutral-500 ml-2">– {option.description}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="w-full text-center text-xs text-neutral-500 hover:text-neutral-400 transition-colors py-1"
      >
        Cancel
      </button>
    </div>
  );
}
