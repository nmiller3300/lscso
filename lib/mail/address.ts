const DOMAIN = "lscso.gov";

export type MailProfileAddressSource = {
  username?: string | null;
  display_name?: string | null;
  rank?: string | null;
};

export function mailAddressForProfile(profile: MailProfileAddressSource) {
  const rank = String(profile.rank || "").trim();
  if (rank === "Sheriff") return `sheriff@${DOMAIN}`;
  if (rank === "Undersheriff") return `undersheriff@${DOMAIN}`;

  const username = String(profile.username || "").trim().toLowerCase();
  if (username) return `${username}@${DOMAIN}`;

  const parts = String(profile.display_name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const first = parts[0].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = parts[parts.length - 1].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!first || !last) return null;
  return `${first[0]}.${last}@${DOMAIN}`;
}

export function mailLocalPartForProfile(profile: MailProfileAddressSource) {
  const address = mailAddressForProfile(profile);
  return address ? address.split("@")[0] : null;
}
