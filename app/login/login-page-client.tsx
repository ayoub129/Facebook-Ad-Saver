"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#12080a] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_480px]">
          <div className="hidden min-h-[430px] rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(237,18,39,0.28),transparent_34%),linear-gradient(145deg,#1b090d,#080405_62%,#16070a)] p-10 shadow-2xl shadow-red-950/25 lg:flex lg:flex-col lg:justify-between">
            <div>
              <Link
                href="http://www.sarandagroup.com/installswoopface"
                className="mb-7 inline-flex items-center rounded-full border border-red-200/20 bg-white/8 px-3 py-1 text-xs font-medium text-red-50 transition hover:border-red-100/35 hover:bg-white/12"
                target="_blank"
                rel="noreferrer"
              >
                Install Swoopface Chrome Extension
              </Link>
              <div className="mb-8 w-full max-w-[420px]">
                <Image
                  src="/Vertical.png"
                  alt="Swoopface"
                  width={900}
                  height={520}
                  priority
                  className="h-auto w-full "
                  style={{ borderRadius: "12px" }}
                />
              </div>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
                Save Facebook Ads for your own inspiration
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-red-50/70">
                <Link
                  href="https://www.facebook.com/ads/library"
                  className="underline decoration-red-50/35 underline-offset-4 transition hover:text-white hover:decoration-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to Facebook Ads Library.
                </Link>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b0506]/95 p-6 shadow-2xl shadow-red-950/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-6 w-40 lg:hidden">
                <Image
                  src="/Vertical.png"
                  alt="Swoopface"
                  width={900}
                  height={520}
                  priority
                  style={{ borderRadius: "12px" }}
                  className="h-auto w-full"
                />
              </div>
              <h2 className="text-2xl font-semibold text-white lg:hidden">
                Save Facebook Ads for your own inspiration
              </h2>
              <h2 className="hidden text-2xl font-semibold text-white lg:block">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-red-50/65 lg:hidden">
                <Link
                  href="http://www.sarandagroup.com/installswoopface"
                  className="underline decoration-red-50/35 underline-offset-4 transition hover:text-white hover:decoration-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Install Swoopface Chrome Extension
                </Link>
              </p>
              <p className="mt-2 hidden text-sm text-red-50/65 lg:block">
                Log in to access your saved ads and boards.
              </p>
              <p className="mt-5 text-sm leading-6 text-red-50/70 lg:hidden">
                <Link
                  href="https://www.facebook.com/ads/library"
                  className="underline decoration-red-50/35 underline-offset-4 transition hover:text-white hover:decoration-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to Facebook Ads Library.
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-50/35 focus:border-red-500/60 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-50/35 focus:border-red-500/60 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-[#ed1227] text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-[#cf0d20] disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>

              <p className="text-center text-sm text-red-50/60">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-white underline decoration-red-500 underline-offset-4"
                >
                  Create one
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
