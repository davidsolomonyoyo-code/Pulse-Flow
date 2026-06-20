import {
  DEFAULT_PRIORITY_WEIGHTS,
  HardConstraints,
  PriorityFactors,
  PriorityScorer,
} from '../src/queue/priority/priority-scorer';

function allConstraintsPass(): HardConstraints {
  return {
    specialtyMatch: true,
    infectionIsolationCompatible: true,
    ageBandCompatible: true,
    payerRuleAllows: true,
    jurisdictionRuleAllows: true,
  };
}

function midRangeFactors(): PriorityFactors {
  return {
    acuityIndex: 0.5,
    normalizedWaitTime: 0.5,
    deteriorationRisk: 0.5,
    serviceLevelBreachRisk: 0.5,
    vulnerabilityAdjustment: 0.5,
    transferUrgency: 0.5,
    unresolvedDependencyPenalty: 0.5,
  };
}

describe('PriorityScorer', () => {
  const scorer = new PriorityScorer();

  it('computes a score matching the weighted-sum formula when all constraints pass', () => {
    const result = scorer.score(midRangeFactors(), allConstraintsPass());

    expect(result.eligible).toBe(true);
    expect(result.failedConstraints).toHaveLength(0);

    const w = DEFAULT_PRIORITY_WEIGHTS;
    const expected =
      w.acuity * 0.5 +
      w.wait * 0.5 +
      w.deterioration * 0.5 +
      w.service * 0.5 +
      w.equity * 0.5 +
      w.transfer * 0.5 -
      w.blocker * 0.5;

    expect(result.score).toBeCloseTo(expected, 10);
  });

  it('treats higher acuity as higher priority, all else equal', () => {
    const low = scorer.score(
      { ...midRangeFactors(), acuityIndex: 0.1 },
      allConstraintsPass(),
    );
    const high = scorer.score(
      { ...midRangeFactors(), acuityIndex: 0.9 },
      allConstraintsPass(),
    );

    expect(high.score!).toBeGreaterThan(low.score!);
  });

  it.each([
    'specialtyMatch',
    'infectionIsolationCompatible',
    'ageBandCompatible',
    'payerRuleAllows',
    'jurisdictionRuleAllows',
  ] as Array<keyof HardConstraints>)(
    'marks the patient ineligible (not just low-scored) when %s fails, even with maximal acuity',
    (failingConstraint) => {
      const constraints = allConstraintsPass();
      constraints[failingConstraint] = false;

      // Maximal urgency on every soft factor — a real system must not let
      // urgency override a hard constraint like isolation incompatibility
      // or jurisdiction rules. This is the test that actually matters.
      const result = scorer.score(
        {
          acuityIndex: 1,
          normalizedWaitTime: 1,
          deteriorationRisk: 1,
          serviceLevelBreachRisk: 1,
          vulnerabilityAdjustment: 1,
          transferUrgency: 1,
          unresolvedDependencyPenalty: 0,
        },
        constraints,
      );

      expect(result.eligible).toBe(false);
      expect(result.score).toBeNull();
      expect(result.failedConstraints).toContain(failingConstraint);
    },
  );

  it('reports every failed constraint when multiple fail simultaneously', () => {
    const constraints = allConstraintsPass();
    constraints.specialtyMatch = false;
    constraints.jurisdictionRuleAllows = false;

    const result = scorer.score(midRangeFactors(), constraints);

    expect(result.eligible).toBe(false);
    expect(result.failedConstraints).toEqual(
      expect.arrayContaining(['specialtyMatch', 'jurisdictionRuleAllows']),
    );
    expect(result.failedConstraints).toHaveLength(2);
  });

  it('produces a breakdown whose terms sum to the total score, for audit/explainability', () => {
    const result = scorer.score(midRangeFactors(), allConstraintsPass());
    const sumOfTerms = Object.values(result.breakdown!).reduce((a, b) => a + b, 0);
    expect(sumOfTerms).toBeCloseTo(result.score!, 10);
  });
});
