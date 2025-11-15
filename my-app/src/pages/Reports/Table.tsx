import { Box } from "@mui/material"
import { ReportField } from "../../types/reports-types"
interface TableProps {
    data: ReportField[]
}
export default function Table({ data }: TableProps) {
  //find indexes of all non-full-row items
  const nonFullRowIndexes = data
    .map((d, i) => (!d.isFullRow ? i : -1))
    .filter(i => i !== -1);

  //determine if last non-full-row item should be full width
  const lastIndexToFullRow =
    nonFullRowIndexes.length % 2 !== 0
      ? nonFullRowIndexes[nonFullRowIndexes.length - 1]
      : -1;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          gap: "1%",
          width: "100%",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {data.map((d, index) => {
          //if this item is the last non-full-row in an odd count, make it full row
          const isFullRowAdjusted =
            index === lastIndexToFullRow ? true : d.isFullRow;

          return (
            <Box
              key={index}
              sx={{
                height: "100px",
                textAlign: "center",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f0f0f0ff",
                padding: "10px",
                marginBottom: "10px",
                width: isFullRowAdjusted ? "100%" : "49.5%",
              }}
            >
              <p>{d.key}</p>
              <Box
                sx={{
                  backgroundColor: "var(--color-white)"color-white)",
                  height: "50px",
                  width: "100px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <p style={{ margin: 0 }}>{d.value}</p>
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
}
