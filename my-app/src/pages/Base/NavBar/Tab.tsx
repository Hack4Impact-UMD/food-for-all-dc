import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useNavigate } from "react-router-dom";
import "../NavBar/Tab.css";

interface TabProp {
  text: string;
  icon: React.ReactNode;
  link: string;
  tab: string;
  setTab: (text: string) => void;
  setOpen: (open: boolean) => void;
}
export default function Tab({ text, icon, link, tab, setTab, setOpen }: TabProp) {
  const navigate = useNavigate();

  return (
    <div
      className={
        text === "Logout" ? "tabContainerLogout" : "tabContainer" + (tab === text ? "Selected" : "")
      }
      onClick={() => {
        setTab(text);
        setOpen(false);
        navigate(link);
      }}
    >
      <ListItemIcon sx={{ color: "rgb(37, 126, 104)" }}>{icon}</ListItemIcon>
      <ListItemText primary={text} sx={{ fontWeight: "bold", color: "rgb(85, 85, 85)" }} />
    </div>
  );
}
