import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { normalizeTagColors, TagColorMap } from "../utils/tagColors";
import { useAuth } from "../auth/AuthProvider";

const TagColorContext = createContext<TagColorMap>({});

export const TagColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setTagColors({});
      return;
    }

    const tagsDocRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);

    return onSnapshot(
      tagsDocRef,
      (snapshot) => setTagColors(normalizeTagColors(snapshot.data()?.tagColors)),
      (error) => console.error("Error listening for tag colors:", error)
    );
  }, [user]);

  return <TagColorContext.Provider value={tagColors}>{children}</TagColorContext.Provider>;
};

export const useTagColors = (): TagColorMap => useContext(TagColorContext);
