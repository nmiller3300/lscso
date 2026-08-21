export type PublicWarrant = {
  warrantNumber: string;
  name: string;
  alias?: string;
  age: number;
  charge: string;
  classification: "Felony" | "Misdemeanor";
  issued: string;
  status: "Active" | "Extradition Limited" | "Court Review";
  jurisdiction: string;
  mostWanted?: boolean;
  caution?: string;
};

export const publicWarrants: PublicWarrant[] = [
  { warrantNumber: "WR-2608-0142", name: "Derrick Vance", alias: "D-Vee", age: 31, charge: "Armed Robbery", classification: "Felony", issued: "August 16, 2026", status: "Active", jurisdiction: "Los Santos County", mostWanted: true, caution: "Considered armed. Do not approach." },
  { warrantNumber: "WR-2608-0137", name: "Maya Serrano", age: 28, charge: "Felony Evading", classification: "Felony", issued: "August 14, 2026", status: "Active", jurisdiction: "Los Santos County", mostWanted: true, caution: "Known to flee from law enforcement." },
  { warrantNumber: "WR-2608-0125", name: "Leon Mercer", alias: "Lee", age: 39, charge: "Aggravated Assault", classification: "Felony", issued: "August 11, 2026", status: "Active", jurisdiction: "Los Santos County", mostWanted: true, caution: "History of violent resistance." },
  { warrantNumber: "WR-2608-0113", name: "Renee Calder", age: 34, charge: "Possession of Stolen Property", classification: "Felony", issued: "August 8, 2026", status: "Court Review", jurisdiction: "Los Santos County" },
  { warrantNumber: "WR-2608-0104", name: "Marcus Bell", age: 25, charge: "Failure to Appear", classification: "Misdemeanor", issued: "August 6, 2026", status: "Active", jurisdiction: "Los Santos County" },
  { warrantNumber: "WR-2608-0098", name: "Talia Brooks", age: 42, charge: "Burglary", classification: "Felony", issued: "August 4, 2026", status: "Extradition Limited", jurisdiction: "Los Santos County" },
  { warrantNumber: "WR-2607-0081", name: "Evan Cross", age: 30, charge: "Fraud", classification: "Felony", issued: "July 29, 2026", status: "Active", jurisdiction: "Los Santos County" },
  { warrantNumber: "WR-2607-0069", name: "Naomi Price", age: 27, charge: "Failure to Comply with Court Order", classification: "Misdemeanor", issued: "July 23, 2026", status: "Active", jurisdiction: "Los Santos County" },
];
