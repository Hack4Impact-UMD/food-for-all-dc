import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import MiscellaneousForm from "../../../pages/Profile/components/MiscellaneousForm";

jest.mock("../../../pages/Profile/components/TefapFillDialog", () => () => null);

describe("MiscellaneousForm narrative text", () => {
  it("keeps Life Challenges and Lifestyle Goals readable without splitting words", () => {
    const challengesTimestamp = new Date("2025-01-02T15:04:05Z");
    const goalsTimestamp = new Date("2025-02-03T16:05:06Z");
    render(
      <MiscellaneousForm
        clientProfile={{
          lifeChallenges: "Hello from Life Challenges",
          lifeChallengesTimestamp: { notes: "Hello from Life Challenges", timestamp: challengesTimestamp },
          lifestyleGoals: "Hello from Lifestyle Goals",
          lifestyleGoalsTimestamp: { notes: "Hello from Lifestyle Goals", timestamp: goalsTimestamp },
        }}
        isEditing={false}
        renderField={jest.fn()}
        configFields={[]}
        fieldValues={{}}
        handleFieldChange={jest.fn()}
      />
    );

    [screen.getByTestId("life-challenges-text"), screen.getByTestId("lifestyle-goals-text")].forEach(
      (field) => {
        const style = window.getComputedStyle(field);
        expect(style.lineHeight).toBe("1.5");
        expect(style.letterSpacing).toBe("0");
        expect(style.whiteSpace).toBe("pre-wrap");
        expect(style.overflowWrap).toBe("break-word");
        expect(style.wordBreak).toBe("normal");
        expect(style.hyphens).toBe("none");
        expect(style.textAlign).toBe("justify");
      }
    );
    expect(screen.getByText(`Last edited: ${challengesTimestamp.toLocaleString()}`)).toBeTruthy();
    expect(screen.getByText(`Last edited: ${goalsTimestamp.toLocaleString()}`)).toBeTruthy();
  });
});