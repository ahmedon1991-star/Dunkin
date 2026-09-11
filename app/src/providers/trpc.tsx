import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("dunkin_user_session") || sessionStorage.getItem("dunkin_user_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.employee_id) {
        // Create base64 auth token containing verified session details
        const token = btoa(unescape(encodeURIComponent(JSON.stringify({
          employeeId: parsed.employee_id,
          role: parsed.role,
          branchCode: parsed.branch_code,
          fullName: parsed.full_name,
        }))));
        return {
          "x-dunkin-auth": `Bearer ${token}`,
        };
      }
    }
  } catch (e) {}
  return {};
}

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        return getAuthHeader();
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
