import type { IObservation } from "@/lib/types";

type Rule = {
  code: string;
  match: (obs: IObservation) => boolean;
  requireAll?: boolean;
};

const RULES: Rule[] = [
  {
    code: "WN-1",
    match: (o) => o.attribute === "Cloud" && o.object === "Cloud Pattern" && o.value === "Descending Clusters",
  },
  {
    code: "WN-2",
    match: (o) => o.attribute === "Cloud" && o.object === "Cloud Pattern" && o.value === "Merging Clusters",
  },
  {
    code: "WN-3",
    match: (o) => o.attribute === "Lightning" && o.object === "Lightning Activity" && o.value === "Single-Sided",
  },
  {
    code: "WN-4",
    match: (o) => o.attribute === "Sea" && o.object === "Wave Pattern" && o.value === "Small and Frequent to Large and Close",
  },
  {
    code: "WN-5",
    match: (o) => o.attribute === "Dolphin" && o.object === "Dolphin Activity" && o.value === "Approaching/Guiding Boat",
  },
  {
    code: "WN-7",
    match: (o) => o.attribute === "Wind" && o.object === "Wind/Monsoon Season" && o.value === "West-to-East Transition",
  },
  {
    code: "WN-8",
    match: (o) => o.attribute === "Sky" && o.object === "Weather Condition" && o.value === "Red Sky/Sunset",
  },
  {
    code: "WN-9",
    match: (o) => o.attribute === "Star" && o.object === "Star Condition" && o.value === "Dim/Not Visible",
  },
  {
    code: "WN-13",
    match: (o) => o.attribute === "Fish" && o.object === "Fish Activity" && o.value === "Surfacing Unusually",
  },
  {
    code: "WN-6",
    requireAll: true,
    match: (o) =>
      (o.attribute === "Seagull" && o.object === "Seagull Movement" && o.value === "Hasty Flying") ||
      (o.attribute === "Seagull" && o.object === "Seagull Sound" && o.value === "Loud Calling"),
  },
];

export function extractLikCodes(observations: IObservation[]): string[] {
  const codes: string[] = [];
  for (const rule of RULES) {
    if (rule.requireAll) {
      const matched = observations.filter(rule.match);
      const uniqueTypes = new Set(matched.map((o) => o.object));
      if (uniqueTypes.size >= 2) {
        codes.push(rule.code);
      }
    } else {
      if (observations.some(rule.match)) {
        codes.push(rule.code);
      }
    }
  }
  return codes;
}
