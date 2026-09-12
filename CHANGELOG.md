# LSCSO Lifetime Changelog

This file is the authoritative development history for the Los Santos County Sheriff’s Office public website and Personnel Portal. Administration → Lifetime Changelog renders this file directly.

## Changelog rules

- Every functional create, add, remove, fix, security change, workflow change, schema change, permission change, integration change, or operational behavior change must include a dated entry in this file in the same change set.
- Dates use the LSCSO operating date in America/New_York.
- Historical entries from August 20 through September 11, 2026 were backfilled from the repository commit history and database migrations. Temporary implementation churn and immediately reverted experiments are summarized by the meaningful final behavior rather than copied as raw Git noise.
- Git remains the forensic commit-level record. This changelog records the lasting system capability and behavior people actually need to understand.

## 2026-09-12

### Added
- **Administration — Lifetime Changelog**: Added an Executive Administration workspace that renders the permanent repository changelog as a searchable, filterable dated timeline with lifetime statistics.
- **Personnel Directory — Three Personnel File Release Profiles**: Added Internal Personnel File, Lateral Transfer Personnel File, and Open Records Request Personnel File export profiles without requiring staff to open the member’s full record first.
- **Personnel Records — Destination / Requesting Party Transmittal**: Added a required destination department, receiving agency, organization, or requesting party before a personnel PDF can be generated, and placed the destination and subject member directly into the generated packet.
- **Public Site — Open Records Request Intake**: Added a public `/open-records` request workflow requiring requester identity, email, Discord username, requested-record description, optional personnel subject details, legal acknowledgment, and a permanent ORR request number.
- **Open Records — Private Tracking Links**: Added application-style private request links generated at submission so requesters can follow the 72-hour response deadline, fee assessment, in-city payment status, release disposition, withholding authority, and electronic file release.
- **Open Records — Fee and In-City Payment Workflow**: Added First Lieutenant+ fee assessment, requester-visible pricing, payment holds, and authorized in-city payment confirmation before paid requests advance to records collection.
- **Open Records — Protected Electronic Release**: Added private release-file storage, First Lieutenant+ file staging, full/partial/denied dispositions, legal withholding citations, secure download links, and a 48-hour requester download window.
- **Open Records — Automatic Release Purge**: Added a scheduled Supabase purge worker that removes expired temporary release files from private Storage after the 48-hour window while retaining the permanent request and audit history.
- **Administration — Open Records Records-Custodian Workspace**: Added a First Lieutenant+ Administration workspace for acknowledgment, fee assessment, payment confirmation, collection, redaction/legal review, file upload, release, denial, and permanent request history.
- **Administration — Open Records Dedicated Request Screens**: Added dedicated Records Custodian request pages so the Administration queue stays compact and each ORR opens into its own full workflow screen.
- **Records Law — San Andreas Open Records Act**: Added OCSA § 50-18-70 et seq. to the Code of San Andreas as a Government Transparency Act outside the felony, misdemeanor, and infraction classifications. Georgia material remains development/reference context rather than public ORR-page content.
- **Recruitment — Employment Offers and Closure**: Added employment-offer handling, recruitment closure behavior, and tracking-expiration support so completed candidate cases can close cleanly without losing their history.
- **Personnel — Promotion Review Workflow**: Added structured promotion review and required approved promotion review before rank increases are finalized.
- **Personnel — Rehire and Reinstatement Workflow**: Added a structured return-to-service review that reuses the member’s existing permanent personnel record rather than creating a disconnected identity.
- **Training — Permanent Training History**: Added permanent completed-training history, prior/lateral training support, and entry-training dispositions so training records are not limited to active Recruit/FTO progress.
- **Guardian — Performance Evaluations**: Added Guardian-native performance evaluations so evaluations remain part of the member’s permanent accountability and personnel history.

