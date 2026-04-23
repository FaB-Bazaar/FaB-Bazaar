"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, UserCircle, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { customTokenCardsClient } from "@/lib/client";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { TokenCardFormDialog } from "@/components/portal/TokenCardFormDialog";
import type {
  CustomTokenCardDTO,
  CustomTokenCardCreatorDTO,
} from "@/lib/services/contracts/ICustomTokenCardService";

export default function PortalTokenCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [creator, setCreator] = useState<CustomTokenCardCreatorDTO | null>(null);
  const [tokenCards, setTokenCards] = useState<CustomTokenCardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomTokenCardDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTokenCardDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const [profile, cards] = await Promise.all([
      customTokenCardsClient.getMyCreatorProfile(),
      customTokenCardsClient.listMyTokenCards(),
    ]);
    if (!profile.success) {
      setError(profile.error);
      setLoading(false);
      return;
    }
    setCreator(profile.data);
    if (cards.success) setTokenCards(cards.data);
    else if (cards.error !== "Creator profile not found — create one first") setError(cards.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    refresh();
  }, [user, authLoading, refresh]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await customTokenCardsClient.deleteTokenCard(deleteTarget.id);
    setDeleting(false);
    if (!result.success) {
      toast({ title: "Delete failed", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: `Deleted "${deleteTarget.name}"` });
    setDeleteTarget(null);
    refresh();
  };

  const togglePublish = async (tc: CustomTokenCardDTO) => {
    const result = await customTokenCardsClient.updateTokenCard(tc.id, { isPublished: !tc.isPublished });
    if (!result.success) {
      toast({ title: "Update failed", description: result.error, variant: "destructive" });
      return;
    }
    setTokenCards((prev) => prev.map((x) => (x.id === tc.id ? result.data : x)));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/portal/creator-profile"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 transition-all"
          >
            <UserCircle className="h-4 w-4" />
            <span>Profile</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            My Token Cards
          </h1>
          <DarkModeToggle />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {authLoading || loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4" />
          </div>
        ) : !user ? (
          <Alert>
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              <Link href="/login" className="underline">Sign in</Link> to manage your token cards.
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !creator ? (
          <Alert>
            <AlertTitle>Create your creator profile first</AlertTitle>
            <AlertDescription className="mt-2">
              <Link
                href="/portal/creator-profile"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white text-sm"
              >
                Set up profile
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tokenCards.length} token card{tokenCards.length === 1 ? "" : "s"}
              </p>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                <Plus className="h-4 w-4 mr-1" />
                New token card
              </Button>
            </div>

            {tokenCards.length === 0 ? (
              <div className="text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
                <Package className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No token cards yet — create your first one.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">Represents</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenCards.map((tc) => (
                      <tr key={tc.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          <div className="font-medium">{tc.name}</div>
                          {tc.inStock !== null && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {tc.inStock ? "In stock" : "Out of stock"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                          {tc.linkedCard?.displayName ?? <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePublish(tc)}
                            title="Click to toggle"
                            className="cursor-pointer"
                          >
                            <Badge
                              variant="secondary"
                              className={
                                tc.isPublished
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }
                            >
                              {tc.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(tc);
                                setFormOpen(true);
                              }}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(tc)}
                              aria-label="Delete"
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <TokenCardFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this token card?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `"${deleteTarget.name}" will be removed permanently. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
