import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Swoopface",
  description: "Privacy policy for the Swoopface website and browser extension.",
};

const sections = [
  {
    title: "Information we collect",
    content: (
      <>
        <p>
          When you create an account, we collect your name and email address. We
          store a securely hashed version of your password, never the original
          password. We also process authentication session information so you
          can remain signed in.
        </p>
        <p>
          When you choose to save an advertisement, Swoopface stores the ad
          information you selected, which may include its Facebook Ad Library
          ID, advertiser name, copy, headline, call-to-action, destination URLs,
          images, videos, dates, page markup related to the ad, and the board to
          which you saved it. We also store boards, sharing settings, and other
          content you intentionally create in the service.
        </p>
        <p>
          We may collect limited technical information needed to operate,
          secure, and improve the service, such as request timestamps, error
          information, browser type, and general usage analytics.
        </p>
      </>
    ),
  },
  {
    title: "How the browser extension works",
    content: (
      <>
        <p>
          The Swoopface extension runs on Facebook Ad Library pages so it can
          display save controls and read the details of an ad only when you use
          those controls. It does not collect your Facebook password, private
          messages, or general browsing history.
        </p>
        <p>The extension requests the following browser permissions:</p>
        <ul>
          <li>
            <strong>Storage:</strong> remembers extension preferences,
            authentication state, and your selected board locally.
          </li>
          <li>
            <strong>Cookies:</strong> accesses Swoopface authentication cookies
            so the extension can recognize your signed-in Swoopface account. It
            is not used to read Facebook account cookies.
          </li>
          <li>
            <strong>Scripting:</strong> performs a first-party authentication
            check in an open Swoopface tab when required and enables save
            controls on supported Facebook Ad Library pages.
          </li>
          <li>
            <strong>Site access:</strong> is limited to Swoopface and supported
            Facebook Ad Library pages for the functions described above.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "How we use information",
    content: (
      <p>
        We use collected information to provide and synchronize your account,
        save and organize ads, cache saved media, support sharing features,
        authenticate extension requests, prevent abuse, troubleshoot errors,
        and improve Swoopface. We do not sell your personal information or use
        saved ad data for targeted advertising.
      </p>
    ),
  },
  {
    title: "Sharing and service providers",
    content: (
      <p>
        We disclose information only when needed to operate Swoopface through
        providers such as hosting, database, media-storage, security, and
        analytics services; when you intentionally use a sharing feature; when
        required by law; or when necessary to protect users and the service.
        These providers may process information only for the services they
        perform for us.
      </p>
    ),
  },
  {
    title: "Data retention and security",
    content: (
      <p>
        We retain account information and saved content while your account is
        active and as reasonably necessary to provide the service, resolve
        disputes, enforce agreements, and meet legal obligations. We use
        reasonable technical and organizational safeguards, but no internet
        service can guarantee absolute security.
      </p>
    ),
  },
  {
    title: "Your choices",
    content: (
      <p>
        You may edit or delete saved content within Swoopface, sign out to end
        the active session, clear extension storage through your browser, or
        uninstall the extension at any time. You may also request access,
        correction, export, or deletion of your personal information by
        contacting us through Swoopface. Some information may be retained where
        the law permits or requires it.
      </p>
    ),
  },
  {
    title: "Children's privacy",
    content: (
      <p>
        Swoopface is not directed to children under 13, and we do not knowingly
        collect personal information from children under 13. If you believe a
        child has provided personal information, please contact us so we can
        take appropriate action.
      </p>
    ),
  },
  {
    title: "Changes to this policy",
    content: (
      <p>
        We may update this policy as Swoopface evolves. We will post the revised
        policy here and update the effective date. Material changes may also be
        communicated through the service where appropriate.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#100607] text-red-50">
      <div className="border-b border-white/10 bg-[#0b0405]/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Swoopface home">
            <Image
              src="/Icon-transparent.png"
              alt=""
              width={42}
              height={42}
              className="rounded-xl"
              priority
            />
            <span className="text-lg font-semibold tracking-tight text-white">
              Swoopface
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/12 px-4 py-2 text-sm text-red-50/75 transition hover:border-red-400/40 hover:text-white"
          >
            Back to app
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-14">
          <div className="mb-5 inline-flex rounded-full border border-red-300/15 bg-red-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-red-200">
            Legal
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-red-50/65">
            This policy explains how Swoopface handles information across our
            website, application, and browser extension.
          </p>
          <p className="mt-3 text-sm text-red-50/45">
            Effective June 23, 2026
          </p>
        </header>

        <div className="space-y-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-lg shadow-black/10 sm:p-8"
            >
              <h2 className="text-xl font-semibold text-white">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-red-50/68 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-red-50/90 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                {section.content}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-red-400/20 bg-[radial-gradient(circle_at_top_left,rgba(237,18,39,0.14),transparent_48%),rgba(255,255,255,0.035)] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Contact us</h2>
            <p className="mt-4 text-sm leading-7 text-red-50/68">
              If you have questions about this policy or want to make a privacy
              request, contact us through the Swoopface website at{" "}
              <a
                href="https://swoopface.com"
                className="font-medium text-red-300 underline decoration-red-300/30 underline-offset-4 hover:text-red-200"
              >
                swoopface.com
              </a>
              .
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-red-50/40">
          © 2026 Swoopface. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
