import React, { forwardRef, useId } from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      helperText,
      error,
      id: customId,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    return (
      <div className="flex items-start text-left">
        <div className="flex h-5 items-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-offset-slate-900 ${
              error ? "border-red-400" : ""
            } ${className}`}
            {...props}
          />
        </div>
        {(label || helperText) && (
          <div className="ml-3 text-sm leading-5">
            {label && (
              <label
                htmlFor={id}
                className="font-medium text-slate-700 dark:text-slate-200 select-none cursor-pointer"
              >
                {label}
              </label>
            )}
            {helperText && !error && (
              <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
                {helperText}
              </p>
            )}
            {error && (
              <p id={errorId} className="text-xs text-red-600 dark:text-red-400 mt-0.5" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
