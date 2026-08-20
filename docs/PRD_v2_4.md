# Practical Fitness
Coach Platform — Product Requirements Document
Version 2.4  |  Internal Coach-Facing MVP  |  Design-Ready

This document is ready for the design phase.

## Table of Contents
1.  Executive Summary
2.  Problem Statement
3.  Business Goals
4.  User Personas
5.  User Workflows
6.  Functional Requirements
7.  Non-Functional Requirements
8.  Data Requirements & Database Design
9.  Technical Architecture
10.  Security & Compliance
11.  MVP Scope
12.  Product Roadmap
13.  UX/UI Principles & Screen Layout
14.  Coach Experience Optimization
15.  Operational Efficiency
16.  Risks & Bottlenecks
17.  Scalability
18.  Analytics & KPIs
19.  Future AI & Data Opportunities
20.  Recommended Development Sequence
21.  Movement Classification (D/M/E)
22.  Native-Only Requirements
23.  Consultation & Onboarding Workflow
A.  Workout Sheet Data Model Analysis
B.  Remaining Gaps
C.  Resolved Decisions Log
D.  MVP Readiness Score

## 1. Executive Summary
Practical Fitness operates a private one-on-one strength training studio across 4 active locations using the proprietary Steadypace® methodology. Core values: Connect, Encourage, and Communicate Candidly. All coaching operations currently run on physical paper workout sheets.
This document defines requirements for a digital coach platform — an internal iPad-first Progressive Web App (PWA) that replaces paper sheets and becomes the operational backbone for every session.
The MVP is narrow and intentional: digitize what coaches do today, do it faster, and capture data that currently disappears. This version of the PRD is complete enough to enter the design phase.

## 2. Problem Statement
Problem / Operational Impact
- Coaches write all sheets by hand before each shift — 20–40 min of manual labor per shift; zero data captured digitally
- Handwriting quality varies between coaches — Client history unreliable; new coaches cannot trust old notes
- Information is missed or not recorded — Weight, duration, complaints, and observations permanently lost
- No real-time visibility into client progress — Managers and owner cannot see trends without pulling paper
- Coach onboarding is slow — New coaches learn every client manually from stacks of paper
- Shift handoffs are fragile — Next coach receives incomplete context; wrong sheets sometimes filed

## 3. Business Goals
Goal / Confidence / Notes
- Reduce coach prep time 60–75% — High — Auto-population eliminates manual sheet writing. MVP-achievable.
- Eliminate missed session data — High — Structured digital input means a field exists or it doesn't.
- Accelerate coach onboarding 40–60% — High — New coach pulls any client instantly with full history.
- Improve retention by 50% — Low — MVP alone — Retention requires Phase 2 client-facing features. Not a Phase 1 deliverable.
- Increase coach scalability — Medium — Software helps; physical room and schedule capacity remain the real ceiling.

The 50% retention target is a full-product goal. Do not build toward it in Phase 1.

## 4. User Personas

### 4.1 The Floating Coach — PRIMARY USER
"Can a coach who has never met this client walk in 5 minutes before the session and be fully prepared?"
- Works across 2–3 locations per week; sees 8–14 clients per shift
- Has never met several of their clients before
- Needs: instant client context, settings visible, able to log fast without looking down
- Authenticates with name selection + personal 4-digit PIN

### 4.2 Location Manager
- Oversees daily operations at one location
- Reviews session logs, attendance, and daily recap
- Manages follow-up queue each morning
- Accesses manager mode via unique manager code tied to their account
- Mode toggle within the same app coaches use — not a separate login

### 4.3 Owner
- Oversees all 4 locations — not session-level operational
- Needs: cross-location session counts, coach activity, retention signals
- Phase 2: analytics dashboard

### 4.4 Client — NOT IN MVP
Clients do not interact with the software in Phase 1. Stated explicitly to prevent scope creep.

## 5. User Workflows

### 5.1 Coach Authentication
- Coach opens app — sees coach selection list
- Selects their name, enters 4-digit PIN
- If PIN forgotten: enter 2222, then select name from list — logged as a forgotten-code entry
- Session tied to selected coach name regardless of code used

### 5.2 Pre-Session — Batch Prep Mode
- Coach opens today's schedule — entered by outgoing coach at end of prior shift
- Schedule shows client name, session time, color code badge (P/C/E)
- Coach scans all clients for the day in read-only mode — under 5 minutes
- Settings visible per client from this view without opening a full session
- Coach identifies any adjustments needed before sessions begin

### 5.3 Starting a Session
- Coach taps client card from schedule view
- Client name displayed prominently above Start Session button — prevents accidental start
- No session record created until Start Session is tapped
- Session opens in landscape workout view with exercises auto-populated

### 5.4 During Session
Change: Set type badge moved to session column header. Movement classification (D/M/E) replaces set type in exercise cell top-middle. Stopwatch and failure time behavior fully documented.
- Workout screen: landscape layout, fixed settings column on left, current session column on right, two previous session columns visible
- Session column header shows: date, session type badge (RECURRING/FLEX), set type badge (S/T/E), and LIVE indicator for current session
- Set type (S/T/E) displayed once in session column header — Strength 1:30, Tone 2:15, Endurance 3:00; individual exercise cell shows set type label only when that exercise deviates from session default
- Movement classification (D/M/E) displayed in top-middle of each exercise cell — follows exercise rotation by default; coach can override per session
- Pain/issues intake captured at session start: body area selector, severity 1–10, free text
- Stopwatch behavior: coach manually starts per exercise; stops when coach intentionally clicks it or moves to next cell; does not start or stop automatically
- Failure time logged in dead center of exercise cell — mandatory before moving to next cell
- For M (Metabolic) exercises: stopwatch time auto-captured as failure time; manual override available via scroll-wheel picker (non-native) or stylus (native)
- For S and E exercises: failure time entered manually via scroll-wheel time picker (non-native) or stylus (native)
- Progression indicator per exercise set by coach: up (+amount), down (-amount), hold (OK)
- Exercise swap available mid-session — treated as Type D swap; original preserved, replacement logged with reason
- Field notes accessed via tap on note icon attached to exercise cell — opens panel, closes without leaving workout view
- Keyboard appears only when notes are needed, dismisses when done