### Changed
- **Personnel Records — Distinct Release Products**: Separated personnel exports into materially different products rather than cosmetic labels. Internal Personnel File is the fuller departmental record; Lateral Transfer Personnel File is an inter-agency employment/background packet that excludes internal administrative flags and Portal/access-control metadata; Open Records Request Personnel File is a narrower public-release review copy that excludes Guardian/accountability material, administrative flags, internal access data, and internal narrative notes.
- **Personnel Records — Export Type Selector**: Consolidated personnel export actions into one export workflow with an explicit Internal, Lateral Transfer, or Open Records Request selector so staff choose the release profile before generating the file.
- **Personnel Records — LSCSO-Branded PDF Presentation**: Reworked generated personnel PDFs with LSCSO dark/gold branding, official classification headers, release-purpose treatment, branded section dividers, and branded page footers.
- **Personnel Records — Server-Enforced Release Scope**: Enforced section allowlists by export type on the server so changing URL parameters cannot convert an Open Records or Lateral packet into the fuller internal personnel file.
- **Personnel Records — Document Classification Headers**: Added distinct running PDF labels for INTERNAL PERSONNEL FILE, LATERAL TRANSFER PERSONNEL FILE, and OPEN RECORDS RELEASE COPY so separated pages retain their release classification.
- **Open Records — OCSA Public Response Model**: Public requester pages now present only the operational San Andreas requirements: a 72-hour initial determination, any assessed in-city fee, release status, lawful withholding/redaction, and the 48-hour download window. Detailed statutory information is linked to the published Open Records Act instead of reproduced across the page.
- **Open Records — Records Custodian Authority**: Restricted LSCSO completion authority to Sheriff, Undersheriff, Major, Captain, and 1st Lieutenant. Lower ranks may assist but cannot assess fees, confirm payment, approve withholding, deny, or publish a release.
- **Open Records — Custodian Legal Citation Prompt**: Kept the operational custodian workflow focused on OCSA and other controlling San Andreas authority rather than showing Georgia-development reference language in the request UI.
- **Recruitment — Applicant Dispositions**: Clarified applicant disposition reasons and status semantics so closures and adverse outcomes preserve a clearer historical explanation.
- **Personnel History — Record Continuity**: Extended promotion, rehire/reinstatement, training, and Guardian workflows around the existing permanent personnel record instead of creating duplicate records.

### Fixed
- **Public Site — Open Records Navigation**: Integrated Open Records directly into the primary desktop and mobile navigation and removed the separate public-services strip that caused clipping and overlap on mobile.
- **Public Site — Open Records Readability**: Removed the dense dual-law cards and corrected heading/text contrast on light Open Records surfaces so public headings no longer render as low-contrast white text.
- **Public Site — Open Records Act Button Contrast**: Reworked the Open Records Act links on the public intake and private request-status pages into high-contrast dark/gold buttons so they remain clearly visible on the light background.
- **Personnel Records — Export Dialog Layout**: Removed horizontal overflow and cut-off controls from the personnel export modal, including mobile-safe sizing and action wrapping.
- **Personnel Records — Georgia Export References**: Removed Georgia-development law content from personnel export UI and generated personnel PDFs. Open Records personnel copies now present only the applicable OCSA authority; Internal and Lateral files do not carry an unrelated Open Records legal section.
- **Personnel Records — Internal File Naming**: Replaced user-facing “Normal Personnel File” wording with “Internal Personnel File” throughout the export experience and generated document presentation.
- **Personnel Records — PDF Character Rendering**: Preserved supported WinAnsi characters such as the section symbol in generated personnel PDFs instead of replacing them with question marks.
- **Personnel Records — Mobile Section Navigation**: Made the personnel-record section tabs horizontally swipeable on mobile so Overview, Administration, Training & Certifications, Accountability, Recognition, Documents, and Service History remain reachable instead of being clipped off-screen.
- **Open Records — Tracking Token Crypto**: Corrected the secured public-submission RPC to resolve pgcrypto from the Supabase extensions schema so private request keys generate reliably while only their SHA-256 hashes are retained.

