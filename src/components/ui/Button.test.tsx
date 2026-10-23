import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("etiketi gösterir ve tıklamayı iletir", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Oyun Oluştur</Button>);

    const button = screen.getByRole("button", { name: "Oyun Oluştur" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("pasifken tıklamayı iletmez", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Başlat
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Başlat" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