### 5.5 6-Session Review
- App flags session 6 before session starts
- Coach must either complete review or explicitly decline before Start Session is available
- Decline reasons: dropdown (Client said no / Client said next time / Client declined measurements but reviewed goals / Other)
- Other option opens free-text input
- Decline logged with coach name, timestamp, and reason
- Review screen shows ORIGINAL founding baseline per exercise and review history log
- Coach inputs current working weight; app records it as new review entry alongside previous review for comparison
- Review history is append-only — founding baseline never overwritten

### 5.6 Post-Session
- Session auto-saves on close — no manual save required
- Coach completes four structured note fields: Execution / Physical / Machine Changes / Personal
- Coach marks whether client booked their next session
- Coach flags client for follow-up if needed — reason field required
- All session data stored and immediately visible in client history

### 5.7 End of Shift
- Outgoing coach enters next shift's client schedule: client name + time slot pulled from Bookeo on separate screen
- Auto-generated daily recap assembled from session data
- Coach copies recap to WhatsApp — one tap
- Follow-up flag queue visible to manager for morning outreach

### 5.8 Unscheduled Client Walk-In
- Coach searches client by name (partial match and last name supported)
- Finds client profile, taps to open
- Triggers full session log entry — same flow as scheduled session
- Session logged as unscheduled in status field

### 5.9 Returning Client After 2-Month Absence
- Before first session back: new baseline review conducted — same consultation form workflow
- New baseline saved in review history — does not replace founding ORIGINAL weight
- 6-session review counter resets from this point forward
- Full consultation/onboarding workflow documented in Section 23

## 6. Functional Requirements

### 6.1 Client Profile
Feature / Description / Priority
- Client record — Name, DOB, age, sex, height, location(s), color code (P/C/E) — P0
- Music & fan preferences — Always visible on session screen without scrolling — P0
- Physical limitations & injuries — Structured body-area fields + free text; no diagnostic labels — P0
- Personal details — Hobbies, family, lifestyle notes for coach rapport — P0
- Goal tags — Standard list + free text option for specific personal goals — P0
- Customization notes — Free text; persistent; always visible on profile — P0
- Minor client flag — Flag for under-18; parental contact field required — P0
- Color code (P/C/E) — Pain/Caution/Easy; changeable by any coach or manager with logged note + timestamp — P0
- Membership / package info — Package type + completion (renewal/end) date visible on profile — P1
- Client archival — Archived clients retained and accessible for reactivation; not deleted — P0

### 6.2 Exercise & Workout Management
Change: Set type moved to session header. Movement classification added as distinct per-exercise field. Failure time added as mandatory logged field per exercise.
Feature / Description / Priority
- Standardized exercise database — Canonical list with full names, abbreviations, and default movement classification; Westlake first — P0
- Exercise type classification — Type A (fixed/always), Type B (rotating position/always), Type C (auxiliary A/B/C alternating), Type D (conditional swap) — P0
- Movement classification — D/M/E per exercise — stored in ClientExerciseOrder; follows rotation by default; coach-overridable per session — P0
- OHP / INC slot — OHP and INC interchangeable; same Type B slot; set per client by coach — P0
- Auto-population on session open — Loads correct exercise sequence per rotation state; movement classification and suggested weight from last session — P0
- Set type — session header badge — S/T/E shown as badge in session column header. Strength=1:30, Tone=2:15, Endurance=3:00. Fixed per client; coach-editable when needed. Positioned below RECURRING/FLEX badge, above exercise rows. — P0
- Set type — exercise override — When individual exercise deviates from session default, set type label shown in that cell only — P0
- Shuffle button — Manual rotation advance — only needed if coach wants to change the auto-populated order — P0
- Weight logging — Input per exercise; suggested weight from last session shown in top-right of cell — P0
- Stopwatch per exercise — Manual start by coach; stops on intentional click OR on move to next cell; elapsed time displayed in bottom-left of cell — P0
- Failure time — mandatory — Logged in dead center of cell; mandatory before coach can advance to next exercise; separate from stopwatch — P0
- Failure time — M exercises — Auto-captured from stopwatch for Metabolic exercises; manual override via scroll-wheel picker — P0
- Failure time — S and E exercises — Manual entry via scroll-wheel time picker (non-native) or stylus (native) — P0
- Time picker — non-native — iOS-style scroll wheel for minutes and seconds — fast, one-handed, no keyboard — P0
- Progression indicator — Coach-set per exercise: up (+amount), down (-amount), hold (OK) — P0
- Exercise swap — manual / mid-session — One tap; Type D behavior; original preserved; replacement logged with reason — P0
- Exercise swap — pain-triggered — Pain area maps to suggested replacement; manual override always available — P1
- Auxiliary A / B / C rotation — Two or three auxiliary slots per client alternating per session; history viewable — P0
- Auxiliary history — Coach can view previous auxiliary setups and weights; can revert going forward — P0
- Special client flag — Non-standard rotation flagged on profile; custom order auto-populates correctly — P0

### 6.3 Session Logging
Feature / Description / Priority
- Session timestamps — Auto-captured on Start Session tap and on close — P0
- Pain / issues intake — Body area selector, severity 1–10 (1=barely notice, 10=emergency), free text — P0
- Coach notes — structured — Four fields: Execution / Physical / Machine Changes / Personal — P0
- Previous coach notes — Most recent 1–2 session notes visible at session open; collapsible — P0
- Mid-set modification — Treated as Type D swap mid-session; reason required; original logged alongside replacement — P0
- Session status — Completed / Late Cancel / No-Show / Unscheduled Walk-In — P0
- Next session booking flag — Coach marks whether client booked before leaving — P0
- Follow-up flag — Flags client for manager outreach; reason field required — P0
- Auto-save + history — All field changes auto-saved; viewable dropdown history per session — P0
- No session on accidental open — Session record only created on Start Session tap — P0

### 6.4 ORIGINAL Baseline & 6-Session Review
Component / Description / Editable?
- Founding baseline weight — Set once at first muscle-failure weight per exercise at initial consultation — Never — locked permanently
- Review history log — Append-only; one entry per 6-session cycle; records working weight vs. prior review and increase — Append only
- 2-month absence baseline — New baseline saved in review history; does not replace founding ORIGINAL; resets 6-session counter — Append only
- 6th session gate — App blocks Start Session until review is completed or explicitly declined — Auto-triggered
- Decline reasons — Dropdown: Client said no / Client said next time / Client declined measurements but reviewed goals / Other (free text) — Coach input
- Decline log — Logged with coach name, timestamp, and reason selected — Auto-captured

