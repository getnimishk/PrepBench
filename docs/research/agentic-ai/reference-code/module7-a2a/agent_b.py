"""Agent B: a tiny 'runbook' agent served over A2A with the official a2a-sdk (1.x). No model inside: the point is the protocol.

Run:  python agent_b.py            (serves on http://127.0.0.1:9101)
"""
import sys

import uvicorn
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCard, Part, Task, TaskState, TaskStatus
from google.protobuf.json_format import ParseDict
from starlette.applications import Starlette

PORT = 9101
RUNBOOK = {
    "ERR-4417": "Schema drift: the incoming file has a column the target table does not. Ask the data owner to approve a schema update.",
    "ERR-5102": "Late arrival: the upstream file came after the 06:00 UTC cutoff. Rerun the job once the file lands.",
}

CARD = ParseDict({
    "name": "Runbook agent",
    "description": "Looks up the runbook entry for a pipeline error code.",
    "version": "1.0.0",
    "supportedInterfaces": [{"url": f"http://127.0.0.1:{PORT}/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}],
    "capabilities": {"streaming": False, "pushNotifications": False},
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"],
    "skills": [{"id": "runbook-lookup", "name": "Runbook lookup", "tags": ["runbook", "pipeline"],
                "description": "Given text containing an error code such as ERR-4417, returns the runbook guidance."}],
}, AgentCard())


class RunbookExecutor(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        if context.current_task is None:   # the first event for a new task must be the Task itself
            await event_queue.enqueue_event(Task(id=context.task_id, context_id=context.context_id,
                                                 status=TaskStatus(state=TaskState.TASK_STATE_SUBMITTED)))
        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        await updater.start_work()
        text = context.get_user_input()
        code = next((c for c in RUNBOOK if c in text.upper()), None)
        if code is None:
            await updater.failed(updater.new_agent_message([_text("No runbook entry found for that request.")]))
            return
        await updater.add_artifact([_text(RUNBOOK[code])], name="runbook-entry")
        await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        await TaskUpdater(event_queue, context.task_id, context.context_id).cancel()


def _text(s):
    return Part(text=s)


def build_app():
    handler = DefaultRequestHandler(agent_executor=RunbookExecutor(), task_store=InMemoryTaskStore(), agent_card=CARD)
    routes = create_agent_card_routes(CARD) + create_jsonrpc_routes(handler, rpc_url="/a2a")
    return Starlette(routes=routes)


if __name__ == "__main__":
    uvicorn.run(build_app(), host="127.0.0.1", port=int(sys.argv[1]) if len(sys.argv) > 1 else PORT, log_level="warning")
