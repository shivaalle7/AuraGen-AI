import { describe, it, expect } from "vitest";
import { mockSpec, uiSpecSchema } from "./index.js";
describe("safe UI contract", () => {
  it("accepts the complete mock fixture", () => expect(uiSpecSchema.safeParse(mockSpec).success).toBe(true));
  it("rejects arbitrary executable components", () => expect(uiSpecSchema.safeParse({...mockSpec, fields: mockSpec.fields.map(f => ({...f, component: "script"}))}).success).toBe(false));
  it("rejects lost or duplicated fields", () => expect(uiSpecSchema.safeParse({...mockSpec, fields: [mockSpec.fields[0], mockSpec.fields[0], mockSpec.fields[2]]}).success).toBe(false));
  it("rejects unknown executable properties", () => expect(uiSpecSchema.safeParse({...mockSpec, onClick: "alert(1)"}).success).toBe(false));
});
