const DIETARY_RESTRICTION_LABELS: Array<[string, string]> = [
  ["halal", "Halal"],
  ["kidneyFriendly", "Kidney Friendly"],
  ["lowSodium", "Low Sodium"],
  ["lowSugar", "Low Sugar"],
  ["microwaveOnly", "Microwave Only"],
  ["noCookingEquipment", "No Cooking Equipment"],
  ["softFood", "Soft Food"],
  ["vegan", "Vegan"],
  ["vegetarian", "Vegetarian"],
  ["heartFriendly", "Heart Friendly"],
];

export const formatDietaryRestrictionsForExport = (
  dietaryRestrictions:
    | {
        foodAllergens?: string[];
        other?: boolean;
        otherText?: string;
        dietaryPreferences?: string;
        [key: string]: unknown;
      }
    | undefined
): string => {
  if (!dietaryRestrictions) {
    return "None";
  }

  const values = DIETARY_RESTRICTION_LABELS.filter(
    ([key]) => dietaryRestrictions[key] === true
  ).map(([, label]) => label);

  if ((dietaryRestrictions.foodAllergens ?? []).length > 0) {
    values.push(...(dietaryRestrictions.foodAllergens ?? []));
  }

  if (dietaryRestrictions.other === true) {
    values.push("Other");
  }

  if (
    typeof dietaryRestrictions.otherText === "string" &&
    dietaryRestrictions.otherText.trim() !== ""
  ) {
    values.push(dietaryRestrictions.otherText.trim());
  }

  if (
    typeof dietaryRestrictions.dietaryPreferences === "string" &&
    dietaryRestrictions.dietaryPreferences.trim() !== ""
  ) {
    values.push(dietaryRestrictions.dietaryPreferences.trim());
  }

  return values.length > 0 ? values.join(", ") : "None";
};
