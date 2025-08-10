// Firebase Storage SDK setup and helper for authenticated file access
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "./firebase";

const storage = getStorage(app);

export async function getProfileFieldsConfigUrl() {
  const fileRef = ref(storage, "profile-fields.json");
  return await getDownloadURL(fileRef);
}
