import { createFileRoute } from "@tanstack/react-router";
import { InboxApp } from "@/components/inbox/inbox";
import { parseFilters } from "@/lib/inbox-api";
export const Route = createFileRoute("/conversations/$id")({
  validateSearch: parseFilters,
  head: ({ params }) => ({
    meta: [
      { title: `المحادثة ${params.id} | واتساب ديتيلز` },
      {
        name: "description",
        content: "عرض رسائل المحادثة والرد عليها وإدارة متابعتها في واتساب ديتيلز.",
      },
      { property: "og:title", content: `المحادثة ${params.id} | واتساب ديتيلز` },
      {
        property: "og:description",
        content: "متابعة الرسائل والتعيين وحالة المحادثة في صندوق الشركة الموحّد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationPage,
});
function ConversationPage() {
  const { id } = Route.useParams();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const number = Number(id);
  const back = () => void navigate({ to: "/", search: filters });
  return (
    <InboxApp
      filters={filters}
      selectedId={Number.isSafeInteger(number) && number > 0 ? number : undefined}
      change={(patch) =>
        void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
      }
      select={(id) =>
        void navigate({ to: "/conversations/$id", params: { id: String(id) }, search: filters })
      }
      back={back}
    />
  );
}
