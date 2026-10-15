import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  Info,
  LoaderCircle,
  MessageSquare,
  Reply,
  Send,
  ShieldCheck,
  StickyNote,
  UserRound,
  X,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  assign,
  can,
  canReply,
  getDetail,
  getEmployees,
  getTemplates,
  mediaPath,
  POLL_INTERVAL,
  reply,
  sendTemplate,
  setStatus,
  templateParamCount,
  type Detail,
  type Employee,
  type Me,
  type Message,
  type Template,
} from "@/lib/inbox-api";
import { dateLabel, initials, time } from "./primitives";
export const detailOptions = (id: number) => ({
  queryKey: ["conversation", id],
  queryFn: ({ signal }: { signal: AbortSignal }) => getDetail(id, undefined, signal),
  refetchInterval: POLL_INTERVAL,
  retry: false,
});
const typeNames: Record<Message["type"], string> = {
  text: "رسالة نصية",
  image: "صورة",
  video: "فيديو",
  audio: "رسالة صوتية",
  document: "مستند",
  sticker: "ملصق",
  location: "موقع",
  contacts: "جهة اتصال",
  reaction: "تفاعل",
  interactive: "رسالة تفاعلية",
  button: "زر",
  order: "طلب",
  system: "رسالة نظام",
  template: "قالب",
  unknown: "رسالة غير معروفة",
};
// واتساب (Meta) أحيانًا يخزّن خطأ الإرسال ككائن بنية {code, message} بدل نص — عرضه مباشرة كـ children
// يُسقط React بخطأ #31 (كائن غير صالح كـ child). نحوّله دائمًا إلى نص آمن قبل العرض.
function errorText(error: Message["error"]): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    try { return JSON.stringify(error); } catch { /* ignore */ }
  }
  return "فشل الإرسال";
}
function Delivery({ status }: { status: string }) {
  if (status === "read")
    return <CheckCheck size={13} className="delivery-read" aria-label="مقروءة" />;
  if (status === "delivered") return <CheckCheck size={13} aria-label="تم التسليم" />;
  if (status === "sent") return <Check size={13} aria-label="تم الإرسال" />;
  if (status === "failed")
    return <AlertCircle size={13} className="delivery-failed" aria-label="فشل الإرسال" />;
  return <Clock3 size={11} aria-label="في انتظار الإرسال" />;
}
function MessageItem({
  message,
  me,
  onReply,
}: {
  message: Message;
  me: Me;
  onReply?: ((message: Message) => void) | undefined;
}) {
  return (
    <div className={`message-row ${message.direction}`}>
      <div className="message-bubble">
        {message.direction === "out" && message.sent_by_name && (
          <span className="message-sender">{message.sent_by_name}</span>
        )}
        {message.media?.map((media) => (
          <Fragment key={media.id}>
            {media.status !== "done" ? (
              <div className="media-placeholder">
                <FileText size={16} />
                {media.status === "pending" ? "جارٍ تجهيز المرفق" : "تعذّر تحميل المرفق"}
              </div>
            ) : media.mime_type.startsWith("image/") ? (
              <img
                className="media-image"
                src={mediaPath(media.id)}
                alt={media.filename || typeNames[message.type]}
                loading="lazy"
              />
            ) : media.mime_type.startsWith("video/") ? (
              <video
                className="media-image"
                controls
                src={mediaPath(media.id)}
                controlsList={can(me, "whatsapp.media.download") ? undefined : "nodownload"}
              />
            ) : media.mime_type.startsWith("audio/") ? (
              <audio
                className="media-audio"
                controls
                src={mediaPath(media.id)}
                controlsList={can(me, "whatsapp.media.download") ? undefined : "nodownload"}
              />
            ) : can(me, "whatsapp.media.download") ? (
              <a
                className="media-link"
                href={mediaPath(media.id)}
                download={media.filename || undefined}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                {media.filename || "تحميل المستند"}
              </a>
            ) : (
              <div className="media-placeholder">
                <FileText size={16} />
                {media.filename || "مستند"}
              </div>
            )}
          </Fragment>
        ))}
        {message.body ? (
          <p dir="auto">{message.body}</p>
        ) : (
          !message.media?.length && (
            <p>
              {typeNames[message.type]}
              {message.template_name ? ` · ${message.template_name}` : ""}
            </p>
          )
        )}
        {message.error && <p className="delivery-failed">{errorText(message.error)}</p>}
        <div className="message-footer">
          {onReply && message.wa_message_id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title="الرد على هذه الرسالة"
              aria-label="الرد على هذه الرسالة"
              onClick={() => onReply(message)}
            >
              <Reply size={11} />
            </Button>
          )}
          <time>{time(message.created_at || message.wa_timestamp)}</time>
          {message.direction === "out" && <Delivery status={message.status} />}
        </div>
      </div>
    </div>
  );
}
function AssignControl({
  id,
  me,
  current,
  currentName,
}: {
  id: number;
  me: Me;
  current: string | null;
  currentName: string | null;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const query = useQueryClient();
  const mutation = useMutation({
    mutationFn: (employee: Employee | null) => assign(id, employee),
    onSuccess: async (result) => {
      query.setQueryData<Detail>(["conversation", id], (old) =>
        old ? { ...old, conversation: { ...old.conversation, ...result } } : old,
      );
      await query.invalidateQueries({ queryKey: ["conversations"] });
      setError("");
    },
    onError: (error: Error) => setError(error.message),
  });
  async function loadEmployees() {
    if (loading || employees.length) return;
    setLoading(true);
    try {
      const result = await getEmployees();
      setEmployees(result.employees);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذّر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }
  const choices = new Map<string, Employee>([
    [me.employee_no, { employee_no: me.employee_no, full_name: me.name }],
    ...employees.map((employee) => [employee.employee_no, employee] as [string, Employee]),
  ]);
  if (current && !choices.has(current))
    choices.set(current, { employee_no: current, full_name: currentName || current });
  return (
    <div>
      <select
        className="assign-select"
        aria-label="تعيين المحادثة"
        value={current || ""}
        disabled={mutation.isPending}
        onFocus={loadEmployees}
        onPointerDown={loadEmployees}
        onChange={(event) => {
          const employee = choices.get(event.target.value);
          mutation.mutate(employee || null);
        }}
      >
        <option value="">غير معيّن</option>
        {Array.from(choices.values()).map((employee) => (
          <option key={employee.employee_no} value={employee.employee_no}>
            {employee.full_name}
            {employee.employee_no === me.employee_no ? " (أنا)" : ""}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-muted-foreground"> …</span>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function ContactPanel({ detail, me }: { detail: Detail; me: Me }) {
  const contact = can(me, "whatsapp.contacts.view") ? detail.contact : undefined;
  return (
    <aside className="contact-panel">
      {contact && (
        <>
          <h3 className="contact-panel-title">
            <UserRound size={15} />
            بيانات جهة الاتصال
          </h3>
          <div className="contact-profile">
            <span className="avatar">{initials(contact.display_name || contact.phone)}</span>
            <h4>{contact.display_name || contact.phone}</h4>
            <p dir="ltr">{contact.phone}</p>
            <span className={`category-badge ${contact.category}`}>
              {me.contacts.category_ar[contact.category]}
            </span>
          </div>
          <dl className="contact-fields">
            {contact.company && (
              <div>
                <dt>الشركة / الجهة</dt>
                <dd>{contact.company}</dd>
              </div>
            )}
            <div>
              <dt>الأهمية</dt>
              <dd>{me.contacts.importance_ar[contact.importance] || "—"}</dd>
            </div>
            <div>
              <dt>حالة التسجيل</dt>
              <dd>
                {contact.registered ? "جهة اتصال مسجّلة" : "غير مسجّل"}
                {contact.blocked ? " · محظور" : ""}
              </dd>
            </div>
            {contact.labels?.length > 0 && (
              <div>
                <dt>الوسوم</dt>
                <dd className="label-tags">
                  {contact.labels.map((label) => (
                    <span className="category-badge" key={label}>
                      {label}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {contact.contacts_url && (
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <a href={contact.contacts_url} target="_blank" rel="noreferrer">
                عرض ملف جهة الاتصال
                <ArrowRight size={12} />
              </a>
            </Button>
          )}
          {contact.notes && (
            <div className="contact-section">
              <h4>
                <FileText size={13} />
                ملاحظات جهة الاتصال
              </h4>
              <div className="note">
                <p>{contact.notes}</p>
              </div>
            </div>
          )}
        </>
      )}
      {can(me, "whatsapp.notes") && (
        <div className="contact-section">
          <h4>
            <StickyNote size={13} />
            الملاحظات الداخلية{" "}
            <span className="text-muted-foreground">({detail.notes?.length || 0})</span>
          </h4>
          {detail.notes?.length ? (
            detail.notes.map((note) => (
              <div className="note" key={note.id}>
                <p>{note.body}</p>
                <small>
                  {note.employee_name} · {dateLabel(note.created_at)}
                </small>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">لا توجد ملاحظات داخلية.</p>
          )}
        </div>
      )}
    </aside>
  );
}
function TemplateDialog({
  conversationId,
  onClose,
  onSent,
}: {
  conversationId: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getTemplates()
      .then((result) => { if (!cancelled) setTemplates(result.templates); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "تعذّر تحميل القوالب"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  function pick(template: Template) {
    setSelected(template);
    setParams(Array.from({ length: templateParamCount(template.body_text) }, () => ""));
    setSendError("");
  }
  const preview = selected?.body_text
    ? params.reduce((text, value, i) => text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), value || `{{${i + 1}}}`), selected.body_text)
    : "";
  async function submit() {
    if (!selected) return;
    setSending(true); setSendError("");
    try {
      await sendTemplate(conversationId, selected.name, selected.language, params);
      onSent();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "تعذّر إرسال القالب");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="template-dialog" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="template-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="template-title">إرسال قالب معتمد</h3>
        {loading ? (
          <p>جارٍ تحميل القوالب المتاحة…</p>
        ) : loadError ? (
          <p role="alert" className="delivery-failed">{loadError}</p>
        ) : !templates.length ? (
          <p>لا توجد قوالب معتمدة ومفعّلة حاليًا. يلزم مزامنة القوالب من إعدادات واتساب أولًا.</p>
        ) : !selected ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <Button key={`${t.name}-${t.language}`} variant="outline" className="w-full justify-start" onClick={() => pick(t)}>
                {t.name} <span className="text-xs text-muted-foreground">({t.language})</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{selected.name} ({selected.language})</p>
            <div className="rounded-md border bg-muted p-3 text-sm" dir="auto">{preview}</div>
            {params.map((value, i) => (
              <input
                key={i}
                aria-label={`المتغيّر ${i + 1}`}
                placeholder={`نص المتغيّر {{${i + 1}}}`}
                value={value}
                onChange={(event) => setParams((prev) => prev.map((v, idx) => (idx === i ? event.target.value : v)))}
              />
            ))}
            {sendError && <p role="alert" className="delivery-failed">{sendError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={sending}>رجوع</Button>
              <Button onClick={submit} disabled={sending || params.some((v) => !v.trim())}>
                {sending ? <LoaderCircle className="animate-spin" /> : <Send />} إرسال
              </Button>
            </div>
          </div>
        )}
        <Button variant="ghost" className="mt-2 w-full" onClick={onClose} disabled={sending}>إغلاق</Button>
      </section>
    </div>
  );
}
export function ConversationDetail({ id, me, back }: { id: number; me: Me; back: () => void }) {
  const { data: detail, error: refreshError } = useSuspenseQuery(detailOptions(id));
  const query = useQueryClient();
  const conversation = detail.conversation;
  const [text, setText] = useState("");
  const [reference, setReference] = useState<Message | null>(null);
  const [older, setOlder] = useState<Message[]>([]);
  const [olderMore, setOlderMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  const previousLast = useRef<number | undefined>(undefined);
  const allMessages = Array.from(
    new Map([...older, ...detail.messages].map((message) => [message.id, message])).values(),
  ).sort((a, b) => a.id - b.id);
  const lastId = allMessages.at(-1)?.id;
  useEffect(() => {
    const area = thread.current;
    if (!area) return;
    if (
      !didScroll.current ||
      (lastId !== previousLast.current &&
        area.scrollHeight - area.scrollTop - area.clientHeight < 180)
    ) {
      bottom.current?.scrollIntoView({ block: "end" });
      didScroll.current = true;
    }
    previousLast.current = lastId;
  }, [lastId]);
  const send = useMutation({
    mutationFn: () => reply(id, text.trim(), reference?.wa_message_id),
    onSuccess: async (result) => {
      const newMessage: Message = {
        id: result.id,
        wa_message_id: result.wa_message_id,
        direction: "out",
        type: "text",
        body: result.text,
        status: "queued",
        sent_by_no: me.employee_no,
        sent_by_name: me.name,
        created_at: new Date().toISOString(),
      };
      query.setQueryData<Detail>(["conversation", id], (old) =>
        old
          ? {
              ...old,
              messages: [...old.messages.filter((message) => message.id !== result.id), newMessage],
            }
          : old,
      );
      setText("");
      setReference(null);
      setError("");
      bottom.current?.scrollIntoView({ block: "end" });
      await Promise.all([
        query.invalidateQueries({ queryKey: ["conversation", id] }),
        query.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409 && error.body.window_closed) {
        query.setQueryData<Detail>(["conversation", id], (old) =>
          old ? { ...old, conversation: { ...old.conversation, window_open: false } } : old,
        );
      }
      setError(error.message);
    },
  });
  const status = useMutation({
    mutationFn: () => setStatus(id, conversation.status === "open" ? "resolved" : "open"),
    onSuccess: async (result) => {
      query.setQueryData<Detail>(["conversation", id], (old) =>
        old ? { ...old, conversation: { ...old.conversation, status: result.status } } : old,
      );
      setError("");
      await query.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => setError(error.message),
  });
  async function loadOlder() {
    if (loadingOlder || !(olderMore ?? detail.has_more)) return;
    const first = allMessages[0];
    if (!first) return;
    const area = thread.current;
    const height = area?.scrollHeight || 0;
    const scrollTop = area?.scrollTop || 0;
    setLoadingOlder(true);
    try {
      const page = await getDetail(id, first.id);
      setOlder((current) => [...page.messages, ...current]);
      setOlderMore(page.has_more);
      requestAnimationFrame(() => {
        if (area) area.scrollTop = scrollTop + area.scrollHeight - height;
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذّر تحميل الرسائل السابقة");
    } finally {
      setLoadingOlder(false);
    }
  }
  const hasContact = can(me, "whatsapp.contacts.view") || can(me, "whatsapp.notes");
  return (
    <>
      <header className="conversation-header">
        <Button
          variant="ghost"
          size="icon"
          className="mobile-back"
          onClick={back}
          aria-label="العودة إلى المحادثات"
        >
          <ArrowRight />
        </Button>
        <div className="contact-heading">
          <span className="avatar">{initials(conversation.name || conversation.phone)}</span>
          <div>
            <h3>{conversation.name || conversation.phone}</h3>
            <p>
              <span dir="ltr">{conversation.phone}</span>
              <span className={`category-badge ${conversation.category}`}>
                {me.contacts.category_ar[conversation.category]}
              </span>
            </p>
          </div>
        </div>
        <div className="header-tools">
          {can(me, "whatsapp.inbox.assign") && (
            <AssignControl
              id={id}
              me={me}
              current={conversation.assigned_employee_no}
              currentName={conversation.assigned_name}
            />
          )}{" "}
          {can(me, "whatsapp.inbox.resolve") && (
            <Button
              className="action-button"
              variant="outline"
              disabled={status.isPending}
              onClick={() => status.mutate()}
            >
              {status.isPending ? <LoaderCircle /> : <CheckCheck />}
              {conversation.status === "open" ? "إنهاء المحادثة" : "إعادة فتح"}
            </Button>
          )}
          {hasContact && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="بيانات جهة الاتصال والملاحظات"
              aria-pressed={contactOpen}
              title="بيانات جهة الاتصال والملاحظات"
              onClick={() => setContactOpen(!contactOpen)}
            >
              <Info />
            </Button>
          )}
        </div>
      </header>
      {(error || refreshError) && (
        <div className="inline-error" role="alert">
          {error || "تعذّر تحديث المحادثة. تظهر آخر بيانات متاحة."}
        </div>
      )}
      <div className="conversation-body">
        <div className="thread">
          <div className={`window-strip ${conversation.window_open ? "" : "closed"}`}>
            <span>
              <Clock3 size={12} />
              {conversation.window_open ? "نافذة الرد مفتوحة" : "نافذة الرد مغلقة"}
            </span>
            <small>{conversation.status === "open" ? "محادثة مفتوحة" : "محادثة منتهية"}</small>
          </div>
          <div
            className="messages"
            ref={thread}
            onScroll={(event) => {
              if (event.currentTarget.scrollTop < 30) void loadOlder();
            }}
          >
            {(olderMore ?? detail.has_more) && (
              <div className="load-older">
                <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? "جارٍ التحميل…" : "عرض الرسائل السابقة"}
                </Button>
              </div>
            )}
            {allMessages.length === 0 && (
              <div className="empty-state">
                <p>لا توجد رسائل في هذه المحادثة.</p>
              </div>
            )}
            {allMessages.map((message, index) => {
              const day = dateLabel(message.created_at || message.wa_timestamp);
              const previous = allMessages[index - 1];
              const previousDay = previous
                ? dateLabel(previous.created_at || previous.wa_timestamp)
                : "";
              return (
                <Fragment key={message.id}>
                  {day && day !== previousDay && (
                    <div className="day-separator">
                      <span>{day}</span>
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    me={me}
                    onReply={canReply(me, conversation) ? setReference : undefined}
                  />
                </Fragment>
              );
            })}
            <div ref={bottom} />
          </div>
          {canReply(me, conversation) ? (
            <form
              className="reply-composer"
              onSubmit={(event) => {
                event.preventDefault();
                if (text.trim() && !send.isPending) send.mutate();
              }}
            >
              <div className="composer-title">
                <MessageSquare size={13} />
                الرد على المحادثة
              </div>
              {reference && (
                <div className="reply-reference">
                  <span>{reference.body || typeNames[reference.type]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="إلغاء الرد على الرسالة"
                    onClick={() => setReference(null)}
                  >
                    <X />
                  </Button>
                </div>
              )}
              <div className="composer-input">
                <textarea
                  aria-label="نص الرد"
                  placeholder="اكتب ردّك هنا..."
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={send.isPending}
                />
                <Button
                  type="submit"
                  className="send-button"
                  size="icon"
                  title="إرسال الرد"
                  aria-label="إرسال الرد"
                  disabled={!text.trim() || send.isPending}
                >
                  {send.isPending ? <LoaderCircle /> : <Send />}
                </Button>
              </div>
              <div className="composer-meta">
                <span>
                  <ShieldCheck className="inline size-3" /> يُضاف توقيعك تلقائيًا بواسطة الخدمة
                </span>
                <span>
                  {me.name} · {me.employee_no}
                </span>
              </div>
            </form>
          ) : !conversation.window_open &&
            (can(me, "whatsapp.inbox.reply") || can(me, "whatsapp.templates.send")) ? (
            <div className="closed-window">
              <div>
                <h4>انتهت نافذة الرد الحر (24 ساعة)</h4>
                <p>يمكن متابعة التواصل بإرسال قالب معتمد.</p>
              </div>
              {can(me, "whatsapp.templates.send") && (
                <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)}>
                  إرسال قالب معتمد
                </Button>
              )}
            </div>
          ) : null}
        </div>
        {contactOpen && hasContact && <ContactPanel detail={detail} me={me} />}
      </div>
      {templateOpen && (
        <TemplateDialog
          conversationId={id}
          onClose={() => setTemplateOpen(false)}
          onSent={async () => {
            setTemplateOpen(false);
            await Promise.all([
              query.invalidateQueries({ queryKey: ["conversation", id] }),
              query.invalidateQueries({ queryKey: ["conversations"] }),
            ]);
          }}
        />
      )}
    </>
  );
}
