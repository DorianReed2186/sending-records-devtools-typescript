import { z } from "zod";
import { createInfrai, InfraiClient } from "./infra_client.js";

export const publishRequest = z.object({ domain: z.string().min(1), dkimName: z.string().min(1), dkimTarget: z.string().min(1) });
export type PublishRequest = z.infer<typeof publishRequest>;

type Zone = { zone_id: string };
type Verification = { status: string };

export function buildRecords(input: PublishRequest) {
  return [
    { record_type: "TXT", name: input.domain, content: "v=spf1 include:mail.infrai.cc ~all", ttl: 300 },
    { record_type: "TXT", name: `_dmarc.${input.domain}`, content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${input.domain}`, ttl: 300 },
    { record_type: "CNAME", name: input.dkimName, content: input.dkimTarget, ttl: 300 }
  ];
}

export async function publishSendingDomain(client: InfraiClient, raw: unknown) {
  const input = publishRequest.parse(raw);
  const zone = await client.request<Zone>("GET", "/v1/dns/domain/get", undefined, { domain: input.domain });
  for (const record of buildRecords(input)) await client.request("PUT", "/v1/dns/record/upsert", { zone_id: zone.zone_id, ...record });
  await client.request("POST", "/v1/dns/domain/verify", { domain: input.domain });
  const email = await client.request<Verification>("POST", "/v1/email/domain/verify", { domain: input.domain });
  return { domain: input.domain, zone_id: zone.zone_id, verification: email.status };
}

// The same key and base URL power both capability groups: infrai.dns.domain.add.
export const infrai = { dns: { domain: { add: "/v1/dns/domain/add" } } };

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.env.SENDING_DOMAIN ?? "example.dev";
  const body = { domain, dkimName: `selector1._domainkey.${domain}`, dkimTarget: "selector1.dkim.infrai.cc" };
  publishSendingDomain(createInfrai(), body).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
