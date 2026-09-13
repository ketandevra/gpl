export type {
  ApplyBallResult,
  BallEvent,
  BallRecord,
  ExtraType,
  InningsState,
  InningsStatus,
  WicketType,
} from "@/lib/scoring/types";

export {
  applyBall,
  undoLastBall,
  deliverySlot,
} from "@/lib/scoring/engine";

export {
  oversFromLegalBalls,
  runRate,
  requiredRunRate,
} from "@/lib/scoring/format";

// Server queries/service stay in their own modules so client + tests
// can import the engine without pulling `server-only`.
