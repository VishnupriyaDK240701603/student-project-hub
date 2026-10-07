"use client";

import React, { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: React.ReactNode;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab || tabs[0]?.id || "");

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      handleSelect(nextTab.id);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Tab List */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800"
      >
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-t-lg ${
                isSelected
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 font-semibold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && <span>{tab.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-4">
        {tabs.map((tab) => {
          const isSelected = tab.id === activeTab;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`panel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              hidden={!isSelected}
              className={isSelected ? "block focus-visible:outline-none" : "hidden"}
              tabIndex={0}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
