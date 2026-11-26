"""PA-02-3 (HU02): horario de la bolsa de Nueva York (ICE, café arábica)."""

from datetime import date, datetime

import pytest

from market.domain.market_hours import MarketHours
from tests.fakes import LIMA


@pytest.mark.parametrize(
    ("moment", "is_open"),
    [
        (datetime(2026, 11, 4, 4, 14, tzinfo=LIMA), False),  # 04:14 NY (horario de invierno)
        (datetime(2026, 11, 4, 4, 15, tzinfo=LIMA), True),  # apertura
        (datetime(2026, 11, 4, 13, 29, tzinfo=LIMA), True),
        (datetime(2026, 11, 4, 13, 30, tzinfo=LIMA), False),  # cierre
        (datetime(2026, 10, 21, 3, 20, tzinfo=LIMA), True),  # en verano abre a las 03:15 de Lima
        (datetime(2026, 11, 7, 10, 0, tzinfo=LIMA), False),  # sábado
    ],
)
def test_knows_when_new_york_market_is_open(moment: datetime, is_open: bool) -> None:
    assert MarketHours().is_open(moment) is is_open


def test_trading_day_uses_new_york_date() -> None:
    # En horario de verano Nueva York va una hora adelante de Lima: ya es 22/10 allá
    late_in_lima = datetime(2026, 10, 21, 23, 30, tzinfo=LIMA)

    assert MarketHours.trading_day(late_in_lima) == date(2026, 10, 22)


@pytest.mark.parametrize(
    ("day", "opens", "closes"),
    [
        (date(2026, 11, 26), "04:15", "13:30"),  # Nueva York en horario de invierno: misma hora
        (date(2027, 3, 15), "03:15", "12:30"),  # desde el 14/03/2027, horario de verano
    ],
)
def test_session_in_lima_follows_new_york_daylight_saving(
    day: date, opens: str, closes: str
) -> None:
    start, end = MarketHours().session_in(day, LIMA)

    assert (f"{start:%H:%M}", f"{end:%H:%M}") == (opens, closes)
