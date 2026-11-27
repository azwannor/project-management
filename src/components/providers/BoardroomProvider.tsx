"use client";

import React, { createContext, useContext, useState } from "react";

interface BoardroomContextValue {
  isBoardroom: boolean;
  setBoardroom: (val: boolean) => void;
  toggleBoardroom: () => void;
}

const BoardroomContext = createContext<BoardroomContextValue>({
  isBoardroom: false,
  setBoardroom: () => {},
  toggleBoardroom: () => {},
});

/**
 * Provides Boardroom / Presentation mode state shared between AppLayout and Executive Dashboard.
 */
export function BoardroomProvider({ children }: { children: React.ReactNode }) {
  const [isBoardroom, setBoardroom] = useState(false);

  return (
    <BoardroomContext.Provider
      value={{
        isBoardroom,
        setBoardroom,
        toggleBoardroom: () => setBoardroom((prev) => !prev),
      }}
    >
      {children}
    </BoardroomContext.Provider>
  );
}

export function useBoardroom() {
  return useContext(BoardroomContext);
}
