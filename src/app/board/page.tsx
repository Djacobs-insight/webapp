import { BackChevron } from "@/components/ui/back-chevron";

export default function BoardPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <BackChevron />
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16">
        <h1 className="text-3xl font-semibold">Leaderboard</h1>
        <p className="text-lg text-gray-500">This is the leaderboard page.</p>
      </main>
    </div>
  );
}
