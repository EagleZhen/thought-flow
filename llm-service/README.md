# LLM Service

Optional Python service that provides LLM-powered features for ThoughtFlow.

## Responsibilities

- Path suggestions and recommendations
- Natural language explanations of code
- Integration with various LLM providers (Ollama, OpenAI, etc.)

## Architecture

Runs as a child process spawned by the extension when LLM features are enabled. Communicates via JSON over stdio.

## Technology

Python 3.8+
