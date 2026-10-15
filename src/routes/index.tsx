import { createFileRoute } from "@tanstack/react-router";
import { InboxApp } from "@/components/inbox/inbox";
import { parseFilters } from "@/lib/inbox-api";
export const Route = createFileRoute("/")({
  validateSearch: parseFilters,
  head: () => ({
    meta: [
      { title: "صندوق المحادثات | واتساب ديتيلز" },
      {
        name: "description",
        content:
          "صندوق محادثات واتساب موحّد للشركة، لمتابعة العملاء والتواصل معهم عبر بوابة ديتيلز.",
      },
      { property: "og:title", content: "صندوق المحادثات | واتساب ديتيلز" },
      {
        property: "og:description",
        content: "متابعة محادثات الشركة والعملاء في صندوق واتساب ديتيلز الموحّد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InboxPage,
});
function InboxPage() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InboxApp
      filters={filters}
      change={(patch) =>
        void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
      }
      select={(id) =>
        void navigate({ to: "/conversations/$id", params: { id: String(id) }, search: filters })
      }
      back={() => {}}
    />
  );
}
