import { Search, UserRound, Tag, CheckCheck } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  getConversations,
  POLL_INTERVAL,
  type ConversationList,
  type InboxFilters,
  type Me,
} from "@/lib/inbox-api";
import { EmptyState, initials, time } from "./primitives";
export const listOptions = (filters: InboxFilters) => ({
  queryKey: ["conversations", filters],
  queryFn: ({ signal }: { signal: AbortSignal }) => getConversations(filters, signal),
  refetchInterval: POLL_INTERVAL,
  retry: false,
});
export function ListControls({
  filters,
  change,
  counts,
}: {
  filters: InboxFilters;
  change: (filters: Partial<InboxFilters>) => void;
  counts?: ConversationList["counts"];
}) {
  return (
    <div className="list-controls">
      <div className="list-title">
        <h3>
          المحادثات <small>{counts ? counts.open : "—"}</small>
        </h3>
        <select
          aria-label="حالة المحادثات"
          className="status-select"
          value={filters.status}
          onChange={(event) => change({ status: event.target.value as InboxFilters["status"] })}
        >
          <option value="open">المفتوحة</option>
          <option value="resolved">المنتهية</option>
          <option value="all">جميع الحالات</option>
        </select>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="البحث في المحادثات"
          placeholder="ابحث بالاسم أو الرقم أو الرسالة..."
          value={filters.q}
          onChange={(event) => change({ q: event.target.value })}
        />
      </label>
      <div className="filters">
        {(
          [
            ["all", "الكل", counts?.open],
            ["unassigned", "غير معيّن", counts?.unassigned],
            ["mine", "لي", counts?.mine],
          ] as const
        ).map(([value, label, count]) => (
          <Button
            variant="ghost"
            className="filter-button"
            key={value}
            aria-pressed={filters.filter === value}
            onClick={() => change({ filter: value })}
          >
            {label}
            {count !== undefined && <small>{count}</small>}
          </Button>
        ))}
      </div>
      <select
        className="mobile-category"
        aria-label="تصنيف المحادثات"
        value={filters.category}
        onChange={(event) => change({ category: event.target.value as InboxFilters["category"] })}
      >
        <option value="all">جميع التصنيفات</option>
        <option value="employee">موظف</option>
        <option value="client">عميل</option>
        <option value="government">جهة حكومية</option>
        <option value="general">عام</option>
      </select>
      <label className="label-filter">
        <Tag size={12} />
        <input
          aria-label="تصفية حسب الوسم"
          placeholder="تصفية حسب الوسم"
          value={filters.label}
          onChange={(event) => change({ label: event.target.value })}
        />
      </label>
    </div>
  );
}
export function ConversationItems({
  filters,
  selectedId,
  select,
  me,
}: {
  filters: InboxFilters;
  selectedId?: number | undefined;
  select: (id: number) => void;
  me: Me;
}) {
  const { data, error } = useSuspenseQuery(listOptions(filters));
  return (
    <>
      {error && (
        <div className="inline-error" role="alert">
          تعذّر تحديث القائمة. تظهر آخر بيانات متاحة.
        </div>
      )}
      <div className="conversation-list">
        {data.conversations.length === 0 ? (
          <EmptyState
            title="لا توجد محادثات"
            description="لا توجد محادثات مطابقة للفلاتر الحالية."
          />
        ) : (
          data.conversations.map((conversation) => (
            <Button
              variant="ghost"
              className="conversation-item"
              key={conversation.id}
              aria-current={selectedId === conversation.id ? "page" : undefined}
              onClick={() => select(conversation.id)}
            >
              <div className="conversation-row">
                <span
                  className={`avatar ${conversation.category === "employee" ? "employee" : ""}`}
                >
                  {initials(conversation.name || conversation.phone)}
                </span>
                <div className="conversation-copy">
                  <div className="conversation-name">
                    <strong>{conversation.name || conversation.phone}</strong>
                    <time>{time(conversation.last_message_at)}</time>
                  </div>
                  <div className="preview-row">
                    {conversation.last_direction === "out" && (
                      <CheckCheck size={13} className="text-muted-foreground" />
                    )}
                    <p>{conversation.last_preview}</p>
                    {conversation.unread_count > 0 && (
                      <span className="unread-badge">{conversation.unread_count}</span>
                    )}
                  </div>
                  <div className="conversation-badges">
                    <span className={`category-badge ${conversation.category}`}>
                      {me.contacts.category_ar[conversation.category]}
                    </span>
                    <span className="assignment-badge">
                      <UserRound size={10} />
                      {conversation.assigned_name ||
                        (conversation.assigned_employee_no
                          ? `موظف ${conversation.assigned_employee_no}`
                          : "غير معيّن")}
                    </span>
                    {conversation.labels?.slice(0, 1).map((label) => (
                      <span className="category-badge" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Button>
          ))
        )}
      </div>
    </>
  );
}
