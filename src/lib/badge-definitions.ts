export type BadgeCategory = "runs" | "speed" | "age_grade" | "streak" | "social";

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  criteria: BadgeCriteria;
}

export type BadgeCriteria =
  | { type: "run_count"; count: number }
  | { type: "finish_time_under"; seconds: number }
  | { type: "age_grade_above"; percentage: number }
  | { type: "streak_days"; count: number }
  | { type: "photos_uploaded"; count: number }
  | { type: "comments_given"; count: number };

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Run count badges
  {
    key: "first_run",
    name: "First Steps",
    description: "Record your first parkrun result",
    icon: "👟",
    category: "runs",
    criteria: { type: "run_count", count: 1 },
  },
  {
    key: "runs_10",
    name: "Getting Started",
    description: "Complete 10 parkruns",
    icon: "🏅",
    category: "runs",
    criteria: { type: "run_count", count: 10 },
  },
  {
    key: "runs_25",
    name: "Quarter Century",
    description: "Complete 25 parkruns",
    icon: "🥈",
    category: "runs",
    criteria: { type: "run_count", count: 25 },
  },
  {
    key: "runs_50",
    name: "Half Century",
    description: "Complete 50 parkruns",
    icon: "🥇",
    category: "runs",
    criteria: { type: "run_count", count: 50 },
  },
  {
    key: "runs_100",
    name: "Centurion",
    description: "Complete 100 parkruns",
    icon: "💯",
    category: "runs",
    criteria: { type: "run_count", count: 100 },
  },

  // Speed badges
  {
    key: "sub_30",
    name: "Sub 30",
    description: "Finish a parkrun in under 30 minutes",
    icon: "⚡",
    category: "speed",
    criteria: { type: "finish_time_under", seconds: 30 * 60 },
  },
  {
    key: "sub_25",
    name: "Sub 25",
    description: "Finish a parkrun in under 25 minutes",
    icon: "🚀",
    category: "speed",
    criteria: { type: "finish_time_under", seconds: 25 * 60 },
  },
  {
    key: "sub_20",
    name: "Sub 20",
    description: "Finish a parkrun in under 20 minutes",
    icon: "🔥",
    category: "speed",
    criteria: { type: "finish_time_under", seconds: 20 * 60 },
  },

  // Age-grade badges
  {
    key: "ag_60",
    name: "Age Grade 60%",
    description: "Achieve a 60%+ age-graded result",
    icon: "📊",
    category: "age_grade",
    criteria: { type: "age_grade_above", percentage: 60 },
  },
  {
    key: "ag_70",
    name: "Age Grade 70%",
    description: "Achieve a 70%+ age-graded result",
    icon: "📈",
    category: "age_grade",
    criteria: { type: "age_grade_above", percentage: 70 },
  },
  {
    key: "ag_80",
    name: "Age Grade 80%",
    description: "Achieve an 80%+ age-graded result",
    icon: "🌟",
    category: "age_grade",
    criteria: { type: "age_grade_above", percentage: 80 },
  },

  // Streak badges
  {
    key: "streak_4",
    name: "Month Warrior",
    description: "Record results 4 weeks in a row",
    icon: "🔗",
    category: "streak",
    criteria: { type: "streak_days", count: 4 },
  },
  {
    key: "streak_12",
    name: "Quarter Master",
    description: "Record results 12 weeks in a row",
    icon: "⛓️",
    category: "streak",
    criteria: { type: "streak_days", count: 12 },
  },

  // Social badges
  {
    key: "shutterbug",
    name: "Shutterbug",
    description: "Upload 5 photos with your results",
    icon: "📸",
    category: "social",
    criteria: { type: "photos_uploaded", count: 5 },
  },
  {
    key: "cheerleader",
    name: "Cheerleader",
    description: "Leave 10 comments on family results",
    icon: "📣",
    category: "social",
    criteria: { type: "comments_given", count: 10 },
  },
];

export function getBadgeDefinition(key: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.key === key);
}

export function getProgressHint(
  badge: BadgeDefinition,
  stats: { runCount: number; fastestTime: number | null; bestAgeGrade: number | null; weekStreak: number; photoCount: number; commentCount: number },
): string | null {
  const c = badge.criteria;
  switch (c.type) {
    case "run_count": {
      const remaining = c.count - stats.runCount;
      return remaining > 0 ? `${remaining} more run${remaining === 1 ? "" : "s"} to go` : null;
    }
    case "finish_time_under": {
      if (!stats.fastestTime) return "Record a result to start";
      if (stats.fastestTime <= c.seconds) return null;
      const diff = stats.fastestTime - c.seconds;
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      return mins > 0 ? `${mins}m ${secs}s to shave off` : `${secs}s to shave off`;
    }
    case "age_grade_above": {
      if (!stats.bestAgeGrade) return "Need age-grading data";
      const diff = c.percentage - stats.bestAgeGrade;
      return diff > 0 ? `${diff.toFixed(1)}% more to reach ${c.percentage}%` : null;
    }
    case "streak_days": {
      const remaining = c.count - stats.weekStreak;
      return remaining > 0 ? `${remaining} more week${remaining === 1 ? "" : "s"} in a row` : null;
    }
    case "photos_uploaded": {
      const remaining = c.count - stats.photoCount;
      return remaining > 0 ? `${remaining} more photo${remaining === 1 ? "" : "s"} to upload` : null;
    }
    case "comments_given": {
      const remaining = c.count - stats.commentCount;
      return remaining > 0 ? `${remaining} more comment${remaining === 1 ? "" : "s"} to leave` : null;
    }
  }
}
