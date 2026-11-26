"""Exporta los precios de cooperativas de un periodo (dato del precio real Pr de la TPP).

La ficha de la TPP toma como precio real el promedio de lo que pagan al menos tres
cooperativas de Jaén en la fecha objetivo. Por eso, además del detalle de cada precio, se
entrega un resumen por día y tipo de café con el último precio de cada cooperativa ese día.
Los precios sintéticos de demostración salen marcados en el detalle y no entran al resumen.
"""

from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal

from market.domain.errors import MarketError
from market.domain.local_price import CoffeeType, LocalPriceObservation, is_synthetic
from market.domain.ports.price_repository import PriceRepository
from shared.domain.ports.clock import Clock

MAX_DAYS = 400  # un año y algo más: suficiente para toda la investigación
TWO_DECIMALS = Decimal("0.01")


class InvalidPeriodError(MarketError):
    def __init__(self) -> None:
        super().__init__(
            f"Elige un periodo válido: la fecha final no puede ser anterior a la inicial "
            f"y el periodo no puede pasar de {MAX_DAYS} días"
        )


@dataclass(frozen=True)
class DailyLocalPrice:
    """Promedio de un día y tipo de café, con el último precio de cada cooperativa."""

    day: date
    coffee_type: CoffeeType
    cooperatives: int
    average: Decimal
    lowest: Decimal
    highest: Decimal


class ExportLocalPrices:
    def __init__(self, repository: PriceRepository, clock: Clock) -> None:
        self._repository = repository
        self._clock = clock

    def observations(self, start: date, end: date) -> list[LocalPriceObservation]:
        """Precios anotados entre dos fechas (hora de Lima, ambas incluidas), del más antiguo."""
        if end < start or (end - start).days > MAX_DAYS:
            raise InvalidPeriodError
        zone = self._clock.now().tzinfo
        since = datetime.combine(start, time.min, tzinfo=zone)
        found = [
            o
            for o in self._repository.local_observations_since(since)
            if start <= self.day_of(o) <= end
        ]
        return sorted(found, key=lambda o: o.observed_at)

    def daily(self, start: date, end: date) -> list[DailyLocalPrice]:
        latest: dict[tuple[date, CoffeeType, str], LocalPriceObservation] = {}
        for o in self.observations(start, end):
            if not is_synthetic(o.cooperative):
                latest[(self.day_of(o), o.coffee_type, o.cooperative)] = o  # gana el más reciente
        groups: dict[tuple[date, CoffeeType], list[Decimal]] = {}
        for (day, coffee_type, _), o in latest.items():
            groups.setdefault((day, coffee_type), []).append(o.paid_soles)
        return [
            DailyLocalPrice(
                day,
                coffee_type,
                len(paid),
                (sum(paid, Decimal(0)) / len(paid)).quantize(TWO_DECIMALS),
                min(paid),
                max(paid),
            )
            for (day, coffee_type), paid in sorted(groups.items(), key=lambda g: (g[0][0], g[0][1]))
        ]

    def moment_of(self, observation: LocalPriceObservation) -> datetime:
        """Fecha y hora de Lima en que se anotó el precio."""
        return observation.observed_at.astimezone(self._clock.now().tzinfo)

    def day_of(self, observation: LocalPriceObservation) -> date:
        return self.moment_of(observation).date()
