import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import {
  DEFAULT_TAG_COLOR_PALETTE,
  normalizeTagColorPalette,
  normalizeTagColors,
  TagColorMap,
} from "../utils/tagColors";
import { useAuth } from "../auth/AuthProvider";

const TagColorContext = createContext<TagColorMap>({});
const TagColorPaletteContext = createContext<string[]>(DEFAULT_TAG_COLOR_PALETTE);

export const TagColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const [tagColorPalette, setTagColorPalette] = useState<string[]>(DEFAULT_TAG_COLOR_PALETTE);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setTagColors({});
      setTagColorPalette(DEFAULT_TAG_COLOR_PALETTE);
      return;
    }

    const tagsDocRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);

    return onSnapshot(
      tagsDocRef,
      (snapshot) => {
        setTagColors(normalizeTagColors(snapshot.data()?.tagColors));
        setTagColorPalette(normalizeTagColorPalette(snapshot.data()?.tagColorPalette));
      },
      (error) => console.error("Error listening for tag colors:", error)
    );
  }, [user]);

  return (
    <TagColorContext.Provider value={tagColors}>
      <TagColorPaletteContext.Provider value={tagColorPalette}>
        {children}
      </TagColorPaletteContext.Provider>
    </TagColorContext.Provider>
  );
};

export const useTagColors = (): TagColorMap => useContext(TagColorContext);
export const useTagColorPalette = (): string[] => useContext(TagColorPaletteContext);
