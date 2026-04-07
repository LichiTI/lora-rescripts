import os
import subprocess
import threading
import uuid
from enum import Enum
from pathlib import Path
from subprocess import PIPE, CompletedProcess, TimeoutExpired
from typing import Dict, List

import psutil

from mikazuki.launch_utils import base_dir_path
from mikazuki.log import log


def kill_proc_tree(pid, including_parent=True):
    parent = psutil.Process(pid)
    children = parent.children(recursive=True)
    for child in children:
        child.kill()
    psutil.wait_procs(children, timeout=5)
    if including_parent:
        parent.kill()
        parent.wait(5)


class TaskStatus(Enum):
    CREATED = 0
    RUNNING = 1
    FINISHED = 2
    TERMINATED = 3


class Task:
    def __init__(self, task_id, command, environ=None, cwd=None):
        self.task_id = task_id
        self.lock = threading.Lock()
        self.output_lines: list[str] = []
        self.max_output_lines = 5000
        self.command = command
        self.status = TaskStatus.CREATED
        self.environ = environ or os.environ
        self.cwd = str(Path(cwd).resolve()) if cwd else str(base_dir_path())
        self._output_thread = None
        self.process = None

    def _append_output_line(self, line: str):
        with self.lock:
            self.output_lines.append(line)
            if len(self.output_lines) > self.max_output_lines:
                self.output_lines = self.output_lines[-self.max_output_lines :]

    def _decode_output(self, raw: bytes) -> str:
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("gbk", errors="replace")

    def _read_output(self):
        if self.process is None or self.process.stdout is None:
            return

        fd = self.process.stdout.fileno()
        buf = b""
        while True:
            try:
                chunk = os.read(fd, 8192)
            except OSError:
                break
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                idx = buf.find(b"\n")
                raw_line = buf[:idx]
                buf = buf[idx + 1 :]
                if raw_line.endswith(b"\r"):
                    raw_line = raw_line[:-1]
                if b"\r" in raw_line:
                    raw_line = raw_line.rsplit(b"\r", 1)[-1]
                line = self._decode_output(raw_line).rstrip()
                if not line:
                    continue
                print(line, flush=True)
                self._append_output_line(line)

        if buf:
            if buf.endswith(b"\r"):
                buf = buf[:-1]
            if b"\r" in buf:
                buf = buf.rsplit(b"\r", 1)[-1]
            line = self._decode_output(buf).rstrip()
            if line:
                print(line, flush=True)
                self._append_output_line(line)

    def _join_output_thread(self):
        if self._output_thread is not None:
            self._output_thread.join(timeout=2)
            self._output_thread = None

    def communicate(self, input=None, timeout=None):
        del input
        if self.process is None:
            raise RuntimeError("Task process has not been started.")

        try:
            self.process.wait(timeout=timeout)
        except TimeoutExpired as exc:
            try:
                kill_proc_tree(self.process.pid, True)
            except Exception:
                self.process.kill()
            self._join_output_thread()
            raise exc
        except Exception:
            try:
                self.process.kill()
            except Exception:
                pass
            self._join_output_thread()
            raise

        self._join_output_thread()
        retcode = self.process.poll()
        if self.status == TaskStatus.RUNNING:
            self.status = TaskStatus.FINISHED
        stdout = "\n".join(self.output_lines)
        return CompletedProcess(self.process.args, retcode, stdout, None)

    def wait(self):
        if self.process is None:
            return
        self.process.wait()
        self._join_output_thread()
        if self.status == TaskStatus.RUNNING:
            self.status = TaskStatus.FINISHED

    def execute(self):
        self.status = TaskStatus.RUNNING
        self.process = subprocess.Popen(
            self.command,
            env=self.environ,
            cwd=self.cwd,
            stdout=PIPE,
            stderr=subprocess.STDOUT,
        )
        self._output_thread = threading.Thread(target=self._read_output, daemon=True)
        self._output_thread.start()

    def terminate(self):
        if self.process is None:
            self.status = TaskStatus.TERMINATED
            return
        try:
            kill_proc_tree(self.process.pid, True)
        except Exception as e:
            log.error(f"Error when killing process: {e}")
            return
        finally:
            self.status = TaskStatus.TERMINATED


class TaskManager:
    def __init__(self, max_concurrent=1) -> None:
        self.max_concurrent = max_concurrent
        self.tasks: Dict[str, Task] = {}

    def create_task(self, command: List[str], environ, cwd=None):
        running_tasks = [t for _, t in self.tasks.items() if t.status == TaskStatus.RUNNING]
        if len(running_tasks) >= self.max_concurrent:
            log.error(
                "Unable to create a task because there are already "
                f"{len(running_tasks)} tasks running, reaching the maximum concurrent limit. / "
                f"无法创建任务，因为已经有 {len(running_tasks)} 个任务正在运行，已达到最大并发限制。"
            )
            return None
        task_id = str(uuid.uuid4())
        task = Task(task_id=task_id, command=command, environ=environ, cwd=cwd)
        self.tasks[task_id] = task
        log.info(f"Task {task_id} created")
        return task

    def add_task(self, task_id: str, task: Task):
        self.tasks[task_id] = task

    def terminate_task(self, task_id: str):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            task.terminate()

    def wait_for_process(self, task_id: str):
        if task_id in self.tasks:
            task: Task = self.tasks[task_id]
            task.wait()

    def dump(self) -> List[Dict]:
        return [
            {
                "id": task.task_id,
                "status": task.status.name,
                "returncode": task.process.returncode
                if hasattr(task, "process") and task.process and task.process.poll() is not None
                else None,
            }
            for task in self.tasks.values()
        ]


tm = TaskManager()
