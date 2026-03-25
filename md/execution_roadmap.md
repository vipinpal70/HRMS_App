# 🚀 HRM System Execution Roadmap

This document outlines the step-by-step execution plan for building the HRM system, incorporating the latest architectural decisions: **Supabase SDK (No Prisma)**, **Timezone-aware Logic**, **Edge Functions + pg_cron**, and **Notification System**.

---

## 🏗️ Phase 1: Database & Foundation (The Core)
**Goal:** Set up the Supabase project, define the schema, and secure it with RLS.

### 1.1. Project Setup
- [ ] Initialize Next.js project (if not already clean).
- [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `date-fns`, `date-fns-tz`, `clsx`, `tailwind-merge`.
- [ ] Configure environment variables (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 1.2. Database Schema Definition (SQL)
- [ ] **Profiles Table**: Extends `auth.users`.
- [ ] **Company Settings**: Add `timezone` (e.g., 'Asia/Kolkata', 'America/New_York') to handle global times correctly.
- [ ] **Attendance Table**: Store `check_in`, `check_out` in UTC.
- [ ] **Leaves & Tasks Tables**: Standard CRUD structure.
- [ ] **Notifications Table** (New):
    ```sql
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES profiles(id),
      type TEXT CHECK (type IN ('check_in_alert', 'leave_status', 'task_assigned', 'system')),
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```

### 1.3. Row Level Security (RLS)
- [ ] Enable RLS on all tables.
- [ ] Create policies:
    - `Employees` can view ONLY their own data.
    - `Admins` & `HR` can view ALL data.
    - `System` (Edge Functions) has full access (via Service Role).

---

## 🔐 Phase 2: Authentication & User Onboarding
**Goal:** Secure login and role-based redirection.

### 2.1. Auth Flow
- [ ] Implement Login Page (`/login`).
- [ ] Implement Auth Callback/Middleware to handle session persistence.
- [ ] Create `middleware.ts` to protect routes:
    - `/admin/*` -> Only Admin/HR.
    - `/dashboard/*` -> Authenticated Users.

### 2.2. Profile Management
- [ ] Create a "Post-Login" check:
    - If user exists in `auth.users` but not in `public.profiles`, create the profile automatically (via Database Trigger).
- [ ] Admin User Management Page:
    - Ability to "Add Employee" (creates a user in Supabase Auth + Profile).

---

## ⏱️ Phase 3: Attendance System (The Complex Part)
**Goal:** Accurate check-in/out with location and timezone validation.

### 3.1. Timezone Utility
- [ ] Create `lib/time.ts`:
    - Helper functions to convert Server Time (UTC) -> Org Timezone.
    - Helper to get "Start of Day" and "End of Day" based on Org Timezone.

### 3.2. Check-In Logic
- [ ] **Frontend**: Get GPS coordinates.
- [ ] **Backend (Server Action)**:
    - Validate User ID.
    - Check if already checked in for "Today" (Org Time).
    - Calculate distance from Office (Haversine formula).
    - Insert `check_in` timestamp.

### 3.3. Check-Out Logic
- [ ] **Backend (Server Action)**:
    - Update the record.
    - Calculate `total_minutes`, `overtime`, `late_status`.

---

## 🤖 Phase 4: Automation & Background Jobs
**Goal:** Automate daily maintenance without a separate backend server.

### 4.1. Supabase Edge Functions
- [ ] **`auto-checkout`**: Runs at midnight (Org Time). Checks out anyone who forgot (marks as "System Checkout").
- [ ] **`mark-absent`**: Runs after office hours. Creates "Absent" records for anyone with no check-in.

### 4.2. Database Scheduler (pg_cron)
- [ ] Enable `pg_cron` extension in Supabase.
- [ ] Schedule the Edge Functions:
    ```sql
    SELECT cron.schedule('0 0 * * *', 'select net.http_post(...)'); -- Run daily at midnight
    ```

---

## 📢 Phase 5: Notifications & Alerts
**Goal:** "Scream" when things happen.

### 5.1. Database Triggers for Notifications
- [ ] Create a Postgres Function & Trigger:
    - When `leave_requests.status` changes -> Insert row into `notifications` for the user.
    - When `tasks` inserted -> Insert row into `notifications` for the assignee.

### 5.2. Email Integration (Resend)
- [ ] Setup Resend API.
- [ ] Create Email Templates (React Email).
- [ ] Send emails on critical events (Leave Rejected, High Priority Task).

---

## 📅 Phase 6: Leaves & Tasks
**Goal:** Standard CRUD with approval workflows.

### 6.1. Leave Management
- [ ] Employee: Request Leave form.
- [ ] Admin: Approval Dashboard.
- [ ] **Logic**: Deduct from `remaining_leaves` only upon approval.

### 6.2. Task Management
- [ ] Admin: Assign Task (with Priority).
- [ ] Employee: Update Status (Pending -> In Progress -> Completed).

---

## 📊 Phase 7: Dashboard & Analytics
**Goal:** Visual insights.

- [ ] **Admin Dashboard**:
    - "Who is in the office right now?" (Real-time).
    - "Who is late today?".
- [ ] **Employee Dashboard**:
    - "My Attendance Stats".
    - "My Pending Tasks".

---

## 🛠️ Tech Stack Finalization
- **Framework**: Next.js 14/15 (App Router).
- **Language**: TypeScript.
- **Database**: Supabase (PostgreSQL).
- **ORM**: None (Using Supabase SDK directly).
- **Styling**: Tailwind CSS + shadcn/ui.
- **State Management**: React Query (TanStack Query) for data fetching.
- **Icons**: Lucide React.
- **Emails**: Resend.




if a user has admin role:
    - in the attendance view
    - they can view all employees' attendance
    - they can view all employees' leave requests
    - they can view all employees' tasks
    - they can approve or reject leave requests
    - they can assign tasks to employees
    - they can add new employees to the system
    - they can view all employees' profiles
    - they can edit any employee's profile
    - they can delete any employee's profile
    - we will add search functionality to find employees by name or ID
    - they can view the attendance report for any employee
    - they can view the leave report for any employee
    - they can view the task report for any employee

if a user has hr role:
    - in the attendance view
    - they can view all employees' attendance
    - they can view all employees' leave requests
    - they can view all employees' tasks
    - they can approve or reject leave requests
    - they can assign tasks to employees
    - they can add new employees to the system
    - they can view all employees' profiles
    - they can edit any employee's profile
    - they can delete any employee's profile
    - we will add search functionality to find employees by name or ID
    - they can view the attendance report for any employee
    - they can view the leave report for any employee
    - they can view the task report for any employee



if a user has emp role:
    - in the attendance view
    - they can view their own attendance
    - they can view their own leave requests
    - they can view their own tasks
    - they can request leave,and documents like offer letter, salary slip, experience letter, release letter

    - in the setting view
    - they can view and update their own profile
    - they can view and update their own password
    - they can logout as well as 

    




The Workflow:


In the login UI, there are 3 ways to login:
1. login with email and password:
    we will check the user credentials with the stored credentials in the database
    in the background, we will try to fetch the user's gps coordinates and update the database with the latest gps coordinates,
    we will also fetch the user ip address and update the database with the latest ip address

    if ip matched with company setting ip:
        we will show green color in the wifi icon other wise light red/orange
    if gps coordinate mached with company setting latitude and longitude:
        we will show green color in the gps icon other wise light red/orange


2. login with ip:
    user email is required to login with ip
    so we will check the user email is stored in the database table
    then we will check the login request ip
    if ip is not matched then show "Access Denied: You are not at the office"
    if ip matched with company setting ip:
        we will show green color in the wifi icon other wise light red/orange
        and get the user password from the database and send loginwithemailpassword to the supabase in the background if ip matched then 
        so i want to show the user a success message "You are logged in successfully"
        just by tap on login with IP button 
        in the bg we will login this user in the supabase by using the user email and password and loginwithemailpassword method in supabase


3. Login with GPS (Geo-fencing)
     - user email is required to login with gps
     - ip is not required to login with gps
       - System requests User's GPS Location.
       - Calculate distance to Company Office Location .
       - IF User is within the Allowed Radius (e.g., 100m):
         - ALLOW ACCESS .
         - Update the database with the user's latest GPS coordinates.
        show the user a success message "You are logged in successfully"

        
