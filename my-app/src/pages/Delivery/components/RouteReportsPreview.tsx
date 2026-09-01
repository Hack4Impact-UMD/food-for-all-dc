import React, { useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";
import { formatAddressWithQuadrantAndUnit } from "../../../utils/addressFormat";
import { buildHouseholdSnapshot } from "../../../utils/householdSnapshot";
import { DriverRouteReport, RouteReportData, RouteReportDelivery } from "../utils/routeReportData";
import RouteOverviewMap from "./RouteOverviewMap";
import "./RouteReportsPreview.css";

interface RouteReportsPreviewProps {
  reportData: RouteReportData;
  onClose: () => void;
}

const releasePageScroll = () => {
  const scrollLockClass = "route-reports-scroll-locked";
  document.body.classList.remove(scrollLockClass);
  document.documentElement.classList.remove(scrollLockClass);

  if (document.body.style.overflow === "hidden") {
    document.body.style.removeProperty("overflow");
  }
  if (document.documentElement.style.overflow === "hidden") {
    document.documentElement.style.removeProperty("overflow");
  }
};

const formatTime = (time: string): string => {
  if (!time) {
    return "Not assigned";
  }

  const [hoursValue, minutes = "00"] = time.split(":");
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours)) {
    return time;
  }

  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};

const formatDeliveryDate = (date: string): string => {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
};

const formatDeliveryAddress = (delivery: RouteReportDelivery): string =>
  formatAddressWithQuadrantAndUnit(
    delivery.address,
    typeof delivery.quadrant === "string" ? delivery.quadrant : undefined,
    delivery.address2
  );

const formatCityLine = (delivery: RouteReportDelivery): string => {
  const city = typeof delivery.city === "string" ? delivery.city.trim() : "";
  const state = typeof delivery.state === "string" ? delivery.state.trim() : "";
  const zipCode = delivery.zipCode?.trim() || "";
  const cityAndState = [city, state].filter(Boolean).join(", ");

  return [cityAndState, zipCode].filter(Boolean).join(" ");
};

const RouteDeliveryCard = ({
  delivery,
  assignedTime,
}: {
  delivery: RouteReportDelivery;
  assignedTime: string;
}) => {
  const fullName = `${delivery.firstName || ""} ${delivery.lastName || ""}`.trim();
  const instructions = delivery.deliveryDetails?.deliveryInstructions?.trim();
  const cityLine = formatCityLine(delivery);
  const household = buildHouseholdSnapshot({
    adults: delivery.adults,
    seniors: delivery.seniors,
    children: delivery.children,
  });

  return (
    <article className="route-report-delivery-card">
      <div className="route-report-delivery-heading">
        <span className="route-report-checkbox" aria-label="Completion checkbox" />
        <div>
          <h2>
            {fullName || "Client name unavailable"} - {formatTime(assignedTime)}
          </h2>
          <p>{formatDeliveryAddress(delivery) || "Address unavailable"}</p>
          {cityLine ? <p>{cityLine}</p> : null}
          {delivery.phone?.trim() ? <p>Phone: {delivery.phone.trim()}</p> : null}
          <p className="route-report-household">
            Household: Adults {household.adults} | Seniors {household.seniors} | Children {household.children}
          </p>
        </div>
      </div>

      <div className="route-report-instructions">
        <strong>Delivery Instructions</strong>
        <p>{instructions || "No special instructions."}</p>
      </div>
    </article>
  );
};

const RouteReport = ({ report }: { report: DriverRouteReport }) => (
  <article className="route-report">
    <header className="route-report-header">
      <div>
        <p className="route-report-kicker">Driver Route Report</p>
        <h1>Route {report.routeId}</h1>
      </div>
      <dl>
        <div>
          <dt>Driver</dt>
          <dd>{report.driverName}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDeliveryDate(report.deliveryDate)}</dd>
        </div>
        <div>
          <dt>Start Time</dt>
          <dd>{formatTime(report.assignedTime)}</dd>
        </div>
        <div>
          <dt>Deliveries</dt>
          <dd>{report.deliveries.length}</dd>
        </div>
      </dl>
    </header>

    <RouteOverviewMap routeId={report.routeId} deliveries={report.deliveries} />

    <section className="route-report-deliveries" aria-label={`Route ${report.routeId} deliveries`}>
      {report.deliveries.map((delivery) => (
        <RouteDeliveryCard
          key={delivery.id}
          delivery={delivery}
          assignedTime={report.assignedTime}
        />
      ))}
    </section>
  </article>
);

export default function RouteReportsPreview({ reportData, onClose }: RouteReportsPreviewProps) {
  useEffect(() => {
    releasePageScroll();
    return releasePageScroll;
  }, []);

  const handleClose = () => {
    releasePageScroll();
    onClose();
    window.requestAnimationFrame(releasePageScroll);
  };

  const missingRouteCount = reportData.issues.filter(
    ({ reason }) => reason === "missing-route"
  ).length;
  const missingDriverCount = reportData.issues.filter(
    ({ reason }) => reason === "missing-driver"
  ).length;

  return (
    <div
      className="route-reports-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Route reports preview"
    >
      <Box className="route-reports-preview-toolbar">
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Driver Route Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {reportData.reports.length} printable route
            {reportData.reports.length === 1 ? "" : "s"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={reportData.reports.length === 0}
          >
            Print All Reports
          </Button>
          <IconButton onClick={handleClose} aria-label="Close route report preview">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <main className="route-reports-preview-content">
        {reportData.issues.length > 0 ? (
          <Alert severity="warning" className="route-report-assignment-warning">
            Needs assignment: {missingRouteCount} without a route and {missingDriverCount} without a
            driver. These deliveries are not included in a driver report.
          </Alert>
        ) : null}

        {reportData.reports.length === 0 ? (
          <Alert severity="info">No assigned driver routes are available for this date.</Alert>
        ) : (
          <div className="route-reports-print-root">
            {reportData.reports.map((report) => (
              <RouteReport key={report.key} report={report} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}