"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { customTokenCardsClient } from "@/lib/client";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ImageUpload } from "@/components/ui/image-upload";
import type { CustomTokenCardCreatorDTO } from "@/lib/services/contracts/ICustomTokenCardService";

type FormState = {
  displayName: string;
  slug: string;
  bio: string;
  avatarUrl: string;
  websiteUrl: string;
  shopUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  xUrl: string;
  blueskyUrl: string;
  discordInviteUrl: string;
};

const EMPTY: FormState = {
  displayName: "",
  slug: "",
  bio: "",
  avatarUrl: "",
  websiteUrl: "",
  shopUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  xUrl: "",
  blueskyUrl: "",
  discordInviteUrl: "",
};

function fromDTO(dto: CustomTokenCardCreatorDTO): FormState {
  return {
    displayName: dto.displayName,
    slug: dto.slug,
    bio: dto.bio ?? "",
    avatarUrl: dto.avatarUrl ?? "",
    websiteUrl: dto.websiteUrl ?? "",
    shopUrl: dto.shopUrl ?? "",
    instagramUrl: dto.instagramUrl ?? "",
    facebookUrl: dto.facebookUrl ?? "",
    xUrl: dto.xUrl ?? "",
    blueskyUrl: dto.blueskyUrl ?? "",
    discordInviteUrl: dto.discordInviteUrl ?? "",
  };
}

export default function CreatorProfilePortalPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [existing, setExisting] = useState<CustomTokenCardCreatorDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const result = await customTokenCardsClient.getMyCreatorProfile();
      if (!result.success) {
        setError(result.error);
      } else if (result.data) {
        setExisting(result.data);
        setForm(fromDTO(result.data));
      }
      setLoading(false);
    })();
  }, [user, authLoading]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    // Normalize empty strings to undefined so optional fields clear properly
    const sanitized = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, v === "" ? undefined : v]),
    ) as Partial<FormState>;

    const result = existing
      ? await customTokenCardsClient.updateMyCreatorProfile(sanitized)
      : await customTokenCardsClient.createMyCreatorProfile(sanitized as any);

    setSaving(false);
    if (!result.success) {
      toast({ title: "Save failed", description: result.error, variant: "destructive" });
      return;
    }
    setExisting(result.data);
    setForm(fromDTO(result.data));
    toast({ title: existing ? "Profile updated" : "Profile created" });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/portal/token-cards"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>My Token Cards</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Creator Profile
          </h1>
          <DarkModeToggle />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {authLoading || loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4" />
          </div>
        ) : !user ? (
          <Alert>
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              <Link href="/login" className="underline">Sign in</Link> to manage your creator profile.
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6">
            {existing && (
              <Alert>
                <AlertTitle>Public page</AlertTitle>
                <AlertDescription>
                  <Link
                    href={`/creators/${encodeURIComponent(existing.slug)}`}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    /creators/{existing.slug}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="displayName">Display name *</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                required
                maxLength={120}
              />
            </div>

            <div>
              <Label htmlFor="slug">
                Slug {existing ? "(change carefully — breaks existing links)" : "(auto-generated if blank)"}
              </Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="token-smith"
              />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500}
              />
            </div>

            <ImageUpload
              label="Avatar"
              description="Upload a square image or paste a URL"
              value={form.avatarUrl}
              onChange={(url) => set("avatarUrl", url)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
              Your linked Discord identity is used automatically — no need to re-enter it here.
            </p>

            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-4 border-t border-gray-300 dark:border-gray-700">
              Links
            </h2>

            {[
              ["websiteUrl", "Website"],
              ["shopUrl", "Shop (fallback buy URL)"],
              ["instagramUrl", "Instagram"],
              ["facebookUrl", "Facebook"],
              ["xUrl", "X / Twitter"],
              ["blueskyUrl", "Bluesky"],
              ["discordInviteUrl", "Discord server invite"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key as keyof FormState]}
                  onChange={(e) => set(key as keyof FormState, e.target.value)}
                />
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-300 dark:border-gray-700">
              <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : existing ? "Save changes" : "Create profile"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
