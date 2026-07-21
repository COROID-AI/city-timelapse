import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "./store";
import { ERA_YEARS } from "../data/eras";

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      targetYear: 2025,
      targetEra: 4,
      audioEnabled: true,
      audioStarted: false,
      reducedMotion: false,
      status: "loading",
      error: null,
      contextLost: false,
    });
  });

  it("selectEra sets both year and index", () => {
    useAppStore.getState().selectEra(1945);
    expect(useAppStore.getState().targetYear).toBe(1945);
    expect(useAppStore.getState().targetEra).toBe(0);
  });

  it("selectEraIndex clamps to valid range", () => {
    useAppStore.getState().selectEraIndex(-5);
    expect(useAppStore.getState().targetEra).toBe(0);
    useAppStore.getState().selectEraIndex(999);
    expect(useAppStore.getState().targetEra).toBe(ERA_YEARS.length - 1);
  });

  it("stepEra moves by delta and clamps", () => {
    useAppStore.getState().selectEraIndex(0);
    useAppStore.getState().stepEra(1);
    expect(useAppStore.getState().targetEra).toBe(1);
    useAppStore.getState().stepEra(100);
    expect(useAppStore.getState().targetEra).toBe(ERA_YEARS.length - 1);
    useAppStore.getState().stepEra(-100);
    expect(useAppStore.getState().targetEra).toBe(0);
  });

  it("toggleAudio flips enabled", () => {
    expect(useAppStore.getState().audioEnabled).toBe(true);
    useAppStore.getState().toggleAudio();
    expect(useAppStore.getState().audioEnabled).toBe(false);
  });

  it("markAudioStarted sets the flag", () => {
    expect(useAppStore.getState().audioStarted).toBe(false);
    useAppStore.getState().markAudioStarted();
    expect(useAppStore.getState().audioStarted).toBe(true);
  });

  it("setError sets status error + message", () => {
    useAppStore.getState().setError("webgl-unavailable", "no webgl");
    const s = useAppStore.getState();
    expect(s.status).toBe("error");
    expect(s.error?.code).toBe("webgl-unavailable");
    expect(s.error?.message).toBe("no webgl");
  });

  it("setContextLost toggles context lost", () => {
    useAppStore.getState().setContextLost(true);
    expect(useAppStore.getState().contextLost).toBe(true);
  });
});
