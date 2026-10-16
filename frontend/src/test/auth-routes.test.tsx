import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

describe("Authentication and Admin Routes", () => {
  it("matches route for /login", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/login");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches route for /register", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/register");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches route for /admin", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/admin");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
