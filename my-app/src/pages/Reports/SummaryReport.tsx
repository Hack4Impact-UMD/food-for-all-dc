import React, { useState } from "react";
import "./Reports.css";
import { ReportField } from "../../types/reports-types";
import ReportTables from "./ReportTables";
import ReportHeader from "./ReportHeader";
import TimeUtils from "../../utils/timeUtils";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import { SummaryData } from "../../types/reports-types";
import { formatCamelToTitle } from "../../utils";
import Guide from "./Guide";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { DateTime } from "luxon";
import { useNotifications } from "../../components/NotificationProvider";

const blankReport: SummaryData = {
    "Basic Output": {
      "Households Served (Duplicated)": { value: 0, isFullRow: false },
      "Households Served (Unduplicated)": { value: 0, isFullRow: false },
      "People Served (Duplicated)": { value: 0, isFullRow: false },
      "People Served (Unduplicated)": { value: 0, isFullRow: false },
      "Bags Delivered": { value: 0, isFullRow: false },
      "New Households": { value: 0, isFullRow: false },
      "New People": { value: 0, isFullRow: false },
      "Active Clients": { value: 0, isFullRow: false },
      "Lapsed Clients": { value: 0, isFullRow: false },
    },

    "Demographics": {
      "New Seniors": { value: 0, isFullRow: false },
      "Total Seniors": { value: 0, isFullRow: false },
      "New Single Parents": { value: 0, isFullRow: false },
      "New Adults": { value: 0, isFullRow: false },
      "Total Adults": { value: 0, isFullRow: false },
      "New Children": { value: 0, isFullRow: false },
      "Total Children": { value: 0, isFullRow: false },
    },

    "Health Conditions": {
      "Client Health Conditions (Physical Ailments)": {
        value: 0,
        isFullRow: false,
      },
      "Client Health Conditions (Physical Disability)": {
        value: 0,
        isFullRow: false,
      },
      "Client Health Conditions (Mental Health Conditions)": {
        value: 0,
        isFullRow: false,
      },
    },

    "Referrals": {
      "New Client Referrals": { value: 0, isFullRow: false },
      "New Referral Agency Names": { value: 0, isFullRow: false },
    },

    "Dietary Restrictions": {
      "Lactose Intolerant": { value: 0, isFullRow: false },
      "Microwave Only": { value: 0, isFullRow: false },
      "Diabetes Friendly": { value: 0, isFullRow: false },
      "No Cans": { value: 0, isFullRow: false },
      "Food Allergen": { value: 0, isFullRow: false },
      "No Cooking Equipment": { value: 0, isFullRow: false },
      "Gluten Free": { value: 0, isFullRow: false },
      "Soft Food": { value: 0, isFullRow: false },
      Halal: { value: 0, isFullRow: false },
      Vegan: { value: 0, isFullRow: false },
      "Low Sodium": { value: 0, isFullRow: false },
      "Low Sugar": { value: 0, isFullRow: false },
      "Heart Friendly": { value: 0, isFullRow: false },
      Vegetarian: { value: 0, isFullRow: false },
      "Kidney Friendly": { value: 0, isFullRow: false },
      Other: { value: 0, isFullRow: false },
      "No Restrictions": { value: 0, isFullRow: false },
    },

    "FAM (Food as Medicine)": {
      "Clients Receiving Medically Tailored Food": { value: 0, isFullRow: true },
    },

    Tags: {},
  }


const makeBlankReport = (): SummaryData =>
  structuredClone(blankReport)
