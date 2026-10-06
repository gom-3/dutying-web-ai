"""Loopback-only UI review bridge: synthetic roster, existing Gemini, no DB writes."""

import json
import atexit
import shlex
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Queue, Empty
from threading import BoundedSemaphore, Thread

SLOTS = BoundedSemaphore(1)
NAMES = ['간호사 1', '신규 간호사 2'] + [f'간호사 {i}' for i in range(3, 9)]
REMOTE = r'''
import asyncio, json, sys, time
from pydantic import Field
from src.services.adjust_interpreter import create_llm_service, parse_llm_json
from src.services.intent_extractor import SYSTEM_PROMPT, user_prompt
from src.services.intent_grounding import anchor_extraction
from src.services.intent_pipeline import build_preview
from src.services.intent_schema import Extraction, SemanticPreviewRequest

class ReviewExtraction(Extraction):
    clarificationQuestion: str | None = Field(default=None, max_length=200)

async def run(payload):
    request = SemanticPreviewRequest.model_validate(payload)
    prompt = json.loads(user_prompt(request))
    prompt['outputSchema'] = ReviewExtraction.model_json_schema()
    system = SYSTEM_PROMPT + ''' + repr('''
For this conversational review, clarificationQuestion is a short Korean question
only when an intent cannot be faithfully understood or represented. Ask the
specific missing choice; do not say generically that the request is unsupported.
If removing "근무" could mean clearing cells or assigning a rest/off shift, ask
whether to leave those dates blank or assign the roster's OFF shift. Preserve the
named nurse and dates in that question. Never equate clearing with assigning O,
never turn unspecified work into N. Put every ambiguous clause in unresolved.
For an unambiguous supported request return clarificationQuestion=null.
''') + r'''
    started = time.monotonic()
    response = await asyncio.wait_for(SERVICE.call(
        prompt=json.dumps(prompt, ensure_ascii=False), system_prompt=system,
        json_mode=True), timeout=10)
    output = ReviewExtraction.model_validate(parse_llm_json(response.result))
    extraction = Extraction.model_validate(output.model_dump(exclude={'clarificationQuestion'}))
    preview = build_preview(request, anchor_extraction(request.text, extraction))
    result = preview.model_dump(mode='json')
    if preview.status != 'PREVIEW_READY' and output.clarificationQuestion:
        result['status'] = 'NEEDS_CLARIFICATION'
        result['summary'] = output.clarificationQuestion
    result['modelElapsedMs'] = round((time.monotonic() - started) * 1000)
    return result

SERVICE = create_llm_service()
async def main():
    for line in sys.stdin:
        try:
            result = await run(json.loads(line))
        except Exception as exc:
            result = {'status':'FAILED', 'resolvedIntents':[], 'executionAllowed':False,
                      'summary':'요청을 확인하는 중 응답을 받지 못했어요. 다시 시도해 주세요.',
                      'verificationReport':{'reasonCodes':['MODEL_TIMEOUT' if isinstance(exc, TimeoutError) else 'EXTRACTION_FAILED']}}
        sys.stdout.write('\nREVIEW_RESULT:' + json.dumps(result, ensure_ascii=False) + '\n')
        sys.stdout.flush()
asyncio.run(main())
'''


class Worker:
    def __init__(self):
        self.results = Queue()
        self.process = subprocess.Popen(
            ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=4', 'dutying-dev-server',
             'docker exec -i dutying-api-dev python -u -c ' + shlex.quote(REMOTE)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
        Thread(target=self.read, daemon=True).start()

    def read(self):
        for line in self.process.stdout:
            if line.startswith('REVIEW_RESULT:'):
                self.results.put(json.loads(line.removeprefix('REVIEW_RESULT:')))
        self.results.put(None)

    def call(self, payload):
        self.process.stdin.write(json.dumps(payload, ensure_ascii=False) + '\n')
        self.process.stdin.flush()
        result = self.results.get(timeout=18)
        if result is None:
            raise BrokenPipeError
        return result

    def close(self):
        if self.process.stdin:
            self.process.stdin.close()
        if self.process.poll() is None:
            self.process.terminate()


WORKER = None


def close_worker():
    if WORKER:
        WORKER.close()


atexit.register(close_worker)


def valid_payload(payload):
    context = payload.get('context', {})
    return (
        isinstance(payload.get('text'), str)
        and 0 < len(payload['text']) <= 500
        and context.get('year') == 2026
        and context.get('month') == 11
        and context.get('nurses') == [{'id':i+1, 'name':name} for i, name in enumerate(NAMES)]
        and [value.get('code') for value in context.get('shiftTypes', [])] == ['D','E','N','O']
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.respond(200 if self.path == '/health' else 404, {'status':'ready', 'mode':'read-only-llm-review'})

    def do_POST(self):
        global WORKER
        if self.path != '/semantic-preview':
            return self.respond(404, {})
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 20000:
            return self.respond(400, {})
        try:
            payload = json.loads(self.rfile.read(length))
            if not valid_payload(payload):
                return self.respond(400, {'message':'합성 검토 명단만 사용할 수 있어요.'})
        except (ValueError, TypeError, AttributeError):
            return self.respond(400, {})
        if not SLOTS.acquire(blocking=False):
            return self.respond(429, {'message':'요청을 확인 중이에요. 잠시 후 다시 시도해 주세요.'})
        try:
            if WORKER is None:
                WORKER = Worker()
            self.respond(200, WORKER.call(payload))
        except (Empty, BrokenPipeError, OSError):
            close_worker()
            WORKER = None
            self.respond(504, {})
        finally:
            SLOTS.release()


if __name__ == '__main__':
    WORKER = Worker()
    ThreadingHTTPServer(('127.0.0.1', 38083), Handler).serve_forever()
