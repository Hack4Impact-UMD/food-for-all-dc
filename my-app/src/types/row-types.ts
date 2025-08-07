// RowData type for spreadsheet and custom columns
export interface RowData {
  id: string;
  clientid?: string;
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  houseNumber?: number;
  address: string;
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: {
      foodAllergens: string[];
      allergies: boolean;
      allergiesText: string;
      halal: boolean;
      kidneyFriendly: boolean;
      lowSodium: boolean;
      lowSugar: boolean;
      microwaveOnly: boolean;
      noCookingEquipment: boolean;
      otherText: string;
      other: boolean;
      softFood: boolean;
      vegan: boolean;
      heartFriendly: boolean;
      vegetarian: boolean;
    };
  };
  ethnicity: string;
}