### 6.5 Settings
Change: Ab ISO R corrected to range of motion. Leg Extension R corrected to leg range of motion. Incline/OHP I and O corrected to range of motion.
Settings is a dedicated screen per client — separate from the ORIGINAL screen. Machine configuration fields are always visible in a fixed column on the left of the session screen.
Machine / Settings Fields
- Hip Press — Dynamic & Metabolic (same machine) — SH: shoulder height pads | S: seat range | SB: seat back
- Chest Press — S: seat | B: seat back | R: weight stack peg
- Pull Down — S: seat | R: weight stack peg
- Row — C: chest pad | R: weight stack peg
- Incline / Overhead Press — S: seat | I: range of motion (incline) | O: range of motion (overhead)
- Lumbar Extension — F: foot position | K: knee position
- Rotary Torso — F: foot position | K: knee position | R: range of rotation
- Fly — SB: seat back | R: rear fly range of motion | C: chest fly range of motion
- Ab ISO — S: seat setting | R: range of motion
- Leg Extension — S: seat back | R: leg range of motion

Settings changes require deliberate action (tap-and-hold or explicit edit mode) with a reason note required. All changes logged in a dedicated audit log.

### 6.6 Schedule & Daily View
Feature / Description / Priority
- Today's schedule — All sessions at this location in time order — P0
- Client card — Session time, client name, color code badge, session status — P0
- Color code visibility — P/C/E badge visible to coaches and managers only — never to clients — P0
- Session status inline — Mark complete, cancel, no-show from schedule view — P0
- Manual schedule entry — Outgoing coach enters next shift's list: client name + time slot — P0
- Bookeo reference — Coach pulls client list from Bookeo on separate screen — P0
- Bookeo integration — Pull schedule automatically — P1 — Phase 2

### 6.7 Daily Recap & Shift Handoff
Feature / Description / Priority
- Auto-generated summary — Sessions scheduled, completed, canceled, no-shows — from data — P0
- Clients without next session — Listed by name in summary header — P0
- Per-client recap entries — Execution / Physical / Machine Changes / Personal per client in session order — P0
- Copy to WhatsApp — Plain text output; one tap to copy — P0
- Historical recap storage — All recaps stored permanently — P0
- Shift handoff view — Next shift's clients pre-loaded; prior coach name shown per client — P1

### 6.8 Body Measurements
Feature / Description / Priority
- WT / BF / WS tracking — Weight, body fat %, waist — stored per client with date — P0
- ACE body fat reference — Classification ranges surfaced when coach enters BF% — women and men ranges — P0
- Measurement history — List view; easy to access or minimize during shift — P1
- Manual entry — Coach-entered; no device integration in MVP — P0

### 6.9 Authentication & Access Control
Feature / Description / Priority
- Coach login — Name selection from list + 4-digit personal PIN — P0
- Forgotten PIN — override — Enter 2222 + select name from list; logged as forgotten-code entry — P0
- Manager mode — Toggle within same app; each manager has unique manager code — P0
- Role permissions — Coach: scheduled clients only. Manager: all clients at location. Owner: all locations. — P0
- Session attribution — Every session tied to coach name; 2222 entries still attributed via name selection — P0

### 6.10 Admin / Manager View
Feature / Description / Priority
- All client profiles — all locations — Manager can view and edit any client — P0
- Session history across coaches — Full log per client — P0
- Follow-up flag queue — Morning view: unscheduled clients listed for outreach — P0
- Settings audit log — Dedicated log of all machine settings changes — separate from coach notes — P0
- Color code change log — All P/C/E changes with author and timestamp — P0
- Coach activity log — Which coach ran which sessions — P1
- Cross-location schedule view — Owner-level: all 4 locations' daily schedule — P1

## 7. Non-Functional Requirements
Requirement / Specification
- Speed — Session screen loads under 1 second after tapping a client. Hard requirement.
- Usability — Coach logs full session with zero training beyond a 15-minute walkthrough.
- Feature parity — If the app cannot do everything the paper sheet does — and faster — the product has failed.
- Touch targets — Minimum 44×44pt. Session screen usable one-handed.
- Keyboard behavior — Keyboard appears only when notes or text input is needed. Dismisses immediately after.
- Reliability — Functions with intermittent internet. Offline session logging required. Syncs on reconnect.
- Data integrity — No session data losable from accidental tap. Auto-save every input. History viewable in dropdown.
- Landscape layout — iPad landscape orientation is the primary session view.
- Access control — Coach / Manager / Owner roles enforced. P/C/E color codes never visible to clients.
- Multi-location — Every session, client, and user record tied to a location entity from day one.

## 8. Data Requirements & Database Design

### 8.1 Core Entities
Change: FailureTime field added to SessionExerciseLogs. StopwatchElapsed stored as separate field. MovementClassification field in ClientExerciseOrder and SessionExerciseLogs.
Entity / Description / Key Relationships
- Clients — One record per person; name, DOB, age, sex, height, location(s) — → Sessions, ExerciseSettings, ExerciseOrder, Measurements, Flags
- Exercises — Canonical list with default movement classification — → Settings, Order, SessionLogs
- ClientExerciseSettings — Per-client machine settings per exercise — → Client, Exercise
- ClientExerciseOrder — Per-client sequence with type, rotation state, movement classification — → Client, Exercise
- AuxiliaryConfig — Auxiliary A/B/C assignments per client; history of previous configs — → Client, Exercise
- Sessions — One record per visit; includes session-level set type — → Client, Coach, Location, Date, Status
- SessionExerciseLogs — One per exercise per session; weight, stopwatch_elapsed, failure_time, movement classification, set type override flag, swap flag — → Session, Exercise
- OriginalBaselines — Founding muscle-failure weight per exercise per client; permanently locked — → Client, Exercise
- ReviewHistory — Append-only 6-session cycle entries + 2-month absence baselines — → Client, Exercise, Session
- ReviewDeclineLog — Logged review declines with coach, timestamp, reason — → Client, Session, User
- BodyMeasurements — Dated WT/BF/WS per client — → Client
- CoachNotes — Four-field structured notes: Execution/Physical/Machine Changes/Personal — → Session
- PainReports — Per-session body-area intake — → Session
- SettingsAuditLog — All machine settings changes with reason — → Client, Exercise, User
- ColorCodeLog — All P/C/E changes with author and timestamp — → Client, User
- Users — Coaches, managers, owner; linked to locations; stores PIN hash — → Locations
- Locations — 4 studios; first-class entity — → Sessions, Users
- FollowUpFlags — Per-client flags with reason; resolved by manager — → Client, User
- AutoSaveHistory — Field-level change log per session — → Session

