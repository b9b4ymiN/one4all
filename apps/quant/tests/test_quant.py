"""
Tests for one4all-quant financial calculations
"""

import pytest
from src.dcf import calculate_dcf, calculate_implied_share_price
from src.models.schemas import DCFInputs


def test_dcf_basic():
    """Test basic DCF calculation"""
    inputs = DCFInputs(
        free_cash_flow=100.0,
        growth_rate_years=[(0.10, 5), (0.05, 5)],
        discount_rate=0.10,
        terminal_growth_rate=0.03,
        years_to_project=10
    )

    result = calculate_dcf(inputs)

    assert result.present_value > 0
    assert result.terminal_value > 0
    assert result.enterprise_value > 0
    assert result.enterprise_value == result.present_value + result.terminal_value


def test_dcf_implied_share_price():
    """Test implied share price calculation"""
    enterprise_value = 1000.0
    net_debt = 200.0
    shares_outstanding = 80.0

    price = calculate_implied_share_price(enterprise_value, net_debt, shares_outstanding)

    expected_price = (1000.0 - 200.0) / 80.0
    assert price == expected_price


def test_dcf_higher_discount_rate():
    """Test that higher discount rate reduces present value"""
    base_inputs = DCFInputs(
        free_cash_flow=100.0,
        growth_rate_years=[(0.10, 5), (0.05, 5)],
        discount_rate=0.10,
        terminal_growth_rate=0.03,
        years_to_project=10
    )

    high_discount_inputs = DCFInputs(
        free_cash_flow=100.0,
        growth_rate_years=[(0.10, 5), (0.05, 5)],
        discount_rate=0.15,
        terminal_growth_rate=0.03,
        years_to_project=10
    )

    base_result = calculate_dcf(base_inputs)
    high_discount_result = calculate_dcf(high_discount_inputs)

    assert high_discount_result.enterprise_value < base_result.enterprise_value


def test_dcf_higher_growth_rate():
    """Test that higher growth rate increases present value"""
    base_inputs = DCFInputs(
        free_cash_flow=100.0,
        growth_rate_years=[(0.10, 5), (0.05, 5)],
        discount_rate=0.10,
        terminal_growth_rate=0.03,
        years_to_project=10
    )

    high_growth_inputs = DCFInputs(
        free_cash_flow=100.0,
        growth_rate_years=[(0.15, 5), (0.08, 5)],
        discount_rate=0.10,
        terminal_growth_rate=0.05,
        years_to_project=10
    )

    base_result = calculate_dcf(base_inputs)
    high_growth_result = calculate_dcf(high_growth_inputs)

    assert high_growth_result.enterprise_value > base_result.enterprise_value
