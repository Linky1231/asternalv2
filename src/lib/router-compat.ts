/**
 * Small compatibility layer so the ported pages can keep using the
 * familiar string-based navigation API on top of TanStack Router.
 */
import { useCallback, useEffect } from "react";
import {
  useNavigate as useRouterNavigate,
  useLocation as useRouterLocation,
} from "@tanstack/react-router";

type NavOptions = { replace?: boolean };

function splitPath(to: string) {
  const [pathname, searchStr = ""] = to.split("?");
  const search: Record<string, string> = {};
  new URLSearchParams(searchStr).forEach((value, key) => {
    search[key] = value;
  });
  return { pathname, search };
}

export function useNavigate() {
  const navigate = useRouterNavigate();
  return useCallback(
    (to: string | number, options?: NavOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      const { pathname, search } = splitPath(to);
      void navigate({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: pathname as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        search: search as any,
        replace: options?.replace,
      });
    },
    [navigate],
  );
}

export function useLocation() {
  const location = useRouterLocation();
  return {
    pathname: location.pathname,
    search: location.searchStr ?? "",
    hash: location.hash ?? "",
  };
}

export function useSearchParams(): [URLSearchParams] {
  const location = useRouterLocation();
  return [new URLSearchParams(location.searchStr ?? "")];
}

export function Navigate({
  to,
  replace,
}: {
  to: string;
  replace?: boolean;
}): null {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}