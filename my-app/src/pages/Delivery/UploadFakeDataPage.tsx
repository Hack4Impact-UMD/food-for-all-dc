import React from "react";
import uploadFakeData from "./UploadFakeData";

const UploadFakeDataPage: React.FC = () => {
    const handleUpload = async () => {
        await uploadFakeData();
        alert("Fake data uploaded successfully!");
    };

    return (
        <div>
            <h1>Upload Fake Data</h1>
            <button onClick={handleUpload}>Upload Fake Data</button>
        </div>
    );
};

export default UploadFakeDataPage;