"""Runs three scripted conversations and prints what the loop did."""
import tools
from fake_model import ScriptedModel, call, text
from gate import ApprovalGate
from loop import AgentStopped, run_agent
from tools import REGISTRY

print("--- 1. a failed tool call, then recovery")
m = ScriptedModel([[call("t1", "lookup_ticket", ticket_id=999)],
                   [call("t2", "lookup_ticket", ticket_id=101)],
                   [text("Ticket 101: VPN drops every hour (open).")]])
print(run_agent(m, "m", "sys", REGISTRY, "What is ticket 999?")[0])

print("--- 2. a write that needs approval")
gate = ApprovalGate(lambda name, args: True)
m = ScriptedModel([[call("t3", "add_comment", ticket_id=101, text="Called the user")], [text("Comment added.")]])
print(run_agent(m, "m", "sys", REGISTRY, "Add a comment to 101: Called the user", gate=gate)[0])
print("decision log:", gate.decisions[0]["tool"], gate.decisions[0]["decision"])

print("--- 3. a loop that will not stop")
m = ScriptedModel([[call("t4", "lookup_ticket", ticket_id=101)]] * 10)
try:
    run_agent(m, "m", "sys", REGISTRY, "Keep checking 101")
except AgentStopped as e:
    print("stopped:", e)