### 8.2 Exercise Classification
Type / Exercises / Behavior / Default Movement Classification
- Type A — Fixed, always present — Dynamic Hip Press, Lumbar Extension, Ab ISO, Metabolic Hip Press (same machine) — Fixed position every session. Legs and core. — Per exercise — set in database
- Type B — Rotating position, always present — Chest Press, Row, Pull Down, OHP or INC (same slot) — 4 exercises; position rotates each session. Session 5 = session 1 order. — Per exercise — set in database
- Type C — Auxiliary A/B/C alternating — Assisted Chin Up, Assisted Dip, Fly, Leg Extension, others — Two or three auxiliary slots alternating per session. History viewable; restorable. — Per exercise — follows auxiliary rotation
- Type D — Conditional swap — Any exercise — Manual swap with reason. Original preserved. Replacement logged alongside. — Inherits from replacement exercise default; coach-overridable

No-show / late cancel: rotation index does NOT advance. Next coach gets same workout client missed.

### 8.3 Rotation Logic — Key Rules
- Type B: 4 exercises cycle through positions across 4 sessions; session 5 = session 1 order. Advances on session completion only.
- Type C: Auxiliary A on session 1, B on session 2, C (where applicable) on session 3, then repeats. History retained.
- Movement classification follows exercise rotation by default. Coach override logged in SessionExerciseLogs.
- No-show or late cancel: rotation index does not advance.
- New client or 2-month-absence returning client: rotation starts fresh from session 1.

### 8.4 Failure Time & Stopwatch — Data Model
Change: New subsection. Failure time and stopwatch elapsed are two independent fields in SessionExerciseLogs.
Field / Type / Description / Required?
- stopwatch_elapsed — integer (seconds) — Elapsed time when stopwatch stops — auto-captured when coach clicks stopwatch or moves to next cell — Auto-captured
- failure_time — integer (seconds) — Time at which muscle failure occurred — logged by coach in dead center of cell — Mandatory — gates cell advance
- failure_time_source — enum — 'manual' (S/E exercises or M override) or 'auto' (M exercises captured from stopwatch) — Auto-set
- set_type_override — boolean — True when exercise deviates from session-level set type default — Auto-set
- movement_classification_override — boolean — True when movement classification was changed from default for this session — Auto-set

## 9. Technical Architecture

### 9.1 Tech Stack
Layer / Technology / Rationale
- Frontend — React (Vite) — Best AI coding tool support; large community; fast iteration
- Styling — Tailwind CSS — No custom CSS system to maintain
- Backend / Database — Supabase (Postgres) — Managed DB + REST API + auth + realtime; free tier covers full MVP
- Authentication — Supabase Auth + PIN layer — Supabase handles accounts; PIN is a lightweight session-level auth layer
- Offline sync — Service Worker + IndexedDB — PWA offline; syncs to Supabase on reconnect
- Hosting — Vercel (frontend) + Supabase (backend) — Both free at MVP scale
- Device — iPad Safari as PWA — landscape primary — No App Store; installed from browser; no review cycles

### 9.2 Data Flow
- iPad (Coach) → PWA → Supabase API → Postgres Database
- Offline: iPad caches session data in IndexedDB → pushes to Supabase on reconnect
- Admin/manager: same app, mode toggle, same database
- Bookeo (Phase 2): webhook or polling → session creation in database

### 9.3 Build Tiers
- Tier 1 — MVP: PWA on iPad Safari. Learning and testing vehicle.
- Tier 2 — Production: Native iOS app built simultaneously by mentor. Features requiring native capabilities documented in Section 22.
- No transition from web app to native app — native app is the production product from day one.

## 10. Security & Compliance
Required action before launch: 1-hour legal consultation with a health privacy attorney before any real client data enters the system. Estimated cost $200–500. Non-negotiable.

### 10.1 Architectural Rules
- All health-adjacent fields encrypted at rest — Supabase native
- Role-based access enforced: coaches see scheduled clients only; managers see all at their location; owner sees all
- P/C/E color codes visible to coaches and managers only — never to clients
- No health data in WhatsApp recap messages or any external communication
- Minor clients: access limited to manager and owner roles; parental contact stored
- No diagnostic labels, medication names, or doctor names stored
- Data retention: archived clients retained and accessible; not deleted

### 10.2 Store vs. Do Not Store
Store / Do Not Store
- Physical limitations in client's own words / Clinical diagnoses
- Pain area and severity for session adjustment / Medication names or dosages
- General fitness goals / Doctor names or referrals
- Coach observations on form and effort / Any language implying medical assessment
- Machine settings and exercise adjustments / Insurance or billing data

## 11. MVP Scope

### 11.1 In Scope
- Client profile management — all fields from paper sheet including sex
- Standardized exercise database — Westlake first; other locations added before rollout
- Exercise type classification (A/B/C/D) and rotation logic
- Movement classification (D/M/E) per exercise — follows rotation; coach-overridable
- OHP/INC shared slot — set per client
- Machine settings per exercise — always visible in fixed left column during session
- Auto-population of workout on session open
- Shuffle button for manual rotation advance
- Set type (S/T/E) as session column header badge — exercise-level override when deviating
- Stopwatch per exercise — manual start; stops on click or cell advance
- Failure time — mandatory per exercise; separate from stopwatch; M exercises auto-captured with override
- iOS scroll-wheel time picker for failure time entry (non-native)
- Session logging: weight, movement classification, failure time, progression indicator, notes, pain intake, status
- ORIGINAL baseline: founding weight locked permanently
- 6-session review gate with decline dropdown and logging
- 2-month absence baseline workflow
- Auxiliary A/B/C rotation with history and revert capability
- Type D swap: manual and mid-session, original preserved
- Four-field structured coach notes: Execution / Physical / Machine Changes / Personal
- Auto-save with viewable field-level history
- Body measurements: WT/BF/WS with ACE reference table
- Daily schedule — manually entered by outgoing coach
- Daily recap — auto-generated, copy to WhatsApp
- Follow-up flag queue — manager morning retention tool
- Settings audit log — separate from coach notes
- Color code change log
- Coach PIN auth with name selection; 2222 override with name attribution
- Manager mode toggle with unique manager code
- Unscheduled walk-in: full session log via client search
- Client archival — retained and reactivatable
- Consultation/onboarding workflow documented — Section 23
- Role-based access: Coach / Manager / Owner
- Multi-location data model — location as first-class entity
- iPad PWA — landscape, offline capable, syncs on reconnect

