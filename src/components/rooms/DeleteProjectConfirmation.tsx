"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";

interface DeleteProjectConfirmationProps {
  itemName: string;
  itemType: "team request" | "project room";
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteProjectConfirmation({
  itemName,
  itemType,
  onConfirm,
  isDeleting,
}: DeleteProjectConfirmationProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typedName, setTypedName] = useState("");

  const isMatch =
    typedName.trim().toLowerCase() === (itemName || "").trim().toLowerCase();

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setStep(1)}>
        Delete {itemType}
      </Button>
      {step > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          role="presentation"
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground"
          >
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-2xl font-bold text-red-600 dark:text-red-400"
              aria-hidden="true"
            >
              !
            </div>
            <h2
              id="delete-project-title"
              className="text-lg font-bold text-foreground"
            >
              {step === 1
                ? `Delete this ${itemType}?`
                : "Confirm permanent deletion"}
            </h2>

            {step === 1 ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Deleting{" "}
                  <strong className="font-semibold text-foreground">
                    {itemName}
                  </strong>{" "}
                  is permanent.{" "}
                  {itemType === "team request"
                    ? "Its applications, uploaded application files, and any linked project room and room files will also be deleted."
                    : "Its members, chat, tasks, meetings, milestones, and uploaded room files will also be deleted. The original team request will remain."}
                </p>
                <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-2.5">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => setStep(2)}>
                    Continue
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  To prevent accidental deletion, please type the project name
                  below:
                </p>
                <div className="mt-3 rounded-lg border border-border bg-muted/80 px-3.5 py-2.5 text-sm font-mono font-medium text-foreground select-all">
                  {itemName}
                </div>
                <input
                  autoFocus
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  placeholder={`Type "${itemName}" to confirm`}
                  aria-label="Type the project name to confirm deletion"
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <div className="mt-6 flex justify-end gap-2.5">
                  <Button
                    variant="outline"
                    disabled={isDeleting}
                    onClick={() => {
                      setStep(0);
                      setTypedName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={isDeleting}
                    disabled={!isMatch}
                    onClick={onConfirm}
                  >
                    Permanently delete
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
