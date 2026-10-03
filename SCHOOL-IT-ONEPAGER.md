# BrainzOS — School IT Administrator & Principal One-Pager
**Operational Guide for On-Premise Institutional Deployment**

---

### 1. Executive Summary
BrainzOS is an air-gapped, on-premise School Operating System running entirely on your school's own computer hardware. 
- **Zero Cloud Exposure:** No student or faculty data ever leaves the school's physical server room.
- **No Recurring Cloud Subscriptions:** Eliminates third-party hosted database fees and vendor lock-in.
- **Full Legal Compliance:** Compliant with India's *Digital Personal Data Protection (DPDP) Act, 2023* for student data residency, parental consent tracking, and right-to-erasure.

---

### 2. Where Does the Data Live?
All school information is stored directly on the school server's hard drive inside persistent Docker storage volumes:
- **Database Records (Attendance, Marks, Profiles):** Stored under `./volumes/db_data/` in a dedicated PostgreSQL 15 database.
- **Documents & PDF Dossiers (CBSE Certificates, Staff Contracts):** Stored under `./volumes/storage_data/` encrypted on local disk.
- **Web Interface:** Served locally over the school's local area network (LAN/Wi-Fi) at `http://school-server.local` or your internal IP address (e.g., `http://192.168.1.100`).
- **External Calls:** Exactly **0** bytes are sent to Google, Supabase, or external analytics servers. All icons, fonts, and scripts are stored on the server hard drive.

---

### 3. Who Can Access What? (Access Control Matrix)

| User Role | What They Can Access & Do | Restrictions |
| :--- | :--- | :--- |
| **Student** | • View personal attendance and digital ID pass<br>• View own continuous assessment marks & timetable<br>• View school-wide announcements & house standings | Cannot see any other student's records or grades. Cannot edit attendance or marks. |
| **Teacher** | • Mark daily classroom attendance for their assigned cohort<br>• Enter marks for continuous assessments (Unit Tests, Half-Yearly)<br>• Schedule tests & post assignments<br>• Submit faculty leave applications | Cannot view salary data or modify director-level policies. Cannot alter other teachers' cohorts. |
| **School Director / Principal** | • Executive school-wide telemetry & attendance rollup<br>• Faculty account provisioning & teacher dossier review<br>• Approve/reject staff leave requests & assign substitutions<br>• Year-end student auto-promotion and manual overrides<br>• Immutable PostgreSQL audit log review | All administrative actions are permanently logged in the audit ledger with timestamps. |
| **IT Administrator (Hardware Host)** | • Manage Docker services, execute database backups, rotate cryptographic keys, and monitor disk space | Operates at the server operating system level via local console/SSH. |

---

### 4. Backups & Disaster Recovery

Backups run automatically every morning at **02:00 AM** via an automated task schedule:
- **Backup Location:** Stored in `./backups/` on the server hard drive.
- **Integrity Check:** Every backup generates a companion `.sha256` checksum file to guarantee that backup files are never corrupted.
- **Rolling Retention:** The server automatically preserves 14 daily backup snapshots. Snapshots older than 14 days are cleanly pruned to save disk space.
- **Recommended IT Best Practice:** Plug an external USB 3.0 external hard drive into the server or sync `./backups/` to a secondary office computer across the local network weekly.

**How to trigger a manual backup right now:**
- **Linux:** `sudo ./scripts/backup-db.sh`
- **Windows PowerShell:** `.\scripts\backup-db.ps1`

**How to restore a backup if the server fails:**
- **Linux:** `sudo ./scripts/restore-db.sh ./backups/brainzos_backup_YYYYMMDD_HHMMSS.dump`
- **Windows PowerShell:** `.\scripts\restore-db.ps1 -BackupFile .\backups\brainzos_backup_YYYYMMDD_HHMMSS.dump`

---

### 5. Security & What to Do If a Password or Key Is Leaked

1. **If a Teacher or Student Password is Compromised:**
   - Log into the Director portal → Open **Faculty Roster** or **Students Roster**.
   - Click the user's name → Select **Reset Password**.
   - The user will be forced to choose a new private password immediately upon their next login.
2. **If Server Master Keys are Compromised:**
   - Run the automated key generator:
     ```bash
     node scripts/generate-keys.js
     ```
   - Update the generated keys in your `.env` file.
   - Restart the server stack:
     ```bash
     docker compose down && docker compose up -d
     ```
   - This invalidates all old session tokens immediately across all devices.

---

### 6. First-Run Setup & Beginning of Academic Year Checklist

When deploying BrainzOS for the first time or starting a new academic session:

1. **Step 1: Start the Server**
   ```bash
   docker compose up -d
   ```
2. **Step 2: Initialize Director Superuser Account**
   Run the secure CLI bootstrap command:
   ```bash
   node scripts/bootstrap-director.js --email director@school.edu --name "Dr. School Principal"
   ```
3. **Step 3: Provision Faculty Accounts**
   - Log in as Director at `http://localhost:8080`.
   - Navigate to **Faculty Roster** (`#nav-director-teachers`).
   - Click **Add Teacher** → Enter teacher name, school email, and assigned cohort.
   - Teachers receive temporary password `Password123!` and are prompted to set their private password upon first sign-in.
4. **Step 4: Batch Import Student Roster**
   - Download the official template: [`templates/students-import-template.csv`](file:///d:/BrainzOS/templates/students-import-template.csv).
   - Fill in student columns: `name, email, class_section, stream, house`.
   - In the Director portal, click **Bulk Import Students (CSV)** → Select your file → Click **Import Students**.
   - BrainzOS securely provisions student credentials in bulk with zero third-party cloud calls.

---

*Document prepared by Senior Backend & Security Engineering Team.*  
*For emergency hardware support or server configuration assistance, refer to the full [DEPLOYMENT-GUIDE.md](file:///d:/BrainzOS/DEPLOYMENT-GUIDE.md).*
