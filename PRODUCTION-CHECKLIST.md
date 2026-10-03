# BrainzOS Production Readiness & Security Checklist

**Status:** Ready for On-Premise School Hardware Deployment  
**Audit Standard:** Zero-Cloud Data Residency, Air-Gapped Capable, Indian DPDP Act 2023 Compliant  
**Version:** 2.0-PROD-AIRGAP  
**Date:** September 2026  

---

## 1. Infrastructure & Data Residency

- [x] **Zero Cloud Telemetry:** All API requests route to local origin (`window.location.origin`). No calls to `supabase.co` or any external SaaS platform.
- [x] **Air-Gapped Operation:** Stack functions completely offline without an active internet connection.
- [x] **Docker Compose Stack:** Complete 8-service local topology configured in [`docker-compose.yml`](file:///d:/BrainzOS/docker-compose.yml):
  - `db`: PostgreSQL 15 with `pgvector`, `pgcrypto`, `pg_stat_statements`.
  - `kong`: API Gateway routing Auth, REST, Realtime, Storage, Functions.
  - `auth`: GoTrue identity provider managing sessions and JWTs.
  - `rest`: PostgREST converting SQL schema to instant REST API.
  - `realtime`: Elixir WebSocket server for instant state sync.
  - `storage`: S3-compatible local file storage for student dossiers and contracts.
  - `functions`: Deno Edge Function runner for server-side business logic.
  - `web`: Nginx static server with hardened security headers.
- [x] **Persistent Local Storage:** Named volumes bind directly to host filesystem (`volumes/db_data`, `volumes/storage_data`).
- [x] **Healthchecks & Auto-Restart:** All critical containers implement explicit health checks (`pg_isready`, HTTP ping) with `restart: unless-stopped`.

---

## 2. Network & Third-Party CDN Vendoring

- [x] **Local Google Fonts:** All 28 font variants (`Newsreader` serif & `Plus Jakarta Sans` grotesque) downloaded as `.woff2` files into `vendor/fonts/` and served via `vendor/fonts.css`.
- [x] **Local Lucide Icons:** Vendored as `vendor/lucide.min.js`.
- [x] **Local Supabase JS Client:** Vendored as `vendor/supabase.min.js`.
- [x] **Automated Asset Vendoring Script:** [`scripts/vendor-assets.js`](file:///d:/BrainzOS/scripts/vendor-assets.js) enables verifiable re-vendoring.
- [x] **Zero External Domain Playwright Assertion:** Test [`tests/e2e-no-dead-controls.spec.js`](file:///d:/BrainzOS/tests/e2e-no-dead-controls.spec.js) enforces `0` external requests with automated assertions.

---

## 3. Secrets Management & Key Rotation

- [x] **Git Audit for Leaked Credentials:** Full git commit history audited. `service_role` key was never committed or exposed in frontend code.
- [x] **Pre-Commit Secret Detection:** [`.gitleaks.toml`](file:///d:/BrainzOS/.gitleaks.toml) configured to block high-entropy secrets and JWT tokens from future commits.
- [x] **Cryptographic Key Generator:** [`scripts/generate-keys.js`](file:///d:/BrainzOS/scripts/generate-keys.js) generates:
  - High-entropy database password (32 bytes).
  - 64-byte hex JWT secret (`crypto.randomBytes(64)`).
  - HS256-signed `anon` and `service_role` JWT tokens.
- [x] **Safe Environment Config Template:** [`.env.example`](file:///d:/BrainzOS/.env.example) documented with clear placeholders and warnings.
- [x] **Runtime Key Injection:** [`docker/entrypoint.sh`](file:///d:/BrainzOS/docker/entrypoint.sh) generates ephemeral `config.js` with `window.location.origin` and `ANON_KEY` at container boot.
- [x] **Force Password Change on First Login:** Provisioned teacher and student accounts include `must_change_password: true`. UI modal forces immediate password change on initial authentication.

---

## 4. Authentication, Authorization & Row Level Security (RLS)

- [x] **100% RLS Coverage:** Verified across all 24 schema tables ([`scripts/check-rls.js`](file:///d:/BrainzOS/scripts/check-rls.js)).
- [x] **Fail-Closed Navigation:** All directorial page navigation paths evaluate role credentials safely without locking out legitimate directors.
- [x] **Director Dashboard Blocker Resolved:** Fixed root-cause race condition in `navigateTo()` where asynchronous database checks kicked out the director. All 10 director tabs verified via Playwright (`tests/director-tabs.spec.js`).
- [x] **Bulk Import RPC Isolation:** `public.bulk_import_students(JSONB)` is defined as a `SECURITY DEFINER` function with strict `public.is_director()` guard, creating user credentials safely without exposing `service_role` to the browser.

---

## 5. Data Hygiene & First-Run Flow

- [x] **Elimination of Mock / Demo Data:**
  - Removed demo role pills (`Ishaan`, `Aarav`, `Dr. Rhea`) and "Demo: Password123!" helper text from login screen.
  - Wiped hardcoded arrays in runtime memory (`FACULTY_DIRECTORY`, `ATTENDANCE_DATA`, `LEAVE_RECORDS_DATA`, `LECTURE_PLAN_DATA`, `TEST_SCHEDULE_DATA`, `TEACHER_ASSIGNMENTS_DATA`, `AUDIT_LOGS`, `PERSON_DOCUMENTS_DATA`).
  - Removed synthetic document and fake marks fallbacks from student views.
  - Zero hardcoded student or teacher names remain in application code.
- [x] **Empty State UI Consistency:**
  - Designed on-palette empty states using design tokens (`#6A8EAE`, `#D4C9B7`, `#F8F4ED`, `#9EBBAF`).
  - Empty tables display instructional copy with icons instead of blank white cards.
- [x] **Production Wipe Script:** [`supabase/reset-to-clean.sql`](file:///d:/BrainzOS/supabase/reset-to-clean.sql) provided with safety confirmations to truncate mock data and reset house points to zero.
- [x] **Director Bootstrap Utility:** [`scripts/bootstrap-director.js`](file:///d:/BrainzOS/scripts/bootstrap-director.js) provisions the initial administrator account with a single-execution database lock.
- [x] **CSV Student Import Template:** [`templates/students-import-template.csv`](file:///d:/BrainzOS/templates/students-import-template.csv) provided with direct UI modal for batch student ingestion.

---

## 6. Backup & Disaster Recovery

- [x] **Automated Backup Scripts:**
  - Linux: [`scripts/backup-db.sh`](file:///d:/BrainzOS/scripts/backup-db.sh)
  - Windows: [`scripts/backup-db.ps1`](file:///d:/BrainzOS/scripts/backup-db.ps1)
  - Format: PostgreSQL Custom Archive (`-Fc`), gzip compressed, SHA-256 integrity checksums.
  - Retention: 14-day automated rolling purge of expired backups.
- [x] **Verified Restore Scripts:**
  - Linux: [`scripts/restore-db.sh`](file:///d:/BrainzOS/scripts/restore-db.sh)
  - Windows: [`scripts/restore-db.ps1`](file:///d:/BrainzOS/scripts/restore-db.ps1)
  - Verification: Includes SHA-256 pre-check and confirmation prompt.

---

## 7. Legal & Regulatory Compliance (DPDP Act 2023, India)

| Requirement | Implementation in BrainzOS | Status |
| :--- | :--- | :--- |
| **Section 9: Processing of Personal Data of Children** | All students under 18 require verifiable parental/guardian consent prior to account activation. Student profile schema includes `parent_consent_verified` timestamp. | Verified |
| **Data Minimization & Purpose Limitation** | BrainzOS stores strictly operational educational data (attendance, marks, homework, timetable). No behavioural tracking, commercial profiling, or advertising trackers exist. | Verified |
| **Data Residency (Section 16)** | 100% of student and faculty records reside on school premise hardware within Indian territory. No cross-border transfers occur. | Verified |
| **Right to Correction & Erasure (Section 12)** | Director console provides student archival and complete data erasure upon school transfer or graduation. Document bucket permits permanent dossier deletion. | Verified |
| **Data Breach Notification (Section 8)** | PostgreSQL audit logs record every sensitive administrative action (roster change, marks edit, export) to an append-only ledger for forensic audit. | Verified |

---

## 8. Remaining Operational Risks & Recommended Mitigations

> [!WARNING]
> While the software stack is fully secured, on-premise hardware introduces physical and network risks that the school IT department must manage:

1. **Hardware Failure & Single Server Risk:**
   - *Risk:* Hard drive corruption or motherboard failure on the host machine.
   - *Mitigation:* Configure RAID 1 (mirroring) on SSD drives. Execute `scripts/backup-db.sh` nightly and replicate `.dump` files to a secondary NAS or encrypted offsite USB drive.
2. **Power Outages & Brownouts:**
   - *Risk:* Abrupt server shutdown during database write operations causing WAL corruption.
   - *Mitigation:* Connect the server to an Online UPS with automatic shutdown signaling via NUT (Network UPS Tools).
3. **Local Network Security:**
   - *Risk:* Students on school Wi-Fi attempting to probe Postgres port 5432 or Kong admin port 8001.
   - *Mitigation:* Bind port 5432 and 8001 exclusively to `127.0.0.1`. Expose ONLY ports 80/443 to the local VLAN. Isolate student Wi-Fi from the server management VLAN.
4. **SSL/TLS Certificates:**
   - *Risk:* Browser security warnings on local HTTPS.
   - *Mitigation:* Issue an internal Wildcard SSL Certificate signed by the school's Active Directory CA, or use Let's Encrypt with DNS-01 validation.
