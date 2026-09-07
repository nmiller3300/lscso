import { NextResponse } from "next/server";
import { POST as baseMyHrPost } from "../route";

export const dynamic = "force-dynamic";

const EMPLOYEE_VISIBLE_GUARDIAN_STATUSES = new Set([
  "Issued",
  "Awaiting Acknowledgment",
  "Acknowledged",
  "Follow-Up Due",
  "Closed",
]);

function sanitizeMyHr(myhr: any) {
  const guardians = Array.isArray(myhr?.guardians)
    ? myhr.guardians.filter((record: any) => EMPLOYEE_VISIBLE_GUARDIAN_STATUSES.has(record?.status))
    : [];

  const pendingGuardians = guardians.filter((record: any) =>
    !record?.acknowledgment && !["Acknowledged", "Closed"].includes(record?.status),
  );

  const nonGuardianAttention = Array.isArray(myhr?.attention)
    ? myhr.attention.filter((item: any) => item?.type !== "guardian")
    : [];

  const guardianAttention = pendingGuardians.slice(0, 3).map((record: any) => ({
    type: "guardian",
    severity: "action",
    title: `${record.guardianNumber} requires acknowledgment`,
    detail: record.title || record.recordType,
  }));

  const personnelRequests = Array.isArray(myhr?.personnelRequests)
    ? myhr.personnelRequests.map((request: any) => {
        const { decisionNotes: _decisionNotes, ...employeeRequest } = request;
        return employeeRequest;
      })
    : [];

  const leaveRequests = Array.isArray(myhr?.leaveRequests)
    ? myhr.leaveRequests.map((request: any) => {
        const { reviewNotes: _reviewNotes, ...employeeLeave } = request;
        return employeeLeave;
      })
    : [];

  const profile = myhr?.profile
    ? (() => {
        const { id: _profileId, ...employeeProfile } = myhr.profile;
        return employeeProfile;
      })()
    : null;

  return {
    ...myhr,
    profile,
    guardians,
    personnelRequests,
    leaveRequests,
    attention: [...guardianAttention, ...nonGuardianAttention],
    summary: {
      ...(myhr?.summary ?? {}),
      pendingAcknowledgments: pendingGuardians.length,
    },
  };
}

export async function POST(request: Request) {
  const response = await baseMyHrPost(request);
  const payload = await response.json().catch(() => null) as any;

  if (!payload) {
    return NextResponse.json(
      { ok: false, code: "invalid_backend_response", error: "LSCSO MyHR returned an invalid response." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (payload.ok === true && payload.myhr) {
    payload.myhr = sanitizeMyHr(payload.myhr);
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