### Security
- **Open Records — Original Request Preservation**: Restricted staff updates to workflow fields so the requester’s original identity, Discord username, requested-record description, and subject information remain preserved after submission.
- **Open Records — First Lieutenant+ RLS**: Restricted request, release-file, event, and private Storage access to active Sheriff, Undersheriff, Major, Captain, or 1st Lieutenant personnel at the database-policy layer in addition to route/UI checks.
- **Open Records — Private Tracking Tokens**: Stores only a one-way hash of each private requester tracking key and exposes requester-facing status only through the matching protected lookup function.
- **Open Records — Private Release Storage**: Kept release files in a non-public Storage bucket and exposes them only through time-limited signed download links after an authorized custodian publishes the release.
- **Personnel Records — Public Release Guardrails**: Prevented the Open Records release profile from including Guardian/accountability records, administrative flags, or internal Portal/access metadata through client-side parameter changes.

### Operations
- **Open Records — 48-Hour Retention Automation**: Scheduled a 15-minute purge check so expired electronic release copies are removed promptly after their 48-hour availability window and the purge is written to permanent request history.
- **Governance — Changelog Enforcement**: Added repository enforcement so future functional changes are required to update this lifetime changelog in the same change set.

## 2026-09-11

### Added
- **Recruitment — Command Applicant Preview**: Added a Command-side applicant tracking preview so authorized staff can see the same status presentation applicants receive.
- **Recruitment — Original Tracking Link Visibility**: Exposed the original applicant tracking link to authorized Command staff for troubleshooting and applicant support.

### Changed
- **Recruitment — Shared Applicant Status View**: Reused one shared status/tracking presentation between applicant tracking and Command preview to reduce duplicated behavior and status drift.

## 2026-09-10

### Fixed
- **Recruitment — Tracking Link Recovery**: Added recovery handling for existing applicant tracking links so access can be restored without creating a second application or losing the original application history.

## 2026-09-09

### Added
- **Recruitment — Interview Stage**: Added an interview stage and related Command notifications to move qualified applications into a visible interview workflow.
- **Recruitment — Form Builder**: Added configurable recruitment questions and question-editor support so application content can be managed without rebuilding the entire recruitment flow.
- **Recruitment — Applicant Tracking**: Added applicant-facing tracking and status history so applicants can follow a submitted application after submission.
- **Recruitment — Applicant Communications History**: Added permanent applicant status-message and communication history with authorized Command visibility.
- **Recruitment — Administrative Delete Controls**: Added protected administrative cleanup controls for recruitment records where removal is explicitly authorized.
- **Recruitment — Hire Handoff**: Added the website-side handoff from an approved recruitment case into personnel hiring while keeping acceptance separate from actual hiring.
- **Personnel — Manual and Open-Ended Leave**: Added Command entry of personnel LOA records, including open-ended leave when an end date is not yet known.
- **Personnel — Family Leave Types**: Added paternity and maternity leave classifications to the leave workflow.
- **Policy — AI Use Acknowledgment**: Added applicant acknowledgment of the recruitment AI-use policy and corrected the acknowledgment wrapper behavior.

### Changed
- **Recruitment — Atomic Command Actions**: Routed Command recruitment mutations through workflow RPCs so status changes are performed as controlled, atomic actions instead of loose direct edits.
- **Recruitment — Website-Authoritative Hiring**: Paused the FiveM recruitment portal handoff and kept recruit hiring authoritative on the website while the game integration remains intentionally separated.
- **Recruitment — Certification Text**: Canonicalized recruitment certification/acknowledgment text so the applicant and Command records use consistent language.
- **Recruitment — Protected Question Rules**: Refined which recruitment question fields are protected while preserving the identity fields required for the intended application workflow.

### Fixed
- **Public Site — Discord Embed Presentation**: Polished social/Discord embed behavior and launch presentation after recruitment and public-site changes.
- **Launch — Production Hardening**: Cleaned up launch-time advisor and workflow issues that could create confusing or stale production behavior.

