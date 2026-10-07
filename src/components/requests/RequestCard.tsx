import React from "react";
import Link from "next/link";
import { Badge, Chip, Button, Card, CardHeader, CardTitle, CardContent, CardFooter, Avatar } from "@/components/ui";
import { admissionYearToStudyLevel, getStudyLevelLabel } from "@/lib/academic-year";
import { collegeConfig } from "../../../college.config";
import type { TeamRequest } from "@/types/database.types";

export interface RequestCardProps {
  request: TeamRequest & {
    profiles?: {
      display_name: string;
      department: string;
      admission_year: number | null;
    } | null;
  };
  isLead?: boolean;
  onClose?: (id: string) => void;
  onApply?: (id: string) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  isLead = false,
  onClose,
  onApply,
}) => {
  const leadName = request.profiles?.display_name || "Team Lead";
  const leadDept = request.profiles?.department || "Student";
  const isOpen = request.status === "open";

  // Format department code to full name if available
  const getDeptName = (code: string) =>
    collegeConfig.departments?.[code.toLowerCase()] || code.toUpperCase();

  return (
    <Card hoverable className="flex flex-col justify-between text-left h-full">
      <div>
        <CardHeader className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge
                variant={isOpen ? "accent" : request.status === "full" ? "warning" : "neutral"}
                size="sm"
                dot={isOpen}
              >
                {isOpen ? `${request.headcount} Spot${request.headcount > 1 ? "s" : ""} Needed` : request.status.toUpperCase()}
              </Badge>
              {request.room_id && (
                <Badge variant="warning" size="sm">
                  Follow-up Request
                </Badge>
              )}
              {request.resume_required && (
                <Badge variant="neutral" size="sm">
                  Resume Required
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <Link href={`/requests/${request.id}`}>{request.title}</Link>
            </CardTitle>
            <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Role: {request.role_needed}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-3 pb-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
            {request.description}
          </p>

          {/* Tags */}
          {request.tags && request.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {request.tags.slice(0, 5).map((tag) => (
                <Chip key={tag} label={tag} variant="default" className="text-[11px] py-0.5 px-2" />
              ))}
              {request.tags.length > 5 && (
                <span className="text-[10px] text-slate-400 self-center">
                  +{request.tags.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Eligibility Filters summary */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">Eligibility:</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <strong>Years:</strong>{" "}
                {request.filter_years && request.filter_years.length > 0
                  ? request.filter_years
                      .map((y) => getStudyLevelLabel(admissionYearToStudyLevel(y)))
                      .join(", ")
                  : "All Years"}
              </span>
              <span>
                <strong>Dept:</strong>{" "}
                {request.filter_departments && request.filter_departments.length > 0
                  ? request.filter_departments.map(getDeptName).join(", ")
                  : "All Departments"}
              </span>
              {request.filter_genders && request.filter_genders.length > 0 && (
                <span>
                  <strong>Gender:</strong>{" "}
                  {request.filter_genders.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter className="pt-3">
        <div className="flex items-center gap-2">
          <Avatar name={leadName} size="sm" />
          <div className="text-[11px] leading-tight">
            <p className="font-medium text-slate-900 dark:text-slate-100">{leadName}</p>
            <p className="text-slate-500">{leadDept}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLead ? (
            isOpen && onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClose(request.id)}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                Close
              </Button>
            )
          ) : (
            isOpen && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onApply?.(request.id)}
                className="text-xs"
              >
                Apply
              </Button>
            )
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
