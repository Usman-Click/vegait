// ==============================================
// RateFlow — Clients Page
// Client management with CRUD operations
// ==============================================

import { ClientTable } from "@/components/dashboard/client-table";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Manage your clients, API keys, and rate limit configurations.
        </p>
      </div>
      <ClientTable />
    </div>
  );
}
