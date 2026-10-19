import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = "System Notice",
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50/70 p-4 text-red-900 ${className}`}
    >
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-red-700 leading-relaxed">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              type="button"
              className="mt-3 inline-flex items-center text-xs font-medium text-red-700 hover:text-red-900 bg-white border border-red-300 rounded px-2.5 py-1.5 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
