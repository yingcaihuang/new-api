FRONTEND_DIR = ./web
BACKEND_DIR = .

.PHONY: all build-frontend start-backend

all: build-frontend start-backend

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && bun install && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run main.go &

deploy: build-frontend
	@echo "Building Docker image..."
	@docker build -f Dockerfile.prebuilt -t hub.metami.work/new-api/new-api:latest .
	@echo "Pushing Docker image to registry..."
	@docker push hub.metami.work/new-api/new-api:latest
	@echo "Deploy completed successfully!"
