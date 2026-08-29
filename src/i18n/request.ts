import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { matchLocale } from "@/i18n/negotiate";

// Cookie first, fall back to server-side Accept-Language. Don't write cookie on first visit (reads >> writes); only Server Actions persist it on user toggle
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;

  const locale = isLocale(fromCookie)
    ? fromCookie
    : matchLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
