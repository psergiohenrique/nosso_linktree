import "server-only";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { posthogLogProvider } from "../../instrumentation";

const posthogLogger = posthogLogProvider?.getLogger("linkbio.posthog");

export async function emitPostHogLog(message: string, attributes: Record<string, string>) {
  if (!posthogLogger || !posthogLogProvider) return;

  posthogLogger.emit({
    body: message,
    severityNumber: SeverityNumber.INFO,
    attributes,
  });

  await posthogLogProvider.forceFlush().catch(() => undefined);
}
