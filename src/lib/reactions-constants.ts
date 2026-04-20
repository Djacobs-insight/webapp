export const ALLOWED_EMOJIS = ["👏", "🔥", "💪", "🏃", "❤️", "🎉"];

export type ReactionGroup = {
  emoji: string;
  count: number;
  reacted: boolean; // whether the current user has reacted with this emoji
};

export type ToggleReactionResult =
  | { success: true; added: boolean }
  | { success: false; error: string };
