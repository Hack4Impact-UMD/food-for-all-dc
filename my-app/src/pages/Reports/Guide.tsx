import { Card, CardContent, Typography, Box } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function Guide() {
  return (
    <Card
      sx={{
        width: "90vw",
        margin: "20px auto",
        borderRadius: 3,
        boxShadow: 0,
        background: "#d9f2ec",
        border: "2px solid var(--color-primary)",
        color: "var(--color-primary)",
        p: 2,
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            color: "var(--color-primary)",
            p: 1.2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <InfoOutlinedIcon fontSize="large" />
        </Box>

        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Getting Started with Reports:
          </Typography>
          <Typography variant="body1">
            Select a start and end date then click <strong>Generate</strong> to see results.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
