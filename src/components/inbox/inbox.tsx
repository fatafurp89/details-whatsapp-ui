import { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  BriefcaseBusiness,
  Circle,
  Filter,
  Inbox,
  MessageCircle,
  RefreshCw,
  Users,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, getMe, type Category, type InboxFilters, type Me } from "@/lib/inbox-api";
import { ConversationItems, ListControls, listOptions } from "./conversation-list";
import { ConversationDetail } from "./conversation-detail";
import { EmptyState, ErrorState, InboxBoundary, initials, Loading } from "./primitives";
type Props = {
  filters: InboxFilters;
  change: (filters: Partial<InboxFilters>) => void;
  selectedId?: number | undefined;
  select: (id: number) => void;
  back: () => void;
};
function Topbar({ me }: { me?: Me }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <MessageCircle size={26} />
        </div>
        <div>
          <h1>واتساب ديتيلز</h1>
          <p>صندوق محادثات الشركة</p>
        </div>
      </div>
      <div className="topbar-actions">
        {me && (
          <div className="employee-profile">
            <span className="avatar employee">{initials(me.name)}</span>
            <div>
              <strong>{me.name}</strong>
              <small>
                الرقم الوظيفي: <span dir="ltr">{me.employee_no}</span>
              </small>
            </div>
          </div>
        )}
        <Button asChild variant="outline" className="portal-button text-xs">
          <a href="https://details-wms.cloud/" aria-label="بوابة ديتيلز">
            <span>بوابة ديتيلز</span>
            <ArrowUpRight />
          </a>
        </Button>
      </div>
    </header>
  );
}
const categoryItems: { value: Category; label: string; icon: typeof Users }[] = [
  { value: "all", label: "جميع التصنيفات", icon: Circle },
  { value: "employee", label: "الموظفون", icon: UserRound },
  { value: "client", label: "العملاء", icon: BriefcaseBusiness },
  { value: "government", label: "الجهات الحكومية", icon: Building2 },
  { value: "general", label: "عام", icon: Users },
];
function Navigation({
  filters,
  change,
  counts,
  categoryCounts,
  allowed = true,
}: {
  filters: InboxFilters;
  change: Props["change"];
  counts?: { open: number };
  categoryCounts?: Record<Category, { open: number; unread: number }>;
  allowed?: boolean;
}) {
  return (
    <aside className="navigation">
      <p className="workspace-label">مساحة العمل</p>
      {allowed && (
        <>
          <div className="nav-active">
            <span>
              <Inbox size={18} />
              صندوق المحادثات
            </span>
            <small className="count">{counts?.open ?? "—"}</small>
          </div>
          <div className="nav-divider" />
          <p className="nav-heading">
            <Filter size={12} />
            تصنيف جهات الاتصال
          </p>
          {categoryItems.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant="ghost"
              className="category-button"
              aria-pressed={filters.category === value}
              onClick={() => change({ category: value })}
            >
              <span>
                <Icon size={15} />
                {label}
              </span>
              <small>{categoryCounts?.[value]?.open ?? "—"}</small>
            </Button>
          ))}
        </>
      )}
      <div className="nav-footer">
        <strong>
          ديتيلز<span> ·</span>
        </strong>
        <p>تواصل أفضل، تفاصيل أدق.</p>
      </div>
    </aside>
  );
}
function Heading({ refresh, live = false }: { refresh?: () => void; live?: boolean }) {
  return (
    <div className="page-heading">
      <div>
        <h2>صندوق المحادثات</h2>
        <p>كل محادثة، بداية لتواصل أفضل.</p>
      </div>
      <div className="live-label">
        {live && (
          <>
            <i className="live-dot" />
            تحديث تلقائي
          </>
        )}
        {refresh && (
          <Button
            variant="ghost"
            size="icon"
            title="تحديث المحادثات"
            aria-label="تحديث المحادثات"
            onClick={refresh}
          >
            <RefreshCw size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}
function DataWorkspace(props: Props & { me: Me }) {
  const { data, isFetching } = useSuspenseQuery(listOptions(props.filters));
  const query = useQueryClient();
  const { reset } = useQueryErrorResetBoundary();
  return (
    <>
      <Navigation
        filters={props.filters}
        change={props.change}
        counts={data.counts}
        categoryCounts={data.category_counts}
      />
      <main className="inbox-main">
        <Heading
          live
          refresh={() => void query.invalidateQueries({ queryKey: ["conversations"] })}
        />
        <div className="inbox-frame">
          <section className="conversations-pane" aria-label="قائمة المحادثات">
            <ListControls filters={props.filters} change={props.change} counts={data.counts} />
            <ConversationItems {...props} />
          </section>
          <section className="conversation-content" aria-label="تفاصيل المحادثة">
            {props.selectedId ? (
              <InboxBoundary
                key={props.selectedId}
                fallback={(error, retry) => (
                  <>
                    <Button
                      variant="ghost"
                      className="mobile-back m-3"
                      onClick={props.back}
                      aria-label="العودة إلى المحادثات"
                    >
                      <ArrowUpRight />
                    </Button>
                    <ErrorState
                      error={error}
                      retry={() => {
                        reset();
                        retry();
                      }}
                    />
                  </>
                )}
              >
                <Suspense fallback={<Loading />}>
                  <ConversationDetail
                    key={props.selectedId}
                    id={props.selectedId}
                    me={props.me}
                    back={props.back}
                  />
                </Suspense>
              </InboxBoundary>
            ) : (
              <EmptyState />
            )}
          </section>
        </div>
        <div className="footer-bar">
          <span>واتساب ديتيلز · صندوق محادثات الشركة</span>
          <span>
            {isFetching ? "جارٍ تحديث المحادثات…" : `${data.conversations.length} محادثة معروضة`}
          </span>
        </div>
      </main>
    </>
  );
}
function WorkspaceFallback(props: Props & { error?: Error; retry?: () => void; me?: Me }) {
  return (
    <>
      <Navigation filters={props.filters} change={props.change} />
      <main className="inbox-main">
        <Heading />
        <div className="inbox-frame">
          <section className="conversations-pane" aria-label="قائمة المحادثات">
            <ListControls filters={props.filters} change={props.change} />
            {props.error ? (
              <ErrorState error={props.error} retry={props.retry || (() => {})} />
            ) : (
              <Loading compact />
            )}
          </section>
          <section className="conversation-content">
            <EmptyState />
          </section>
        </div>
        <div className="footer-bar">
          <span>واتساب ديتيلز · صندوق محادثات الشركة</span>
          <span>اتصال آمن عبر بوابة ديتيلز</span>
        </div>
      </main>
    </>
  );
}
function AuthorizedApp(props: Props) {
  const { data: me } = useSuspenseQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div className={`app-shell ${props.selectedId ? "has-selection" : ""}`} dir="rtl">
      <Topbar me={me} />
      <div className="workspace">
        {!can(me, "whatsapp.inbox.view") ? (
          <>
            <Navigation filters={props.filters} change={props.change} allowed={false} />
            <main className="inbox-main">
              <EmptyState
                title="لا تملك صلاحية عرض المحادثات"
                description="يرجى التواصل مع مسؤول بوابة ديتيلز لمنحك الصلاحية."
              />
            </main>
          </>
        ) : !me.whatsapp_configured ? (
          <>
            <Navigation filters={props.filters} change={props.change} allowed={false} />
            <main className="inbox-main">
              <EmptyState
                title="خدمة واتساب غير مهيّأة"
                description="يرجى التواصل مع مسؤول الشركة للتحقق من إعداد الخدمة."
              />
            </main>
          </>
        ) : (
          <InboxBoundary
            key={JSON.stringify(props.filters)}
            fallback={(error, retry) => (
              <WorkspaceFallback
                {...props}
                me={me}
                error={error}
                retry={() => {
                  reset();
                  retry();
                }}
              />
            )}
          >
            <Suspense fallback={<WorkspaceFallback {...props} me={me} />}>
              <DataWorkspace {...props} me={me} />
            </Suspense>
          </InboxBoundary>
        )}
      </div>
    </div>
  );
}
function Startup(props: Props & { error?: Error; retry?: () => void }) {
  return (
    <div className="app-shell" dir="rtl">
      <Topbar />
      <main className="workspace">
        <div className="inbox-main">
          {props.error ? (
            <ErrorState error={props.error} retry={props.retry || (() => {})} />
          ) : (
            <Loading />
          )}
        </div>
      </main>
    </div>
  );
}
export function InboxApp(props: Props) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ClientOnly fallback={<Startup {...props} />}>
      <InboxBoundary
        fallback={(error, retry) => (
          <Startup
            {...props}
            error={error}
            retry={() => {
              reset();
              retry();
            }}
          />
        )}
      >
        <Suspense fallback={<Startup {...props} />}>
          <AuthorizedApp {...props} />
        </Suspense>
      </InboxBoundary>
    </ClientOnly>
  );
}
