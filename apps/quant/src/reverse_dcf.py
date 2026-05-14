"""
Reverse DCF valuation module.

Calculates implied growth rates or discount rates required to justify current price.
"""

from typing import Optional, Tuple
from .models.schemas import DCFInputs, DCFOutput
import bisect


def calculate_implied_growth_rate(
    current_price: float,
    net_debt: float,
    shares_outstanding: float,
    base_inputs: DCFInputs,
    target_growth_range: Tuple[float, float] = (0.0, 0.15),
    precision: float = 0.0001
) -> float:
    """
    Calculate the implied growth rate required to justify current stock price.

    Uses binary search to find the terminal growth rate that makes DCF value
    equal to current market price.

    Args:
        current_price: Current stock price
        net_debt: Net debt (debt - cash)
        shares_outstanding: Number of shares outstanding
        base_inputs: Base DCF inputs
        target_growth_range: Range to search for implied growth rate
        precision: Search precision

    Returns:
        Implied terminal growth rate (as decimal)
    """
    equity_value = current_price * shares_outstanding
    target_ev = equity_value + net_debt

    low, high = target_growth_range

    # Binary search for implied growth rate
    for _ in range(50):  # Max iterations for precision
        if high - low < precision:
            break

        mid = (low + high) / 2

        test_inputs = DCFInputs(
            free_cash_flow=base_inputs.free_cash_flow,
            growth_rate_years=base_inputs.growth_rate_years,
            discount_rate=base_inputs.discount_rate,
            terminal_growth_rate=mid,
            years_to_project=base_inputs.years_to_project
        )

        from .dcf import calculate_dcf
        result = calculate_dcf(test_inputs)

        if result.enterprise_value > target_ev:
            low = mid
        else:
            high = mid

    return (low + high) / 2


def calculate_implied_wacc(
    current_price: float,
    net_debt: float,
    shares_outstanding: float,
    base_inputs: DCFInputs,
    target_wacc_range: Tuple[float, float] = (0.05, 0.20),
    precision: float = 0.0001
) -> float:
    """
    Calculate the implied discount rate (WACC) required to justify current price.

    Uses binary search to find the discount rate that makes DCF value
    equal to current market price.

    Args:
        current_price: Current stock price
        net_debt: Net debt (debt - cash)
        shares_outstanding: Number of shares outstanding
        base_inputs: Base DCF inputs
        target_wacc_range: Range to search for implied WACC
        precision: Search precision

    Returns:
        Implied WACC (as decimal)
    """
    equity_value = current_price * shares_outstanding
    target_ev = equity_value + net_debt

    low, high = target_wacc_range

    # Binary search for implied WACC
    for _ in range(50):
        if high - low < precision:
            break

        mid = (low + high) / 2

        test_inputs = DCFInputs(
            free_cash_flow=base_inputs.free_cash_flow,
            growth_rate_years=base_inputs.growth_rate_years,
            discount_rate=mid,
            terminal_growth_rate=base_inputs.terminal_growth_rate,
            years_to_project=base_inputs.years_to_project
        )

        from .dcf import calculate_dcf
        result = calculate_dcf(test_inputs)

        if result.enterprise_value > target_ev:
            low = mid
        else:
            high = mid

    return (low + high) / 2


def justify_price_analysis(
    current_price: float,
    fair_value: float,
    tolerance: float = 0.10
) -> dict:
    """
    Analyze if current price can be justified within reasonable assumptions.

    Args:
        current_price: Current stock price
        fair_value: Calculated fair value from DCF
        tolerance: Acceptable deviation from fair value (default 10%)

    Returns:
        Analysis result with justification status
    """
    deviation = (current_price - fair_value) / fair_value

    return {
        "current_price": current_price,
        "fair_value": fair_value,
        "deviation_pct": deviation * 100,
        "within_tolerance": abs(deviation) <= tolerance,
        "status": "JUSTIFIED" if abs(deviation) <= tolerance else "REQUIRES_INVESTIGATION",
        "upside_downside_pct": ((fair_value / current_price) - 1) * 100
    }
