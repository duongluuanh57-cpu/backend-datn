# Admin Chat Flow

## Endpoint
`POST /api/ai/admin/chat`

## Flow Steps

1. **Receive message** from admin dashboard
2. **DocsService** fetches relevant GitHub docs (cached 5 min, topic-selected from `INDEX.md`)
3. **Gemini non-streaming call** — detects if function calling is needed
4. **AdminToolService** executes matched tool(s):

   | Tool | Description |
   |------|-------------|
   | `get_dashboard_stats` | Aggregated KPIs |
   | `list_orders` | Order list with filters |
   | `list_products` | Product catalog |
   | `list_brands` | Brand list |
   | `list_users` | User list |
   | `list_vouchers` | Voucher list |
   | `list_tags` | Tag list |
   | `list_taxonomies` | Taxonomy list |

5. **Gemini streaming call** — final response with tool results + docs context

## Function Declarations
- **13 function declarations** mapping to MongoDB queries
- Each declaration includes parameter schemas (filters, pagination)

## Doc Selection
- `INDEX.md` maps topics to document paths
- Only relevant docs injected into context per query
