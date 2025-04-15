import Tag from "./Tag";
import { Box } from "@mui/material";
export default function Tags({
  allTags,
  values,
  handleTag,
  setInnerPopup,
  deleteMode,
  setTagToDelete,
}: any) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          width: "500px",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          maxHeight: "300px",
          overflowY: "auto",
          flexWrap: "wrap",
          paddingTop: deleteMode ? "10px" : "0px",
        }}
      >
        {allTags.map((v: string) => (
          <Tag
            key={v}
            text={v}
            handleTag={handleTag}
            values={values}
            createTag={false}
            setInnerPopup={setInnerPopup}
            deleteMode={deleteMode}
            setTagToDelete={setTagToDelete}
          ></Tag>
        ))}
        <Tag
          text={""}
          handleTag={handleTag}
          values={values}
          createTag={true}
          setInnerPopup={setInnerPopup}
          deleteMode={deleteMode}
          setTagToDelete={setTagToDelete}
        ></Tag>
      </Box>
    </>
  );
}
