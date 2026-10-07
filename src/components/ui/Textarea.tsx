"use client";

import React, { forwardRef, useId, useState } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCount = false,
      maxLength,
      id: customId,
      className = "",
      disabled,
      required,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const [charCount, setCharCount] = useState<number>(
      typeof value === "string"
        ? value.length
        : typeof defaultValue === "string"
        ? defaultValue.length
        : 0,
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full space-y-1.5 text-left">
        <div className="flex justify-between items-baseline">
          {label && (
            <label
              htmlFor={id}
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
          {showCount && maxLength && (
            <span className="text-xs text-slate-400">
              {charCount} / {maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={id}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          required={required}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-150 ease-out focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed dark:disabled:bg-slate-800 ${
            error
              ? "border-red-400 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:text-red-100 dark:bg-slate-900"
              : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          } ${className}`}
          rows={props.rows || 4}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
