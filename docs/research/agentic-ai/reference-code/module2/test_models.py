import pytest
from pydantic import ValidationError
from models import Ticket


def test_valid_ticket():
    t = Ticket(id=1, title="Printer down", priority=2)
    assert t.priority == 2


def test_string_number_is_coerced():
    assert Ticket(id="7", title="Slow VPN", priority=1).id == 7


def test_short_title_rejected():
    with pytest.raises(ValidationError):
        Ticket(id=1, title="x", priority=1)


def test_priority_out_of_range_rejected():
    with pytest.raises(ValidationError) as e:
        Ticket(id=1, title="Slow VPN", priority=9)
    assert e.value.errors()[0]["loc"] == ("priority",)


def test_non_numeric_id_rejected():
    with pytest.raises(ValidationError):
        Ticket(id="abc", title="Slow VPN", priority=1)
