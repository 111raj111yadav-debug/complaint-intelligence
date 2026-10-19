import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label = "Loading system data...",
  className = "",
}) => {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center space-x-2 text-slate-500 py-6 ${className}`}
    >
      <Loader2 className={`${sizeMap[size]} animate-spin text-sky-600`} />
      {label && (
        <span className="text-sm font-medium text-slate-600">{label}</span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
};
