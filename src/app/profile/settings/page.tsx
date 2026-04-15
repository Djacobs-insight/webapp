"use client";
import { useState, useEffect } from "react";
import { BackChevron } from "@/components/ui/back-chevron";
import { useToast } from "@/components/ui/toast-provider";
import { z } from "zod";

const STORAGE_KEY = "sm_notification_prefs";

const prefsSchema = z.object({
  familyResultPosted: z.boolean(),
  commentOnResult: z.boolean(),
  reactionOnResult: z.boolean(),
  weeklySummary: z.boolean(),
});

type NotificationPrefs = z.infer<typeof prefsSchema>;

const DEFAULTS: NotificationPrefs = {
  familyResultPosted: true,
  commentOnResult: true,
  reactionOnResult: true,
  weeklySummary: true,
};

const LABELS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  {
    key: "familyResultPosted",
    label: "Family results",
    description: "When a family member posts their parkrun result",
  },
  {
    key: "commentOnResult",
    label: "Comments",
    description: "When someone comments on your result",
  },
  {
    key: "reactionOnResult",
    label: "Reactions",
    description: "When someone reacts to your result",
  },
  {
    key: "weeklySummary",
    label: "Weekly summary",
    description: "A Saturday evening recap of your family's results",
  },
];

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = prefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [mounted, setMounted] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    showToast("success", "Preferences saved");
  };

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Choose what you&apos;d like to be notified about.</p>
        </div>

        <div className="flex flex-col gap-2">
          {LABELS.map(({ key, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 gap-4"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-charcoal text-base">{label}</span>
                <span className="text-sm text-gray-500">{description}</span>
              </div>
              <button
                role="switch"
                aria-checked={mounted ? prefs[key] : DEFAULTS[key]}
                aria-label={`Toggle ${label}`}
                onClick={() => toggle(key)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 ${
                  mounted && prefs[key] ? "bg-coral" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-1 ${
                    mounted && prefs[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Preferences are saved automatically. In-app notifications only for now — push notifications coming soon.
        </p>
      </main>
    </div>
  );
}
