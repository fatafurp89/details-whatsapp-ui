import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import inboxMark from "@/assets/inbox-mark.svg";
export class InboxBoundary extends Component<
  { children: ReactNode; fallback: (error: Error, reset: () => void) => ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error
      ? this.props.fallback(this.state.error, () => this.setState({ error: null }))
      : this.props.children;
  }
}
export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <span className="empty-icon error-icon">
        <AlertCircle size={28} />
      </span>
      <h3>تعذّر تحميل البيانات</h3>
      <p>{error.message}</p>
      <Button variant="outline" onClick={retry}>
        <RefreshCw />
        إعادة المحاولة
      </Button>
    </div>
  );
}
export function EmptyState({
  title = "محادثاتك، في مكان واحد",
  description = "اختر محادثة من القائمة لعرض الرسائل ومتابعة التواصل.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <img src={inboxMark} alt="" className="inbox-illustration" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Loading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "loading-list" : "loading-view"}
      aria-label="جارٍ تحميل المحادثات"
      role="status"
    >
      {Array.from({ length: compact ? 6 : 3 }, (_, i) => (
        <div className="skeleton-line" key={i}>
          <span />
          <div>
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}
export function time(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}
export function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("ar-SA", {
        calendar: "gregory",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}
