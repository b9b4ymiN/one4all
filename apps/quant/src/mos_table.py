"""
Margin of Safety (MOS) table generation module.

Creates MOS analysis table showing position sizes at different price levels
based on conviction and margin of safety requirements.
"""

from typing import List, Dict
from .models.schemas import PortfolioSizing


def generate_mos_table(
    fair_value: float,
    current_price: float,
    conviction_levels: List[int] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    mos_thresholds: List[float] = [0.15, 0.25, 0.35, 0.50]
) -> Dict:
    """
    Generate Margin of Safety table for position sizing decisions.

    Args:
        fair_value: Calculated fair value per share
        current_price: Current market price
        conviction_levels: List of conviction levels (1-10)
        mos_thresholds: List of MOS thresholds to analyze

    Returns:
        Dictionary with MOS table and recommendations
    """
    current_mos = (fair_value - current_price) / fair_value if fair_value > 0 else 0

    # Generate MOS bands
    mos_bands = []
    for threshold in mos_thresholds:
        price_at_mos = fair_value * (1 - threshold)
        mos_bands.append({
            "mos_threshold": f"{threshold:.0%}",
            "price_at_mos": round(price_at_mos, 2),
            "discount_to_fair_value": f"{threshold:.0%}"
        })

    # Position sizing matrix
    position_matrix = []
    for conviction in conviction_levels:
        row = {"conviction": conviction}
        for threshold in mos_thresholds:
            position_size = calculate_position_size(
                conviction=conviction,
                margin_of_safety=threshold,
                base_position=0.10  # Base 10% position at max conviction and MOS
            )
            row[f"mos_{threshold:.0%}"] = f"{position_size:.1%}"
        position_matrix.append(row)

    # Current price analysis
    current_analysis = analyze_current_position(
        fair_value=fair_value,
        current_price=current_price,
        current_mos=current_mos
    )

    return {
        "fair_value": round(fair_value, 2),
        "current_price": round(current_price, 2),
        "current_mos": f"{current_mos:.1%}",
        "mos_bands": mos_bands,
        "position_matrix": position_matrix,
        "current_analysis": current_analysis
    }


def calculate_position_size(
    conviction: int,
    margin_of_safety: float,
    base_position: float = 0.10
) -> float:
    """
    Calculate position size based on conviction and margin of safety.

    Formula: position_size = base_position * (conviction / 10) * (1 + MOS_adjustment)

    Args:
        conviction: Conviction level (1-10)
        margin_of_safety: Margin of safety (as decimal)
        base_position: Base position size

    Returns:
        Recommended position size as percentage of portfolio
    """
    conviction_factor = conviction / 10.0
    mos_factor = min(margin_of_safety / 0.30, 2.0)  # Cap at 2x for 30%+ MOS

    position_size = base_position * conviction_factor * (1 + mos_factor)
    return min(position_size, 0.25)  # Cap at 25% max position


def analyze_current_position(
    fair_value: float,
    current_price: float,
    current_mos: float
) -> Dict:
    """
    Analyze current position relative to fair value.

    Args:
        fair_value: Calculated fair value
        current_price: Current market price
        current_mos: Current margin of safety

    Returns:
        Analysis with recommendation
    """
    upside = (fair_value / current_price) - 1 if current_price > 0 else 0

    if current_mos >= 0.30:
        recommendation = "STRONG_BUY"
        position_size = "15-20%"
    elif current_mos >= 0.20:
        recommendation = "BUY"
        position_size = "10-15%"
    elif current_mos >= 0.10:
        recommendation = "ACCUMULATE"
        position_size = "5-10%"
    elif current_mos >= 0:
        recommendation = "HOLD"
        position_size = "0-5%"
    else:
        recommendation = "AVOID"
        position_size = "0%"

    return {
        "upside_pct": f"{upside:.1%}",
        "recommendation": recommendation,
        "suggested_position": position_size
    }


def format_mos_table_for_report(mos_data: Dict) -> str:
    """
    Format MOS table data for inclusion in investment report.

    Args:
        mos_data: Output from generate_mos_table

    Returns:
        Formatted markdown table
    """
    lines = [
        "## Margin of Safety Analysis",
        "",
        f"**Fair Value:** ${mos_data['fair_value']}",
        f"**Current Price:** ${mos_data['current_price']}",
        f"**Current MOS:** {mos_data['current_mos']}",
        "",
        "### MOS Price Bands",
        "",
        "| MOS Threshold | Price at MOS |",
        "|---------------|-------------|"
    ]

    for band in mos_data['mos_bands']:
        lines.append(f"| {band['mos_threshold']} | ${band['price_at_mos']} |")

    lines.extend([
        "",
        "### Position Sizing Matrix (% of Portfolio)",
        "",
        "| Conviction | 15% MOS | 25% MOS | 35% MOS | 50% MOS |",
        "|------------|---------|---------|---------|---------|"
    ])

    for row in mos_data['position_matrix']:
        lines.append(f"| {row['conviction']} | {row['mos_0.15']} | {row['mos_0.25']} | {row['mos_0.35']} | {row['mos_0.50']} |")

    lines.extend([
        "",
        f"**Current Recommendation:** {mos_data['current_analysis']['recommendation']}",
        f"**Suggested Position:** {mos_data['current_analysis']['suggested_position']}"
    ])

    return "\n".join(lines)
