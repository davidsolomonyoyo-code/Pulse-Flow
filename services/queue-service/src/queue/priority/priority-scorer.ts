/**
 * Implements the priority scoring formula from the 14-volume blueprint,
 * Volume 3, as written:
 *
 *   priority_score(p) =
 *       w_acuity        * acuity_index(p)
 *     + w_wait          * normalized_wait_time(p)
 *     + w_deterioration * deterioration_risk(p)
 *     + w_service       * service_level_breach_risk(p)
 *     + w_equity        * vulnerability_adjustment(p)
 *     + w_transfer      * transfer_urgency(p)
 *     - w_blocker       * unresolved_dependency_penalty(p)
 *
 *   subject to hard constraints — any failure makes the patient
 *   INELIGIBLE for this candidate/queue, not just lower-scored:
 *       specialty_match
 *       infection_isolation_compatible
 *       age_band_compatible
 *       payer_rule_allows
 *       jurisdiction_rule_allows
 *
 * This is deliberately a deterministic, explainable policy function — not
 * a learned model. The source blueprint frames ML as a later layer that
 * may assist but must never replace this kind of explainable scoring for
 * something as consequential as care priority. That framing is preserved
 * here on purpose: there is no ML in this file, and there shouldn't be.
 */

export interface PriorityFactors {
  acuityIndex: number; // 0..1, higher = more urgent
  normalizedWaitTime: number; // 0..1, higher = waited longer relative to SLA
  deteriorationRisk: number; // 0..1
  serviceLevelBreachRisk: number; // 0..1
  vulnerabilityAdjustment: number; // 0..1, equity adjustment
  transferUrgency: number; // 0..1
  unresolvedDependencyPenalty: number; // 0..1, e.g. missing lab result blocking progress
}

export interface PriorityWeights {
  acuity: number;
  wait: number;
  deterioration: number;
  service: number;
  equity: number;
  transfer: number;
  blocker: number;
}

export interface HardConstraints {
  specialtyMatch: boolean;
  infectionIsolationCompatible: boolean;
  ageBandCompatible: boolean;
  payerRuleAllows: boolean;
  jurisdictionRuleAllows: boolean;
}

export interface PriorityScoreResult {
  eligible: boolean;
  score: number | null;
  /** Which hard constraints (if any) failed — present even when eligible (empty array) so callers don't need a separate eligibility check. */
  failedConstraints: Array<keyof HardConstraints>;
  /** Per-term contribution, for explainability/audit — never hide why a score is what it is. */
  breakdown: Record<keyof PriorityFactors, number> | null;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  acuity: 0.35,
  wait: 0.15,
  deterioration: 0.2,
  service: 0.1,
  equity: 0.1,
  transfer: 0.1,
  blocker: 0.15,
};

export class PriorityScorer {
  constructor(private readonly weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS) {}

  score(factors: PriorityFactors, constraints: HardConstraints): PriorityScoreResult {
    const failedConstraints = this.evaluateHardConstraints(constraints);

    if (failedConstraints.length > 0) {
      return {
        eligible: false,
        score: null,
        failedConstraints,
        breakdown: null,
      };
    }

    const breakdown: Record<keyof PriorityFactors, number> = {
      acuityIndex: this.weights.acuity * factors.acuityIndex,
      normalizedWaitTime: this.weights.wait * factors.normalizedWaitTime,
      deteriorationRisk: this.weights.deterioration * factors.deteriorationRisk,
      serviceLevelBreachRisk: this.weights.service * factors.serviceLevelBreachRisk,
      vulnerabilityAdjustment: this.weights.equity * factors.vulnerabilityAdjustment,
      transferUrgency: this.weights.transfer * factors.transferUrgency,
      unresolvedDependencyPenalty:
        -1 * this.weights.blocker * factors.unresolvedDependencyPenalty,
    };

    const score = Object.values(breakdown).reduce((sum, term) => sum + term, 0);

    return {
      eligible: true,
      score,
      failedConstraints: [],
      breakdown,
    };
  }

  private evaluateHardConstraints(constraints: HardConstraints): Array<keyof HardConstraints> {
    const failed: Array<keyof HardConstraints> = [];
    if (!constraints.specialtyMatch) failed.push('specialtyMatch');
    if (!constraints.infectionIsolationCompatible) failed.push('infectionIsolationCompatible');
    if (!constraints.ageBandCompatible) failed.push('ageBandCompatible');
    if (!constraints.payerRuleAllows) failed.push('payerRuleAllows');
    if (!constraints.jurisdictionRuleAllows) failed.push('jurisdictionRuleAllows');
    return failed;
  }
}