### 11.2 Not In MVP
- Bookeo integration — Phase 2
- Google Sheets integration — Phase 2
- Client-facing portal or dashboard — Phase 2
- Stylus input for notes and failure time — native app only (Section 22)
- Apple Music integration — native app only (Section 22)
- Progress photos — Phase 3 at earliest
- AI workout generation — requires 6+ months clean data
- In-app messaging — follow-up flags cover this need
- Full analytics dashboards — Phase 2
- Automated retention alerts — Phase 2
- Payment or billing integration
- Session booking from within the app
- Exercise lists for locations beyond Westlake — added before multi-location rollout

## 12. Product Roadmap

**Phase 1 — MVP (Months 1–6)**
Digitize the workout sheet. Coach-facing iPad PWA (learning/testing vehicle). Native iOS app built in parallel by mentor. Session logging. Client profiles. Auto-population. Daily recap. Manual schedule entry. Offline capability.
Success metric: 100% of sessions logged digitally. Coach prep time measurably reduced. Zero paper sheets in use. Owner approves and gives green light for Phase 2.

**Phase 2 — Data & Visibility (Months 6–12)**
Bookeo integration. Client-facing progress dashboard (read-only, manager-controlled). Manager analytics. Automated follow-up alerts. Progress charts per client.
Success metric: Manager identifies retention-risk clients without manual audit. Measurable improvement in rebooking rates.

**Phase 3 — Retention & Intelligence (Months 12–24)**
AI-assisted workout suggestions. Automated client check-ins. Long-term progress reporting. Possible client app. Location benchmarking.
Success metric: Measurable retention improvement. Coach onboarding under 1 hour.

## 13. UX/UI Principles & Screen Layout
The app must feel invisible during active sessions. Coaches think about the client in front of them, not the software.

### 13.1 Primary Session Screen — iPad Landscape
Change: Session column header structure updated. Set type badge repositioned to header. Movement classification (D/M/E) confirmed in exercise cell top-middle. Failure time added as dead-center mandatory cell element.
- Fixed left column: exercise name + machine settings — always visible, protected from accidental edit
- Session column header contains (top to bottom): date, RECURRING/FLEX badge, set type badge (S/T/E), LIVE indicator for current session
- Session columns: current session on far right; two previous sessions to its left — visible simultaneously
- Session history accessible at any time via clickable button; protected from accidental click
- New client with no history: previous session columns do not render until sessions exist
- Landscape orientation is primary — all session UI designed for this orientation

