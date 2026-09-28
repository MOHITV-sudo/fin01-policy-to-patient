from typing import Dict, Any, Optional, List, Tuple
from schemas import PolicyRules, CalculationStep, CostBreakdownRange

def clean_numeric(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        # Remove currency symbols, commas, percent, whitespace
        cleaned = val.replace("₹", "").replace("Rs.", "").replace("Rs", "").replace(",", "").replace("%", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None

class CostCalculator:
    """
    100% Deterministic Python calculation engine for insurance claims.
    Never lets LLM compute money.
    Strictly follows ordered operations:
    1. Waiting period check
    2. Exclusion check
    3. Deductible subtraction
    4. Sub-limit and sum-insured capping
    5. Room rent proportional deduction (if applicable)
    6. Co-pay percentage calculation
    7. Final insurer vs patient OOP split
    """

    @staticmethod
    def calculate(
        treatment_cost: float,
        rules: Dict[str, Any],
        policy_age_months: int,
        treatment_name: str,
        room_rent_actual: Optional[float] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        overrides = overrides or {}
        steps: List[CalculationStep] = []
        missing_fields: List[str] = []

        # Helper to extract field value & evidence page
        def get_field_info(key: str) -> Tuple[Any, Optional[int]]:
            if key in overrides and overrides[key] is not None:
                return overrides[key], None
            field_data = rules.get(key)
            if field_data is None:
                return None, None
            if isinstance(field_data, dict):
                val = field_data.get("value")
                ev = field_data.get("evidence")
                page = ev.get("page") if isinstance(ev, dict) else None
                return val, page
            if hasattr(field_data, "value"):
                page = field_data.evidence.page if field_data.evidence else None
                return field_data.value, page
            return field_data, None

        # 1. Check required financial fields
        raw_sum_insured, sum_insured_page = get_field_info("sum_insured")
        raw_limit, limit_page = get_field_info("coverage_limit")
        raw_copay, copay_page = get_field_info("copay_percent")
        raw_deductible, deductible_page = get_field_info("deductible")

        sum_insured = clean_numeric(raw_sum_insured)
        coverage_limit = clean_numeric(raw_limit)
        effective_limit = coverage_limit if coverage_limit is not None else sum_insured

        copay_percent = clean_numeric(raw_copay)
        deductible = clean_numeric(raw_deductible)

        if effective_limit is None:
            missing_fields.append("coverage limit / sum insured")
        if copay_percent is None:
            missing_fields.append("co-pay percentage")

        # If required rules are missing, refuse to give a point estimate
        if missing_fields:
            missing_str = ", ".join(missing_fields)
            return {
                "status": "INSUFFICIENT_INFORMATION",
                "is_eligible": False,
                "insurer_pays": None,
                "out_of_pocket": None,
                "steps": [
                    CalculationStep(
                        label="Information Check",
                        amount=None,
                        note=f"Required policy parameter(s) missing: {missing_str}.",
                        source_page=None,
                    )
                ],
                "missing_fields": missing_fields,
                "message": f"Unable to produce a reliable estimate. Missing: {missing_str}. Please verify with the insurer.",
            }

        # Deductible defaults to 0 if not stated or null, unless strictly missing
        if deductible is None:
            deductible = 0.0

        # 2. Waiting period check
        specific_waiting, wait_page = get_field_info("specific_waiting_periods")
        general_waiting, gen_wait_page = get_field_info("waiting_period_months")

        treatment_clean = treatment_name.strip().lower()
        required_waiting_months = 0
        wait_matched_rule = None

        if isinstance(specific_waiting, dict):
            for proc, months in specific_waiting.items():
                if proc.strip().lower() in treatment_clean or treatment_clean in proc.strip().lower():
                    required_waiting_months = int(months)
                    wait_matched_rule = proc
                    break

        if required_waiting_months == 0 and general_waiting is not None:
            try:
                required_waiting_months = int(general_waiting)
                wait_matched_rule = "General Illness"
            except (ValueError, TypeError):
                pass

        if required_waiting_months > 0 and policy_age_months < required_waiting_months:
            steps.append(
                CalculationStep(
                    label="Waiting Period Verification",
                    amount=0.0,
                    note=(
                        f"Waiting period for '{treatment_name}' is {required_waiting_months} months. "
                        f"Current policy age is {policy_age_months} months. Claim is not admissible at this time."
                    ),
                    source_page=wait_page or gen_wait_page,
                )
            )
            return {
                "status": "NOT_COVERED",
                "is_eligible": False,
                "insurer_pays": 0.0,
                "out_of_pocket": round(treatment_cost, 2),
                "steps": steps,
                "missing_fields": [],
                "message": f"Waiting period not satisfied ({policy_age_months}/{required_waiting_months} months). Insurer pays ₹0.",
            }

        steps.append(
            CalculationStep(
                label="Waiting Period Verification",
                amount=None,
                note=(
                    f"Waiting period satisfied: Policy age ({policy_age_months} months) >= required "
                    f"waiting period ({required_waiting_months} months)."
                    if required_waiting_months > 0
                    else "No specific waiting period restriction applicable."
                ),
                source_page=wait_page or gen_wait_page,
            )
        )

        # 3. Exclusion check
        exclusions_list, excl_page = get_field_info("exclusions")
        is_excluded = False
        exclusion_reason = ""
        if isinstance(exclusions_list, list):
            for excl in exclusions_list:
                excl_clean = str(excl).lower()
                # Check for keywords
                for kw in treatment_clean.split():
                    if len(kw) > 3 and kw in excl_clean:
                        is_excluded = True
                        exclusion_reason = excl
                        break
                if is_excluded:
                    break

        if is_excluded:
            steps.append(
                CalculationStep(
                    label="Exclusion Clause Check",
                    amount=0.0,
                    note=f"Treatment '{treatment_name}' is excluded under policy clause: '{exclusion_reason}'.",
                    source_page=excl_page,
                )
            )
            return {
                "status": "NOT_COVERED",
                "is_eligible": False,
                "insurer_pays": 0.0,
                "out_of_pocket": round(treatment_cost, 2),
                "steps": steps,
                "missing_fields": [],
                "message": f"Treatment excluded under policy conditions. Insurer pays ₹0.",
            }

        steps.append(
            CalculationStep(
                label="Initial Admissibility",
                amount=round(treatment_cost, 2),
                note=f"Treatment '{treatment_name}' is admissible under policy coverage terms. Base estimated bill: ₹{treatment_cost:,.2f}.",
                source_page=None,
            )
        )

        # 4. Subtract Deductible
        eligible_amount = max(0.0, treatment_cost - deductible)
        steps.append(
            CalculationStep(
                label="Deductible Application",
                amount=round(eligible_amount, 2),
                note=f"Deductible of ₹{deductible:,.2f} subtracted. Admissible claim base: ₹{eligible_amount:,.2f}.",
                source_page=deductible_page,
            )
        )

        # 5. Check Sub-Limits & Overall Coverage Limit
        sub_limits, sub_limit_page = get_field_info("sub_limits")
        applied_sub_limit = None
        applied_limit_page = limit_page or sum_insured_page

        if isinstance(sub_limits, dict):
            for proc, limit_val in sub_limits.items():
                if proc.strip().lower() in treatment_clean or treatment_clean in proc.strip().lower():
                    clean_sub = clean_numeric(limit_val)
                    if clean_sub is not None:
                        applied_sub_limit = clean_sub
                        applied_limit_page = sub_limit_page
                        break

        effective_cap = effective_limit
        cap_note = f"Capped at overall policy coverage limit of ₹{effective_limit:,.2f}."
        if applied_sub_limit is not None:
            if applied_sub_limit < effective_cap:
                effective_cap = applied_sub_limit
                cap_note = f"Capped at specific procedure sub-limit for '{treatment_name}' of ₹{applied_sub_limit:,.2f}."

        covered_after_limit = min(eligible_amount, effective_cap)
        steps.append(
            CalculationStep(
                label="Limit & Sub-Limit Application",
                amount=round(covered_after_limit, 2),
                note=f"{cap_note} Covered amount eligible for settlement: ₹{covered_after_limit:,.2f}.",
                source_page=applied_limit_page,
            )
        )

        # 6. Room Rent Proportionate Deduction (if given)
        room_rent_limit_val, room_page = get_field_info("room_rent_limit_per_day")
        room_rent_limit = clean_numeric(room_rent_limit_val)
        if room_rent_actual is not None and room_rent_limit is not None and room_rent_limit > 0:
            if room_rent_actual > room_rent_limit:
                proportion = round(room_rent_limit / room_rent_actual, 4)
                adjusted_covered = round(covered_after_limit * proportion, 2)
                steps.append(
                    CalculationStep(
                        label="Room Rent Proportionate Deduction",
                        amount=adjusted_covered,
                        note=(
                            f"Actual room rent ₹{room_rent_actual:,.2f}/day exceeds limit of ₹{room_rent_limit:,.2f}/day. "
                            f"Proportionate reduction factor {proportion:.2%} applied. Covered amount adjusted to ₹{adjusted_covered:,.2f}."
                        ),
                        source_page=room_page,
                    )
                )
                covered_after_limit = adjusted_covered

        # 7. Apply Co-Payment
        copay_amount = round(covered_after_limit * (copay_percent / 100.0), 2)
        insurer_pays = round(covered_after_limit - copay_amount, 2)
        out_of_pocket = round(treatment_cost - insurer_pays, 2)

        steps.append(
            CalculationStep(
                label="Co-Payment Application",
                amount=round(copay_amount, 2),
                note=f"Co-payment of {copay_percent}% applied on ₹{covered_after_limit:,.2f} (Co-pay deduction: ₹{copay_amount:,.2f}).",
                source_page=copay_page,
            )
        )

        steps.append(
            CalculationStep(
                label="Final Settlement",
                amount=insurer_pays,
                note=f"Insurer portion: ₹{insurer_pays:,.2f} | Patient Out-of-Pocket: ₹{out_of_pocket:,.2f}.",
                source_page=None,
            )
        )

        return {
            "status": "CALCULATED",
            "is_eligible": True,
            "treatment_cost": round(treatment_cost, 2),
            "insurer_pays": insurer_pays,
            "out_of_pocket": out_of_pocket,
            "steps": steps,
            "missing_fields": [],
            "message": "Calculation successfully completed.",
        }
