"use client";

import { useState, useOptimistic, useRef, useEffect, useTransition } from "react";
import { addComment, deleteComment, restoreComment, getComments, type CommentItem } from "@/lib/actions/comments";
import { useAuth } from "@/lib/auth/useAuth";
import { useToast } from "@/components/ui/toast-provider";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentSection({ resultId }: { resultId: string }) {
  const { account } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (state: CommentItem[], newComment: CommentItem) => [...state, newComment],
  );

  useEffect(() => {
    getComments(resultId).then((data) => {
      setComments(data);
      setLoading(false);
    });
  }, [resultId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting || !account?.id) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticComment: CommentItem = {
      id: optimisticId,
      text: trimmed,
      authorName: account.name ?? "You",
      authorId: account.id,
      createdAt: new Date().toISOString(),
    };

    setText("");
    setSubmitting(true);
    startTransition(async () => {
      addOptimistic(optimisticComment);

      const result = await addComment({ resultId, text: trimmed });
      if (result.success) {
        setComments((prev) => [...prev, result.comment]);
      } else {
        showToast("error", result.error);
        setComments((prev) => [...prev]);
      }
      setSubmitting(false);
      inputRef.current?.focus();
    });
  }

  async function handleDelete(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const result = await deleteComment(commentId);
    if (result.success) {
      showToast("warning", "Comment deleted", {
        durationMs: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const res = await restoreComment(commentId);
            if (res.success) {
              const refreshed = await getComments(resultId);
              setComments(refreshed);
            }
          },
        },
      });
    } else {
      // Restore on failure
      const refreshed = await getComments(resultId);
      setComments(refreshed);
      showToast("error", "Failed to delete comment");
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Comments</h2>
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 rounded-full border-2 border-teal border-t-transparent animate-spin" />
        </div>
      </section>
    );
  }

  const displayComments = optimisticComments;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
        Comments{displayComments.length > 0 && ` (${displayComments.length})`}
      </h2>

      {displayComments.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">
          No comments yet. Be the first to cheer them on!
        </p>
      )}

      <div className="flex flex-col gap-3">
        {displayComments.map((comment) => {
          const isOwn = account?.id === comment.authorId;
          const isOptimistic = comment.id.startsWith("temp-");
          return (
            <div
              key={comment.id}
              className={`rounded-xl bg-white border border-gray-100 shadow-sm p-3 flex flex-col gap-1 ${isOptimistic ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-charcoal">{comment.authorName}</span>
                <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
              </div>
              <p className="text-sm text-charcoal/80">{comment.text}</p>
              {isOwn && !isOptimistic && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="self-end text-xs text-red-400 hover:text-red-500 mt-1 transition"
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comment input */}
      {account && (
        <form onSubmit={handleSubmit} className="flex gap-2 mt-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="rounded-full bg-teal text-warm-white w-10 h-10 flex items-center justify-center disabled:opacity-40 transition shrink-0"
            aria-label="Send comment"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9z" />
            </svg>
          </button>
        </form>
      )}
    </section>
  );
}
