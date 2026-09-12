import { describe, expect, test, vi } from "vitest";
import {
  parseMachineProfiles,
  SavedMachineService,
  summarizeMachineSnapshot,
} from "../server/machine-service";

const profiles = [
  {
    enabled: true,
    id: "0123456789abcdef0123456789abcdef",
    label: "Build machine",
    selected: true,
    session: "agents",
    target: "developer@private.example",
  },
  {
    enabled: false,
    id: "fedcba9876543210fedcba9876543210",
    label: "Archive",
    selected: false,
    session: "default",
    target: "archive.example",
  },
];

const snapshot = JSON.stringify({
  id: "cli:api:snapshot",
  result: {
    snapshot: {
      agents: [
        {
          agent: "muse",
          agent_status: "blocked",
          pane_id: "w1:p1",
          terminal_title_stripped: "Muse review",
          workspace_id: "w1",
        },
        {
          agent: "pi",
          agent_status: "working",
          pane_id: "w1:p2",
          workspace_id: "w1",
        },
      ],
      protocol: 22,
      version: "0.9.0",
      workspaces: [{ label: "herdr", workspace_id: "w1" }],
    },
  },
});

describe("saved machine supervision", () => {
  test("parses bounded profiles without retaining SSH targets", () => {
    const parsed = parseMachineProfiles(JSON.stringify(profiles));

    expect(parsed).toEqual([
      {
        enabled: true,
        id: profiles[0]?.id,
        label: "Build machine",
        selected: true,
        session: "agents",
      },
      {
        enabled: false,
        id: profiles[1]?.id,
        label: "Archive",
        selected: false,
        session: "default",
      },
    ]);
    expect(JSON.stringify(parsed)).not.toContain("private.example");
  });

  test("summarizes remote Spaces, Agents, and attention without exposing pane ids", () => {
    const [profile] = parseMachineProfiles(JSON.stringify(profiles));
    if (!profile) throw new Error("Missing machine profile");

    const summary = summarizeMachineSnapshot(profile, snapshot);

    expect(summary).toMatchObject({
      agentCount: 2,
      label: "Build machine",
      needsInput: 1,
      protocol: 22,
      status: "online",
      version: "0.9.0",
      workspaceCount: 1,
      workspaces: [
        {
          agentCount: 2,
          agents: [
            { label: "Muse review", status: "blocked" },
            { label: "pi", status: "working" },
          ],
          label: "herdr",
          needsInput: 1,
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("w1:p1");
  });

  test("uses exact argv routing and isolates unavailable and disabled machines", async () => {
    const run = vi.fn(async (args: string[]) => {
      if (args[0] === "machine") return { stdout: JSON.stringify(profiles) };
      throw Object.assign(new Error("remote failed"), {
        stderr: "ssh: connect to host developer@private.example failed\n",
      });
    });
    const service = new SavedMachineService("herdr-preview", run);

    const result = await service.list();

    expect(run.mock.calls).toEqual([
      [["machine", "list", "--json"], 5_000],
      [["--machine", profiles[0]?.id, "api", "snapshot"], 12_000],
    ]);
    expect(result.machines).toEqual([
      expect.objectContaining({
        error: "Remote snapshot is unavailable",
        status: "offline",
      }),
      expect.objectContaining({ status: "disabled" }),
    ]);
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(await service.list()).toBe(result);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test("rejects malformed machine ids before using them as command arguments", () => {
    expect(() =>
      parseMachineProfiles(
        JSON.stringify([
          {
            enabled: true,
            id: "--session",
            label: "unsafe",
            session: "default",
          },
        ]),
      ),
    ).toThrow("invalid machine profile id");
  });
});
