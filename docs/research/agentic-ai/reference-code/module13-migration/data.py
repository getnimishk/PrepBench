"""Sample data, six legacy queries (Oracle-style) and the human-reviewed target SQL that defines the golden results.

The 'target platform' here is SQLite, a stand-in so the harness runs anywhere with no cloud account. The idea transfers: a legacy engine and a
target engine can both run 'the same' query and give different answers. Each query below is chosen for a known difference:
  Q1 NVL, Q2 DECODE (function names), Q3 string concatenation with NULL (Oracle treats NULL as empty text in ||; SQLite returns NULL),
  Q4 integer division (Oracle gives 33.33; SQLite gives 33 on integers), Q5 ROWNUM and date arithmetic, Q6 a write.
"""
import sqlite3

SCHEMA = """
create table customers (customer_id integer, region text);
create table orders (order_id integer, status text, total integer, items integer, order_date text);
create table people (first_name text, middle_name text, last_name text);
insert into customers values (1,'EMEA'),(2,null),(3,'APAC'),(4,null),(5,'AMER');
insert into orders values (1,'S',100,3,'2026-01-10'),(2,'C',50,2,'2026-01-12'),(3,'S',75,4,'2026-02-01'),(4,null,20,3,'2026-02-03'),(5,'S',200,7,'2026-02-10');
insert into people values ('Ana','Maria','Rao'),('Li',null,'Chen'),('Sam',null,'Ng');
"""

LEGACY = {
    "Q1": "SELECT customer_id, NVL(region,'UNKNOWN') AS region FROM customers ORDER BY customer_id",
    "Q2": "SELECT order_id, DECODE(status,'S','Shipped','C','Cancelled','Other') AS status_text FROM orders ORDER BY order_id",
    "Q3": "SELECT first_name||' '||middle_name||' '||last_name AS full_name FROM people ORDER BY first_name",
    "Q4": "SELECT order_id, total/items AS unit_price FROM orders ORDER BY order_id",
    "Q5": "SELECT * FROM (SELECT order_id, order_date + 7 AS due_date FROM orders ORDER BY order_id) WHERE ROWNUM <= 3",
    "Q6": "UPDATE orders SET status = NVL(status,'P') WHERE status IS NULL",
}

# Reviewed by a person: this is what the legacy query MEANS on the target engine. Golden results are produced by running it.
REFERENCE = {
    "Q1": "SELECT customer_id, COALESCE(region,'UNKNOWN') AS region FROM customers ORDER BY customer_id",
    "Q2": "SELECT order_id, CASE status WHEN 'S' THEN 'Shipped' WHEN 'C' THEN 'Cancelled' ELSE 'Other' END AS status_text FROM orders ORDER BY order_id",
    "Q3": "SELECT first_name||' '||COALESCE(middle_name,'')||' '||last_name AS full_name FROM people ORDER BY first_name",
    "Q4": "SELECT order_id, total*1.0/items AS unit_price FROM orders ORDER BY order_id",
    "Q5": "SELECT order_id, date(order_date,'+7 days') AS due_date FROM orders ORDER BY order_id LIMIT 3",
    "Q6": "UPDATE orders SET status = COALESCE(status,'P') WHERE status IS NULL",
}

WRITES = {"Q6"}


def fresh_db():
    db = sqlite3.connect(":memory:")
    db.executescript(SCHEMA)
    return db


def golden():
    """Run the reviewed reference SQL on fresh data. Reads give result sets; the write gives the table state afterwards."""
    out = {}
    for q, sql in REFERENCE.items():
        db = fresh_db()
        if q in WRITES:
            db.execute(sql)
            out[q] = db.execute("select order_id, status from orders order by order_id").fetchall()
        else:
            out[q] = db.execute(sql).fetchall()
    return out
