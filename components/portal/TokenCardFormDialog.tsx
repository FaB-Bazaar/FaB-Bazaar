"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { customTokenCardsClient } from "@/lib/client";
import { ImageUpload } from "@/components/ui/image-upload";
import { CardPickerInput } from "@/components/portal/CardPickerInput";
import type { CustomTokenCardDTO } from "@/lib/services/contracts/ICustomTokenCardService";

type FormState = {
  name: string;
  description: string;
  imageUrl: string;
  cardUniqueId: string;
  cardDisplayName: string;
  externalId: string;
  purchaseUrl: string;
  inStock: "unset" | "true" | "false";
  isPublished: boolean;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  imageUrl: "",
  cardUniqueId: "",
  cardDisplayName: "",
  externalId: "",
  purchaseUrl: "",
  inStock: "unset",
  isPublished: false,
};

function fromDTO(dto: CustomTokenCardDTO): FormState {
  return {
    name: dto.name,
    description: dto.description ?? "",
    imageUrl: dto.imageUrl ?? "",
    cardUniqueId: dto.cardUniqueId ?? "",
    cardDisplayName: dto.linkedCard?.displayName ?? "",
    externalId: dto.externalId ?? "",
    purchaseUrl: dto.purchaseUrl ?? "",
    inStock: dto.inStock === null ? "unset" : dto.inStock ? "true" : "false",
    isPublished: dto.isPublished,
  };
}

export function TokenCardFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CustomTokenCardDTO | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromDTO(editing) : EMPTY);
  }, [open, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload: Parameters<typeof customTokenCardsClient.createTokenCard>[0] = {
      name: form.name,
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      cardUniqueId: form.cardUniqueId || null,
      externalId: form.externalId || null,
      purchaseUrl: form.purchaseUrl || null,
      inStock: form.inStock === "unset" ? null : form.inStock === "true",
      isPublished: form.isPublished,
    };

    const result = editing
      ? await customTokenCardsClient.updateTokenCard(editing.id, payload)
      : await customTokenCardsClient.createTokenCard(payload);

    setSaving(false);
    if (!result.success) {
      toast({ title: "Save failed", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Token card updated" : "Token card created" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit token card" : "New token card"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <ImageUpload
            label="Token image"
            description="Upload a photo of your token or paste a URL"
            value={form.imageUrl}
            onChange={(url) => set("imageUrl", url)}
          />

          <CardPickerInput
            value={form.cardUniqueId || null}
            valueDisplayName={form.cardDisplayName || null}
            onChange={(id, displayName) => {
              setForm((prev) => ({
                ...prev,
                cardUniqueId: id ?? "",
                cardDisplayName: displayName ?? "",
              }));
            }}
          />

          <div>
            <Label htmlFor="externalId">External ID</Label>
            <Input id="externalId" value={form.externalId} onChange={(e) => set("externalId", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="purchaseUrl">Purchase URL</Label>
            <Input id="purchaseUrl" value={form.purchaseUrl} onChange={(e) => set("purchaseUrl", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="inStock">Stock status</Label>
            <select
              id="inStock"
              value={form.inStock}
              onChange={(e) => set("inStock", e.target.value as FormState["inStock"])}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="unset">Don't show (check my shop)</option>
              <option value="true">In stock</option>
              <option value="false">Out of stock</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isPublished"
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => set("isPublished", e.target.checked)}
            />
            <Label htmlFor="isPublished" className="cursor-pointer">
              Published (visible on my public page)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
