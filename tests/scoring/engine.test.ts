import { describe, expect, it } from "vitest";
import {
  applyBall,
  deliverySlot,
  undoLastBall,
} from "../../src/lib/scoring/engine";
import {
  oversFromLegalBalls,
  requiredRunRate,
  runRate,
} from "../../src/lib/scoring/format";
import type { InningsState } from "../../src/lib/scoring/types";

function freshInnings(
  overrides: Partial<InningsState> = {},
): InningsState {
  return {
    total_runs: 0,
    wickets: 0,
    legal_balls: 0,
    target_runs: null,
    status: "not_started",
    striker_id: "striker",
    non_striker_id: "non_striker",
    bowler_id: "bowler",
    overs_per_innings: 20,
    free_hit: false,
    ball_count: 0,
    ...overrides,
  };
}

describe("deliverySlot", () => {
  it("maps legal balls to over and ball-in-over", () => {
    expect(deliverySlot(0)).toEqual({ over_number: 0, ball_in_over: 1 });
    expect(deliverySlot(5)).toEqual({ over_number: 0, ball_in_over: 6 });
    expect(deliverySlot(6)).toEqual({ over_number: 1, ball_in_over: 1 });
  });
});

describe("applyBall — legal runs", () => {
  it("adds runs and counts a legal ball", () => {
    const { state, ball } = applyBall(freshInnings(), { batsman_runs: 4 });
    expect(state.total_runs).toBe(4);
    expect(state.legal_balls).toBe(1);
    expect(state.status).toBe("in_progress");
    expect(ball.is_legal_delivery).toBe(true);
    expect(ball.batsman_runs).toBe(4);
    expect(ball.extra_runs).toBe(0);
    expect(ball.total_runs).toBe(4);
    expect(ball.sequence_no).toBe(1);
    expect(ball.over_number).toBe(0);
    expect(ball.ball_in_over).toBe(1);
  });

  it("rotates strike on odd runs", () => {
    const { state } = applyBall(freshInnings(), { batsman_runs: 1 });
    expect(state.striker_id).toBe("non_striker");
    expect(state.non_striker_id).toBe("striker");
  });

  it("does not rotate strike on even runs", () => {
    const { state } = applyBall(freshInnings(), { batsman_runs: 2 });
    expect(state.striker_id).toBe("striker");
    expect(state.non_striker_id).toBe("non_striker");
  });

  it("rotates strike at end of over when innings continues", () => {
    let state = freshInnings({ legal_balls: 5, status: "in_progress" });
    // Dot ball completes the over → end-of-over rotation
    ({ state } = applyBall(state, { batsman_runs: 0 }));
    expect(state.legal_balls).toBe(6);
    expect(state.striker_id).toBe("non_striker");
    expect(state.non_striker_id).toBe("striker");
  });

  it("odd run then end of over nets even swaps (same strike)", () => {
    let state = freshInnings({ legal_balls: 5, status: "in_progress" });
    ({ state } = applyBall(state, { batsman_runs: 1 }));
    // odd rotate + end-of-over rotate → original strike
    expect(state.striker_id).toBe("striker");
    expect(state.non_striker_id).toBe("non_striker");
  });
});

