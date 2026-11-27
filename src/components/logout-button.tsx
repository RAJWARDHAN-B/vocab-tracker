"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="button button-quiet" onClick={logout} type="button">
      Sign out
    </button>
  );
}
