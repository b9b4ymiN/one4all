"""
one4all-quant: Financial calculation engine

This module provides DCF, reverse DCF, portfolio sizing, and risk calculations
for the one4all investment war room.
"""

__version__ = "0.1.0"

from .dcf import calculate_dcf, calculate_implied_share_price
from .reverse_dcf import (
    calculate_implied_growth_rate,
    calculate_implied_wacc,
    justify_price_analysis
)
from .mos_table import generate_mos_table, format_mos_table_for_report
from .sensitivity import (
    sensitivity_to_wacc,
    sensitivity_to_growth,
    sensitivity_to_fcf,
    two_way_sensitivity,
    identify_key_risks
)

__all__ = [
    # DCF
    "calculate_dcf",
    "calculate_implied_share_price",
    # Reverse DCF
    "calculate_implied_growth_rate",
    "calculate_implied_wacc",
    "justify_price_analysis",
    # MOS Table
    "generate_mos_table",
    "format_mos_table_for_report",
    # Sensitivity
    "sensitivity_to_wacc",
    "sensitivity_to_growth",
    "sensitivity_to_fcf",
    "two_way_sensitivity",
    "identify_key_risks",
]
