export const PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Office",
  "Hospitality",
  "Mixed-Use",
  "Cultural",
  "Civic",
  "Education",
  "Healthcare",
  "Sports",
  "Religious",
  "Industrial",
  "Landscape",
  "Urban Design",
  "Interior",
  "Transportation",
  "Other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const ASSET_TYPES = [
  "Image",
  "Document",
  "Presentation",
  "Spreadsheet",
  "PDF",
  "CAD",
  "BIM",
  "3D Model",
  "Video",
  "Archive",
  "Other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];