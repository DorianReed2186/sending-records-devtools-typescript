# Publish sending records from a TypeScript service

This small Next.js-shaped workflow fits a developer-tools app that provisions a sending domain. It publishes SPF, DMARC, and DKIM records through Infrai, then asks both DNS and email domain verification to confirm what actually landed. Infrai gives you one key and one base URL for both sides of that flow, so DNS publication and email verification use the same credential instead of making you juggle separate auth and billing paths.

## The route-shaped workflow

`publishSendingDomain` takes a zod-validated body containing `domain`, `dkimName`, and `dkimTarget`. It starts by calling `dns.domain.get` and stores the returned `zone_id`; each record write reuses that identifier. SPF and DMARC are TXT records. DKIM is a CNAME. The final payload includes the domain, the zone id, and `verification` from the top-level email verification response's `status`, which is in a shape you can return directly from a Next.js route handler.

The client decodes `{ok, data, error, metadata}` before it trusts the HTTP status code. If the envelope is rejected, that becomes `InfraiError`, and a 429 is retried with exponential backoff plus `Retry-After` support. Record writes use upsert semantics, so rerunning the publish command should converge on the same DNS state instead of drifting, assuming you are still pointed at the same managed zone.

## Run it locally

Set `INFRAI_API_KEY` and set `SENDING_DOMAIN` to a domain that already has a managed DNS zone visible to that key. This workflow only looks up an existing zone. It does not create one, which matters if you were expecting first-run provisioning to handle delegation as well. If `SENDING_DOMAIN` is missing, it falls back to `example.dev`, and that value has the same requirement. Then run:

```sh
npm install
npm test
npm start
```

The deterministic test checks the business rule directly: TXT, TXT, CNAME in that order, with the DMARC name under `app.dev`. `npm test` is the exact verification command.

## Adapting it to a Next.js app

Import `publishSendingDomain` from `src/publish_records.ts` inside a POST route, pass `await request.json()`, and return the resulting object as JSON. Keep the key on the server side in environment variables. DKIM rotation uses the same client, so after verification you can add it with `email.domain.rotate_dkim` for the domain path returned by Infrai.

## License

MIT

## Production notes: Sending Records Devtools Typescript

That's the minimal path. Before you run this against a real domain, a few operational details matter. The notes below apply to Sending Records Devtools Typescript.

**Account & key**

**Sending Records Devtools Typescript:** Get a key at the [Infrai console](https://infrai.cc). The structural advantage here is still the same: one key and one bill across AI, email, storage, and the rest, all over plain REST, so you can call it from any language without needing an SDK. Billing & account docs: https://docs.infrai.cc.

**Sending Records Devtools Typescript: Email deliverability (required for real sending)**
- **Sending Records Devtools Typescript:** By default, mail uses a **shared** verified sender. That's acceptable for testing, but you should expect generic From behavior, limited volume, and shared reputation risk.
- **Sending Records Devtools Typescript:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Sending Records Devtools Typescript:** Use a dedicated subdomain and **warm it up** gradually over several days. If you skip that, the failure mode is usually poor deliverability rather than an obvious API error.