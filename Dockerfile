# DEMO/REFERENCE SCAFFOLD Dockerfile for the commitments assistant.
# See Exec-Assistant.md section 1 (standard library only, no installs on
# the VDI) -- this image exists for running the CLI outside the VDI.
FROM python:3.12-alpine
WORKDIR /app
COPY assistant.py features.py ingest.py mcp_server.py ./
COPY assets ./assets
ENTRYPOINT ["python", "assistant.py"]
CMD ["site"]
