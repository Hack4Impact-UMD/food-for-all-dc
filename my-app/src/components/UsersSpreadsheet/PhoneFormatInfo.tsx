import React from "react";
import InfoIcon from "@mui/icons-material/Info";
import { IconButton, Tooltip, Typography } from "@mui/material";

export const PHONE_FORMAT_EXAMPLES = [
  "(123) 456-7890",
  "123-456-7890",
  "123.456.7890",
  "123 456 7890",
  "1234567890",
  "+1 123-456-7890",
];

const PhoneFormatInfo: React.FC = () => (
  <Tooltip
    title={
      <React.Fragment>
        <Typography variant="subtitle2">Allowed formats:</Typography>
        {PHONE_FORMAT_EXAMPLES.map((example) => (
          <Typography key={example} variant="body2">
            {example}
          </Typography>
        ))}
      </React.Fragment>
    }
    arrow
  >
    <IconButton
      size="small"
      aria-label="Show allowed phone number formats"
      sx={{ color: "var(--color-primary)", p: 0.5 }}
    >
      <InfoIcon sx={{ fontSize: 20 }} />
    </IconButton>
  </Tooltip>
);

export default PhoneFormatInfo;