### 13.2 Exercise Cell Structure
Change: Cell layout updated: D/M/E in top-middle (replaces set type). Failure time in dead center — mandatory. Stopwatch elapsed in bottom-left. Set type shown in cell only on deviation from session default.
Position / Content / Notes
- Top left — Exercise abbreviation (e.g., HP, CP) — Always visible
- Top middle — Movement classification badge (D / M / E) — Replaces set type badge from v2.2 design
- Top right — Current weight input — Pre-filled from last session suggestion
- Dead center — Failure time — mandatory entry before advancing to next cell — Scroll-wheel picker (non-native); stylus (native); M exercises auto-captured with override
- Bottom left — Stopwatch — elapsed time — Manual start; stops on click or cell advance
- Bottom middle — Effort count if applicable (+#E or +#M) —
- Bottom right — Progression indicator (+amount / -amount / OK) — Coach-set
- Attached icon — Note icon — tap to open side panel — Closes without leaving workout view
- Deviation only — left side below abbreviation — Set type label (S/T/E) — Only shown when exercise deviates from session default. Positioned on the left side of the cell, directly below the exercise abbreviation. Small and secondary in visual weight — does not overlap weight input under any circumstances.

Change: Set type exception placement specified: left side of cell, directly below exercise abbreviation. Small and secondary — never overlaps weight input. Confirmed from Claude Design iteration.
Previous session weight is not shown inside the cell — it is visible in the adjacent previous session column.

### 13.3 Key UX Rules
- No modals during active logging — everything inline or in attached panels
- Weight input advances to next exercise on entry
- All touch targets minimum 44×44pt; session screen usable one-handed
- Keyboard appears only for text/note input; dismisses immediately after
- Settings column always visible on left — requires deliberate action to edit
- Color code (P/C/E) visible on all coach-facing views; never on client-facing views
- Auto-save on every field change — no save button anywhere
- Client name displayed above Start Session button to prevent accidental session start
- Failure time is mandatory — coach cannot advance to next cell without logging it

### 13.4 Schedule / Client List View
- Cards, not dense tables
- Session time, client name, color code badge, session status
- Pain clients may have distinct card background — designer decision
- Tap to open session; swipe to mark complete or no-show

### 13.5 Separate Screens
- Settings screen: per-client machine configuration; accessible from client profile and batch prep view
- ORIGINAL / Review screen: founding baseline and review history; shown during 6-session review gate
- Manager dashboard: mode toggle with manager code; not a separate app or login
- All screens use back navigation — no deep nesting

## 14. Coach Experience Optimization

### 14.1 Batch Prep Mode
- Read-only pre-shift scan of all today's clients in time order
- Each card: color code, last session summary, machine settings, expected workout
- Full shift review completable in under 5 minutes
- No accidental session start possible from this view

### 14.2 Settings Column
- Always visible on left side of session screen during active sessions
- Required during session to adjust machines as needed
- Protected: tap-and-hold or explicit edit mode required; reason note required
- All changes and reasons logged in dedicated settings audit log

### 14.3 ORIGINAL Screen
- Separate screen — not correlated with settings
- Shows founding baseline muscle failure weight per exercise — locked permanently
- Shows full review history log — append-only
- Displayed during 6-session review gate before session can start

### 14.4 Color Code System
Code / Meaning / Who Can Change
- P — Pain — Multiple ailments or significant customizations requiring consistent modification — Any coach or manager
- C — Caution — Some adjustments potentially needed; past injuries or occasional issues — Any coach or manager
- E — Easy — Rarely requires workout adjustments — Any coach or manager

All changes logged with timestamp and author. Never visible to clients.

### 14.5 Music & Fan Preferences
Always visible without scrolling on every session screen. Client comfort reduces perceived exertion — these are operational variables, not trivia.

## 15. Operational Efficiency

### 15.1 Daily Recap Format
Auto-generated from session data. Four structured note fields per client assembled automatically.

```
Practical Fitness — [Location] Daily Recap — [Date] Block [AM/PM]

Sessions scheduled: 12 | Completed: 10 | Late cancellations: 1 | No-shows: 1
Clients without next session booked: 3 — [Name], [Name], [Name]
Coach notes flagged for manager review: 1

[Client Name] — [Time]
Execution: Great session. Flexed into all muscle failure. Earned some increases.
Physical: Mild lower back tightness. Reduced LX weight 5 lbs. Form strong on HP.
Machine changes: LX knee position adjusted 3 to 4. Ongoing.
Personal: Heading to Denver this weekend; knee has been better.

[Client Name] — [Time]
Execution: Disengaged on a few sets. Suggested a couple decreases for next session.
Physical: No complaints. New working weight on Row.
Machine changes: None.
Personal: Started new job; energy lower than usual.
```

One tap copies as plain text to WhatsApp. All recaps stored permanently.

### 15.2 Follow-Up Flag Queue
Manager's morning view. Unscheduled clients listed for outreach. Primary MVP retention tool.

### 15.3 Exercise Database Standardization
Every exercise must have a locked canonical name, abbreviation, and default movement classification before development begins. Changing names or classifications mid-dataset corrupts historical data permanently.

## 16. Risks & Bottlenecks
Risk / Likelihood / Impact / Mitigation
- Rotation logic complexity — High — High — Document all rotation patterns before coding. Type B 5-session cycle and Type C A/B/C defined.
- Failure time mandatory gate — coach frustration — Medium — Medium — Design the scroll-wheel picker to be fast (under 3 taps). Test with actual coach before finalizing.
- Movement classification inconsistency — Medium — Medium — Lock default classification per exercise in database before seeding.
- Keyboard interrupting session flow — Medium — High — Keyboard appears only for note/text. Failure time uses scroll-wheel, not keyboard.
- Coach adoption resistance — Medium — High — Involve 1–2 coaches in design review. First experience must be faster than paper.
- Offline sync conflicts — Medium — Medium — Last-write-wins for MVP. Conflict resolution Phase 2.
- Bookeo integration delays MVP — High if attempted — High — Excluded from MVP. Non-negotiable.
- Legal exposure from health data — Low probability — Critical — 1-hour legal consultation before launch. Not optional.
- Single developer bottleneck — High — High — Mentor stays actively involved in architecture.
- Exercise list incomplete — Medium — High — Westlake list sufficient for prototype. Other locations before rollout.
- Scope creep — High — High — Every new request: does this make session logging faster or more reliable? If no, defer.
- Data loss offline/sync — Low with proper build — Critical — Local storage built before sync logic.

## 17. Scalability
Current scale: 224 clients, 6 coaches, 4 locations, ~10–14 sessions/location/day.
Target: ~500 clients, ~20 coaches. Supabase free tier handles this. Paid tier ($25/month) handles 10x growth.
Most critical decision: location as first-class database entity from day one.
Do not pre-optimize for AI. Clean Phase 1 data is the only prerequisite that matters.

## 18. Analytics & KPIs

**Phase 1 — Available from MVP Data**
- Sessions logged per week per location
- Coach prep time: session open to first exercise log
- Data completeness rate: % of sessions with all required fields filled
- Follow-up flag resolution: flagged → contacted → rebooked
- Exercise weight progression per client over time
- Failure time distribution per exercise — identify exercises where clients consistently fail early or late
- 6-session review completion rate and decline reason distribution
- 2222 override frequency by coach
- Movement classification override frequency by coach and exercise

**Phase 2 — Require Bookeo Integration**
- Attendance rate per client
- Cancellation and no-show rates by location, coach, time of day
- Client tenure distribution
- Average time between sessions
- Rebooking rate

Do not build analytics dashboards before data quality is proven. First 60 days will have inconsistent data.

## 19. Future AI & Data Opportunities

**6–12 Months Post-Launch**
- Weight progression flags: alert when client has plateaued 3+ sessions
- Failure time pattern analysis: identify optimal set duration targets per client per exercise
- Exercise swap suggestions from accumulated pain-area history
- Client risk scoring from attendance patterns

**12–24 Months Post-Launch**
- Automated workout variation generation
- Coach performance analysis: which patterns correlate with retention
- Predictive scheduling based on session history

Phase 1 data quality is the ceiling of Phase 3 AI capability. Get the data model right in MVP.

## 20. Recommended Development Sequence
Week(s) / Focus / Key Deliverables
- 1–2 — Foundation — Supabase schema (all tables including failure_time and stopwatch_elapsed fields, RLS, roles). Auth + PIN layer. Seed: 4 locations, Westlake exercise list with default movement classifications, 5–10 test clients.
- 3–4 — Client Profiles — Profile create/edit/view. Machine settings. Exercise order + auxiliary A/B/C config. Movement classification defaults. Personal details, color code, goal tags.
- 5–7 — Session Core — Schedule view. Session open + auto-population. Session-level set type header badge. Exercise cell: weight input, movement classification, stopwatch, failure time (mandatory gate), progression indicator. Scroll-wheel time picker. Pain intake. Coach notes (four fields). Session close.
- 8–9 — Rotation + Review Logic — Type A/B/C rotation engine. Shuffle button. 6-session gate with decline dropdown. ORIGINAL screen and review history. No-show rotation hold logic.
- 10 — Recap + Flags — Auto-generated daily recap (four-field format). Copy-to-WhatsApp. Follow-up flag queue. Body measurements with ACE reference. Settings audit log.
- 11 — Offline + Auth — Service worker. IndexedDB local storage. Sync-on-reconnect. PIN auth. 2222 override. Manager mode toggle.
- 12 — Polish + Test — Manager/owner dashboard. Client search. Unscheduled session flow. Client archival. Role-based access testing. iPad landscape UX test with actual coach — specifically test failure time entry speed.

Hard gate: do not begin Week 5 until Week 1–2 schema is finalized and reviewed with mentor.

## 21. Movement Classification (D/M/E)
Movement classification describes how an exercise is performed — the type of muscular effort. It is distinct from set type, which governs session duration.

### 21.1 Definitions
Classification / Label / Description
- Dynamic — D — Standard controlled movement through full range of motion. Most common classification.
- Metabolic — M — Higher tempo or circuit-style effort designed to elevate metabolic response. Failure time auto-captured from stopwatch.
- Eccentric — E — Emphasis on the lowering/lengthening phase; slower controlled negative.

### 21.2 How Movement Classification Works
- Each exercise in the standardized database has a default movement classification (D, M, or E).
- The classification follows the exercise rotation — stored in ClientExerciseOrder and advances with the rotation.
- Displayed in the top-middle of each exercise cell as a badge during every session.
- Coach can override the classification for any exercise in any session. Override logged in SessionExerciseLogs.
- Override does not change the stored default — applies to that session only unless coach explicitly updates client's exercise order.
- Not required in the daily recap unless the coach specifically noted it.

### 21.3 Special Behavior for M (Metabolic) Exercises
Change: M exercise failure time behavior documented in this section.
- M exercises auto-capture the stopwatch elapsed time as the failure time when the stopwatch stops.
- This auto-captured time appears in the dead center of the cell.
- Coach can override the auto-captured time via scroll-wheel picker (non-native) or stylus (native) if the stopwatch was not stopped at the correct moment.
- The failure_time_source field records whether the value was 'auto' or 'manual'.

### 21.4 Separation from Set Type
Concept / What It Is / Where It Lives / Who Sets It
- Movement Classification (D/M/E) — How the exercise is performed — Exercise cell — top middle badge; stored in ClientExerciseOrder — Set by default in exercise database; coach-overridable per session
- Set Type (S/T/E) — Duration of the set: S=1:30, T=2:15, E=3:00 — Session column header badge — shown once; exercise cell only on deviation — Set at session level; exercise-level override when deviating from default

These two concepts are fully independent. A Dynamic exercise can run at any set type duration.

## 22. Native-Only Requirements
The following features exist in the native iOS app only. The web app is a learning and testing vehicle. Chuck's native app is the production product.

### 22.1 Stylus Input for Exercise Notes and Failure Time
Change: Stylus scope expanded to include failure time entry in addition to exercise notes.
- Coach taps note icon on any exercise cell — panel opens optimized for Apple Pencil input.
- Coach writes note freehand; converts to readable text; closes with one tap.
- For failure time entry: coach writes the time with stylus in the dead center of the cell.
- Functionally equivalent to scroll-wheel picker on web app — faster and more natural mid-session.
- Web app equivalent: keyboard pop-up for notes; scroll-wheel picker for failure time.

### 22.2 Apple Music Integration
- Client profile stores a pre-linked Apple Music playlist — set by coach during profile setup.
- When a session opens, the client's music begins playing automatically via Apple Music.
- In-app music controls available throughout the session: play/pause, skip, volume.
- Coach never needs to leave the app to manage music during a client session.
- If client wants something different: coach can search Apple Music from within the app without leaving session view.
- Web app equivalent: music preference stored as text field only; no playback capability.

### 22.3 Native vs. Web Feature Comparison
Feature / Web App (PWA) / Native iOS App
- Exercise notes input — Keyboard pop-up — Stylus (Apple Pencil) panel
- Failure time input — iOS scroll-wheel picker — Stylus — write time directly in cell
- Music preference — Text field only — Pre-linked Apple Music; auto-plays; in-app controls
- Offline capability — Service Worker + IndexedDB — Native offline storage — more reliable
- Session logging — Full feature parity — Full feature parity
- Rotation logic — Full feature parity — Full feature parity
- App Store distribution — Not applicable — PWA — Required — Apple Developer Program ($99/year)

## 23. Consultation & Onboarding Workflow
The consultation form is the founding event for every client record. It establishes the ORIGINAL baseline — the locked weight reference used throughout the client's history.

### 23.1 Fields Captured at Consultation
Field / App Treatment / Notes
- Name — Client profile — text field —
- Age — Calculated from DOB —
- Sex — Client profile — open text field — Added in v2.2
- Date — Consultation timestamp — Seeds OriginalBaselines record
- Height — Client profile — text field —
- Weight — Body measurements — dated entry — First WT/BF/WS entry
- Body Fat % — Body measurements — dated entry with ACE reference table —
- Waist — Body measurements — dated entry —
- Exercises with movement classification — ORIGINAL baseline per exercise — Each exercise listed with D/M/E beside it
- Set type at consultation — Session header badge — Shown once at top of consultation form
- Auxiliary slots — AuxiliaryConfig — A/B/C assignments — Blank slots filled by coach at consultation
- Goals / Ideal Outcome — Goal tags + free text on client profile —
- Special Concerns — Physical limitations & injuries field — Free text; no diagnostic labels

### 23.2 Consultation Workflow in the App
- New client arrives for consultation before first session.
- Coach opens app — creates new client profile.
- Enters all fields from consultation form.
- Sets machine settings for each exercise — stored defaults.
- Records founding baseline weights and failure times per exercise — seeds OriginalBaselines (permanently locked).
- Sets movement classification per exercise — seeds ClientExerciseOrder defaults.
- Assigns Auxiliary A/B/C exercises — seeds AuxiliaryConfig.
- Records initial body measurements.
- Session counter starts at zero — 6-session review cycle begins from first session.

### 23.3 ACE Body Fat Reference Table
Category / Women (% fat) / Men (% fat)
- Essential Fat — 10–12% — 2–4%
- Athletes — 14–20% — 6–13%
- Fitness — 21–24% — 14–17%
- Acceptable — 25–31% — 18–25%
- Not Acceptable — 32% plus — 25% plus

## Appendix A: Workout Sheet Data Model Analysis
Change: Failure time added as a distinct logged field. Stopwatch elapsed added as separate field. Movement classification updated to reflect session override storage.
Sheet Field / App Treatment / DB Type
- Client name — Text field — varchar
- Color (P/C/E) — Enum dropdown + change log — enum + log table
- Music preference — Text field; always visible — varchar
- Fan preference — Text field; always visible — varchar
- Sex — Open text field on client profile — varchar
- Location — Linked to locations table — foreign key
- Age — Calculated from DOB — computed
- Height — Text field — varchar
- WT/BF/WS — Dated measurements table with ACE reference — decimal + date
- D/M/E (movement classification) — Enum: Dynamic / Metabolic / Eccentric — stored in ClientExerciseOrder; session override in SessionExerciseLogs — enum
- S/T/E (set type) — Session-level enum: Strength / Tone / Endurance — session column header badge; exercise cell only on deviation — enum, session-level
- Failure time — Mandatory integer (seconds) per exercise per session — dead center of cell — integer, mandatory
- Stopwatch elapsed — Auto-captured integer (seconds) — bottom-left of cell — integer, auto
- Recurring/Flex — Replaced by Membership/Package type + completion date — enum + date
- Customization notes — Free text on profile — text
- Goal buttons — Multi-select tags + free text — array/junction
- ORIGINAL row — Locked founding baseline — decimal, immutable
- Settings row — Structured fields per machine — fixed left column — jsonb or normalized
- Date columns — Session date auto-captured — timestamp
- Weight per exercise — Decimal input per SessionExerciseLog — decimal
- Exercise order rows — ClientExerciseOrder with rotation type, index, movement classification — ordered junction
- REVIEW column — ReviewHistory append-only table — visually distinct — decimal + session ref
- Goals / Ideal Outcome — Goal tags + free text on profile — text/array
- Special Concerns — Physical limitations & injuries field — text

Pending: Exercise master log in progress by Michael. Hard blocker before Week 1 database seeding.
Pending: Exercise lists for other 3 locations not yet provided. Required before multi-location rollout.

## Appendix B: Remaining Gaps
- Gap: Exercise Master Log — Canonical exercise list with full names, abbreviations, and default movement classifications is in progress by Michael. Hard blocker before Week 1–2 database seeding.
- Gap: Exercise Lists for Other 3 Locations — Westlake sufficient for prototype. Other locations required before rollout. Machine settings fields may vary.
- Gap: Mid-Shift Coach Replacement — Documented as known gap; deliberately deferred. Not a prototype requirement.

## Appendix C: Resolved Decisions Log
Decision / Resolution
- No-show rotation behavior — Rotation index does NOT advance. Next coach gets same workout client missed.
- 6-session counter reset — 2-month absence triggers new baseline review. Counter resets. Does not replace founding ORIGINAL.
- Recurring/Flex flags — Replaced by Membership/Package type + completion date field.
- Stylus input — web app — Deferred from web app. Native app only — Section 22.
- Client archival — Archived and accessible. Not deleted. Reactivatable.
- Walk-in clients — Rare. Coach searches client, triggers full session log as unscheduled.
- Total session duration — Per-exercise duration sufficient. No session-level timer required.
- Settings audit log — Dedicated log separate from coach notes with reason required.
- Session screen orientation — iPad landscape. Fixed settings column left. Current session right. Two previous sessions visible.
- Exercise cell layout — Top left: abbreviation. Top middle: movement classification (D/M/E). Top right: weight. Dead center: failure time (mandatory). Bottom left: stopwatch elapsed. Bottom right: progression. Note icon attached.
- Previous session weight display — Visible in adjacent previous session column — not inside current cell.
- Empty state for new clients — Previous session columns do not render until sessions exist.
- Progression indicator — Coach-set per exercise. Not algorithm-driven.
- Type C auxiliary rotation — Auxiliary A/B/C alternate per session. Coach sets and modifies. History viewable and restorable.
- Auxiliary revert behavior — Reverts replace current config going forward. History retained.
- Auth model — Name selection + 4-digit PIN. 2222 override with name selection. All sessions attributed.
- Manager mode — Mode toggle within app. Unique manager code per manager.
- Review decline reasons — Dropdown with Other free-text option. Any coach can decline with reason.
- OHP / INC slot — Same Type B slot. Interchangeable. Set per client by coach.
- S/T/E — set type — Session column header badge. S=1:30, T=2:15, E=3:00. Exercise cell shows set type only on deviation from default.
- D/M/E — movement classification — Top-middle badge in exercise cell. Follows exercise rotation. Coach-overridable per session. Stored in ClientExerciseOrder.
- Set type badge position — Positioned in session column header below RECURRING/FLEX badge, above exercise rows.
- Failure time — Mandatory per exercise. Dead center of cell. Separate from stopwatch. M exercises auto-captured with override. S/E exercises manual via scroll-wheel.
- Stopwatch behavior — Manual start. Stops on intentional click or cell advance. Elapsed time stored in bottom-left of cell. Independent from failure time.
- Failure time — M exercise source — Auto-captured from stopwatch. Override available via scroll-wheel (non-native) or stylus (native). failure_time_source field records 'auto' or 'manual'.
- Time picker — non-native — iOS-style scroll wheel for minutes and seconds.
- Machine settings corrections — Ab ISO R = range of motion. Leg Extension R = leg range of motion. Incline/OHP I and O = range of motion.
- Sex field — Added to client profile. Open text field. Captured at consultation.
- Web app vs native app — Web app = learning and testing vehicle. Native app = production product. No transition required.
- Native-only features — Stylus for notes and failure time; Apple Music integration — Section 22.
- Apple Music implementation — Coach pre-links Apple Music playlist to client profile. Auto-plays on session open. In-app controls throughout.
- Set type exception cell position — Left side of cell, directly below exercise abbreviation. Small and secondary visual weight. Never overlaps weight input.
- Coach notes — four fields — Execution / Physical / Machine Changes / Personal.
- Consultation workflow — Gap closed. Section 23 documents full onboarding workflow.
- ACE body fat reference — Surfaced to coaches when entering BF% measurements.

## Appendix D: MVP Readiness Score
Area / Score / What Remains
- Business Clarity — 9 / 10 — MVP vs. full-product goals clearly separated. Phase gate criteria defined.
- Product Clarity — 9.5 / 10 — Consultation workflow closed. Movement classification formally defined. Failure time documented. Native-only requirements documented.
- Technical Clarity — 9.5 / 10 — Stack, data model, rotation logic, failure time fields, auth all specified. Cell layout locked from design review.
- Workflow Clarity — 9.5 / 10 — All primary workflows documented. Stopwatch and failure time behavior fully specified.
- Data Model Clarity — 8.5 / 10 — All entities defined. Failure time fields added. Exercise master log still in progress — hard blocker for Week 1.
- Security Readiness — 5 / 10 — ACTION REQUIRED — Legal consultation not completed. Must resolve before real client data enters system.

**OVERALL: 8.8 / 10 — Ready for Design Phase and Claude Code Build | Session Screen Design Confirmed**

Ready to hand to a designer and begin Claude Code web app build. Hard blockers: (1) legal consultation before real client data; (2) exercise master log before Week 1 database seeding.

**Recommended Next Steps — In Order**
1. Complete exercise master log — hard blocker for Week 1.
2. Feed PRD v2.3 and design iteration into Claude Design for next screen update.
3. Begin Week 1–2 database schema work with mentor.
4. Book 1-hour legal consultation before prototype goes live with real client data.
5. Begin Claude Code web app build using development sequence in Section 20.
6. Provide exercise lists for other 3 locations before multi-location rollout.
7. Conduct iPad landscape UX test with one coach at end of Week 12 — specifically test failure time entry speed.