## 2026-09-08

### Added
- **Recruitment — Command Hire Handoff**: Added the first Command-side handoff from a recruitment decision toward personnel onboarding.
- **FiveM Integration — Personnel Sync Outbox**: Added a durable outbox for personnel synchronization so website personnel changes can be queued for game-side processing without making FiveM authoritative.
- **FiveM Integration — Personnel Lifecycle Sync**: Added lifecycle synchronization events for supported personnel changes.
- **Guardian — Purview and Division Scope**: Added Guardian scoping based on organizational purview and division authority.

### Fixed
- **FiveM Integration — Service Personnel Sync**: Added catch-up handling around personnel service changes so supported lifecycle events are not silently skipped.

## 2026-09-07

### Added
- **Portal — LSCSO Mail**: Added the internal LSCSO mail system for protected department correspondence inside the Personnel Portal.

## 2026-09-03

### Added
- **FiveM Integration — Identity Links**: Added website-to-FiveM identity linking and pairing-code support.
- **FiveM Integration — Government Workstation Authentication**: Added authentication support for government-mode FiveM workstations.
- **Administration — Maintenance Center**: Added protected controls for public-site, Personnel Portal, and full-site maintenance operations.

### Changed
- **Maintenance — Executive Continuity**: Preserved authorized Executive access during full-site maintenance through the dedicated maintenance login so the Sheriff or Undersheriff can restore service.
- **Maintenance — Navigation Behavior**: Disabled affected navigation for users inside a maintenance scope while preserving the correct `/portal` continuity behavior for unaffected/authorized users.

### Fixed
- **Maintenance — Scope Behavior**: Corrected Personnel Portal Only, Public Website Only, and Entire Website maintenance scopes so each selection affects only the intended service and restores stale scope state from a previous selection.
- **Maintenance — Scope Clarity**: Updated maintenance-control names and descriptions so the exact outage scope is clear before an Executive confirms the change.

## 2026-09-02

### Added
- **Personnel — Probation Tracking**: Added personnel probation state and supporting review data to the permanent personnel workflow.
- **Recruitment — Screening**: Added recruitment screening support before later interview and hire stages.

### Changed
- **Hiring — Automatic Probation Window**: New-hire processing now establishes the appropriate probation window automatically instead of requiring a separate disconnected update.

## 2026-09-01

### Added
- **Certifications — Expiration Policies**: Added certification expiration-policy support so time-limited qualifications can be represented and reviewed consistently.
- **Public Information — PSA Publishing Controls**: Added Command-controlled PSA publishing and public-read behavior.
- **Portal — Browser Push Notifications**: Added browser push notification infrastructure for actionable portal events.
- **Recruitment — Application Availability Controls**: Added controls for whether public recruitment applications are currently available.
- **Personnel — Correspondence**: Added protected personnel correspondence tied to the department record.
- **Command — Assignment Records**: Added Command assignment support as part of the personnel/organizational model.
- **Personnel Requests — Routing and Review**: Added structured request routing, assigned reviewers, and review state instead of relying on loose request handling.

### Security
- **PSA — Protected Publishing**: Restricted PSA mutations to authorized Command paths while retaining intentional public read access for published content.
- **Personnel Requests — Reviewer Visibility**: Added permission-aware assigned-reviewer access so request review data is visible to the people actually authorized to act on it.

## 2026-08-31

### Added
- **Recruitment — Public Application System**: Added the website recruitment application and permanent application records.
- **Recruitment — Command Review Workflow**: Added internal Command review state and supporting review data for submitted applications.
- **Recruitment — Applicant Signature**: Added applicant signature/attestation support to preserve the submitted application as an attributable record.

### Changed
- **Recruitment — Shortened Application**: Reduced and reorganized the public application to remove unnecessary friction while preserving required review information.

