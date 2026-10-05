import React from "react";
import { InspectionSheet } from "./InspectionSheet";

/**
 * Re-export InspectionSheet as CampaignDetailModal to preserve existing references
 * while upgrading from the legacy centered modal to the slide-over inspection sheet.
 */
export function CampaignDetailModal(props) {
  return <InspectionSheet {...props} />;
}
