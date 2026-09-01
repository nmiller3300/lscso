export type PolicyRegisterEntry = {
  name: string;
  link: string;
  priority: "High" | "Medium" | "Low";
  section: "General Orders" | "Personnel" | "Patrol" | "Training" | "Internal Affairs" | "Special Operations";
  status: "Final";
  lastUpdated: string;
};

// Source of truth: LSCSO Policy Docu-Guide -> Policy Document Register in Notion.
// The website is an index only. Policy Link always opens the controlling Notion directive.
export const POLICY_REGISTER_SOURCE = "LSCSO Policy Docu-Guide";
export const POLICY_REGISTER_SYNCED_AT = "2026-08-30T23:19:12Z";
export const POLICY_DOCU_GUIDE_URL = "https://app.notion.com/p/3c2305c95585809fad29feb828d9833f?pvs=204";

export const policyRegister: PolicyRegisterEntry[] = [
  { name: "LSCSO Command Leadership Directive", link: "https://app.notion.com/p/3cc305c9558581f2802fc0516b0cf67d?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:15:50Z" },
  { name: "LSCSO Master Policy Directive", link: "https://app.notion.com/p/3cc305c9558581c4bbafcdb16aee0b40?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:15:39Z" },
  { name: "PD 100.00 | LSCSO Defined", link: "https://app.notion.com/p/3cc305c95585810f9686f6eca9a45dd7?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:16:02Z" },
  { name: "PD 102.20 | Enforcement Operations Levels (EOL)", link: "https://app.notion.com/p/3cc305c9558581feaa72c121c58ba6cd?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:16:16Z" },
  { name: "PD 104.40 | Continuity of Operations Plan", link: "https://app.notion.com/p/3cc305c9558581e3a00dfd1e88797d19?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:16:26Z" },
  { name: "PD 118.80 | Chain of Command and Reporting Structure", link: "https://app.notion.com/p/3cc305c9558581f8bec2d08f69c46db2?pvs=204", priority: "High", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:17:51Z" },
  { name: "PD 119.90 | Interagency Operations Policy", link: "https://app.notion.com/p/3cc305c9558581c48ab1ffb606af3cad?pvs=204", priority: "Medium", section: "General Orders", status: "Final", lastUpdated: "2026-08-30T23:17:57Z" },
  { name: "PD 105.50 | Internal Affairs & Professional Standards", link: "https://app.notion.com/p/3cc305c955858164b47ae4b9f1d3b8f0?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:16:32Z" },
  { name: "PD 105.51 | Submissions and Intake", link: "https://app.notion.com/p/3cc305c9558581b98dabed14aaf0c5da?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:15Z" },
  { name: "PD 105.52 | Triage, Lane Gates, and Timelines", link: "https://app.notion.com/p/3cc305c9558581798016cdcea32941d5?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:21Z" },
  { name: "PD 105.53 | Coaching and Administrative Resolution (Lane A)", link: "https://app.notion.com/p/3cc305c9558581b183fdd10b5e0bf835?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:26Z" },
  { name: "PD 105.54 | Formal Investigation (Lane B)", link: "https://app.notion.com/p/3cc305c9558581a6b7eefc5824c2d040?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:33Z" },
  { name: "PD 105.55 | Rights, Protections, and Garrity", link: "https://app.notion.com/p/3cc305c95585813b8704ca848eb7861b?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:38Z" },
  { name: "PD 105.56 | Outcomes, Authority, Appeals, and Records", link: "https://app.notion.com/p/3cc305c9558581d9816ee5203867c17c?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:44Z" },
  { name: "PD 105.57 | Garrity Protections Explained", link: "https://app.notion.com/p/3cc305c955858163b224f3ecabf6fb41?pvs=204", priority: "Medium", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:50Z" },
  { name: "PD 105.58 | Interview Environment and Appointment Procedures", link: "https://app.notion.com/p/3cc305c955858157a3f4f849c95afc15?pvs=204", priority: "Medium", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:18:58Z" },
  { name: "PD 105.59 | Public Incidents, Media Response, and Community Confidence", link: "https://app.notion.com/p/3cc305c9558581b39edad2d4179fdfba?pvs=204", priority: "Medium", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:19:07Z" },
  { name: "PD 105.60 | Garrity Notice — Official Read-Aloud Script", link: "https://app.notion.com/p/3cc305c9558581c4ad45d99ec76cdd9f?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:19:12Z" },
  { name: "PD 107.70 | Departmental Discipline & Guardian Policy", link: "https://app.notion.com/p/3cc305c9558581e49b9ed975d6fdcb42?pvs=204", priority: "High", section: "Internal Affairs", status: "Final", lastUpdated: "2026-08-30T23:16:46Z" },
  { name: "PD 109.90 | Use of Force Policy", link: "https://app.notion.com/p/3cc305c9558581af87ceeaae72fd850d?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:16:57Z" },
  { name: "PD 110.10 | Miranda Rights", link: "https://app.notion.com/p/3cc305c95585811ca0b5e82cfc467db2?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:03Z" },
  { name: "PD 112.20 | Executing Search Warrants", link: "https://app.notion.com/p/3cc305c95585810eb812c7b0d8cf53ef?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:16Z" },
  { name: "PD 113.30 | PIT Maneuver", link: "https://app.notion.com/p/3cc305c955858156879add0821e8c3f1?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:22Z" },
  { name: "PD 114.40 | Ride-Along Program", link: "https://app.notion.com/p/3cc305c95585817795d4ed20424b999e?pvs=204", priority: "Low", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:28Z" },
  { name: "PD 115.50 | Radio Use Policy", link: "https://app.notion.com/p/3cc305c955858121ad8df80521cf1207?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:35Z" },
  { name: "PD 116.60 | Vehicle Pursuit Policy", link: "https://app.notion.com/p/3cc305c95585812c8ebdd74af3bf30ae?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:40Z" },
  { name: "PD 117.70 | Body-Worn Camera and Evidence Policy", link: "https://app.notion.com/p/3cc305c95585814e9d8fe92fef0b8265?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:17:45Z" },
  { name: "PD 120.00 | Booking & Detainee Processing", link: "https://app.notion.com/p/3cc305c9558581dca199f6da78f5aa2c?pvs=204", priority: "High", section: "Patrol", status: "Final", lastUpdated: "2026-08-30T23:18:03Z" },
  { name: "PD 106.60 | Rank Progression and Promotion Standards", link: "https://app.notion.com/p/3cc305c9558581ccb8d8f3a4beca20b2?pvs=204", priority: "High", section: "Personnel", status: "Final", lastUpdated: "2026-08-30T23:16:40Z" },
  { name: "PD 108.80 | Lateral Transfer & Assignment Policy", link: "https://app.notion.com/p/3cc305c95585814e97f3c993d8272e20?pvs=204", priority: "Medium", section: "Personnel", status: "Final", lastUpdated: "2026-08-30T23:16:51Z" },
  { name: "PD 111.10 | Dress Code and Appearance Standards", link: "https://app.notion.com/p/3cc305c9558581e49f19c1c305fef00e?pvs=204", priority: "Medium", section: "Personnel", status: "Final", lastUpdated: "2026-08-30T23:17:09Z" },
  { name: "PD 121.10 | Reserve Deputy Policy", link: "https://app.notion.com/p/3cc305c9558581579f9de39a7af3bdd5?pvs=204", priority: "Low", section: "Personnel", status: "Final", lastUpdated: "2026-08-30T23:18:09Z" },
  { name: "PD 103.30 | Confidential Informant Handling and Oversight", link: "https://app.notion.com/p/3cc305c95585819a9670c0568cbda63c?pvs=204", priority: "Medium", section: "Special Operations", status: "Final", lastUpdated: "2026-08-30T23:16:20Z" },
  { name: "LSCSO Field Training Officer (FTO) Program", link: "https://app.notion.com/p/3cc305c9558581738e83f9cb2bac1d35?pvs=204", priority: "High", section: "Training", status: "Final", lastUpdated: "2026-08-30T23:15:44Z" },
  { name: "LSCSO Hiring & Training Pipeline", link: "https://app.notion.com/p/3cc305c955858185b2d3ee8337eb93a6?pvs=204", priority: "High", section: "Training", status: "Final", lastUpdated: "2026-08-30T23:15:56Z" },
  { name: "PD 101.10 | Qualifications and Training Requirements", link: "https://app.notion.com/p/3cc305c955858182ba5fe13074034c83?pvs=204", priority: "High", section: "Training", status: "Final", lastUpdated: "2026-08-30T23:16:08Z" },
];