describe("applyBall — extras", () => {
  it("wide is not a legal delivery and defaults to 1 extra", () => {
    const { state, ball } = applyBall(freshInnings(), { extra_type: "wide" });
    expect(state.total_runs).toBe(1);
    expect(state.legal_balls).toBe(0);
    expect(ball.is_legal_delivery).toBe(false);
    expect(ball.extra_runs).toBe(1);
    expect(state.striker_id).toBe("striker"); // no rotation on bare wide
  });

  it("wide with additional runs rotates on odd completed runs", () => {
    const { state, ball } = applyBall(freshInnings(), {
      extra_type: "wide",
      extra_runs: 2, // 1 wide + 1 run taken
    });
    expect(ball.extra_runs).toBe(2);
    expect(state.total_runs).toBe(2);
    expect(state.legal_balls).toBe(0);
    expect(state.striker_id).toBe("non_striker");
  });

  it("no_ball is illegal, adds free hit, counts bat runs", () => {
    const { state, ball } = applyBall(freshInnings(), {
      extra_type: "no_ball",
      batsman_runs: 4,
      extra_runs: 1,
    });
    expect(state.total_runs).toBe(5);
    expect(state.legal_balls).toBe(0);
    expect(state.free_hit).toBe(true);
    expect(ball.free_hit_next).toBe(true);
    expect(ball.is_legal_delivery).toBe(false);
    expect(state.striker_id).toBe("striker"); // even bat runs
  });

  it("no_ball with odd bat runs rotates strike", () => {
    const { state } = applyBall(freshInnings(), {
      extra_type: "no_ball",
      batsman_runs: 1,
      extra_runs: 1,
    });
    expect(state.striker_id).toBe("non_striker");
  });

  it("bye / leg_bye are legal and rotate on odd extras", () => {
    const bye = applyBall(freshInnings(), {
      extra_type: "bye",
      extra_runs: 1,
    });
    expect(bye.state.legal_balls).toBe(1);
    expect(bye.state.total_runs).toBe(1);
    expect(bye.ball.batsman_runs).toBe(0);
    expect(bye.state.striker_id).toBe("non_striker");

    const lb = applyBall(freshInnings(), {
      extra_type: "leg_bye",
      extra_runs: 2,
    });
    expect(lb.state.legal_balls).toBe(1);
    expect(lb.state.striker_id).toBe("striker");
  });

  it("penalty adds runs without a legal delivery or strike change", () => {
    const { state, ball } = applyBall(freshInnings(), {
      extra_type: "penalty",
      extra_runs: 5,
    });
    expect(state.total_runs).toBe(5);
    expect(state.legal_balls).toBe(0);
    expect(ball.is_legal_delivery).toBe(false);
    expect(state.striker_id).toBe("striker");
  });
});

describe("applyBall — wickets", () => {
  it("bowled increments wickets and replaces striker", () => {
    const { state, ball } = applyBall(freshInnings(), {
      batsman_runs: 0,
      is_wicket: true,
      wicket_type: "bowled",
      dismissed_player_id: "striker",
      new_batter_id: "new_batter",
    });
    expect(state.wickets).toBe(1);
    expect(ball.is_wicket).toBe(true);
    expect(state.striker_id).toBe("new_batter");
    expect(state.non_striker_id).toBe("non_striker");
    expect(state.legal_balls).toBe(1);
  });

  it("retired_hurt does not increment team wickets", () => {
    const { state } = applyBall(freshInnings(), {
      batsman_runs: 0,
      is_wicket: true,
      wicket_type: "retired_hurt",
      dismissed_player_id: "striker",
      new_batter_id: "new_batter",
    });
    expect(state.wickets).toBe(0);
    expect(state.striker_id).toBe("new_batter");
  });

  it("ignores non-run-out dismissals on a free hit", () => {
    const { state, ball } = applyBall(freshInnings({ free_hit: true }), {
      batsman_runs: 0,
      is_wicket: true,
      wicket_type: "bowled",
      dismissed_player_id: "striker",
    });
    expect(ball.is_wicket).toBe(false);
    expect(state.wickets).toBe(0);
    expect(state.striker_id).toBe("striker");
    // Legal ball consumes free hit
    expect(state.free_hit).toBe(false);
  });

  it("allows run_out on a free hit", () => {
    const { state, ball } = applyBall(freshInnings({ free_hit: true }), {
      batsman_runs: 0,
      is_wicket: true,
      wicket_type: "run_out",
      dismissed_player_id: "non_striker",
      new_batter_id: "new_batter",
    });
    expect(ball.is_wicket).toBe(true);
    expect(state.wickets).toBe(1);
    expect(state.non_striker_id).toBe("new_batter");
  });

  it("wide after no_ball keeps free hit until a legal ball", () => {
    let state = freshInnings();
    ({ state } = applyBall(state, { extra_type: "no_ball", extra_runs: 1 }));
    expect(state.free_hit).toBe(true);
    ({ state } = applyBall(state, { extra_type: "wide", extra_runs: 1 }));
    expect(state.free_hit).toBe(true);
    ({ state } = applyBall(state, { batsman_runs: 0 }));
    expect(state.free_hit).toBe(false);
  });
});

