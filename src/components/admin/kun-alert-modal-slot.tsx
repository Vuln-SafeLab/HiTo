"use client";
import dynamic from "next/dynamic";
import type { AlertData } from "./kun-alert-modal";

export const KunAlertModalClient = dynamic(
  () => import("./kun-alert-modal").then((m) => m.KunAlertModal),
  { ssr: false }
);

export function KunAlertModalSlot({ data }: { data: AlertData }) {
  return <KunAlertModalClient data={data} />;
}
