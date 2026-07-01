import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#12080a] text-foreground">
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
                  style={{ borderRadius: "12px" }}
                  className="h-auto w-full"
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

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Card className="border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase text-red-50/45">Boards</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Organized
                </p>
              </Card>
              <Card className="border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase text-red-50/45">Media</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Collected
                </p>
              </Card>
              <Card className="border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase text-red-50/45">Workflow</p>
                <p className="mt-2 text-lg font-semibold text-white">Synced</p>
              </Card>
            </div>
          </div>

          <Card className="rounded-3xl border-white/10 bg-[#0b0506]/95 p-6 shadow-2xl shadow-red-950/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-6 w-40 lg:hidden">
                <Image
                  src="/Vertical.png"
                  alt="Swoopface"
                  width={900}
                  height={520}
                  style={{ borderRadius: "12px" }}
                  priority
                  className="h-auto w-full"
                />
              </div>
              <h2 className="text-2xl font-semibold text-white lg:hidden">
                Save Facebook Ads for your own inspiration
              </h2>
              <h2 className="hidden text-2xl font-semibold text-white lg:block">
                {title}
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
                {subtitle}
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
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
}