describe("applyBall — innings end", () => {
  it("completes when all out", () => {
    const { state } = applyBall(
      freshInnings({ wickets: 9, status: "in_progress", max_wickets: 10 }),
      {
        batsman_runs: 0,
        is_wicket: true,
        wicket_type: "lbw",
        dismissed_player_id: "striker",
      },
    );
    expect(state.status).toBe("completed");
    expect(state.wickets).toBe(10);
  });

  it("completes when overs are used up", () => {
    const { state } = applyBall(
      freshInnings({
        legal_balls: 119,
        overs_per_innings: 20,
        status: "in_progress",
      }),
      { batsman_runs: 1 },
    );
    expect(state.legal_balls).toBe(120);
    expect(state.status).toBe("completed");
    // No end-of-over rotate when innings finished
    expect(state.striker_id).toBe("non_striker"); // only odd-run rotate
  });

  it("completes when chase target is reached", () => {
    const { state } = applyBall(
      freshInnings({
        total_runs: 99,
        target_runs: 100,
        status: "in_progress",
      }),
      { batsman_runs: 1 },
    );
    expect(state.total_runs).toBe(100);
    expect(state.status).toBe("completed");
  });

  it("does not rotate at end of over if innings completed on that ball", () => {
    // 10th wicket on last ball of over — innings ends, no over rotation
    const { state } = applyBall(
      freshInnings({
        wickets: 9,
        legal_balls: 5,
        status: "in_progress",
      }),
      {
        batsman_runs: 0,
        is_wicket: true,
        wicket_type: "bowled",
        dismissed_player_id: "striker",
        new_batter_id: "new_batter",
      },
    );
    expect(state.status).toBe("completed");
    expect(state.legal_balls).toBe(6);
    // New batter at striker end; no end-of-over swap
    expect(state.striker_id).toBe("new_batter");
    expect(state.non_striker_id).toBe("non_striker");
  });
});

describe("undoLastBall", () => {
  it("reverses runs, legal balls, and strike", () => {
    const start = freshInnings();
    const { state: after, ball } = applyBall(start, { batsman_runs: 3 });
    const undone = undoLastBall(after, ball);
    expect(undone.total_runs).toBe(0);
    expect(undone.legal_balls).toBe(0);
    expect(undone.ball_count).toBe(0);
    expect(undone.striker_id).toBe("striker");
    expect(undone.non_striker_id).toBe("non_striker");
    expect(undone.status).toBe("not_started");
  });

  it("reverses wicket and free-hit state", () => {
    const start = freshInnings({ free_hit: true, status: "in_progress" });
    const { state: after, ball } = applyBall(start, {
      batsman_runs: 0,
      is_wicket: true,
      wicket_type: "run_out",
      dismissed_player_id: "striker",
      new_batter_id: "new_batter",
    });
    expect(after.wickets).toBe(1);
    expect(after.free_hit).toBe(false);
    expect(after.striker_id).toBe("new_batter");

    const undone = undoLastBall(after, ball);
    expect(undone.wickets).toBe(0);
    expect(undone.free_hit).toBe(true);
    expect(undone.striker_id).toBe("striker");
  });

  it("reverses a wide without changing legal balls", () => {
    const start = freshInnings({ status: "in_progress", legal_balls: 2 });
    const { state: after, ball } = applyBall(start, {
      extra_type: "wide",
      extra_runs: 1,
    });
    expect(after.legal_balls).toBe(2);
    expect(after.total_runs).toBe(1);
    const undone = undoLastBall(after, ball);
    expect(undone.legal_balls).toBe(2);
    expect(undone.total_runs).toBe(0);
  });

  it("round-trips a full over", () => {
    let state = freshInnings();
    const balls = [];
    for (let i = 0; i < 6; i++) {
      const result = applyBall(state, { batsman_runs: i % 2 }); // 0,1,0,1,0,1
      state = result.state;
      balls.push(result.ball);
    }
    expect(state.legal_balls).toBe(6);
    expect(state.total_runs).toBe(3);

    for (let i = balls.length - 1; i >= 0; i--) {
      state = undoLastBall(state, balls[i]!);
    }
    expect(state).toMatchObject({
      total_runs: 0,
      wickets: 0,
      legal_balls: 0,
      ball_count: 0,
      striker_id: "striker",
      non_striker_id: "non_striker",
      free_hit: false,
      status: "not_started",
    });
  });
});

describe("format helpers", () => {
  it("oversFromLegalBalls", () => {
    expect(oversFromLegalBalls(0)).toBe("0.0");
    expect(oversFromLegalBalls(1)).toBe("0.1");
    expect(oversFromLegalBalls(6)).toBe("1.0");
    expect(oversFromLegalBalls(13)).toBe("2.1");
  });

  it("runRate", () => {
    expect(runRate(0, 0)).toBe(0);
    expect(runRate(12, 6)).toBe(12);
    expect(runRate(10, 3)).toBeCloseTo(20);
  });

  it("requiredRunRate", () => {
    expect(requiredRunRate(0, 12)).toBe(0);
    expect(requiredRunRate(36, 18)).toBe(12);
    expect(requiredRunRate(10, 0)).toBe(Infinity);
    expect(requiredRunRate(0, 0)).toBe(0);
  });
});
