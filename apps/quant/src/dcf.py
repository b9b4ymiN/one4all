"""
Discounted Cash Flow (DCF) valuation module.

Implements multi-stage DCF with explicit forecast period and terminal value.
"""

import argparse
import json
import sys
from typing import List, Tuple
from .models.schemas import DCFInputs, DCFOutput


def calculate_dcf(inputs: DCFInputs) -> DCFOutput:
    """
    Calculate Discounted Cash Flow valuation.

    Args:
        inputs: DCF input parameters

    Returns:
        DCF output with present value, terminal value, and enterprise value
    """
    # Calculate present value of explicit forecast period cash flows
    pv_forecast_cash_flows = 0.0
    current_fcf = inputs.free_cash_flow
    discount_factor = 1.0
    year = 1

    for growth_rate, years in inputs.growth_rate_years:
        for _ in range(years):
            if year > inputs.years_to_project:
                break
            current_fcf *= (1 + growth_rate)
            discount_factor *= (1 + inputs.discount_rate)
            pv_forecast_cash_flows += current_fcf / discount_factor
            year += 1

    # Calculate terminal value using Gordon Growth Model
    # TV = Final FCF * (1 + terminal_growth) / (discount_rate - terminal_growth)
    terminal_fcf = current_fcf * (1 + inputs.terminal_growth_rate)
    terminal_value = terminal_fcf / (inputs.discount_rate - inputs.terminal_growth_rate)

    # Discount terminal value to present
    pv_terminal_value = terminal_value / discount_factor

    # Enterprise value = PV of forecast CFs + PV of terminal value
    enterprise_value = pv_forecast_cash_flows + pv_terminal_value

    return DCFOutput(
        present_value=pv_forecast_cash_flows,
        terminal_value=terminal_value,
        enterprise_value=enterprise_value
    )


def calculate_implied_share_price(
    enterprise_value: float,
    net_debt: float,
    shares_outstanding: float
) -> float:
    """
    Calculate implied share price from enterprise value.

    Args:
        enterprise_value: Enterprise value from DCF
        net_debt: Net debt (debt - cash)
        shares_outstanding: Number of shares outstanding

    Returns:
        Implied share price
    """
    equity_value = enterprise_value - net_debt
    return equity_value / shares_outstanding


def run_sensitivity_analysis(
    base_inputs: DCFInputs,
    wacc_range: Tuple[float, float] = (0.08, 0.14),
    growth_range: Tuple[float, float] = (0.02, 0.06)
) -> dict:
    """
    Run sensitivity analysis on DCF inputs.

    Args:
        base_inputs: Base DCF inputs
        wacc_range: Range of WACC to test (min, max)
        growth_range: Range of terminal growth to test (min, max)

    Returns:
        Dictionary with sensitivity table results
    """
    sensitivity_table = {}

    for wacc in [wacc_range[0], base_inputs.discount_rate, wacc_range[1]]:
        for growth in [growth_range[0], inputs.terminal_growth_rate, growth_range[1]]:
            test_inputs = DCFInputs(
                free_cash_flow=base_inputs.free_cash_flow,
                growth_rate_years=base_inputs.growth_rate_years,
                discount_rate=wacc,
                terminal_growth_rate=growth,
                years_to_project=base_inputs.years_to_project
            )
            result = calculate_dcf(test_inputs)
            key = f"WACC {wacc:.1%} / g {growth:.1%}"
            sensitivity_table[key] = result.enterprise_value

    return sensitivity_table


def main():
    """CLI entry point for DCF calculation with JSON output."""
    parser = argparse.ArgumentParser(description='Calculate DCF valuation')
    parser.add_argument('--ticker', type=str, required=True, help='Stock ticker symbol')
    parser.add_argument('--free-cash-flow', type=float, required=True, help='Current free cash flow')
    parser.add_argument('--wacc', type=float, default=0.10, help='Discount rate (WACC)')
    parser.add_argument('--terminal-growth', type=float, default=0.025, help='Terminal growth rate')
    parser.add_argument('--years', type=int, default=10, help='Years to project')
    parser.add_argument('--net-debt', type=float, default=0, help='Net debt (debt - cash)')
    parser.add_argument('--shares', type=float, default=1, help='Shares outstanding')
    parser.add_argument('--growth-stage', type=str, action='append', help='Growth stages as rate:years (e.g., 0.15:5)')

    args = parser.parse_args()

    # Build growth rate years from stages
    growth_rate_years: List[Tuple[float, int]] = []
    if args.growth_stage:
        for stage in args.growth_stage:
            try:
                rate, years = stage.split(':')
                growth_rate_years.append((float(rate), int(years)))
            except ValueError:
                print(f"Invalid growth stage format: {stage}", file=sys.stderr)
                sys.exit(1)
    else:
        # Default: 3 years high growth, then stable
        growth_rate_years = [(0.10, 3), (0.05, 7)]

    # Create DCF inputs
    inputs = DCFInputs(
        free_cash_flow=args.free_cash_flow,
        growth_rate_years=growth_rate_years,
        discount_rate=args.wacc,
        terminal_growth_rate=args.terminal_growth,
        years_to_project=args.years
    )

    # Calculate DCF
    try:
        result = calculate_dcf(inputs)
        implied_price = calculate_implied_share_price(
            result.enterprise_value,
            args.net_debt,
            args.shares
        )

        # Output JSON
        output = {
            'ticker': args.ticker,
            'present_value': result.present_value,
            'terminal_value': result.terminal_value,
            'enterprise_value': result.enterprise_value,
            'implied_share_price': implied_price
        }

        print(json.dumps(output, indent=2))

    except Exception as e:
        error_output = {
            'ticker': args.ticker,
            'error': str(e)
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
