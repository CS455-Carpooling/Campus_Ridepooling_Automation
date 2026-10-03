"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPage, Landing, type Page } from "./PageShells";

type NextPageProps = {
  page: Page;
  notice?: string;
  token?: string;
};

export default function NextPage({ page, notice, token }: NextPageProps) {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("campus-ride-pooling-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(saved ? saved === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("campus-ride-pooling-theme", dark ? "dark" : "light");
  }, [dark]);

  const go = (next: Page) => {
    const routes: Record<Page, string> = {
      home: "/",
      login: "/login",
      register: "/register",
      forgot: "/forgot-password",
      reset: "/reset-password",
    };

    router.push(routes[next]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageProps = { dark, setDark, go };

  return page === "home" ? (
    <Landing {...pageProps} />
  ) : (
    <AuthPage page={page} notice={notice} token={token} {...pageProps} />
  );
}
