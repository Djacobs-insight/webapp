"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/useAuth";
import { getFamilyPhotos, softDeletePhoto, restorePhoto } from "@/lib/actions/photos";
import type { GalleryPhoto } from "@/lib/actions/photos";
import { BackChevron } from "@/components/ui/back-chevron";
import { EmptyState } from "@/components/ui/empty-state";
import { Lightbox } from "@/components/ui/lightbox";
import { useToast } from "@/components/ui/toast-provider";

export default function PhotoGalleryPage() {
  const { account, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (account) {
      getFamilyPhotos().then((data) => {
        setPhotos(data);
        setLoading(false);
      });
    }
  }, [account]);

  // Group photos by date
  const grouped = useMemo(() => {
    const map = new Map<string, GalleryPhoto[]>();
    for (const p of photos) {
      const key = p.resultDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()];
  }, [photos]);

  // Flat list for lightbox navigation
  const flatPhotos = useMemo(() => photos, [photos]);

  const handleDelete = useCallback(
    async (photoId: string) => {
      const res = await softDeletePhoto(photoId);
      if (!res.success) {
        showToast("error", res.error);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setLightboxIndex(null);
      showToast("warning", "Photo deleted", {
        durationMs: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await restorePhoto(photoId);
            // Refresh
            const fresh = await getFamilyPhotos();
            setPhotos(fresh);
          },
        },
      });
    },
    [showToast],
  );

  if (authLoading || (account && loading)) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron href="/profile" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron href="/profile" />
        <main className="flex flex-col flex-1 items-center justify-center px-6">
          <EmptyState
            title="Sign in to view photos"
            description="Photos from your family's parkruns will appear here."
            icon={<span>📷</span>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <BackChevron href="/profile" />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Photo Gallery</h1>

        {photos.length === 0 ? (
          <EmptyState
            title="No photos yet"
            description="Photos attached to parkrun results will appear here."
            icon={<span>📸</span>}
          />
        ) : (
          grouped.map(([date, datePhotos]) => (
            <section key={date} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{date}</h2>
              <div className="grid grid-cols-3 gap-2">
                {datePhotos.map((photo) => {
                  const flatIdx = flatPhotos.findIndex((p) => p.id === photo.id);
                  return (
                    <button
                      key={photo.id}
                      className="relative rounded-xl overflow-hidden border border-gray-100 shadow-sm aspect-square"
                      onClick={() => setLightboxIndex(flatIdx)}
                      aria-label={`Photo by ${photo.runnerName}`}
                    >
                      <Image
                        src={photo.thumbnailUrl}
                        alt={`Photo by ${photo.runnerName}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && flatPhotos[lightboxIndex] && (
        <LightboxOverlay
          photo={flatPhotos[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : undefined}
          onNext={lightboxIndex < flatPhotos.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : undefined}
          onDelete={flatPhotos[lightboxIndex].isOwn ? () => handleDelete(flatPhotos[lightboxIndex].id) : undefined}
        />
      )}
    </div>
  );
}

function LightboxOverlay({
  photo,
  onClose,
  onPrev,
  onNext,
  onDelete,
}: {
  photo: GalleryPhoto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDelete?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Lightbox
      src={photo.displayUrl}
      alt={`Photo by ${photo.runnerName}`}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-white">
            <p className="text-sm font-medium">{photo.runnerName}</p>
            <Link href={`/board/${photo.resultId}`} className="text-xs text-white/70 underline" onClick={onClose}>
              {photo.resultDate}
            </Link>
          </div>
          {onDelete && (
            confirmDelete ? (
              <button
                className="rounded-lg border-2 border-red-500 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/20 transition"
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
              >
                Confirm delete
              </button>
            ) : (
              <button
                className="rounded-lg border border-red-400/50 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/20 transition"
                onClick={() => setConfirmDelete(true)}
              >
                🗑 Delete
              </button>
            )
          )}
        </div>
      }
    />
  );
}
