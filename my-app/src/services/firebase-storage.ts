import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "../auth/firebaseConfig";

export const storage = getStorage(app);

export async function getProfileFieldsConfigUrl() {
  const fileRef = ref(storage, "profile-fields.json");
  return await getDownloadURL(fileRef);
}