### Fixed
- **Recruitment — Submission Policy**: Corrected application submission policy behavior so the public intake works through the intended protected path.
- **Recruitment — Review Indexing**: Added supporting indexes around recruitment review data to keep review queries efficient as applications accumulate.

## 2026-08-30

### Added
- **Administration — Automatic Personnel IDs**: Added automatic next-personnel-ID assignment during account creation and surfaced generated IDs in Personnel Accounts administration.

## 2026-08-23

### Added
- **Command — Delegated Authority Management**: Added time-bounded personnel delegation controls and a Command interface for managing and reviewing delegated authority packages.
- **Personnel — Protected Account Reactivation**: Added a controlled reactivation workflow for deactivated personnel accounts instead of treating return access as a brand-new account.
- **Personnel — Separated Personnel Archive**: Added a protected archive view for separated personnel while preserving their historical record.
- **Administration — Personnel Accounts**: Added the Personnel Accounts Administration workspace and moved account creation out of the roster into the correct administrative area.
- **Training — Operational Training Board**: Rebuilt Command training into an operational board with practical training/FTO controls rather than a passive status page.
- **Training — Individual Training Record**: Expanded each personnel record with training history and current training context.

### Changed
- **Organization — Shared Assignment Authority**: Updated the Command roster, training, and personnel directory to use the shared organizational assignment/authority model instead of independent local interpretations.
- **FTO — Certification Is Authority**: Made active FTO certification the authoritative source of FTO privileges and removed rank-only FTO authority.
- **Personnel — Operations Routing**: Routed personnel changes through the Personnel Operations layer while retaining required existing roster controls.
- **Portal — Action and Notification Center**: Unified notification/action-center header behavior and removed duplicate action controls.
- **Personnel — Deactivation Lifecycle**: Deactivation now closes active FTO authority and preserves a protected inactive/separated state instead of destroying the profile.

### Fixed
- **Accounts — Generated Credential State**: Corrected generated-credential handling during account lifecycle transitions.
- **Personnel — Termination Lifecycle Events**: Aligned termination/deactivation behavior with supported permanent career-event types.
- **Notifications — Profile Context**: Corrected notification workspace profile context so actions are attributed and scoped to the signed-in member correctly.
- **Organization — New Personnel Assignment Sync**: Ensured newly created personnel receive the intended shared primary organizational assignment.

### Security
- **Accounts — Delegated Administration**: Hardened delegated personnel-account authority so delegation grants only the intended administrative scope.
- **Certifications — Delegated Permissions**: Enforced delegated certification permissions in both service logic and UI presentation.
- **Personnel — Deactivated Profile Protection**: Prevented deactivated personnel from being casually mutated through active-roster workflows.

## 2026-08-22

### Added
- **Public Site — Historical Administrations**: Added LSCSO historical administrations and prior Undersheriff history to the About experience.
- **Public Site — Discord-Safe Social Card**: Added a stable static social-preview endpoint/image so Discord and other link previews can render LSCSO branding reliably.

### Changed
- **Public Site — Desktop Navigation**: Refined desktop navigation and grouped division pages into a cleaner divisions dropdown.
- **Public Site — Office of the Sheriff**: Rebuilt the Office of the Sheriff page presentation and structure.
- **Public Site — Department History**: Expanded department-history content and leadership history.

### Fixed
- **Public Site — Text Contrast**: Improved dark-section text contrast on History and Join content.
- **Public Site — Social Preview Reliability**: Pointed social metadata to the stable branded card after testing dynamic and static preview behavior.

## 2026-08-21

