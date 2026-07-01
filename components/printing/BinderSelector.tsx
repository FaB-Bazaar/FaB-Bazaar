// components/printing/BinderSelector.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Package, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { bindersClient } from "@/lib/client";

interface Binder {
  _id: string;
  name: string;
  slug: string;
  isPublic: boolean;
}

interface BinderSelectorProps {
  printingId: string;
  cardName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BinderSelector({ printingId, cardName, onSuccess, onCancel }: BinderSelectorProps) {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchBinders();
  }, []);

  const fetchBinders = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await bindersClient.getUserBinders();

      if (result.success) {
        setBinders(result.data.binders || []);
      } else {
        throw new Error(result.error || 'Failed to fetch binders');
      }
    } catch (err: any) {
      console.error('Error fetching binders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBinder = async (binderId: string, binderName: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to add cards to your collection.",
        variant: "destructive"
      });
      return;
    }

    try {
      setAdding(binderId);

      const result = await bindersClient.addCardsToBinder(binderId, [{
        printingId: printingId,
        quantity: 1,
        condition: 'NM',
        notes: `Added from card details page`
      }]);

      if (result.success) {
        toast({
          title: "Added to collection!",
          description: `${cardName} was added to ${binderName}.`,
          variant: "default"
        });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.error || 'Failed to add card to binder');
      }
    } catch (error: any) {
      console.error('Error adding card to binder:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add card to collection.",
        variant: "destructive"
      });
    } finally {
      setAdding(null);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-3">
            <Package className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold">Add to Collection</h3>
              <p className="text-sm text-muted-foreground">Please log in to add cards to your collection.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-3">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your binders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-3">
            <div className="text-red-500">
              <p className="text-sm font-medium">Failed to load binders</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBinders}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (binders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-3">
            <Package className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold">No Binders Found</h3>
              <p className="text-sm text-muted-foreground">Create a binder first to add cards to your collection.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/collection">Go to Collection</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Add to Collection</h3>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Choose a binder to add <strong>{cardName}</strong>:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {binders.map((binder) => (
              <div
                key={binder._id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{binder.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant={binder.isPublic ? "default" : "secondary"} className="text-xs">
                        {binder.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleAddToBinder(binder._id, binder.name)}
                  disabled={adding === binder._id}
                  className="flex-shrink-0"
                >
                  {adding === binder._id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
