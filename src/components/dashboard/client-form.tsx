// ==============================================
// RateFlow — Client Form Dialog
// Create / Edit client modal
// ==============================================

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { RATE_LIMIT_PRESETS } from "@/lib/constants";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the form is in edit mode */
  editData?: {
    id: string;
    name: string;
    rateLimit: number;
    windowSeconds: number;
  } | null;
}

export function ClientForm({ open, onOpenChange, editData }: ClientFormProps) {
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(100);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [preset, setPreset] = useState("basic");

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { toast } = useToast();

  const isEditing = !!editData;

  // Populate form when editing
  useEffect(() => {
    if (editData) {
      setName(editData.name);
      setRateLimit(editData.rateLimit);
      setWindowSeconds(editData.windowSeconds);
      setPreset("custom");
    } else {
      setName("");
      setRateLimit(100);
      setWindowSeconds(60);
      setPreset("basic");
    }
  }, [editData, open]);

  /** Apply a rate limit preset */
  function handlePresetChange(value: string) {
    setPreset(value);
    if (value !== "custom") {
      const p = RATE_LIMIT_PRESETS[value as keyof typeof RATE_LIMIT_PRESETS];
      setRateLimit(p.rateLimit);
      setWindowSeconds(p.windowSeconds);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (isEditing) {
        await updateClient.mutateAsync({
          id: editData!.id,
          name,
          rateLimit,
          windowSeconds,
        });
        toast({ title: "Client updated", variant: "default" });
      } else {
        await createClient.mutateAsync({ name, rateLimit, windowSeconds });
        toast({ title: "Client created", variant: "default" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Client" : "Create Client"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the client configuration."
              : "Add a new client with rate limit settings."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              placeholder="e.g., Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Rate Limit Preset */}
          <div className="space-y-2">
            <Label>Rate Limit Preset</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic — 100 req/min</SelectItem>
                <SelectItem value="pro">Pro — 1,000 req/min</SelectItem>
                <SelectItem value="enterprise">
                  Enterprise — 5,000 req/min
                </SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Rate Limit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate-limit">Max Requests</Label>
              <Input
                id="rate-limit"
                type="number"
                min={1}
                max={100000}
                value={rateLimit}
                onChange={(e) => {
                  setRateLimit(parseInt(e.target.value) || 1);
                  setPreset("custom");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window">Window (seconds)</Label>
              <Input
                id="window"
                type="number"
                min={1}
                max={86400}
                value={windowSeconds}
                onChange={(e) => {
                  setWindowSeconds(parseInt(e.target.value) || 1);
                  setPreset("custom");
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
