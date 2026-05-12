"""
Pydantic schemas for financial calculations
"""

from pydantic import BaseModel, Field, confloat
from typing import Optional


class DCFInputs(BaseModel):
    """Inputs for Discounted Cash Flow valuation"""

    free_cash_flow: float = Field(..., description="Base year free cash flow")
    growth_rate_years: list[tuple[float, int]] = Field(
        ..., description="List of (growth_rate, years) tuples"
    )
    discount_rate: confloat(ge=0, le=1) = Field(..., description="Discount rate (WACC)")
    terminal_growth_rate: confloat(ge=0, le=0.05) = Field(
        ..., description="Terminal growth rate"
    )
    years_to_project: int = Field(default=10, description="Years to project")


class DCFOutput(BaseModel):
    """Output from Discounted Cash Flow valuation"""

    present_value: float
    terminal_value: float
    enterprise_value: float
    implied_share_price: Optional[float] = None


class PortfolioSizing(BaseModel):
    """Portfolio position sizing inputs"""

    portfolio_value: float
    conviction_level: int  # 1-10
    margin_of_safety: float  # decimal, e.g., 0.30 for 30%
