"""
Sensitivity analysis module for DCF valuations.

Analyzes how changes in key assumptions affect valuation.
"""

from typing import Dict, List, Tuple
import numpy as np
from .models.schemas import DCFInputs
from .dcf import calculate_dcf


def sensitivity_to_wacc(
    base_inputs: DCFInputs,
    wacc_range: Tuple[float, float] = (0.08, 0.14),
    steps: int = 5
) -> Dict:
    """
    Analyze sensitivity of DCF to changes in WACC (discount rate).

    Args:
        base_inputs: Base DCF inputs
        wacc_range: Range of WACC to test (min, max)
        steps: Number of steps in the range

    Returns:
        Sensensitivity analysis results
    """
    wacc_values = np.linspace(wacc_range[0], wacc_range[1], steps)
    results = []

    for wacc in wacc_values:
        test_inputs = DCFInputs(
            free_cash_flow=base_inputs.free_cash_flow,
            growth_rate_years=base_inputs.growth_rate_years,
            discount_rate=wacc,
            terminal_growth_rate=base_inputs.terminal_growth_rate,
            years_to_project=base_inputs.years_to_project
        )
        dcf_result = calculate_dcf(test_inputs)
        results.append({
            "wacc": f"{wacc:.2%}",
            "enterprise_value": round(dcf_result.enterprise_value, 2),
            "pv_forecast": round(dcf_result.present_value, 2),
            "terminal_value": round(dcf_result.terminal_value, 2)
        })

    # Calculate range and volatility
    values = [r["enterprise_value"] for r in results]
    value_range = max(values) - min(values)
    pct_change = (value_range / np.mean(values)) * 100 if np.mean(values) > 0 else 0

    return {
        "parameter": "WACC",
        "results": results,
        "min_value": round(min(values), 2),
        "max_value": round(max(values), 2),
        "range": round(value_range, 2),
        "pct_sensitivity": round(pct_change, 2)
    }


def sensitivity_to_growth(
    base_inputs: DCFInputs,
    growth_range: Tuple[float, float] = (0.01, 0.05),
    steps: int = 5
) -> Dict:
    """
    Analyze sensitivity of DCF to changes in terminal growth rate.

    Args:
        base_inputs: Base DCF inputs
        growth_range: Range of terminal growth to test (min, max)
        steps: Number of steps in the range

    Returns:
        Sensitivity analysis results
    """
    growth_values = np.linspace(growth_range[0], growth_range[1], steps)
    results = []

    for growth in growth_values:
        test_inputs = DCFInputs(
            free_cash_flow=base_inputs.free_cash_flow,
            growth_rate_years=base_inputs.growth_rate_years,
            discount_rate=base_inputs.discount_rate,
            terminal_growth_rate=growth,
            years_to_project=base_inputs.years_to_project
        )
        dcf_result = calculate_dcf(test_inputs)
        results.append({
            "terminal_growth": f"{growth:.2%}",
            "enterprise_value": round(dcf_result.enterprise_value, 2),
            "pv_forecast": round(dcf_result.present_value, 2),
            "terminal_value": round(dcf_result.terminal_value, 2)
        })

    values = [r["enterprise_value"] for r in results]
    value_range = max(values) - min(values)
    pct_change = (value_range / np.mean(values)) * 100 if np.mean(values) > 0 else 0

    return {
        "parameter": "Terminal Growth Rate",
        "results": results,
        "min_value": round(min(values), 2),
        "max_value": round(max(values), 2),
        "range": round(value_range, 2),
        "pct_sensitivity": round(pct_change, 2)
    }


def sensitivity_to_fcf(
    base_inputs: DCFInputs,
    fcf_range: Tuple[float, float] = (0.8, 1.2),
    steps: int = 5
) -> Dict:
    """
    Analyze sensitivity of DCF to changes in base free cash flow.

    Args:
        base_inputs: Base DCF inputs
        fcf_range: Range of FCF multipliers to test (min, max)
        steps: Number of steps in the range

    Returns:
        Sensitivity analysis results
    """
    fcf_multipliers = np.linspace(fcf_range[0], fcf_range[1], steps)
    results = []

    for multiplier in fcf_multipliers:
        test_inputs = DCFInputs(
            free_cash_flow=base_inputs.free_cash_flow * multiplier,
            growth_rate_years=base_inputs.growth_rate_years,
            discount_rate=base_inputs.discount_rate,
            terminal_growth_rate=base_inputs.terminal_growth_rate,
            years_to_project=base_inputs.years_to_project
        )
        dcf_result = calculate_dcf(test_inputs)
        results.append({
            "fcf_multiplier": f"{multiplier:.2f}x",
            "enterprise_value": round(dcf_result.enterprise_value, 2),
            "pv_forecast": round(dcf_result.present_value, 2),
            "terminal_value": round(dcf_result.terminal_value, 2)
        })

    values = [r["enterprise_value"] for r in results]
    value_range = max(values) - min(values)
    pct_change = (value_range / np.mean(values)) * 100 if np.mean(values) > 0 else 0

    return {
        "parameter": "Base Free Cash Flow",
        "results": results,
        "min_value": round(min(values), 2),
        "max_value": round(max(values), 2),
        "range": round(value_range, 2),
        "pct_sensitivity": round(pct_change, 2)
    }


