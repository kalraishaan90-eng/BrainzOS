# BrainzOS Backend Setup Guide (Supabase + Postgres + RLS)

This directory contains the database schema, security rules, and seed scripts to power **BrainzOS** using [Supabase](https://supabase.com).

---

## Quick Reference: Demo Accounts

All demo accounts are pre-configured in `supabase/seed.sql` with the password:  
**`Password123!`**

| Name | Role | Email | Class / Cohort | Notes |
|---|---|---|---|---|
| **Ishaan Kalra** | `student` | `student@brainz.edu` | Class XI-B Commerce | Orion House, ID: `BOS-XIB-041`, Founder: CampusCart & QueueLess |
| **Aarav Mehta** | `teacher` | `teacher@brainz.edu` | Class XI-B Commerce | Senior Faculty, Commerce & Economics |
| **Dr. Rhea Sharma** | `director` | `director@brainz.edu` | Executive Leadership | Full administrative & audit visibility |
| **Ananya Gupta** | `student` | `ananya.gupta@brainz.edu` | Class XI-B Commerce | Founder: SkillSync |
| **Kabir Sharma** | `student` | `kabir.sharma@brainz.edu` | Class XI-B Commerce | Founder: StudySphere |
| **Diya Sen** | `student` | `diya.sen@brainz.edu` | Class XI-B Commerce | Founder: EcoTrack |
| **Rohan Varma** | `student` | `rohan.varma@brainz.edu` | Class XI-B Commerce | Founder: ClubFlow |

---

## Step 1: Create a Supabase Project

1. Go to [database.new](https://database.new) or the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project**.
3. Choose an organization, enter a project name (e.g. `BrainzOS-School`), set a strong database password, and select a region close to your school.
4. Wait approximately 1–2 minutes for the database cluster to provision.

---

## Step 2: Apply Database Migrations & Seed Data

You can apply the migrations using either the **Supabase Web Dashboard** (quickest) or the **Supabase CLI** (for local development or CI/CD).

### Option A: Via Supabase Web Dashboard (No CLI needed)

1. Open your project in the [Supabase Dashboard](https://app.supabase.com).
2. Navigate to **SQL Editor** (left navigation bar icon `>_`).
3. Create a new query and paste the contents of each migration file in order:
   - Run `supabase/migrations/20260918000001_initial_schema.sql` (Creates types, tables, constraints, indexes).
   - Run `supabase/migrations/20260918000002_functions_and_triggers.sql` (Creates security functions, auth trigger, vote sync triggers).
   - Run `supabase/migrations/20260918000003_row_level_security.sql` (Enables RLS on every table and defines policies).
   - Run `supabase/migrations/20260918000004_realtime_setup.sql` (Configures realtime publications).
4. Run `supabase/seed.sql` to populate the demo users, timetable, attendance, gradebook, and Pitch Pad ventures.

> **Tip**: You can also concatenate all 4 migration files and `seed.sql` into one script and run it in a single click in the SQL Editor.

### Option B: Via Supabase CLI

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed:

```bash
# 1. Login to your Supabase account
supabase login

# 2. Link your local project to your remote Supabase project
supabase link --project-ref <your-project-ref>

# 3. Push migrations to remote database
supabase db push

# 4. Apply seed data
supabase db reset   # For local docker development
# OR run the seed script directly on remote:
supabase db execute --file supabase/seed.sql
```

---

## Step 3: Retrieve Project URL & Anon Key for Frontend

When you are ready to wire the frontend:

1. In the Supabase Dashboard, click the **Project Settings** (gear icon) in the bottom-left corner.
2. Select **API** under Configuration.
3. Locate the following two values under **Project API keys**:
   - **Project URL**: Format `https://<project-ref>.supabase.co`
   - **`anon` `public` key**: A long JWT string starting with `eyJ...`
4. Update `config.js` with these credentials:
   ```javascript
   window.BRAINZOS_CONFIG = {
     SUPABASE_URL: "https://<your-project-ref>.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   };
   ```
   *(For full deployment steps on Vercel/Netlify and the security penetration checklist, refer to [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)).*

---

## Security Architecture & Row Level Security (RLS) Matrix

Every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` enabled.

| Table | Student Access | Teacher Access | Director Access |
|---|---|---|---|
| `profiles` | SELECT all; UPDATE own profile (role locked) | SELECT all; UPDATE own profile | Full SELECT / UPDATE |
| `attendance_records` | SELECT own (`student_id = auth.uid()`) | SELECT, INSERT, UPDATE for assigned class (`is_teacher_of()`) | Full SELECT & management |
| `grades` | SELECT own (`student_id = auth.uid()`) | SELECT, INSERT, UPDATE for assigned class | Full SELECT & management |
| `assignment_submissions` | SELECT own; UPDATE own completion | SELECT & review submissions for assigned class | Full access |
| `assignments` | SELECT all | SELECT all; INSERT/UPDATE/DELETE for own class | Full access |
| `timetable_entries` | SELECT all | SELECT all; INSERT/UPDATE for taught classes | Full access |
| `broadcasts` | SELECT all | SELECT all; INSERT/UPDATE own posts | Full access |
| `ventures` (Pitch Pad) | SELECT all; INSERT if `founder_id = auth.uid()`; UPDATE pitch details | SELECT all | Full access (Approve/Reject, Director's Pick) |
| `venture_votes` | SELECT all; INSERT/DELETE own vote only (`student_id = auth.uid()`) | SELECT all | SELECT all |
| `audit_logs` | INSERT own actions (`actor_id = auth.uid()`) | INSERT own actions (`actor_id = auth.uid()`) | Full SELECT (Audit dashboard) |
| `emergency_events` | INSERT own event | INSERT own event | Full SELECT (Dormant — siren feature retired) |

### Automated Enforcements:
- **Profile Provisioning Trigger (`handle_new_user`)**: Listens to `AFTER INSERT ON auth.users` and automatically creates a corresponding record in `public.profiles`.
- **Role Defense Trigger (`prevent_role_escalation`)**: Blocks students and teachers from modifying their `role` in `profiles`. Only users where `is_director()` returns `TRUE` can modify user roles.
- **Pitch Pad Vote Integrity (`sync_venture_votes` + `prevent_manual_venture_vote_tampering`)**: The `ventures.votes` count is strictly managed by database triggers. Direct client tampering of the vote count is rejected/recomputed from `public.venture_votes`.

---

## File Manifest

```
supabase/
├── migrations/
│   ├── 20260918000001_initial_schema.sql          # Types, tables, constraints, indexes
│   ├── 20260918000002_functions_and_triggers.sql  # Helper functions (is_director, etc.), auth triggers
│   ├── 20260918000003_row_level_security.sql      # RLS policies across all tables
│   └── 20260918000004_realtime_setup.sql          # Supabase Realtime publications
├── seed.sql                                       # Complete demo dataset
└── README.md                                      # Setup instructions
```
