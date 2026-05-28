import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Pré-carrega o chunk da rota quando o usuário passa o mouse / dá foco
    // no link → clique fica instantâneo, sem fallback de loading.
    defaultPreload: "intent",
  });

  return router;
};
