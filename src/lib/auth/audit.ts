import { adminRest } from "@/lib/supabase/rest";
import type { Json } from "@/lib/types/database";

export async function writeAuditLog(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: Json;
  newValue?: Json;
}): Promise<void> {
  try {
    await adminRest("audit_logs", {
      method: "POST",
      prefer: "return=minimal",
      body: [
        {
          actor_id: params.actorId ?? null,
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId ?? null,
          previous_value: params.previousValue ?? null,
          new_value: params.newValue ?? null,
        },
      ],
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}
