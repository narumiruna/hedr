import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MachineFleet } from "../src/components/MachineFleet";

const machines = [
  {
    agentCount: 2,
    enabled: true,
    id: "machine-build",
    label: "Build machine",
    needsInput: 1,
    protocol: 22,
    selected: true,
    session: "agents",
    status: "online" as const,
    version: "0.9.0",
    workspaceCount: 1,
    workspaces: [
      {
        agentCount: 2,
        agents: [
          { label: "Muse review", status: "blocked" },
          { label: "Pi tests", status: "working" },
        ],
        label: "herdr",
        needsInput: 1,
      },
    ],
  },
  {
    agentCount: 0,
    enabled: false,
    id: "machine-archive",
    label: "Archive",
    needsInput: 0,
    selected: false,
    session: "default",
    status: "disabled" as const,
    workspaceCount: 0,
    workspaces: [],
  },
];

describe("MachineFleet", () => {
  test("shows loading and empty states while checking saved machines", async () => {
    let resolveLoad: (value: typeof machines) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<typeof machines>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    render(<MachineFleet load={load} open />);

    expect(screen.getByRole("button", { name: /Reload/ })).toBeDisabled();
    resolveLoad([]);

    expect(await screen.findByText(/No saved SSH machines/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Reload/ })).toBeEnabled();
  });

  test("shows online attention details and disabled saved machines", async () => {
    render(<MachineFleet load={vi.fn().mockResolvedValue(machines)} open />);

    const fleet = await screen.findByRole("region", {
      name: "Saved SSH machines",
    });
    const build = within(fleet).getByText("Build machine").closest("article");
    if (!build) throw new Error("Missing build machine card");
    expect(build).toHaveTextContent("Online");
    expect(build).toHaveTextContent("1 need input");
    expect(build).toHaveTextContent("Muse review");
    expect(build).toHaveTextContent("blocked");
    expect(fleet).toHaveTextContent("Archive");
    expect(fleet).toHaveTextContent("This saved machine is disabled");
  });

  test("reloads summaries and reports failures without stale content", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(machines)
      .mockRejectedValueOnce(new Error("Herdr machine forwarding unavailable"));
    const user = userEvent.setup();
    render(<MachineFleet load={load} open />);

    expect(await screen.findByText("Build machine")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Reload/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Herdr machine forwarding unavailable",
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
