"""Sits between an MCP client and server.py on stdio and writes every line that passes to wire.log.

Used only to look at the real messages:  the client launches THIS file, which launches server.py.
"""
import subprocess
import sys
import threading

LOG = open("wire.log", "w", encoding="utf-8")
lock = threading.Lock()


def pump(src, dst, tag):
    for line in iter(src.readline, b""):
        with lock:
            LOG.write(f"{tag} {line.decode('utf-8', 'replace').rstrip()}\n")
            LOG.flush()
        dst.write(line)
        dst.flush()


server = subprocess.Popen([sys.executable, "server.py"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
threading.Thread(target=pump, args=(server.stdout, sys.stdout.buffer, "SERVER->CLIENT"), daemon=True).start()
pump(sys.stdin.buffer, server.stdin, "CLIENT->SERVER")
server.stdin.close()
server.wait(timeout=5)
