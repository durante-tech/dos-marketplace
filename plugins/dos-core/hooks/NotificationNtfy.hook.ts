#!/usr/bin/env bun
/**
 * NotificationNtfy.hook.ts — forward Claude Code Notification events to ntfy.
 *
 * Trigger: Notification (fires when Claude Code surfaces a notification —
 * permission prompts, idle nudges, etc.).
 *
 * This wires the DORMANT, settings-gated ntfy push already implemented in
 * hooks/lib/notifications.ts (`sendPush`). That lib was complete but nothing
 * triggered it. This hook is the trigger: it parses the Notification payload
 * and forwards title/message through `sendPush`, which reads the gate from
 * settings.json → notifications.ntfy ({ enabled, topic, server }). When the
 * gate is absent/disabled (the default — settings ships `"ntfy": {}`), sendPush
 * returns immediately without a network call, so this hook stays a no-op until
 * an operator opts in.
 *
 * SAFETY: trivial-fast + fail-open. Any error (bad payload, lib throw) is
 * swallowed and the hook exits 0. Notification is a non-blockable event, so the
 * exit code carries no gating weight. Register with `async: true` so the push
 * never sits on Claude's critical path.
 *
 * SCHEMA: the Notification payload carries the notification `message`; `title`
 * is optional (defaults to "Claude Code"). `notification_type` (the matcher key)
 * is accepted but not required.
 */

import { sendPush } from "./lib/notifications";
import { loadProjectEnv } from "./lib/paths";
import { readHookInput } from "./lib/hook-io";

export interface NotificationEventInput {
  session_id?: string;
  hook_event_name?: string;
  message?: string;
  title?: string;
  notification_type?: string;
}

export interface ParsedNotification {
  title: string;
  message: string;
}

/**
 * Extract the (title, message) pair from a Notification payload. Missing or
 * blank title falls back to "Claude Code"; missing message becomes "".
 */
export function extractNotification(input: NotificationEventInput | null | undefined): ParsedNotification {
  const message = typeof input?.message === "string" ? input.message : "";
  const title =
    typeof input?.title === "string" && input.title.trim() ? input.title : "Claude Code";
  return { title, message };
}

if (import.meta.main) {
  (async () => {
    try {
      loadProjectEnv();
      const input = (await readHookInput()) as NotificationEventInput | null;
      const { title, message } = extractNotification(input);
      if (message.trim()) {
        // sendPush is self-gating: no-op + false return when ntfy is disabled.
        await sendPush(message, { title, priority: "default", tags: ["bell"] });
      }
    } catch {
      // fail-open — a notification hook must never disrupt the session
    }
    process.exit(0);
  })();
}
