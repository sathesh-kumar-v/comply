# ---------- FRONTEND BUILD ----------
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# ---------- BACKEND ----------
FROM python:3.10 AS backend
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend into backend's static directory
COPY --from=frontend-build /app/frontend/.next ./backend/static/.next
COPY --from=frontend-build /app/frontend/public ./backend/static/public

# Set working directory for backend
WORKDIR /app/backend

# Expose backend port
EXPOSE 8000

# Start FastAPI backend with main.py
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

