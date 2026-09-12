import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function clean(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid open records request." }, { status: 400 });
    }

    if (body.legal_acknowledgement !== true) {
      return NextResponse.json({ error: "You must acknowledge the open records notice before submitting." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const { data, error } = await supabase
      .rpc("submit_open_records_request", {
        p_first_name: clean(body.first_name, 100),
        p_last_name: clean(body.last_name, 100),
        p_email: clean(body.email, 254),
        p_phone: clean(body.phone, 50),
        p_organization: clean(body.organization, 160),
        p_subject_name: clean(body.subject_name, 160),
        p_subject_personnel_id: clean(body.subject_personnel_id, 40),
        p_records_description: clean(body.records_description, 8000),
        p_preferred_delivery: clean(body.preferred_delivery, 40) || "Electronic",
        p_legal_acknowledgement: true,
      })
      .single();

    if (error || !data) {
      const message = error?.message || "The request could not be submitted.";
      const clientError = /please|valid|acknowledge|describe|select/i.test(message);
      if (!clientError) console.error("Open records request submission failed", error);
      return NextResponse.json({ error: clientError ? message : "The request could not be submitted. Please try again." }, { status: clientError ? 400 : 500 });
    }

    return NextResponse.json({ success: true, request_number: data.request_number });
  } catch (error) {
    console.error("Open records request submission failed", error);
    return NextResponse.json({ error: "The request could not be submitted. Please try again." }, { status: 500 });
  }
}
