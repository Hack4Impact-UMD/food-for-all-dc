import React from "react";
import { Box, Typography } from "@mui/material";
import { ClientProfileKey, InputType } from '../types';

interface DeliveryLogProps {
    // renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
    fieldLabelStyles: any;
}

const DietaryPreferencesForm: React.FC<DeliveryLogProps> = ({
    // renderField,
    fieldLabelStyles,
}) => {
    return (
        <>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        md: "repeat(3, 1fr)",
                    },
                    alignItems: "center",
                }}
                className="info-grid"
            >
                <Box sx={{ gridColumn: "-1/1" }}>
                    <Typography className="field-descriptor" sx={fieldLabelStyles}>
                        UPCOMING
                    </Typography>
                    {/* {renderField("deliveryDetails.dietaryRestrictions", "dietaryRestrictions")} */}
                    <Typography className="field-descriptor" sx={fieldLabelStyles}>
                        PREVIOUS
                    </Typography>
                </Box>
            </Box>
        </>
    );
};

export default DietaryPreferencesForm;