export function getQuietSpaceCategoryColor(category: string) {
  switch (category) {
    case "Library":
      return "#2563eb";
    case "Informal Outdoor Facility (Park/Garden/Reserve)":
      return "#0d8267";
    case "Art Gallery/Museum":
      return "#7c3aed";
    case "Seat":
    case "Picnic Setting":
      return "#c05621";
    case "Drinking Fountain":
      return "#0891b2";
    case "Public Toilet":
      return "#475569";
    case "Church":
    case "Synagogue":
      return "#a16207";
    default:
      return "#71717a";
  }
}

export function getQuietSpaceCategoryLabel(category: string) {
  return category.replace(
    "Informal Outdoor Facility (Park/Garden/Reserve)",
    "Park / Garden"
  );
}
