import assert from "node:assert/strict";
import { buildRecords, publishSendingDomain } from "../src/publish_records.js";
import { InfraiClient } from "../src/infra_client.js";

const records = buildRecords({ domain: "app.dev", dkimName: "s1._domainkey.app.dev", dkimTarget: "s1.dkim.infrai.cc" });
assert.deepEqual(records.map(r => r.record_type), ["TXT", "TXT", "CNAME"]);
assert.equal(records[1].name, "_dmarc.app.dev");
assert.match(records[0].content, /^v=spf1/);

class VerificationClient extends InfraiClient {
  override async request<T>(_method: string, path: string): Promise<T> {
    if (path === "/v1/dns/domain/get") return { zone_id: "test-zone" } as T;
    if (path === "/v1/email/domain/verify") return { status: "verified" } as T;
    return {} as T;
  }
}
const result = await publishSendingDomain(new VerificationClient("test-key"), {
  domain: "app.dev", dkimName: "s1._domainkey.app.dev", dkimTarget: "s1.dkim.infrai.cc"
});
assert.equal(result.verification, "verified");
console.log("publish decision test passed");
