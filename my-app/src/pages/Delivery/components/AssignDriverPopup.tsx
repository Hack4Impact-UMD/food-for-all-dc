import { Autocomplete, Button, DialogActions, Paper, TextField } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../auth/firebaseConfig";

interface Driver{
    id: string;
    name: string;
    phone: string
    email: string;
}

export default function AssignDriverPopup({assignDriver, setPopupMode}: any){
    const [driver, setDriver] = useState<Driver | null>();
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [driverSearchQuery, setDriverSearchQuery] = useState<string>("");

    const resetSelections = () => {
        setDriver(null)
        setDriverSearchQuery("")
        setPopupMode("")
    }

    useEffect(() => {
        const fetchDrivers = async () => {
          try {
            const driversCollectionRef = collection(db, "Drivers");
            const driversSnapshot = await getDocs(driversCollectionRef);
      
            if (!driversSnapshot.empty) {
              const driversData = driversSnapshot.docs.map((doc) => ({
                id: doc.id,
                name: doc.data().name || "", 
                phone: doc.data().phone || "", 
                email: doc.data().email || "", 
              }));
      
              setDrivers(driversData); 
            } else {
              console.log("No drivers found!");
            }
          } catch (error) {
            console.error("Error fetching drivers:", error);
          }
        };
        fetchDrivers();
      }, []);

    return(
        <>
            <Autocomplete
                freeSolo
                options={drivers} 
                getOptionLabel={(driver) => (typeof driver === "string" ? driver : driver.name)} 
                onChange={(event, value) => {
                if (value && typeof value !== "string") {
                    setDriver(value); 
                }
                }}
                onInputChange={(event, newValue) => setDriverSearchQuery(newValue)}
                renderInput={(params) => (
                <TextField
                    {...params}
                    fullWidth
                    variant="outlined"
                    placeholder="Search drivers..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                />
                )}
                PaperComponent={({ children }) => (
                <Paper elevation={3}>{children}</Paper>
                )}
                noOptionsText="No drivers found"
                sx={{ width: '200px' }}
            />
            
            <DialogActions>
                <Button onClick={() => { 
                    assignDriver(driver);
                    resetSelections()
                }}>SAVE</Button>
                <Button onClick={() => resetSelections()}>CANCEL</Button>
            </DialogActions>
        </>
    )
}