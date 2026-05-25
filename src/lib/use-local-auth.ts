import { useEffect, useState } from "react";
import {
  LOCAL_AUTH_EVENT,
  getCurrentLocalUser,
  getCurrentRole,
  type LocalRole,
  type LocalUser,
} from "@/lib/local-auth";

export function useLocalAuth() {
  const [user, setUser] = useState<LocalUser | null>(() => getCurrentLocalUser());
  const [role, setRole] = useState<LocalRole>(() => getCurrentRole());

  useEffect(() => {
    function refresh() {
      setUser(getCurrentLocalUser());
      setRole(getCurrentRole());
    }
    refresh();
    window.addEventListener(LOCAL_AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { user, role, isOwner: role === "owner", isSuperAdmin: role === "super_admin" };
}
