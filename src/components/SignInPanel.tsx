"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { TreeLogo } from "./Navbar";

export default function SignInPanel({
  demoMode,
  providers,
}: {
  demoMode: boolean;
  providers: { google: boolean; facebook: boolean };
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function demoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await signIn("demo", { name, email, redirect: false });
    if (res?.error) {
      setError(t("error_required"));
      setBusy(false);
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-leaf-100 bg-white p-8 shadow-xl shadow-leaf-900/5">
      <div className="flex flex-col items-center text-center">
        <TreeLogo size={44} />
        <h1 className="mt-3 text-2xl font-extrabold text-bark-900">{t("signin_title")}</h1>
        <p className="mt-1 text-sm text-bark-800/70">{t("signin_subtitle")}</p>
      </div>

      <div className="mt-7 space-y-3">
        {providers.google && (
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            <GoogleIcon /> {t("signin_google")}
          </button>
        )}
        {providers.facebook && (
          <button
            onClick={() => signIn("facebook", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 font-semibold text-white transition hover:bg-[#166fe0]"
          >
            <FacebookIcon /> {t("signin_facebook")}
          </button>
        )}
      </div>

      {demoMode && (
        <>
          {(providers.google || providers.facebook) && (
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-bark-800/50">
              <span className="h-px flex-1 bg-leaf-100" />
              {t("signin_or")}
              <span className="h-px flex-1 bg-leaf-100" />
            </div>
          )}
          <div className="rounded-2xl bg-leaf-50 p-4 ring-1 ring-leaf-200">
            <h2 className="font-bold text-leaf-800">{t("signin_demo_title")}</h2>
            <p className="mt-0.5 text-xs text-bark-800/70">{t("signin_demo_desc")}</p>
            <form onSubmit={demoSubmit} className="mt-3 space-y-2.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("signin_demo_name")}
                required
                className="w-full rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("signin_demo_email")}
                type="email"
                required
                dir="ltr"
                className="w-full rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
              />
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              <button
                disabled={busy}
                className="w-full rounded-lg bg-leaf-600 px-4 py-2.5 font-bold text-white transition hover:bg-leaf-700 disabled:opacity-60"
              >
                {t("signin_demo_btn")}
              </button>
            </form>
          </div>
        </>
      )}

      {!providers.google && !providers.facebook && !demoMode && (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          No sign-in methods configured. Set OAuth keys or enable DEMO_MODE.
        </p>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-bark-800/50">
        {t("signin_terms")}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.25 7.25 0 0 1-10.8-3.81H1.23v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.26 14.28a7.19 7.19 0 0 1 0-4.56V6.63H1.23a11.99 11.99 0 0 0 0 10.74l4.03-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 1.23 6.63l4.03 3.09A7.16 7.16 0 0 1 12 4.75z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.62 23.09 24 18.1 24 12.07z" />
    </svg>
  );
}