const SummaryReport: React.FC = () => {
  const { showError, showSuccess } = useNotifications();
  // Shows spinner while generateReport is running
  const [isLoading, setIsLoading] = useState(false);
  // Tracks whether at least one report has been generated
  const [hasGenerated, setHasGenerated] = useState(false);

  const [data, setData] = useState<SummaryData>(blankReport);

  const [startDate, setStartDate] = useState<Date | null>(() => {
    const start = localStorage.getItem("ffaReportDateRangeStart");
    if (start) {
      return new Date(start);
    } else {
      return null;
    }
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const end = localStorage.getItem("ffaReportDateRangeEnd");
    if (end) {
      return new Date(end);
    } else {
      return null;
    }
  });

  const processClientInfo = (next: SummaryData, client: any, deliveriesInRange: string[], start: DateTime, end: DateTime, referralAgencies: Set<string>) => {
    const basic = next["Basic Output"];
    const demo = next["Demographics"];
    const health = next["Health Conditions"];
    const refs = next["Referrals"];
    const tags = next["Tags"];
    const fam = next["FAM (Food as Medicine)"];

    // Households Served (Duplicated)
    basic["Households Served (Duplicated)"].value += 1;
    basic["Bags Delivered"].value += deliveriesInRange.length;

    // People Served (Duplicated)
    const adults = Number(client.adults) || 0;
    const seniors = Number(client.seniors) || 0;
    const children = Number(client.children) || 0;
    basic["People Served (Duplicated)"].value += adults + seniors + children;

    if (startDate && endDate) {
      const firstDelivery = TimeUtils.fromISO(client.deliveries[0]);
      if (firstDelivery >= start && firstDelivery <= end) {
        basic["New Households"].value += 1;
        basic["New People"].value += adults + seniors + children;
        demo["New Seniors"].value += seniors;
        demo["New Adults"].value += adults;
        demo["New Children"].value += children;

        // Single parents
        if (adults == 1 && children > 0) {
          demo["New Single Parents"].value += 1;
        }
      }

      //update households unduplicated
      basic["Households Served (Unduplicated)"].value = basic["Households Served (Duplicated)"].value - basic["New Households"].value;
      basic["People Served (Unduplicated)"].value = basic["People Served (Duplicated)"].value - basic["New People"].value;
      // Totals
      demo["Total Seniors"].value += seniors;
      demo["Total Adults"].value += adults;
      demo["Total Children"].value += children;
    }

    // Active Clients
    basic["Active Clients"].value += 1;

    // Health Conditions
    if (client.physicalAilments) {
      health["Client Health Conditions (Physical Ailments)"].value += 1;
    }
    if (client.mentalHealthConditions) {
      health["Client Health Conditions (Mental Health Conditions)"].value += 1;
    }
    if (client.physicalDisability) {
      health["Client Health Conditions (Physical Disability)"].value += 1;
    }
    // Referrals
    if (client.referredDate && startDate && endDate) {
      const referredDate = TimeUtils.fromISO(client.referredDate);
      if (referredDate >= start && referredDate <= end) {
        refs["New Client Referrals"].value += 1;
        if (client.referralEntity?.organization?.trim()) {
          referralAgencies.add(client.referralEntity.organization.trim());
        }
      }
    }

    // Dietary restrictions
    const dietaryRestrictions = Object.keys(
      client.deliveryDetails.dietaryRestrictions
    );
    let added = false;
    dietaryRestrictions.forEach((restriction: string) => {
      if (restriction !== "foodAllergens") {
        const formattedRestriction = formatCamelToTitle(restriction);
        if (
          next["Dietary Restrictions"][formattedRestriction] &&
          client.deliveryDetails.dietaryRestrictions[restriction]
        ) {
          next["Dietary Restrictions"][formattedRestriction].value += 1;
          added = true;
        }
      } else {
        next["Dietary Restrictions"]["Food Allergen"].value +=
          client.deliveryDetails.dietaryRestrictions["foodAllergens"].length;
        added = true;
      }
    });


    if (!added) {
      next["Dietary Restrictions"]["No Restrictions"].value += 1;
    }

    // Tags
    const clientTags = client.tags;
    clientTags.forEach((tag: string) => {
      // separate FAM
      if (tag == "FAM") {
        fam["Clients Receiving Medically Tailored Food"].value += 1;
      }

      if (tags[tag]) {
        tags[tag].value += 1;
      } else {
        tags[tag] = { value: 1, isFullRow: false };
      }
    });
  };


  const generateReport = async () => {
    const BATCH_SIZE = 50;

    const next = makeBlankReport();
    const referralAgencies = new Set<string>();

    let clientNum = 0
    let active = 0

    setIsLoading(true);

    const start = TimeUtils.fromJSDate(startDate!).startOf("day");
    const end = TimeUtils.fromJSDate(endDate!).endOf("day");

    try {
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      const True = true;
      while (True) {
        const q = lastDoc
          ? query(
              collection(db, "clients"),
              orderBy("__name__"),
              startAfter(lastDoc),
              limit(BATCH_SIZE)
            )
          : query(collection(db, "clients"), orderBy("__name__"), limit(BATCH_SIZE));

        const snap: any = await getDocs(q);
        if (snap.empty) break;

        for (const doc of snap.docs) {
          const client = doc.data();
          const deliveries: string[] = client.deliveries ?? [];
          if (deliveries.length && startDate && endDate) {
            const deliveriesInRange = deliveries.filter((deliveryStr) => {
              const deliveryDate = TimeUtils.fromISO(deliveryStr);
              return deliveryDate >= start && deliveryDate <= end;
            });

            if (deliveriesInRange.length) {
              active += 1;
              processClientInfo(next, client, deliveriesInRange, start, end, referralAgencies);
            }
          }
        }

        clientNum += snap.size;
        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.size < BATCH_SIZE) break;
      }

      next["Basic Output"]["Lapsed Clients"].value = clientNum - active;
      next["Referrals"]["New Referral Agency Names"].value = referralAgencies.size;
      next["Basic Output"]["Bags Delivered"].value *= 2;

      setData(next);
      setHasGenerated(true);
      showSuccess("Summary report generated successfully");
    } catch (err) {
      console.error("Failed to generate report:", err);
      showError("Failed to generate summary report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        position: "relative",
        width: "90vw"
      }}
    >
      <ReportHeader
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        generateReport={generateReport}
      />

      {isLoading && <LoadingIndicator />}

      {!isLoading && !hasGenerated && <Guide />}
      {hasGenerated && (
        <ReportTables data={data} loading={isLoading}></ReportTables>
      )}
    </div>
  );
};

export default SummaryReport;
