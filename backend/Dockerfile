FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# CJK font for fpdf2 so asset labels can print Chinese brand / owner names.
# wqy-zenhei is ~7MB and ships in Debian main; fpdf2's built-in Helvetica
# is Latin-only and would silently swallow Chinese strings otherwise.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-wqy-zenhei \
 && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
