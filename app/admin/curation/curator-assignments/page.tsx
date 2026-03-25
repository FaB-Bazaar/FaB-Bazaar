"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getHeroesGroupedByClass } from '@/lib/fab-constants';

interface Assignment {
  userId: string;
  heroName: string;
  metafyProductUrl: string | null;
  metafyLinkLabel: string | null;
  username: string;
  displayUsername: string;
  avatarUrl: string | null;
}

interface UserSearchResult {
  _id: string;
  username: string;
  discordUsername: string | null;
}

function toDisplayName(name: string): string {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

export default function CuratorAssignmentsPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // New assignment form
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedHero, setSelectedHero] = useState('');
  const [metafyUrl, setMetafyUrl] = useState('');
  const [metafyLabel, setMetafyLabel] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Inline edit
  const [editingKey, setEditingKey] = useState<string | null>(null); // `${userId}:${heroName}`
  const [editUrl, setEditUrl] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const heroesGrouped = useMemo(() => getHeroesGroupedByClass(), []);
  const allHeroes = useMemo(() =>
    Object.values(heroesGrouped).flat().sort(),
  [heroesGrouped]);

  useEffect(() => {
    fetch('/api/admin/curator-heroes')
      .then(r => r.json())
      .then(data => {
        if (data.success) setAssignments(data.data);
        else toast({ title: 'Error', description: data.error, variant: 'destructive' });
      })
      .catch(() => toast({ title: 'Error', description: 'Failed to load assignments', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userSearch.trim()) { setUserResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`);
        const data = await res.json();
        if (data.success) setUserResults(data.users ?? []);
      } catch { /* ignore */ } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch]);

  const handleAssign = async () => {
    if (!selectedUser || !selectedHero) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/curator-heroes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser._id,
          heroName: selectedHero,
          metafyProductUrl: metafyUrl || null,
          metafyLinkLabel: metafyLabel || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Assigned', description: `${selectedUser.username} → ${selectedHero}` });
        setAssignments(prev => [...prev.filter(a => !(a.userId === selectedUser._id && a.heroName === selectedHero)), {
          userId: selectedUser._id,
          heroName: selectedHero,
          metafyProductUrl: metafyUrl || null,
          metafyLinkLabel: metafyLabel || null,
          username: selectedUser.username,
          displayUsername: selectedUser.discordUsername ?? selectedUser.username,
          avatarUrl: null,
        }]);
        setSelectedUser(null);
        setSelectedHero('');
        setMetafyUrl('');
        setMetafyLabel('');
        setUserSearch('');
        setUserResults([]);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (userId: string, heroName: string, displayName: string) => {
    const res = await fetch('/api/admin/curator-heroes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, heroName }),
    });
    const data = await res.json();
    if (data.success) {
      setAssignments(prev => prev.filter(a => !(a.userId === userId && a.heroName === heroName)));
      toast({ title: 'Removed', description: `${displayName} removed from ${heroName}` });
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (userId: string, heroName: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/curator-heroes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          heroName,
          metafyProductUrl: editUrl || null,
          metafyLinkLabel: editLabel || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(prev => prev.map(a =>
          a.userId === userId && a.heroName === heroName
            ? { ...a, metafyProductUrl: editUrl || null, metafyLinkLabel: editLabel || null }
            : a
        ));
        setEditingKey(null);
        toast({ title: 'Saved' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/curation" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Curator Assignments</h1>
      </div>

      {/* New assignment form */}
      <div className="rounded-lg border border-border p-5 mb-8 space-y-4">
        <h2 className="font-semibold text-base">Assign Curator to Hero</h2>

        <div className="space-y-1.5">
          <Label>Curator (search by username)</Label>
          <div className="relative">
            <Input
              value={selectedUser ? (selectedUser.discordUsername ?? selectedUser.username) : userSearch}
              onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
              placeholder="Search curators..."
            />
            {searchingUsers && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {!selectedUser && userResults.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              {userResults.map(u => (
                <button
                  key={u._id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2"
                  onClick={() => { setSelectedUser(u); setUserSearch(''); setUserResults([]); }}
                >
                  <span>{u.username}</span>
                  {u.discordUsername && <span className="text-muted-foreground text-xs">({u.discordUsername})</span>}
                </button>
              ))}
            </div>
          )}
          {selectedUser && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
              <span className="font-medium">{selectedUser.username}</span>
              <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedUser(null)}>
                change
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Hero</Label>
          <Select value={selectedHero} onValueChange={setSelectedHero}>
            <SelectTrigger>
              <SelectValue placeholder="Select hero" />
            </SelectTrigger>
            <SelectContent>
              {allHeroes.map(h => (
                <SelectItem key={h} value={h}>{toDisplayName(h)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Metafy Product URL (optional)</Label>
            <Input
              value={metafyUrl}
              onChange={e => setMetafyUrl(e.target.value)}
              placeholder="https://metafy.gg/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link label (optional)</Label>
            <Input
              value={metafyLabel}
              onChange={e => setMetafyLabel(e.target.value)}
              placeholder="e.g. New Maxx content this week!"
            />
          </div>
        </div>

        <Button onClick={handleAssign} disabled={!selectedUser || !selectedHero || assigning}>
          {assigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Assign
        </Button>
      </div>

      {/* Assignments table */}
      {assignments.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">No assignments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted-foreground">Curator</th>
                <th className="pb-3 font-medium text-muted-foreground">Hero</th>
                <th className="pb-3 font-medium text-muted-foreground">Metafy Guide</th>
                <th className="pb-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const key = `${a.userId}:${a.heroName}`;
                const isEditing = editingKey === key;
                return (
                  <tr key={key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {a.avatarUrl && <img src={a.avatarUrl} className="h-7 w-7 rounded-full" alt="" />}
                        <span className="font-medium">{a.displayUsername}</span>
                      </div>
                    </td>
                    <td className="py-3">{toDisplayName(a.heroName)}</td>
                    <td className="py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            className="h-7 text-xs"
                            value={editUrl}
                            onChange={e => setEditUrl(e.target.value)}
                            placeholder="https://metafy.gg/..."
                          />
                          <Input
                            className="h-7 text-xs"
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            placeholder="Link label (optional)"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveEdit(a.userId, a.heroName)} disabled={savingEdit}>
                              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingKey(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="flex flex-col gap-0.5 text-xs text-muted-foreground hover:text-foreground text-left"
                          onClick={() => { setEditingKey(key); setEditUrl(a.metafyProductUrl ?? ''); setEditLabel(a.metafyLinkLabel ?? ''); }}
                        >
                          {a.metafyProductUrl ? (
                            <>
                              <span className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="max-w-48 truncate">{a.metafyProductUrl}</span>
                              </span>
                              {a.metafyLinkLabel && (
                                <span className="text-muted-foreground/70 italic ml-4">{a.metafyLinkLabel}</span>
                              )}
                            </>
                          ) : (
                            <span className="italic">click to add link</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleUnassign(a.userId, a.heroName, a.displayUsername)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
