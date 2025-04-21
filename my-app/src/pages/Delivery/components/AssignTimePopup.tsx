import { Button, DialogActions, TextField } from "@mui/material";
import { useState } from "react";

export default function AssignTimePopup({assignTime, setPopupMode}: any){
    const [time, setTime] = useState<string>("");
    return(
        <>
            <TextField
                label="Select Time"
                type="time"
                value={time}
                onChange={(e) => {setTime(e.target.value)}}
                InputLabelProps={{
                shrink: true,
                }}
                fullWidth
                variant="outlined"
            />
            <DialogActions>
                <Button onClick={() => { 
                    assignTime(time);
                    setTime("");
                    setPopupMode("");
                }}>SAVE</Button>
                <Button onClick={() => {setTime(""); setPopupMode("");}}>CANCEL</Button>
            </DialogActions>
        </>
    )
}