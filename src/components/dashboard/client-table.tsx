// ==============================================
// RateFlow — Client Table + Row Actions
// Searchable, paginated client management table
// ==============================================

"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Key,
  Search,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import {
  useClients,
  useUpdateClient,
  useDeleteClient,
  useGenerateApiKey,
} from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { ClientForm } from "./client-form";

export function ClientTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    rateLimit: number;
    windowSeconds: number;
  } | null>(null);

  const pageSize = 10;
  const { data, isLoading } = useClients(page, pageSize, search);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const generateApiKey = useGenerateApiKey();
  const { toast } = useToast();

  /** Search on Enter key */
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      setSearch(searchInput);
      setPage(1);
    }
  }

  /** Toggle client active status */
  async function handleToggleActive(id: string, active: boolean) {
    try {
      await updateClient.mutateAsync({ id, active: !active });
      toast({
        title: active ? "Client disabled" : "Client enabled",
      });
    } catch {
      toast({ title: "Failed to update client", variant: "destructive" });
    }
  }

  /** Delete client with confirmation */
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return;
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client deleted" });
    } catch {
      toast({ title: "Failed to delete client", variant: "destructive" });
    }
  }

  /** Generate new API key */
  async function handleGenerateKey(id: string) {
    try {
      const result = await generateApiKey.mutateAsync(id);
      // Copy to clipboard
      await navigator.clipboard.writeText(result.key);
      toast({
        title: "New API key generated",
        description: "Copied to clipboard",
      });
    } catch {
      toast({ title: "Failed to generate key", variant: "destructive" });
    }
  }

  /** Copy API key to clipboard */
  async function handleCopyKey(key: string) {
    await navigator.clipboard.writeText(key);
    toast({ title: "API key copied to clipboard" });
  }

  /** Open edit form */
  function handleEdit(client: {
    id: string;
    name: string;
    rateLimit: number;
    windowSeconds: number;
  }) {
    setEditData(client);
    setFormOpen(true);
  }

  /** Open create form */
  function handleCreate() {
    setEditData(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Search + Create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="client-search"
            placeholder="Search clients..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Rate Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <Users className="h-10 w-10 text-muted-foreground/50 stroke-[1.5]" />
                    <h3 className="text-sm font-semibold text-foreground">No clients found</h3>
                    <p className="text-xs text-muted-foreground">
                      Create your first client to get started with API rate limiting.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map(
                (client: {
                  id: string;
                  name: string;
                  apiKey: string;
                  rateLimit: number;
                  windowSeconds: number;
                  active: boolean;
                }) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                          {client.apiKey.slice(0, 12)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopyKey(client.apiKey)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {client.rateLimit.toLocaleString()} / {client.windowSeconds}s
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={client.active}
                          onCheckedChange={() =>
                            handleToggleActive(client.id, client.active)
                          }
                        />
                        <Badge variant={client.active ? "success" : "secondary"}>
                          {client.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleGenerateKey(client.id)}
                          >
                            <Key className="h-4 w-4" />
                            New API Key
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              handleDelete(client.id, client.name)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editData={editData}
      />
    </div>
  );
}
