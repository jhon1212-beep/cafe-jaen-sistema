"""Exportación de precios de cooperativas: detalle y promedio diario (precio real Pr de la TPP)."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from market.application.export_local_prices import ExportLocalPrices, InvalidPeriodError
from market.domain.local_price import CoffeeType, LocalPriceObservation
from tests.fakes import LIMA, FixedClock, InMemoryPriceRepository

NOW = datetime(2026, 11, 13, 16, 0, tzinfo=LIMA)
TODAY = NOW.date()


def paid(cooperative: str, soles: str, at: datetime, coffee: CoffeeType = CoffeeType.CONVENTIONAL):  # type: ignore[no-untyped-def]
    return LocalPriceObservation(at, cooperative, coffee, Decimal(soles), Decimal("967.27"))


@pytest.fixture
def exports() -> ExportLocalPrices:
    repo = InMemoryPriceRepository()
    morning = NOW.replace(hour=9)
    for observation in (
        paid("Coop. A", "1100", morning),
        paid("Coop. A", "1130", NOW),  # corrige su precio en la tarde: vale el último
        paid("Coop. B", "1120", NOW),
        paid("Coop. C", "1140", NOW),
        paid("Coop. A", "1250", NOW, CoffeeType.ORGANIC),
        paid("Cooperativa JAENPERU sintético A", "500", NOW),  # demostración: no cuenta
        paid("Coop. A", "1000", NOW - timedelta(days=3)),  # fuera del periodo
    ):
        repo.add_local_observation(observation)
    return ExportLocalPrices(repo, FixedClock(NOW))


def test_detail_includes_every_price_of_the_period_in_order(exports: ExportLocalPrices) -> None:
    observations = exports.observations(TODAY, TODAY)

    assert len(observations) == 6
    assert observations[0].paid_soles == Decimal("1100")  # el de la mañana va primero


def test_daily_average_uses_last_price_of_each_real_cooperative(exports: ExportLocalPrices) -> None:
    conventional, organic = exports.daily(TODAY, TODAY)

    assert conventional.coffee_type == CoffeeType.CONVENTIONAL
    assert conventional.cooperatives == 3
    assert conventional.average == Decimal("1130.00")  # (1130 + 1120 + 1140) / 3
    assert (conventional.lowest, conventional.highest) == (Decimal("1120"), Decimal("1140"))
    assert organic.cooperatives == 1


@pytest.mark.parametrize(
    ("start", "end"),
    [(date(2026, 11, 13), date(2026, 11, 12)), (date(2025, 1, 1), date(2026, 11, 13))],
)
def test_rejects_invalid_periods(exports: ExportLocalPrices, start: date, end: date) -> None:
    with pytest.raises(InvalidPeriodError):
        exports.observations(start, end)
