# Kenya Deployment Context

None of the three source documents addressed this, and it's the difference
between a system that works on a slide and one that works in a hospital in
Kenya. This is an engineering addendum, not a legal opinion — confirm all
regulatory points below with Kenyan counsel and the relevant Ministry of
Health (MOH) office before any production decision is finalized on them.

## 1. Regulatory anchors (replacing HIPAA as the operative framework)

HIPAA is a US statute. It has no legal force over a hospital in Kenya. If
PulseFlow is being shown to a US government audience, keeping HIPAA-aligned
controls as a recognizable signal is reasonable — but it cannot be the
*actual* compliance basis for Kenyan deployment. The relevant anchors are:

- **Data Protection Act, 2019** and the **Office of the Data Protection
  Commissioner (ODPC)** — Kenya's GDPR-equivalent. Governs consent, data
  subject rights, breach notification, and cross-border data transfer.
  Cross-border transfer matters specifically here if any infrastructure is
  hosted outside Kenya.
- **Kenya Master Health Facility List (KMHFL)** — the canonical facility
  identifier registry. `hospitals`/`facilities` records should carry a
  KMHFL code field from day one, not be retrofitted later — every downstream
  integration (MOH reporting, SHA, KHIS) will expect it.
- **Social Health Authority (SHA)** — replaced NHIF in 2024 as Kenya's
  national health insurance/benefits scheme. Any billing or insurance
  eligibility integration must target SHA, not NHIF — NHIF references in
  any inherited planning material are stale.
- **Kenya Health Information System (KHIS / DHIS2)** — the national
  health-data reporting backbone. If PulseFlow is expected to feed
  facility-level statistics upward to MOH, an export/integration path to
  KHIS belongs on the roadmap explicitly, not assumed as "interoperability"
  in the abstract.

## 2. What this means for the data model now

Even though Phase 1 only ships Identity + Queue, two fields are added now
specifically to avoid a painful migration later:

- A facility/tenant reference field is present on `queue_items` from the
  start (`queue_id` is scoped per facility), so KMHFL-coded facility
  identity can be attached without restructuring the table later.
- No NHIF-specific fields exist anywhere in this scaffold — if a billing
  service is added later, it should be designed against SHA from the
  outset.

## 3. Connectivity and offline operation

This was named once in the 14-volume blueprint ("offline-tolerant edge
operations") with nothing behind it. For a real Kenyan hospital deployment,
especially outside Nairobi/Mombasa/Kisumu, intermittent connectivity is a
routine operating condition, not an incident. Concretely, before any
patient-facing client ships:

- Local-first writes on mobile/tablet clients (e.g. local SQLite or
  IndexedDB queue of pending operations) with a sync-and-reconcile pass on
  reconnect, not a hard dependency on a live connection to create a triage
  record or queue ticket.
- Explicit conflict resolution rules for the cases that will actually occur
  — e.g. the same patient triaged at two terminals while offline — rather
  than "last write wins" by accident.
- A defined maximum offline window per device/role with a visible,
  honest "unsynced" indicator in the UI. Silent staleness is the same
  malpractice-in-software-form problem the 14-volume blueprint correctly
  flags for emergency overrides — it applies just as much here.

## 4. Notification channels and device reality

The source documents list SMS/Email/Push as notification channels, which is
directionally right but underspecified for this market:

- **SMS is the primary channel for patients**, not a fallback — push
  notifications assume a smartphone with the app installed and a working
  data connection, which is not a safe default assumption for a
  patient-facing hospital app in this context.
- **USSD as a fallback** for feature-phone patients (queue status checks,
  appointment confirmation) should be on the roadmap for the
  patient-facing surface, even though it isn't built in Phase 1.
- SMS gateway integration in this market typically goes through providers
  like Africa's Talking or direct telco (Safaricom) integration — this is
  an integration-boundary decision to make when the Notification Service is
  actually built, not now, but it should be decided deliberately rather
  than defaulted to whatever generic SMS API documentation happens to be
  closest at hand.

## 5. Language

English and Swahili, at minimum, for any patient-facing surface. This
affects the data model (notification templates need a locale field) more
than it affects backend services — noted here so it isn't forgotten by the
time the Notification Service or any patient app is scoped.

## 6. The non-technical risk

Worth restating from the master spec because it's easy to lose track of
once code exists: getting one real hospital to pilot this, with MOH
visibility and a clear governance/ownership plan, is a harder and more
important problem than anything in this codebase. No phase of the technical
roadmap substitutes for that relationship existing.
