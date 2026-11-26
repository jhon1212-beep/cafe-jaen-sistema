import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { texts } from "../../shared/texts/es";
import { NewPriceForm, ReferenceCondition } from "./AdminPage";

describe("precio de referencia de las cooperativas", () => {
  it("muestra la condición acordada: pergamino seco, 11–12 % de humedad y calidad regular", () => {
    render(<ReferenceCondition />);

    for (const chip of texts.admin.reference.chips) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });

  it("no guarda un precio sin confirmar que es del pergamino seco estándar", () => {
    const coop = { id: 1, name: "Coop. A", location: "Jaén", website: null, active: true };
    render(
      <MemoryRouter>
        <NewPriceForm cooperatives={[coop]} onSaved={() => undefined} />
      </MemoryRouter>,
    );
    const save = screen.getByRole("button", { name: texts.admin.save });

    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText(texts.admin.confirmStandard));
    expect(save).toBeEnabled();
  });
});