def two_way_sensitivity(
    base_inputs: DCFInputs,
    wacc_values: List[float] = None,
    growth_values: List[float] = None
) -> Dict:
    """
    Generate two-way sensitivity table (WACC vs Terminal Growth).

    Args:
        base_inputs: Base DCF inputs
        wacc_values: List of WACC values to test
        growth_values: List of growth values to test

    Returns:
        Two-way sensitivity matrix
    """
    if wacc_values is None:
        wacc_values = [0.08, 0.10, 0.12, 0.14]
    if growth_values is None:
        growth_values = [0.01, 0.02, 0.03, 0.04]

    matrix = []

    for growth in growth_values:
        row = {"terminal_growth": f"{growth:.2%}"}
        for wacc in wacc_values:
            test_inputs = DCFInputs(
                free_cash_flow=base_inputs.free_cash_flow,
                growth_rate_years=base_inputs.growth_rate_years,
                discount_rate=wacc,
                terminal_growth_rate=growth,
                years_to_project=base_inputs.years_to_project
            )
            dcf_result = calculate_dcf(test_inputs)
            row[f"wacc_{wacc:.2%}"] = round(dcf_result.enterprise_value, 2)
        matrix.append(row)

    return {
        "matrix": matrix,
        "wacc_headers": [f"{w:.2%}" for w in wacc_values],
        "growth_headers": [f"{g:.2%}" for g in growth_values]
    }


def identify_key_risks(
    base_inputs: DCFInputs,
    current_price: float
) -> List[Dict]:
    """
    Identify which assumptions pose the greatest risk to the investment thesis.

    Args:
        base_inputs: Base DCF inputs
        current_price: Current market price

    Returns:
        List of identified risks with severity ratings
    """
    risks = []
    base_dcf = calculate_dcf(base_inputs)
    base_value = base_dcf.enterprise_value

    # Test WACC sensitivity
    wacc_sens = sensitivity_to_wacc(base_inputs)
    if abs(wacc_sens["pct_sensitivity"]) > 30:
        risks.append({
            "risk": "WACC Sensitivity",
            "severity": "HIGH",
            "description": f"Valuation changes by {wacc_sens['pct_sensitivity']:.1f}% across WACC range"
        })

    # Test growth sensitivity
    growth_sens = sensitivity_to_growth(base_inputs)
    if abs(growth_sens["pct_sensitivity"]) > 30:
        risks.append({
            "risk": "Terminal Growth Sensitivity",
            "severity": "HIGH",
            "description": f"Valuation changes by {growth_sens['pct_sensitivity']:.1f}% across growth range"
        })

    # Test FCF sensitivity
    fcf_sens = sensitivity_to_fcf(base_inputs)
    if abs(fcf_sens["pct_sensitivity"]) > 30:
        risks.append({
            "risk": "FCF Sensitivity",
            "severity": "HIGH",
            "description": f"Valuation changes by {fcf_sens['pct_sensitivity']:.1f}% across FCF range"
        })

    # Check if current price is at extreme of valuation range
    min_val = min(wacc_sens["min_value"], growth_sens["min_value"], fcf_sens["min_value"])
    max_val = max(wacc_sens["max_value"], growth_sens["max_value"], fcf_sens["max_value"])

    if current_price > max_val:
        risks.append({
            "risk": "Price Above Reasonable Valuation Range",
            "severity": "CRITICAL",
            "description": f"Current price ${current_price} exceeds max scenario value ${max_val:.2f}"
        })
    elif current_price < min_val * 0.8:
        risks.append({
            "risk": "Deep Value Opportunity",
            "severity": "INFO",
            "description": f"Current price ${current_price} is significantly below min scenario value ${min_val:.2f}"
        })

    return risks if risks else [{"risk": "No major sensitivity risks identified", "severity": "LOW", "description": "Valuation is stable across reasonable assumption ranges"}]