### Added
- **Personnel Portal — Production Launch**: Launched the authenticated production Personnel Portal and moved it onto the LSCSO government production domain.
- **Personnel Portal — Core Schema and Access Model**: Added the initial Supabase-backed personnel schema, portal profiles, rank/access tiers, and protected server-side workflows.
- **Portal — My Office**: Added My Office for every rank, including personal service information, points, awards, flags, leave, and access to elevated workspaces when authorized.
- **Command — Command Portal Workspaces**: Added Command navigation and workspaces for personnel, approvals, service records, certifications, leave review, training, and administrative operations.
- **Command — Activity and Audit Center**: Added a dedicated Command activity/audit workspace for recorded portal and administrative activity.
- **Command — Approvals Center**: Added a dedicated approval/review workspace for matters requiring Command action.
- **Personnel — Permanent Service Records**: Added service-record history including awards, personnel flags, leave, certifications, and career actions.
- **Personnel — Document Vault**: Added protected personnel-document storage for records that belong with the member’s permanent file.
- **Personnel — Career History**: Added durable career/service history so rank and employment changes can be preserved rather than overwritten without history.
- **Personnel — Identity Management**: Added protected personnel identity management and supporting profile lifecycle controls.
- **Personnel — Call Sign Assignment**: Added atomic call-sign assignment so duplicate/conflicting call signs cannot be created by concurrent updates.
- **Guardian — Permanent Accountability Ledger**: Added Guardian case numbering, disciplinary/accountability records, point totals, acknowledgments, signatures, and synchronization with the disciplinary ledger.
- **Certifications — Request and Issuance Workflow**: Added certification request, Command issuance, certification numbering, permanent/removable certification rules, and FTO certification authority.
- **Leave — Personnel LOA Workflow**: Added personnel LOA requests, Command review, and the supporting leave approval queue.
- **Organization — Authority and Purview Model**: Added the organizational authority foundation, shared units/assignments, purview rules, directed actions, recusals, and migration away from legacy division-only assumptions.
- **Training — FTO and Certification Context**: Added the foundation for training progress, FTO authority, and certification-backed training permissions.
- **Public Site — Branded Social Preview**: Added LSCSO social-preview branding and metadata for shared public links.

### Changed
- **Portal — Mobile Command Experience**: Finalized responsive/mobile Command Portal layouts and production workflows.
- **Portal — Live Supabase Workflows**: Replaced placeholder/static Command views with live Supabase-backed personnel, leave, certification, and approval data.
- **Guardian — Point Synchronization**: Synchronized Guardian points with the disciplinary ledger so accountability totals are derived from the permanent record.
- **Organization — Legacy Division Migration**: Seeded the shared organizational model from legacy division data and began retiring duplicate unit/division representations.

### Fixed
- **Portal — Authenticated Personnel Actions**: Corrected authenticated action handling so personnel actions execute under the intended signed-in context.
- **Database — Session Event Safety**: Hardened session-event RPC execution and production request paths.
- **Database — Supporting Indexes**: Added foreign-key and workflow indexes needed by the growing personnel, Guardian, certification, and organizational data sets.

### Security
- **Database — RLS and Data API Hardening**: Hardened Supabase Data API privileges, request RLS, and permission boundaries for protected personnel data.
- **Guardian — Privacy and Immutability**: Removed unnecessary IP storage, protected immutable/system-managed Guardian fields, and restricted subject/record visibility to the intended roles.
- **Personnel — Atomic Deactivation**: Added atomic profile deactivation rather than piecemeal account-state changes.
- **Portal — Search Exclusion**: Kept authenticated personnel portal routes out of public search indexing.

### Removed
- **Public Site — Warrant Information**: Removed public warrant information from navigation and decommissioned the public warrant page.
- **Recognition — Deputy of the Month Medal**: Removed the obsolete Deputy of the Month medal/catalog behavior from the personnel recognition system.

## 2026-08-20

### Added
- **Repository — LSCSO Website Project**: Initialized the `nmiller3300/lscso` repository at approximately 6:11 PM ET, establishing the source history this lifetime changelog now covers.
- **Public Site — Initial LSCSO Website**: Built the first LSCSO public website structure and core public-facing pages.
- **Branding — Repository-Hosted Assets**: Added GitHub-hosted department brand assets for reliable website use.

### Operations
- **Development — Source-Control Baseline**: Established Git as the authoritative forensic history for all subsequent LSCSO website and Personnel Portal development.