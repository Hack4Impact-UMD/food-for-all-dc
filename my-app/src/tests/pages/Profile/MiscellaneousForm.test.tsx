import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import MiscellaneousForm from "../../../pages/Profile/components/MiscellaneousForm";

describe("MiscellaneousForm narrative text", () => {
  it("keeps Life Challenges and Lifestyle Goals readable without splitting words", () => {
    render(
      <MiscellaneousForm
        clientProfile={{
          lifeChallenges: "Hello from Life Challenges",
          lifestyleGoals: "Hello from Lifestyle Goals",
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
  });
});