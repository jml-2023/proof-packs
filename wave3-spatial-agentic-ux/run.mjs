#!/usr/bin/env node
// wave3-spatial-agentic-ux — Geometry & temporal invariant checker for Post-Chatbox Spatial Agentic UI
// ("Agent responses don't belong in the chat box: spatial choreography for agentic interfaces", w10).
// Checks 4 computable spatial UX laws:
//   1. Surface-first separation (0 response pixels inside composer input pill).
//   2. 1:1 rising clearance (canvas content bottom clears floating composer top by >= 8px at every height).
//   3. 0.00px downward-skirt hover stability (foreground target shifts 0px on hover; tray extends downward).
//   4. Sheet-aware rail docking (when right drawer opens, float docks at leftRailRight + 16px with 0 overlap).
// Usage:
//   node run.mjs                             # reproduce naive chat-widget vs spatial-triptych geometry audit
//   node run.mjs --frames geometry.json      # verify your own UI bounding-box snapshot array
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function auditSpatialChoreography(states) {
  const violations = [];
  for (const st of states) {
    if (st.repliesRenderedInsideInputPill) violations.push(`${st.name}: replies_inside_input_pill`);
    if (st.hoverForegroundShiftYPx !== 0) violations.push(`${st.name}: upward_hover_shift_${st.hoverForegroundShiftYPx}px`);
    if (st.lastMessageBottomY > st.composerTopY - 8) {
      violations.push(`${st.name}: message_occluded_by_${+(st.lastMessageBottomY - (st.composerTopY - 8)).toFixed(1)}px`);
    }
    if (st.rightDrawerOpen && st.composerRightX > st.rightDrawerLeftX - 16) {
      violations.push(`${st.name}: drawer_collision_${+(st.composerRightX - (st.rightDrawerLeftX - 16)).toFixed(1)}px`);
    }
  }
  return { statesChecked: states.length, violationsCount: violations.length, violations, passesAll4Laws: violations.length === 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fIdx = args.indexOf("--frames");
  if (fIdx >= 0) {
    const res = auditSpatialChoreography(JSON.parse(fs.readFileSync(args[fIdx + 1], "utf8")));
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passesAll4Laws ? 0 : 2);
  }

  const NAIVE_CORNER_CHATBOX = [
    { name: "rest", repliesRenderedInsideInputPill: true, hoverForegroundShiftYPx: -12, lastMessageBottomY: 940, composerTopY: 920, rightDrawerOpen: false, composerRightX: 1380, rightDrawerLeftX: 1440 },
    { name: "multiline_grow", repliesRenderedInsideInputPill: true, hoverForegroundShiftYPx: -12, lastMessageBottomY: 940, composerTopY: 840, rightDrawerOpen: false, composerRightX: 1380, rightDrawerLeftX: 1440 },
    { name: "drawer_open", repliesRenderedInsideInputPill: true, hoverForegroundShiftYPx: -12, lastMessageBottomY: 940, composerTopY: 840, rightDrawerOpen: true, composerRightX: 1180, rightDrawerLeftX: 920 },
  ];

  const SPATIAL_AGENTIC_FLOAT = [
    { name: "rest_64px", repliesRenderedInsideInputPill: false, hoverForegroundShiftYPx: 0, lastMessageBottomY: 948, composerTopY: 966, rightDrawerOpen: false, composerRightX: 1060, rightDrawerLeftX: 1440 },
    { name: "multiline_148px", repliesRenderedInsideInputPill: false, hoverForegroundShiftYPx: 0, lastMessageBottomY: 864, composerTopY: 882, rightDrawerOpen: false, composerRightX: 1060, rightDrawerLeftX: 1440 },
    { name: "drawer_open_docked_left", repliesRenderedInsideInputPill: false, hoverForegroundShiftYPx: 0, lastMessageBottomY: 864, composerTopY: 882, rightDrawerOpen: true, composerRightX: 880, rightDrawerLeftX: 920 },
  ];

  const naiveAudit = auditSpatialChoreography(NAIVE_CORNER_CHATBOX);
  const spatialAudit = auditSpatialChoreography(SPATIAL_AGENTIC_FLOAT);
  const results = { generatedAt: "2026-11-19T15:00:00Z", naiveCornerChatbox: naiveAudit, spatialAgenticFloat: spatialAudit };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    naiveViolations: naiveAudit.violationsCount,
    spatialViolations: spatialAudit.violationsCount,
    spatialPasses: spatialAudit.passesAll4Laws,
  }));
}
