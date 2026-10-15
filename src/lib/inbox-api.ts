export type Category = "all" | "employee" | "client" | "government" | "general";
export type InboxFilters = {
  filter: "all" | "unassigned" | "mine";
  status: "open" | "resolved" | "all";
  category: Category;
  label: string;
  q: string;
};
export type Employee = { employee_no: string; full_name: string; last_seen_at?: string };
export type Me = {
  employee_no: string;
  name: string;
  email: string;
  super: boolean;
  gateway_admin: boolean;
  perms: Record<string, boolean>;
  portal_url: string;
  whatsapp_configured: boolean;
  signature: string;
  contacts: {
    categories: string[];
    category_ar: Record<string, string>;
    importance_ar: string[];
    wms_sync_enabled: boolean;
    ui_url: string;
  };
};
export type Conversation = {
  id: number;
  status: "open" | "resolved";
  assigned_employee_no: string | null;
  assigned_name: string | null;
  assigned_at?: string;
  labels: string[];
  unread_count: number;
  last_message_at: string;
  last_inbound_at?: string;
  last_direction: string;
  last_preview: string;
  resolved_at: string | null;
  created_at: string;
  contact_id: number;
  wa_id: string;
  phone: string;
  profile_name: string;
  display_name: string;
  contact_labels: string[];
  blocked: boolean;
  name: string;
  window_open: boolean;
  category: Exclude<Category, "all">;
  importance: number;
  company: string | null;
  client_name: string | null;
  registered: boolean;
  registered_via: string;
  notify_opt_out: boolean;
  contacts_url: string;
};
export type Media = {
  id: number;
  mime_type: string;
  filename: string | null;
  file_size: number;
  status: "pending" | "done" | "failed";
};
export type Message = {
  id: number;
  wa_message_id?: string;
  direction: "in" | "out";
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "location"
    | "contacts"
    | "reaction"
    | "interactive"
    | "button"
    | "order"
    | "system"
    | "template"
    | "unknown";
  body: string | null;
  status: string;
  status_at?: string;
  error?: string | { message?: string; code?: number } | null;
  template_name?: string | null;
  sent_by_no?: string | null;
  sent_by_name?: string | null;
  wa_timestamp?: string;
  created_at?: string;
  media?: Media[];
  views?: { employee_no: string; employee_name: string; viewed_at: string }[];
};
export type Note = {
  id: number;
  employee_no: string;
  employee_name: string;
  body: string;
  created_at: string;
};
export type Contact = {
  id: number;
  wa_id: string;
  phone: string;
  display_name: string;
  company: string | null;
  notes: string | null;
  labels: string[];
  blocked: boolean;
  category: Exclude<Category, "all">;
  importance: number;
  registered: boolean;
  registered_via: string;
  contacts_url: string;
  last_seen_at: string;
  created_at: string;
};
export type Detail = {
  conversation: Conversation;
  messages: Message[];
  notes?: Note[];
  assignments: {
    id: number;
    employee_no: string;
    employee_name: string;
    assigned_by_no: string;
    assigned_by_name: string;
    assigned_at: string;
  }[];
  contact?: Contact;
  has_more: boolean;
};
export type ConversationList = {
  conversations: Conversation[];
  counts: { open: number; unassigned: number; mine: number; unread: number };
  category_counts: Record<Category, { open: number; unread: number }>;
  server_now: string;
};
export const POLL_INTERVAL = 12_000;
export const DEFAULT_FILTERS: InboxFilters = {
  filter: "all",
  status: "open",
  category: "all",
  label: "",
  q: "",
};
export function parseFilters(search: Record<string, unknown>): InboxFilters {
  return {
    filter:
      search["filter"] === "mine" || search["filter"] === "unassigned" ? search["filter"] : "all",
    status:
      search["status"] === "resolved" || search["status"] === "all" ? search["status"] : "open",
    category: ["employee", "client", "government", "general"].includes(String(search["category"]))
      ? (search["category"] as Category)
      : "all",
    label: typeof search["label"] === "string" ? search["label"] : "",
    q: typeof search["q"] === "string" ? search["q"] : "",
  };
}
export function can(me: Pick<Me, "perms">, key: string) {
  return me.perms[key] === true;
}
export function canReply(me: Pick<Me, "perms">, conversation: Pick<Conversation, "window_open">) {
  return can(me, "whatsapp.inbox.reply") && conversation.window_open;
}
export function listPath(filters: InboxFilters, limit = 100) {
  const params = new URLSearchParams({
    ...filters,
    limit: String(Math.min(300, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 100))),
  });
  return `/api/conversations?${params}`;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: {
      error?: string;
      login?: string;
      window_closed?: boolean;
      required?: string;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function redirectSession(
  status: number,
  body: { login?: string },
  redirect: (url: string) => void,
) {
  if (status === 401 && typeof body.login === "string" && body.login) redirect(body.login);
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "تعذّر الوصول إلى خدمة واتساب ديتيلز. يرجى المحاولة مجددًا.",
      response.status,
    );
  }
  if (!response.ok) {
    redirectSession(response.status, body, (url) => window.location.assign(url));
    throw new ApiError(
      body.error || "تعذّر إتمام الطلب. يرجى المحاولة مجددًا.",
      response.status,
      body,
    );
  }
  return body as T;
}
export const getMe = () => api<Me>("/api/me");
export const getConversations = (filters: InboxFilters, signal?: AbortSignal) =>
  api<ConversationList>(listPath(filters), { signal: signal ?? null });
export const getDetail = (id: number, before?: number, signal?: AbortSignal) =>
  api<Detail>(`/api/conversations/${id}${before === undefined ? "" : `?before=${before}`}`, {
    signal: signal ?? null,
  });
export const getEmployees = () => api<{ employees: Employee[] }>("/api/employees");
export const reply = (id: number, text: string, reply_to?: string) =>
  api<{ ok: true; id: number; wa_message_id: string; text: string; signed: boolean }>(
    `/api/conversations/${id}/reply`,
    { method: "POST", body: JSON.stringify({ text, ...(reply_to ? { reply_to } : {}) }) },
  );
export const assign = (id: number, employee: Employee | null) =>
  api<{ ok: true; assigned_employee_no: string | null; assigned_name: string | null }>(
    `/api/conversations/${id}/assign`,
    {
      method: "POST",
      body: JSON.stringify(
        employee
          ? { employee_no: employee.employee_no, employee_name: employee.full_name }
          : { employee_no: null },
      ),
    },
  );
export const setStatus = (id: number, status: "open" | "resolved") =>
  api<{ ok: true; status: "open" | "resolved" }>(`/api/conversations/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
export const mediaPath = (id: number) => `/api/media/${id}`;
