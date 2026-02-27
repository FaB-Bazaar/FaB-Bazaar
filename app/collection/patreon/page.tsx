// app/collection/patreon/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Lock, Star } from "lucide-react";
import Link from "next/link";

// --- UPDATED: More defensive StackedBinderCard ---
const StackedBinderCard = ({ binder }: { binder: any }) => {
  // Guard against `binder.cards` not being an array
  const totalQuantity = Array.isArray(binder?.cards) 
    ? binder.cards.reduce((sum: number, cardGroup: any) => sum + (cardGroup.stack?.length || 0), 0)
    : 0;

  const uniquePrintings = Array.isArray(binder?.cards) ? binder.cards.length : 0;

  return (
    <Link href={`/inventory/${binder._id}`}>
      <Card className="h-full flex flex-col hover:border-primary hover:shadow-lg transition-all cursor-pointer">
        <CardHeader>
          <CardTitle className="truncate">{binder.name || "Untitled Binder"}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-end">
          <div className="text-sm text-muted-foreground">
            <p>{uniquePrintings} Unique Printings</p>
            <p>{totalQuantity} Total Cards</p>
          </div>
          {binder.slug && <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted rounded px-2 py-1 inline-block">{binder.slug}</p>}
        </CardContent>
      </Card>
    </Link>
  );
};

export default function PatreonCollectionPage() {
  const [user, setUser] = useState<any>(null);
  const [stackedBinders, setStackedBinders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  const [newBinderName, setNewBinderName] = useState("");
  const [newBinderSlug, setNewBinderSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        console.group("Patreon Page - Server-Side Auth Check");
        
        // Fetch user data from /api/auth/me for UI purposes
        const userResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        
        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            setIsAuthorized(false);
            setError("You must be logged in to access this page.");
            return;
          }
          throw new Error('Failed to fetch user data');
        }
        
        const userData = await userResponse.json();
        console.log("User data from /api/auth/me:", userData);
        
        if (!userData.success || !userData.user) {
          setIsAuthorized(false);
          setError("You must be logged in to access this page.");
          return;
        }
        
        setUser(userData.user);
        
        // Let the server validate Patreon status - fetch stacked binders
        // The server will return 403 if user is not a Patron
        const bindersResponse = await fetch(`/api/users/${userData.user.id}/stackedbinders`, {
          credentials: 'include',
        });
        
        console.log("Stacked binders response status:", bindersResponse.status);
        
        if (!bindersResponse.ok) {
          if (bindersResponse.status === 403) {
            setIsAuthorized(false);
            setError("This is a premium feature available only to Patreon supporters.");
            return;
          } else if (bindersResponse.status === 401) {
            setIsAuthorized(false);
            setError("You must be logged in to access this page.");
            return;
          }
          throw new Error("Failed to fetch inventory data.");
        }
        
        const bindersData = await bindersResponse.json();
        console.log("Binders data:", bindersData);
        
        if (bindersData.success) {
          // If we got here, the server validated Patreon status
          setIsAuthorized(true);
          setStackedBinders(bindersData.binders || []);
        } else {
          throw new Error(bindersData.error || "An unknown error occurred.");
        }
        
      } catch (err: any) {
        console.error("Error in checkAuthAndFetchData:", err);
        setError(err.message || "Failed to load page data.");
        if (isAuthorized === null) {
          setIsAuthorized(false);
        }
      } finally {
        setLoading(false);
        console.groupEnd();
      }
    };

    checkAuthAndFetchData();
  }, []); // Empty dependency array - only run once on mount

  const handleCreateBinder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBinderName.trim() || creating) return;
    
    setCreating(true);
    setSlugError(null);
    
    try {
      const res = await fetch(`/api/users/${user.id}/stackedbinders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBinderName, slug: newBinderSlug || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create inventory.");
      setStackedBinders(prev => [...prev, data.binder]);
      setNewBinderName("");
      setNewBinderSlug("");
    } catch (err: any) {
      setSlugError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // --- RENDER LOGIC ---

  // Show a loading screen while checking auth and fetching data
  if (loading || isAuthorized === null) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show the "Access Denied" screen if not authorized
  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-12 text-center max-w-2xl">
        <Card className="p-8">
          <Lock className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">{error || "An error occurred."}</p>
          <Button asChild>
            <Link href="/patreon-signup">
              <Star className="mr-2 h-4 w-4" />
              Become a Patron
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  // If authorized, show the page content
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <h1 className="text-3xl font-bold">Pro Inventory</h1>
        <p className="text-muted-foreground mt-1 md:mt-0">Manage your itemized collection.</p>
      </div>

      <Card className="mb-8">
        <CardHeader><CardTitle>Create New Inventory Binder</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBinder} className="flex flex-col sm:flex-row gap-4">
            <Input placeholder="Inventory Name (e.g., Graded Slabs)" value={newBinderName} onChange={e => setNewBinderName(e.target.value)} required className="flex-grow" />
            <Input placeholder="URL Slug (optional)" value={newBinderSlug} onChange={e => setNewBinderSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="sm:w-1/3" />
            <Button type="submit" disabled={creating} className="sm:w-auto">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </form>
          {slugError && <p className="text-destructive text-sm mt-2">{slugError}</p>}
        </CardContent>
      </Card>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Inventories</h2>
        {stackedBinders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stackedBinders.map(binder => (
              <StackedBinderCard key={binder._id} binder={binder} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">You haven't created any Pro Inventory binders yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}