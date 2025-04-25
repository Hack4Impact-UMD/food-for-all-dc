import { Box, Card, Typography, Checkbox, useTheme } from "@mui/material";
import { DeliveryRowData } from "../types/deliveryTypes";

interface CardProps {
    client: DeliveryRowData;
    index: number; 
    selectedClients: number[]; 
    setSelectedClients: React.Dispatch<React.SetStateAction<number[]>>;
  }
  
export default function ClientCard({ client, index, selectedClients, setSelectedClients }: CardProps) {
  const selected = selectedClients.includes(index);
  const theme = useTheme();

  const toggleSelected = () => {
    setSelectedClients(prev => 
      prev.includes(index)
        ? prev.filter(i => i !== index) // Remove index if already selected
        : [...prev, index] // Add index if not selected
    );
  };

  const handleCheckboxClick = (event: React.MouseEvent) => {
    //stops both events from triggering
    event.stopPropagation();
  };

  return (
    <Card
      onClick={toggleSelected}
      sx={{
        width: "100%",
        height: "80px",
        borderRadius: "8px",
        border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
        backgroundColor: selected ? theme.palette.action.selected : theme.palette.background.paper,
        boxShadow: theme.shadows[selected ? 4 : 1],
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
          borderColor: theme.palette.primary.main,
        }
      }}
    >
      <Checkbox
        checked={selected}
        onClick={handleCheckboxClick}
        onChange={toggleSelected}
        color="primary"
        sx={{
          marginRight: 2,
          '& .MuiSvgIcon-root': {
            fontSize: 28,
          }
        }}
      />

      <Box sx={{ flex: 1 }}>
        <Typography 
          variant="subtitle1" 
          fontWeight={600}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: theme.palette.text.primary,
          }}
        >
          {`${client.firstName} ${client.lastName}`}
        </Typography>
        
        <Typography 
          variant="body2"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: theme.palette.text.secondary,
            fontSize: '0.8rem',
          }}
        >
          {client.address}
        </Typography>
      </Box>
    </Card>
  );
}
